import type { JSX } from 'react';

/** The picture above a hint: a map, a route, or a pulse for the diagnostics */
export type HintIcon = 'map' | 'route' | 'pulse';

const PATHS: Record<HintIcon, string> = {
    // a folded map
    map: 'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M15 19l-6-2.11V5l6 2.11z',
    // a route between two points
    route: 'M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82',
    // a pulse line
    pulse: 'M9.3 20.6 6.8 13H2v-2h6.2l1.2 3.6 4.2-11.9L16.2 11H22v2h-7.2l-1.1-3.3z',
};

/**
 * A hint instead of the content: a setting is missing, names nothing of the adapter, or there is nothing to show
 *
 * @param props what to say
 * @param props.text the hint
 * @param props.icon the picture above it
 * @param props.editMode in edit mode the element takes no clicks
 */
export function Hint({ text, icon, editMode }: { text: string; icon: HintIcon; editMode: boolean }): JSX.Element {
    return (
        <div className={`hint${editMode ? ' edit' : ''}`}>
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path d={PATHS[icon]} />
            </svg>
            <span>{text}</span>
        </div>
    );
}
