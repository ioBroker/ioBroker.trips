/**
 * The styles of the shadow roots. An element fills the box of the host, has a transparent background and inherits
 * `color` and `font`, so it follows the theme of the host; the colors of the track and the markers come from the
 * theme as well (`--iob-primary`, `--iob-success`, ...). Sizes follow the box with container queries.
 *
 * Leaflet's own CSS is part of every shadow root with a map: the styles of the page do not reach into it. The build
 * removes its pictures (`url(...)`, see `vite.config.ts`) - no marker or control here uses them.
 *
 * The content of a dialog has a shadow root of its own: `DIALOG_BASE` instead of `BASE`.
 */
import LEAFLET_CSS from 'leaflet/dist/leaflet.css?inline';

/** Colors and helpers every element and dialog shares */
const COMMON = `
* {
    box-sizing: border-box;
}
.root, .dialog {
    --tint: color-mix(in srgb, currentColor 6%, transparent);
    --hover: color-mix(in srgb, currentColor 10%, transparent);
    --frame: color-mix(in srgb, currentColor 16%, transparent);
    --muted: color-mix(in srgb, currentColor 66%, transparent);
    --faint: color-mix(in srgb, currentColor 45%, transparent);
    -webkit-tap-highlight-color: transparent;
}
.ellipsis {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.edit {
    pointer-events: none;
}
.hint {
    width: 100%;
    height: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
    color: var(--muted, inherit);
    opacity: 0.8;
    font-size: clamp(11px, 5cqmin, 15px);
}
.hint svg {
    width: clamp(18px, 12cqmin, 36px);
    height: clamp(18px, 12cqmin, 36px);
    fill: currentColor;
}
`;

/** The element: fills the box of the host, which is the container of the container queries */
const BASE = `
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it - no loop between measuring and laying out */
    container-type: size;
}
.root {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}
`;

/** The content of a dialog of the host: it flows, the dialog scrolls */
const DIALOG_BASE = `
:host {
    display: block;
}
.dialog {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    min-width: min(640px, 80vw);
    color: inherit;
    font: inherit;
}
.dialog-map {
    position: relative;
    height: min(70vh, 560px);
    border-radius: calc(var(--iob-border-radius, 4px) * 2);
    overflow: hidden;
}
.dialog .hint {
    height: min(40vh, 240px);
}
`;

/** The map of a trip and the box above it - in the map element and in the dialog of the list */
const MAP = `
.trip-panel {
    position: relative;
    width: 100%;
    height: 100%;
    container-type: size;
}
.map-view,
.leaflet-host {
    position: absolute;
    inset: 0;
}
.leaflet-host.leaflet-container {
    background: color-mix(in srgb, currentColor 8%, transparent);
    font-family: inherit;
    color: var(--iob-text);
}
/* the tiles of a light map, made dark for a dark theme */
.map-view.dark .leaflet-tile-pane {
    filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.6);
}
.leaflet-bar,
.leaflet-touch .leaflet-bar {
    border-color: color-mix(in srgb, var(--iob-text) 22%, transparent);
}
.leaflet-bar a,
.leaflet-bar a:hover,
.leaflet-bar a:focus {
    background-color: var(--iob-paper);
    color: var(--iob-text);
    border-bottom-color: var(--iob-divider);
}
.leaflet-bar a:hover {
    background-color: color-mix(in srgb, var(--iob-paper) 86%, var(--iob-text));
}
.leaflet-bar a.leaflet-disabled {
    background-color: var(--iob-paper);
    color: var(--iob-text-secondary);
    opacity: 0.5;
}
.trip-fit {
    display: flex !important;
    align-items: center;
    justify-content: center;
}
.trip-fit svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
}
.leaflet-container .leaflet-control-attribution {
    background: color-mix(in srgb, var(--iob-paper) 78%, transparent);
    color: var(--iob-text-secondary);
}
.leaflet-container .leaflet-control-attribution a {
    color: var(--iob-primary);
}
.leaflet-tooltip {
    background: var(--iob-paper);
    color: var(--iob-text);
    border-color: var(--iob-divider);
    font: inherit;
    font-size: 12px;
    line-height: 1.4;
}
.leaflet-tooltip-top::before {
    border-top-color: var(--iob-paper);
}
.leaflet-tooltip-bottom::before {
    border-bottom-color: var(--iob-paper);
}
.leaflet-tooltip-left::before {
    border-left-color: var(--iob-paper);
}
.leaflet-tooltip-right::before {
    border-right-color: var(--iob-paper);
}
.trip-tip div:first-child {
    font-weight: 600;
}
/* the paths take their colors from the theme: CSS wins over the attributes Leaflet sets */
.trip-casing {
    stroke: var(--iob-paper);
    stroke-opacity: 0.85;
}
.trip-track {
    stroke: var(--iob-primary);
    stroke-opacity: 0.95;
}
.trip-marker {
    stroke: var(--iob-paper);
    stroke-opacity: 1;
}
.trip-start {
    fill: var(--iob-success);
}
.trip-end {
    fill: var(--iob-error);
}
.trip-stop {
    fill: var(--iob-warning);
}
.trip-position .dot,
.trip-position .pulse {
    position: absolute;
    border-radius: 50%;
}
.trip-position .pulse {
    inset: 0;
    background: color-mix(in srgb, var(--iob-primary) 30%, transparent);
}
.trip-position .dot {
    inset: 4px;
    background: color-mix(in srgb, var(--iob-primary) 55%, var(--iob-text-secondary));
    border: 3px solid var(--iob-paper);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}
.trip-position.running .dot {
    background: var(--iob-primary);
}
.trip-position.running .pulse {
    animation: trip-pulse 1.8s ease-out infinite;
}
@keyframes trip-pulse {
    from {
        transform: scale(0.6);
        opacity: 1;
    }
    to {
        transform: scale(2.2);
        opacity: 0;
    }
}
.info {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
    max-width: calc(100% - 64px);
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: calc(var(--iob-border-radius, 4px) * 2);
    background: color-mix(in srgb, var(--iob-paper) 90%, transparent);
    color: var(--iob-text);
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
    font-size: 12px;
    line-height: 1.35;
}
.info-status {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--iob-text-secondary);
}
.live-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--iob-success);
    animation: trip-blink 1.6s ease-in-out infinite;
}
@keyframes trip-blink {
    50% {
        opacity: 0.3;
    }
}
.info-route {
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.info-values {
    display: flex;
    flex-wrap: wrap;
    column-gap: 14px;
    row-gap: 2px;
    margin-top: 2px;
}
.info-value {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.info-number {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.info-label {
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--iob-text-secondary);
}
.info-note {
    max-width: 260px;
    font-size: 11px;
    color: var(--iob-warning);
}
@container (max-width: 320px) {
    .info-label {
        display: none;
    }
    .info-values {
        column-gap: 10px;
    }
    .info-number {
        font-size: 13px;
    }
}
@container (max-height: 200px) {
    .info-route,
    .info-note {
        display: none;
    }
}
@container (max-height: 130px) or (max-width: 220px) {
    .info,
    .leaflet-control-zoom,
    .trip-fit {
        display: none !important;
    }
}
@media (prefers-reduced-motion: reduce) {
    .trip-position.running .pulse,
    .live-dot {
        animation: none;
    }
}
`;

/** `<iob-trips-map>` */
export const MAP_STYLES = `${COMMON}${BASE}${LEAFLET_CSS}${MAP}`;

/** The list of trips */
const LIST = `
.list {
    height: 100%;
    overflow-y: auto;
}
.trip {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 8px 10px;
    border-bottom: 1px solid var(--frame);
}
.trip:last-child {
    border-bottom: none;
}
.trip.clickable {
    cursor: pointer;
}
.trip.clickable:hover {
    background: var(--tint);
}
.trip.clickable:focus-visible {
    outline: 2px solid var(--iob-primary);
    outline-offset: -2px;
}
.trip-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.trip-when {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
}
.trip-day {
    flex: none;
    font-weight: 600;
}
.trip-time {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
}
.trip-route {
    font-size: 13px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.trip-figures {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
}
.trip-distance {
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.trip-sub {
    font-size: 12px;
    white-space: nowrap;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
}
.trip-go {
    flex: none;
    width: 18px;
    height: 18px;
    fill: var(--faint);
}
.trip.no-track .trip-go {
    visibility: hidden;
}
@container (max-width: 280px) {
    .trip {
        gap: 6px;
        padding: 6px 8px;
    }
    .trip-go,
    .trip-extra {
        display: none;
    }
}
`;

/** `<iob-trips-list>`; the map of its dialog is in the shadow root of the dialog content, see `DIALOG_STYLES` */
export const LIST_STYLES = `${COMMON}${BASE}${LIST}`;

/** The map of a trip in a dialog of the host */
export const DIALOG_STYLES = `${COMMON}${DIALOG_BASE}${LEAFLET_CSS}${MAP}`;

/** The box above the map with all values of a trip: a grid; fewer values when the map is small */
const DETAILS = `
.info.detailed {
    width: min(420px, calc(100% - 64px));
}
.info.detailed .info-values {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    column-gap: 12px;
}
@container (max-height: 340px) {
    .info.detailed .info-value:nth-child(n + 5) {
        display: none;
    }
}
`;

/** `<iob-trips-browser>`: list and map side by side from 720 px, else the map above the list */
const BROWSER = `
.browser {
    display: flex;
    flex-direction: column;
}
.browser-bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--frame);
}
.object-select {
    min-width: 160px;
    max-width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--frame);
    border-radius: var(--iob-border-radius, 4px);
    background: var(--iob-paper, transparent);
    color: inherit;
    font: inherit;
}
.object-select:focus-visible {
    outline: 2px solid var(--iob-primary);
    outline-offset: 1px;
}
.browser-body {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(200px, 46%) minmax(0, 1fr);
    grid-template-areas: 'map' 'list';
}
.browser-map {
    grid-area: map;
    position: relative;
    min-width: 0;
    min-height: 0;
}
.browser-list {
    grid-area: list;
    min-height: 0;
    overflow-y: auto;
    border-top: 1px solid var(--frame);
}
@container (min-width: 720px) {
    .browser-body {
        grid-template-columns: 340px minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr);
        grid-template-areas: 'list map';
    }
    .browser-list {
        border-top: none;
        border-right: 1px solid var(--frame);
    }
}
.day-header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--muted);
    background: color-mix(in srgb, var(--iob-paper, Canvas) 92%, currentColor);
    border-bottom: 1px solid var(--frame);
}
.day-sum {
    text-transform: none;
    font-variant-numeric: tabular-nums;
}
.trip.selected,
.trip.selected:hover {
    background: color-mix(in srgb, var(--iob-primary) 16%, transparent);
    box-shadow: inset 3px 0 0 var(--iob-primary);
}
.trip:focus {
    outline: none;
}
.trip:focus-visible {
    outline: 2px solid var(--iob-primary);
    outline-offset: -2px;
}
.trip.running .trip-when {
    align-items: center;
}
.trip.no-track .trip-route {
    color: var(--muted);
}
.browser .live-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--iob-success);
    animation: trip-blink 1.6s ease-in-out infinite;
}
.list-note {
    padding: 12px 10px;
    text-align: center;
    font-size: 13px;
    color: var(--muted);
}
.list-note.error {
    color: var(--iob-error);
}
.more {
    display: block;
    width: calc(100% - 20px);
    margin: 10px;
    padding: 6px 10px;
    border: 1px solid var(--frame);
    border-radius: var(--iob-border-radius, 4px);
    background: transparent;
    color: var(--iob-primary);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}
.more:hover {
    background: var(--tint);
}
.browser-map .hint {
    position: absolute;
    inset: 0;
}
`;

/** `<iob-trips-browser>` */
export const BROWSER_STYLES = `${COMMON}${BASE}${LEAFLET_CSS}${MAP}${DETAILS}${LIST}${BROWSER}`;

/** `<iob-trips-diagnostics>`: compact tables in the theme of the host, scrolling inside the box */
const DIAGNOSTICS = `
.diag {
    overflow: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 13px;
    line-height: 1.4;
}
.muted {
    color: var(--muted);
}
.small {
    font-size: 11px;
}
.nowrap {
    white-space: nowrap;
}
.banner {
    padding: 6px 10px;
    border-radius: var(--iob-border-radius, 4px);
    background: color-mix(in srgb, var(--iob-warning) 16%, transparent);
    color: var(--iob-text);
    border: 1px solid color-mix(in srgb, var(--iob-warning) 50%, transparent);
}
.object {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--frame);
    border-radius: calc(var(--iob-border-radius, 4px) * 2);
}
.object.single {
    padding: 0;
    border: none;
}
.object-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
}
.object-name {
    font-size: 16px;
    font-weight: 700;
}
.object-type {
    color: var(--muted);
}
.block-title,
.card-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
}
.block-title {
    margin-top: 4px;
}
.badges {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
}
.badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    background: var(--hover);
    color: var(--iob-text);
}
.badge.primary {
    background: var(--iob-primary);
    color: var(--iob-primary-contrast);
}
.badge.ok,
.badge.phase-trip {
    background: color-mix(in srgb, var(--iob-success) 22%, transparent);
    color: color-mix(in srgb, var(--iob-success) 70%, var(--iob-text));
}
.badge.warn,
.badge.phase-starting {
    background: color-mix(in srgb, var(--iob-warning) 24%, transparent);
    color: color-mix(in srgb, var(--iob-warning) 65%, var(--iob-text));
}
.badge.error {
    background: var(--iob-error);
    color: #fff;
}
.badge.neutral,
.badge.phase-parked {
    background: var(--hover);
    color: var(--muted);
}
.object-header .badge.phase {
    font-size: 12px;
    padding: 2px 10px;
}
.table-wrap {
    overflow-x: auto;
    max-width: 100%;
}
table {
    border-collapse: collapse;
}
.grid {
    width: 100%;
}
.grid th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
    padding: 4px 8px;
    border-bottom: 1px solid var(--frame);
}
.grid td {
    padding: 4px 8px;
    vertical-align: top;
    border-bottom: 1px solid var(--frame);
}
.grid .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
}
.sources > tbody.active > tr.source-row > td {
    background: color-mix(in srgb, var(--iob-primary) 9%, transparent);
}
.sources > tbody.active > tr.source-row > td:first-child {
    box-shadow: inset 3px 0 0 var(--iob-primary);
}
.source-label {
    font-weight: 600;
    max-width: 280px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.states-row > td {
    padding-top: 0;
    padding-bottom: 8px;
}
.states {
    font-size: 12px;
}
.states th,
.states td {
    border-bottom-color: color-mix(in srgb, currentColor 8%, transparent);
    padding: 2px 8px;
}
.states .value {
    max-width: 220px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
}
.states .missing,
.stale,
.warn-text {
    color: var(--iob-warning);
    font-weight: 600;
}
.counts {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    font-size: 12px;
}
.count b {
    font-variant-numeric: tabular-nums;
}
.state-id {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    min-width: 0;
}
.state-id code {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    user-select: all;
    -webkit-user-select: all;
}
.copy {
    flex: none;
    display: inline-flex;
    padding: 2px;
    border: none;
    border-radius: var(--iob-border-radius, 4px);
    background: transparent;
    color: var(--faint);
    cursor: pointer;
}
.copy:hover {
    background: var(--hover);
    color: inherit;
}
.copy.copied {
    color: var(--iob-success);
}
.copy svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
}
.ignition,
.inputs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
}
.inputs-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
}
.input {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 10px;
    align-items: start;
}
.card {
    padding: 8px 10px;
    border-radius: calc(var(--iob-border-radius, 4px) * 2);
    background: var(--tint);
    min-width: 0;
}
.card-title {
    margin-bottom: 4px;
}
.kv {
    width: 100%;
}
.kv th {
    text-align: left;
    font-weight: 400;
    color: var(--muted);
    padding: 2px 10px 2px 0;
    vertical-align: top;
    width: 45%;
}
.kv td {
    padding: 2px 0;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
}
.kv tr.warn td {
    color: var(--iob-warning);
    font-weight: 600;
}
.general {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
`;

/** `<iob-trips-diagnostics>` */
export const DIAGNOSTICS_STYLES = `${COMMON}${BASE}${DIAGNOSTICS}`;
