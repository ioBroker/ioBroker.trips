import { distance, isValidLatLon, simplify } from './geo';

/** One position after the fusion of the sources */
export interface Fix {
    /** Time of the position in ms */
    ts: number;
    lat: number;
    lon: number;
    /** m/s, only if the source reports it (Doppler speed is much better than a derived one) */
    speed?: number | null;
    /** Meters */
    accuracy?: number | null;
    /** Meters */
    alt?: number | null;
    /** Label of the source */
    source?: string;
}

export interface TrackPoint {
    ts: number;
    lat: number;
    lon: number;
    /** m/s */
    speed?: number;
    alt?: number;
    /** First point after a gap: the way before it is unknown, a track export starts a new segment */
    gap?: boolean;
}

export interface TripStop {
    start: number;
    end: number;
    lat: number;
    lon: number;
}

export type TripReason = 'movement' | 'ignition' | 'manual';

export interface ActiveTrip {
    start: number;
    /** Time of the last position in the trip */
    last: number;
    /** Meters */
    distance: number;
    /** m/s */
    maxSpeed: number;
    /** Meters, only with altitude data */
    elevationGain: number;
    /** ms with the ignition/engine on */
    engineTime: number;
    points: TrackPoint[];
    stops: TripStop[];
    gaps: number;
    reason: TripReason;
}

export interface FinishedTrip extends ActiveTrip {
    end: number;
    /** ms without the stops */
    movingTime: number;
}

export interface DetectorSettings {
    /** m/s */
    startSpeed: number;
    startSeconds: number;
    /** Meters */
    startDistance: number;
    /** Meters */
    stopRadius: number;
    minStopSeconds: number;
    tripEndSeconds: number;
    /** Meters */
    minDistance: number;
    /** Meters */
    maxAccuracy: number;
    /** m/s */
    maxSpeed: number;
    useIgnition: boolean;
    /** The ignition may be off this long without ending the trip (start-stop, refuelling) */
    ignitionOffSeconds: number;
    /** With the ignition on, but no positions any more, the trip ends after this time */
    maxGapSeconds: number;
}

export type FixResult = 'accepted' | 'invalid' | 'inaccurate' | 'old' | 'outlier';

/** Seconds without positions after which the next point starts a new track segment (phones report every few minutes) */
const GAP_SECONDS = 900;
/** Max. points kept in the memory for one trip, more are simplified */
const MAX_POINTS = 50000;
/** Max. positions kept while waiting for the start of a trip */
const MAX_PENDING = 2000;
/** Altitude changes smaller than this are noise */
const ELEVATION_HYSTERESIS = 10;
/** Without a speed of the source, the max. speed is measured over at least this time, so jitter averages out */
const MAX_SPEED_WINDOW = 10000;
/** A derived speed is kept this long while the object did not move far enough to measure again */
const SPEED_HOLD = 30000;

interface SavedFix {
    ts: number;
    lat: number;
    lon: number;
}

/** Everything the detector knows, JSON-serializable so that a running trip survives a restart */
export interface DetectorState {
    lastFix: Fix | null;
    /** Wall clock of the last accepted position */
    lastReceived: number;
    /** Current speed estimation in m/s */
    speed: number;
    speedRef: SavedFix | null;
    /** Recent positions for the max. speed: the first one is the newest that is at least MAX_SPEED_WINDOW old */
    recent: SavedFix[];
    /** Up to three positions that do not fit to the last one */
    suspects: Fix[];

    // --- outside a trip ---
    /** Parking position */
    restAnchor: SavedFix | null;
    /** Last position near the parking position */
    lastRestFix: SavedFix | null;
    /** Positions since the object left the parking position, replayed when the trip starts */
    pending: Fix[];
    movingSince: number | null;

    // --- inside a trip ---
    trip: ActiveTrip | null;
    /** Last point that counted for the distance */
    anchor: TrackPoint | null;
    /** Where the current standing began */
    stopAnchor: SavedFix | null;
    stopAnchorDistance: number;
    stopAnchorPoints: number;
    lastInside: SavedFix | null;
    /** Reference altitude for the elevation gain */
    altRef: number | null;

    // --- ignition / manual ---
    ignition: boolean | null;
    engineOnSince: number | null;
    ignitionOffAt: number | null;
    ignitionOffWall: number | null;
    manual: boolean;
}

export interface LiveData {
    active: boolean;
    start: number | null;
    /** Meters */
    distance: number;
    /** ms */
    duration: number;
    /** m/s */
    speed: number;
    /** m/s */
    maxSpeed: number;
    /** m/s over the moving time */
    avgSpeed: number;
    lat: number | null;
    lon: number | null;
}

function emptyState(): DetectorState {
    return {
        lastFix: null,
        lastReceived: 0,
        speed: 0,
        speedRef: null,
        recent: [],
        suspects: [],
        restAnchor: null,
        lastRestFix: null,
        pending: [],
        movingSince: null,
        trip: null,
        anchor: null,
        stopAnchor: null,
        stopAnchorDistance: 0,
        stopAnchorPoints: 0,
        lastInside: null,
        altRef: null,
        ignition: null,
        engineOnSince: null,
        ignitionOffAt: null,
        ignitionOffWall: null,
        manual: false,
    };
}

function short(fix: Fix | SavedFix): SavedFix {
    return { ts: fix.ts, lat: fix.lat, lon: fix.lon };
}

/**
 * Turns a stream of positions (plus optionally ignition and a manual switch) into trips.
 *
 * Pure logic without timers or I/O: the caller passes the wall clock and calls `tick()` periodically,
 * so the detector can be tested with synthetic tracks.
 */
export class TripDetector {
    private st: DetectorState;

    constructor(
        private readonly settings: DetectorSettings,
        private readonly events: {
            onStart?: (trip: ActiveTrip) => void;
            onEnd?: (trip: FinishedTrip) => void;
        } = {},
        saved?: DetectorState | null,
    ) {
        this.st = saved ? { ...emptyState(), ...saved } : emptyState();
    }

    get state(): DetectorState {
        return this.st;
    }

    get trip(): ActiveTrip | null {
        return this.st.trip;
    }

    get ignition(): boolean | null {
        return this.st.ignition;
    }

    get manual(): boolean {
        return this.st.manual;
    }

    get lastFix(): Fix | null {
        return this.st.lastFix;
    }

    /** Trips are controlled by the ignition, as long as the ignition is known */
    private get ignitionMode(): boolean {
        return this.settings.useIgnition && this.st.ignition !== null;
    }

    processFix(fix: Fix, now: number = Date.now()): FixResult {
        const s = this.settings;
        const st = this.st;
        if (!isValidLatLon(fix.lat, fix.lon) || !Number.isFinite(fix.ts)) {
            return 'invalid';
        }
        if (typeof fix.accuracy === 'number' && fix.accuracy > s.maxAccuracy) {
            return 'inaccurate';
        }
        const last = st.lastFix;
        if (last && fix.ts <= last.ts) {
            return 'old';
        }

        let relocated = false;
        if (last) {
            const d = distance(last.lat, last.lon, fix.lat, fix.lon);
            const dt = (fix.ts - last.ts) / 1000;
            if (this.isJump(d, dt, fix)) {
                st.suspects.push(fix);
                if (st.suspects.length < 3) {
                    return 'outlier';
                }
                // Three positions in a row agree with each other, but not with the last good one:
                // the object was moved without positions (ferry, trailer, receiver off).
                const suspects = st.suspects;
                let consistent = true;
                for (let i = 1; i < suspects.length; i++) {
                    const dd = distance(suspects[i - 1].lat, suspects[i - 1].lon, suspects[i].lat, suspects[i].lon);
                    if (this.isJump(dd, (suspects[i].ts - suspects[i - 1].ts) / 1000, suspects[i])) {
                        consistent = false;
                        break;
                    }
                }
                if (!consistent) {
                    st.suspects = suspects.slice(-2);
                    return 'outlier';
                }
                relocated = true;
            }
        }
        st.suspects = [];

        const timeGap = !!last && fix.ts - last.ts > GAP_SECONDS * 1000;
        this.updateSpeed(fix, relocated);
        st.lastFix = fix;
        st.lastReceived = now;

        if (st.trip) {
            this.addToTrip(fix, relocated, timeGap);
        } else {
            this.checkStart(fix, relocated);
        }
        return 'accepted';
    }

    private isJump(d: number, dt: number, fix: Fix): boolean {
        const tolerance = Math.max(50, 3 * (fix.accuracy ?? 0));
        if (d <= tolerance) {
            return false;
        }
        return dt <= 0 || d / dt > this.settings.maxSpeed;
    }

    private updateSpeed(fix: Fix, relocated: boolean): void {
        const st = this.st;
        if (typeof fix.speed === 'number' && Number.isFinite(fix.speed)) {
            st.speed = Math.max(0, fix.speed);
            st.speedRef = short(fix);
            return;
        }
        if (!st.speedRef || relocated) {
            st.speedRef = short(fix);
            st.speed = 0;
            return;
        }
        const d = distance(st.speedRef.lat, st.speedRef.lon, fix.lat, fix.lon);
        const dt = fix.ts - st.speedRef.ts;
        const threshold = Math.max(this.settings.minDistance, fix.accuracy ?? 0);
        if (d >= threshold && dt > 0) {
            st.speed = d / (dt / 1000);
            st.speedRef = short(fix);
        } else if (dt > SPEED_HOLD) {
            // Did not get far enough within the hold time: (almost) standing
            st.speed = d / (dt / 1000);
            if (d < threshold) {
                st.speed = Math.min(st.speed, this.settings.startSpeed / 2);
            }
        }
    }

    /** A speed measured by the source or over a long enough time, good enough for the max. speed */
    private measuredSpeed(fix: Fix, relocated: boolean): number | null {
        const st = this.st;
        if (relocated) {
            st.recent = [short(fix)];
            return null;
        }
        st.recent.push(short(fix));
        while (st.recent.length >= 2 && fix.ts - st.recent[1].ts >= MAX_SPEED_WINDOW) {
            st.recent.shift();
        }
        if (typeof fix.speed === 'number' && Number.isFinite(fix.speed)) {
            return fix.speed;
        }
        const ref = st.recent[0];
        const dt = fix.ts - ref.ts;
        if (dt < MAX_SPEED_WINDOW) {
            return null;
        }
        const d = distance(ref.lat, ref.lon, fix.lat, fix.lon);
        return d >= this.settings.minDistance ? d / (dt / 1000) : null;
    }

    private checkStart(fix: Fix, relocated: boolean): void {
        const s = this.settings;
        const st = this.st;
        if (!st.restAnchor || relocated) {
            st.restAnchor = short(fix);
            st.lastRestFix = short(fix);
            st.pending = [];
            st.movingSince = null;
            return;
        }
        const fromRest = distance(st.restAnchor.lat, st.restAnchor.lon, fix.lat, fix.lon);
        const moving = st.speed >= s.startSpeed;
        if (fromRest <= s.stopRadius && !moving) {
            st.lastRestFix = short(fix);
            st.pending = [];
            st.movingSince = null;
            return;
        }
        if (moving) {
            st.movingSince ??= fix.ts;
        } else {
            st.movingSince = null;
        }
        if (this.ignitionMode) {
            // the ignition decides, but keep the way since the parking position for the moment it is switched on
            this.addPending(fix);
            return;
        }
        const sustained =
            st.movingSince !== null &&
            fix.ts - st.movingSince >= s.startSeconds * 1000 &&
            fromRest >= 2 * s.minDistance;
        if (sustained || fromRest >= s.startDistance) {
            const pending = st.pending;
            this.startTrip('movement', st.lastRestFix?.ts ?? fix.ts, st.restAnchor);
            for (const p of pending) {
                this.addToTrip(p, false, false);
            }
            this.addToTrip(fix, false, false);
        } else {
            this.addPending(fix);
        }
    }

    private addPending(fix: Fix): void {
        this.st.pending.push(fix);
        if (this.st.pending.length > MAX_PENDING) {
            this.st.pending.shift();
        }
    }

    private startTrip(reason: TripReason, start: number, origin: SavedFix | null): void {
        const st = this.st;
        const trip: ActiveTrip = {
            start,
            last: start,
            distance: 0,
            maxSpeed: 0,
            elevationGain: 0,
            engineTime: 0,
            points: [],
            stops: [],
            gaps: 0,
            reason,
        };
        st.trip = trip;
        st.pending = [];
        st.movingSince = null;
        st.anchor = null;
        st.stopAnchor = null;
        st.lastInside = null;
        st.stopAnchorDistance = 0;
        st.stopAnchorPoints = 0;
        st.altRef = null;
        if (origin) {
            const point: TrackPoint = { ts: start, lat: origin.lat, lon: origin.lon };
            trip.points.push(point);
            st.anchor = point;
            st.stopAnchor = { ts: start, lat: origin.lat, lon: origin.lon };
            st.stopAnchorPoints = 1;
        }
        if (st.ignition && st.engineOnSince === null) {
            st.engineOnSince = start;
        }
        this.events.onStart?.(trip);
    }

    private addToTrip(fix: Fix, relocated: boolean, timeGap: boolean): void {
        const s = this.settings;
        const st = this.st;
        const trip = st.trip!;
        trip.last = Math.max(trip.last, fix.ts);

        // --- stops ---
        const movingBySource = typeof fix.speed === 'number' && fix.speed >= s.startSpeed;
        const inside =
            !relocated &&
            !!st.stopAnchor &&
            !movingBySource &&
            distance(st.stopAnchor.lat, st.stopAnchor.lon, fix.lat, fix.lon) <= s.stopRadius;
        if (!inside) {
            this.closeStop();
        }

        // --- distance ---
        const point: TrackPoint = { ts: fix.ts, lat: fix.lat, lon: fix.lon };
        if (typeof fix.speed === 'number') {
            point.speed = Math.round(fix.speed * 100) / 100;
        }
        if (typeof fix.alt === 'number') {
            point.alt = Math.round(fix.alt * 10) / 10;
        }
        if (!st.anchor) {
            trip.points.push(point);
            st.anchor = point;
        } else if (relocated) {
            point.gap = true;
            trip.gaps++;
            trip.points.push(point);
            st.anchor = point;
        } else {
            const d = distance(st.anchor.lat, st.anchor.lon, fix.lat, fix.lon);
            if (d >= Math.max(s.minDistance, fix.accuracy ?? 0)) {
                trip.distance += d;
                if (timeGap) {
                    point.gap = true;
                    trip.gaps++;
                }
                trip.points.push(point);
                st.anchor = point;
            }
        }
        if (trip.points.length > MAX_POINTS) {
            trip.points = simplify(
                trip.points.map(p => ({ ...p, keep: p.gap })),
                3,
            ).map(({ keep: _keep, ...p }) => p);
            st.stopAnchorPoints = trip.points.length;
            st.stopAnchorDistance = trip.distance;
        }

        // --- max. speed ---
        const measured = this.measuredSpeed(fix, relocated);
        if (measured !== null && measured <= s.maxSpeed && measured > trip.maxSpeed) {
            trip.maxSpeed = measured;
        }

        // --- elevation ---
        if (typeof fix.alt === 'number' && Number.isFinite(fix.alt)) {
            if (st.altRef === null) {
                st.altRef = fix.alt;
            } else if (fix.alt > st.altRef + ELEVATION_HYSTERESIS) {
                trip.elevationGain += fix.alt - st.altRef;
                st.altRef = fix.alt;
            } else if (fix.alt < st.altRef - ELEVATION_HYSTERESIS) {
                st.altRef = fix.alt;
            }
        }

        if (inside) {
            st.lastInside = short(fix);
            if (this.endsByStanding(fix.ts - st.stopAnchor!.ts)) {
                this.endTrip(st.stopAnchor!.ts, true);
            }
        } else {
            st.stopAnchor = short(fix);
            st.stopAnchorDistance = trip.distance;
            st.stopAnchorPoints = trip.points.length;
            st.lastInside = null;
        }
    }

    /** Standing that long ends the trip, unless the ignition or the manual switch holds it */
    private endsByStanding(standingMs: number): boolean {
        if (this.st.manual || this.ignitionMode) {
            return false;
        }
        return standingMs >= this.settings.tripEndSeconds * 1000;
    }

    /** The object left the stop radius: a long enough standing becomes a stop, its GPS jitter is removed */
    private closeStop(): void {
        const st = this.st;
        const trip = st.trip;
        if (!trip || !st.stopAnchor || !st.lastInside) {
            return;
        }
        const duration = st.lastInside.ts - st.stopAnchor.ts;
        if (duration >= this.settings.minStopSeconds * 1000) {
            trip.stops.push({
                start: st.stopAnchor.ts,
                end: st.lastInside.ts,
                lat: st.stopAnchor.lat,
                lon: st.stopAnchor.lon,
            });
            this.truncateToStopAnchor();
        }
    }

    /** Removes the points recorded while standing at the stop anchor */
    private truncateToStopAnchor(): void {
        const st = this.st;
        const trip = st.trip!;
        if (!st.stopAnchor) {
            return;
        }
        if (trip.points.length > st.stopAnchorPoints) {
            trip.points.length = Math.max(st.stopAnchorPoints, 0);
            trip.distance = st.stopAnchorDistance;
        }
        const lastPoint = trip.points[trip.points.length - 1];
        if (!lastPoint || lastPoint.ts < st.stopAnchor.ts) {
            const point: TrackPoint = { ts: st.stopAnchor.ts, lat: st.stopAnchor.lat, lon: st.stopAnchor.lon };
            trip.points.push(point);
            st.anchor = point;
        } else {
            st.anchor = lastPoint;
        }
    }

    /**
     * @param end time of the end
     * @param atStop the object stands at the stop anchor: remove the jitter recorded there
     */
    private endTrip(end: number, atStop: boolean): void {
        const st = this.st;
        const trip = st.trip;
        if (!trip) {
            return;
        }
        if (atStop) {
            this.truncateToStopAnchor();
        } else if (st.stopAnchor && st.lastInside) {
            // ended by ignition or by hand while standing: the standing at the end is a stop, if long enough
            const standing = Math.min(end, st.lastInside.ts) - st.stopAnchor.ts;
            if (standing >= this.settings.minStopSeconds * 1000) {
                trip.stops.push({
                    start: st.stopAnchor.ts,
                    end,
                    lat: st.stopAnchor.lat,
                    lon: st.stopAnchor.lon,
                });
                this.truncateToStopAnchor();
            }
        }
        end = Math.max(end, trip.start);
        if (st.engineOnSince !== null) {
            trip.engineTime += Math.max(0, end - Math.max(st.engineOnSince, trip.start));
            st.engineOnSince = st.ignition ? end : null;
        }
        // points after the end (e.g. while the ignition was already off) do not belong to the trip
        while (trip.points.length > 1 && trip.points[trip.points.length - 1].ts > end) {
            trip.points.pop();
        }
        const stopped = trip.stops.reduce((sum, stop) => sum + Math.max(0, Math.min(stop.end, end) - stop.start), 0);
        const finished: FinishedTrip = {
            ...trip,
            end,
            last: Math.min(trip.last, end),
            movingTime: Math.max(0, end - trip.start - stopped),
        };
        const lastPoint = trip.points[trip.points.length - 1] ?? st.lastFix;
        st.trip = null;
        st.anchor = null;
        st.stopAnchor = null;
        st.lastInside = null;
        st.ignitionOffAt = null;
        st.ignitionOffWall = null;
        st.movingSince = null;
        st.pending = [];
        st.restAnchor = lastPoint ? short(lastPoint) : null;
        st.lastRestFix = st.restAnchor;
        this.events.onEnd?.(finished);
    }

    /**
     * Ignition or engine state of the object.
     *
     * @param on ignition on
     * @param ts time of the change
     * @param now wall clock
     */
    setIgnition(on: boolean, ts: number, now: number = Date.now()): void {
        const st = this.st;
        const previous = st.ignition;
        st.ignition = on;
        if (on && previous !== true) {
            st.engineOnSince = ts;
        } else if (!on && previous === true && st.engineOnSince !== null) {
            if (st.trip) {
                st.trip.engineTime += Math.max(0, ts - Math.max(st.engineOnSince, st.trip.start));
            }
            st.engineOnSince = null;
        }
        if (!this.settings.useIgnition) {
            return;
        }
        if (on) {
            st.ignitionOffAt = null;
            st.ignitionOffWall = null;
            if (!st.trip && previous !== true) {
                // Positions that came before the ignition event (latency) belong to the trip: start at the parking
                // position then. Otherwise start at the last position, if it is recent.
                const pending = st.pending.filter(p => p.ts >= ts);
                let origin: SavedFix | null = null;
                if (pending.length) {
                    origin = st.lastRestFix ?? pending[0];
                } else if (st.lastFix && now - st.lastReceived < 300000) {
                    origin = st.lastFix;
                }
                this.startTrip('ignition', ts, origin);
                for (const p of pending) {
                    this.addToTrip(p, false, false);
                }
            }
        } else if (previous !== false && st.trip && !st.manual) {
            st.ignitionOffAt = ts;
            st.ignitionOffWall = now;
            if (this.settings.ignitionOffSeconds <= 0) {
                this.endTrip(ts, false);
            }
        }
    }

    /** Manual trip: `true` starts a trip (if none runs) and holds it, `false` ends it */
    setManual(on: boolean, now: number = Date.now()): void {
        const st = this.st;
        if (on) {
            st.manual = true;
            if (!st.trip) {
                const origin = st.lastFix && now - st.lastReceived < 300000 ? st.lastFix : null;
                this.startTrip('manual', now, origin);
            }
        } else {
            st.manual = false;
            if (st.trip) {
                this.endTrip(Math.max(now, st.trip.start), false);
            }
        }
    }

    /** Ends the running trip now (button): at the last position, or now if there was none in the trip */
    finish(now: number = Date.now()): void {
        const trip = this.st.trip;
        this.st.manual = false;
        if (trip) {
            this.endTrip(trip.last > trip.start ? Math.min(now, trip.last) : now, false);
        }
    }

    /** Time based decisions: call every few seconds */
    tick(now: number = Date.now()): void {
        const s = this.settings;
        const st = this.st;
        const trip = st.trip;
        if (!trip || st.manual) {
            return;
        }
        if (this.ignitionMode) {
            if (st.ignition === false && st.ignitionOffAt !== null && st.ignitionOffWall !== null) {
                if (now - st.ignitionOffWall >= s.ignitionOffSeconds * 1000) {
                    this.endTrip(st.ignitionOffAt, false);
                }
            } else if (st.lastReceived && now - st.lastReceived >= s.maxGapSeconds * 1000) {
                // ignition stuck on, but the device is gone
                this.endTrip(trip.last, false);
            } else if (!st.lastReceived && now - trip.start >= s.maxGapSeconds * 1000) {
                this.endTrip(trip.start, false);
            }
            return;
        }
        if (!st.lastFix || !st.lastReceived) {
            if (now - trip.start >= s.tripEndSeconds * 1000) {
                this.endTrip(trip.start, false);
            }
            return;
        }
        // Standing time: recorded standing + the time without positions since then
        const anchorTs = st.stopAnchor?.ts ?? st.lastFix.ts;
        const silence = now - st.lastReceived;
        const standing = st.lastFix.ts - anchorTs + silence;
        if (standing >= s.tripEndSeconds * 1000) {
            this.endTrip(st.stopAnchor ? st.stopAnchor.ts : st.lastFix.ts, !!st.stopAnchor);
        }
    }

    live(now: number = Date.now()): LiveData {
        const st = this.st;
        const trip = st.trip;
        const lastFix = st.lastFix;
        if (!trip) {
            return {
                active: false,
                start: null,
                distance: 0,
                duration: 0,
                speed: lastFix && now - st.lastReceived < SPEED_HOLD * 2 ? st.speed : 0,
                maxSpeed: 0,
                avgSpeed: 0,
                lat: lastFix?.lat ?? null,
                lon: lastFix?.lon ?? null,
            };
        }
        const duration = Math.max(0, now - trip.start);
        const stopped = trip.stops.reduce((sum, stop) => sum + (stop.end - stop.start), 0);
        const moving = Math.max(0, duration - stopped);
        return {
            active: true,
            start: trip.start,
            distance: trip.distance,
            duration,
            speed: lastFix && now - st.lastReceived < SPEED_HOLD * 2 ? st.speed : 0,
            maxSpeed: trip.maxSpeed,
            avgSpeed: moving > 0 ? trip.distance / (moving / 1000) : 0,
            lat: lastFix?.lat ?? null,
            lon: lastFix?.lon ?? null,
        };
    }
}
