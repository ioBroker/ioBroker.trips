/**
 * The instance of the adapter and the object the settings name. What every element needs - nothing else in here.
 */

/**
 * `trips.0` from what an `instance` setting holds: `trips.0`, `system.adapter.trips.0` or `0`
 *
 * @param instance the value of the setting
 * @returns null if it names no instance of the adapter
 */
export function toInstance(instance: string | undefined | null): string | null {
    const match = String(instance ?? '')
        .trim()
        .match(/^(?:system\.adapter\.)?(?:trips\.)?(\d+)$/);
    return match ? `trips.${match[1]}` : null;
}

/**
 * The instance and the object of the settings. `object` is the name or the ID of the object below the instance
 * (`Car`), or its full ID (`trips.0.Car`, or a state below it), which names the instance too.
 *
 * @param settings the settings of the element
 * @param settings.instance the setting `instance`
 * @param settings.object the setting `object`
 * @returns the instance, null if none is named; the wanted object, empty for "the first one"
 */
export function toTarget(settings: { instance?: string; object?: string }): {
    instance: string | null;
    object: string;
} {
    const object = String(settings.object ?? '').trim();
    const full = object.match(/^trips\.(\d+)\.([^.]+)/);
    if (full) {
        return { instance: `trips.${full[1]}`, object: full[2] };
    }
    return { instance: toInstance(settings.instance), object };
}
