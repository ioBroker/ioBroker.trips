/**
 * The running trip of an object - in `<iob-trips-map>` and `<iob-trips-browser>`.
 *
 * Its track as the adapter has it (`getTrack` with `id: 'current'`: without the privacy zones, simplified), and the
 * positions of the live states since then as a tail, drawn at once. While positions come, the track is read again at
 * most every 30 s; the tail positions it contains then are dropped.
 */
import type { WebComponentSocket } from '@iobroker/web-components';

import { loadTrack, NoAnswerError, toPosition, type LatLon, type TripTrack } from './trips';

/** The live states the elements read, below `<instance>.<object>.live` */
export const LIVE_STATES = [
    'active',
    'start',
    'position',
    'latitude',
    'longitude',
    'speed',
    'distance',
    'duration',
    'avgSpeed',
] as const;

export type LiveState = (typeof LIVE_STATES)[number];

/** The value of a live state of one object */
export type LiveValue = (state: LiveState) => ioBroker.StateValue | undefined;

/** The running track is read again after this time at the earliest, while positions come, in ms */
export const TRACK_REFRESH = 30_000;

/** A failed reading is made again after this time, in ms: the instance may have been stopped */
const RETRY_DELAY = 30_000;

/** Positions kept between two readings of the running track */
const MAX_TAIL = 5_000;

/** Positions closer than this are the same, in degrees (~0.1 m) */
const SAME_POSITION = 1e-6;

/**
 * The IDs of the live states of an object
 *
 * @param base `<instance>.<object>`
 */
export function liveStateIds(base: string): string[] {
    return LIVE_STATES.map(state => `${base}.live.${state}`);
}

/** The position of the live states: `live.position`, else `live.latitude` and `live.longitude` */
export function livePosition(live: LiveValue): LatLon | null {
    return toPosition(live('position'), live('latitude'), live('longitude'));
}

function samePosition(a: LatLon | undefined, b: LatLon): boolean {
    return !!a && Math.abs(a[0] - b[0]) < SAME_POSITION && Math.abs(a[1] - b[1]) < SAME_POSITION;
}

/** What to draw of the running trip */
export interface RunningView {
    /** null while it is read the first time, or if the adapter has none (the trip just ended) */
    track: TripTrack | null;
    /** Positions after the end of `track` */
    tail: LatLon[];
    loading: boolean;
    error: string | null;
}

interface RunningLoad {
    /** `<instance>.<object>|<live.start>` */
    key: string;
    socket: WebComponentSocket;
    loading: boolean;
    track: TripTrack | null;
    error: string | null;
    failedAt: number;
    readAt: number;
}

export class RunningTrack {
    #load: RunningLoad | null = null;

    #tail: LatLon[] = [];

    #timer: ReturnType<typeof setTimeout> | null = null;

    #timerDue = 0;

    readonly #changed: () => void;

    readonly #errorText: (e: unknown) => string;

    /**
     * @param changed called when there is something new to draw, or when the track is due again
     * @param errorText the text of an error
     */
    constructor(changed: () => void, errorText: (e: unknown) => string) {
        this.#changed = changed;
        this.#errorText = errorText;
    }

    /**
     * The running trip of an object; call it on every render while it is shown
     *
     * @param socket the connection of the host
     * @param instance e.g. `trips.0`
     * @param object the ID of the object
     * @param start the value of `live.start`: another value is another trip
     * @param position the position of the live states
     */
    follow(
        socket: WebComponentSocket,
        instance: string,
        object: string,
        start: string,
        position: LatLon | null,
    ): RunningView {
        const key = `${instance}.${object}|${start}`;
        let load = this.#load;
        if (load && (load.key !== key || load.socket !== socket)) {
            this.clear();
            load = null;
        }
        this.#append(position, load?.track ?? null, load?.readAt ?? 0);
        if (!load) {
            load = this.#read(socket, instance, object, key, null);
        } else if (!load.loading) {
            const now = Date.now();
            const retry = !!load.error && now - load.failedAt >= RETRY_DELAY;
            const grow = this.#tail.length > 0 && now - load.readAt >= TRACK_REFRESH;
            if (retry || grow) {
                load = this.#read(socket, instance, object, key, load);
            }
        }
        return { track: load.track, tail: this.#tail, loading: load.loading, error: load.error };
    }

    /** The trip is not shown any more */
    clear(): void {
        this.#load = null;
        this.#tail = [];
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
    }

    #read(
        socket: WebComponentSocket,
        instance: string,
        object: string,
        key: string,
        previous: RunningLoad | null,
    ): RunningLoad {
        const load: RunningLoad = {
            key,
            socket,
            loading: true,
            // the trip stays on the map while it is read again
            track: previous?.track ?? null,
            error: null,
            failedAt: 0,
            readAt: previous?.readAt ?? 0,
        };
        this.#load = load;
        // the positions the adapter has when it answers
        const known = this.#tail.length;
        loadTrack(socket, instance, object, 'current').then(
            track => {
                if (this.#load === load) {
                    load.loading = false;
                    load.track = track;
                    load.readAt = Date.now();
                    this.#tail.splice(0, known);
                    this.#changed();
                }
            },
            (e: unknown) => {
                if (this.#load !== load) {
                    return;
                }
                load.loading = false;
                if (e instanceof NoAnswerError) {
                    load.error = this.#errorText(e);
                    load.failedAt = Date.now();
                    this.#wake(RETRY_DELAY);
                } else {
                    // the trip has just ended: the states say so in a moment
                    load.readAt = Date.now();
                }
                this.#changed();
            },
        );
        return load;
    }

    /** A new position extends the track at once; the track is due again in a while */
    #append(position: LatLon | null, track: TripTrack | null, readAt: number): void {
        if (!position) {
            return;
        }
        const segments = track?.segments;
        const lastSegment = segments?.[segments.length - 1];
        const end = this.#tail[this.#tail.length - 1] ?? lastSegment?.[lastSegment.length - 1];
        if (samePosition(end, position)) {
            return;
        }
        this.#tail.push(position);
        if (this.#tail.length > MAX_TAIL) {
            this.#tail.splice(0, this.#tail.length - MAX_TAIL);
        }
        // also when no further position comes
        this.#wake(Math.max(1_000, readAt + TRACK_REFRESH - Date.now()));
    }

    /** Call `changed` after this time - or earlier, if it is called earlier anyway */
    #wake(delay: number): void {
        const due = Date.now() + delay;
        if (this.#timer && this.#timerDue <= due) {
            return;
        }
        if (this.#timer) {
            clearTimeout(this.#timer);
        }
        this.#timerDue = due;
        this.#timer = setTimeout(() => {
            this.#timer = null;
            this.#changed();
        }, delay);
    }
}
