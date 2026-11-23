/**
 * What both elements share: the shadow root with React, the instance and the object of the settings, and the
 * objects of the instance (`getObjects`), read once per instance and socket.
 */
import type { JSX } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import type { WebComponentSocket } from '@iobroker/web-components';
import { IobWebComponent } from '@iobroker/web-components/element';

import { Hint } from './Hint';
import { toTarget } from './instance';
import { findObject, loadObjects, NoAnswerError, type TripObject } from './trips';
import { getWord, type Word } from './words';

/** A request that failed is made again after this time, in ms: the instance may have been stopped */
export const RETRY_DELAY = 30_000;

/** The settings both elements have */
export type TargetSettings = { instance?: string; object?: string };

/** The instance and the object the settings name - or what to say instead */
export type Target =
    | { status: 'ok'; instance: string; object: TripObject }
    | { status: 'loading'; instance: string }
    | { status: 'hint'; text: string };

/** The objects of one instance, as read with one socket */
interface ObjectsLoad {
    instance: string;
    socket: WebComponentSocket;
    objects: TripObject[] | null;
    error: string | null;
    failedAt: number;
}

export abstract class TripsElement<S extends TargetSettings> extends IobWebComponent<S> {
    protected readonly root: Root;

    #objects: ObjectsLoad | null = null;

    readonly #timers = new Set<ReturnType<typeof setTimeout>>();

    protected constructor(styles: string) {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        const mount = document.createElement('div');
        mount.className = 'mount';
        shadow.append(style, mount);
        this.root = createRoot(mount);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        for (const timer of this.#timers) {
            clearTimeout(timer);
        }
        this.#timers.clear();
    }

    protected get word(): Word {
        return getWord(this.systemLang);
    }

    /** Ask the base class for the states again: setting the same settings is what makes it ask */
    protected refresh(): void {
        // eslint-disable-next-line no-self-assign
        this.settings = this.settings;
    }

    /**
     * Draw again after a while, while the element is in the document
     *
     * @param delay in ms
     */
    protected later(delay: number): void {
        const timer = setTimeout(() => {
            this.#timers.delete(timer);
            this.refresh();
        }, delay);
        this.#timers.add(timer);
    }

    /** The text of an error of a request */
    protected errorText(e: unknown): string {
        if (e instanceof NoAnswerError) {
            return this.word('no_answer', e.instance);
        }
        return e instanceof Error ? e.message : String(e);
    }

    /**
     * The instance and the object of the settings
     *
     * @param settings the settings of the element
     */
    protected getTarget(settings: S): Target {
        const word = this.word;
        const { instance, object } = toTarget(settings);
        if (!instance) {
            return { status: 'hint', text: word('choose_instance') };
        }
        const load = this.#objects;
        if (!this.socket || load?.instance !== instance || load.socket !== this.socket) {
            return { status: 'loading', instance };
        }
        if (load.error) {
            return { status: 'hint', text: load.error };
        }
        if (!load.objects) {
            return { status: 'loading', instance };
        }
        if (!load.objects.length) {
            return { status: 'hint', text: word('no_objects', instance) };
        }
        const found = findObject(load.objects, object);
        return found
            ? { status: 'ok', instance, object: found }
            : { status: 'hint', text: word('object_not_found', instance, object) };
    }

    /** Read the objects of the instance once - again only for another instance or socket, or a while after an error */
    protected loadObjects(): void {
        const socket = this.socket;
        const { instance } = toTarget(this.settings);
        if (!socket || !instance) {
            return;
        }
        const previous = this.#objects;
        if (
            previous?.instance === instance &&
            previous.socket === socket &&
            (!previous.error || Date.now() - previous.failedAt < RETRY_DELAY)
        ) {
            return;
        }
        const load: ObjectsLoad = { instance, socket, objects: null, error: null, failedAt: 0 };
        this.#objects = load;
        loadObjects(socket, instance)
            .then(objects => {
                if (this.#objects === load) {
                    load.objects = objects;
                    // the states depend on the object
                    this.refresh();
                }
            })
            .catch((e: unknown) => {
                if (this.#objects === load) {
                    load.error = this.errorText(e);
                    load.failedAt = Date.now();
                    this.refresh();
                    this.later(RETRY_DELAY);
                }
            });
    }

    /**
     * A hint instead of the content
     *
     * @param text what to say
     * @param icon the picture above it
     */
    protected renderHint(text: string, icon: 'map' | 'route'): JSX.Element {
        return (
            <Hint
                text={text}
                icon={icon}
                editMode={this.editMode}
            />
        );
    }
}
