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
import {
    TripDetector,
    type ActiveTrip,
    type DetectorState,
    type FinishedTrip,
    type Fix,
    type TrackPoint,
} from './lib/tripDetector';
import { toGeoJson, toGpx } from './lib/export';
import { ConsumptionMeter, type MeterMode, type MeterState } from './lib/meter';
import { PositionWatch, type WatchEvent, type WatchState } from './lib/watch';
import {
    applyChanges,
    changesCsv,
    LOGBOOK_FIELDS,
    logbookCsv,
    normalizeCategory,
    type LogbookField,
    type TripChange,
} from './lib/logbook';
import { text } from './lib/texts';
import type {
    Diagnostics,
    DiagnosticsCounts,
    DiagnosticsObject,
    DiagnosticsPosition,
    DiagnosticsSource,
    DiagnosticsSourceState,
    SourceStateRole,
} from './lib/diagnostics';

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

/** current.json: the running trip, so that it survives a restart */
interface Checkpoint {
    detector: DetectorState;
    meter?: MeterState;
    odometerStart?: number | null;
}

const MEASURED_MODES: MeterMode[] = ['counter', 'level', 'rate'];

interface ObjectRuntime {
    /** ID of the device object below the instance */
    id: string;
    config: TrackedObjectConfig;
    settings: ObjectSettings;
    detector: TripDetector;
    sources: SourceAssembler[];
    fusion: Fusion;
    /** Anchor watch (boats), theft watch (cars) */
    watch: PositionWatch;
    /** Measured consumption from a state of the vehicle */
    meter: ConsumptionMeter | null;
    /** Odometer at the start of the running trip */
    odometerStart: number | null;
    /** All summaries, sorted by start */
    trips: TripSummary[];
    lastLive: number;
    lastCheckpoint: number;
    /** Serializes the asynchronous work of this object (files, states) */
    queue: Promise<void>;
}

/** A position for the diagnostics */
function diagnosticsPosition(fix: Fix | null | undefined): DiagnosticsPosition | null {
    if (!fix) {
        return null;
    }
    return {
        ts: fix.ts,
        lat: fix.lat,
        lon: fix.lon,
        speed: fix.speed ?? null,
        accuracy: fix.accuracy ?? null,
        alt: fix.alt ?? null,
    };
}

type StateDefinition = Partial<ioBroker.StateCommon> & { name: string; type: ioBroker.CommonType; role: string };

export class TripsAdapter extends Adapter {
    declare config: TripsAdapterConfig;

    private runtimes: Record<string, ObjectRuntime> = {};
    private sourcesByState: Record<string, SourceAssembler[]> = {};
    private metersByState: Record<string, ObjectRuntime[]> = {};
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
        await this.subscribeStatesAsync('*.watch.*');
        for (const field of LOGBOOK_FIELDS) {
            await this.subscribeStatesAsync(`*.lastTrip.${field}`);
        }
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
        const saved = await this.store.readJson<Checkpoint>(`${id}/current.json`);
        const mode = config.consumptionMode as MeterMode;
        const meterStateId = MEASURED_MODES.includes(mode) ? (config.consumptionStateId || '').trim() : '';
        if (MEASURED_MODES.includes(mode) && !meterStateId) {
            this.log.warn(`${config.name}: the measured consumption needs a state`);
        }
        const rt: ObjectRuntime = {
            id,
            config,
            settings,
            detector: null as unknown as TripDetector,
            sources: [],
            fusion: null as unknown as Fusion,
            watch: null as unknown as PositionWatch,
            meter: meterStateId
                ? new ConsumptionMeter(
                      mode,
                      { percent: !!config.levelPercent, capacity: configNumber(config.capacity, 0) },
                      saved?.meter,
                  )
                : null,
            odometerStart: saved?.odometerStart ?? null,
            trips: [],
            lastLive: 0,
            lastCheckpoint: Date.now(),
            queue: Promise.resolve(),
        };
        if (rt.meter) {
            (this.metersByState[meterStateId] ||= []).push(rt);
        }
        rt.detector = new TripDetector(
            settings.detector,
            {
                onStart: trip => {
                    this.log.info(
                        `${config.name}: trip started (${trip.reason}) at ${new Date(trip.start).toLocaleString()}`,
                    );
                    rt.lastLive = Date.now();
                    rt.meter?.start(trip.start);
                    this.enqueue(rt, async () => {
                        rt.odometerStart = await this.readOdometer(rt);
                        await this.writeLive(rt);
                        await this.saveCheckpoint(rt);
                    });
                },
                onEnd: trip => {
                    // synchronously, before a next trip can start the meter again
                    const measured = rt.meter?.running ? rt.meter.stop(trip.end) : null;
                    const odometerStart = rt.odometerStart;
                    rt.odometerStart = null;
                    this.enqueue(rt, () => this.finishTrip(rt, trip, measured, odometerStart));
                },
            },
            saved?.detector,
        );
        if (saved?.detector?.trip) {
            this.log.info(
                `${config.name}: continuing the trip started at ${new Date(saved.detector.trip.start).toLocaleString()}`,
            );
        }
        rt.trips = await this.store.loadSummaries(id);
        this.runtimes[id] = rt;

        await this.createObjectStates(rt);
        rt.watch = new PositionWatch(settings.watch, settings.watch.radius, await this.readWatch(rt));
        await this.writeWatch(rt);
        const last = rt.trips[rt.trips.length - 1];
        if (last) {
            await this.writeLastTrip(rt, last);
        }
        await this.writeStats(rt);
        await this.setStateAsync(`${id}.control.manualTrip`, rt.detector.manual, true);
        if (config.logbook) {
            const category = await this.getStateAsync(`${id}.control.category`);
            if (!normalizeCategory(category?.val)) {
                await this.setStateAsync(`${id}.control.category`, config.defaultCategory || '', true);
            }
        }
    }

    /** Odometer at the start or the end of a trip, in the distance unit of the object */
    private async readOdometer(rt: ObjectRuntime): Promise<number | null> {
        const stateId = (rt.config.odometerId || '').trim();
        if (!stateId) {
            return null;
        }
        try {
            const state = await this.getForeignStateAsync(stateId);
            const value = configNumber(state?.val, NaN);
            return Number.isFinite(value) ? value : null;
        } catch (e) {
            this.log.debug(`${rt.config.name}: cannot read the odometer ${stateId}: ${e.message}`);
            return null;
        }
    }

    /** The watch as it was before the restart */
    private async readWatch(rt: ObjectRuntime): Promise<Partial<WatchState>> {
        const value = async (id: string): Promise<ioBroker.StateValue | undefined> =>
            (await this.getStateAsync(`${rt.id}.watch.${id}`))?.val;
        const number = (v: ioBroker.StateValue | undefined): number | null => {
            const n = configNumber(v, NaN);
            return Number.isFinite(n) ? n : null;
        };
        const radius = number(await value('radius'));
        return {
            active: (await value('active')) === true,
            lat: number(await value('latitude')),
            lon: number(await value('longitude')),
            radius: radius && radius > 0 ? radius : rt.settings.watch.radius,
            since: number(await value('since')),
            maxDistance: number(await value('maxDistance')) ?? 0,
            alarm: (await value('alarm')) === true,
            lastFix: Date.now(),
        };
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

        // states of the measured consumption
        const meterIds = Object.keys(this.metersByState);
        for (const id of meterIds) {
            this.onMeterState(id, await this.getForeignStateAsync(id));
        }
        if (meterIds.length) {
            await this.subscribeForeignStatesAsync(meterIds);
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
        if (this.unloading) {
            return;
        }
        if (!rt.fusion.accept(source)) {
            // a source with a better priority delivers fresh positions
            source.count('unused');
            return;
        }
        const now = Date.now();
        // a source with a wrong clock must not create trips in the future
        if (fix.ts > now + 60000) {
            fix.ts = now;
        }
        const result = rt.detector.processFix(fix, now);
        source.count(result);
        if (result !== 'accepted') {
            this.log.debug(`${rt.config.name}: position of ${fix.source} ignored (${result})`);
        } else if (rt.watch.state.active) {
            const event = rt.watch.onFix(fix, now);
            if (event) {
                this.onWatchEvent(rt, event);
            }
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
        if (on && rt.settings.type === 'car' && rt.watch.state.active) {
            // the owner drives away; a car moved without the ignition still gives the alarm
            this.log.info(`${rt.config.name}: watch ended by the ignition`);
            rt.watch.deactivate();
        }
        this.enqueue(rt, () => this.writeLive(rt));
    }

    private onMeterState(id: string, state: ioBroker.State | null | undefined): void {
        if (!state) {
            return;
        }
        const value = configNumber(state.val, NaN);
        if (!Number.isFinite(value)) {
            return;
        }
        for (const rt of this.metersByState[id] || []) {
            rt.meter?.update(value, state.ts || Date.now());
        }
    }

    private onWatchEvent(rt: ObjectRuntime, event: WatchEvent): void {
        const watch = rt.watch.state;
        const lang = this.systemLanguage;
        let message: string;
        if (event === 'alarm') {
            const title = text(lang, rt.settings.type === 'boat' ? 'anchorAlarm' : 'positionAlarm');
            message = `${rt.config.name}: ${title}! ${text(lang, 'alarmText', { distance: watch.distance ?? 0, radius: watch.radius })}`;
            this.log.warn(message);
        } else if (event === 'signalLost') {
            message = `${rt.config.name}: ${text(lang, 'signalLost', { minutes: Math.round(rt.settings.watch.signalLostSeconds / 60) })}`;
            this.log.warn(message);
        } else {
            message = `${rt.config.name}: ${text(lang, 'signalBack')}`;
            this.log.info(message);
        }
        if (rt.config.watchNotify !== false) {
            this.sendNotification(message, rt.config.name);
        }
        this.enqueue(rt, () => this.writeWatch(rt));
    }

    private onTick(): void {
        const now = Date.now();
        for (const rt of Object.values(this.runtimes)) {
            rt.detector.tick(now);
            const watchEvent = rt.watch.tick(now);
            if (watchEvent) {
                this.onWatchEvent(rt, watchEvent);
            }
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
        if (this.metersByState[id]) {
            this.onMeterState(id, state);
        }
    }

    private async onControl(id: string, state: ioBroker.State): Promise<void> {
        const match = id.match(/^(.+)\.(control|lastTrip|watch)\.([a-zA-Z]+)$/);
        const rt = match ? this.runtimes[match[1]] : null;
        if (!match || !rt) {
            return;
        }
        const [, , channel, name] = match;
        const now = Date.now();
        const isOn = state.val === true || state.val === 'true' || state.val === 1 || state.val === 'on';

        if (channel === 'watch') {
            this.onWatchControl(rt, name, state, isOn);
            return;
        }
        if (channel === 'lastTrip') {
            if ((LOGBOOK_FIELDS as readonly string[]).includes(name)) {
                const last = rt.trips[rt.trips.length - 1];
                if (last) {
                    this.enqueue(rt, async () => {
                        try {
                            await this.updateTrip(rt, last.id, { [name]: state.val }, 'state');
                        } catch (e) {
                            this.log.warn(`${rt.config.name}: ${e.message}`);
                            await this.writeLastTrip(rt, last);
                        }
                    });
                }
            }
            return;
        }
        switch (name) {
            case 'manualTrip':
                rt.detector.setManual(isOn, now);
                await this.setStateAsync(id, rt.detector.manual, true);
                break;
            case 'endTrip':
                rt.detector.finish(now);
                await this.setStateAsync(id, false, true);
                await this.setStateAsync(`${rt.id}.control.manualTrip`, false, true);
                break;
            case 'category': {
                // for the running trip, or the next one
                const category = normalizeCategory(state.val);
                if (!category && state.val !== '' && state.val !== null) {
                    this.log.warn(`${rt.config.name}: invalid category "${String(state.val)}"`);
                }
                await this.setStateAsync(id, category ?? '', true);
                return;
            }
            case 'purpose':
            case 'partner':
            case 'driver':
                await this.setStateAsync(id, typeof state.val === 'string' ? state.val.trim() : '', true);
                return;
            default:
                return;
        }
        rt.lastLive = now;
        this.enqueue(rt, () => this.writeLive(rt));
    }

    private onWatchControl(rt: ObjectRuntime, name: string, state: ioBroker.State, isOn: boolean): void {
        const watch = rt.watch;
        const number = configNumber(state.val, NaN);
        switch (name) {
            case 'active':
                if (isOn) {
                    // the last position, else the one set before by hand
                    const fix = rt.detector.lastFix;
                    const lat = fix?.lat ?? watch.state.lat;
                    const lon = fix?.lon ?? watch.state.lon;
                    if (lat === null || lon === null) {
                        this.log.warn(`${rt.config.name}: no position yet, the watch cannot start`);
                        break;
                    }
                    watch.activate(lat, lon, Date.now());
                    this.log.info(`${rt.config.name}: watch started, radius ${watch.state.radius} m`);
                } else if (watch.state.active) {
                    watch.deactivate();
                    this.log.info(`${rt.config.name}: watch ended`);
                }
                break;
            case 'latitude':
            case 'longitude':
                if (Number.isFinite(number)) {
                    const lat = name === 'latitude' ? number : watch.state.lat;
                    const lon = name === 'longitude' ? number : watch.state.lon;
                    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                        watch.setCenter(lat, lon);
                    } else if (lat !== null && lon === null) {
                        watch.state.lat = lat;
                    } else if (lon !== null && lat === null) {
                        watch.state.lon = lon;
                    }
                }
                break;
            case 'radius':
                if (number > 0) {
                    watch.setRadius(number);
                }
                break;
            case 'alarm':
                if (!isOn) {
                    watch.acknowledge();
                }
                break;
            default:
                return;
        }
        this.enqueue(rt, () => this.writeWatch(rt, true));
    }

    // ------------------------------------------------------------------ objects

    private async createObjectStates(rt: ObjectRuntime): Promise<void> {
        const unit = rt.settings.unit;
        const speedUnit = rt.settings.speedUnit;
        const consumptionUnit = rt.config.consumptionUnit || 'l';
        const currency = this.config.currency || '€';
        const withConsumption = this.withConsumption(rt);
        const measured = !!rt.meter;
        const boat = rt.settings.type === 'boat';

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
            watch: boat ? 'Anchor watch' : 'Position watch',
        };
        if (rt.config.logbook) {
            channels.logbook = 'Logbook';
        }
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
            'watch.active': { name: 'Watch is active', type: 'boolean', role: 'switch', write: true, def: false },
            'watch.latitude': {
                name: 'Latitude of the watched position',
                type: 'number',
                role: 'value.gps.latitude',
                unit: '°',
                write: true,
            },
            'watch.longitude': {
                name: 'Longitude of the watched position',
                type: 'number',
                role: 'value.gps.longitude',
                unit: '°',
                write: true,
            },
            'watch.radius': { name: 'Alarm radius', type: 'number', role: 'level', unit: 'm', write: true, min: 5 },
            'watch.distance': {
                name: 'Distance from the watched position',
                type: 'number',
                role: 'value.distance',
                unit: 'm',
            },
            'watch.maxDistance': {
                name: boat ? 'Swing circle (farthest position)' : 'Farthest position',
                type: 'number',
                role: 'value.distance',
                unit: 'm',
            },
            'watch.alarm': {
                name: 'Alarm (write false to acknowledge)',
                type: 'boolean',
                role: 'indicator.alarm',
                write: true,
                def: false,
            },
            'watch.signalLost': { name: 'No positions any more', type: 'boolean', role: 'indicator.alarm', def: false },
            'watch.since': { name: 'Watching since', type: 'number', role: 'date' },
        };
        if (boat) {
            states['lastTrip.sailDistance'] = {
                name: 'Distance under sail',
                type: 'number',
                role: 'value.distance',
                unit,
            };
            states['lastTrip.sailShare'] = { name: 'Share under sail', type: 'number', role: 'value', unit: '%' };
        }
        if (rt.config.logbook) {
            const categoryStates = { '': '---', private: 'private', business: 'business', commute: 'commute' };
            const text = (name: string, write = true): StateDefinition => ({
                name,
                type: 'string',
                role: 'text',
                write,
            });
            states['control.category'] = {
                ...text('Category of the running or next trip'),
                states: categoryStates,
            };
            states['control.purpose'] = text('Purpose of the running or next trip');
            states['control.partner'] = text('Business partner of the running or next trip');
            states['control.driver'] = text('Driver');
            states['lastTrip.category'] = { ...text('Category'), states: categoryStates };
            states['lastTrip.purpose'] = text('Purpose');
            states['lastTrip.partner'] = text('Business partner');
            states['lastTrip.driver'] = text('Driver');
            states['lastTrip.odometerEnd'] = { name: 'Odometer at the end', type: 'number', role: 'value', unit };
            states['logbook.csv'] = { name: 'Logbook of this year (CSV)', type: 'string', role: 'url' };
            states['logbook.changes'] = { name: 'Changes of this year (CSV)', type: 'string', role: 'url' };
        }
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
                name: measured ? 'Consumption (measured)' : 'Consumption (estimated)',
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
            if (boat) {
                states[`${prefix}.sailDistance`] = {
                    name: 'Distance under sail',
                    type: 'number',
                    role: 'value.distance',
                    unit,
                };
                states[`${prefix}.sailShare`] = { name: 'Share under sail', type: 'number', role: 'value', unit: '%' };
            }
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
        if (this.withConsumption(rt)) {
            const trip = rt.detector.trip;
            let consumption = 0;
            if (trip && rt.meter) {
                consumption = rt.meter.current(now);
            } else if (trip) {
                consumption =
                    this.consumptionOf(rt, trip.distance, trip.engineTime || live.duration, live.duration) ?? 0;
            }
            values['live.consumption'] = round(consumption, 2);
        }
        await this.setValues(rt, values);
        await this.writeWatch(rt);
    }

    /** The watch states; `force` writes also the unchanged ones */
    private async writeWatch(rt: ObjectRuntime, force = false): Promise<void> {
        const watch = rt.watch?.state;
        if (!watch) {
            return;
        }
        const values: Record<string, ioBroker.StateValue> = {
            'watch.active': watch.active,
            'watch.latitude': watch.lat === null ? null : round(watch.lat, 7),
            'watch.longitude': watch.lon === null ? null : round(watch.lon, 7),
            'watch.radius': watch.radius,
            'watch.distance': watch.active ? watch.distance : null,
            'watch.maxDistance': watch.maxDistance,
            'watch.alarm': watch.alarm,
            'watch.signalLost': watch.signalLost,
            'watch.since': watch.since,
        };
        for (const [id, val] of Object.entries(values)) {
            if (force) {
                await this.setStateAsync(`${rt.id}.${id}`, val, true);
            } else {
                await this.setStateChangedAsync(`${rt.id}.${id}`, val, true);
            }
        }
    }

    private withConsumption(rt: ObjectRuntime): boolean {
        const mode = rt.config.consumptionMode;
        return mode === 'distance' || mode === 'hours' || !!rt.meter;
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
        if (this.withConsumption(rt)) {
            values['lastTrip.consumption'] = summary.consumption ?? null;
            values['lastTrip.cost'] = summary.cost ?? null;
            values['lastTrip.co2'] = summary.co2 ?? null;
        }
        if (rt.settings.type === 'boat') {
            values['lastTrip.sailDistance'] =
                summary.sailDistance === undefined ? null : round(summary.sailDistance / meters, 2);
            values['lastTrip.sailShare'] =
                summary.sailDistance === undefined || !summary.distance
                    ? null
                    : Math.round((summary.sailDistance / summary.distance) * 100);
        }
        if (rt.config.logbook) {
            values['lastTrip.category'] = summary.category ?? '';
            values['lastTrip.purpose'] = summary.purpose ?? '';
            values['lastTrip.partner'] = summary.partner ?? '';
            values['lastTrip.driver'] = summary.driver ?? '';
            values['lastTrip.odometerEnd'] = summary.odometerEnd ?? null;
        }
        await this.setValues(rt, values);
    }

    private async writeStats(rt: ObjectRuntime): Promise<void> {
        const now = new Date();
        const meters = METERS_PER_UNIT[rt.settings.unit];
        const speedUnit = rt.settings.speedUnit;
        const withConsumption = this.withConsumption(rt);
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
            if (rt.settings.type === 'boat') {
                values[`${prefix}.sailDistance`] = round(stats.sailDistance / meters, 2);
                values[`${prefix}.sailShare`] = stats.sailBase
                    ? Math.round((stats.sailDistance / stats.sailBase) * 100)
                    : null;
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

    private async buildSummary(
        rt: ObjectRuntime,
        trip: FinishedTrip,
        measured: number | null,
        odometerStart: number | null,
    ): Promise<TripSummary> {
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
        if (rt.settings.type === 'boat' && trip.engineKnown) {
            // sailing = moving with the engine off
            const engineDistance = Math.min(Math.round(trip.engineDistance || 0), summary.distance);
            summary.engineDistance = engineDistance;
            summary.sailDistance = summary.distance - engineDistance;
        }
        if (first) {
            summary.from = await this.placeName(first.lat, first.lon);
        }
        if (last) {
            summary.to = await this.placeName(last.lat, last.lon);
        }

        const consumption = rt.meter
            ? measured
            : this.consumptionOf(rt, trip.distance, trip.engineTime, trip.movingTime);
        if (consumption !== null) {
            if (rt.meter) {
                summary.measured = true;
            }
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
        if (rt.config.logbook) {
            await this.addLogbookFields(rt, summary, odometerStart);
        }
        return summary;
    }

    /** Category, purpose, partner and driver of the control states, and the odometer */
    private async addLogbookFields(
        rt: ObjectRuntime,
        summary: TripSummary,
        odometerStart: number | null,
    ): Promise<void> {
        const control = async (name: string): Promise<string> => {
            const value = (await this.getStateAsync(`${rt.id}.control.${name}`))?.val;
            return typeof value === 'string' ? value.trim() : '';
        };
        const category = normalizeCategory(await control('category')) ?? normalizeCategory(rt.config.defaultCategory);
        if (category) {
            summary.category = category;
        }
        for (const field of ['purpose', 'partner', 'driver'] as const) {
            const value = await control(field);
            if (value) {
                summary[field] = value;
            }
        }
        // purpose and partner belong to one trip, the category goes back to the default
        await this.setStateAsync(`${rt.id}.control.purpose`, '', true);
        await this.setStateAsync(`${rt.id}.control.partner`, '', true);
        await this.setStateAsync(`${rt.id}.control.category`, rt.config.defaultCategory || '', true);

        const kilometers = summary.distance / METERS_PER_UNIT[rt.settings.unit];
        const odometerEnd = await this.readOdometer(rt);
        if (odometerEnd !== null) {
            summary.odometerEnd = round(odometerEnd, 1);
            summary.odometerStart = round(odometerStart ?? odometerEnd - kilometers, 1);
        } else {
            // continued from the last trip with the GPS distance
            const previous = [...rt.trips].reverse().find(t => t.odometerEnd !== undefined)?.odometerEnd;
            const initial = configNumber(rt.config.odometerInitial, 0);
            const start = previous ?? (initial > 0 ? initial : null);
            if (start !== null) {
                summary.odometerStart = round(start, 1);
                summary.odometerEnd = round(start + kilometers, 1);
            }
        }
    }

    /** Summary of the running trip, without addresses and consumption */
    private diagnostics(object?: unknown): Diagnostics {
        const now = Date.now();
        const one = object === undefined || object === null || object === '' ? null : this.findRuntime(object);
        const runtimes = one ? [one] : Object.values(this.runtimes);
        const home = (this.config.homePlace || '').trim();
        return {
            now,
            objects: runtimes.map(rt => this.objectDiagnostics(rt, now)),
            places: this.places.map(place => ({
                name: place.name,
                radius: place.radius,
                privacy: place.privacy,
                home: place.name === home,
            })),
            notificationInstance: this.config.notificationInstance || '',
            liveInterval: this.liveIntervalMs / 1000,
        };
    }

    private objectDiagnostics(rt: ObjectRuntime, now: number): DiagnosticsObject {
        const sources: DiagnosticsSource[] = rt.sources.map(assembler => {
            const s = assembler.source;
            const roles: [SourceStateRole, string, string | undefined][] = [
                ['position', s.positionId, s.positionFormat],
                ['latitude', s.latitudeId, undefined],
                ['longitude', s.longitudeId, undefined],
                ['speed', s.speedId, s.speedUnit],
                ['ignition', s.ignitionId, undefined],
                ['accuracy', s.accuracyId, s.accuracyType === 'hdop' ? 'hdop' : 'meters'],
                ['altitude', s.altitudeId, undefined],
                ['timestamp', s.timestampId, undefined],
                ['alive', s.aliveId || '', undefined],
            ];
            const values = assembler.stateValues;
            const states: DiagnosticsSourceState[] = roles
                .filter(([, id]) => !!id)
                .map(([role, id, format]) => {
                    const state = values[id];
                    const item: DiagnosticsSourceState = {
                        role,
                        id,
                        val: state ? state.val : null,
                        ts: state?.ts ?? null,
                        lc: state?.lc ?? null,
                    };
                    if (format) {
                        item.format = format;
                    }
                    return item;
                });
            return {
                label: s.label,
                type: s.type || 'generic',
                priority: s.priority,
                maxAge: s.maxAge / 1000,
                active: rt.fusion.activeSource === assembler,
                fresh: !!assembler.lastFix && now - assembler.lastFixAt <= s.maxAge,
                lastFix: diagnosticsPosition(assembler.lastFix),
                lastFixAt: assembler.lastFixAt || null,
                ignition: s.ignitionId ? assembler.ignition : null,
                ignitionTs: s.ignitionId && assembler.ignitionTs ? assembler.ignitionTs : null,
                counts: { ...assembler.counts },
                lastResult: assembler.lastResult as keyof DiagnosticsCounts | null,
                states,
            };
        });

        const st = rt.detector.state;
        const trip = st.trip;
        const live = rt.detector.live(now);
        const d = rt.settings.detector;
        const watch = rt.watch.state;
        const meter = rt.meter;
        const mode = rt.config.consumptionMode;
        const last = rt.trips[rt.trips.length - 1];
        const stopped = trip ? trip.stops.reduce((sum, stop) => sum + (stop.end - stop.start), 0) : 0;
        let phase: DiagnosticsObject['detector']['phase'] = 'parked';
        if (trip) {
            phase = 'trip';
        } else if (st.movingSince !== null) {
            phase = 'starting';
        }
        return {
            id: rt.id,
            name: rt.config.name,
            type: rt.settings.type,
            distanceUnit: rt.settings.unit,
            speedUnit: rt.settings.speedUnit,
            settings: {
                startSpeed: d.startSpeed,
                startSeconds: d.startSeconds,
                startDistance: d.startDistance,
                stopRadius: d.stopRadius,
                minStopSeconds: d.minStopSeconds,
                tripEndSeconds: d.tripEndSeconds,
                minDistance: d.minDistance,
                maxAccuracy: d.maxAccuracy,
                maxSpeed: d.maxSpeed,
                useIgnition: d.useIgnition,
            },
            sources,
            ignitionSource: rt.fusion.ignition()?.source.source.label ?? null,
            detector: {
                phase,
                ignition: st.ignition,
                manual: rt.detector.manual,
                lastFix: diagnosticsPosition(st.lastFix),
                lastReceived: st.lastReceived || null,
                speed: live.speed,
                movingSince: st.movingSince,
                parked: !trip && st.restAnchor ? { ...st.restAnchor } : null,
                pending: st.pending.length,
                suspects: st.suspects.length,
                trip: trip
                    ? {
                          start: trip.start,
                          last: trip.last,
                          reason: trip.reason,
                          distance: trip.distance,
                          duration: live.duration,
                          movingTime: Math.max(0, live.duration - stopped),
                          avgSpeed: live.avgSpeed,
                          maxSpeed: trip.maxSpeed,
                          engineTime: trip.engineTime,
                          engineDistance: trip.engineDistance,
                          engineKnown: trip.engineKnown,
                          points: trip.points.length,
                          stops: trip.stops.length,
                          gaps: trip.gaps,
                          lat: live.lat,
                          lon: live.lon,
                      }
                    : null,
            },
            watch: {
                active: watch.active,
                lat: watch.lat,
                lon: watch.lon,
                radius: watch.radius,
                distance: watch.active ? watch.distance : null,
                maxDistance: watch.maxDistance,
                alarm: watch.alarm,
                signalLost: watch.signalLost,
                since: watch.since,
                signalMinutes: rt.settings.watch.signalLostSeconds / 60,
                auto: !!rt.config.watchAuto,
            },
            meter: meter
                ? {
                      mode: meter.mode,
                      stateId: (rt.config.consumptionStateId || '').trim(),
                      unit: rt.config.consumptionUnit || 'l',
                      running: meter.running,
                      used: meter.current(now),
                      last: meter.state.last,
                      refills: meter.state.refills,
                  }
                : null,
            estimate:
                mode === 'distance' || mode === 'hours'
                    ? { mode, value: configNumber(rt.config.consumption, 0), unit: rt.config.consumptionUnit || 'l' }
                    : null,
            trips: {
                count: rt.trips.length,
                last: last ? { id: last.id, start: last.start, end: last.end, distance: last.distance } : null,
            },
            odometerStart: rt.odometerStart,
            inputs: [
                { role: 'odometer' as const, id: rt.config.logbook ? (rt.config.odometerId || '').trim() : '' },
                { role: 'price' as const, id: this.withConsumption(rt) ? (rt.config.priceStateId || '').trim() : '' },
            ].filter(input => !!input.id),
        };
    }

    private currentSummary(rt: ObjectRuntime, trip: ActiveTrip): TripSummary {
        const live = rt.detector.live(Date.now());
        const first = trip.points[0];
        const last = trip.points[trip.points.length - 1];
        const coordinate = (point: TrackPoint | undefined, key: 'lat' | 'lon'): number | null =>
            point && !isPrivate(this.places, point.lat, point.lon) ? round(point[key], 6) : null;
        const stopped = trip.stops.reduce((sum, stop) => sum + (stop.end - stop.start), 0);
        return {
            id: 'current',
            object: rt.config.name,
            start: trip.start,
            end: trip.last,
            duration: Math.round(live.duration / 1000),
            movingTime: Math.round(Math.max(0, live.duration - stopped) / 1000),
            distance: Math.round(trip.distance),
            avgSpeed: round(live.avgSpeed, 2),
            maxSpeed: round(trip.maxSpeed, 2),
            startLat: coordinate(first, 'lat'),
            startLon: coordinate(first, 'lon'),
            endLat: coordinate(last, 'lat'),
            endLon: coordinate(last, 'lon'),
            stops: trip.stops.map(stop => {
                const privateStop = !!isPrivate(this.places, stop.lat, stop.lon);
                return {
                    start: stop.start,
                    end: stop.end,
                    lat: privateStop ? null : round(stop.lat, 6),
                    lon: privateStop ? null : round(stop.lon, 6),
                    place: findPlace(this.places, stop.lat, stop.lon)?.name,
                };
            }),
            gaps: trip.gaps,
            points: trip.points.length,
            reason: trip.reason,
            track: false,
        };
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

    private async finishTrip(
        rt: ObjectRuntime,
        trip: FinishedTrip,
        measured: number | null,
        odometerStart: number | null,
    ): Promise<void> {
        if (trip.distance < MIN_TRIP_DISTANCE && trip.reason !== 'manual') {
            this.log.debug(`${rt.config.name}: trip of ${Math.round(trip.distance)} m discarded`);
            await this.store.delete(`${rt.id}/current.json`);
            await this.writeLive(rt);
            this.autoWatch(rt, trip);
            return;
        }
        const summary = await this.buildSummary(rt, trip, measured, odometerStart);
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
        if (rt.config.logbook) {
            await this.writeLogbookFiles(rt, new Date(summary.start).getFullYear());
        }
        this.autoWatch(rt, trip);
    }

    /** Starts the watch at the end of a trip, if configured */
    private autoWatch(rt: ObjectRuntime, trip: FinishedTrip): void {
        if (!rt.config.watchAuto || rt.watch.state.active) {
            return;
        }
        const end = trip.points[trip.points.length - 1] ?? rt.detector.lastFix;
        if (end) {
            rt.watch.activate(end.lat, end.lon, Date.now());
            this.log.info(`${rt.config.name}: watch started, radius ${rt.watch.state.radius} m`);
            this.enqueue(rt, () => this.writeWatch(rt, true));
        }
    }

    // ------------------------------------------------------------------ logbook

    /**
     * Changes the logbook fields of a trip and records the change
     *
     * @param rt the object
     * @param id ID of the trip
     * @param values the new values
     * @param source who changed it
     */
    private async updateTrip(
        rt: ObjectRuntime,
        id: string,
        values: Partial<Record<LogbookField, unknown>>,
        source: string,
    ): Promise<TripSummary> {
        const trip = rt.trips.find(t => t.id === id);
        if (!trip) {
            throw new Error(`Unknown trip "${id}"`);
        }
        const changes = applyChanges(trip, values, Date.now(), source);
        if (changes.length) {
            const year = new Date(trip.start).getFullYear();
            const file = `${rt.id}/changes-${year}.json`;
            const log = (await this.store.readJson<TripChange[]>(file)) || [];
            log.push(...changes);
            await this.store.writeJson(file, log);
            await this.store.saveYear(rt.id, year, rt.trips);
            for (const change of changes) {
                this.log.info(
                    `${rt.config.name}: trip ${id} ${change.field} "${change.old ?? ''}" → "${change.new ?? ''}" (${source})`,
                );
            }
            if (rt.config.logbook) {
                await this.writeLogbookFiles(rt, year);
            }
        }
        if (rt.trips[rt.trips.length - 1] === trip) {
            await this.writeLastTrip(rt, trip);
        }
        return trip;
    }

    private csvOptions(rt: ObjectRuntime): Parameters<typeof logbookCsv>[1] {
        return {
            lang: this.systemLanguage,
            meters: METERS_PER_UNIT[rt.settings.unit],
            unit: rt.settings.unit,
            formatNumber: (value, digits) => this.formatNumber(value, digits),
        };
    }

    /** `<object>/logbook-<year>.csv` and `<object>/logbook-<year>-changes.csv`, served by the web adapter */
    private async writeLogbookFiles(rt: ObjectRuntime, year: number): Promise<void> {
        const from = new Date(year, 0, 1).getTime();
        const to = new Date(year + 1, 0, 1).getTime();
        const trips = rt.trips.filter(t => t.start >= from && t.start < to);
        const changes = (await this.store.readJson<TripChange[]>(`${rt.id}/changes-${year}.json`)) || [];
        const file = `${rt.id}/logbook-${year}.csv`;
        const changesFile = `${rt.id}/logbook-${year}-changes.csv`;
        await this.store.writeText(file, logbookCsv(trips, this.csvOptions(rt)));
        await this.store.writeText(changesFile, changesCsv(changes, this.systemLanguage));
        if (year === new Date().getFullYear()) {
            await this.setStateChangedAsync(`${rt.id}.logbook.csv`, `/${this.namespace}/${file}`, true);
            await this.setStateChangedAsync(`${rt.id}.logbook.changes`, `/${this.namespace}/${changesFile}`, true);
        }
    }

    private async saveCheckpoint(rt: ObjectRuntime): Promise<void> {
        rt.lastCheckpoint = Date.now();
        if (rt.detector.trip) {
            const checkpoint: Checkpoint = {
                detector: rt.detector.state,
                meter: rt.meter?.state,
                odometerStart: rt.odometerStart,
            };
            await this.store.writeJson(`${rt.id}/current.json`, checkpoint);
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

    private notify(rt: ObjectRuntime, summary: TripSummary, message: string): void {
        if (!rt.config.notify) {
            return;
        }
        const minDistance = configNumber(this.config.notificationMinDistance, 0);
        if (summary.distance / METERS_PER_UNIT[rt.settings.unit] < minDistance) {
            return;
        }
        this.sendNotification(message, `${rt.config.name}: trip`);
    }

    /**
     * Sends a text to the configured messenger
     *
     * @param text the message
     * @param subject subject of an email
     */
    private sendNotification(text: string, subject: string): void {
        const instance = (this.config.notificationInstance || '').trim();
        if (!instance) {
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
                message = user ? { text, subject, to: user } : { text, subject };
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
            result = await this.handleMessage(obj.command, msg, obj.from || 'message');
        } catch (e) {
            result = { error: e.message };
        }
        if (obj.callback) {
            this.sendTo(obj.from, obj.command, result as ioBroker.MessagePayload, obj.callback);
        }
    }

    /** Runs a job in the queue of the object and returns its result */
    private queued<T>(rt: ObjectRuntime, job: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.enqueue(rt, async () => {
                try {
                    resolve(await job());
                } catch (e) {
                    reject(e instanceof Error ? e : new Error(String(e)));
                }
            });
        });
    }

    private yearRange(msg: Record<string, any>): { from: number; to: number; year: number } {
        const year = Math.round(configNumber(msg.year, new Date().getFullYear()));
        const from = configNumber(msg.from, new Date(year, 0, 1).getTime());
        const to = configNumber(msg.to, new Date(year + 1, 0, 1).getTime());
        return { from, to, year };
    }

    private async handleMessage(command: string, msg: Record<string, any>, from: string): Promise<unknown> {
        switch (command) {
            case 'getObjectNames':
                // the settings list all objects, the widgets (`enabled: true`) only the running ones
                return (this.config.objects || [])
                    .filter(o => o?.name?.trim() && (!msg.enabled || o.enabled))
                    .map(o => ({ label: o.name, value: o.name }));

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

            case 'getObjects':
                // for widgets: the state prefix and the units of each object
                return Object.values(this.runtimes).map(rt => ({
                    name: rt.config.name,
                    id: rt.id,
                    type: rt.settings.type,
                    distanceUnit: rt.settings.unit,
                    speedUnit: rt.settings.speedUnit,
                    consumptionUnit:
                        rt.config.consumptionMode && rt.config.consumptionMode !== 'none'
                            ? rt.config.consumptionUnit || 'l'
                            : null,
                    currency: this.config.currency || '€',
                    active: !!rt.detector.trip,
                }));

            case 'getDiagnostics':
                // { object? }: what is read from where and what the adapter made of it
                return this.diagnostics(msg.object);

            case 'getTrack': {
                const rt = this.findRuntime(msg.object);
                if (!rt) {
                    return { error: `Unknown object "${msg.object}"` };
                }
                const format = msg.format === 'gpx' ? 'gpx' : 'geojson';
                if (msg.id === 'current') {
                    // the running trip so far, without the privacy zones
                    const active = rt.detector.trip;
                    if (!active) {
                        return { error: 'No active trip' };
                    }
                    const summary = this.currentSummary(rt, active);
                    const points = this.storablePoints(active.points);
                    return {
                        result:
                            format === 'gpx'
                                ? toGpx(
                                      summary,
                                      points,
                                      `${rt.config.name} ${new Date(summary.start).toLocaleString()}`,
                                  )
                                : toGeoJson(summary, points),
                    };
                }
                const trip = rt.trips.find(t => t.id === msg.id);
                if (!trip) {
                    return { error: 'Unknown trip' };
                }
                if (!trip.track) {
                    return { error: 'The track was not stored or was deleted' };
                }
                const text = await this.store.readText(TripStore.trackPath(rt.id, trip, format));
                return text ? { result: text } : { error: 'Track file not found' };
            }

            case 'updateTrip': {
                // logbook: { object, id, category?, purpose?, partner?, driver? }
                const rt = this.findRuntime(msg.object);
                if (!rt) {
                    return { error: `Unknown object "${msg.object}"` };
                }
                const values: Partial<Record<LogbookField, unknown>> = {};
                for (const field of LOGBOOK_FIELDS) {
                    if (field in msg) {
                        values[field] = msg[field];
                    }
                }
                const id = typeof msg.id === 'string' ? msg.id : '';
                const trip = await this.queued(rt, () =>
                    this.updateTrip(rt, id, values, from.replace(/^system\.adapter\./, '')),
                );
                return { result: trip };
            }

            case 'exportLogbook': {
                // { object, year? | from?, to?, changes?: true } → CSV
                const rt = this.findRuntime(msg.object);
                if (!rt) {
                    return { error: `Unknown object "${msg.object}"` };
                }
                const range = this.yearRange(msg);
                if (msg.changes) {
                    const changes =
                        (await this.store.readJson<TripChange[]>(`${rt.id}/changes-${range.year}.json`)) || [];
                    return { result: changesCsv(changes, this.systemLanguage) };
                }
                const trips = rt.trips.filter(t => t.start >= range.from && t.start < range.to);
                return { result: logbookCsv(trips, this.csvOptions(rt)) };
            }

            case 'getChanges': {
                const rt = this.findRuntime(msg.object);
                if (!rt) {
                    return { error: `Unknown object "${msg.object}"` };
                }
                const { year } = this.yearRange(msg);
                return (await this.store.readJson<TripChange[]>(`${rt.id}/changes-${year}.json`)) || [];
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
