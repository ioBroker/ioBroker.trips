/**
 * The map of a trip - in `<iob-trips-map>` and in the dialog of `<iob-trips-list>`.
 *
 * Leaflet is bundled into the module and draws into a container React does not touch; its CSS is in the shadow root
 * (`styles.ts`). No marker uses a picture: start, destination and stops are circles, the position is a `divIcon`, so
 * nothing is loaded but the tiles. The colors come from the theme of the host through CSS classes, so a path follows
 * the theme without being drawn again.
 *
 * The map fits itself to the trip when a new one is shown. Updates of the same trip (the running one grows) fit it
 * again only as long as the user has not moved or zoomed the map; the button below the zoom fits it on demand.
 */
import { useEffect, useRef, type JSX } from 'react';
import {
    circleMarker,
    Control,
    divIcon,
    DomEvent,
    DomUtil,
    latLngBounds,
    layerGroup,
    map as createMap,
    marker,
    polyline,
    tileLayer,
    type LayerGroup,
    type Map as LeafletMap,
    type TileLayer,
} from 'leaflet';

import {
    formatDay,
    formatDistance,
    formatDuration,
    formatMoment,
    formatRoute,
    formatSpeed,
    formatTime,
    formatTimeRange,
    toDistance,
    toSpeed,
    type LatLon,
    type TripObject,
    type TripStop,
    type TripSummary,
    type TripTrack,
} from './trips';
import type { Word } from './words';

/** What the map shows */
export interface MapContent {
    /** The track, its stops and its summary; null while there is none */
    track: TripTrack | null;
    /** The track is the running trip: no destination, the position moves */
    running: boolean;
    /** The current or the last position; null to show none */
    position: LatLon | null;
    /** The tooltip of the position */
    positionLabel: string;
    /** Positions after the end of `track`, from the live states */
    tail: LatLon[];
    /** A new value shows the whole trip again, even if the user moved the map */
    fitKey: string;
    /** Tile URL with `{z}`, `{x}`, `{y}` */
    tileUrl: string;
    /** HTML of the attribution */
    attribution: string;
    showStops: boolean;
    /** Room the box above the map needs, in px */
    padTop: number;
    word: Word;
    lang: string;
}

/** The fit button: corners of a frame around a dot */
const FIT_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V5a2 2 0 0 1 2-2h4v2H5v4zm16-6a2 2 0 0 1 2 2v4h-2V5h-4V3zM3 15h2v4h4v2H5a2 2 0 0 1-2-2zm16 4v-4h2v4a2 2 0 0 1-2 2h-4v-2zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6"/></svg>';

/** A tooltip of lines: text nodes, so a place name is never HTML */
function tooltipContent(lines: string[]): HTMLElement {
    const div = document.createElement('div');
    div.className = 'trip-tip';
    for (const line of lines.filter(Boolean)) {
        const row = document.createElement('div');
        row.textContent = line;
        div.append(row);
    }
    return div;
}

/** The map and what it draws; React only gives it the container */
class TripMap {
    readonly #map: LeafletMap;

    readonly #container: HTMLElement;

    readonly #trackLayer: LayerGroup = layerGroup();

    readonly #liveLayer: LayerGroup = layerGroup();

    readonly #observer: ResizeObserver;

    #tiles: TileLayer | null = null;

    #tilesKey = '';

    /** What the track layer shows */
    #trackKey: { track: TripTrack | null; running: boolean; showStops: boolean; lang: string } | null = null;

    /** What the live layer shows */
    #liveKey = '';

    #content: MapContent | null = null;

    #fitKey: string | null = null;

    /** The user moved or zoomed the map since it was fitted last */
    #userMoved = false;

    /** The map was to be fitted while it had no size */
    #pendingFit = false;

    /** The map moves because this class moves it */
    #programmatic = false;

    readonly #fitButton: HTMLAnchorElement;

    constructor(container: HTMLElement) {
        this.#container = container;
        this.#map = createMap(container, { zoomControl: true, attributionControl: true, worldCopyJump: true });
        this.#programmatic = true;
        this.#map.setView([48, 10], 4, { animate: false });
        this.#programmatic = false;
        this.#trackLayer.addTo(this.#map);
        this.#liveLayer.addTo(this.#map);

        // the whole trip again
        const fit = new Control({ position: 'topleft' });
        const bar = DomUtil.create('div', 'leaflet-bar leaflet-control');
        this.#fitButton = DomUtil.create('a', 'trip-fit', bar);
        this.#fitButton.href = '#';
        this.#fitButton.setAttribute('role', 'button');
        this.#fitButton.innerHTML = FIT_ICON;
        DomEvent.disableClickPropagation(bar);
        DomEvent.on(this.#fitButton, 'click', e => {
            DomEvent.preventDefault(e);
            this.#userMoved = false;
            this.#fit();
        });
        fit.onAdd = (): HTMLElement => bar;
        fit.addTo(this.#map);

        // a move this class did not make is the user's
        this.#map.on('movestart zoomstart', () => {
            if (!this.#programmatic) {
                this.#userMoved = true;
            }
        });

        // the box of the host changes: Leaflet has to know, and the trip stays in view
        this.#observer = new ResizeObserver(() => {
            if (!this.#container.isConnected) {
                return;
            }
            this.#programmatic = true;
            try {
                this.#map.invalidateSize({ pan: false });
            } finally {
                this.#programmatic = false;
            }
            if (this.#pendingFit || !this.#userMoved) {
                this.#fit();
            }
        });
        this.#observer.observe(container);
    }

    destroy(): void {
        this.#observer.disconnect();
        this.#map.remove();
    }

    update(content: MapContent): void {
        this.#content = content;
        this.#fitButton.title = content.word('fit');
        this.#fitButton.setAttribute('aria-label', content.word('fit'));

        const tilesKey = `${content.tileUrl}\n${content.attribution}`;
        if (tilesKey !== this.#tilesKey) {
            this.#tilesKey = tilesKey;
            this.#tiles?.remove();
            this.#tiles = tileLayer(content.tileUrl, {
                attribution: content.attribution,
                maxZoom: 19,
                subdomains: 'abc',
            }).addTo(this.#map);
        }

        const trackKey = this.#trackKey;
        const trackChanged =
            !trackKey ||
            trackKey.track !== content.track ||
            trackKey.running !== content.running ||
            trackKey.showStops !== content.showStops ||
            trackKey.lang !== content.lang;
        if (trackChanged) {
            this.#trackKey = {
                track: content.track,
                running: content.running,
                showStops: content.showStops,
                lang: content.lang,
            };
            this.#drawTrack(content);
        }

        const last = content.tail[content.tail.length - 1];
        const liveKey = JSON.stringify([
            content.position,
            content.positionLabel,
            content.tail.length,
            last,
            trackChanged,
        ]);
        const liveChanged = liveKey !== this.#liveKey;
        if (liveChanged) {
            this.#liveKey = liveKey;
            this.#drawLive(content);
        }

        if (content.fitKey !== this.#fitKey) {
            this.#fitKey = content.fitKey;
            this.#userMoved = false;
            this.#fit();
        } else if ((trackChanged || liveChanged) && !this.#userMoved) {
            this.#fit();
        }
    }

    #drawTrack(content: MapContent): void {
        const { track, word, lang } = content;
        this.#trackLayer.clearLayers();
        if (!track) {
            return;
        }
        const segments = track.segments.filter(segment => segment.length > 1);
        if (segments.length) {
            // a casing below the line keeps it readable on every map
            polyline(segments, { className: 'trip-casing', weight: 8, interactive: false }).addTo(this.#trackLayer);
            polyline(segments, { className: 'trip-track', weight: 4, interactive: false }).addTo(this.#trackLayer);
        }
        if (content.showStops) {
            for (const stop of track.stops) {
                this.#stopMarker(stop, word, lang);
            }
        }
        const summary = track.summary;
        const first = track.segments[0]?.[0];
        const lastSegment = track.segments[track.segments.length - 1];
        const end = lastSegment?.[lastSegment.length - 1];
        if (first) {
            circleMarker(first, { className: 'trip-marker trip-start', radius: 7, weight: 3, fillOpacity: 1 })
                .bindTooltip(
                    tooltipContent([
                        summary ? `${word('start')} · ${formatMoment(summary.start, lang)}` : word('start'),
                        summary?.from || '',
                    ]),
                    { direction: 'top', offset: [0, -6] },
                )
                .addTo(this.#trackLayer);
        }
        if (end && !content.running) {
            circleMarker(end, { className: 'trip-marker trip-end', radius: 7, weight: 3, fillOpacity: 1 })
                .bindTooltip(
                    tooltipContent([
                        summary ? `${word('destination')} · ${formatMoment(summary.end, lang)}` : word('destination'),
                        summary?.to || '',
                    ]),
                    { direction: 'top', offset: [0, -6] },
                )
                .addTo(this.#trackLayer);
        }
    }

    #stopMarker(stop: TripStop, word: Word, lang: string): void {
        if (stop.lat === null || stop.lon === null) {
            return;
        }
        const duration = stop.end > stop.start ? formatDuration((stop.end - stop.start) / 1000, lang) : '';
        circleMarker([stop.lat, stop.lon], { className: 'trip-marker trip-stop', radius: 5, weight: 2, fillOpacity: 1 })
            .bindTooltip(
                tooltipContent([
                    [word('stop'), duration].filter(Boolean).join(' · '),
                    stop.start ? formatTime(stop.start, lang) : '',
                    stop.place || '',
                ]),
                { direction: 'top', offset: [0, -4] },
            )
            .addTo(this.#trackLayer);
    }

    #drawLive(content: MapContent): void {
        this.#liveLayer.clearLayers();
        const segments = content.track?.segments;
        const lastSegment = segments?.[segments.length - 1];
        const trackEnd = lastSegment?.[lastSegment.length - 1];
        if (content.tail.length) {
            // the way since the track was read, from its end on
            const tail = trackEnd ? [trackEnd, ...content.tail] : content.tail;
            if (tail.length > 1) {
                polyline(tail, { className: 'trip-casing', weight: 8, interactive: false }).addTo(this.#liveLayer);
                polyline(tail, { className: 'trip-track', weight: 4, interactive: false }).addTo(this.#liveLayer);
            }
        }
        if (content.position) {
            marker(content.position, {
                icon: divIcon({
                    className: `trip-position${content.running ? ' running' : ''}`,
                    html: '<span class="pulse"></span><span class="dot"></span>',
                    iconSize: [22, 22],
                }),
                keyboard: false,
                zIndexOffset: 1000,
            })
                .bindTooltip(tooltipContent([content.positionLabel]), { direction: 'top', offset: [0, -10] })
                .addTo(this.#liveLayer);
        }
    }

    /** Everything of the trip in view */
    #fit(): void {
        const content = this.#content;
        if (!content) {
            return;
        }
        const points: LatLon[] = [];
        for (const segment of content.track?.segments || []) {
            points.push(...segment);
        }
        if (content.showStops) {
            for (const stop of content.track?.stops || []) {
                if (stop.lat !== null && stop.lon !== null) {
                    points.push([stop.lat, stop.lon]);
                }
            }
        }
        points.push(...content.tail);
        if (content.position) {
            points.push(content.position);
        }
        if (!points.length) {
            this.#pendingFit = false;
            return;
        }
        const size = this.#map.getSize();
        if (!size.x || !size.y) {
            // in a dialog that is not shown yet: when it has a size
            this.#pendingFit = true;
            return;
        }
        this.#pendingFit = false;
        this.#programmatic = true;
        try {
            const bounds = latLngBounds(points);
            // the box above the map takes room only if the map is big enough for both
            const top = size.y > content.padTop * 3 ? content.padTop : 0;
            this.#map.fitBounds(bounds, {
                paddingTopLeft: [20, 20 + top],
                paddingBottomRight: [20, 20],
                maxZoom: 17,
                animate: false,
            });
        } finally {
            this.#programmatic = false;
        }
    }
}

/**
 * The map: a container for Leaflet, which React never touches again after it is made
 *
 * @param props what the map shows
 * @param props.content the track, the position and the tiles
 * @param props.dark the theme of the host is dark: the tiles are darkened
 */
export function MapView({ content, dark }: { content: MapContent; dark: boolean }): JSX.Element {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<TripMap | null>(null);

    useEffect(() => {
        const map = new TripMap(host.current as HTMLDivElement);
        view.current = map;
        return () => {
            map.destroy();
            view.current = null;
        };
    }, []);

    // after every render: the class compares what changed
    useEffect(() => {
        view.current?.update(content);
    });

    return (
        <div className={`map-view${dark ? ' dark' : ''}`}>
            <div
                ref={host}
                className="leaflet-host"
            />
        </div>
    );
}

/** One number of the box above the map */
export interface InfoValue {
    key: string;
    label: string;
    value: string;
}

/** The box above the map */
export interface InfoContent {
    /** `Trip running · since 08:15 · 42 km/h` or the day and the times of the trip */
    status: string;
    running: boolean;
    /** `Home → Office`, may be empty */
    route: string;
    values: InfoValue[];
    /** e.g. that the track was not stored */
    note?: string;
}

/**
 * Status, route and numbers of the trip
 *
 * @param props the content
 * @param props.info what to show
 */
export function TripInfo({ info }: { info: InfoContent }): JSX.Element {
    return (
        <div className={`info${info.running ? ' running' : ''}`}>
            <div
                className="info-status"
                title={info.status}
            >
                {info.running ? <span className="live-dot" /> : null}
                <span className="ellipsis">{info.status}</span>
            </div>
            {info.route ? (
                <div
                    className="info-route"
                    title={info.route}
                >
                    {info.route}
                </div>
            ) : null}
            {info.values.length ? (
                <div className="info-values">
                    {info.values.map(value => (
                        <div
                            key={value.key}
                            className="info-value"
                            title={`${value.label}: ${value.value}`}
                        >
                            <span className="info-number">{value.value}</span>
                            <span className="info-label">{value.label}</span>
                        </div>
                    ))}
                </div>
            ) : null}
            {info.note ? <div className="info-note">{info.note}</div> : null}
        </div>
    );
}

/**
 * The map with the box above it
 *
 * @param props what to show
 * @param props.content the map
 * @param props.info the box, null for none
 * @param props.dark the theme of the host is dark
 */
export function TripPanel({
    content,
    info,
    dark,
}: {
    content: MapContent;
    info: InfoContent | null;
    dark: boolean;
}): JSX.Element {
    return (
        <div className="trip-panel">
            <MapView
                content={content}
                dark={dark}
            />
            {info ? <TripInfo info={info} /> : null}
        </div>
    );
}

/**
 * Distance, duration and average speed in the units of the object; `—` for what is not known
 *
 * @param word the words of the element
 * @param lang the language of the system
 * @param object the object, for its units
 * @param distance in the distance unit of the object
 * @param duration in seconds
 * @param avgSpeed in the speed unit of the object
 */
export function infoValues(
    word: Word,
    lang: string,
    object: TripObject,
    distance: number | undefined,
    duration: number | undefined,
    avgSpeed: number | undefined,
): InfoValue[] {
    return [
        {
            key: 'distance',
            label: word('distance'),
            value: distance === undefined ? '—' : formatDistance(distance, object.distanceUnit, lang),
        },
        {
            key: 'duration',
            label: word('duration'),
            value: duration === undefined ? '—' : formatDuration(duration, lang),
        },
        {
            key: 'avgSpeed',
            label: word('avg_speed'),
            value: avgSpeed === undefined ? '—' : formatSpeed(avgSpeed, object.speedUnit, lang),
        },
    ];
}

/**
 * The box of a finished trip: when, from where to where, and its numbers
 *
 * @param summary the trip as the adapter keeps it
 * @param object the object, for its units
 * @param word the words of the element
 * @param lang the language of the system
 */
export function summaryInfo(summary: TripSummary, object: TripObject, word: Word, lang: string): InfoContent {
    return {
        status: `${formatDay(summary.start, lang)} · ${formatTimeRange(summary.start, summary.end, lang)}`,
        running: false,
        route: formatRoute(summary.from, summary.to),
        values: infoValues(
            word,
            lang,
            object,
            toDistance(summary.distance, object.distanceUnit),
            summary.duration,
            toSpeed(summary.avgSpeed, object.speedUnit),
        ),
        note: summary.track ? undefined : word('no_track'),
    };
}

/** HTML of the attribution: the text of the settings, or OpenStreetMap */
export function attributionHtml(text: string | undefined): string {
    const own = (text || '').trim();
    if (!own) {
        return '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
    }
    return own.replace(
        /[<>&'"]/g,
        c => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": '#39', '"': 'quot' }[c] as string};`,
    );
}
