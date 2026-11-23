/**
 * What the elements ask the adapter (`sendTo`) and how they show it: the objects, the trips, the tracks, the units.
 *
 * The messages are answered by `handleMessage()` of the adapter (`src/main.ts`):
 * - `getObjects` → `[{ name, id, type, distanceUnit, speedUnit, consumptionUnit, currency, active }]`
 * - `getTrips` `{ object, limit, to? }` → the summaries, newest first (started before `to`), or `{ error }`
 * - `getTrack` `{ object, id, format: 'geojson' }` → `{ result: <GeoJSON text> }` or `{ error }`
 * - `getDiagnostics` `{ object? }` → `Diagnostics` of `src/lib/diagnostics.ts`
 */
import type { WebComponentSocket } from '@iobroker/web-components';

import { intlLang } from './words';

export type DistanceUnit = 'km' | 'nm' | 'mi';
export type SpeedUnit = 'km/h' | 'kn' | 'mph' | 'm/s';

/** An object the instance tracks, as `getObjects` answers */
export interface TripObject {
    name: string;
    /** The object below the instance: its states are `trips.0.<id>.live.*` and `trips.0.<id>.lastTrip.*` */
    id: string;
    type: 'car' | 'boat' | 'person' | 'other';
    distanceUnit: DistanceUnit;
    speedUnit: SpeedUnit;
    /** null without consumption */
    consumptionUnit: string | null;
    currency: string;
    /** A trip is running */
    active: boolean;
}

/** A stop inside a trip; no coordinates after the retention or inside a privacy zone */
export interface TripStop {
    start: number;
    end: number;
    lat: number | null;
    lon: number | null;
    place?: string;
}

/** What the adapter keeps of a trip (`src/lib/summary.ts`), as far as the elements show it */
export interface TripSummary {
    /** `YYYYMMDD-HHMMSS` of the start, or `current` for the running trip */
    id: string;
    start: number;
    end: number;
    /** Seconds */
    duration: number;
    /** Seconds */
    movingTime: number;
    /** Meters */
    distance: number;
    /** m/s */
    avgSpeed: number;
    /** m/s */
    maxSpeed: number;
    startLat: number | null;
    startLon: number | null;
    endLat: number | null;
    endLon: number | null;
    from?: string;
    to?: string;
    stops: TripStop[];
    consumption?: number;
    consumptionUnit?: string;
    cost?: number;
    currency?: string;
    /** The consumption was measured, not estimated */
    measured?: boolean;
    /** Seconds with ignition/engine on */
    engineTime?: number;
    /** Boats with a known engine state: meters with the engine on */
    engineDistance?: number;
    /** Boats with a known engine state: meters under sail */
    sailDistance?: number;
    /** The track file exists */
    track: boolean;
}

/** `[latitude, longitude]` */
export type LatLon = [number, number];

/** A track read from the GeoJSON of the adapter */
export interface TripTrack {
    /** The parts of the track, split at the gaps where the way is unknown */
    segments: LatLon[][];
    /** The stops with coordinates */
    stops: TripStop[];
    /** The properties of the line: the summary of the trip */
    summary: TripSummary | null;
}

/** How long an element waits for the answer of the instance, in ms */
const ANSWER_TIMEOUT = 15_000;

/** The instance did not answer: it is stopped, or it is not this adapter */
export class NoAnswerError extends Error {
    readonly instance: string;

    constructor(instance: string) {
        super(`No answer from ${instance}`);
        this.instance = instance;
    }
}

/**
 * Ask the instance; an answer `{ error }` is thrown
 *
 * @param socket the connection of the host
 * @param instance e.g. `trips.0`
 * @param command the command of the adapter
 * @param message what the command needs
 */
async function ask<T>(socket: WebComponentSocket, instance: string, command: string, message?: unknown): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new NoAnswerError(instance)), ANSWER_TIMEOUT);
    });
    try {
        const answer = await Promise.race([socket.sendTo<unknown>(instance, command, message), timeout]);
        if (answer && typeof answer === 'object' && !Array.isArray(answer) && 'error' in answer) {
            throw new Error(String(answer.error));
        }
        return answer as T;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * The objects the instance tracks
 *
 * @param socket the connection of the host
 * @param instance e.g. `trips.0`
 */
export async function loadObjects(socket: WebComponentSocket, instance: string): Promise<TripObject[]> {
    const answer = await ask<unknown>(socket, instance, 'getObjects');
    return Array.isArray(answer)
        ? (answer as TripObject[]).filter(obj => obj && typeof obj.id === 'string' && obj.id)
        : [];
}

/**
 * The object the settings name: by ID or name, else ignoring the case; the first one if none is named
 *
 * @param objects the objects of the instance
 * @param wanted name or ID, empty for the first one
 */
export function findObject(objects: TripObject[], wanted: string): TripObject | null {
    if (!wanted) {
        return objects[0] || null;
    }
    const lower = wanted.toLowerCase();
    return (
        objects.find(obj => obj.id === wanted || obj.name === wanted) ||
        objects.find(obj => obj.id.toLowerCase() === lower || String(obj.name).toLowerCase() === lower) ||
        null
    );
}

/**
 * The last trips of an object, newest first
 *
 * @param socket the connection of the host
 * @param instance e.g. `trips.0`
 * @param object the ID of the object
 * @param limit how many
 * @param to only trips that started before this time (the next page: the start of the oldest trip so far)
 */
export async function loadTrips(
    socket: WebComponentSocket,
    instance: string,
    object: string,
    limit: number,
    to?: number,
): Promise<TripSummary[]> {
    const answer = await ask<unknown>(
        socket,
        instance,
        'getTrips',
        to === undefined ? { object, limit } : { object, limit, to },
    );
    return Array.isArray(answer) ? (answer as TripSummary[]) : [];
}

/**
 * What the adapter reads and what it made of it (`getDiagnostics`)
 *
 * @param socket the connection of the host
 * @param instance e.g. `trips.0`
 * @param object the ID of one object, empty for all
 */
export async function loadDiagnostics<T>(socket: WebComponentSocket, instance: string, object: string): Promise<T> {
    const answer = await ask<T>(socket, instance, 'getDiagnostics', object ? { object } : {});
    if (!answer || typeof answer !== 'object' || !Array.isArray((answer as { objects?: unknown }).objects)) {
        throw new Error(`getDiagnostics: no answer of ${instance}`);
    }
    return answer;
}

/**
 * The track of a trip, or of the running trip (`current`)
 *
 * @param socket the connection of the host
 * @param instance e.g. `trips.0`
 * @param object the ID of the object
 * @param id the ID of the trip, or `current`
 */
export async function loadTrack(
    socket: WebComponentSocket,
    instance: string,
    object: string,
    id: string,
): Promise<TripTrack> {
    const answer = await ask<{ result?: unknown }>(socket, instance, 'getTrack', { object, id, format: 'geojson' });
    return parseTrack(typeof answer?.result === 'string' ? answer.result : '');
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/** `[lon, lat, alt?]` of GeoJSON as `[lat, lon]`, without broken points */
function toLatLons(coordinates: unknown): LatLon[] {
    if (!Array.isArray(coordinates)) {
        return [];
    }
    const points: LatLon[] = [];
    for (const c of coordinates) {
        if (Array.isArray(c) && isNumber(c[0]) && isNumber(c[1])) {
            points.push([c[1], c[0]]);
        }
    }
    return points;
}

/**
 * The track in the GeoJSON of the adapter (`toGeoJson()` in `src/lib/export.ts`): the first feature is a
 * `LineString` or, split at the gaps, a `MultiLineString` with the summary as properties; the stops follow as points.
 *
 * @param text the GeoJSON
 */
export function parseTrack(text: string): TripTrack {
    const track: TripTrack = { segments: [], stops: [], summary: null };
    let json: { features?: unknown };
    try {
        json = JSON.parse(text) as { features?: unknown };
    } catch {
        return track;
    }
    const features = Array.isArray(json?.features) ? (json.features as unknown[]) : [];
    for (const feature of features) {
        const { geometry, properties } = (feature || {}) as {
            geometry?: { type?: string; coordinates?: unknown };
            properties?: Record<string, unknown> | null;
        };
        if (geometry?.type === 'LineString' || geometry?.type === 'MultiLineString') {
            const parts = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
            if (Array.isArray(parts)) {
                for (const part of parts) {
                    const segment = toLatLons(part);
                    if (segment.length) {
                        track.segments.push(segment);
                    }
                }
            }
            if (!track.summary && properties && isNumber(properties.start)) {
                const { coordTimes: _times, speeds: _speeds, ...summary } = properties;
                track.summary = summary as unknown as TripSummary;
            }
        } else if (geometry?.type === 'Point' && properties?.kind === 'stop') {
            const [point] = toLatLons([geometry.coordinates]);
            if (point) {
                track.stops.push({
                    lat: point[0],
                    lon: point[1],
                    start: isNumber(properties.start) ? properties.start : 0,
                    end: isNumber(properties.end) ? properties.end : 0,
                    place: typeof properties.place === 'string' ? properties.place : undefined,
                });
            }
        }
    }
    return track;
}

// ---------------------------------------------------------------- states

export function toNumber(value: ioBroker.StateValue | undefined): number | undefined {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
}

export function toBool(value: ioBroker.StateValue | undefined): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * A position of the live states: `live.position` (`lat;lon`, written at once), else `live.latitude` and
 * `live.longitude`
 *
 * @param position the value of `live.position`
 * @param latitude the value of `live.latitude`
 * @param longitude the value of `live.longitude`
 */
export function toPosition(
    position: ioBroker.StateValue | undefined,
    latitude: ioBroker.StateValue | undefined,
    longitude: ioBroker.StateValue | undefined,
): LatLon | null {
    if (typeof position === 'string' && position.includes(';')) {
        const [lat, lon] = position.split(';').map(part => Number(part));
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            return [lat, lon];
        }
    }
    const lat = toNumber(latitude);
    const lon = toNumber(longitude);
    return lat !== undefined && lon !== undefined && (lat || lon) ? [lat, lon] : null;
}

// ---------------------------------------------------------------- units

const METERS_PER_UNIT: Record<DistanceUnit, number> = { km: 1000, nm: 1852, mi: 1609.344 };

const MS_PER_SPEED_UNIT: Record<SpeedUnit, number> = {
    'km/h': 1 / 3.6,
    kn: 1852 / 3600,
    mph: 1609.344 / 3600,
    'm/s': 1,
};

/** Meters in the distance unit of the object */
export function toDistance(meters: number, unit: DistanceUnit): number {
    return meters / (METERS_PER_UNIT[unit] || 1000);
}

/** m/s in the speed unit of the object */
export function toSpeed(ms: number, unit: SpeedUnit): number {
    return ms / (MS_PER_SPEED_UNIT[unit] || 1);
}

// ---------------------------------------------------------------- texts

export function formatNumber(value: number, digits: number, lang: string): string {
    try {
        return value.toLocaleString(intlLang(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch {
        return value.toFixed(digits);
    }
}

/** `12.34 km` below 10, `123.4 km` above */
export function formatDistance(value: number, unit: string, lang: string): string {
    return `${formatNumber(value, Math.abs(value) < 10 ? 2 : 1, lang)} ${unit}`;
}

export function formatSpeed(value: number, unit: string, lang: string): string {
    return `${formatNumber(value, Math.abs(value) < 10 ? 1 : 0, lang)} ${unit}`;
}

/** `5.80 €`: the currency of the adapter is a symbol, not an ISO code */
export function formatMoney(value: number, currency: string | undefined, lang: string): string {
    return `${formatNumber(value, 2, lang)}${currency ? ` ${currency}` : ''}`;
}

const UNIT_FALLBACK = { day: 'd', hour: 'h', minute: 'min', second: 's' } as const;

function formatUnit(value: number, unit: 'day' | 'hour' | 'minute' | 'second', lang: string): string {
    try {
        return new Intl.NumberFormat(intlLang(lang), { style: 'unit', unit, unitDisplay: 'short' }).format(value);
    } catch {
        return `${value} ${UNIT_FALLBACK[unit]}`;
    }
}

/** `45 s`, `12 min`, `1 hr 5 min` in the language of the system */
export function formatDuration(seconds: number, lang: string): string {
    const total = Math.max(0, Math.round(seconds));
    if (total < 60) {
        return formatUnit(total, 'second', lang);
    }
    const minutes = Math.round(total / 60);
    if (minutes < 60) {
        return formatUnit(minutes, 'minute', lang);
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest
        ? `${formatUnit(hours, 'hour', lang)} ${formatUnit(rest, 'minute', lang)}`
        : formatUnit(hours, 'hour', lang);
}

/** `08:15` */
export function formatTime(ts: number, lang: string): string {
    return new Date(ts).toLocaleTimeString(intlLang(lang), { hour: '2-digit', minute: '2-digit' });
}

function startOfDay(ts: number): number {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** `today`, `yesterday` or `Mon, 12 Nov` (with the year if it is not this one) */
export function formatDay(ts: number, lang: string): string {
    const locale = intlLang(lang);
    const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86_400_000);
    if (days === 0 || days === 1) {
        try {
            const text = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
            return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
        } catch {
            // an old browser: the date
        }
    }
    const date = new Date(ts);
    return date.toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    });
}

/** `08:15 – 09:02`; with the day if the trip ends on another one */
export function formatTimeRange(start: number, end: number, lang: string): string {
    const endText =
        startOfDay(start) === startOfDay(end)
            ? formatTime(end, lang)
            : `${formatDay(end, lang)} ${formatTime(end, lang)}`;
    return `${formatTime(start, lang)} – ${endText}`;
}

/** `08:15` today, `Mon, 12 Nov 08:15` before */
export function formatMoment(ts: number, lang: string): string {
    return startOfDay(ts) === startOfDay(Date.now())
        ? formatTime(ts, lang)
        : `${formatDay(ts, lang)} ${formatTime(ts, lang)}`;
}

/** `Home → Office`, `… → Office`; empty if neither is known */
export function formatRoute(from: string | undefined, to: string | undefined): string {
    return from || to ? `${from || '…'} → ${to || '…'}` : '';
}

/** `November 2026` */
export function formatMonth(ts: number, lang: string): string {
    return new Date(ts).toLocaleDateString(intlLang(lang), { month: 'long', year: 'numeric' });
}

/** The start of the day of a time, local */
export function dayOf(ts: number): number {
    return startOfDay(ts);
}

/**
 * How long ago: `3 s`, `12 min`, `5 h`, `3 d` - compact, for tables
 *
 * @param ms the age in ms; negative (clocks) counts as 0
 * @param lang the language of the system
 */
export function formatAge(ms: number, lang: string): string {
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 120) {
        return formatUnit(seconds, 'second', lang);
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 120) {
        return formatUnit(minutes, 'minute', lang);
    }
    const hours = Math.round(minutes / 60);
    if (hours < 48) {
        return formatUnit(hours, 'hour', lang);
    }
    return formatUnit(Math.round(hours / 24), 'day', lang);
}

/** `54.32900, 10.15000` */
export function formatCoordinates(
    lat: number | null | undefined,
    lon: number | null | undefined,
    lang: string,
): string {
    if (!isNumber(lat) || !isNumber(lon)) {
        return '—';
    }
    return `${formatNumber(lat, 5, lang)}, ${formatNumber(lon, 5, lang)}`;
}
