import type { JSX } from 'react';

/** A folded map: the picture of the hint of the map */
const MAP_PATH =
    'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M15 19l-6-2.11V5l6 2.11z';

/** A route between two points: the picture of the hint of the list */
const ROUTE_PATH =
    'M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82';

/**
 * A hint instead of the content: a setting is missing, names nothing of the adapter, or there is nothing to show
 *
 * @param props what to say
 * @param props.text the hint
 * @param props.icon the picture above it
 * @param props.editMode in edit mode the element takes no clicks
 */
export function Hint({
    text,
    icon,
    editMode,
}: {
    text: string;
    icon: 'map' | 'route';
    editMode: boolean;
}): JSX.Element {
    return (
        <div className={`hint${editMode ? ' edit' : ''}`}>
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path d={icon === 'map' ? MAP_PATH : ROUTE_PATH} />
            </svg>
            <span>{text}</span>
        </div>
    );
}
