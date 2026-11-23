/**
 * The web components of the Trips adapter. Each one is built on its own (`vite build --mode <name>`, see
 * `vite.config.ts`), so that each is ONE module file: a host imports exactly one URL per component.
 *
 * This file is read by the build too: no imports, nothing but plain TypeScript.
 */

/** Name of a component: the mode of its build and the base name of its files */
export type ComponentName = 'trips-map' | 'trips-list' | 'trips-browser' | 'trips-diagnostics';

export const COMPONENT_NAMES: ComponentName[] = ['trips-map', 'trips-list', 'trips-browser', 'trips-diagnostics'];

/*
 * trips-browser and trips-diagnostics are made for the tab of the adapter in admin (a jsonConfig `custom` item
 * with `webComponent`), and are listed for vis as well.
 */

/** `<iob-trips-map>`: the running or the last trip of one object on a map */
export const MAP_TAG = 'iob-trips-map';

/** `<iob-trips-list>`: the last trips of one object; a click shows one on a map */
export const LIST_TAG = 'iob-trips-list';

/**
 * Event of a click on a trip of the list, dispatched before the element opens its dialog: a host that answers it
 * itself calls `preventDefault()`, and the element opens nothing. `detail`: `{ instance, object, trip }`
 */
export const LIST_CLICK_EVENT = 'trips-list-click';

/** `<iob-trips-browser>`: all trips of one object, page by page, and the selected one on a map */
export const BROWSER_TAG = 'iob-trips-browser';

/** `<iob-trips-diagnostics>`: what the adapter reads from where and what it made of it */
export const DIAGNOSTICS_TAG = 'iob-trips-diagnostics';

/** The tag of each component */
export const TAGS: Record<ComponentName, string> = {
    'trips-map': MAP_TAG,
    'trips-list': LIST_TAG,
    'trips-browser': BROWSER_TAG,
    'trips-diagnostics': DIAGNOSTICS_TAG,
};

/** The built module, next to its manifest */
export function getModuleFile(name: ComponentName): string {
    return `${name}.js`;
}

/** The manifest the build writes next to the module; `common.webComponents` names this one */
export function getManifestFile(name: ComponentName): string {
    return `${name}.json`;
}

/** The picture of the component, emitted next to the manifest by the build */
export function getIconFile(name: ComponentName): string {
    return `${name}.svg`;
}

/** Where `tasks.mjs` puts the module in the admin folder; the React import is relative to it */
export function getModulePath(name: ComponentName): string {
    return `webcomponents/${getModuleFile(name)}`;
}

/** The instance the settings start with */
export const DEFAULT_INSTANCE = 'trips.0';

/** The tiles of OpenStreetMap: used when the setting `tileUrl` is empty */
export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** The number of trips the list shows by default */
export const DEFAULT_COUNT = 10;

/** The values of the settings of `<iob-trips-map>`; a setting without a value is missing */
export type MapSettings = {
    /** e.g. `trips.0` */
    instance?: string;
    /** Name or ID of the object below the instance (`Car`), or its full ID (`trips.0.Car`); empty: the first one */
    object?: string;
    /** `live`: the running trip and the position, else the last trip; `last`: always the last finished trip */
    mode?: 'live' | 'last';
    /** Tile server with `{z}`, `{x}`, `{y}` (and `{s}`); empty: OpenStreetMap */
    tileUrl?: string;
    /** Text of the attribution; empty: OpenStreetMap */
    attribution?: string;
    /** Distance, duration and average speed above the map */
    showInfo?: boolean;
    /** The stops of the trip as markers */
    showStops?: boolean;
};

/** The values of the settings of `<iob-trips-list>`; a setting without a value is missing */
export type ListSettings = {
    instance?: string;
    object?: string;
    /** How many trips, newest first */
    count?: number;
    /** The map of the dialog */
    tileUrl?: string;
    attribution?: string;
};

/** The values of the settings of `<iob-trips-browser>` */
export type BrowserSettings = {
    instance?: string;
    /** Empty: the element offers the objects of the instance and remembers the choice */
    object?: string;
    tileUrl?: string;
    attribution?: string;
};

/** The values of the settings of `<iob-trips-diagnostics>` */
export type DiagnosticsSettings = {
    instance?: string;
    /** Empty: all objects */
    object?: string;
};

/** The browser reads the trips in pages of this size */
export const PAGE_SIZE = 50;

/** The diagnostics are read again after this time, in ms */
export const DIAGNOSTICS_INTERVAL = 3_000;
