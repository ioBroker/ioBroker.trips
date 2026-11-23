import type { AccuracyType, PositionFormat, SourceConfig, SpeedUnit } from '../types';
import { isValidLatLon, parsePosition, toMs } from './geo';
import type { Fix } from './tripDetector';

/** The state IDs a source listens to, after the preset was applied */
export interface ResolvedSource {
    /** Label for logs and the `live.source` state */
    label: string;
    object: string;
    priority: number;
    /** ms */
    maxAge: number;
    positionFormat: PositionFormat;
    latitudeId: string;
    longitudeId: string;
    positionId: string;
    speedId: string;
    speedUnit: SpeedUnit;
    ignitionId: string;
    accuracyId: string;
    accuracyType: AccuracyType;
    altitudeId: string;
    timestampId: string;
}

/** Typical error of a GPS position per HDOP unit in meters */
const HDOP_TO_METERS = 5;
/** lat and lon written in two states are combined, if they come within this time */
const ASSEMBLE_MS = 300;

function trimId(id: string | undefined): string {
    return (id || '').trim();
}

/** Callback for the existence check of the presets */
export type ObjectExists = (id: string) => Promise<boolean>;

/**
 * Applies the preset of the source type and returns the state IDs.
 *
 * @param config source configuration
 * @param exists checks if a state exists: some presets choose between alternatives
 */
export async function resolveSource(config: SourceConfig, exists: ObjectExists): Promise<ResolvedSource | null> {
    const base = trimId(config.baseId).replace(/\.$/, '');
    const priority = parseInt(config.priority as string, 10);
    const maxAge = parseFloat(config.maxAge as string);
    const resolved: ResolvedSource = {
        label: '',
        object: (config.object || '').trim(),
        priority: Number.isFinite(priority) ? priority : 1,
        maxAge: (Number.isFinite(maxAge) && maxAge > 0 ? maxAge : 60) * 1000,
        positionFormat: config.positionFormat || 'separate',
        latitudeId: trimId(config.latitudeId),
        longitudeId: trimId(config.longitudeId),
        positionId: trimId(config.positionId),
        speedId: trimId(config.speedId),
        speedUnit: config.speedUnit || 'km/h',
        ignitionId: trimId(config.ignitionId),
        accuracyId: trimId(config.accuracyId),
        accuracyType: config.accuracyType || 'meters',
        altitudeId: trimId(config.altitudeId),
        timestampId: trimId(config.timestampId),
    };

    switch (config.type) {
        case 'nmea': {
            if (!base) {
                return null;
            }
            // GNSS Position Data (129029) has the HDOP and the altitude, but not every bus has it
            const gnss = `${base}.gnssPositionData.position`;
            if (await exists(gnss)) {
                resolved.positionId = gnss;
                resolved.accuracyId ||= `${base}.gnssPositionData.hdop`;
                resolved.accuracyType = 'hdop';
                resolved.altitudeId ||= `${base}.gnssPositionData.altitude`;
            } else {
                resolved.positionId = `${base}.positionRapidUpdate.position`;
            }
            resolved.positionFormat = 'latlon';
            resolved.speedId ||= `${base}.cogSogRapidUpdate.sog`;
            resolved.speedUnit = resolved.speedId === `${base}.cogSogRapidUpdate.sog` ? 'kn' : resolved.speedUnit;
            resolved.ignitionId ||= `${base}.engineParametersRapidUpdate.speed`;
            resolved.label = base;
            break;
        }
        case 'serial-gps': {
            if (!base) {
                return null;
            }
            resolved.positionFormat = 'latlon';
            resolved.positionId = `${base}.gps.latlon`;
            resolved.speedId = `${base}.gps.speed_kmh`;
            resolved.speedUnit = 'km/h';
            resolved.accuracyId = `${base}.gps.hdop`;
            resolved.accuracyType = 'hdop';
            resolved.altitudeId = `${base}.gps.altitude`;
            resolved.timestampId = `${base}.gps.timestamp`;
            resolved.label = base;
            break;
        }
        case 'teltonika': {
            if (!base) {
                return null;
            }
            // GPS of the Teltonika routers (RUT/RUTX) via ioBroker.teltonika: base is `teltonika.0.<router>`
            resolved.positionFormat = 'separate';
            resolved.latitudeId = `${base}.gps.latitude`;
            resolved.longitudeId = `${base}.gps.longitude`;
            resolved.accuracyId = `${base}.gps.accuracy`;
            resolved.accuracyType = 'meters';
            // fixTime is a text without time zone, and the routers are polled live: the time stamp of the state is better
            resolved.timestampId = '';
            resolved.label = base;
            break;
        }
        default: {
            if (resolved.positionFormat === 'separate') {
                if (!resolved.latitudeId || !resolved.longitudeId) {
                    return null;
                }
                resolved.positionId = '';
            } else {
                if (!resolved.positionId) {
                    return null;
                }
                resolved.latitudeId = '';
                resolved.longitudeId = '';
            }
            resolved.label = resolved.positionId || resolved.latitudeId.replace(/\.[^.]+$/, '');
            break;
        }
    }
    return resolved.object ? resolved : null;
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const num = parseFloat(value.replace(',', '.'));
        return Number.isFinite(num) ? num : null;
    }
    return null;
}

/** Ignition from a boolean, a number (RPM, voltage level 0/1) or a text */
export function parseIgnition(value: unknown): boolean | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value > 0 : null;
    }
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim().toLowerCase();
    if (['true', 'on', 'an', 'ein', '1', 'yes', 'ja'].includes(text)) {
        return true;
    }
    if (['false', 'off', 'aus', '0', 'no', 'nein'].includes(text)) {
        return false;
    }
    const num = toNumber(text);
    return num === null ? null : num > 0;
}

/** Time from a number (ms or s) or a date text */
export function parseTimestamp(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        // seconds since 1970 are below 1e11 until the year 5138
        return value < 1e11 ? value * 1000 : value;
    }
    if (typeof value === 'string' && value.trim()) {
        if (/^\d+(\.\d+)?$/.test(value.trim())) {
            return parseTimestamp(parseFloat(value));
        }
        const ts = Date.parse(value);
        return Number.isFinite(ts) ? ts : null;
    }
    return null;
}

/**
 * Collects the state values of one source and makes positions out of them.
 */
export class SourceAssembler {
    private values: Record<string, ioBroker.State> = {};
    private timer: ReturnType<typeof setTimeout> | null = null;
    /** Wall clock of the last position */
    lastFixAt = 0;
    lastFix: Fix | null = null;
    ignition: boolean | null = null;
    /** Time of the last change of the ignition */
    ignitionTs = 0;

    constructor(
        readonly source: ResolvedSource,
        private readonly onFix: (fix: Fix, source: SourceAssembler) => void,
        private readonly onIgnition: (on: boolean, ts: number, source: SourceAssembler) => void,
    ) {}

    /** All state IDs this source needs */
    get stateIds(): string[] {
        const s = this.source;
        return [
            s.latitudeId,
            s.longitudeId,
            s.positionId,
            s.speedId,
            s.ignitionId,
            s.accuracyId,
            s.altitudeId,
            s.timestampId,
        ].filter(id => !!id);
    }

    /** IDs that trigger a new position */
    private isPositionId(id: string): boolean {
        const s = this.source;
        return id === s.positionId || id === s.latitudeId || id === s.longitudeId;
    }

    /**
     * Initial values: taken for the speed, accuracy etc., but they do not create a position
     */
    init(id: string, state: ioBroker.State | null | undefined): void {
        if (!state) {
            return;
        }
        this.values[id] = state;
        if (id === this.source.ignitionId) {
            this.ignition = parseIgnition(state.val);
            this.ignitionTs = state.lc || state.ts;
        }
    }

    onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!state) {
            return;
        }
        const previous = this.values[id];
        this.values[id] = state;
        if (id === this.source.ignitionId) {
            const on = parseIgnition(state.val);
            if (on !== null && on !== this.ignition) {
                this.ignition = on;
                this.ignitionTs = state.ts || Date.now();
                this.onIgnition(on, this.ignitionTs, this);
            }
        }
        if (this.isPositionId(id)) {
            // A position written again with the same value and time stamp (e.g. after a reconnect) is no news
            if (previous && previous.val === state.val && previous.ts === state.ts) {
                return;
            }
            if (this.source.positionFormat === 'separate') {
                // latitude and longitude come in two states: wait a moment for the other one
                this.timer ||= setTimeout(() => {
                    this.timer = null;
                    this.emit();
                }, ASSEMBLE_MS);
            } else {
                this.emit();
            }
        }
    }

    /** Builds the position from the collected values */
    buildFix(): Fix | null {
        const s = this.source;
        let lat: number | null = null;
        let lon: number | null = null;
        let ts = 0;
        let accuracy: number | null = null;
        let alt: number | null = null;
        if (s.positionFormat === 'separate') {
            const latState = this.values[s.latitudeId];
            const lonState = this.values[s.longitudeId];
            lat = toNumber(latState?.val);
            lon = toNumber(lonState?.val);
            ts = Math.max(latState?.ts || 0, lonState?.ts || 0);
        } else {
            const posState = this.values[s.positionId];
            const parsed = parsePosition(posState?.val, s.positionFormat);
            if (parsed) {
                lat = parsed.lat;
                lon = parsed.lon;
                accuracy = parsed.accuracy ?? null;
                alt = parsed.alt ?? null;
            }
            ts = posState?.ts || 0;
        }
        if (!isValidLatLon(lat, lon)) {
            return null;
        }
        if (s.timestampId) {
            const sourceTs = parseTimestamp(this.values[s.timestampId]?.val);
            // The time of the source is better (buffered data), as long as it is plausible
            if (sourceTs && Math.abs(sourceTs - ts) < 7 * 24 * 3600000) {
                ts = sourceTs;
            }
        }
        const fix: Fix = { ts: ts || Date.now(), lat: lat!, lon: lon!, source: s.label };
        if (s.speedId) {
            const speed = toNumber(this.values[s.speedId]?.val);
            if (speed !== null && speed >= 0) {
                fix.speed = toMs(speed, s.speedUnit);
            }
        }
        if (s.accuracyId) {
            const acc = toNumber(this.values[s.accuracyId]?.val);
            if (acc !== null && acc >= 0) {
                accuracy = s.accuracyType === 'hdop' ? acc * HDOP_TO_METERS : acc;
            }
        }
        if (accuracy !== null) {
            fix.accuracy = accuracy;
        }
        if (s.altitudeId) {
            alt = toNumber(this.values[s.altitudeId]?.val) ?? alt;
        }
        if (alt !== null) {
            fix.alt = alt;
        }
        return fix;
    }

    private emit(): void {
        const fix = this.buildFix();
        if (fix) {
            this.lastFix = fix;
            this.lastFixAt = Date.now();
            this.onFix(fix, this);
        }
    }

    destroy(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}

/**
 * Chooses for one object which source is used: the best priority whose position is fresh and accurate enough.
 * With equal priority, the better accuracy wins.
 */
export class Fusion {
    private active: SourceAssembler | null = null;

    constructor(
        private readonly sources: SourceAssembler[],
        private readonly maxAccuracy: number,
    ) {}

    get activeSource(): SourceAssembler | null {
        return this.active;
    }

    private usable(source: SourceAssembler, now: number): boolean {
        if (!source.lastFix || now - source.lastFixAt > source.source.maxAge) {
            return false;
        }
        return typeof source.lastFix.accuracy !== 'number' || source.lastFix.accuracy <= this.maxAccuracy;
    }

    private better(a: SourceAssembler, b: SourceAssembler): boolean {
        if (a.source.priority !== b.source.priority) {
            return a.source.priority < b.source.priority;
        }
        const accA = a.lastFix?.accuracy ?? Infinity;
        const accB = b.lastFix?.accuracy ?? Infinity;
        return accA < accB;
    }

    /**
     * Decides if a new position of a source is used.
     *
     * @param from the source of the new position
     * @param now wall clock
     */
    accept(from: SourceAssembler, now: number = Date.now()): boolean {
        if (this.sources.length === 1) {
            this.active = from;
            return true;
        }
        if (!this.usable(from, now)) {
            return false;
        }
        for (const other of this.sources) {
            if (other !== from && this.usable(other, now) && this.better(other, from)) {
                return false;
            }
        }
        this.active = from;
        return true;
    }

    /**
     * Ignition of the object: from the source with the best priority that knows it
     */
    ignition(): { on: boolean; source: SourceAssembler } | null {
        let best: SourceAssembler | null = null;
        for (const source of this.sources) {
            if (source.ignition !== null && (!best || source.source.priority < best.source.priority)) {
                best = source;
            }
        }
        return best ? { on: best.ignition!, source: best } : null;
    }
}
