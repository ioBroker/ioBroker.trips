import type { AdapterInstance } from '@iobroker/adapter-core';
import type { TrackPoint } from './tripDetector';
import type { TripSummary } from './summary';

/**
 * Trips are stored in the file storage of the instance (`trips.0/...`), not in states:
 *
 * - `<object>/trips-<year>.json` - the summaries of the trips that started in that year
 * - `<object>/tracks/<year>/<id>.geojson` and `.gpx` - the simplified tracks
 * - `<object>/current.json` - the running trip, so it survives a restart
 * - `geocache.json` - the addresses from the reverse geocoding
 *
 * The web adapter serves the files under `/trips.0/<path>`.
 */
export class TripStore {
    constructor(private readonly adapter: AdapterInstance) {}

    private get ns(): string {
        return this.adapter.namespace;
    }

    async readText(path: string): Promise<string | null> {
        try {
            const result = await this.adapter.readFileAsync(this.ns, path);
            if (!result?.file) {
                return null;
            }
            return typeof result.file === 'string' ? result.file : result.file.toString('utf8');
        } catch {
            return null;
        }
    }

    async readJson<T>(path: string): Promise<T | null> {
        const text = await this.readText(path);
        if (!text) {
            return null;
        }
        try {
            return JSON.parse(text) as T;
        } catch (e) {
            this.adapter.log.warn(`Cannot parse ${path}: ${e.message}`);
            return null;
        }
    }

    async writeText(path: string, text: string): Promise<void> {
        await this.adapter.writeFileAsync(this.ns, path, text);
    }

    async writeJson(path: string, data: unknown): Promise<void> {
        await this.writeText(path, JSON.stringify(data));
    }

    async delete(path: string): Promise<void> {
        try {
            await this.adapter.delFileAsync(this.ns, path);
        } catch {
            // already gone
        }
    }

    static trackPath(object: string, summary: TripSummary, ext: 'geojson' | 'gpx'): string {
        return `${object}/tracks/${new Date(summary.start).getFullYear()}/${summary.id}.${ext}`;
    }

    /** All summaries of the object, sorted by start */
    async loadSummaries(object: string): Promise<TripSummary[]> {
        let files: { file: string; isDir: boolean }[] = [];
        try {
            files = (await this.adapter.readDirAsync(this.ns, object)) || [];
        } catch {
            return [];
        }
        const trips: TripSummary[] = [];
        for (const entry of files) {
            if (!entry.isDir && /^trips-\d{4}\.json$/.test(entry.file)) {
                const list = await this.readJson<TripSummary[]>(`${object}/${entry.file}`);
                if (Array.isArray(list)) {
                    trips.push(...list);
                }
            }
        }
        return trips.sort((a, b) => a.start - b.start);
    }

    /** Writes the summaries of one year */
    async saveYear(object: string, year: number, trips: TripSummary[]): Promise<void> {
        const list = trips.filter(t => new Date(t.start).getFullYear() === year);
        await this.writeJson(`${object}/trips-${year}.json`, list);
    }
}

export type { TrackPoint };
