/**
 * The trip of one object on a map: `<iob-trips-map>`.
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`trips-map.json`, written by the build from `manifest.ts`), so a host loads this module only when it
 * shows the element. The host sets `socket` and `settings`, and if it has them `theme` and `editMode`.
 *
 * Mode `live`: while `live.active` is true, the running trip and the current position (`live.ts`). Without a running
 * trip: the last trip and the last position. Mode `last`: always the last finished trip, read again when
 * `lastTrip.id` changes.
 *
 * Leaflet is in the module, React is not: it comes from `lib/esm/react-19.js` beside `adapter/`, see
 * `vite.config.ts`.
 */
import type { WebComponentSocket } from '@iobroker/web-components';
import { defineWebComponent } from '@iobroker/web-components/element';

import { DEFAULT_TILE_URL, MAP_TAG, type MapSettings } from './constants';
import { livePosition, liveStateIds, RunningTrack } from './live';
import { attributionHtml, runningInfo, summaryInfo, TripPanel, type InfoContent, type MapContent } from './mapView';
import { MAP_STYLES } from './styles';
import {
    loadTrack,
    loadTrips,
    NoAnswerError,
    toBool,
    type LatLon,
    type TripObject,
    type TripSummary,
    type TripTrack,
} from './trips';
import { RETRY_DELAY, TripsElement } from './TripsElement';

/** Room for the box above the map when the map fits the trip, in px */
const INFO_HEIGHT = 80;

/** The last finished trip, as read for one value of `lastTrip.id` */
interface LastLoad {
    /** `<instance>.<object>|<lastTrip.id>` */
    key: string;
    socket: WebComponentSocket;
    loading: boolean;
    track: TripTrack | null;
    summary: TripSummary | null;
    /** The object has no trip yet */
    empty: boolean;
    error: string | null;
    failedAt: number;
}

type LastRead = Pick<LastLoad, 'track' | 'summary' | 'empty'>;

/** What the map draws */
interface Shown {
    running: boolean;
    track: TripTrack | null;
    tail: LatLon[];
    summary: TripSummary | null;
    empty: boolean;
    loading: boolean;
    error: string | null;
    /** A new value fits the map to the trip */
    fitKey: string;
}

/**
 * The last finished trip: its summary, and its track if the adapter still has it
 *
 * @param socket the connection of the host
 * @param instance e.g. `trips.0`
 * @param object the ID of the object
 */
async function readLast(socket: WebComponentSocket, instance: string, object: string): Promise<LastRead> {
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
    #last: LastLoad | null = null;

    readonly #running = new RunningTrack(
        () => this.refresh(),
        e => this.errorText(e),
    );

    constructor() {
        super(MAP_STYLES);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.#running.clear();
    }

    protected override getStateIds(settings: MapSettings): string[] {
        const target = this.getTarget(settings);
        if (target.status !== 'ok') {
            return [];
        }
        const base = `${target.instance}.${target.object.id}`;
        return settings.mode === 'last' ? [`${base}.lastTrip.id`] : [`${base}.lastTrip.id`, ...liveStateIds(base)];
    }

    /**
     * The last finished trip: read again when `lastTrip.id` changes, and a while after an error
     *
     * @param instance e.g. `trips.0`
     * @param object the object
     * @param lastTrip the value of `lastTrip.id`
     */
    #readLast(instance: string, object: TripObject, lastTrip: string): LastLoad | null {
        const socket = this.socket;
        if (!socket) {
            return null;
        }
        const key = `${instance}.${object.id}|${lastTrip}`;
        const previous = this.#last;
        if (
            previous?.key === key &&
            previous.socket === socket &&
            (previous.loading || !previous.error || Date.now() - previous.failedAt < RETRY_DELAY)
        ) {
            return previous;
        }
        const load: LastLoad = {
            key,
            socket,
            loading: true,
            track: null,
            summary: null,
            empty: false,
            error: null,
            failedAt: 0,
        };
        this.#last = load;
        readLast(socket, instance, object.id).then(
            result => {
                if (this.#last === load) {
                    Object.assign(load, result, { loading: false });
                    this.refresh();
                }
            },
            (e: unknown) => {
                if (this.#last === load) {
                    load.loading = false;
                    load.error = this.errorText(e);
                    load.failedAt = Date.now();
                    this.refresh();
                    this.later(RETRY_DELAY);
                }
            },
        );
        return load;
    }

    /** The running trip or the last one; null while the states are read */
    #shown(instance: string, object: TripObject): Shown | null {
        const base = `${instance}.${object.id}`;
        const live = this.liveValue(base);
        const socket = this.socket;
        if (this.settings.mode !== 'last') {
            const active = this.states[`${base}.live.active`];
            if (active === undefined || !socket) {
                return null;
            }
            if (toBool(active?.val)) {
                const start = String(live('start') ?? '');
                const view = this.#running.follow(socket, instance, object.id, start, livePosition(live));
                return {
                    running: true,
                    track: view.track,
                    tail: view.tail,
                    summary: view.track?.summary ?? null,
                    empty: false,
                    loading: view.loading,
                    error: view.error,
                    fitKey: `current|${start}`,
                };
            }
        }
        this.#running.clear();
        const lastTrip = this.states[`${base}.lastTrip.id`];
        if (lastTrip === undefined) {
            return null;
        }
        const load = this.#readLast(instance, object, String(lastTrip?.val ?? ''));
        if (!load) {
            return null;
        }
        return {
            running: false,
            track: load.track,
            tail: [],
            summary: load.summary,
            empty: load.empty,
            loading: load.loading,
            error: load.error,
            fitKey: `last|${load.key}`,
        };
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
        this.#draw(target.instance, target.object, this.#shown(target.instance, target.object));
    }

    #draw(instance: string, object: TripObject, shown: Shown | null): void {
        const settings = this.settings;
        const word = this.word;
        const lang = this.systemLang;
        const base = `${instance}.${object.id}`;
        const live = this.liveValue(base);
        // the current or the last position - only in mode `live`
        const position = settings.mode === 'last' ? null : livePosition(live);

        if (!shown || (shown.loading && !shown.track && !shown.summary)) {
            // read: the map comes with the trip, so that it does not jump there from the default view
            this.root.render(<div className="root" />);
            return;
        }
        if (!position && !shown.track && !shown.summary) {
            this.root.render(this.renderHint(shown.error || word(shown.empty ? 'no_trips' : 'no_track'), 'map'));
            return;
        }

        const showInfo = settings.showInfo !== false;
        const content: MapContent = {
            track: shown.track,
            running: shown.running,
            position,
            positionLabel: word(shown.running ? 'position' : 'last_position'),
            tail: shown.tail,
            fitKey: `${base}|${shown.fitKey}`,
            tileUrl: (settings.tileUrl || '').trim() || DEFAULT_TILE_URL,
            attribution: attributionHtml(settings.attribution),
            showStops: settings.showStops !== false,
            padTop: showInfo ? INFO_HEIGHT : 0,
            word,
            lang,
        };
        let info: InfoContent | null = null;
        if (showInfo) {
            if (shown.running) {
                info = runningInfo(object, live, word, lang);
            } else if (shown.summary) {
                info = summaryInfo(shown.summary, object, word, lang);
            } else {
                info = {
                    status: word(shown.empty ? 'no_trips' : 'last_position'),
                    running: false,
                    route: '',
                    values: [],
                };
            }
            if (shown.error) {
                info.note = shown.error;
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
