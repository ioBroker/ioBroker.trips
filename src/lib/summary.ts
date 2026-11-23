import type { TripReason } from './tripDetector';

export interface SummaryStop {
    start: number;
    end: number;
    /** null after the retention or inside a privacy zone */
    lat: number | null;
    lon: number | null;
    place?: string;
}

/** What is kept about a trip forever (the track itself may be deleted by the retention) */
export interface TripSummary {
    /** `YYYYMMDD-HHMMSS` of the start in local time, unique per object */
    id: string;
    object: string;
    start: number;
    end: number;
    /** Seconds */
    duration: number;
    /** Seconds */
    movingTime: number;
    /** Meters */
    distance: number;
    /** m/s over the moving time */
    avgSpeed: number;
    /** m/s */
    maxSpeed: number;
    /** Meters, only with altitude data */
    elevationGain?: number;
    /** Seconds with ignition/engine on */
    engineTime?: number;
    startLat: number | null;
    startLon: number | null;
    endLat: number | null;
    endLon: number | null;
    /** Place or address of the start */
    from?: string;
    /** Place or address of the destination */
    to?: string;
    stops: SummaryStop[];
    gaps: number;
    points: number;
    reason: TripReason;
    consumption?: number;
    consumptionUnit?: string;
    cost?: number;
    currency?: string;
    /** kg */
    co2?: number;
    /** The track file exists (false after the retention) */
    track: boolean;
}

export type Period = 'today' | 'week' | 'month' | 'year' | 'total';
export const PERIODS: Period[] = ['today', 'week', 'month', 'year', 'total'];

export interface PeriodStats {
    /** Meters */
    distance: number;
    trips: number;
    /** Seconds */
    duration: number;
    /** Seconds */
    movingTime: number;
    /** Seconds */
    engineTime: number;
    /** Meters */
    longestTrip: number;
    /** m/s */
    maxSpeed: number;
    consumption: number;
    cost: number;
    /** kg */
    co2: number;
}

/** Start of the period in local time */
export function periodStart(period: Period, now: Date): number {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (period) {
        case 'today':
            return d.getTime();
        case 'week': {
            // weeks start on Monday
            const day = (d.getDay() + 6) % 7;
            d.setDate(d.getDate() - day);
            return d.getTime();
        }
        case 'month':
            return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        case 'year':
            return new Date(now.getFullYear(), 0, 1).getTime();
        default:
            return 0;
    }
}

/** A trip belongs to the period in which it started */
export function aggregate(trips: TripSummary[], from: number): PeriodStats {
    const stats: PeriodStats = {
        distance: 0,
        trips: 0,
        duration: 0,
        movingTime: 0,
        engineTime: 0,
        longestTrip: 0,
        maxSpeed: 0,
        consumption: 0,
        cost: 0,
        co2: 0,
    };
    for (const trip of trips) {
        if (trip.start < from) {
            continue;
        }
        stats.trips++;
        stats.distance += trip.distance;
        stats.duration += trip.duration;
        stats.movingTime += trip.movingTime;
        stats.engineTime += trip.engineTime || 0;
        stats.longestTrip = Math.max(stats.longestTrip, trip.distance);
        stats.maxSpeed = Math.max(stats.maxSpeed, trip.maxSpeed);
        stats.consumption += trip.consumption || 0;
        stats.cost += trip.cost || 0;
        stats.co2 += trip.co2 || 0;
    }
    return stats;
}

function pad(n: number): string {
    return n.toString().padStart(2, '0');
}

export function tripId(start: number): string {
    const d = new Date(start);
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** `1:05` for 65 minutes */
export function formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

export function round(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
