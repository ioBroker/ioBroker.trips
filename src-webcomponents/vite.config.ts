import react from '@vitejs/plugin-react';
import { checkManifest, getReactImportPath, REACT_SPECIFIERS, type WebComponentText } from '@iobroker/web-components';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin, UserConfig } from 'vite';

// with the extension: Vite may load its config natively, without a bundler that would add it
import {
    COMPONENT_NAMES,
    getIconFile,
    getManifestFile,
    getModuleFile,
    getModulePath,
    type ComponentName,
} from './src/constants.ts';
import { WORDS, type WordKey } from './src/dictionary.ts';
import { buildManifest } from './src/manifest.ts';
import { COMPONENT_WORDS } from './src/wordKeys.ts';

/**
 * The web components `<iob-trips-map>`, `<iob-trips-list>`, `<iob-trips-browser>` and `<iob-trips-diagnostics>`:
 * one ES module each, `admin/webcomponents/<name>.js`, its manifest `<name>.json` and its icon `<name>.svg` next to
 * it (`common.webComponents`). Every host - vis-2, devices, Aura, admin - reads them from
 * `/adapter/trips/webcomponents/`. No module federation: the host shares nothing but the socket.
 *
 * One build per component - `vite build --mode <name>` (`npm run build` runs all): a host imports exactly one URL
 * per component, so each module is one file, with the shared code (and Leaflet) compiled into each. One build with
 * several entries would move the shared code into chunks of their own.
 *
 * React is not bundled: the four React imports point at `lib/esm/react-19.js`, which web and admin serve beside
 * `adapter/`. The path is relative to the module, so a path prefix of a reverse proxy stays.
 */

const LANGUAGES: ioBroker.Languages[] = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];

/** The module of each component */
const ENTRIES: Record<ComponentName, string> = {
    'trips-map': './src/TripsMap.tsx',
    'trips-list': './src/TripsList.tsx',
    'trips-browser': './src/TripsBrowser.tsx',
    'trips-diagnostics': './src/TripsDiagnostics.tsx',
};

type Dictionary = Record<string, string>;

/**
 * A word in every language, or an error naming what is missing
 *
 * @param key the key in `dictionary.ts`
 */
function word(key: WordKey): Dictionary {
    const texts: Dictionary = {};
    for (const lang of LANGUAGES) {
        const value = (WORDS[key] as Partial<Record<ioBroker.Languages, string>> | undefined)?.[lang];
        if (!value) {
            throw new Error(`dictionary.ts: "${key}" has no text in "${lang}"`);
        }
        texts[lang] = value;
    }
    return texts;
}

/**
 * The words of the element, by language - only these are compiled into its module
 *
 * @param keys the words it shows
 */
function pickWords(keys: readonly WordKey[]): Record<string, Dictionary> {
    const words = Object.fromEntries(keys.map(key => [key, word(key)]));
    return Object.fromEntries(
        LANGUAGES.map(lang => [lang, Object.fromEntries(keys.map(key => [key, words[key][lang]]))]),
    );
}

/**
 * Writes `<name>.json` next to the module, checked like a host checks it, and the icon of the component
 *
 * @param name the component
 */
function manifestFile(name: ComponentName): Plugin {
    return {
        name: 'trips-web-component-manifest',
        generateBundle() {
            let manifest;
            try {
                manifest = buildManifest(name, (key): WebComponentText => word(key));
            } catch (e) {
                this.error(`${getManifestFile(name)}: ${(e as Error).message}`);
            }
            const problem = checkManifest(manifest);
            if (problem) {
                this.error(`${getManifestFile(name)}: ${problem}`);
            }
            if (manifest.module !== getModuleFile(name)) {
                this.error(`${getManifestFile(name)}: "module" must be "${getModuleFile(name)}"`);
            }
            this.emitFile({
                type: 'asset',
                fileName: getManifestFile(name),
                source: `${JSON.stringify(manifest, null, 4)}\n`,
            });
            this.emitFile({
                type: 'asset',
                fileName: getIconFile(name),
                source: readFileSync(new URL(`./src/icons/${getIconFile(name)}`, import.meta.url)),
            });
        },
    };
}

/**
 * Leaflet's CSS without its pictures: a library build would inline them as `data:` URLs, and nothing here uses
 * them - the markers are circles and `divIcon`s, and there is no layer control. Runs before the CSS of Vite.
 */
function leafletCssWithoutImages(): Plugin {
    return {
        name: 'trips-leaflet-css-without-images',
        enforce: 'pre',
        transform(code, id) {
            if (!id.replace(/\\/g, '/').includes('/leaflet/dist/leaflet.css')) {
                return null;
            }
            return { code: code.replace(/[\w-]+\s*:\s*url\([^)]*\)\s*;?/g, ''), map: null };
        },
    };
}

export default ({ mode }: { mode: string }): UserConfig => {
    const name = COMPONENT_NAMES.find(component => component === mode);
    if (!name) {
        throw new Error(`Build one component at a time: vite build --mode <${COMPONENT_NAMES.join('|')}>`);
    }
    const reactImport = getReactImportPath(getModulePath(name));

    return {
        plugins: [leafletCssWithoutImages(), react(), manifestFile(name)],
        resolve: {
            alias: [
                {
                    // Leaflet 1.9 names only its UMD build in `main`: that one sets `window.L` - the Leaflet of the
                    // host page, e.g. of a vis-2 widget with its plugins - and cannot be tree-shaken. The ES module
                    // build does neither
                    find: /^leaflet$/,
                    replacement: fileURLToPath(
                        new URL('./node_modules/leaflet/dist/leaflet-src.esm.js', import.meta.url),
                    ),
                },
            ],
        },
        define: {
            __TRIPS_WORDS__: JSON.stringify(pickWords(COMPONENT_WORDS[name])),
            'process.env.NODE_ENV': JSON.stringify('production'),
        },
        build: {
            target: 'es2022',
            outDir: './build',
            // the builds of all components write into the same folder: only the first one empties it
            emptyOutDir: name === COMPONENT_NAMES[0],
            lib: {
                entry: ENTRIES[name],
                formats: ['es'],
                fileName: (): string => getModuleFile(name),
            },
            rollupOptions: {
                external: [...REACT_SPECIFIERS],
                output: {
                    paths: Object.fromEntries(REACT_SPECIFIERS.map(specifier => [specifier, reactImport])),
                    // one file: a host imports exactly one URL
                    codeSplitting: false,
                    // library mode keeps whitespace for the bundler of a consumer; this module is loaded as it is
                    minify: true,
                },
            },
        },
    };
};
