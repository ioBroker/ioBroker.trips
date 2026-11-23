import type { DistanceUnit, ObjectType, SpeedUnit, TrackedObjectConfig } from '../types';
import { SPEED_UNIT_OF, toMs } from './geo';
import type { DetectorSettings } from './tripDetector';
import type { WatchSettings } from './watch';

interface TypeDefaults {
    unit: DistanceUnit;
    /** in the speed unit of `unit` */
    startSpeed: number;
    startSeconds: number;
    startDistance: number;
    stopRadius: number;
    minStopSeconds: number;
    tripEndMinutes: number;
    minDistance: number;
    maxAccuracy: number;
    /** in the speed unit of `unit` */
    maxSpeed: number;
    ignition: boolean;
    /** Meters of the anchor/position watch */
    watchRadius: number;
    /** Minutes without positions that are an alarm of the watch */
    watchSignalMinutes: number;
}

/**
 * Defaults per object type. Boats swing at anchor in a circle of ~100 m and move slowly,
 * phones report rarely and inaccurately, so they need larger radii and longer times than a car.
 */
export const TYPE_DEFAULTS: Record<ObjectType, TypeDefaults> = {
    car: {
        unit: 'km',
        startSpeed: 8,
        startSeconds: 20,
        startDistance: 200,
        stopRadius: 50,
        minStopSeconds: 120,
        tripEndMinutes: 5,
        minDistance: 15,
        maxAccuracy: 50,
        maxSpeed: 300,
        ignition: true,
        watchRadius: 100,
        watchSignalMinutes: 30,
    },
    boat: {
        unit: 'nm',
        startSpeed: 1.5,
        startSeconds: 60,
        startDistance: 200,
        stopRadius: 100,
        minStopSeconds: 300,
        tripEndMinutes: 30,
        minDistance: 10,
        maxAccuracy: 50,
        maxSpeed: 60,
        ignition: false,
        watchRadius: 50,
        watchSignalMinutes: 5,
    },
    person: {
        unit: 'km',
        startSpeed: 3,
        startSeconds: 60,
        startDistance: 250,
        stopRadius: 75,
        minStopSeconds: 300,
        tripEndMinutes: 10,
        minDistance: 20,
        maxAccuracy: 100,
        maxSpeed: 1000,
        ignition: false,
        watchRadius: 200,
        watchSignalMinutes: 60,
    },
    other: {
        unit: 'km',
        startSpeed: 5,
        startSeconds: 30,
        startDistance: 200,
        stopRadius: 50,
        minStopSeconds: 180,
        tripEndMinutes: 5,
        minDistance: 15,
        maxAccuracy: 50,
        maxSpeed: 300,
        ignition: false,
        watchRadius: 100,
        watchSignalMinutes: 30,
    },
};

/** Default kg CO₂ per unit: petrol per liter, German electricity mix per kWh */
export const CO2_DEFAULTS: Record<string, number> = {
    l: 2.37,
    kWh: 0.38,
};

/** A number from the configuration, or the default if empty or invalid */
export function configNumber(value: unknown, def: number): number {
    if (value === '' || value === null || value === undefined) {
        return def;
    }
    if (typeof value !== 'number' && typeof value !== 'string') {
        return def;
    }
    const num = typeof value === 'number' ? value : parseFloat(value.replace(',', '.'));
    return Number.isFinite(num) ? num : def;
}

export interface ObjectSettings {
    type: ObjectType;
    unit: DistanceUnit;
    speedUnit: SpeedUnit;
    detector: DetectorSettings;
    watch: WatchSettings & { radius: number };
}

export function objectSettings(config: TrackedObjectConfig): ObjectSettings {
    const type: ObjectType = TYPE_DEFAULTS[config.type] ? config.type : 'other';
    const d = TYPE_DEFAULTS[type];
    const unit: DistanceUnit = config.distanceUnit || d.unit;
    const speedUnit = SPEED_UNIT_OF[unit];
    // the defaults are in the unit of the type: convert them, if the user chose another unit
    const defaultSpeedUnit = SPEED_UNIT_OF[d.unit];
    const startSpeedDefault = toMs(d.startSpeed, defaultSpeedUnit);
    const maxSpeedDefault = toMs(d.maxSpeed, defaultSpeedUnit);
    const startSpeed =
        config.startSpeed === '' || config.startSpeed === undefined ? null : configNumber(config.startSpeed, NaN);
    const maxSpeed =
        config.maxSpeed === '' || config.maxSpeed === undefined ? null : configNumber(config.maxSpeed, NaN);
    const tripEndMinutes = configNumber(config.tripEndMinutes, d.tripEndMinutes);

    return {
        type,
        unit,
        speedUnit,
        detector: {
            startSpeed:
                startSpeed !== null && Number.isFinite(startSpeed) && startSpeed > 0
                    ? toMs(startSpeed, speedUnit)
                    : startSpeedDefault,
            startSeconds: Math.max(0, configNumber(config.startSeconds, d.startSeconds)),
            startDistance: Math.max(10, configNumber(config.startDistance, d.startDistance)),
            stopRadius: Math.max(5, configNumber(config.stopRadius, d.stopRadius)),
            minStopSeconds: Math.max(0, configNumber(config.minStopSeconds, d.minStopSeconds)),
            tripEndSeconds: Math.max(30, tripEndMinutes * 60),
            minDistance: Math.max(0, configNumber(config.minDistance, d.minDistance)),
            maxAccuracy: Math.max(1, configNumber(config.maxAccuracy, d.maxAccuracy)),
            maxSpeed:
                maxSpeed !== null && Number.isFinite(maxSpeed) && maxSpeed > 0
                    ? toMs(maxSpeed, speedUnit)
                    : maxSpeedDefault,
            useIgnition: type === 'car' && config.useIgnition !== false,
            ignitionOffSeconds: 120,
            maxGapSeconds: Math.max(3600, tripEndMinutes * 60),
        },
        watch: {
            radius: Math.max(5, configNumber(config.watchRadius, d.watchRadius)),
            confirmFixes: 3,
            signalLostSeconds: Math.max(0, configNumber(config.watchSignalMinutes, d.watchSignalMinutes)) * 60,
        },
    };
}
