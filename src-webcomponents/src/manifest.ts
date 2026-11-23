/**
 * The manifests of the two components. Read by the build only (`vite.config.ts`), which writes each one as
 * `<name>.json` next to its module - a host reads that file for its palette and its settings without loading the
 * module. The texts come from `dictionary.ts`, in every language.
 */
import type { WebComponentManifest, WebComponentText } from '@iobroker/web-components';

// with the extension: `vite.config.ts` imports this file, and Vite may load its config natively
import {
    DEFAULT_COUNT,
    DEFAULT_INSTANCE,
    DEFAULT_TILE_URL,
    getIconFile,
    getModuleFile,
    TAGS,
    type ComponentName,
} from './constants.ts';
import type { WordKey } from './dictionary.ts';

/** A word of the dictionary in every language, given by the build */
export type ManifestWord = (key: WordKey) => WebComponentText;

/** The instance whose objects the setting `object` offers: the one of the setting `instance` */

const INSTANCE_PATTERN = '${data.instance}';

function settings(name: ComponentName, word: ManifestWord): WebComponentManifest['settings'] {
    const instance = {
        type: 'instance',
        adapter: 'trips',
        default: DEFAULT_INSTANCE,
        label: word('instance'),
    } as const;
    // the options are the names of the objects of the instance (`[{ label, value }]`); the element finds the object
    // by its name or its ID with `getObjects`. A host without `selectSendTo` shows a text field
    const object = {
        type: 'selectSendTo',
        command: 'getObjectNames',
        instance: INSTANCE_PATTERN,
        // only the running objects
        data: { enabled: true },
        label: word('object'),
        help: word('object_help'),
    } as const;
    const map = {
        _map: { type: 'header', text: word('map_header') },
        tileUrl: {
            type: 'text',
            default: DEFAULT_TILE_URL,
            label: word('tile_url'),
            help: word('tile_url_help'),
        },
        attribution: { type: 'text', label: word('attribution'), help: word('attribution_help') },
    } as const;

    switch (name) {
        case 'trips-map':
            return {
                type: 'panel',
                items: {
                    instance,
                    object,
                    mode: {
                        type: 'select',
                        default: 'live',
                        label: word('mode'),
                        options: [
                            { value: 'live', label: word('mode_live') },
                            { value: 'last', label: word('mode_last') },
                        ],
                    },
                    showInfo: { type: 'checkbox', default: true, label: word('show_info') },
                    showStops: { type: 'checkbox', default: true, label: word('show_stops') },
                    ...map,
                },
            };

        case 'trips-list':
            return {
                type: 'panel',
                items: {
                    instance,
                    object,
                    count: { type: 'number', default: DEFAULT_COUNT, min: 1, max: 100, label: word('count') },
                    // the map of the dialog
                    ...map,
                },
            };
    }
}

/** The size each one looks good in as a tile of a dashboard */
const SIZES: Record<ComponentName, { width: number; height: number }> = {
    'trips-map': { width: 400, height: 300 },
    'trips-list': { width: 360, height: 320 },
};

/** Name and description of each one in the dictionary */
const TEXTS: Record<ComponentName, { name: WordKey; description: WordKey }> = {
    'trips-map': { name: 'map_name', description: 'map_description' },
    'trips-list': { name: 'list_name', description: 'list_description' },
};

/**
 * The manifest of one component
 *
 * @param name the component
 * @param word a word of the dictionary in every language
 */
export function buildManifest(name: ComponentName, word: ManifestWord): WebComponentManifest {
    return {
        $schema: 'https://raw.githubusercontent.com/ioBroker/web-components/main/schemas/manifest.json',
        manifestVersion: 1,
        tag: TAGS[name],
        name: word(TEXTS[name].name),
        description: word(TEXTS[name].description),
        icon: getIconFile(name),
        module: getModuleFile(name),
        size: SIZES[name],
        settings: settings(name, word),
    };
}
