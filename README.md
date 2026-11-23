<img src="admin/trips.svg" style="width: 100px;"/>

# ioBroker.trips

![Number of Installations](http://iobroker.live/badges/trips-installed.svg)
![Number of Installations](http://iobroker.live/badges/trips-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.trips.svg)](https://www.npmjs.com/package/iobroker.trips)

![Test and Release](https://github.com/ioBroker/ioBroker.trips/workflows/Test%20and%20Release/badge.svg)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/trips/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)
[![Downloads](https://img.shields.io/npm/dm/iobroker.trips.svg)](https://www.npmjs.com/package/iobroker.trips)

Turns GPS positions into trips: for a car, a boat or a person. The adapter takes the positions from one or more
sources, filters the GPS jitter and outliers, detects the start and the end of each trip and calculates distance,
duration, speeds, stops, consumption and costs. Every trip is stored as GeoJSON and GPX, and a summary can be sent
to a messenger after each trip. On top: a logbook with category, purpose and change log, the share under sail for
boats, and an anchor watch that also works as a theft watch for cars.

## How it works

1. **Sources**: each object gets one or more sources. Supported:
    - `ioBroker.nmea` - position, SOG, HDOP, altitude and the engine RPM (as engine on/off)
    - `ioBroker.serial-gps` - position, speed, HDOP, altitude, time of the fix. With `minDistance` it writes the
      position only after a movement: the fix quality confirms the position of a standing receiver, so the anchor
      watch does not take it for a lost signal
    - Teltonika routers (RUT/RUTX) via `ioBroker.teltonika` with the GPS enabled
    - Generic: two states latitude/longitude, or one state `lat;lon`, `lon;lat` or JSON
      (`{"lat":..,"lon":..}`, `{"latitude":..,"longitude":..}`, GeoJSON point). This way any tracker works,
      e.g. Traccar, OwnTracks or a phone app, plus optional states for the speed, ignition, accuracy, altitude and
      the time of the fix.
2. **Fusion**: with several sources the one with the best priority wins as long as its positions are fresh
   (`Max. age`) and accurate enough. Otherwise the next one takes over (e.g. NMEA before Teltonika before the phone).
3. **Filter**: positions with a bad accuracy are ignored, single jumps with an impossible speed too. If three positions
   in a row agree with each other but not with the last one, the object was moved without positions (ferry, trailer):
   the track gets a gap, and the way in between is not counted. Movements smaller than `Min. distance` are jitter.
4. **Trip detection**:
    - A trip starts when the speed stays above the start speed for the start time, or when the object is more than
      the start distance away from its parking position (this also works with rare phone positions).
    - For cars with an ignition state the trip runs from ignition on to ignition off (2 minutes grace, so start-stop or
      refuelling does not split the trip). A traffic jam with the engine on is no end.
    - Standing within the stop radius for at least `Min. stop duration` is a stop. The GPS jitter while standing is
      removed from the distance.
    - Standing or no positions for `Trip end after` ends the trip. The end is the time of the arrival, not the time
      of the decision.
    - `control.manualTrip` starts a trip by hand and holds it until it is switched off. `control.endTrip` ends the
      running trip now.
    - Trips below 100 m (moved the car in the driveway) are discarded, unless started by hand.
5. **Time stamps**: if the source has a time of the fix (serial-gps, Teltonika, generic), it is used instead of the
   time stamp of the state, so buffered data is placed correctly.

Defaults per type (empty fields in the settings use them):

| Setting              | Car      | Boat     | Person    |
|----------------------|----------|----------|-----------|
| Distance unit        | km       | nm       | km        |
| Start speed          | 8 km/h   | 1.5 kn   | 3 km/h    |
| Start time           | 20 s     | 60 s     | 60 s      |
| Start distance       | 200 m    | 200 m    | 250 m     |
| Stop radius          | 50 m     | 100 m    | 75 m      |
| Min. stop duration   | 120 s    | 300 s    | 300 s     |
| Trip end after       | 5 min    | 30 min   | 10 min    |
| Min. distance        | 15 m     | 10 m     | 20 m      |
| Max. inaccuracy      | 50 m     | 50 m     | 100 m     |
| Max. plausible speed | 300 km/h | 60 kn    | 1000 km/h |

The stop radius of a boat is larger, so that swinging at anchor does not start a trip.

## Consumption

Estimated from a constant:

- **Per 100 distance units**: e.g. 6.5 l/100 km or 18 kWh/100 km.
- **Per engine hour**: e.g. 2.5 l/h for a boat. The engine time comes from the ignition/engine state (NMEA: RPM > 0),
  without it the moving time is used.

Measured from a state of the vehicle:

- **Counter**: a total that only grows, e.g. the fuel used of the engine or an energy meter. The trip gets the
  difference. A counter that was reset continues from the new value.
- **Level**: the tank level or the battery SoC, in % (with the capacity) or in liters/kWh. Small rises (recuperation,
  sloshing fuel) are subtracted again, a rise of 5 % of the capacity or more is a refuelling or charging and is
  skipped.
- **Flow**: fuel flow in l/h (e.g. `nmea.0.engineParametersDynamic.fuelRate`) or power in kW, integrated over the
  trip. Without values for more than 5 minutes only 5 minutes count.

The state should be updated while driving. Values that come only after the trip has ended (some cloud adapters of
car makers) count for the next trip.

The price is fixed or comes from a state (e.g. `tankerkoenig`, `tibber`). CO₂ is calculated with 2.37 kg/l (petrol),
0.38 kg/kWh or the value from the settings.

## States

For every object `trips.0.<name>`:

| State                             | Description                                                    |
|-----------------------------------|----------------------------------------------------------------|
| `live.active`                     | a trip is running                                              |
| `live.start`, `live.duration`     | start and duration of the running trip                         |
| `live.distance`                   | distance of the running trip                                   |
| `live.speed`, `.avgSpeed`, `.maxSpeed` | current, average (over the moving time) and max. speed    |
| `live.latitude`, `.longitude`, `.position` | last position (`position` is `lat;lon`)               |
| `live.place`                      | name of the place the object is in                             |
| `live.distanceHome`               | distance to the home place                                     |
| `live.source`, `live.ignition`    | used source, ignition/engine                                   |
| `live.consumption`                | consumption of the running trip (estimated or measured)        |
| `lastTrip.*`                      | start, end, from, to, distance, duration, moving time, speeds, stops, elevation gain, consumption, cost, CO₂ |
| `lastTrip.summary`                | text like `Car: Home → Office, 42.1 km, 0:51 h, 3.1 l, 5.80 €` |
| `lastTrip.json`                   | the whole summary as JSON                                      |
| `lastTrip.gpx`                    | path of the GPX file, e.g. `/trips.0/Car/tracks/2026/20261123-081500.gpx` (served by the web adapter) |
| `stats.today/week/month/year/total.*` | distance, trips, duration (h), moving time (h), engine hours, longest trip, max. speed, consumption, cost, CO₂ |
| `control.manualTrip`              | start (`true`) and end (`false`) a trip by hand                |
| `control.endTrip`                 | end the running trip now                                       |
| `lastTrip.sailDistance`, `.sailShare`, `stats.*.sailDistance`, `.sailShare` | boats: distance and share under sail |
| `watch.*`                         | anchor/position watch, see below                               |
| `control.category`, `.purpose`, `.partner`, `.driver` | logbook: for the running or the next trip, see below |
| `lastTrip.category`, `.purpose`, `.partner`, `.driver` | logbook: writable, changes the last trip (recorded) |
| `logbook.csv`, `logbook.changes`  | paths of the logbook of this year and its changes as CSV        |

A trip belongs to the period in which it started. Weeks start on Monday.

## Boats: sailing and motoring

With an engine state in the source (NMEA: the engine RPM is used automatically, or any state that is > 0 or `true`
while the engine runs), the distance with the engine on is counted. The rest was sailed:
`lastTrip.sailDistance` and `lastTrip.sailShare` (%), and per period `stats.*.sailDistance` and `stats.*.sailShare`.
Trips without a known engine state are not part of the share.

## Anchor watch and position watch

`watch.active = true` takes the last position as the center of a circle with the radius `watch.radius`
(default: boat 50 m, car 100 m). The alarm `watch.alarm` comes when three positions in a row are outside of the
circle, so one GPS outlier gives no alarm. Writing `false` to `watch.alarm` acknowledges it; if the object stays
outside, the alarm comes again. `watch.signalLost` is set when no position came for the configured minutes
(default: boat 5, car 30, person 60).

- `watch.latitude`/`.longitude` can be corrected by hand, e.g. to the real position of the anchor ahead of the boat.
- `watch.distance` is the current distance from the center, `watch.maxDistance` the swing circle: the farthest
  position, without single outliers.
- **Boats** never end the watch by themselves, also not when the engine runs (charging at anchor). Switch it off by
  hand.
- **Cars**: the ignition ends the watch. A car that is moved without the ignition (towed away) gives the alarm.
- `Start the watch at the end of each trip` switches it on automatically at the place where the trip ended.
- The alarms go to the messenger of the notifications (can be switched off per object).

## Logbook

With `Keep a logbook` each trip gets a category (`private`, `business`, `commute`), a purpose, a business partner and
a driver:

- Before or during the trip: `control.category`, `control.purpose`, `control.partner`, `control.driver`. Purpose and
  partner belong to one trip and are cleared after it, the category goes back to the default of the object, the
  driver stays.
- After the trip: write `lastTrip.category`, `.purpose`, `.partner` or `.driver`, or send `updateTrip` for any trip.
- **Every change after the trip is recorded** with time, old and new value and who changed it
  (`changes-<year>.json`); the trip counts its changes. Nothing is deleted.
- The odometer comes from a state (e.g. of the car adapter) at the start and the end of the trip. Without it, the
  odometer of the first trip can be entered and is continued with the GPS distances.
- After each trip and each change, `<name>/logbook-<year>.csv` and `<name>/logbook-<year>-changes.csv` are written
  (`;` separated, UTF-8 with BOM for Excel, texts in the system language).

Whether this logbook is accepted by a tax office depends on the country. In Germany, a logbook must be kept promptly
and changes must be visible: the change log provides that, the prompt entry is up to you.

## Files

The trips are stored in the file storage of the instance, not in states:

- `trips.0/<name>/trips-<year>.json` - the summaries of the trips of a year
- `trips.0/<name>/tracks/<year>/<id>.geojson` and `.gpx` - the track, simplified to 2 m
- `trips.0/<name>/current.json` - the running trip, so it survives a restart of the adapter
- `trips.0/<name>/changes-<year>.json` - the changes of the logbook
- `trips.0/<name>/logbook-<year>.csv` and `logbook-<year>-changes.csv` - the logbook as CSV

## Messages

```js
// list of trips, newest first
sendTo('trips.0', 'getTrips', { object: 'Car', from: Date.now() - 7 * 24 * 3600000, limit: 20 }, list => console.log(list));
// the track of one trip as GeoJSON or GPX
sendTo('trips.0', 'getTrack', { object: 'Car', id: '20261123-081500', format: 'gpx' }, res => console.log(res.result));
// the running trip so far, without the privacy zones
sendTo('trips.0', 'getTrack', { object: 'Car', id: 'current', format: 'geojson' }, res => console.log(res.result));
// end the running trip
sendTo('trips.0', 'endTrip', { object: 'Car' });
// the objects with their state prefix and units (for widgets)
sendTo('trips.0', 'getObjects', {}, list => console.log(list));
// what is read from where and what the adapter made of it (all objects or one)
sendTo('trips.0', 'getDiagnostics', { object: 'Car' }, diag => console.log(diag));

// logbook: change a trip (recorded in the change log)
sendTo('trips.0', 'updateTrip', { object: 'Car', id: '20261123-081500', category: 'business', purpose: 'Customer visit', partner: 'ACME' }, res => console.log(res));
// logbook of a year as CSV, or its changes
sendTo('trips.0', 'exportLogbook', { object: 'Car', year: 2026 }, res => console.log(res.result));
sendTo('trips.0', 'exportLogbook', { object: 'Car', year: 2026, changes: true }, res => console.log(res.result));
// the changes as JSON
sendTo('trips.0', 'getChanges', { object: 'Car', year: 2026 }, changes => console.log(changes));
```

The summaries (`getTrips`, `lastTrip.json`, the files) are always in meters, seconds and m/s, the states (`live.*`,
`lastTrip.*`, `stats.*`) in the units of the object (km, nm or mi; km/h, kn or mph).

## Admin tab

The adapter adds the tab **Trips** to admin (from admin 8.3.11):

- **Trips**: the list of the trips with a map of the selected one, the running trip on top, live.
- **Diagnostics**: per object which states each source reads, their values and ages, which source is used now and
  what happened to the positions (used, from a source with a worse priority, too inaccurate, outliers, ...), where
  the ignition/engine comes from, the state of the detection and of the running trip, the watch, the consumption and
  the settings in use. The first place to look when a trip is not detected.

## Widgets

The adapter brings two web components for hosts that load the widgets of adapters (`common.webComponents`). React
comes from the host, Leaflet is included.

- **Trip map** (`<iob-trips-map>`): the running trip with the current position, live, or the last trip. With
  distance, duration and average speed, the stops and a dark theme.
- **Trip list** (`<iob-trips-list>`): the last trips with distance, duration, consumption and cost. A click opens the
  trip on a map; the host can take over the click with the event `trips-list-click`.

Both have the settings instance, object and the tile server (default: OpenStreetMap). The sources are in
`src-webcomponents`, built with `npm run build:wc` into `admin/webcomponents`.

## Places and privacy

Places have a name, a position and a radius. A trip that starts or ends in a place gets its name
(`Home → Office`). Positions inside a place marked as **privacy zone** are never stored in a track, their
coordinates are not stored in the summary, and they are never sent to the geocoder. The live states
(`live.position`, `live.latitude`, `live.longitude`) always show the current position, also inside a privacy zone:
do not log them with a history adapter if that matters.

**Reverse geocoding** (off by default) asks OpenStreetMap Nominatim for the address of the start and the destination
outside the places. This sends these positions to openstreetmap.org. The answers are cached.

With `Delete tracks after` the tracks and all coordinates of older trips are deleted; distances, durations and costs
stay for the statistics.

## Notifications

Select an instance of `telegram`, `pushover`, `email`, `whatsapp-cmb` or `signal-cmb` and enable
`Send a summary after each trip` on the object. The text is the one of `lastTrip.summary`. The alarms of the
watch go to the same messenger.

## Todo

- Widgets: calendar heatmap, statistics tiles; editing the logbook in the trip list
- Boats: automatic hourly logbook (position, SOG, COG, wind, pressure), polar diagram
- Fuel log: refuellings from the level jumps, real consumption between two refuellings
- Admin tab: merge, split and rename trips

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
## Changelog
### **WORK IN PROGRESS**
* (@GermanBluefox) initial release
* (@GermanBluefox) measured consumption (counter, level/SoC, flow), share under sail for boats, anchor/position watch, logbook with change log and CSV export
* (@GermanBluefox) widgets: trip map and trip list
* (@GermanBluefox) admin tab with the trips on a map and a diagnosis of the sources; serial-gps: the fix quality confirms the position of a standing receiver

## License

The MIT License (MIT)

Copyright (c) 2026 bluefox <dogafox@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
