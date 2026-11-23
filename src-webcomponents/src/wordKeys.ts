/**
 * The words each element shows. The build compiles only these into its module (`__TRIPS_WORDS__`, see
 * `vite.config.ts`), in every language, from `dictionary.ts`. The words of the manifests are not in the modules.
 *
 * This file is read by the build too: type imports only, nothing but plain TypeScript.
 */
import type { ComponentName } from './constants.ts';
import type { WordKey } from './dictionary.ts';

/** What every element says while it cannot show its object */
const HINT_WORDS = ['choose_instance', 'no_objects', 'object_not_found', 'no_answer', 'no_trips'] as const;

/** The map of a trip: the track, its markers and the box with the numbers - the map element and the list dialog */
const MAP_VIEW_WORDS = [
    'no_track',
    'running',
    'since',
    'distance',
    'duration',
    'avg_speed',
    'start',
    'destination',
    'stop',
    'position',
    'last_position',
    'fit',
] as const;

const MAP_WORDS = [...HINT_WORDS, ...MAP_VIEW_WORDS] as const;

const LIST_WORDS = [...HINT_WORDS, ...MAP_VIEW_WORDS, 'consumption', 'cost', 'show_on_map'] as const;

/** A word an element shows */
export type ElementWordKey = (typeof MAP_WORDS)[number] | (typeof LIST_WORDS)[number];

/** The words compiled into the module of each component */
export const COMPONENT_WORDS: Record<ComponentName, readonly WordKey[]> = {
    'trips-map': MAP_WORDS,
    'trips-list': LIST_WORDS,
};
