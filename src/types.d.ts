export type ObjectType = 'car' | 'boat' | 'person' | 'other';
export type DistanceUnit = 'km' | 'nm' | 'mi';
export type SpeedUnit = 'km/h' | 'kn' | 'm/s' | 'mph';
/** `generic` = the state IDs are configured by hand, the other types fill them from `baseId` */
export type SourceType = 'generic' | 'nmea' | 'serial-gps' | 'teltonika';
/** `separate` = two states latitude/longitude, `latlon` = "lat;lon", `lonlat` = "lon;lat", `json` = JSON object */
export type PositionFormat = 'separate' | 'latlon' | 'lonlat' | 'json';
export type AccuracyType = 'meters' | 'hdop';
export type ConsumptionMode = 'none' | 'distance' | 'hours';

/** Numbers coming from jsonConfig may be strings, an empty string means "default for the object type" */
type ConfigNumber = number | string;

export interface TrackedObjectConfig {
    enabled: boolean;
    /** Name of the object, used for the object ID too */
    name: string;
    type: ObjectType;
    /** Empty = default of the type: nm for boats, km for others */
    distanceUnit: DistanceUnit | '';
    /** Trips start and end with the ignition (car) instead of the movement */
    useIgnition: boolean;
    /** Speed (in the speed unit of the object) above which the object moves */
    startSpeed: ConfigNumber;
    /** Seconds the speed must stay above startSpeed to start a trip */
    startSeconds: ConfigNumber;
    /** Meters away from the parking position that start a trip, also with rare positions */
    startDistance: ConfigNumber;
    /** Meters: a position inside this radius counts as standing */
    stopRadius: ConfigNumber;
    /** Seconds of standing that are recorded as a stop inside a trip */
    minStopSeconds: ConfigNumber;
    /** Minutes of standing (or without positions) that end a trip */
    tripEndMinutes: ConfigNumber;
    /** Meters: smaller movements are GPS jitter and do not count for the distance */
    minDistance: ConfigNumber;
    /** Meters: positions with a worse accuracy are ignored */
    maxAccuracy: ConfigNumber;
    /** Speed (in the speed unit of the object) above which a jump is an outlier */
    maxSpeed: ConfigNumber;

    consumptionMode: ConsumptionMode;
    /** Consumption per 100 distance units or per hour */
    consumption: ConfigNumber;
    /** l or kWh */
    consumptionUnit: string;
    /** Price per consumption unit */
    price: ConfigNumber;
    /** Optional state with the current price (e.g. from tankerkoenig), wins over `price` */
    priceStateId: string;
    /** kg CO₂ per consumption unit */
    co2PerUnit: ConfigNumber;
    /** Send a summary after each trip */
    notify: boolean;
}

export interface SourceConfig {
    enabled: boolean;
    /** Name of the tracked object */
    object: string;
    type: SourceType;
    /** 1 is the best, sources with a better priority win as long as their position is fresh */
    priority: ConfigNumber;
    /** Instance or channel for the presets: `nmea.0`, `serial-gps.0`, `teltonika.0.<router>` */
    baseId: string;
    positionFormat: PositionFormat;
    latitudeId: string;
    longitudeId: string;
    positionId: string;
    speedId: string;
    speedUnit: SpeedUnit;
    /** Boolean ignition or a number like the engine RPM, > 0 is on */
    ignitionId: string;
    accuracyId: string;
    accuracyType: AccuracyType;
    altitudeId: string;
    /** Optional state with the time of the position, otherwise the time stamp of the state is used */
    timestampId: string;
    /** Seconds after which a position of this source is too old for the fusion */
    maxAge: ConfigNumber;
}

export interface PlaceConfig {
    name: string;
    latitude: ConfigNumber;
    longitude: ConfigNumber;
    /** Meters */
    radius: ConfigNumber;
    /** Positions inside are not stored */
    privacy: boolean;
}

export interface TripsAdapterConfig {
    objects: TrackedObjectConfig[];
    sources: SourceConfig[];
    places: PlaceConfig[];
    /** Name of the place used for the live distance to home */
    homePlace: string;
    currency: string;
    /** Reverse geocoding of start and destination with OpenStreetMap Nominatim */
    geocoding: boolean;
    /** Instance of a messenger adapter, e.g. `telegram.0` */
    notificationInstance: string;
    /** Optional user/recipient for the messenger */
    notificationUser: string;
    /** Trips shorter than this (in the distance unit of the object) are not notified */
    notificationMinDistance: ConfigNumber;
    /** Days after which tracks and coordinates are deleted, 0 = keep forever */
    retentionDays: ConfigNumber;
    /** Seconds between the updates of the live states */
    liveInterval: ConfigNumber;
}
