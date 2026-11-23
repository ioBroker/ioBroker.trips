/**
 * The last trips of one object: `<iob-trips-list>`.
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`trips-list.json`, written by the build from `manifest.ts`), so a host loads this module only when it
 * shows the element. The host sets `socket` and `settings`, and if it has them `theme`, `editMode` and `dialogs`.
 *
 * One row per trip, newest first (`getTrips`): when, from where to where, distance and duration, consumption and
 * cost if the adapter calculates them. The list is read again when `lastTrip.id` changes - a trip has ended. A
 * click on a trip with a track shows it on a map in a dialog of the host - the same map as `<iob-trips-map>`;
 * the event `trips-list-click` comes first, so a host can answer the click itself.
 *
 * Leaflet is in the module, React is not: it comes from `lib/esm/react-19.js` beside `adapter/`, see
 * `vite.config.ts`.
 */
import type { JSX } from 'react';
import { createRoot } from 'react-dom/client';

import type { WebComponentSocket } from '@iobroker/web-components';
import { defineWebComponent, getThemeCssVariables } from '@iobroker/web-components/element';

import { DEFAULT_COUNT, DEFAULT_TILE_URL, LIST_CLICK_EVENT, LIST_TAG, type ListSettings } from './constants';
import { attributionHtml, summaryInfo, TripPanel, type MapContent } from './mapView';
import { DIALOG_STYLES, LIST_STYLES } from './styles';
import {
    formatDay,
    formatDistance,
    formatDuration,
    formatMoney,
    formatNumber,
    formatRoute,
    formatTime,
    formatTimeRange,
    loadTrack,
    loadTrips,
    toDistance,
    type TripObject,
    type TripSummary,
    type TripTrack,
} from './trips';
import { RETRY_DELAY, TripsElement } from './TripsElement';

/** The width the dialog asks the host for, in px */
const DIALOG_WIDTH = 860;

/** The arrow of a row that opens the map */
const CHEVRON_PATH = 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z';

/** The trips as read for one object, number and last trip */
interface ListLoad {
    key: string;
    /** `<instance>.<object>` */
    target: string;
    socket: WebComponentSocket;
    loading: boolean;
    trips: TripSummary[] | null;
    error: string | null;
    failedAt: number;
}

/** The track of the dialog */
interface DialogLoad {
    track: TripTrack | null;
    error: string | null;
}

function clampInt(value: number | undefined, min: number, max: number, def: number): number {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.min(max, Math.max(min, Math.round(num))) : def;
}

class TripsListElement extends TripsElement<ListSettings> {
    #load: ListLoad | null = null;

    /** Draws the open dialog again; null while none is open */
    #drawDialog: (() => void) | null = null;

    constructor() {
        super(LIST_STYLES);
    }

    protected override getStateIds(settings: ListSettings): string[] {
        const target = this.getTarget(settings);
        return target.status === 'ok' ? [`${target.instance}.${target.object.id}.lastTrip.id`] : [];
    }

    get #count(): number {
        return clampInt(this.settings.count, 1, 100, DEFAULT_COUNT);
    }

    /**
     * Read the trips: again when the last trip, the object or the number change, and a while after an error
     *
     * @param instance e.g. `trips.0`
     * @param object the object
     */
    #read(instance: string, object: TripObject): void {
        const socket = this.socket;
        const lastTrip = this.states[`${instance}.${object.id}.lastTrip.id`];
        if (!socket || lastTrip === undefined) {
            // the state is read
            return;
        }
        const target = `${instance}.${object.id}`;
        const key = JSON.stringify([target, this.#count, lastTrip?.val ?? '']);
        const previous = this.#load;
        if (
            previous?.key === key &&
            previous.socket === socket &&
            (previous.loading || !previous.error || Date.now() - previous.failedAt < RETRY_DELAY)
        ) {
            return;
        }
        const load: ListLoad = {
            key,
            target,
            socket,
            loading: true,
            // the old list stays while the new one is read
            trips: previous?.target === target ? previous.trips : null,
            error: null,
            failedAt: 0,
        };
        this.#load = load;
        loadTrips(socket, instance, object.id, this.#count).then(
            trips => {
                if (this.#load === load) {
                    load.trips = trips;
                    load.loading = false;
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

    #onOpen(instance: string, object: TripObject, trip: TripSummary): void {
        if (this.editMode || !trip.track || this.#drawDialog) {
            return;
        }
        if (!this.emit(LIST_CLICK_EVENT, { instance, object: object.id, trip: trip.id })) {
            // the host answers it
            return;
        }
        void this.#openDialog(instance, object, trip);
    }

    /** The trip on a map, in an element dialog of the host */
    async #openDialog(instance: string, object: TripObject, trip: TripSummary): Promise<void> {
        const socket = this.socket;
        if (!socket) {
            return;
        }
        const element = document.createElement('div');
        const shadow = element.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = DIALOG_STYLES;
        const mount = document.createElement('div');
        shadow.append(style, mount);
        const dialogRoot = createRoot(mount);
        const load: DialogLoad = { track: null, error: null };

        this.#drawDialog = () => {
            // the host moves the content into its dialog, out of this element: it takes the theme along
            for (const [name, value] of Object.entries(getThemeCssVariables(this.theme))) {
                element.style.setProperty(name, value);
            }
            dialogRoot.render(this.#renderDialog(object, trip, load));
        };
        this.#drawDialog();
        loadTrack(socket, instance, object.id, trip.id).then(
            track => {
                load.track = track;
                this.#drawDialog?.();
            },
            (e: unknown) => {
                load.error = this.errorText(e);
                this.#drawDialog?.();
            },
        );
        try {
            await this.openDialog({
                title: `${object.name} · ${formatDay(trip.start, this.systemLang)} ${formatTime(trip.start, this.systemLang)}`,
                element,
                width: DIALOG_WIDTH,
            });
        } finally {
            this.#drawDialog = null;
            dialogRoot.unmount();
        }
    }

    /** Consumption and cost of a trip, as far as the adapter calculates them */
    #extra(trip: TripSummary): string {
        const lang = this.systemLang;
        return [
            trip.consumption !== undefined && trip.consumption !== null
                ? `${formatNumber(trip.consumption, 1, lang)} ${trip.consumptionUnit || ''}`.trim()
                : '',
            trip.cost !== undefined && trip.cost !== null ? formatMoney(trip.cost, trip.currency, lang) : '',
        ]
            .filter(Boolean)
            .join(' · ');
    }

    #renderDialog(object: TripObject, trip: TripSummary, load: DialogLoad): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const settings = this.settings;
        if (load.error) {
            return <div className="dialog">{this.renderHint(load.error, 'map')}</div>;
        }
        const info = summaryInfo(trip, object, word, lang);
        if (trip.consumption !== undefined && trip.consumption !== null) {
            info.values.push({
                key: 'consumption',
                label: word('consumption'),
                value: `${formatNumber(trip.consumption, 1, lang)} ${trip.consumptionUnit || ''}`.trim(),
            });
        }
        if (trip.cost !== undefined && trip.cost !== null) {
            info.values.push({ key: 'cost', label: word('cost'), value: formatMoney(trip.cost, trip.currency, lang) });
        }
        const content: MapContent = {
            track: load.track,
            running: false,
            position: null,
            positionLabel: '',
            tail: [],
            fitKey: trip.id,
            tileUrl: (settings.tileUrl || '').trim() || DEFAULT_TILE_URL,
            attribution: attributionHtml(settings.attribution),
            showStops: true,
            padTop: 90,
            word,
            lang,
        };
        return (
            <div className="dialog">
                <div className="dialog-map">
                    <TripPanel
                        content={content}
                        info={info}
                        dark={this.theme.type === 'dark'}
                    />
                </div>
            </div>
        );
    }

    #renderRow(instance: string, object: TripObject, trip: TripSummary): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const clickable = !this.editMode && trip.track;
        const route = formatRoute(trip.from, trip.to);
        const extra = this.#extra(trip);
        const distance = formatDistance(toDistance(trip.distance, object.distanceUnit), object.distanceUnit, lang);
        const open = (): void => this.#onOpen(instance, object, trip);
        return (
            <div
                key={trip.id}
                className={`trip${clickable ? ' clickable' : ''}${trip.track ? '' : ' no-track'}`}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                title={clickable ? word('show_on_map') : trip.track ? undefined : word('no_track')}
                onClick={clickable ? open : undefined}
                onKeyDown={
                    clickable
                        ? e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  open();
                              }
                          }
                        : undefined
                }
            >
                <div className="trip-main">
                    <div className="trip-when">
                        <span className="trip-day">{formatDay(trip.start, lang)}</span>
                        <span className="trip-time">{formatTimeRange(trip.start, trip.end, lang)}</span>
                    </div>
                    {route ? <div className="trip-route">{route}</div> : null}
                </div>
                <div className="trip-figures">
                    <div className="trip-distance">{distance}</div>
                    <div className="trip-sub">{formatDuration(trip.duration, lang)}</div>
                    {extra ? <div className="trip-sub trip-extra">{extra}</div> : null}
                </div>
                <svg
                    className="trip-go"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d={CHEVRON_PATH} />
                </svg>
            </div>
        );
    }

    protected override render(): void {
        this.loadObjects();
        this.#draw();
        this.#drawDialog?.();
    }

    #draw(): void {
        const word = this.word;
        const target = this.getTarget(this.settings);
        if (target.status === 'hint') {
            this.root.render(this.renderHint(target.text, 'route'));
            return;
        }
        if (target.status === 'loading') {
            this.root.render(<div className="root" />);
            return;
        }
        const { instance, object } = target;
        this.#read(instance, object);
        const load = this.#load?.target === `${instance}.${object.id}` ? this.#load : null;
        if (!load?.trips) {
            this.root.render(load?.error ? this.renderHint(load.error, 'route') : <div className="root" />);
            return;
        }
        if (!load.trips.length) {
            this.root.render(this.renderHint(word('no_trips'), 'route'));
            return;
        }
        this.root.render(
            <div className={`root${this.editMode ? ' edit' : ''}`}>
                <div className="list">{load.trips.map(trip => this.#renderRow(instance, object, trip))}</div>
            </div>,
        );
    }
}

defineWebComponent(LIST_TAG, TripsListElement);
