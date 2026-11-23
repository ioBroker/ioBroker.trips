import { distance } from './geo';
import type { Fix } from './tripDetector';

/**
 * Anchor watch for boats, theft watch for cars: an alarm when the object leaves a circle around a fixed position,
 * and when its positions stop coming.
 */
export interface WatchState {
    active: boolean;
    /** Center of the circle: where the anchor was dropped or the car was parked */
    lat: number | null;
    lon: number | null;
    /** Meters */
    radius: number;
    /** Time of the activation */
    since: number | null;
    /** Meters from the center, of the last position */
    distance: number | null;
    /** Meters: the swing circle, the farthest position (single outliers are ignored) */
    maxDistance: number;
    alarm: boolean;
    signalLost: boolean;
    /** Positions outside the circle one after the other */
    outside: number;
    /** Wall clock of the last position */
    lastFix: number | null;
}

export interface WatchSettings {
    /** So many positions one after the other must be outside before the alarm, against GPS jitter */
    confirmFixes: number;
    /** No positions for this long is an alarm too; 0 = off */
    signalLostSeconds: number;
}

export type WatchEvent = 'alarm' | 'signalLost' | 'signalBack' | null;

export function emptyWatch(radius: number): WatchState {
    return {
        active: false,
        lat: null,
        lon: null,
        radius,
        since: null,
        distance: null,
        maxDistance: 0,
        alarm: false,
        signalLost: false,
        outside: 0,
        lastFix: null,
    };
}

export class PositionWatch {
    private st: WatchState;
    /** Distance of the previous position, so that one outlier does not grow the swing circle */
    private previousDistance: number | null = null;

    constructor(
        private readonly settings: WatchSettings,
        defaultRadius: number,
        saved?: Partial<WatchState> | null,
    ) {
        this.st = { ...emptyWatch(defaultRadius), ...(saved || {}) };
        if (!(this.st.radius > 0)) {
            this.st.radius = defaultRadius;
        }
        if (this.st.active && (this.st.lat === null || this.st.lon === null)) {
            this.st.active = false;
        }
    }

    get state(): WatchState {
        return this.st;
    }

    /**
     * Starts watching
     *
     * @param lat center of the circle
     * @param lon center of the circle
     * @param now wall clock
     * @param radius meters, keeps the current radius if not given
     */
    activate(lat: number, lon: number, now: number, radius?: number): void {
        this.st = {
            ...emptyWatch(radius && radius > 0 ? radius : this.st.radius),
            active: true,
            lat,
            lon,
            since: now,
            distance: 0,
            lastFix: now,
        };
        this.previousDistance = null;
    }

    deactivate(): void {
        this.st = { ...emptyWatch(this.st.radius), lat: this.st.lat, lon: this.st.lon };
        this.previousDistance = null;
    }

    /** The user saw the alarm: it comes again if the object stays outside */
    acknowledge(): void {
        this.st.alarm = false;
        this.st.outside = 0;
    }

    /** Moves the center, e.g. to the real position of the anchor */
    setCenter(lat: number, lon: number): void {
        this.st.lat = lat;
        this.st.lon = lon;
        this.st.maxDistance = 0;
        this.st.outside = 0;
        this.previousDistance = null;
    }

    setRadius(radius: number): void {
        if (radius > 0) {
            this.st.radius = radius;
            this.st.outside = 0;
        }
    }

    onFix(fix: Fix, now: number): WatchEvent {
        const st = this.st;
        if (!st.active || st.lat === null || st.lon === null) {
            return null;
        }
        let event: WatchEvent = null;
        st.lastFix = now;
        if (st.signalLost) {
            st.signalLost = false;
            event = 'signalBack';
        }
        const d = distance(st.lat, st.lon, fix.lat, fix.lon);
        st.distance = Math.round(d);
        if (this.previousDistance !== null) {
            st.maxDistance = Math.max(st.maxDistance, Math.round(Math.min(d, this.previousDistance)));
        }
        this.previousDistance = d;

        if (d > st.radius) {
            st.outside++;
            if (st.outside >= this.settings.confirmFixes && !st.alarm) {
                st.alarm = true;
                event = 'alarm';
            }
        } else {
            st.outside = 0;
        }
        return event;
    }

    tick(now: number): WatchEvent {
        const st = this.st;
        if (!st.active || st.signalLost || this.settings.signalLostSeconds <= 0) {
            return null;
        }
        const last = st.lastFix ?? st.since ?? now;
        if (now - last > this.settings.signalLostSeconds * 1000) {
            st.signalLost = true;
            return 'signalLost';
        }
        return null;
    }
}
