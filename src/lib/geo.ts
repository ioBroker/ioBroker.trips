import type { DistanceUnit, SpeedUnit } from '../types';

/** Mean earth radius in meters (IUGG) */
const EARTH_RADIUS = 6371008.8;
const RAD = Math.PI / 180;

export interface LatLon {
    lat: number;
    lon: number;
}

/** Meters per distance unit */
export const METERS_PER_UNIT: Record<DistanceUnit, number> = {
    km: 1000,
    nm: 1852,
    mi: 1609.344,
};

/** m/s per speed unit */
const MS_PER_SPEED_UNIT: Record<SpeedUnit, number> = {
    'km/h': 1 / 3.6,
    kn: 1852 / 3600,
    'm/s': 1,
    mph: 1609.344 / 3600,
};

/** The speed unit that belongs to a distance unit */
export const SPEED_UNIT_OF: Record<DistanceUnit, SpeedUnit> = {
    km: 'km/h',
    nm: 'kn',
    mi: 'mph',
};

export function toMs(value: number, unit: SpeedUnit): number {
    return value * (MS_PER_SPEED_UNIT[unit] ?? 1);
}

export function fromMs(value: number, unit: SpeedUnit): number {
    return value / (MS_PER_SPEED_UNIT[unit] ?? 1);
}

/** Great circle distance in meters (haversine). Accurate to ~0.3 %, which is far below the GPS errors. */
export function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = (lat2 - lat1) * RAD;
    const dLon = (lon2 - lon1) * RAD;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function distanceOf(a: LatLon, b: LatLon): number {
    return distance(a.lat, a.lon, b.lat, b.lon);
}

/** Initial course from a to b in degrees 0..360 */
export function bearing(a: LatLon, b: LatLon): number {
    const φ1 = a.lat * RAD;
    const φ2 = b.lat * RAD;
    const Δλ = (b.lon - a.lon) * RAD;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) / RAD + 360) % 360;
}

/**
 * A usable position: inside the valid range and not 0/0, which many receivers report without a fix.
 */
export function isValidLatLon(lat: unknown, lon: unknown): boolean {
    return (
        typeof lat === 'number' &&
        typeof lon === 'number' &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180 &&
        !(lat === 0 && lon === 0)
    );
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

export interface ParsedPosition extends LatLon {
    accuracy?: number;
    alt?: number;
}

/**
 * Parses a position from one state value.
 *
 * @param value the value of the state
 * @param format `latlon` ("lat;lon" or "lat,lon"), `lonlat` ("lon;lat") or `json`
 */
export function parsePosition(value: unknown, format: 'latlon' | 'lonlat' | 'json'): ParsedPosition | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    if (format === 'json') {
        let obj: any = value;
        if (typeof value === 'string') {
            try {
                obj = JSON.parse(value);
            } catch {
                return null;
            }
        }
        if (!obj || typeof obj !== 'object') {
            return null;
        }
        let lat: number | null;
        let lon: number | null;
        if (Array.isArray(obj)) {
            // GeoJSON order
            lon = toNumber(obj[0]);
            lat = toNumber(obj[1]);
        } else if (obj.type === 'Point' && Array.isArray(obj.coordinates)) {
            lon = toNumber(obj.coordinates[0]);
            lat = toNumber(obj.coordinates[1]);
        } else {
            lat = toNumber(obj.lat ?? obj.latitude ?? obj.Latitude);
            lon = toNumber(obj.lon ?? obj.lng ?? obj.long ?? obj.longitude ?? obj.Longitude);
        }
        if (lat === null || lon === null || !isValidLatLon(lat, lon)) {
            return null;
        }
        const result: ParsedPosition = { lat, lon };
        const accuracy = toNumber(obj.accuracy ?? obj.acc);
        if (accuracy !== null) {
            result.accuracy = accuracy;
        }
        const alt = toNumber(obj.alt ?? obj.altitude);
        if (alt !== null) {
            result.alt = alt;
        }
        return result;
    }
    if (typeof value !== 'string') {
        return null;
    }
    // "52.5;13.4", "52,5;13,4" (comma decimals) or "52.5,13.4"
    const parts = (value.includes(';') ? value.split(';') : value.split(',')).map(p => toNumber(p));
    if (parts.length < 2 || parts[0] === null || parts[1] === null) {
        return null;
    }
    const lat = format === 'latlon' ? parts[0] : parts[1];
    const lon = format === 'latlon' ? parts[1] : parts[0];
    return isValidLatLon(lat, lon) ? { lat, lon } : null;
}

/** Distance of point p to the segment a-b in meters, in a local flat projection (fine for short segments) */
function segmentDistance(p: LatLon, a: LatLon, b: LatLon): number {
    const cosLat = Math.cos(a.lat * RAD);
    const ax = 0;
    const ay = 0;
    const bx = (b.lon - a.lon) * cosLat * RAD * EARTH_RADIUS;
    const by = (b.lat - a.lat) * RAD * EARTH_RADIUS;
    const px = (p.lon - a.lon) * cosLat * RAD * EARTH_RADIUS;
    const py = (p.lat - a.lat) * RAD * EARTH_RADIUS;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

/**
 * Ramer-Douglas-Peucker simplification. Iterative, so long tracks do not overflow the stack.
 * Points marked with `keep` (e.g. the first point after a gap) are always kept.
 *
 * @param points the track
 * @param tolerance meters
 */
export function simplify<T extends LatLon & { keep?: boolean }>(points: T[], tolerance: number): T[] {
    if (points.length <= 2 || tolerance <= 0) {
        return points.slice();
    }
    const keep = new Uint8Array(points.length);
    keep[0] = 1;
    keep[points.length - 1] = 1;
    // Split at the forced points, so they are never removed
    const ranges: [number, number][] = [];
    let start = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i].keep || i === points.length - 1) {
            keep[i] = 1;
            ranges.push([start, i]);
            start = i;
        }
    }
    while (ranges.length) {
        const [first, last] = ranges.pop()!;
        let maxDist = 0;
        let index = -1;
        for (let i = first + 1; i < last; i++) {
            const d = segmentDistance(points[i], points[first], points[last]);
            if (d > maxDist) {
                maxDist = d;
                index = i;
            }
        }
        if (index !== -1 && maxDist > tolerance) {
            keep[index] = 1;
            ranges.push([first, index], [index, last]);
        }
    }
    return points.filter((_p, i) => keep[i]);
}
