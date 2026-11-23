/**
 * Measured consumption of a trip from a state of the vehicle:
 * - counter: a total that only grows (fuel used, energy meter of the drive), the trip uses the difference
 * - level: tank level or battery SoC that falls while driving; refuelling and charging are recognized and skipped
 * - rate: fuel flow (l/h) or power (kW), integrated over the time of the trip
 */
export type MeterMode = 'counter' | 'level' | 'rate';

export interface MeterOptions {
    /** level in %: the capacity of the tank or the battery, for the consumption in liters or kWh */
    capacity?: number;
    /** level: the value is in % of the capacity */
    percent?: boolean;
    /** rate: longer gaps between two values count only this long */
    maxGapSeconds?: number;
}

export interface MeterState {
    running: boolean;
    /** Used in the running trip, in the unit of the consumption */
    used: number;
    /** The last value of the state, also outside the trips: the start value of the next trip */
    last: { value: number; ts: number } | null;
    /** level: refuellings or chargings during the trip */
    refills: number;
    /** Start of the running trip */
    start?: number | null;
}

interface Sample {
    value: number;
    ts: number;
    /** Used in the trip up to this value; only for the values of the running or the last trip */
    used?: number;
}

/** A rise of the level by this share of the capacity is a refuelling or charging, smaller rises are noise or recuperation */
const REFILL_SHARE = 0.05;
/** Without a capacity, a rise of so many units is a refuelling */
const REFILL_UNITS = 2;
/**
 * The values are kept this long: the start of a trip is often detected later than it happened (start time, rare
 * positions), and its end always (trip end after 5-30 minutes). With the values the meter counts from the real start
 * to the real end.
 */
const HISTORY_MS = 2 * 3600000;
const HISTORY_MAX = 10000;

export function emptyMeter(): MeterState {
    return { running: false, used: 0, last: null, refills: 0, start: null };
}

export class ConsumptionMeter {
    private st: MeterState;
    /** The recent values, sorted by time */
    private readonly history: Sample[] = [];
    /** The value at the start of the running trip */
    private startValue: { value: number; ts: number } | null = null;

    constructor(
        readonly mode: MeterMode,
        private readonly options: MeterOptions = {},
        saved?: MeterState | null,
    ) {
        this.st = saved ? { ...emptyMeter(), ...saved } : emptyMeter();
    }

    get state(): MeterState {
        return this.st;
    }

    get running(): boolean {
        return this.st.running;
    }

    /** One value of the state in its own unit (level in % if `percent`) converted to the consumption unit */
    private factor(): number {
        if (this.mode === 'level' && this.options.percent) {
            return (this.options.capacity || 0) / 100;
        }
        return 1;
    }

    private refillThreshold(): number {
        if (this.options.percent) {
            return 100 * REFILL_SHARE;
        }
        return this.options.capacity ? this.options.capacity * REFILL_SHARE : REFILL_UNITS;
    }

    /**
     * A new value of the state
     *
     * @param value the value in the unit of the state
     * @param ts time of the value
     */
    update(value: number, ts: number): void {
        if (!Number.isFinite(value) || !Number.isFinite(ts)) {
            return;
        }
        const st = this.st;
        if (st.last && ts < st.last.ts) {
            // an older value (e.g. buffered): not usable for the difference
            return;
        }
        if (st.running && st.last) {
            this.apply(st.last, value, ts);
        }
        st.last = { value, ts };
        this.remember({ value, ts, used: st.running ? st.used : undefined });
    }

    /** Adds the consumption from the value `last` to the value `value` */
    private apply(last: { value: number; ts: number }, value: number, ts: number): void {
        const st = this.st;
        switch (this.mode) {
            case 'counter':
                // a counter that was reset continues from the new value
                if (value >= last.value) {
                    st.used += value - last.value;
                }
                break;
            case 'level': {
                const delta = last.value - value;
                if (-delta >= this.refillThreshold()) {
                    st.refills++;
                } else {
                    // falls count, small rises (recuperation, fuel sloshing) are subtracted again
                    st.used += delta * this.factor();
                }
                break;
            }
            case 'rate':
                st.used += this.integrate(last, ts);
                break;
        }
    }

    private remember(sample: Sample): void {
        const history = this.history;
        history.push(sample);
        let drop = 0;
        while (
            drop < history.length - 1 &&
            (history.length - drop > HISTORY_MAX || history[drop].ts < sample.ts - HISTORY_MS)
        ) {
            drop++;
        }
        if (drop) {
            history.splice(0, drop);
        }
    }

    private integrate(last: { value: number; ts: number }, until: number): number {
        const maxGap = (this.options.maxGapSeconds ?? 300) * 1000;
        const ms = Math.min(Math.max(0, until - last.ts), maxGap);
        return Math.max(0, last.value) * (ms / 3600000);
    }

    /**
     * Starts a trip: the value at the start is the start value. Values that came after the start but before the
     * start was known are counted.
     *
     * @param ts start of the trip
     */
    start(ts: number): void {
        const st = this.st;
        st.running = true;
        st.used = 0;
        st.refills = 0;
        st.start = ts;
        const history = this.history;
        let next = history.findIndex(sample => sample.ts > ts);
        if (next === -1) {
            // no value after the start yet
            if (st.last) {
                // the flow before the start does not belong to the trip
                this.startValue =
                    this.mode === 'rate' && st.last.ts < ts ? { value: st.last.value, ts } : { ...st.last };
                st.last = { ...this.startValue };
            } else {
                this.startValue = null;
            }
            return;
        }
        let base: { value: number; ts: number };
        if (next > 0) {
            const before = history[next - 1];
            base = this.mode === 'rate' ? { value: before.value, ts } : { value: before.value, ts: before.ts };
        } else {
            // no value before the start: the first one after it is the start value
            base = { value: history[0].value, ts: history[0].ts };
            history[0].used = 0;
            next = 1;
        }
        this.startValue = { ...base };
        let last = base;
        for (let i = next; i < history.length; i++) {
            const sample = history[i];
            this.apply(last, sample.value, sample.ts);
            sample.used = st.used;
            last = { value: sample.value, ts: sample.ts };
        }
        st.last = last;
    }

    /** Used so far in the running trip */
    current(now: number): number {
        const st = this.st;
        if (!st.running) {
            return 0;
        }
        let used = st.used;
        if (this.mode === 'rate' && st.last) {
            used += this.integrate(st.last, now);
        }
        return Math.max(0, used);
    }

    /**
     * Ends the trip. Values after the end (the trip end is decided later) are not counted.
     *
     * @param ts end of the trip
     * @returns the consumption of the trip
     */
    stop(ts: number): number {
        const st = this.st;
        if (!st.running) {
            return 0;
        }
        let used = st.used;
        let last = st.last;
        if (st.last && st.last.ts > ts) {
            // the last value up to the end
            const start = st.start ?? -Infinity;
            let found = false;
            for (let i = this.history.length - 1; i >= 0; i--) {
                const sample = this.history[i];
                if (sample.ts <= ts) {
                    if (sample.ts > start && sample.used !== undefined) {
                        used = sample.used;
                        last = { value: sample.value, ts: sample.ts };
                    } else {
                        // no value between the start and the end
                        used = 0;
                        last = this.startValue;
                    }
                    found = true;
                    break;
                }
            }
            if (!found && this.history.length) {
                // the values up to the end are not kept any more: count all
                last = null;
            }
        }
        if (this.mode === 'rate' && last) {
            used += this.integrate(last, ts);
        }
        st.running = false;
        st.used = 0;
        st.start = null;
        this.startValue = null;
        return Math.max(0, used);
    }
}
