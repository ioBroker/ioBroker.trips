/**
 * All trips of one object, and the selected one on a map: `<iob-trips-browser>`.
 *
 * Made for the tab of the adapter in admin (a jsonConfig `custom` item with `webComponent`), usable in vis as well.
 * It fills the box of the host: wide (from 720 px) the list on the left and the map on the right, narrow the map
 * above the list. The list scrolls inside.
 *
 * - Without an object in the settings, a selector of the objects of the instance (`getObjects`) - hidden if there
 *   is only one; the choice is kept per instance in the local storage of the browser.
 * - On top, while `live.active` is true, the running trip: live, and selected while nothing else was chosen. Its
 *   map is the one of `<iob-trips-map>` (`live.ts`).
 * - Then the finished trips, newest first, in pages of 50 (`getTrips` with `to` = the start of the oldest one so
 *   far), grouped by day. The first page is read again when `lastTrip.id` changes.
 * - The selected trip on the map (`getTrack`), with everything the adapter knows of it in the box above.
 *
 * Leaflet is in the module, React is not: it comes from `lib/esm/react-19.js` beside `adapter/`, see
 * `vite.config.ts`.
 */
import type { JSX, KeyboardEvent } from 'react';

import type { WebComponentSocket } from '@iobroker/web-components';
import { defineWebComponent } from '@iobroker/web-components/element';

import { BROWSER_TAG, DEFAULT_TILE_URL, PAGE_SIZE, type BrowserSettings } from './constants';
import { livePosition, liveStateIds, RunningTrack, type LiveValue } from './live';
import {
    attributionHtml,
    runningInfo,
    summaryTrack,
    tripDetails,
    TripPanel,
    type InfoContent,
    type MapContent,
} from './mapView';
import { BROWSER_STYLES } from './styles';
import {
    dayOf,
    findObject,
    formatDay,
    formatDistance,
    formatDuration,
    formatMoment,
    formatMoney,
    formatNumber,
    formatRoute,
    formatTimeRange,
    loadTrack,
    loadTrips,
    NoAnswerError,
    toBool,
    toDistance,
    toNumber,
    type LatLon,
    type TripObject,
    type TripSummary,
    type TripTrack,
} from './trips';
import { RETRY_DELAY, TripsElement } from './TripsElement';

/** The ID of the running trip in the list and for `getTrack` */
const CURRENT = 'current';

/** Room for the box above the map when the map fits the trip, in px */
const INFO_HEIGHT = 120;

/** Tracks kept, so that going back to a trip does not read it again */
const TRACK_CACHE = 20;

/** The chosen object of each instance in the local storage: `<prefix><instance>` */
const STORAGE_PREFIX = 'iob-trips-browser.';

/** The trips of one object as far as they are read */
interface ListLoad {
    /** `<instance>.<object>` */
    target: string;
    instance: string;
    object: string;
    socket: WebComponentSocket;
    /** `lastTrip.id` the first page was read for */
    lastTrip: string;
    /** Newest first */
    trips: TripSummary[];
    /** A page is read */
    reading: 'first' | 'more' | null;
    /** Older trips than the loaded ones exist */
    hasMore: boolean;
    /** The first page was read once */
    loaded: boolean;
    error: string | null;
    failed: 'first' | 'more' | null;
    failedAt: number;
}

/** The track of one finished trip */
interface TrackLoad {
    loading: boolean;
    track: TripTrack | null;
    error: string | null;
    failedAt: number;
}

/** The object the browser shows and where it comes from */
type Resolved =
    | {
          status: 'ok';
          instance: string;
          objects: TripObject[];
          object: TripObject;
          /** No object in the settings and more than one: offer them */
          choose: boolean;
      }
    | { status: 'loading'; instance: string }
    | { status: 'hint'; text: string };

/** A day of the list */
interface DayGroup {
    day: number;
    trips: TripSummary[];
    /** Meters */
    distance: number;
}

function readStorage(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // private mode or blocked: the choice lasts as long as the element
    }
}

function groupByDay(trips: TripSummary[]): DayGroup[] {
    const groups: DayGroup[] = [];
    for (const trip of trips) {
        const day = dayOf(trip.start);
        let group = groups[groups.length - 1];
        if (group?.day !== day) {
            group = { day, trips: [], distance: 0 };
            groups.push(group);
        }
        group.trips.push(trip);
        group.distance += trip.distance || 0;
    }
    return groups;
}

class TripsBrowserElement extends TripsElement<BrowserSettings> {
    /** The object chosen in the selector, per instance */
    #chosen: { instance: string; id: string | null } | null = null;

    #list: ListLoad | null = null;

    readonly #tracks = new Map<string, TrackLoad>();

    /** Start and destination of trips without a track, made once per summary: the map compares by identity */
    readonly #summaryTracks = new WeakMap<TripSummary, TripTrack | null>();

    /** The trip the user chose (`current` for the running one), for `#selectedTarget` */
    #selected: string | null = null;

    #selectedTarget = '';

    readonly #running = new RunningTrack(
        () => this.refresh(),
        e => this.errorText(e),
    );

    constructor() {
        super(BROWSER_STYLES);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.#running.clear();
    }

    protected override getStateIds(settings: BrowserSettings): string[] {
        const target = this.#resolve(settings);
        if (target.status !== 'ok') {
            return [];
        }
        const base = `${target.instance}.${target.object.id}`;
        return [`${base}.lastTrip.id`, ...liveStateIds(base)];
    }

    // ---------------------------------------------------------------- the object

    /** The object of the settings, or the one chosen in the selector */
    #resolve(settings: BrowserSettings): Resolved {
        const target = this.getObjectsTarget(settings);
        if (target.status !== 'ok') {
            return target;
        }
        const { instance, objects } = target;
        if (target.object) {
            const found = findObject(objects, target.object);
            return found
                ? { status: 'ok', instance, objects, object: found, choose: false }
                : { status: 'hint', text: this.word('object_not_found', instance, target.object) };
        }
        if (this.#chosen?.instance !== instance) {
            this.#chosen = { instance, id: readStorage(`${STORAGE_PREFIX}${instance}`) };
        }
        const chosen = this.#chosen.id;
        const object = (chosen && objects.find(obj => obj.id === chosen)) || objects[0];
        return { status: 'ok', instance, objects, object, choose: objects.length > 1 };
    }

    #choose(instance: string, id: string): void {
        this.#chosen = { instance, id };
        writeStorage(`${STORAGE_PREFIX}${instance}`, id);
        // other states
        this.refresh();
    }

    // ---------------------------------------------------------------- reading

    /**
     * The first page of trips: again when the object or `lastTrip.id` changes, and a while after an error
     *
     * @param instance e.g. `trips.0`
     * @param object the object
     */
    #readList(instance: string, object: TripObject): ListLoad | null {
        const socket = this.socket;
        const target = `${instance}.${object.id}`;
        const lastTripState = this.states[`${target}.lastTrip.id`];
        let list = this.#list;
        if (!socket) {
            return null;
        }
        if (list?.target !== target || list.socket !== socket) {
            if (lastTripState === undefined) {
                // the state is read: the first page comes with it
                return null;
            }
            list = {
                target,
                instance,
                object: object.id,
                socket,
                lastTrip: String(lastTripState?.val ?? ''),
                trips: [],
                reading: null,
                hasMore: false,
                loaded: false,
                error: null,
                failed: null,
                failedAt: 0,
            };
            this.#list = list;
            this.#readPage(list, 'first');
            return list;
        }
        if (list.reading) {
            return list;
        }
        const lastTrip = lastTripState === undefined ? list.lastTrip : String(lastTripState?.val ?? '');
        if (lastTrip !== list.lastTrip) {
            // a trip has ended
            list.lastTrip = lastTrip;
            this.#readPage(list, 'first');
        } else if (list.failed === 'first' && Date.now() - list.failedAt >= RETRY_DELAY) {
            this.#readPage(list, 'first');
        }
        return list;
    }

    #readPage(list: ListLoad, kind: 'first' | 'more'): void {
        list.reading = kind;
        list.error = null;
        list.failed = null;
        const to = kind === 'more' ? list.trips[list.trips.length - 1]?.start : undefined;
        loadTrips(list.socket, list.instance, list.object, PAGE_SIZE, to).then(
            page => {
                if (this.#list !== list) {
                    return;
                }
                list.reading = null;
                if (kind === 'more') {
                    const known = new Set(list.trips.map(trip => trip.id));
                    list.trips = [...list.trips, ...page.filter(trip => !known.has(trip.id))];
                    list.hasMore = page.length >= PAGE_SIZE;
                } else if (page.length < PAGE_SIZE) {
                    // all of them
                    list.trips = page;
                    list.hasMore = false;
                } else {
                    // the new first page, and the older pages read before
                    const oldest = page[page.length - 1].start;
                    const older = list.trips.filter(trip => trip.start < oldest);
                    list.trips = [...page, ...older];
                    list.hasMore = older.length ? list.hasMore : true;
                }
                list.loaded = true;
                this.refresh();
            },
            (e: unknown) => {
                if (this.#list !== list) {
                    return;
                }
                list.reading = null;
                list.error = this.errorText(e);
                list.failed = kind;
                list.failedAt = Date.now();
                this.refresh();
                if (kind === 'first') {
                    this.later(RETRY_DELAY);
                }
            },
        );
    }

    /**
     * The track of a finished trip, kept for the next time
     *
     * @param list the trips of the object
     * @param trip the trip
     */
    #readTrack(list: ListLoad, trip: TripSummary): TrackLoad {
        const key = `${list.target}|${trip.id}`;
        const known = this.#tracks.get(key);
        if (known && (known.loading || !known.error || Date.now() - known.failedAt < RETRY_DELAY)) {
            // the newest at the end
            this.#tracks.delete(key);
            this.#tracks.set(key, known);
            return known;
        }
        const load: TrackLoad = { loading: true, track: null, error: null, failedAt: 0 };
        this.#tracks.set(key, load);
        while (this.#tracks.size > TRACK_CACHE) {
            this.#tracks.delete(this.#tracks.keys().next().value as string);
        }
        loadTrack(list.socket, list.instance, list.object, trip.id).then(
            track => {
                load.loading = false;
                load.track = track;
                this.refresh();
            },
            (e: unknown) => {
                load.loading = false;
                if (e instanceof NoAnswerError) {
                    load.error = this.errorText(e);
                    load.failedAt = Date.now();
                    this.later(RETRY_DELAY);
                }
                // else the file is gone: start and destination of the summary
                this.refresh();
            },
        );
        return load;
    }

    #summaryTrack(trip: TripSummary): TripTrack | null {
        if (!this.#summaryTracks.has(trip)) {
            this.#summaryTracks.set(trip, summaryTrack(trip));
        }
        return this.#summaryTracks.get(trip) ?? null;
    }

    // ---------------------------------------------------------------- selection

    #select(target: string, id: string): void {
        this.#selected = id;
        this.#selectedTarget = target;
        this.refresh();
    }

    /**
     * The trip on the map: the chosen one, else the running one, else the newest
     *
     * @param target `<instance>.<object>`
     * @param running a trip is running
     * @param list the trips read so far
     */
    #shownId(target: string, running: boolean, list: ListLoad | null): string | null {
        let selected = this.#selectedTarget === target ? this.#selected : null;
        if (selected === CURRENT && !running) {
            selected = null;
        }
        if (selected && selected !== CURRENT && list?.loaded && !list.trips.some(trip => trip.id === selected)) {
            selected = null;
        }
        return selected ?? (running ? CURRENT : (list?.trips[0]?.id ?? null));
    }

    /** Up and down in the list */
    #onKey(e: KeyboardEvent<HTMLDivElement>, target: string, ids: string[], shownId: string | null): void {
        const index = shownId ? ids.indexOf(shownId) : -1;
        let next: string | undefined;
        if (e.key === 'ArrowDown') {
            next = ids[Math.min(ids.length - 1, index + 1)];
        } else if (e.key === 'ArrowUp') {
            next = ids[Math.max(0, index - 1)];
        } else if (e.key === 'Home') {
            next = ids[0];
        } else if (e.key === 'End') {
            next = ids[ids.length - 1];
        }
        if (next === undefined) {
            return;
        }
        e.preventDefault();
        this.#select(target, next);
        // when it is drawn
        requestAnimationFrame(() => {
            const row = this.shadowRoot?.querySelector('.trip.selected');
            row?.scrollIntoView({ block: 'nearest' });
            (row as HTMLElement | null)?.focus({ preventScroll: true });
        });
    }

    // ---------------------------------------------------------------- drawing

    protected override render(): void {
        this.loadObjects();
        const resolved = this.#resolve(this.settings);
        if (resolved.status === 'hint') {
            this.root.render(this.renderHint(resolved.text, 'route'));
            return;
        }
        if (resolved.status === 'loading') {
            this.root.render(<div className="root" />);
            return;
        }
        const { instance, object } = resolved;
        const target = `${instance}.${object.id}`;
        const live = this.liveValue(target);
        const running = toBool(this.states[`${target}.live.active`]?.val);
        const list = this.#readList(instance, object);
        const shownId = this.#shownId(target, running, list);

        this.root.render(
            <div className={`root browser${this.editMode ? ' edit' : ''}`}>
                {resolved.choose ? this.#renderBar(instance, resolved.objects, object) : null}
                <div className="browser-body">
                    <div className="browser-map">{this.#renderMap(instance, object, live, list, shownId)}</div>
                    {this.#renderList(target, object, live, running, list, shownId)}
                </div>
            </div>,
        );
    }

    #renderBar(instance: string, objects: TripObject[], object: TripObject): JSX.Element {
        return (
            <div className="browser-bar">
                <select
                    className="object-select"
                    aria-label={this.word('object')}
                    title={this.word('object')}
                    value={object.id}
                    onChange={e => this.#choose(instance, e.target.value)}
                >
                    {objects.map(obj => (
                        <option
                            key={obj.id}
                            value={obj.id}
                        >
                            {obj.name}
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    #renderMap(
        instance: string,
        object: TripObject,
        live: LiveValue,
        list: ListLoad | null,
        shownId: string | null,
    ): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const settings = this.settings;
        const target = `${instance}.${object.id}`;
        let track: TripTrack | null = null;
        let tail: LatLon[] = [];
        let position: LatLon | null = null;
        let info: InfoContent;
        let fitKey: string;

        if (shownId === CURRENT && this.socket) {
            const start = String(live('start') ?? '');
            position = livePosition(live);
            const view = this.#running.follow(this.socket, instance, object.id, start, position);
            track = view.track;
            tail = view.tail;
            info = runningInfo(object, live, word, lang, view.track?.summary ?? null);
            if (view.error) {
                info.note = view.error;
            }
            fitKey = `${target}|${CURRENT}|${start}`;
        } else {
            this.#running.clear();
            const trip = shownId ? list?.trips.find(item => item.id === shownId) : undefined;
            if (!list || !trip) {
                return this.renderHint(
                    list?.error || word(!list?.loaded || list.reading ? 'loading' : 'no_trips'),
                    'map',
                );
            }
            const load = trip.track ? this.#readTrack(list, trip) : null;
            track = load?.track ?? this.#summaryTrack(trip);
            info = tripDetails(trip, object, word, lang);
            if (load?.error) {
                info.note = load.error;
            } else if (load && !load.loading && !load.track) {
                info.note = word('no_track');
            }
            fitKey = `${target}|${trip.id}`;
        }

        const content: MapContent = {
            track,
            running: shownId === CURRENT,
            position,
            positionLabel: word('position'),
            tail,
            fitKey,
            tileUrl: (settings.tileUrl || '').trim() || DEFAULT_TILE_URL,
            attribution: attributionHtml(settings.attribution),
            showStops: true,
            padTop: INFO_HEIGHT,
            word,
            lang,
        };
        return (
            <TripPanel
                content={content}
                info={info}
                dark={this.theme.type === 'dark'}
            />
        );
    }

    #renderList(
        target: string,
        object: TripObject,
        live: LiveValue,
        running: boolean,
        list: ListLoad | null,
        shownId: string | null,
    ): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const trips = list?.trips ?? [];
        const ids = [...(running ? [CURRENT] : []), ...trips.map(trip => trip.id)];
        const unit = object.distanceUnit;

        let tail: JSX.Element | null = null;
        if (list?.reading) {
            tail = <div className="list-note">{word('loading')}</div>;
        } else if (list?.error) {
            tail = <div className="list-note error">{list.error}</div>;
        }

        return (
            <div
                className="browser-list"
                role="listbox"
                aria-label={object.name}
                onKeyDown={e => this.#onKey(e, target, ids, shownId)}
            >
                {running ? this.#renderRunning(target, object, live, shownId === CURRENT) : null}
                {groupByDay(trips).map(group => (
                    <div
                        key={group.day}
                        className="day"
                        role="group"
                        aria-label={formatDay(group.day, lang)}
                    >
                        <div className="day-header">
                            <span>{formatDay(group.day, lang)}</span>
                            <span className="day-sum">
                                {formatDistance(toDistance(group.distance, unit), unit, lang)}
                            </span>
                        </div>
                        {group.trips.map(trip => this.#renderRow(target, object, trip, trip.id === shownId))}
                    </div>
                ))}
                {list?.loaded && !trips.length && !running ? <div className="list-note">{word('no_trips')}</div> : null}
                {tail}
                {list?.hasMore && !list.reading ? (
                    <button
                        type="button"
                        className="more"
                        onClick={() => this.#readPage(list, 'more')}
                    >
                        {word('more')}
                    </button>
                ) : null}
            </div>
        );
    }

    #renderRunning(target: string, object: TripObject, live: LiveValue, selected: boolean): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const start = toNumber(live('start'));
        const distance = toNumber(live('distance'));
        const duration = toNumber(live('duration'));
        return (
            <div
                key={CURRENT}
                className={`trip clickable running${selected ? ' selected' : ''}`}
                role="option"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => this.#select(target, CURRENT)}
            >
                <div className="trip-main">
                    <div className="trip-when">
                        <span className="live-dot" />
                        <span className="trip-day">{word('running')}</span>
                    </div>
                    <div className="trip-route">{start ? word('since', formatMoment(start, lang)) : ''}</div>
                </div>
                <div className="trip-figures">
                    <div className="trip-distance">
                        {distance === undefined ? '—' : formatDistance(distance, object.distanceUnit, lang)}
                    </div>
                    <div className="trip-sub">{duration === undefined ? '' : formatDuration(duration, lang)}</div>
                </div>
            </div>
        );
    }

    #renderRow(target: string, object: TripObject, trip: TripSummary, selected: boolean): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const route = formatRoute(trip.from, trip.to);
        const extra = [
            typeof trip.consumption === 'number'
                ? `${formatNumber(trip.consumption, 1, lang)} ${trip.consumptionUnit || ''}`.trim()
                : '',
            typeof trip.cost === 'number' ? formatMoney(trip.cost, trip.currency, lang) : '',
        ]
            .filter(Boolean)
            .join(' · ');
        return (
            <div
                key={trip.id}
                className={`trip clickable${selected ? ' selected' : ''}${trip.track ? '' : ' no-track'}`}
                role="option"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                title={trip.track ? undefined : word('no_track')}
                onClick={() => this.#select(target, trip.id)}
            >
                <div className="trip-main">
                    <div className="trip-when">
                        <span className="trip-time">{formatTimeRange(trip.start, trip.end, lang)}</span>
                    </div>
                    <div className="trip-route">{route || '—'}</div>
                </div>
                <div className="trip-figures">
                    <div className="trip-distance">
                        {formatDistance(toDistance(trip.distance, object.distanceUnit), object.distanceUnit, lang)}
                    </div>
                    <div className="trip-sub">{formatDuration(trip.duration, lang)}</div>
                    {extra ? <div className="trip-sub trip-extra">{extra}</div> : null}
                </div>
            </div>
        );
    }
}

defineWebComponent(BROWSER_TAG, TripsBrowserElement);
