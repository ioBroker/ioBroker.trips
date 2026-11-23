/**
 * What the adapter reads and what it made of it: `<iob-trips-diagnostics>`.
 *
 * Made for the tab of the adapter in admin (a jsonConfig `custom` item with `webComponent`). It asks the instance
 * `getDiagnostics` every 3 s while it is in the document and the page is visible, and shows per object: the
 * sources with their states, where the ignition/engine comes from, the trip detection, the running trip, the
 * position watch, the consumption meter or estimate, the settings in use and the trips; below all objects the
 * places. Every age is `now` of the adapter minus the time stamp - the clock of the browser may differ.
 *
 * The contract is `src/lib/diagnostics.ts` of the adapter: imported as a type only, so the build does not depend on
 * it, but `npm run check:wc` fails when it changes in a way this element does not follow.
 */
import type { JSX } from 'react';

import { defineWebComponent } from '@iobroker/web-components/element';

import type {
    Diagnostics,
    DiagnosticsCounts,
    DiagnosticsObject,
    DiagnosticsSource,
    DiagnosticsSourceState,
} from '../../src/lib/diagnostics';
import { DIAGNOSTICS_INTERVAL, DIAGNOSTICS_TAG, type DiagnosticsSettings } from './constants';
import { toTarget } from './instance';
import { DIAGNOSTICS_STYLES } from './styles';
import {
    formatAge,
    formatCoordinates,
    formatDistance,
    formatDuration,
    formatMoment,
    formatNumber,
    formatSpeed,
    loadDiagnostics,
    toDistance,
    toSpeed,
    type DistanceUnit,
    type SpeedUnit,
} from './trips';
import { TripsElement } from './TripsElement';
import type { ElementWordKey } from './wordKeys';

/** The order and the words of the counts of a source */
const COUNT_KEYS: { key: keyof DiagnosticsCounts; word: ElementWordKey }[] = [
    { key: 'accepted', word: 'count_accepted' },
    { key: 'confirmed', word: 'count_confirmed' },
    { key: 'unused', word: 'count_unused' },
    { key: 'inaccurate', word: 'count_inaccurate' },
    { key: 'old', word: 'count_old' },
    { key: 'outlier', word: 'count_outlier' },
    { key: 'invalid', word: 'count_invalid' },
];

const ROLE_WORDS: Record<DiagnosticsSourceState['role'], ElementWordKey> = {
    position: 'role_position',
    latitude: 'role_latitude',
    longitude: 'role_longitude',
    speed: 'speed',
    ignition: 'ignition',
    accuracy: 'role_accuracy',
    altitude: 'role_altitude',
    timestamp: 'role_timestamp',
    alive: 'role_alive',
};

const PHASE_WORDS: Record<DiagnosticsObject['detector']['phase'], ElementWordKey> = {
    parked: 'phase_parked',
    starting: 'phase_starting',
    trip: 'phase_trip',
};

const TYPE_WORDS: Record<string, ElementWordKey> = {
    car: 'type_car',
    boat: 'type_boat',
    person: 'type_person',
    other: 'type_other',
};

const REASON_WORDS: Record<string, ElementWordKey> = {
    movement: 'reason_movement',
    ignition: 'ignition',
    manual: 'reason_manual',
};

const METER_WORDS: Record<string, ElementWordKey> = {
    counter: 'meter_counter',
    level: 'meter_level',
    rate: 'meter_rate',
    distance: 'estimate_distance',
    hours: 'estimate_hours',
};

const INPUT_WORDS: Record<string, ElementWordKey> = {
    odometer: 'input_odometer',
    price: 'input_price',
};

/** How long "copied" is shown, in ms */
const COPIED_TIME = 1_500;

const COPY_PATH =
    'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2m0 16H8V7h11z';
const CHECK_PATH = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

/** The unit or the format of the value of a state */
function stateUnit(state: DiagnosticsSourceState): string {
    switch (state.format) {
        case 'hdop':
            return 'HDOP';
        case 'meters':
            return 'm';
        case 'latlon':
            return 'lat;lon';
        case 'lonlat':
            return 'lon;lat';
        case 'json':
            return 'JSON';
        default:
            break;
    }
    if (state.format) {
        return state.format;
    }
    if (state.role === 'latitude' || state.role === 'longitude') {
        return '°';
    }
    return state.role === 'altitude' ? 'm' : '';
}

/** A time stamp in a state: in ms or in s since 1970 */
function asTime(val: unknown): number | null {
    if (typeof val !== 'number' || !Number.isFinite(val)) {
        return null;
    }
    if (val > 1e12) {
        return val;
    }
    return val > 1e9 ? val * 1000 : null;
}

function findDiagObject(objects: DiagnosticsObject[], wanted: string): DiagnosticsObject | null {
    const lower = wanted.toLowerCase();
    return (
        objects.find(obj => obj.id === wanted || obj.name === wanted) ||
        objects.find(obj => obj.id.toLowerCase() === lower || String(obj.name).toLowerCase() === lower) ||
        null
    );
}

/** One row of a card */
interface Row {
    label: string;
    value: JSX.Element | string;
    /** A warning: the value needs attention */
    warn?: boolean;
}

/**
 * A box with a title and rows of label and value
 *
 * @param title the title
 * @param rows the rows
 * @param key the React key
 */
function card(title: string, rows: Row[], key: string): JSX.Element {
    return (
        <div
            key={key}
            className="card"
        >
            <div className="card-title">{title}</div>
            <table className="kv">
                <tbody>
                    {rows.map(row => (
                        <tr
                            key={row.label}
                            className={row.warn ? 'warn' : undefined}
                        >
                            <th>{row.label}</th>
                            <td>{row.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** The value of a state as text: objects as JSON */
function stateValue(val: ioBroker.StateValue): string {
    if (val === null || val === undefined) {
        return '';
    }
    if (typeof val === 'object') {
        try {
            return JSON.stringify(val);
        } catch {
            return '{…}';
        }
    }
    return typeof val === 'string' ? val : String(val);
}

class TripsDiagnosticsElement extends TripsElement<DiagnosticsSettings> {
    /** What the data is for: `<instance>|<object>`, with the socket */
    #key = '';

    #socket: unknown = null;

    #data: Diagnostics | null = null;

    #error: string | null = null;

    #busy = false;

    #timer: ReturnType<typeof setTimeout> | null = null;

    /** The state ID copied last, shown for a moment */
    #copied: string | null = null;

    #copiedTimer: ReturnType<typeof setTimeout> | null = null;

    readonly #onVisibility = (): void => {
        if (!document.hidden && this.isConnected && !this.#timer && !this.#busy) {
            this.#poll();
        }
    };

    constructor() {
        super(DIAGNOSTICS_STYLES);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener('visibilitychange', this.#onVisibility);
        if (this.#key) {
            // back in the document: the first render asks itself
            this.#onVisibility();
        }
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('visibilitychange', this.#onVisibility);
        this.#stop();
        if (this.#copiedTimer) {
            clearTimeout(this.#copiedTimer);
            this.#copiedTimer = null;
        }
    }

    // ---------------------------------------------------------------- reading

    #stop(): void {
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
    }

    /** Ask the instance now, and again in 3 s while the element is shown */
    #poll(): void {
        const socket = this.socket;
        const { instance, object } = toTarget(this.settings);
        if (!socket || !instance || !this.isConnected || document.hidden || this.#busy) {
            return;
        }
        const key = this.#key;
        this.#busy = true;
        loadDiagnostics<Diagnostics>(socket, instance, object)
            .then(
                diag => {
                    if (key === this.#key) {
                        this.#data = diag;
                        this.#error = null;
                    }
                },
                (e: unknown) => {
                    if (key === this.#key) {
                        this.#error = this.errorText(e);
                    }
                },
            )
            .finally(() => {
                this.#busy = false;
                if (key !== this.#key) {
                    // the settings changed meanwhile: at once for them
                    this.#poll();
                    return;
                }
                this.#draw();
                this.#stop();
                if (this.isConnected && !document.hidden) {
                    this.#timer = setTimeout(() => {
                        this.#timer = null;
                        this.#poll();
                    }, DIAGNOSTICS_INTERVAL);
                }
            });
    }

    /**
     * Copy a state ID; if the browser does not let it, the ID is selected for Ctrl+C
     *
     * @param id the state ID
     * @param text the element that shows it
     */
    async #copy(id: string, text: Element | null): Promise<void> {
        let done = false;
        try {
            await navigator.clipboard.writeText(id);
            done = true;
        } catch {
            // no clipboard API (http): the old way
            const area = document.createElement('textarea');
            area.value = id;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            this.shadowRoot?.append(area);
            area.select();
            try {
                done = document.execCommand('copy');
            } catch {
                done = false;
            }
            area.remove();
        }
        if (!done) {
            if (text) {
                window.getSelection()?.selectAllChildren(text);
            }
            return;
        }
        this.#copied = id;
        this.#draw();
        if (this.#copiedTimer) {
            clearTimeout(this.#copiedTimer);
        }
        this.#copiedTimer = setTimeout(() => {
            this.#copiedTimer = null;
            this.#copied = null;
            this.#draw();
        }, COPIED_TIME);
    }

    protected override render(): void {
        const { instance, object } = toTarget(this.settings);
        const key = `${instance}|${object}`;
        if (key !== this.#key || this.socket !== this.#socket) {
            this.#key = key;
            this.#socket = this.socket;
            this.#data = null;
            this.#error = null;
            this.#stop();
            this.#poll();
        }
        this.#draw();
    }

    // ---------------------------------------------------------------- drawing

    #draw(): void {
        const word = this.word;
        const { instance, object } = toTarget(this.settings);
        if (!instance) {
            this.root.render(this.renderHint(word('choose_instance'), 'pulse'));
            return;
        }
        const diag = this.#data;
        if (!diag) {
            this.root.render(this.renderHint(this.#error || word('loading'), 'pulse'));
            return;
        }
        let objects = diag.objects;
        if (object) {
            const found = findDiagObject(objects, object);
            if (!found) {
                this.root.render(this.renderHint(word('object_not_found', instance, object), 'pulse'));
                return;
            }
            objects = [found];
        } else if (!objects.length) {
            this.root.render(this.renderHint(word('no_objects', instance), 'pulse'));
            return;
        }
        const single = objects.length === 1;
        this.root.render(
            <div className={`root diag${this.editMode ? ' edit' : ''}`}>
                {this.#error ? <div className="banner">{word('not_updated', this.#error)}</div> : null}
                {objects.map(obj => this.#renderObject(diag, obj, single))}
                {this.#renderGeneral(diag)}
            </div>,
        );
    }

    #age(diag: Diagnostics, ts: number | null | undefined): string {
        return typeof ts === 'number' && ts > 0 ? formatAge(diag.now - ts, this.systemLang) : '—';
    }

    #yesNo(value: boolean): string {
        return this.word(value ? 'yes' : 'no');
    }

    #onOff(value: boolean | null): string {
        return this.word(value === null ? 'unknown' : value ? 'on' : 'off');
    }

    #stateId(id: string): JSX.Element {
        const word = this.word;
        const copied = this.#copied === id;
        return (
            <span className="state-id">
                <code title={id}>{id}</code>
                <button
                    type="button"
                    className={`copy${copied ? ' copied' : ''}`}
                    title={word(copied ? 'copied' : 'copy')}
                    aria-label={word(copied ? 'copied' : 'copy')}
                    onClick={e => void this.#copy(id, e.currentTarget.previousElementSibling)}
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d={copied ? CHECK_PATH : COPY_PATH} />
                    </svg>
                </button>
            </span>
        );
    }

    #renderObject(diag: Diagnostics, obj: DiagnosticsObject, single: boolean): JSX.Element {
        const word = this.word;
        const phase = obj.detector.phase;
        const inputs = obj.inputs ?? [];
        return (
            <section
                key={obj.id}
                className={`object${single ? ' single' : ''}`}
            >
                <header className="object-header">
                    <span className="object-name">{obj.name}</span>
                    <span className="object-type">
                        {[word(TYPE_WORDS[obj.type] || 'type_other'), obj.distanceUnit, obj.speedUnit].join(' · ')}
                    </span>
                    <span className={`badge phase phase-${phase}`}>{word(PHASE_WORDS[phase] || 'phase_parked')}</span>
                    {obj.detector.manual ? <span className="badge">{word('manual')}</span> : null}
                </header>

                <div className="block-title">{word('sources')}</div>
                {this.#renderSources(diag, obj)}
                {this.#renderIgnition(diag, obj)}
                {inputs.length ? (
                    <div className="inputs">
                        <span className="inputs-title">{word('further_states')}</span>
                        {inputs.map(input => (
                            <span
                                key={`${input.role}|${input.id}`}
                                className="input"
                            >
                                <span className="muted">{word(INPUT_WORDS[input.role] || 'value')}</span>
                                {this.#stateId(input.id)}
                            </span>
                        ))}
                    </div>
                ) : null}

                <div className="cards">
                    {this.#renderDetector(diag, obj)}
                    {this.#renderTrip(diag, obj)}
                    {this.#renderWatch(diag, obj)}
                    {this.#renderConsumption(diag, obj)}
                    {this.#renderSettings(obj)}
                    {this.#renderTrips(obj)}
                </div>
            </section>
        );
    }

    #renderSources(diag: Diagnostics, obj: DiagnosticsObject): JSX.Element {
        const word = this.word;
        if (!obj.sources.length) {
            return <div className="muted">{word('none')}</div>;
        }
        const sources = [...obj.sources].sort((a, b) => a.priority - b.priority);
        return (
            <div className="table-wrap">
                <table className="grid sources">
                    <thead>
                        <tr>
                            <th className="num">{word('priority')}</th>
                            <th>{word('source')}</th>
                            <th>{word('status')}</th>
                            <th>{word('last_position')}</th>
                            <th>{word('last_result')}</th>
                            <th>{word('counts')}</th>
                        </tr>
                    </thead>
                    {sources.map(source => this.#renderSource(diag, source))}
                </table>
            </div>
        );
    }

    #renderSource(diag: Diagnostics, source: DiagnosticsSource): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const counts = COUNT_KEYS.filter(({ key }) => (source.counts[key] || 0) > 0);
        const result = source.lastResult;
        const resultWord = COUNT_KEYS.find(({ key }) => key === result)?.word;
        let resultClass = 'warn';
        if (result === 'accepted' || result === 'confirmed') {
            resultClass = 'ok';
        } else if (result === 'unused') {
            resultClass = 'neutral';
        }
        return (
            <tbody
                key={`${source.priority}|${source.label}`}
                className={source.active ? 'active' : undefined}
            >
                <tr className="source-row">
                    <td className="num">{source.priority}</td>
                    <td>
                        <div
                            className="source-label"
                            title={source.label}
                        >
                            {source.label}
                        </div>
                        <div className="muted small">
                            {source.type} · {word('max_age', formatDuration(source.maxAge, lang))}
                        </div>
                    </td>
                    <td>
                        <span className="badges">
                            {source.active ? <span className="badge primary">{word('active')}</span> : null}
                            <span className={`badge ${source.fresh ? 'ok' : 'warn'}`}>
                                {word(source.fresh ? 'fresh' : 'stale')}
                            </span>
                        </span>
                    </td>
                    <td>
                        {source.lastFix ? (
                            <>
                                <div className={source.fresh ? undefined : 'warn-text'}>
                                    {word('ago', this.#age(diag, source.lastFixAt))}
                                </div>
                                <div className="muted small">
                                    {formatCoordinates(source.lastFix.lat, source.lastFix.lon, lang)}
                                </div>
                            </>
                        ) : (
                            <span className="muted">—</span>
                        )}
                    </td>
                    <td>{resultWord ? <span className={`badge ${resultClass}`}>{word(resultWord)}</span> : '—'}</td>
                    <td>
                        {counts.length ? (
                            <span className="counts">
                                {counts.map(({ key, word: countWord }) => (
                                    <span
                                        key={key}
                                        className="count"
                                    >
                                        {word(countWord)} <b>{formatNumber(source.counts[key] || 0, 0, lang)}</b>
                                    </span>
                                ))}
                            </span>
                        ) : (
                            '—'
                        )}
                    </td>
                </tr>
                <tr className="states-row">
                    <td />
                    <td colSpan={5}>{this.#renderStates(diag, source)}</td>
                </tr>
            </tbody>
        );
    }

    #renderStates(diag: Diagnostics, source: DiagnosticsSource): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const maxAge = source.maxAge * 1000;
        return (
            <table className="grid states">
                <thead>
                    <tr>
                        <th>{word('role')}</th>
                        <th>{word('state_id')}</th>
                        <th>{word('value')}</th>
                        <th>{word('unit')}</th>
                        <th>{word('age')}</th>
                    </tr>
                </thead>
                <tbody>
                    {source.states.map(state => {
                        const missing = state.val === null || state.val === undefined;
                        const age = typeof state.ts === 'number' ? diag.now - state.ts : null;
                        const stale = age !== null && age > maxAge;
                        let value = missing ? word('no_value') : stateValue(state.val);
                        const time = state.role === 'timestamp' && !missing ? asTime(state.val) : null;
                        if (time) {
                            value = `${value} (${formatMoment(time, lang)})`;
                        }
                        return (
                            <tr key={`${state.role}|${state.id}`}>
                                <td className="nowrap">{word(ROLE_WORDS[state.role] || 'value')}</td>
                                <td>{this.#stateId(state.id)}</td>
                                <td
                                    className={`value${missing ? ' missing' : ''}`}
                                    title={missing ? undefined : value}
                                >
                                    {value}
                                </td>
                                <td className="nowrap muted">{stateUnit(state)}</td>
                                <td
                                    className={`nowrap${stale ? ' stale' : ''}`}
                                    title={stale ? word('older_than', formatDuration(source.maxAge, lang)) : undefined}
                                >
                                    {this.#age(diag, state.ts)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    }

    #renderIgnition(diag: Diagnostics, obj: DiagnosticsObject): JSX.Element {
        const word = this.word;
        const label = obj.ignitionSource;
        const source = label ? obj.sources.find(item => item.label === label) : undefined;
        const state = source?.states.find(item => item.role === 'ignition');
        return (
            <div className="ignition">
                <span className="muted">{word('ignition_from')}</span>
                {label ? (
                    <>
                        <b title={label}>{label}</b>
                        {source ? (
                            <span className={`badge ${source.ignition ? 'ok' : 'neutral'}`}>
                                {this.#onOff(source.ignition)}
                            </span>
                        ) : null}
                        {source?.ignitionTs ? (
                            <span className="muted">{word('ago', this.#age(diag, source.ignitionTs))}</span>
                        ) : null}
                        {state ? this.#stateId(state.id) : null}
                    </>
                ) : (
                    <span>{word('none')}</span>
                )}
            </div>
        );
    }

    #renderDetector(diag: Diagnostics, obj: DiagnosticsObject): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const d = obj.detector;
        const speedUnit = obj.speedUnit as SpeedUnit;
        const rows: Row[] = [
            {
                label: word('phase'),
                value: <span className={`badge phase phase-${d.phase}`}>{word(PHASE_WORDS[d.phase])}</span>,
            },
            { label: word('ignition'), value: this.#onOff(d.ignition) },
            { label: word('speed'), value: formatSpeed(toSpeed(d.speed, speedUnit), speedUnit, lang) },
            {
                label: word('last_position'),
                value: d.lastFix
                    ? `${formatCoordinates(d.lastFix.lat, d.lastFix.lon, lang)} · ${word('ago', this.#age(diag, d.lastReceived ?? d.lastFix.ts))}`
                    : '—',
            },
        ];
        if (d.movingSince) {
            rows.push({
                label: word('moving_since'),
                value: `${formatMoment(d.movingSince, lang)} · ${word('ago', this.#age(diag, d.movingSince))}`,
            });
        }
        if (d.parked) {
            rows.push({
                label: word('parked_at'),
                value: `${formatCoordinates(d.parked.lat, d.parked.lon, lang)} · ${word('ago', this.#age(diag, d.parked.ts))}`,
            });
        }
        rows.push(
            { label: word('pending'), value: String(d.pending) },
            { label: word('suspects'), value: String(d.suspects), warn: d.suspects > 0 },
        );
        return card(word('detector'), rows, 'detector');
    }

    #renderTrip(diag: Diagnostics, obj: DiagnosticsObject): JSX.Element | null {
        const trip = obj.detector.trip;
        if (!trip) {
            return null;
        }
        const word = this.word;
        const lang = this.systemLang;
        const distanceUnit = obj.distanceUnit as DistanceUnit;
        const speedUnit = obj.speedUnit as SpeedUnit;
        const distance = (meters: number): string =>
            formatDistance(toDistance(meters, distanceUnit), distanceUnit, lang);
        const speed = (ms: number): string => formatSpeed(toSpeed(ms, speedUnit), speedUnit, lang);
        const rows: Row[] = [
            {
                label: word('start'),
                value: `${formatMoment(trip.start, lang)} · ${word('ago', this.#age(diag, trip.start))}`,
            },
            { label: word('reason'), value: word(REASON_WORDS[trip.reason] || 'unknown') },
            { label: word('distance'), value: distance(trip.distance) },
            { label: word('duration'), value: formatDuration(trip.duration / 1000, lang) },
            { label: word('moving_time'), value: formatDuration(trip.movingTime / 1000, lang) },
            { label: word('avg_speed'), value: speed(trip.avgSpeed) },
            { label: word('max_speed'), value: speed(trip.maxSpeed) },
        ];
        if (trip.engineKnown) {
            rows.push(
                { label: word('engine_time'), value: formatDuration(trip.engineTime / 1000, lang) },
                { label: word('engine_distance'), value: distance(trip.engineDistance) },
            );
        }
        rows.push(
            { label: word('points'), value: formatNumber(trip.points, 0, lang) },
            { label: word('stops'), value: String(trip.stops) },
            { label: word('gaps'), value: String(trip.gaps), warn: trip.gaps > 0 },
            {
                label: word('last_position'),
                value: `${formatCoordinates(trip.lat, trip.lon, lang)} · ${word('ago', this.#age(diag, trip.last))}`,
            },
        );
        if (obj.odometerStart !== null && obj.odometerStart !== undefined) {
            rows.push({ label: word('odometer_start'), value: formatNumber(obj.odometerStart, 1, lang) });
        }
        return card(word('running_trip'), rows, 'trip');
    }

    #renderWatch(diag: Diagnostics, obj: DiagnosticsObject): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const w = obj.watch;
        const meters = (value: number): string => `${formatNumber(value, 0, lang)} m`;
        const status = (
            <span className="badges">
                <span className={`badge ${w.active ? 'primary' : 'neutral'}`}>{word(w.active ? 'active' : 'off')}</span>
                {w.alarm ? <span className="badge error">{word('alarm')}</span> : null}
                {w.signalLost ? <span className="badge error">{word('signal_lost')}</span> : null}
            </span>
        );
        const rows: Row[] = [{ label: word('status'), value: status }];
        if (w.active) {
            rows.push(
                { label: word('centre'), value: formatCoordinates(w.lat, w.lon, lang) },
                { label: word('distance'), value: w.distance === null ? '—' : meters(w.distance), warn: w.alarm },
                { label: word('max_distance'), value: meters(w.maxDistance) },
            );
            if (w.since) {
                rows.push({
                    label: word('active_since'),
                    value: `${formatMoment(w.since, lang)} · ${word('ago', this.#age(diag, w.since))}`,
                });
            }
        }
        rows.push(
            { label: word('radius'), value: meters(w.radius) },
            {
                label: word('signal_minutes'),
                value: w.signalMinutes
                    ? `${formatNumber(w.signalMinutes, w.signalMinutes % 1 ? 1 : 0, lang)} min`
                    : word('off'),
            },
            { label: word('auto'), value: this.#yesNo(w.auto) },
        );
        return card(word('watch'), rows, 'watch');
    }

    #renderConsumption(diag: Diagnostics, obj: DiagnosticsObject): JSX.Element | null {
        const word = this.word;
        const lang = this.systemLang;
        const meter = obj.meter;
        if (meter) {
            const rows: Row[] = [
                { label: word('meter_mode'), value: word(METER_WORDS[meter.mode] || 'unknown') },
                { label: word('state_id'), value: meter.stateId ? this.#stateId(meter.stateId) : '—' },
                { label: word('unit'), value: meter.unit },
                { label: word('meter_running'), value: this.#yesNo(meter.running) },
            ];
            if (meter.running) {
                rows.push({ label: word('used'), value: `${formatNumber(meter.used, 2, lang)} ${meter.unit}` });
            }
            rows.push(
                {
                    label: word('last_value'),
                    value: meter.last
                        ? `${formatNumber(meter.last.value, 2, lang)} · ${word('ago', this.#age(diag, meter.last.ts))}`
                        : word('no_value'),
                    warn: !meter.last,
                },
                { label: word('refills'), value: String(meter.refills) },
            );
            return card(word('meter'), rows, 'meter');
        }
        const estimate = obj.estimate;
        if (estimate) {
            const per = estimate.mode === 'hours' ? `${estimate.unit}/h` : `${estimate.unit} / 100 ${obj.distanceUnit}`;
            return card(
                word('estimate'),
                [
                    { label: word('meter_mode'), value: word(METER_WORDS[estimate.mode] || 'unknown') },
                    { label: word('consumption'), value: `${formatNumber(estimate.value, 1, lang)} ${per}` },
                ],
                'estimate',
            );
        }
        return null;
    }

    #renderSettings(obj: DiagnosticsObject): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const s = obj.settings;
        const speedUnit = obj.speedUnit as SpeedUnit;
        const speed = (ms: number): string => formatSpeed(toSpeed(ms, speedUnit), speedUnit, lang);
        const meters = (value: number): string => `${formatNumber(value, 0, lang)} m`;
        const minutes = `${formatNumber(s.tripEndSeconds / 60, s.tripEndSeconds % 60 ? 1 : 0, lang)} min`;
        return card(
            word('settings_in_use'),
            [
                { label: word('start_speed'), value: speed(s.startSpeed) },
                { label: word('start_seconds'), value: formatDuration(s.startSeconds, lang) },
                { label: word('start_distance'), value: meters(s.startDistance) },
                { label: word('stop_radius'), value: meters(s.stopRadius) },
                { label: word('min_stop'), value: formatDuration(s.minStopSeconds, lang) },
                { label: word('trip_end'), value: minutes },
                { label: word('min_distance'), value: meters(s.minDistance) },
                { label: word('max_accuracy'), value: meters(s.maxAccuracy) },
                { label: word('max_speed'), value: speed(s.maxSpeed) },
                { label: word('use_ignition'), value: this.#yesNo(s.useIgnition) },
            ],
            'settings',
        );
    }

    #renderTrips(obj: DiagnosticsObject): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        const last = obj.trips.last;
        const distanceUnit = obj.distanceUnit as DistanceUnit;
        return card(
            word('trips'),
            [
                { label: word('trip_count'), value: formatNumber(obj.trips.count, 0, lang) },
                {
                    label: word('last_trip'),
                    value: last ? (
                        <span title={last.id}>
                            {formatMoment(last.start, lang)} ·{' '}
                            {formatDistance(toDistance(last.distance, distanceUnit), distanceUnit, lang)}
                        </span>
                    ) : (
                        word('none')
                    ),
                },
            ],
            'trips',
        );
    }

    #renderGeneral(diag: Diagnostics): JSX.Element {
        const word = this.word;
        const lang = this.systemLang;
        return (
            <section className="general">
                <div className="block-title">{word('places')}</div>
                {diag.places.length ? (
                    <div className="table-wrap">
                        <table className="grid places">
                            <thead>
                                <tr>
                                    <th>{word('name')}</th>
                                    <th className="num">{word('radius')}</th>
                                    <th>{word('privacy')}</th>
                                    <th>{word('home')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diag.places.map(place => (
                                    <tr key={place.name}>
                                        <td>{place.name}</td>
                                        <td className="num">{formatNumber(place.radius, 0, lang)} m</td>
                                        <td>
                                            {place.privacy ? (
                                                <span className="badge warn">{word('yes')}</span>
                                            ) : (
                                                word('no')
                                            )}
                                        </td>
                                        <td>
                                            {place.home ? <span className="badge primary">{word('home')}</span> : ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="muted">{word('none')}</div>
                )}
                <div className="cards">
                    {card(
                        word('general'),
                        [
                            { label: word('notification_instance'), value: diag.notificationInstance || word('none') },
                            { label: word('live_interval'), value: formatDuration(diag.liveInterval, lang) },
                        ],
                        'general',
                    )}
                </div>
            </section>
        );
    }
}

defineWebComponent(DIAGNOSTICS_TAG, TripsDiagnosticsElement);
