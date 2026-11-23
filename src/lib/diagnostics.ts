/**
 * Answer of the message `getDiagnostics`: what the adapter reads and what it made of it, per object.
 * Distances in meters, speeds in m/s, times as ms since 1970 unless said otherwise. Positions are not filtered by the
 * privacy zones: this is for the owner in admin.
 */

export type SourceStateRole =
    'position' | 'latitude' | 'longitude' | 'speed' | 'ignition' | 'accuracy' | 'altitude' | 'timestamp' | 'alive';

/** One state a source reads */
export interface DiagnosticsSourceState {
    role: SourceStateRole;
    id: string;
    /** The last value the adapter got, null if none */
    val: ioBroker.StateValue | null;
    /** Time stamp of that value */
    ts: number | null;
    /** Last change of that value */
    lc: number | null;
    /** speed: km/h, kn, m/s or mph; accuracy: meters or hdop; position: latlon, lonlat or json */
    format?: string;
}

/** What happened to the positions of a source since the start of the adapter */
export interface DiagnosticsCounts {
    /** Used for the trip detection */
    accepted?: number;
    /** A source with a better priority delivered fresh positions */
    unused?: number;
    /** Accuracy worse than `maxAccuracy` */
    inaccurate?: number;
    /** Not newer than the last position */
    old?: number;
    /** A jump with an impossible speed */
    outlier?: number;
    /** No valid coordinates */
    invalid?: number;
    /** Positions that only confirmed the last one (serial-gps with minDistance), part of the others */
    confirmed?: number;
}

export interface DiagnosticsPosition {
    ts: number;
    lat: number;
    lon: number;
    speed?: number | null;
    accuracy?: number | null;
    alt?: number | null;
}

export interface DiagnosticsSource {
    /** e.g. `nmea.0` or the ID of the position state */
    label: string;
    /** generic, nmea, serial-gps, teltonika */
    type: string;
    /** 1 is the best */
    priority: number;
    /** Seconds after which a position of this source is too old for the fusion */
    maxAge: number;
    /** The positions of this source are used now */
    active: boolean;
    /** The last position is younger than maxAge */
    fresh: boolean;
    lastFix: DiagnosticsPosition | null;
    /** Wall clock of the last position */
    lastFixAt: number | null;
    /** Ignition/engine of this source, null if it has none or the value is unknown */
    ignition: boolean | null;
    ignitionTs: number | null;
    counts: DiagnosticsCounts;
    /** The result of the last position: a key of counts */
    lastResult: keyof DiagnosticsCounts | null;
    states: DiagnosticsSourceState[];
}

export interface DiagnosticsTrip {
    start: number;
    /** Time of the last position in the trip */
    last: number;
    /** movement, ignition, manual */
    reason: string;
    distance: number;
    /** ms */
    duration: number;
    /** ms without the stops */
    movingTime: number;
    avgSpeed: number;
    maxSpeed: number;
    /** ms with the engine on */
    engineTime: number;
    engineDistance: number;
    /** The engine state was known during the trip */
    engineKnown: boolean;
    points: number;
    stops: number;
    /** Gaps in the track (no positions for a long time, ferry) */
    gaps: number;
    /** Last position of the trip */
    lat: number | null;
    lon: number | null;
}

export interface DiagnosticsObject {
    id: string;
    name: string;
    /** car, boat, person, other */
    type: string;
    /** Units of the states of the object */
    distanceUnit: string;
    speedUnit: string;
    /** The settings in use, defaults of the type filled in; m, s and m/s */
    settings: {
        startSpeed: number;
        startSeconds: number;
        startDistance: number;
        stopRadius: number;
        minStopSeconds: number;
        tripEndSeconds: number;
        minDistance: number;
        maxAccuracy: number;
        maxSpeed: number;
        useIgnition: boolean;
    };
    sources: DiagnosticsSource[];
    /** Label of the source the ignition/engine comes from, null if none has one */
    ignitionSource: string | null;
    detector: {
        /** parked: no trip; starting: moving, but not long or far enough for a trip yet; trip: a trip is running */
        phase: 'parked' | 'starting' | 'trip';
        ignition: boolean | null;
        /** Started by hand with control.manualTrip */
        manual: boolean;
        /** The last position used for the detection */
        lastFix: DiagnosticsPosition | null;
        /** Wall clock of that position */
        lastReceived: number | null;
        /** Current speed estimation */
        speed: number;
        /** Moving since, while starting */
        movingSince: number | null;
        /** Parking position, outside a trip */
        parked: { ts: number; lat: number; lon: number } | null;
        /** Positions waiting for the start of a trip */
        pending: number;
        /** Positions that do not fit to the last one (up to three, then the object was moved) */
        suspects: number;
        trip: DiagnosticsTrip | null;
    };
    watch: {
        active: boolean;
        lat: number | null;
        lon: number | null;
        radius: number;
        distance: number | null;
        maxDistance: number;
        alarm: boolean;
        signalLost: boolean;
        since: number | null;
        /** Minutes without positions that are an alarm, 0 = off */
        signalMinutes: number;
        auto: boolean;
    };
    /** Measured consumption, null for none or an estimated one */
    meter: {
        mode: string;
        stateId: string;
        unit: string;
        running: boolean;
        /** In the running trip */
        used: number;
        last: { value: number; ts: number } | null;
        refills: number;
    } | null;
    /** Estimated consumption: distance or hours, with the value per 100 units or per hour */
    estimate: { mode: string; value: number; unit: string } | null;
    trips: {
        count: number;
        last: { id: string; start: number; end: number; distance: number } | null;
    };
    odometerStart: number | null;
    /** Further states the object reads when they are needed: the odometer of the logbook, the price of the consumption */
    inputs: { role: 'odometer' | 'price'; id: string }[];
}

export interface Diagnostics {
    /** Wall clock of the adapter, to compare the ages with */
    now: number;
    objects: DiagnosticsObject[];
    places: { name: string; radius: number; privacy: boolean; home: boolean }[];
    notificationInstance: string;
    /** Seconds */
    liveInterval: number;
}
