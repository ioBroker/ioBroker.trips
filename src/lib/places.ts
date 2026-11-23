import type { PlaceConfig } from '../types';
import { distance } from './geo';

export interface Place {
    name: string;
    lat: number;
    lon: number;
    /** Meters */
    radius: number;
    privacy: boolean;
}

export function parsePlaces(config: PlaceConfig[] | undefined): Place[] {
    const places: Place[] = [];
    for (const item of config || []) {
        const lat = parseFloat(String(item.latitude).replace(',', '.'));
        const lon = parseFloat(String(item.longitude).replace(',', '.'));
        const radius = parseFloat(String(item.radius));
        if (!item.name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
            continue;
        }
        places.push({
            name: item.name.trim(),
            lat,
            lon,
            radius: Number.isFinite(radius) && radius > 0 ? radius : 100,
            privacy: !!item.privacy,
        });
    }
    return places;
}

/** The nearest place that contains the position */
export function findPlace(places: Place[], lat: number, lon: number): Place | null {
    let best: Place | null = null;
    let bestDistance = Infinity;
    for (const place of places) {
        const d = distance(place.lat, place.lon, lat, lon);
        if (d <= place.radius && d < bestDistance) {
            best = place;
            bestDistance = d;
        }
    }
    return best;
}

/** Inside a place whose positions must not be stored */
export function isPrivate(places: Place[], lat: number, lon: number): Place | null {
    for (const place of places) {
        if (place.privacy && distance(place.lat, place.lon, lat, lon) <= place.radius) {
            return place;
        }
    }
    return null;
}

/** Nominatim asks for max. one request per second */
const MIN_INTERVAL = 1100;
const MAX_CACHE = 5000;

/**
 * Reverse geocoding with OpenStreetMap Nominatim, with a cache (~11 m grid) and a rate limit.
 * Only used if enabled in the settings: it sends the positions to openstreetmap.org.
 */
export class Geocoder {
    private cache: Record<string, string> = {};
    private queue: Promise<unknown> = Promise.resolve();
    private lastRequest = 0;
    private changed = false;

    constructor(
        private readonly userAgent: string,
        private readonly language: string,
        private readonly log: ioBroker.Logger,
    ) {}

    load(cache: Record<string, string> | null): void {
        this.cache = cache && typeof cache === 'object' ? cache : {};
    }

    /** The cache, if it changed since the last call */
    takeChanges(): Record<string, string> | null {
        if (!this.changed) {
            return null;
        }
        this.changed = false;
        const keys = Object.keys(this.cache);
        if (keys.length > MAX_CACHE) {
            for (const key of keys.slice(0, keys.length - MAX_CACHE)) {
                delete this.cache[key];
            }
        }
        return this.cache;
    }

    reverse(lat: number, lon: number): Promise<string | null> {
        const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        if (key in this.cache) {
            return Promise.resolve(this.cache[key] || null);
        }
        const job = this.queue.then(() => this.request(key, lat, lon));
        this.queue = job.catch(() => null);
        return job;
    }

    private async request(key: string, lat: number, lon: number): Promise<string | null> {
        if (key in this.cache) {
            return this.cache[key] || null;
        }
        const wait = this.lastRequest + MIN_INTERVAL - Date.now();
        if (wait > 0) {
            await new Promise(resolve => setTimeout(resolve, wait));
        }
        this.lastRequest = Date.now();
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`;
            const response = await fetch(url, {
                headers: { 'User-Agent': this.userAgent, 'Accept-Language': this.language },
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) {
                this.log.debug(`Nominatim: HTTP ${response.status}`);
                return null;
            }
            const json: any = await response.json();
            const text = formatAddress(json);
            // remember also "nothing here" (open sea), so it is not asked again
            this.cache[key] = text || '';
            this.changed = true;
            return text;
        } catch (e) {
            this.log.debug(`Nominatim: ${e.message}`);
            return null;
        }
    }
}

/** "Street 1, City" from a Nominatim answer */
export function formatAddress(json: any): string | null {
    if (!json || json.error) {
        return null;
    }
    const a = json.address || {};
    const street = a.road || a.pedestrian || a.footway || a.path || a.square || a.marina || a.harbour;
    const streetPart = street ? (a.house_number ? `${street} ${a.house_number}` : street) : json.name || '';
    const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.county || '';
    const parts = [streetPart, city].filter(p => !!p);
    if (parts.length) {
        return parts.join(', ');
    }
    if (typeof json.display_name === 'string') {
        return json.display_name.split(',').slice(0, 2).join(',').trim() || null;
    }
    return null;
}
