'use strict';

const assert = require('node:assert');
const { TripDetector } = require('../build/lib/tripDetector');
const { objectSettings } = require('../build/lib/objectSettings');
const { parsePosition, simplify, distance } = require('../build/lib/geo');
const { parseIgnition, parseTimestamp, SourceAssembler, Fusion } = require('../build/lib/source');
const { toGpx, toGeoJson, pointsFromGeoJson } = require('../build/lib/export');
const { aggregate, periodStart } = require('../build/lib/summary');
const { formatAddress } = require('../build/lib/places');

const LAT = 52.5;
const LON = 13.4;
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos((LAT * Math.PI) / 180);

/** deterministic random numbers, so the tests are reproducible */
function random(seed) {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

/**
 * Builds a timeline of positions.
 * Segments: { stand: seconds } or { drive: meters, speed: km/h }, all eastwards on one line.
 */
function track(segments, options = {}) {
    const rnd = random(options.seed || 1);
    const interval = options.interval || 1; // seconds between positions
    const jitter = options.jitter ?? 6; // meters
    const withSpeed = options.withSpeed !== false;
    const fixes = [];
    let ts = options.start || Date.UTC(2026, 10, 23, 7, 0, 0);
    let x = 0; // meters east
    const marks = [];
    for (const seg of segments) {
        if (seg.stand) {
            marks.push({ type: 'stand', from: ts, x });
            for (let t = 0; t < seg.stand; t += interval) {
                fixes.push(fixAt(ts, x, withSpeed ? rnd() * 0.3 : null));
                ts += interval * 1000;
            }
        } else {
            marks.push({ type: 'drive', from: ts, x });
            const ms = seg.speed / 3.6;
            const steps = Math.ceil(seg.drive / ms / interval);
            for (let i = 0; i < steps; i++) {
                x += Math.min(ms * interval, seg.drive - (i * ms * interval));
                fixes.push(fixAt(ts, x, withSpeed ? ms : null));
                ts += interval * 1000;
            }
        }
    }
    marks.push({ type: 'end', from: ts, x });
    return { fixes, marks, end: ts, x };

    function fixAt(time, meters, speed) {
        const jx = (rnd() - 0.5) * 2 * jitter;
        const jy = (rnd() - 0.5) * 2 * jitter;
        const fix = {
            ts: time,
            lat: LAT + jy / M_PER_DEG_LAT,
            lon: LON + (meters + jx) / M_PER_DEG_LON,
            accuracy: options.accuracy ?? 8,
        };
        if (speed !== null) {
            fix.speed = speed;
        }
        return fix;
    }
}

/** Feeds the positions in real time order and calls tick() every 5 s, then waits `after` seconds */
function run(detector, fixes, after = 3600, tickEvery = 5) {
    let lastTick = 0;
    let now = 0;
    for (const fix of fixes) {
        now = fix.ts;
        detector.processFix(fix, now);
        if (now - lastTick >= tickEvery * 1000) {
            detector.tick(now);
            lastTick = now;
        }
    }
    for (let t = 0; t < after; t += tickEvery) {
        now += tickEvery * 1000;
        detector.tick(now);
    }
    return now;
}

function makeDetector(type = 'car', overrides = {}, saved) {
    const settings = objectSettings({ type, name: 'test', ...overrides });
    const trips = [];
    const started = [];
    const detector = new TripDetector(
        settings.detector,
        { onStart: t => started.push(t), onEnd: t => trips.push(t) },
        saved,
    );
    return { detector, trips, started, settings };
}

describe('geo', () => {
    it('distance of 1° latitude', () => {
        const d = distance(52, 13, 53, 13);
        assert.ok(Math.abs(d - 111195) < 100, `got ${d}`);
    });
    it('parses positions', () => {
        assert.deepStrictEqual(parsePosition('52.5;13.4', 'latlon'), { lat: 52.5, lon: 13.4 });
        assert.deepStrictEqual(parsePosition('13.4;52.5', 'lonlat'), { lat: 52.5, lon: 13.4 });
        assert.deepStrictEqual(parsePosition('52,5;13,4', 'latlon'), { lat: 52.5, lon: 13.4 }, 'comma decimals');
        assert.deepStrictEqual(parsePosition('52.5,13.4', 'latlon'), { lat: 52.5, lon: 13.4 });
        assert.deepStrictEqual(parsePosition('{"lat":52.5,"lng":13.4,"acc":12}', 'json'), {
            lat: 52.5,
            lon: 13.4,
            accuracy: 12,
        });
        assert.deepStrictEqual(parsePosition({ type: 'Point', coordinates: [13.4, 52.5] }, 'json'), {
            lat: 52.5,
            lon: 13.4,
        });
        assert.strictEqual(parsePosition('0;0', 'latlon'), null, '0/0 is no fix');
        assert.strictEqual(parsePosition('95;13', 'latlon'), null);
    });
    it('simplifies a straight line to two points and keeps forced points', () => {
        const points = [];
        for (let i = 0; i < 100; i++) {
            points.push({ lat: LAT, lon: LON + i * 0.0001, ts: i, keep: i === 50 });
        }
        const result = simplify(points, 2);
        assert.strictEqual(result.length, 3);
        assert.strictEqual(result[1].ts, 50);
    });
});

describe('source helpers', () => {
    it('parses the ignition', () => {
        assert.strictEqual(parseIgnition(true), true);
        assert.strictEqual(parseIgnition(0), false);
        assert.strictEqual(parseIgnition(850), true, 'RPM > 0 is on');
        assert.strictEqual(parseIgnition('ON'), true);
        assert.strictEqual(parseIgnition('aus'), false);
        assert.strictEqual(parseIgnition(null), null);
    });
    it('parses time stamps', () => {
        assert.strictEqual(parseTimestamp(1700000000), 1700000000000, 'seconds');
        assert.strictEqual(parseTimestamp(1700000000000), 1700000000000);
        assert.strictEqual(parseTimestamp('2026-11-23T07:00:00Z'), Date.UTC(2026, 10, 23, 7));
        assert.strictEqual(parseTimestamp('nonsense'), null);
    });
    it('combines latitude and longitude from two states', async () => {
        const fixes = [];
        const source = {
            label: 'gen',
            object: 'car',
            priority: 1,
            maxAge: 60000,
            positionFormat: 'separate',
            latitudeId: 'a.lat',
            longitudeId: 'a.lon',
            positionId: '',
            speedId: 'a.speed',
            speedUnit: 'km/h',
            ignitionId: '',
            accuracyId: 'a.hdop',
            accuracyType: 'hdop',
            altitudeId: '',
            timestampId: '',
        };
        const assembler = new SourceAssembler(source, fix => fixes.push(fix), () => {});
        assembler.init('a.speed', { val: 36, ts: 1, ack: true });
        assembler.init('a.hdop', { val: 1.2, ts: 1, ack: true });
        assembler.onStateChange('a.lat', { val: 52.5, ts: 1000, ack: true });
        assembler.onStateChange('a.lon', { val: 13.4, ts: 1001, ack: true });
        await new Promise(resolve => setTimeout(resolve, 400));
        assert.strictEqual(fixes.length, 1);
        assert.strictEqual(fixes[0].lat, 52.5);
        assert.strictEqual(fixes[0].lon, 13.4);
        assert.strictEqual(fixes[0].ts, 1001);
        assert.ok(Math.abs(fixes[0].speed - 10) < 1e-9, '36 km/h = 10 m/s');
        assert.ok(Math.abs(fixes[0].accuracy - 6) < 1e-9, 'HDOP 1.2 * 5 m');
        assembler.destroy();
    });
    it('fusion prefers the better priority while it is fresh', () => {
        const make = (priority, accuracy) => ({
            source: { priority, maxAge: 60000 },
            lastFix: { accuracy },
            lastFixAt: 0,
            ignition: null,
        });
        const nmea = make(1, 5);
        const phone = make(2, 15);
        const fusion = new Fusion([nmea, phone], 50);
        const now = 1000000;
        nmea.lastFixAt = now;
        phone.lastFixAt = now;
        assert.strictEqual(fusion.accept(phone, now), false, 'NMEA is fresh');
        assert.strictEqual(fusion.accept(nmea, now), true);
        nmea.lastFixAt = now - 120000;
        assert.strictEqual(fusion.accept(phone, now), true, 'NMEA is too old: fallback');
        nmea.lastFixAt = now;
        nmea.lastFix.accuracy = 80;
        assert.strictEqual(fusion.accept(phone, now), true, 'NMEA is too inaccurate');
    });
});

describe('trip detection', () => {
    it('ignores GPS jitter of a parked car', () => {
        const { detector, trips, started } = makeDetector('car');
        const { fixes } = track([{ stand: 3600 }], { jitter: 15, withSpeed: false });
        run(detector, fixes);
        assert.strictEqual(started.length, 0);
        assert.strictEqual(trips.length, 0);
    });

    for (const withSpeed of [true, false]) {
        it(`detects a car trip with a stop (${withSpeed ? 'speed of the source' : 'derived speed'})`, () => {
            const { detector, trips } = makeDetector('car');
            const t = track(
                [
                    { stand: 300 },
                    { drive: 10000, speed: 50 },
                    { stand: 180 },
                    { drive: 2000, speed: 30 },
                    { stand: 900 },
                ],
                { withSpeed },
            );
            run(detector, t.fixes);
            assert.strictEqual(trips.length, 1, 'one trip');
            const trip = trips[0];
            assert.ok(Math.abs(trip.distance - 12000) < 400, `distance ${trip.distance}`);
            const departure = t.marks[1].from;
            const arrival = t.marks[4].from;
            assert.ok(Math.abs(trip.start - departure) <= 30000, `start ${(trip.start - departure) / 1000} s off`);
            assert.ok(Math.abs(trip.end - arrival) <= 30000, `end ${(trip.end - arrival) / 1000} s off`);
            assert.strictEqual(trip.stops.length, 1, 'the stop of 3 minutes');
            assert.ok(Math.abs(trip.stops[0].end - trip.stops[0].start - 180000) < 30000);
            const movingExpected = (10000 / 50 + 2000 / 30) * 3600;
            assert.ok(
                Math.abs(trip.movingTime - movingExpected) < 60000,
                `moving time ${trip.movingTime / 1000} s, expected ${movingExpected / 1000} s`,
            );
            assert.ok(trip.maxSpeed > 45 / 3.6 && trip.maxSpeed < 70 / 3.6, `max speed ${trip.maxSpeed * 3.6}`);
        });
    }

    it('drops a single outlier', () => {
        const { detector, trips } = makeDetector('car');
        const t = track([{ stand: 60 }, { drive: 5000, speed: 60 }, { stand: 600 }]);
        const index = 200;
        t.fixes.splice(index, 0, { ...t.fixes[index], ts: t.fixes[index].ts + 1, lat: t.fixes[index].lat + 0.45 });
        run(detector, t.fixes);
        assert.strictEqual(trips.length, 1);
        assert.ok(Math.abs(trips[0].distance - 5000) < 300, `distance ${trips[0].distance}`);
    });

    it('accepts a relocation without counting its distance', () => {
        const { detector, trips } = makeDetector('car');
        const a = track([{ stand: 60 }, { drive: 3000, speed: 50 }, { stand: 30 }]);
        const b = track([{ drive: 3000, speed: 50 }, { stand: 900 }], { start: a.end + 1000, seed: 7 });
        // the second part is 200 km away (ferry), without positions in between
        for (const fix of b.fixes) {
            fix.lat += 1.8;
        }
        run(detector, [...a.fixes, ...b.fixes]);
        assert.strictEqual(trips.length, 1);
        assert.ok(Math.abs(trips[0].distance - 6000) < 500, `distance ${trips[0].distance}`);
        assert.strictEqual(trips[0].gaps, 1);
    });

    it('uses the ignition: a traffic jam does not end the trip, the ignition off does', () => {
        const { detector, trips, started } = makeDetector('car');
        const t = track([{ stand: 120 }, { drive: 3000, speed: 50 }, { stand: 900 }, { drive: 3000, speed: 50 }, { stand: 600 }]);
        const ignitionOn = t.marks[1].from - 30000;
        const ignitionOff = t.marks[4].from + 20000;
        let lastTick = 0;
        let switchedOn = false;
        let switchedOff = false;
        let now = 0;
        for (const fix of t.fixes) {
            now = fix.ts;
            if (!switchedOn && now >= ignitionOn) {
                detector.setIgnition(true, now, now);
                switchedOn = true;
            }
            if (!switchedOff && now >= ignitionOff) {
                detector.setIgnition(false, now, now);
                switchedOff = true;
            }
            detector.processFix(fix, now);
            if (now - lastTick >= 5000) {
                detector.tick(now);
                lastTick = now;
            }
        }
        for (let i = 0; i < 100; i++) {
            now += 5000;
            detector.tick(now);
        }
        assert.strictEqual(started.length, 1);
        assert.strictEqual(trips.length, 1, 'the 15 minutes jam with the engine on is no trip end');
        const trip = trips[0];
        assert.strictEqual(trip.reason, 'ignition');
        assert.ok(Math.abs(trip.start - ignitionOn) < 2000);
        assert.ok(Math.abs(trip.end - ignitionOff) < 2000);
        assert.ok(Math.abs(trip.distance - 6000) < 300, `distance ${trip.distance}`);
        assert.ok(Math.abs(trip.engineTime - (ignitionOff - ignitionOn)) < 2000);
    });

    it('a late ignition event keeps the positions that arrived before it', () => {
        const { detector, trips } = makeDetector('car');
        const t = track([{ stand: 120 }, { drive: 4000, speed: 50 }, { stand: 60 }]);
        const ignitionOn = t.marks[1].from - 5000;
        let delivered = false;
        let now = 0;
        for (const fix of t.fixes) {
            now = fix.ts;
            detector.processFix(fix, now);
            // the ignition event comes 30 s late, the car already moved ~400 m
            if (!delivered && now >= ignitionOn + 30000) {
                detector.setIgnition(true, ignitionOn, now);
                delivered = true;
            }
        }
        detector.setIgnition(false, now, now);
        detector.tick(now + 200000);
        assert.strictEqual(trips.length, 1);
        const trip = trips[0];
        assert.ok(Math.abs(trip.distance - 4000) < 300, `distance ${trip.distance}`);
        for (let i = 1; i < trip.points.length; i++) {
            assert.ok(trip.points[i].ts >= trip.points[i - 1].ts, 'points in time order');
        }
    });

    it('ignition on for a short time without driving is no trip', () => {
        const { detector, trips } = makeDetector('car');
        const t = track([{ stand: 600 }]);
        const now0 = t.fixes[0].ts;
        detector.setIgnition(true, now0 + 60000, now0 + 60000);
        detector.setIgnition(false, now0 + 120000, now0 + 120000);
        run(detector, t.fixes);
        assert.strictEqual(trips.length, 1);
        assert.ok(trips[0].distance < 100, 'the adapter discards trips below 100 m');
    });

    it('detects trips from rare phone positions and ends them without further positions', () => {
        const { detector, trips } = makeDetector('person');
        const t = track([{ stand: 1800 }, { drive: 15000, speed: 40 }, { stand: 120 }], {
            interval: 120,
            jitter: 25,
            withSpeed: false,
            accuracy: 30,
        });
        run(detector, t.fixes, 3600, 10);
        assert.strictEqual(trips.length, 1);
        assert.ok(Math.abs(trips[0].distance - 15000) < 1500, `distance ${trips[0].distance}`);
    });

    it('a boat swinging at anchor makes no trip', () => {
        const { detector, trips } = makeDetector('boat');
        const fixes = [];
        const start = Date.UTC(2026, 6, 1);
        for (let i = 0; i < 6 * 3600; i++) {
            // circle of 60 m radius around the anchor, one turn in 20 minutes
            const a = (i / 1200) * 2 * Math.PI;
            fixes.push({
                ts: start + i * 1000,
                lat: LAT + (60 * Math.sin(a)) / M_PER_DEG_LAT,
                lon: LON + (60 * Math.cos(a)) / M_PER_DEG_LON,
                speed: ((2 * Math.PI * 60) / 1200) * (1 + 0.5 * Math.sin(i / 7)),
            });
        }
        run(detector, fixes);
        assert.strictEqual(trips.length, 0);
    });

    it('manual trip holds while standing and ends by hand', () => {
        const { detector, trips } = makeDetector('car');
        const t = track([{ stand: 60 }, { drive: 2000, speed: 30 }, { stand: 1800 }, { drive: 2000, speed: 30 }]);
        detector.setManual(true, t.fixes[0].ts);
        const now = run(detector, t.fixes, 0);
        assert.strictEqual(trips.length, 0, 'still running');
        detector.setManual(false, now);
        assert.strictEqual(trips.length, 1);
        assert.strictEqual(trips[0].reason, 'manual');
        assert.ok(Math.abs(trips[0].distance - 4000) < 300, `distance ${trips[0].distance}`);
    });

    it('continues a trip after a restart', () => {
        const first = makeDetector('car');
        const t = track([{ stand: 60 }, { drive: 8000, speed: 50 }, { stand: 900 }]);
        const half = Math.floor(t.fixes.length / 2);
        run(first.detector, t.fixes.slice(0, half), 0);
        assert.ok(first.detector.trip, 'trip runs');
        const saved = JSON.parse(JSON.stringify(first.detector.state));
        const second = makeDetector('car', {}, saved);
        run(second.detector, t.fixes.slice(half));
        assert.strictEqual(second.trips.length, 1);
        assert.ok(Math.abs(second.trips[0].distance - 8000) < 300, `distance ${second.trips[0].distance}`);
    });

    it('uses the unit of the object for the speeds in the settings', () => {
        const boat = objectSettings({ type: 'boat', name: 'b', startSpeed: '2' });
        assert.ok(Math.abs(boat.detector.startSpeed - (2 * 1852) / 3600) < 1e-9, '2 kn');
        const boatKm = objectSettings({ type: 'boat', name: 'b', distanceUnit: 'km' });
        assert.strictEqual(boatKm.speedUnit, 'km/h');
        assert.ok(Math.abs(boatKm.detector.startSpeed - (1.5 * 1852) / 3600) < 1e-9, 'default stays 1.5 kn');
        const car = objectSettings({ type: 'car', name: 'c', useIgnition: false });
        assert.strictEqual(car.detector.useIgnition, false);
    });
});

describe('exports and statistics', () => {
    const summary = {
        id: '20261123-080000',
        object: 'Car',
        start: Date.UTC(2026, 10, 23, 7),
        end: Date.UTC(2026, 10, 23, 8),
        duration: 3600,
        movingTime: 3000,
        distance: 42000,
        avgSpeed: 14,
        maxSpeed: 30,
        startLat: LAT,
        startLon: LON,
        endLat: LAT,
        endLon: LON + 0.5,
        stops: [{ start: Date.UTC(2026, 10, 23, 7, 30), end: Date.UTC(2026, 10, 23, 7, 35), lat: LAT, lon: LON + 0.2 }],
        gaps: 1,
        points: 3,
        reason: 'movement',
        track: true,
        consumption: 3,
        cost: 5.4,
        co2: 7.1,
    };
    const points = [
        { ts: summary.start, lat: LAT, lon: LON, alt: 30 },
        { ts: summary.start + 60000, lat: LAT, lon: LON + 0.1, speed: 12.5 },
        { ts: summary.end, lat: LAT, lon: LON + 0.5, gap: true },
    ];

    it('writes GPX with a new segment after a gap', () => {
        const gpx = toGpx(summary, points, 'Car <test>');
        assert.strictEqual((gpx.match(/<trkseg>/g) || []).length, 2);
        assert.ok(gpx.includes('Car &lt;test&gt;'));
        assert.ok(gpx.includes('<ele>30</ele>'));
        assert.ok(gpx.includes('<wpt '));
    });

    it('writes GeoJSON that can be read back', () => {
        const geojson = toGeoJson(summary, points);
        const json = JSON.parse(geojson);
        assert.strictEqual(json.features[0].geometry.type, 'MultiLineString');
        const back = pointsFromGeoJson(geojson);
        assert.strictEqual(back.length, 3);
        assert.strictEqual(back[1].speed, 12.5);
        assert.strictEqual(back[2].gap, true);
    });

    it('aggregates the periods', () => {
        const now = new Date(2026, 10, 25, 12); // Wednesday
        const trips = [
            { ...summary, start: new Date(2026, 10, 25, 8).getTime() },
            { ...summary, start: new Date(2026, 10, 23, 8).getTime(), distance: 1000 }, // Monday
            { ...summary, start: new Date(2026, 10, 2, 8).getTime() },
            { ...summary, start: new Date(2025, 5, 1).getTime() },
        ];
        assert.strictEqual(aggregate(trips, periodStart('today', now)).trips, 1);
        const week = aggregate(trips, periodStart('week', now));
        assert.strictEqual(week.trips, 2);
        assert.strictEqual(week.distance, 43000);
        assert.strictEqual(week.longestTrip, 42000);
        assert.strictEqual(aggregate(trips, periodStart('month', now)).trips, 3);
        assert.strictEqual(aggregate(trips, periodStart('year', now)).trips, 3);
        const total = aggregate(trips, periodStart('total', now));
        assert.strictEqual(total.trips, 4);
        assert.ok(Math.abs(total.cost - 21.6) < 1e-9);
    });

    it('formats Nominatim addresses', () => {
        assert.strictEqual(
            formatAddress({ address: { road: 'Hauptstraße', house_number: '5', town: 'Kiel' } }),
            'Hauptstraße 5, Kiel',
        );
        assert.strictEqual(formatAddress({ error: 'Unable to geocode' }), null);
    });
});
