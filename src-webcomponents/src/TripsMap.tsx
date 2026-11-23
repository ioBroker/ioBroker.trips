/**
 * The trip of one object on a map: `<iob-trips-map>`.
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`trips-map.json`, written by the build from `manifest.ts`), so a host loads this module only when it
 * shows the element. The host sets `socket` and `settings`, and if it has them `theme` and `editMode`.
 *
 * Mode `live`: while `live.active` is true, the running trip (`getTrack` with `id: 'current'`) and the current
 * position. Each new position of the live states extends the track at once; the whole track is read again at most
 * every 30 s while it grows - the adapter leaves out the privacy zones and simplifies it. Without a running trip:
 * the last trip and the last position. Mode `last`: always the last finished trip, read again when
 * `lastTrip.id` changes.
 *
 * Leaflet is in the module, React is not: it comes from `lib/esm/react-19.js` beside `adapter/`, see
 * `vite.config.ts`.
 */
import type { WebComponentSocket } from '@iobroker/web-components';
import { defineWebComponent } from '@iobroker/web-components/element';

import { DEFAULT_TILE_URL, MAP_TAG, type MapSettings } from './constants';
import { attributionHtml, infoValues, summaryInfo, TripPanel, type InfoContent, type MapContent } from './mapView';
import { MAP_STYLES } from './styles';
import {
    formatMoment,
    formatSpeed,
    loadTrack,
    loadTrips,
    NoAnswerError,
    toBool,
    toNumber,
    toPosition,
    type LatLon,
    type TripObject,
    type TripSummary,
    type TripTrack,
} from './trips';
import { RETRY_DELAY, TripsElement } from './TripsElement';

/** The live states the map shows, below `<instance>.<object>.live` */
const LIVE_STATES = [
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

type LiveState = (typeof LIVE_STATES)[number];

/** The running track is read again after this time at the earliest, while positions come, in ms */
const TRACK_REFRESH = 30_000;

/** Positions kept between two readings of the running track */
const MAX_TAIL = 5_000;

/** Room for the box above the map when the map fits the trip, in px */
const INFO_HEIGHT = 80;

/** Positions closer than this are the same, in degrees (~0.1 m) */
const SAME_POSITION = 1e-6;

/** What the map shows */
interface Shown {
    /** `current|<start>` for the running trip, `last|<lastTrip.id>` for the last one */
    key: string;
    running: boolean;
}

/** What was read for `key` */
interface TripLoad {
    key: string;
    /** `<instance>.<object>` */
    target: string;
    socket: WebComponentSocket;
    loading: boolean;
    track: TripTrack | null;
    summary: TripSummary | null;
    /** The object has no trip yet */
    empty: boolean;
    error: string | null;
    failedAt: number;
    readAt: number;
}

type TripRead = Pick<TripLoad, 'track' | 'summary' | 'empty'>;

function samePosition(a: LatLon | undefined, b: LatLon): boolean {
    return !!a && Math.abs(a[0] - b[0]) < SAME_POSITION && Math.abs(a[1] - b[1]) < SAME_POSITION;
}

/**
 * The running trip so far
 *
 * @param socket the connection of the host
 * @param instance e.g. `trips.0`
 * @param object the ID of the object
 */
async function readRunning(socket: WebComponentSocket, instance: string, object: string): Promise<TripRead> {
    try {
        const track = await loadTrack(socket, instance, object, 'current');
        return { track, summary: track.summary, empty: false };
    } catch (e) {
        if (e instanceof NoAnswerError) {
            throw e;
        }
        // the trip has just ended: the states say so in a moment
        return { track: null, summary: null, empty: false };
    }
}

/**
 * The last finished trip: its summary, and its track if the adapter still has it
 *
 * @param socket the connection of the host
 * @param instance e.g. `trips.0`
 * @param object the ID of the object
 */
async function readLast(socket: WebComponentSocket, instance: string, object: string): Promise<TripRead> {
    const [summary] = await loadTrips(socket, instance, object, 1);
    if (!summary) {
        return { track: null, summary: null, empty: true };
    }
    if (!summary.track) {
        return { track: null, summary, empty: false };
    }
    try {
        return { track: await loadTrack(socket, instance, object, summary.id), summary, empty: false };
    } catch (e) {
        if (e instanceof NoAnswerError) {
            throw e;
        }
        // the file is gone
        return { track: null, summary: { ...summary, track: false }, empty: false };
    }
}

class TripsMapElement extends TripsElement<MapSettings> {
    #load: TripLoad | null = null;

    /** The positions of the live states after the running track was read */
    #tail: LatLon[] = [];

    #growTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        super(MAP_STYLES);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.#growTimer) {
            clearTimeout(this.#growTimer);
            this.#growTimer = null;
        }
    }

    protected override getStateIds(settings: MapSettings): string[] {
        const target = this.getTarget(settings);
        if (target.status !== 'ok') {
            return [];
        }
        const base = `${target.instance}.${target.object.id}`;
        const ids = [`${base}.lastTrip.id`];
        if (settings.mode !== 'last') {
            ids.push(...LIVE_STATES.map(state => `${base}.live.${state}`));
        }
        return ids;
    }

    #live(base: string, state: LiveState): ioBroker.StateValue | undefined {
        return this.states[`${base}.live.${state}`]?.val;
    }

    /** The current or the last position - only in mode `live` */
    #position(base: string): LatLon | null {
        if (this.settings.mode === 'last') {
            return null;
        }
        return toPosition(this.#live(base, 'position'), this.#live(base, 'latitude'), this.#live(base, 'longitude'));
    }

    /** The running trip or the last one; null while the states are read */
    #shown(base: string): Shown | null {
        if (this.settings.mode !== 'last') {
            const active = this.states[`${base}.live.active`];
            if (active === undefined) {
                return null;
            }
            if (toBool(active?.val)) {
                return { key: `current|${String(this.#live(base, 'start') ?? '')}`, running: true };
            }
        }
        const last = this.states[`${base}.lastTrip.id`];
        if (last === undefined) {
            return null;
        }
        return { key: `last|${String(last?.val ?? '')}`, running: false };
    }

    /**
     * Read what is shown: again for another trip, a while after an error, and for the running trip while it grows
     *
     * @param instance e.g. `trips.0`
     * @param object the object
     * @param shown the trip
     */
    #read(instance: string, object: TripObject, shown: Shown): void {
        const socket = this.socket;
        if (!socket) {
            return;
        }
        const target = `${instance}.${object.id}`;
        const previous = this.#load;
        const same =
            !!previous && previous.key === shown.key && previous.target === target && previous.socket === socket;
        if (same) {
            const now = Date.now();
            const retry = !!previous.error && now - previous.failedAt >= RETRY_DELAY;
            const grow = shown.running && this.#tail.length > 0 && now - previous.readAt >= TRACK_REFRESH;
            if (previous.loading || (!retry && !grow)) {
                return;
            }
        } else {
            this.#tail = [];
        }
        const load: TripLoad = {
            key: shown.key,
            target,
            socket,
            loading: true,
            // the running trip stays on the map while it is read again
            track: same ? previous.track : null,
            summary: same ? previous.summary : null,
            empty: false,
            error: null,
            failedAt: 0,
            readAt: same ? previous.readAt : 0,
        };
        this.#load = load;
        const read = shown.running ? readRunning(socket, instance, object.id) : readLast(socket, instance, object.id);
        read.then(
            result => {
                if (this.#load === load) {
                    Object.assign(load, result, { loading: false, readAt: Date.now() });
                    if (shown.running) {
                        // the new track has these positions
                        this.#tail = [];
                    }
                    this.refresh();
                }
            },
            (e: unknown) => {
                if (this.#load === load) {
                    load.loading = false;
                    load.error = this.errorText(e);
                    load.failedAt = Date.now();
                    this.refresh();
                    this.later(RETRY_DELAY);
                }
            },
        );
    }

    /**
     * A new position of the running trip: it extends the track at once, and the track is read again in a while
     *
     * @param position the position of the live states
     */
    #follow(position: LatLon | null): void {
        if (!position) {
            return;
        }
        const segments = this.#load?.track?.segments;
        const lastSegment = segments?.[segments.length - 1];
        const end = this.#tail[this.#tail.length - 1] ?? lastSegment?.[lastSegment.length - 1];
        if (samePosition(end, position)) {
            return;
        }
        this.#tail.push(position);
        if (this.#tail.length > MAX_TAIL) {
            this.#tail.splice(0, this.#tail.length - MAX_TAIL);
        }
        if (!this.#growTimer) {
            // also when no further position comes
            const due = Math.max(1_000, (this.#load?.readAt ?? 0) + TRACK_REFRESH - Date.now());
            this.#growTimer = setTimeout(() => {
                this.#growTimer = null;
                this.refresh();
            }, due);
        }
    }

    protected override render(): void {
        this.loadObjects();
        const target = this.getTarget(this.settings);
        if (target.status === 'hint') {
            this.root.render(this.renderHint(target.text, 'map'));
            return;
        }
        if (target.status === 'loading') {
            this.root.render(<div className="root" />);
            return;
        }
        const base = `${target.instance}.${target.object.id}`;
        const shown = this.#shown(base);
        if (shown) {
            this.#read(target.instance, target.object, shown);
            if (shown.running) {
                this.#follow(this.#position(base));
            } else {
                this.#tail = [];
            }
        }
        this.#draw(target.instance, target.object, shown);
    }

    #draw(instance: string, object: TripObject, shown: Shown | null): void {
        const settings = this.settings;
        const word = this.word;
        const lang = this.systemLang;
        const base = `${instance}.${object.id}`;
        const load = shown && this.#load?.key === shown.key && this.#load.target === base ? this.#load : null;
        const position = this.#position(base);
        const running = !!shown?.running;

        if (!load || (load.loading && !load.track && !load.summary)) {
            // read: the map comes with the trip, so that it does not jump there from the default view
            this.root.render(<div className="root" />);
            return;
        }
        if (!position && !load.track && !load.summary) {
            this.root.render(this.renderHint(load.error || word(load.empty ? 'no_trips' : 'no_track'), 'map'));
            return;
        }

        const showInfo = settings.showInfo !== false;
        const content: MapContent = {
            track: load.track,
            running,
            position,
            positionLabel: word(running ? 'position' : 'last_position'),
            tail: running ? this.#tail : [],
            fitKey: `${base}|${load.key}`,
            tileUrl: (settings.tileUrl || '').trim() || DEFAULT_TILE_URL,
            attribution: attributionHtml(settings.attribution),
            showStops: settings.showStops !== false,
            padTop: showInfo ? INFO_HEIGHT : 0,
            word,
            lang,
        };
        let info: InfoContent | null = null;
        if (showInfo) {
            if (running) {
                const start = toNumber(this.#live(base, 'start'));
                const speed = toNumber(this.#live(base, 'speed'));
                info = {
                    status: [
                        word('running'),
                        start ? word('since', formatMoment(start, lang)) : '',
                        speed !== undefined ? formatSpeed(speed, object.speedUnit, lang) : '',
                    ]
                        .filter(Boolean)
                        .join(' · '),
                    running: true,
                    route: '',
                    // the live states are in the units of the object already
                    values: infoValues(
                        word,
                        lang,
                        object,
                        toNumber(this.#live(base, 'distance')),
                        toNumber(this.#live(base, 'duration')),
                        toNumber(this.#live(base, 'avgSpeed')),
                    ),
                };
            } else if (load.summary) {
                info = summaryInfo(load.summary, object, word, lang);
            } else {
                info = {
                    status: word(load.empty ? 'no_trips' : 'last_position'),
                    running: false,
                    route: '',
                    values: [],
                };
            }
            if (load.error) {
                info.note = load.error;
            }
        }

        this.root.render(
            <div className={`root${this.editMode ? ' edit' : ''}`}>
                <TripPanel
                    content={content}
                    info={info}
                    dark={this.theme.type === 'dark'}
                />
            </div>,
        );
    }
}

defineWebComponent(MAP_TAG, TripsMapElement);
