import type { TripSummary } from './summary';
import { text } from './texts';

/** Logbook (Fahrtenbuch): kind, purpose and partner of each trip; every change after the trip is recorded */
export type TripCategory = 'private' | 'business' | 'commute';
export const CATEGORIES: TripCategory[] = ['private', 'business', 'commute'];

export const LOGBOOK_FIELDS = ['category', 'purpose', 'partner', 'driver'] as const;
export type LogbookField = (typeof LOGBOOK_FIELDS)[number];

/** One change of a trip after it was recorded, kept forever */
export interface TripChange {
    /** When it was changed */
    ts: number;
    /** ID of the trip */
    id: string;
    field: LogbookField;
    old: string | null;
    new: string | null;
    /** Who changed it: `state`, `message` or the sender of the message */
    source: string;
}

export function normalizeCategory(value: unknown): TripCategory | null {
    if (typeof value !== 'string') {
        return null;
    }
    const lower = value.trim().toLowerCase();
    return (CATEGORIES as string[]).includes(lower) ? (lower as TripCategory) : null;
}

function normalizeText(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
        return null;
    }
    const result = String(value).trim().substring(0, 500);
    return result || null;
}

/**
 * Sets logbook fields of a trip
 *
 * @param summary the trip, changed in place
 * @param values the new values; `null` or '' clears a field, missing fields stay
 * @param ts time of the change
 * @param source who changed it
 * @returns the changes, empty if nothing changed
 */
export function applyChanges(
    summary: TripSummary,
    values: Partial<Record<LogbookField, unknown>>,
    ts: number,
    source: string,
): TripChange[] {
    const changes: TripChange[] = [];
    for (const field of LOGBOOK_FIELDS) {
        if (!(field in values)) {
            continue;
        }
        const raw = values[field];
        let value: string | null;
        if (field === 'category') {
            value = raw === null || raw === '' ? null : normalizeCategory(raw);
            if (value === null && raw !== null && raw !== '') {
                throw new Error(`Invalid category ${JSON.stringify(raw)}, allowed: ${CATEGORIES.join(', ')}`);
            }
        } else {
            value = normalizeText(raw);
        }
        const old = summary[field] ?? null;
        if (old === value) {
            continue;
        }
        if (value === null) {
            delete summary[field];
        } else if (field === 'category') {
            summary.category = value as TripCategory;
        } else {
            summary[field] = value;
        }
        changes.push({ ts, id: summary.id, field, old, new: value, source });
    }
    if (changes.length) {
        summary.changes = (summary.changes || 0) + changes.length;
    }
    return changes;
}

export interface CsvOptions {
    lang: ioBroker.Languages;
    /** Meters per distance unit of the object */
    meters: number;
    unit: string;
    formatNumber: (value: number, digits: number) => string;
}

function csvField(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }
    const s = String(value);
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(fields: (string | number | null | undefined)[]): string {
    return fields.map(csvField).join(';');
}

function locale(lang: ioBroker.Languages): string {
    return lang === 'zh-cn' ? 'zh-CN' : lang;
}

function date(ts: number, lang: ioBroker.Languages): string {
    return new Date(ts).toLocaleDateString(locale(lang), { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function time(ts: number, lang: ioBroker.Languages): string {
    return new Date(ts).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });
}

function dateTime(ts: number, lang: ioBroker.Languages): string {
    return `${date(ts, lang)} ${time(ts, lang)}`;
}

/** Byte order mark: Excel reads the file as UTF-8 only with it */
const BOM = String.fromCharCode(0xfeff);

/** With the BOM; no `sep=` line, Excel would ignore the BOM then */
function csvFile(lines: string[]): string {
    return `${BOM}${lines.join('\r\n')}\r\n`;
}

/**
 * The logbook as CSV (separated by `;`, as Excel expects it in most countries)
 *
 * @param trips the trips, oldest first
 * @param options language and units
 */
export function logbookCsv(trips: TripSummary[], options: CsvOptions): string {
    const { lang, meters, unit, formatNumber } = options;
    const t = (key: string): string => text(lang, key);
    const lines = [
        csvLine([
            t('date'),
            t('start'),
            t('end'),
            `${t('odometerStart')} (${unit})`,
            `${t('odometerEnd')} (${unit})`,
            `${t('distance')} (${unit})`,
            t('from'),
            t('to'),
            t('stops'),
            t('category'),
            t('purpose'),
            t('partner'),
            t('driver'),
            t('changes'),
        ]),
    ];
    for (const trip of trips) {
        const stops = trip.stops
            .map(stop => {
                const where =
                    stop.place ||
                    (stop.lat !== null && stop.lon !== null ? `${stop.lat.toFixed(4)}, ${stop.lon.toFixed(4)}` : '');
                return where ? `${where} (${time(stop.start, lang)}-${time(stop.end, lang)})` : '';
            })
            .filter(Boolean)
            .join(', ');
        lines.push(
            csvLine([
                date(trip.start, lang),
                time(trip.start, lang),
                date(trip.end, lang) === date(trip.start, lang) ? time(trip.end, lang) : dateTime(trip.end, lang),
                trip.odometerStart !== undefined ? formatNumber(trip.odometerStart, 0) : '',
                trip.odometerEnd !== undefined ? formatNumber(trip.odometerEnd, 0) : '',
                formatNumber(trip.distance / meters, 1),
                trip.from ?? '',
                trip.to ?? '',
                stops,
                trip.category ? t(trip.category) : '',
                trip.purpose ?? '',
                trip.partner ?? '',
                trip.driver ?? '',
                trip.changes || 0,
            ]),
        );
    }
    return csvFile(lines);
}

/**
 * The changes after the trips were recorded, as CSV
 *
 * @param changes oldest first
 * @param lang language of the texts
 */
export function changesCsv(changes: TripChange[], lang: ioBroker.Languages): string {
    const t = (key: string): string => text(lang, key);
    const value = (field: LogbookField, v: string | null): string => (field === 'category' && v ? t(v) : (v ?? ''));
    const lines = [csvLine([t('changedAt'), t('trip'), t('field'), t('oldValue'), t('newValue'), 'Source'])];
    for (const change of changes) {
        lines.push(
            csvLine([
                dateTime(change.ts, lang),
                change.id,
                t(change.field),
                value(change.field, change.old),
                value(change.field, change.new),
                change.source,
            ]),
        );
    }
    return csvFile(lines);
}
