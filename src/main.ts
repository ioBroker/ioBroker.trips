import { Adapter, type AdapterOptions } from '@iobroker/adapter-core';
import type { TrackedObjectConfig, TripsAdapterConfig } from './types';
import { distance, fromMs, METERS_PER_UNIT, simplify } from './lib/geo';
import { CO2_DEFAULTS, configNumber, objectSettings, type ObjectSettings } from './lib/objectSettings';
import { findPlace, Geocoder, isPrivate, parsePlaces, type Place } from './lib/places';
import { Fusion, resolveSource, SourceAssembler } from './lib/source';
import { TripStore } from './lib/storage';
import {
    aggregate,
    formatDuration,
    PERIODS,
    periodStart,
    round,
    tripId,
    type SummaryStop,
    type TripSummary,
} from './lib/summary';
import { TripDetector, type DetectorState, type FinishedTrip, type Fix, type TrackPoint } from './lib/tripDetector';
import { toGeoJson, toGpx } from './lib/export';

/** Time based decisions (trip end, live duration) */
const TICK_MS = 5000;
/** A running trip is saved this often, so it survives a restart */
const CHECKPOINT_MS = 60000;
/** Shorter trips are discarded (moved the car in the driveway, GPS drift), unless started by hand */
const MIN_TRIP_DISTANCE = 100;
/** Meters: tolerance of the track simplification before it is stored */
const TRACK_TOLERANCE = 2;
/** Live states are written at least this often while no trip runs */
const IDLE_LIVE_MS = 60000;

interface ObjectRuntime {
    /** ID of the device object below the instance */
    id: string;
    config: TrackedObjectConfig;
    settings: ObjectSettings;
    detector: TripDetector;
    sources: SourceAssembler[];
    fusion: Fusion;
    /** All summaries, sorted by start */
    trips: TripSummary[];
    lastLive: number;
    lastCheckpoint: number;
    /** Serializes the asynchronous work of this object (files, states) */
    queue: Promise<void>;
}

type StateDefinition = Partial<ioBroker.StateCommon> & { name: string; type: ioBroker.CommonType; role: string };

export class TripsAdapter extends Adapter {
    declare config: TripsAdapterConfig;

    private runtimes: Record<string, ObjectRuntime> = {};
    private sourcesByState: Record<string, SourceAssembler[]> = {};
    private places: Place[] = [];
    private home: Place | null = null;
    private store!: TripStore;
    private geocoder: Geocoder | null = null;
    private systemLanguage: ioBroker.Languages = 'en';
    private liveIntervalMs = 5000;
    private tickTimer: ioBroker.Interval | undefined;
    private midnightTimer: ioBroker.Timeout | undefined;
    private retentionTimer: ioBroker.Interval | undefined;
    private unloading = false;

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({
            ...options,
            name: 'trips',
            ready: () => this.onReady(),
            stateChange: (id, state) => this.onStateChange(id, state),
            message: obj => this.onMessage(obj),
            unload: callback => this.onUnload(callback),
        });
    }

    private async onReady(): Promise<void> {
        this.store = new TripStore(this);
        const systemConfig = await this.getForeignObjectAsync('system.config');
        this.systemLanguage = systemConfig?.common?.language || 'en';
        this.liveIntervalMs = Math.max(1, configNumber(this.config.liveInterval, 5)) * 1000;

        this.places = parsePlaces(this.config.places);
        this.home = this.config.homePlace ? (this.places.find(p => p.name === this.config.homePlace) ?? null) : null;
        if (this.config.homePlace && !this.home) {
            this.log.warn(`Home place "${this.config.homePlace}" not found in the places`);
        }

        if (this.config.geocoding) {
            this.geocoder = new Geocoder(
                `ioBroker.trips/${this.version || '0'} (+https://github.com/ioBroker/ioBroker.trips)`,
                this.systemLanguage,
                this.log,
            );
            this.geocoder.load(await this.store.readJson<Record<string, string>>('geocache.json'));
        }

        for (const config of this.config.objects || []) {
            if (!config?.enabled || !config.name?.trim()) {
                continue;
            }
            const id = this.objectId(config.name);
            if (this.runtimes[id]) {
                this.log.warn(`Object "${config.name}" is configured twice, the second one is ignored`);
                continue;
            }
            await this.initObject(id, config);
        }

        await this.initSources();

        if (!Object.keys(this.runtimes).length) {
            this.log.warn('No objects configured. Add an object and at least one source in the settings');
        }

        await this.subscribeStatesAsync('*.control.*');
        this.tickTimer = this.setInterval(() => this.onTick(), TICK_MS);
        this.scheduleMidnight();
        this.retentionTimer = this.setInterval(() => this.runRetention(), 24 * 3600000);
        this.setTimeout(() => this.runRetention(), 60000);
    }

    /** Object ID from the name of the object */
    private objectId(name: string): string {
        return name
            .trim()
            .replace(this.FORBIDDEN_CHARS, '_')
            .replace(/[\s.]+/g, '_');
    }

    private findRuntime(name: unknown): ObjectRuntime | null {
        if (typeof name !== 'string' || !name) {
            return null;
        }
        return (
            this.runtimes[name] ||
            this.runtimes[this.objectId(name)] ||
            Object.values(this.runtimes).find(rt => rt.config.name === name) ||
            null
        );
    }

    private enqueue(rt: ObjectRuntime, job: () => Promise<void>): void {
        rt.queue = rt.queue.then(job).catch(e => this.log.error(`${rt.config.name}: ${e?.stack || e}`));
    }

    private async initObject(id: string, config: TrackedObjectConfig): Promise<void> {
        const settings = objectSettings(config);
        const saved = await this.store.readJson<DetectorState>(`${id}/current.json`);
        const rt: ObjectRuntime = {
            id,
            config,
            settings,
            detector: null as unknown as TripDetector,
            sources: [],
            fusion: null as unknown as Fusion,
            trips: [],
            lastLive: 0,
            lastCheckpoint: Date.now(),
            queue: Promise.resolve(),
        };
        rt.detector = new TripDetector(
            settings.detector,
            {
                onStart: trip => {
                    this.log.info(
                        `${config.name}: trip started (${trip.reason}) at ${new Date(trip.start).toLocaleString()}`,
                    );
                    rt.lastLive = Date.now();
                    this.enqueue(rt, async () => {
                        await this.writeLive(rt);
                        await this.saveCheckpoint(rt);
                    });
                },
                onEnd: trip => this.enqueue(rt, () => this.finishTrip(rt, trip)),
            },
            saved,
        );
        if (saved?.trip) {
            this.log.info(
                `${config.name}: continuing the trip started at ${new Date(saved.trip.start).toLocaleString()}`,
            );
        }
        rt.trips = await this.store.loadSummaries(id);
        this.runtimes[id] = rt;

        await this.createObjectStates(rt);
        const last = rt.trips[rt.trips.length - 1];
        if (last) {
            await this.writeLastTrip(rt, last);
        }
        await this.writeStats(rt);
        await this.setStateAsync(`${id}.control.manualTrip`, rt.detector.manual, true);
    }

    private async initSources(): Promise<void> {
        const exists = async (id: string): Promise<boolean> => !!(await this.getForeignObjectAsync(id));
        const byObject: Record<string, SourceAssembler[]> = {};

        for (const config of this.config.sources || []) {
            if (!config?.enabled) {
                continue;
            }
            const rt = this.findRuntime(config.object?.trim());
            if (!rt) {
                this.log.warn(`Source for unknown or disabled object "${config.object}" is ignored`);
                continue;
            }
            const resolved = await resolveSource(config, exists);
            if (!resolved) {
                this.log.warn(`${rt.config.name}: source "${config.type}" has no position states and is ignored`);
                continue;
            }
            const assembler = new SourceAssembler(
                resolved,
                (fix, source) => this.onFix(rt, fix, source),
                (on, ts, source) => this.onIgnition(rt, on, ts, source),
            );
            rt.sources.push(assembler);
            (byObject[rt.id] ||= []).push(assembler);
            for (const stateId of assembler.stateIds) {
                (this.sourcesByState[stateId] ||= []).push(assembler);
            }
            this.log.info(`${rt.config.name}: source ${resolved.label} (priority ${resolved.priority})`);
        }

        for (const rt of Object.values(this.runtimes)) {
            rt.fusion = new Fusion(rt.sources, rt.settings.detector.maxAccuracy);
            if (!rt.sources.length) {
                this.log.warn(`${rt.config.name}: no source configured`);
            }
        }

        const ids = Object.keys(this.sourcesByState);
        for (const id of ids) {
            const state = await this.getForeignStateAsync(id);
            for (const assembler of this.sourcesByState[id]) {
                assembler.init(id, state);
            }
        }
        if (ids.length) {
            await this.subscribeForeignStatesAsync(ids);
        }

        // Take over the current ignition, e.g. after a restart while driving
        const now = Date.now();
        for (const rt of Object.values(this.runtimes)) {
            const ignition = rt.fusion.ignition();
            if (ignition && rt.detector.ignition !== ignition.on) {
                rt.detector.setIgnition(ignition.on, Math.min(ignition.source.ignitionTs || now, now), now);
            }
            await this.writeLive(rt);
        }
    }

    private onFix(rt: ObjectRuntime, fix: Fix, source: SourceAssembler): void {
        if (this.unloading || !rt.fusion.accept(source)) {
            return;
        }
        const now = Date.now();
        // a source with a wrong clock must not create trips in the future
        if (fix.ts > now + 60000) {
            fix.ts = now;
        }
        const result = rt.detector.processFix(fix, now);
        if (result !== 'accepted') {
            this.log.debug(`${rt.config.name}: position of ${fix.source} ignored (${result})`);
        }
        if (now - rt.lastLive >= this.liveIntervalMs) {
            rt.lastLive = now;
            this.enqueue(rt, () => this.writeLive(rt));
        }
    }

    private onIgnition(rt: ObjectRuntime, on: boolean, ts: number, source: SourceAssembler): void {
        if (this.unloading || rt.fusion.ignition()?.source !== source) {
            return;
        }
        const now = Date.now();
        rt.detector.setIgnition(on, Math.min(ts, now), now);
        rt.lastLive = now;
        this.enqueue(rt, () => this.writeLive(rt));
    }

    private onTick(): void {
        const now = Date.now();
        for (const rt of Object.values(this.runtimes)) {
            rt.detector.tick(now);
            const active = !!rt.detector.trip;
            if (now - rt.lastLive >= (active ? this.liveIntervalMs : IDLE_LIVE_MS)) {
                rt.lastLive = now;
                this.enqueue(rt, () => this.writeLive(rt));
            }
            if (active && now - rt.lastCheckpoint >= CHECKPOINT_MS) {
                this.enqueue(rt, () => this.saveCheckpoint(rt));
            }
        }
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state || this.unloading) {
            return;
        }
        if (id.startsWith(`${this.namespace}.`)) {
            if (!state.ack) {
                await this.onControl(id.substring(this.namespace.length + 1), state);
            }
            return;
        }
        const sources = this.sourcesByState[id];
        if (sources) {
            for (const source of sources) {
                source.onStateChange(id, state);
            }
        }
    }

    private async onControl(id: string, state: ioBroker.State): Promise<void> {
        const match = id.match(/^(.+)\.control\.(manualTrip|endTrip)$/);
        const rt = match ? this.runtimes[match[1]] : null;
        if (!match || !rt) {
            return;
        }
        const now = Date.now();
        if (match[2] === 'manualTrip') {
            const on = state.val === true || state.val === 'true' || state.val === 1 || state.val === 'on';
            rt.detector.setManual(on, now);
            await this.setStateAsync(id, rt.detector.manual, true);
        } else {
            rt.detector.finish(now);
            await this.setStateAsync(id, false, true);
            await this.setStateAsync(`${rt.id}.control.manualTrip`, false, true);
        }
        rt.lastLive = now;
        this.enqueue(rt, () => this.writeLive(rt));
    }

    // ------------------------------------------------------------------ objects

    private async createObjectStates(rt: ObjectRuntime): Promise<void> {
        const unit = rt.settings.unit;
        const speedUnit = rt.settings.speedUnit;
        const consumptionUnit = rt.config.consumptionUnit || 'l';
        const currency = this.config.currency || '€';
        const withConsumption = rt.config.consumptionMode === 'distance' || rt.config.consumptionMode === 'hours';

        await this.extendObjectAsync(rt.id, {
            type: 'device',
            common: { name: rt.config.name },
            native: { type: rt.settings.type },
        });
        const channels: Record<string, string> = {
            live: 'Current trip',
            lastTrip: 'Last trip',
            stats: 'Statistics',
            control: 'Control',
        };
        for (const [channel, name] of Object.entries(channels)) {
            await this.extendObjectAsync(`${rt.id}.${channel}`, { type: 'channel', common: { name }, native: {} });
        }
        const periodNames: Record<string, string> = {
            today: 'Today',
            week: 'This week',
            month: 'This month',
            year: 'This year',
            total: 'Total',
        };

        const states: Record<string, StateDefinition> = {
            'live.active': { name: 'Trip is running', type: 'boolean', role: 'indicator' },
            'live.start': { name: 'Start of the trip', type: 'number', role: 'date.start' },
            'live.distance': { name: 'Distance', type: 'number', role: 'value.distance', unit },
            'live.duration': { name: 'Duration', type: 'number', role: 'value.interval', unit: 's' },
            'live.speed': { name: 'Speed', type: 'number', role: 'value.speed', unit: speedUnit },
            'live.maxSpeed': { name: 'Max. speed', type: 'number', role: 'value.speed.max', unit: speedUnit },
            'live.avgSpeed': { name: 'Average speed', type: 'number', role: 'value.speed', unit: speedUnit },
            'live.latitude': { name: 'Latitude', type: 'number', role: 'value.gps.latitude', unit: '°' },
            'live.longitude': { name: 'Longitude', type: 'number', role: 'value.gps.longitude', unit: '°' },
            'live.position': { name: 'Position (lat;lon)', type: 'string', role: 'value.gps' },
            'live.place': { name: 'Current place', type: 'string', role: 'text' },
            'live.source': { name: 'Used source', type: 'string', role: 'text' },
            'live.ignition': { name: 'Ignition / engine', type: 'boolean', role: 'indicator' },
            'live.lastPosition': { name: 'Time of the last position', type: 'number', role: 'date' },
            'lastTrip.id': { name: 'ID', type: 'string', role: 'text' },
            'lastTrip.start': { name: 'Start', type: 'number', role: 'date.start' },
            'lastTrip.end': { name: 'End', type: 'number', role: 'date.end' },
            'lastTrip.from': { name: 'From', type: 'string', role: 'text' },
            'lastTrip.to': { name: 'To', type: 'string', role: 'text' },
            'lastTrip.distance': { name: 'Distance', type: 'number', role: 'value.distance', unit },
            'lastTrip.duration': { name: 'Duration', type: 'number', role: 'value.interval', unit: 's' },
            'lastTrip.movingTime': { name: 'Moving time', type: 'number', role: 'value.interval', unit: 's' },
            'lastTrip.avgSpeed': { name: 'Average speed', type: 'number', role: 'value.speed', unit: speedUnit },
            'lastTrip.maxSpeed': { name: 'Max. speed', type: 'number', role: 'value.speed.max', unit: speedUnit },
            'lastTrip.stops': { name: 'Stops', type: 'number', role: 'value' },
            'lastTrip.elevationGain': { name: 'Elevation gain', type: 'number', role: 'value', unit: 'm' },
            'lastTrip.summary': { name: 'Summary', type: 'string', role: 'text' },
            'lastTrip.json': { name: 'Trip as JSON', type: 'string', role: 'json' },
            'lastTrip.gpx': { name: 'GPX file', type: 'string', role: 'url' },
            'control.manualTrip': { name: 'Manual trip', type: 'boolean', role: 'switch', write: true },
            'control.endTrip': { name: 'End the trip now', type: 'boolean', role: 'button', write: true, read: false },
        };
        if (this.home) {
            states['live.distanceHome'] = {
                name: `Distance to ${this.home.name}`,
                type: 'number',
                role: 'value.distance',
                unit,
            };
        }
        if (withConsumption) {
            states['live.consumption'] = {
                name: 'Consumption (estimated)',
                type: 'number',
                role: 'value',
                unit: consumptionUnit,
            };
            states['lastTrip.consumption'] = {
                name: 'Consumption',
                type: 'number',
                role: 'value',
                unit: consumptionUnit,
            };
            states['lastTrip.cost'] = { name: 'Cost', type: 'number', role: 'value', unit: currency };
            states['lastTrip.co2'] = { name: 'CO₂', type: 'number', role: 'value', unit: 'kg' };
        }
        for (const period of PERIODS) {
            await this.extendObjectAsync(`${rt.id}.stats.${period}`, {
                type: 'channel',
                common: { name: periodNames[period] },
                native: {},
            });
            const prefix = `stats.${period}`;
            states[`${prefix}.distance`] = { name: 'Distance', type: 'number', role: 'value.distance', unit };
            states[`${prefix}.trips`] = { name: 'Trips', type: 'number', role: 'value' };
            states[`${prefix}.duration`] = { name: 'Duration', type: 'number', role: 'value', unit: 'h' };
            states[`${prefix}.movingTime`] = { name: 'Moving time', type: 'number', role: 'value', unit: 'h' };
            states[`${prefix}.engineTime`] = { name: 'Engine hours', type: 'number', role: 'value', unit: 'h' };
            states[`${prefix}.longestTrip`] = { name: 'Longest trip', type: 'number', role: 'value.distance', unit };
            states[`${prefix}.maxSpeed`] = {
                name: 'Max. speed',
                type: 'number',
                role: 'value.speed.max',
                unit: speedUnit,
            };
            if (withConsumption) {
                states[`${prefix}.consumption`] = {
                    name: 'Consumption',
                    type: 'number',
                    role: 'value',
                    unit: consumptionUnit,
                };
                states[`${prefix}.cost`] = { name: 'Cost', type: 'number', role: 'value', unit: currency };
                states[`${prefix}.co2`] = { name: 'CO₂', type: 'number', role: 'value', unit: 'kg' };
            }
        }

        for (const [id, common] of Object.entries(states)) {
            await this.extendObjectAsync(`${rt.id}.${id}`, {
                type: 'state',
                common: { read: true, write: false, ...common },
                native: {},
            });
        }
    }

    // ------------------------------------------------------------------ states

    private async setValues(rt: ObjectRuntime, values: Record<string, ioBroker.StateValue>): Promise<void> {
        for (const [id, val] of Object.entries(values)) {
            await this.setStateChangedAsync(`${rt.id}.${id}`, val, true);
        }
    }

    private async writeLive(rt: ObjectRuntime): Promise<void> {
        const now = Date.now();
        const live = rt.detector.live(now);
        const meters = METERS_PER_UNIT[rt.settings.unit];
        const speedUnit = rt.settings.speedUnit;
        const values: Record<string, ioBroker.StateValue> = {
            'live.active': live.active,
            'live.start': live.start,
            'live.distance': round(live.distance / meters, 2),
            'live.duration': Math.round(live.duration / 1000),
            'live.speed': round(fromMs(live.speed, speedUnit), 1),
            'live.maxSpeed': round(fromMs(live.maxSpeed, speedUnit), 1),
            'live.avgSpeed': round(fromMs(live.avgSpeed, speedUnit), 1),
            'live.source': rt.fusion?.activeSource?.source.label ?? '',
            'live.ignition': rt.detector.ignition,
            'live.lastPosition': rt.detector.lastFix?.ts ?? null,
        };
        if (live.lat !== null && live.lon !== null) {
            values['live.latitude'] = round(live.lat, 7);
            values['live.longitude'] = round(live.lon, 7);
            values['live.position'] = `${round(live.lat, 7)};${round(live.lon, 7)}`;
            values['live.place'] = findPlace(this.places, live.lat, live.lon)?.name ?? '';
            if (this.home) {
                values['live.distanceHome'] = round(
                    distance(this.home.lat, this.home.lon, live.lat, live.lon) / meters,
                    2,
                );
            }
        }
        if (rt.config.consumptionMode === 'distance' || rt.config.consumptionMode === 'hours') {
            const trip = rt.detector.trip;
            values['live.consumption'] = trip
                ? round(this.consumptionOf(rt, trip.distance, trip.engineTime || live.duration, live.duration) ?? 0, 2)
                : 0;
        }
        await this.setValues(rt, values);
    }

    private async writeLastTrip(rt: ObjectRuntime, summary: TripSummary): Promise<void> {
        const meters = METERS_PER_UNIT[rt.settings.unit];
        const speedUnit = rt.settings.speedUnit;
        const values: Record<string, ioBroker.StateValue> = {
            'lastTrip.id': summary.id,
            'lastTrip.start': summary.start,
            'lastTrip.end': summary.end,
            'lastTrip.from': summary.from ?? '',
            'lastTrip.to': summary.to ?? '',
            'lastTrip.distance': round(summary.distance / meters, 2),
            'lastTrip.duration': Math.round(summary.duration),
            'lastTrip.movingTime': Math.round(summary.movingTime),
            'lastTrip.avgSpeed': round(fromMs(summary.avgSpeed, speedUnit), 1),
            'lastTrip.maxSpeed': round(fromMs(summary.maxSpeed, speedUnit), 1),
            'lastTrip.stops': summary.stops.length,
            'lastTrip.elevationGain': summary.elevationGain ?? null,
            'lastTrip.summary': this.summaryText(rt, summary),
            'lastTrip.json': JSON.stringify(summary),
            'lastTrip.gpx': summary.track ? `/${this.namespace}/${TripStore.trackPath(rt.id, summary, 'gpx')}` : '',
        };
        if (rt.config.consumptionMode === 'distance' || rt.config.consumptionMode === 'hours') {
            values['lastTrip.consumption'] = summary.consumption ?? null;
            values['lastTrip.cost'] = summary.cost ?? null;
            values['lastTrip.co2'] = summary.co2 ?? null;
        }
        await this.setValues(rt, values);
    }

    private async writeStats(rt: ObjectRuntime): Promise<void> {
        const now = new Date();
        const meters = METERS_PER_UNIT[rt.settings.unit];
        const speedUnit = rt.settings.speedUnit;
        const withConsumption = rt.config.consumptionMode === 'distance' || rt.config.consumptionMode === 'hours';
        for (const period of PERIODS) {
            const stats = aggregate(rt.trips, periodStart(period, now));
            const prefix = `stats.${period}`;
            const values: Record<string, ioBroker.StateValue> = {
                [`${prefix}.distance`]: round(stats.distance / meters, 2),
                [`${prefix}.trips`]: stats.trips,
                [`${prefix}.duration`]: round(stats.duration / 3600, 2),
                [`${prefix}.movingTime`]: round(stats.movingTime / 3600, 2),
                [`${prefix}.engineTime`]: round(stats.engineTime / 3600, 2),
                [`${prefix}.longestTrip`]: round(stats.longestTrip / meters, 2),
                [`${prefix}.maxSpeed`]: round(fromMs(stats.maxSpeed, speedUnit), 1),
            };
            if (withConsumption) {
                values[`${prefix}.consumption`] = round(stats.consumption, 2);
                values[`${prefix}.cost`] = round(stats.cost, 2);
                values[`${prefix}.co2`] = round(stats.co2, 1);
            }
            await this.setValues(rt, values);
        }
    }

    // ------------------------------------------------------------------ trips

    /**
     * Consumption of a trip
     *
     * @param rt the object
     * @param meters distance
     * @param engineMs time with the engine on
     * @param movingMs fallback if the engine time is unknown
     */
    private consumptionOf(rt: ObjectRuntime, meters: number, engineMs: number, movingMs: number): number | null {
        const value = configNumber(rt.config.consumption, 0);
        if (value <= 0) {
            return null;
        }
        if (rt.config.consumptionMode === 'distance') {
            return (meters / METERS_PER_UNIT[rt.settings.unit] / 100) * value;
        }
        if (rt.config.consumptionMode === 'hours') {
            return ((engineMs > 0 ? engineMs : movingMs) / 3600000) * value;
        }
        return null;
    }

    private async placeName(lat: number, lon: number): Promise<string | undefined> {
        const place = findPlace(this.places, lat, lon);
        if (place) {
            return place.name;
        }
        // positions in privacy zones are never sent to the geocoder
        if (this.geocoder && !isPrivate(this.places, lat, lon)) {
            return (await this.geocoder.reverse(lat, lon)) ?? undefined;
        }
        return undefined;
    }

    private async buildSummary(rt: ObjectRuntime, trip: FinishedTrip): Promise<TripSummary> {
        const first = trip.points[0];
        const last = trip.points[trip.points.length - 1];
        const duration = Math.max(0, (trip.end - trip.start) / 1000);
        const movingTime = trip.movingTime / 1000;
        const coordinate = (point: TrackPoint | undefined, key: 'lat' | 'lon'): number | null =>
            point && !isPrivate(this.places, point.lat, point.lon) ? round(point[key], 6) : null;

        const stops: SummaryStop[] = [];
        for (const stop of trip.stops) {
            const privateStop = !!isPrivate(this.places, stop.lat, stop.lon);
            const item: SummaryStop = {
                start: stop.start,
                end: stop.end,
                lat: privateStop ? null : round(stop.lat, 6),
                lon: privateStop ? null : round(stop.lon, 6),
            };
            const place = findPlace(this.places, stop.lat, stop.lon);
            if (place) {
                item.place = place.name;
            }
            stops.push(item);
        }

        const summary: TripSummary = {
            id: tripId(trip.start),
            object: rt.config.name,
            start: trip.start,
            end: trip.end,
            duration: Math.round(duration),
            movingTime: Math.round(movingTime),
            distance: Math.round(trip.distance),
            avgSpeed: movingTime > 0 ? round(trip.distance / movingTime, 2) : 0,
            maxSpeed: round(trip.maxSpeed, 2),
            startLat: coordinate(first, 'lat'),
            startLon: coordinate(first, 'lon'),
            endLat: coordinate(last, 'lat'),
            endLon: coordinate(last, 'lon'),
            stops,
            gaps: trip.gaps,
            points: trip.points.length,
            reason: trip.reason,
            track: false,
        };
        if (trip.elevationGain > 0) {
            summary.elevationGain = Math.round(trip.elevationGain);
        }
        if (trip.engineTime > 0) {
            summary.engineTime = Math.round(trip.engineTime / 1000);
        }
        if (first) {
            summary.from = await this.placeName(first.lat, first.lon);
        }
        if (last) {
            summary.to = await this.placeName(last.lat, last.lon);
        }

        const consumption = this.consumptionOf(rt, trip.distance, trip.engineTime, trip.movingTime);
        if (consumption !== null) {
            const unit = rt.config.consumptionUnit || 'l';
            summary.consumption = round(consumption, 2);
            summary.consumptionUnit = unit;
            let price = configNumber(rt.config.price, 0);
            if (rt.config.priceStateId) {
                const state = await this.getForeignStateAsync(rt.config.priceStateId);
                const statePrice = configNumber(state?.val, NaN);
                if (Number.isFinite(statePrice) && statePrice > 0) {
                    price = statePrice;
                } else {
                    this.log.debug(`${rt.config.name}: no valid price in ${rt.config.priceStateId}`);
                }
            }
            if (price > 0) {
                summary.cost = round(consumption * price, 2);
                summary.currency = this.config.currency || '€';
            }
            const co2Factor = configNumber(rt.config.co2PerUnit, CO2_DEFAULTS[unit] ?? 0);
            if (co2Factor > 0) {
                summary.co2 = round(consumption * co2Factor, 2);
            }
        }
        return summary;
    }

    /** The points that may be stored: without the privacy zones, simplified */
    private storablePoints(points: TrackPoint[]): TrackPoint[] {
        const result: (TrackPoint & { keep?: boolean })[] = [];
        let removed = false;
        for (const point of points) {
            if (isPrivate(this.places, point.lat, point.lon)) {
                removed = true;
                continue;
            }
            const gap = point.gap || (removed && result.length > 0);
            result.push(gap ? { ...point, gap: true, keep: true } : point);
            removed = false;
        }
        return simplify(result, TRACK_TOLERANCE).map(({ keep: _keep, ...point }) => point);
    }

    private async finishTrip(rt: ObjectRuntime, trip: FinishedTrip): Promise<void> {
        if (trip.distance < MIN_TRIP_DISTANCE && trip.reason !== 'manual') {
            this.log.debug(`${rt.config.name}: trip of ${Math.round(trip.distance)} m discarded`);
            await this.store.delete(`${rt.id}/current.json`);
            await this.writeLive(rt);
            return;
        }
        const summary = await this.buildSummary(rt, trip);
        let id = summary.id;
        for (let i = 2; rt.trips.some(t => t.id === id); i++) {
            id = `${summary.id}-${i}`;
        }
        summary.id = id;

        const points = this.storablePoints(trip.points);
        if (points.length >= 2) {
            const title = `${rt.config.name} ${new Date(summary.start).toLocaleString()}`;
            await this.store.writeText(TripStore.trackPath(rt.id, summary, 'geojson'), toGeoJson(summary, points));
            await this.store.writeText(TripStore.trackPath(rt.id, summary, 'gpx'), toGpx(summary, points, title));
            summary.track = true;
        }

        rt.trips.push(summary);
        rt.trips.sort((a, b) => a.start - b.start);
        await this.store.saveYear(rt.id, new Date(summary.start).getFullYear(), rt.trips);
        await this.store.delete(`${rt.id}/current.json`);
        rt.lastCheckpoint = Date.now();

        const text = this.summaryText(rt, summary);
        this.log.info(`Trip finished - ${text}`);
        await this.writeLastTrip(rt, summary);
        await this.writeStats(rt);
        await this.writeLive(rt);
        await this.setStateChangedAsync(`${rt.id}.control.manualTrip`, rt.detector.manual, true);
        this.notify(rt, summary, text);
        await this.saveGeocache();
    }

    private async saveCheckpoint(rt: ObjectRuntime): Promise<void> {
        rt.lastCheckpoint = Date.now();
        if (rt.detector.trip) {
            await this.store.writeJson(`${rt.id}/current.json`, rt.detector.state);
        }
    }

    private async saveGeocache(): Promise<void> {
        const cache = this.geocoder?.takeChanges();
        if (cache) {
            await this.store.writeJson('geocache.json', cache);
        }
    }

    // ------------------------------------------------------------------ texts and notifications

    private formatNumber(value: number, digits: number): string {
        const locale = this.systemLanguage === 'zh-cn' ? 'zh-CN' : this.systemLanguage;
        try {
            return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
        } catch {
            return value.toFixed(digits);
        }
    }

    /** "Car: Home → Office, 42.1 km, 0:51 h, 3.1 l, 5.80 €" */
    private summaryText(rt: ObjectRuntime, summary: TripSummary): string {
        const parts: string[] = [];
        if (summary.from || summary.to) {
            parts.push(`${summary.from || '…'} → ${summary.to || '…'}`);
        }
        const distanceValue = summary.distance / METERS_PER_UNIT[rt.settings.unit];
        parts.push(`${this.formatNumber(distanceValue, distanceValue < 10 ? 2 : 1)} ${rt.settings.unit}`);
        parts.push(`${formatDuration(summary.duration)} h`);
        if (summary.consumption !== undefined) {
            parts.push(`${this.formatNumber(summary.consumption, 1)} ${summary.consumptionUnit}`);
        }
        if (summary.cost !== undefined) {
            parts.push(`${this.formatNumber(summary.cost, 2)} ${summary.currency}`);
        }
        return `${rt.config.name}: ${parts.join(', ')}`;
    }

    private notify(rt: ObjectRuntime, summary: TripSummary, text: string): void {
        const instance = (this.config.notificationInstance || '').trim();
        if (!instance || !rt.config.notify) {
            return;
        }
        const minDistance = configNumber(this.config.notificationMinDistance, 0);
        if (summary.distance / METERS_PER_UNIT[rt.settings.unit] < minDistance) {
            return;
        }
        const user = (this.config.notificationUser || '').trim();
        const adapterName = instance.replace(/^system\.adapter\./, '').split('.')[0];
        let message: Record<string, unknown>;
        switch (adapterName) {
            case 'telegram':
                message = user ? { text, user } : { text };
                break;
            case 'pushover':
                message = user ? { message: text, device: user } : { message: text };
                break;
            case 'email':
                message = user
                    ? { text, subject: `${rt.config.name}: trip`, to: user }
                    : { text, subject: `${rt.config.name}: trip` };
                break;
            case 'whatsapp-cmb':
            case 'signal-cmb':
                message = user ? { text, phone: user } : { text };
                break;
            default:
                message = user ? { text, message: text, user } : { text, message: text };
        }
        // without a callback: not every messenger answers, and a missing answer is no error
        this.sendTo(instance, 'send', message);
    }

    // ------------------------------------------------------------------ timers

    private scheduleMidnight(): void {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
        this.midnightTimer = this.setTimeout(() => {
            this.midnightTimer = undefined;
            for (const rt of Object.values(this.runtimes)) {
                this.enqueue(rt, () => this.writeStats(rt));
            }
            this.scheduleMidnight();
        }, next.getTime() - now.getTime());
    }

    /** Deletes tracks and coordinates older than the retention time; the distances etc. stay */
    private runRetention(): void {
        const days = configNumber(this.config.retentionDays, 0);
        if (days <= 0) {
            return;
        }
        const limit = Date.now() - days * 24 * 3600000;
        for (const rt of Object.values(this.runtimes)) {
            this.enqueue(rt, async () => {
                const years = new Set<number>();
                for (const trip of rt.trips) {
                    if (trip.end >= limit) {
                        continue;
                    }
                    const year = new Date(trip.start).getFullYear();
                    if (trip.track) {
                        await this.store.delete(TripStore.trackPath(rt.id, trip, 'geojson'));
                        await this.store.delete(TripStore.trackPath(rt.id, trip, 'gpx'));
                        trip.track = false;
                        years.add(year);
                    }
                    if (trip.startLat !== null || trip.endLat !== null || trip.stops.some(stop => stop.lat !== null)) {
                        trip.startLat = trip.startLon = trip.endLat = trip.endLon = null;
                        trip.stops = trip.stops.map(stop => ({ ...stop, lat: null, lon: null }));
                        years.add(year);
                    }
                }
                for (const year of years) {
                    await this.store.saveYear(rt.id, year, rt.trips);
                }
                if (years.size) {
                    this.log.info(`${rt.config.name}: tracks older than ${days} days deleted`);
                }
            });
        }
    }

    // ------------------------------------------------------------------ messages

    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (!obj?.command) {
            return;
        }
        const msg: Record<string, any> = obj.message && typeof obj.message === 'object' ? obj.message : {};
        let result: unknown;
        try {
            result = await this.handleMessage(obj.command, msg);
        } catch (e) {
            result = { error: e.message };
        }
        if (obj.callback) {
            this.sendTo(obj.from, obj.command, result as ioBroker.MessagePayload, obj.callback);
        }
    }

    private async handleMessage(command: string, msg: Record<string, any>): Promise<unknown> {
        switch (command) {
            case 'getObjectNames':
                return (this.config.objects || []).filter(o => o?.name).map(o => ({ label: o.name, value: o.name }));

            case 'getPlaceNames':
                return [
                    { label: '---', value: '' },
                    ...this.places.map(place => ({ label: place.name, value: place.name })),
                ];

            case 'getTrips': {
                const rt = this.findRuntime(msg.object);
                if (!rt) {
                    return { error: `Unknown object "${msg.object}"` };
                }
                const from = configNumber(msg.from, 0);
                const to = configNumber(msg.to, Infinity);
                let list = rt.trips.filter(t => t.start >= from && t.start < to).reverse();
                const limit = configNumber(msg.limit, 0);
                if (limit > 0) {
                    list = list.slice(0, limit);
                }
                return list;
            }

            case 'getTrack': {
                const rt = this.findRuntime(msg.object);
                const trip = rt?.trips.find(t => t.id === msg.id);
                if (!rt || !trip) {
                    return { error: 'Unknown trip' };
                }
                if (!trip.track) {
                    return { error: 'The track was not stored or was deleted' };
                }
                const format = msg.format === 'gpx' ? 'gpx' : 'geojson';
                const text = await this.store.readText(TripStore.trackPath(rt.id, trip, format));
                return text ? { result: text } : { error: 'Track file not found' };
            }

            case 'endTrip': {
                const rt = this.findRuntime(msg.object);
                if (!rt) {
                    return { error: `Unknown object "${msg.object}"` };
                }
                rt.detector.finish(Date.now());
                return { result: 'ok' };
            }

            default:
                return { error: `Unknown command "${command}"` };
        }
    }

    private async onUnload(callback: () => void): Promise<void> {
        this.unloading = true;
        try {
            if (this.tickTimer) {
                this.clearInterval(this.tickTimer);
            }
            if (this.retentionTimer) {
                this.clearInterval(this.retentionTimer);
            }
            if (this.midnightTimer) {
                this.clearTimeout(this.midnightTimer);
            }
            const runtimes = Object.values(this.runtimes);
            for (const rt of runtimes) {
                rt.sources.forEach(source => source.destroy());
            }
            // keep the running trips, but do not block the shutdown for long
            await Promise.race([
                Promise.all(runtimes.map(rt => rt.queue.then(() => this.saveCheckpoint(rt)))),
                new Promise(resolve => setTimeout(resolve, 3000)),
            ]);
            await this.saveGeocache();
        } catch {
            // ignore
        } finally {
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new TripsAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new TripsAdapter())();
}
