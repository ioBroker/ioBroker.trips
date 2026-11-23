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

describe('boat: sailing and motoring', () => {
    const { ConsumptionMeter } = require('../build/lib/meter');

    it('counts the distance with the engine on, the rest was sailed', () => {
        const { detector, trips } = makeDetector('boat');
        // 1 nm out of the harbour with the engine, 3 nm under sail, 1 nm back in with the engine
        const t = track(
            [
                { stand: 120 },
                { drive: 1852, speed: 11 },
                { drive: 5556, speed: 11 },
                { drive: 1852, speed: 11 },
                { stand: 60 },
            ],
            { jitter: 3 },
        );
        const events = [
            { ts: t.marks[1].from - 30000, on: true },
            { ts: t.marks[2].from, on: false },
            { ts: t.marks[3].from, on: true },
            { ts: t.marks[4].from + 30000, on: false },
        ];
        detector.setIgnition(false, t.fixes[0].ts, t.fixes[0].ts);
        let now = 0;
        for (const fix of t.fixes) {
            while (events.length && events[0].ts <= fix.ts) {
                const e = events.shift();
                detector.setIgnition(e.on, e.ts, fix.ts);
            }
            now = fix.ts;
            detector.processFix(fix, now);
            detector.tick(now);
        }
        for (let i = 0; i < 400; i++) {
            now += 5000;
            detector.tick(now);
        }
        assert.strictEqual(trips.length, 1);
        const trip = trips[0];
        assert.ok(trip.engineKnown);
        assert.ok(Math.abs(trip.distance - 9260) < 400, `distance ${trip.distance}`);
        assert.ok(Math.abs(trip.engineDistance - 3704) < 300, `engine ${trip.engineDistance}`);
    });

    it('the engine state unknown: nothing about sailing', () => {
        const { detector, trips } = makeDetector('boat');
        const t = track([{ stand: 60 }, { drive: 3000, speed: 11 }, { stand: 60 }]);
        run(detector, t.fixes);
        assert.strictEqual(trips.length, 1);
        assert.strictEqual(trips[0].engineKnown, false);
        assert.strictEqual(trips[0].engineDistance, 0);
    });

    it('aggregates the share under sail', () => {
        const stats = aggregate(
            [
                { start: 1, distance: 10000, sailDistance: 6000, duration: 0, movingTime: 0, maxSpeed: 0 },
                { start: 2, distance: 5000, duration: 0, movingTime: 0, maxSpeed: 0 },
                { start: 3, distance: 10000, sailDistance: 9000, duration: 0, movingTime: 0, maxSpeed: 0 },
            ],
            0,
        );
        assert.strictEqual(stats.sailDistance, 15000);
        assert.strictEqual(stats.sailBase, 20000);
    });

    it('meter: counter difference, reset of the counter', () => {
        const meter = new ConsumptionMeter('counter');
        meter.update(1000, 1);
        meter.start(2);
        meter.update(1002.5, 3);
        meter.update(3, 4); // counter reset
        meter.update(4, 5);
        assert.ok(Math.abs(meter.stop(6) - 3.5) < 1e-9);
        meter.update(10, 7); // outside a trip
        meter.start(8);
        meter.update(11, 9);
        assert.ok(Math.abs(meter.stop(10) - 1) < 1e-9);
    });

    it('meter: level in % with refuelling and recuperation', () => {
        const meter = new ConsumptionMeter('level', { percent: true, capacity: 60 });
        meter.update(80, 1);
        meter.start(2);
        meter.update(78, 3);
        meter.update(78.5, 4); // recuperation: subtracted again
        meter.update(75, 5);
        meter.update(95, 6); // charging/refuelling: skipped
        meter.update(90, 7);
        // (80 - 75) + (95 - 90) = 10 % of 60 = 6
        assert.ok(Math.abs(meter.stop(8) - 6) < 1e-9);
    });

    it('meter: the start detected later, the end decided later', () => {
        // counter +1 per second; the trip runs from 4.5 s to 15.5 s, but is known only at 10 s and ends at 20 s
        const meter = new ConsumptionMeter('counter');
        for (let i = 0; i <= 10; i++) {
            meter.update(100 + i, i * 1000);
        }
        meter.start(4500);
        assert.strictEqual(meter.current(10000), 6, 'counted from the value at the start');
        for (let i = 11; i <= 20; i++) {
            meter.update(100 + i, i * 1000);
        }
        assert.strictEqual(meter.stop(15500), 11, 'from 104 to 115, not to 120');

        // the same for the flow: 3600 l/h = 1 l/s
        const rate = new ConsumptionMeter('rate');
        for (let i = 0; i <= 10; i++) {
            rate.update(3600, i * 1000);
        }
        rate.start(4500);
        for (let i = 11; i <= 20; i++) {
            rate.update(3600, i * 1000);
        }
        assert.ok(Math.abs(rate.stop(15500) - 11) < 1e-9);
    });

    it('meter: no value between the start and the end', () => {
        const meter = new ConsumptionMeter('counter');
        meter.update(50, 0);
        meter.start(1000);
        meter.update(55, 9000);
        assert.strictEqual(meter.stop(5000), 0);
        meter.start(10000);
        meter.update(57, 11000);
        assert.strictEqual(meter.stop(12000), 2, 'the next trip starts at the last value');
    });

    it('meter: rate integrated over the trip, long gaps capped', () => {
        const meter = new ConsumptionMeter('rate', { maxGapSeconds: 300 });
        meter.update(10, 0); // 10 l/h before the trip: not counted
        const start = 3600000;
        meter.start(start);
        // 30 min at 12 l/h, a value every minute = 6 l
        for (let i = 0; i <= 30; i++) {
            meter.update(12, start + i * 60000);
        }
        // then no value for 1 h: only 5 min count = 1 l
        meter.update(0, start + 30 * 60000 + 3600000);
        const used = meter.stop(start + 3 * 3600000);
        assert.ok(Math.abs(used - 7) < 1e-6, `used ${used}`);
    });
});

describe('anchor watch', () => {
    const { PositionWatch } = require('../build/lib/watch');
    const at = (meters, ts) => ({ ts, lat: LAT, lon: LON + meters / M_PER_DEG_LON });

    it('alarm after three positions outside, not for one outlier', () => {
        const watch = new PositionWatch({ confirmFixes: 3, signalLostSeconds: 300 }, 50);
        watch.activate(LAT, LON, 0);
        assert.strictEqual(watch.onFix(at(30, 1000), 1000), null);
        assert.strictEqual(watch.onFix(at(200, 2000), 2000), null, 'one outlier');
        assert.strictEqual(watch.onFix(at(35, 3000), 3000), null);
        assert.strictEqual(watch.state.maxDistance, 35, 'the outlier does not grow the swing circle');
        watch.onFix(at(60, 4000), 4000);
        watch.onFix(at(65, 5000), 5000);
        assert.strictEqual(watch.onFix(at(70, 6000), 6000), 'alarm');
        assert.strictEqual(watch.state.alarm, true);
        assert.strictEqual(watch.onFix(at(75, 7000), 7000), null, 'only once');
        watch.acknowledge();
        watch.onFix(at(80, 8000), 8000);
        watch.onFix(at(80, 9000), 9000);
        assert.strictEqual(watch.onFix(at(80, 10000), 10000), 'alarm', 'again after the acknowledgement');
    });

    it('alarm when the positions stop, and when they come back', () => {
        const watch = new PositionWatch({ confirmFixes: 3, signalLostSeconds: 300 }, 50);
        watch.activate(LAT, LON, 0);
        watch.onFix(at(10, 1000), 1000);
        assert.strictEqual(watch.tick(200000), null);
        assert.strictEqual(watch.tick(302000), 'signalLost');
        assert.strictEqual(watch.tick(400000), null, 'only once');
        assert.strictEqual(watch.onFix(at(10, 500000), 500000), 'signalBack');
    });

    it('restores an active watch and ignores one without position', () => {
        const watch = new PositionWatch({ confirmFixes: 3, signalLostSeconds: 0 }, 50, {
            active: true,
            lat: LAT,
            lon: LON,
            radius: 80,
        });
        assert.strictEqual(watch.state.active, true);
        assert.strictEqual(watch.state.radius, 80);
        assert.strictEqual(watch.tick(1e12), null, 'signal check off');
        const broken = new PositionWatch({ confirmFixes: 3, signalLostSeconds: 0 }, 50, { active: true, lat: null });
        assert.strictEqual(broken.state.active, false);
    });
});

describe('logbook', () => {
    const { applyChanges, logbookCsv, changesCsv } = require('../build/lib/logbook');
    const { text } = require('../build/lib/texts');
    const at = (h, m) => new Date(2026, 10, 23, h, m).getTime();
    const trip = () => ({
        id: '20261123-080000',
        start: at(8, 0),
        end: at(8, 45),
        distance: 42100,
        from: 'Home',
        to: 'Office; Kiel',
        stops: [{ start: at(8, 10), end: at(8, 20), lat: null, lon: null, place: 'Bakery' }],
        odometerStart: 12000,
        odometerEnd: 12042.1,
    });

    it('records every change', () => {
        const summary = trip();
        const changes = applyChanges(
            summary,
            { category: 'Business', purpose: ' Customer visit ', partner: '' },
            5,
            'admin.0',
        );
        assert.strictEqual(summary.category, 'business');
        assert.strictEqual(summary.purpose, 'Customer visit');
        assert.strictEqual(changes.length, 2, 'the empty partner was empty before');
        assert.deepStrictEqual(changes[0], {
            ts: 5,
            id: summary.id,
            field: 'category',
            old: null,
            new: 'business',
            source: 'admin.0',
        });
        assert.strictEqual(summary.changes, 2);
        assert.strictEqual(applyChanges(summary, { category: 'business' }, 6, 'x').length, 0, 'no change');
        const cleared = applyChanges(summary, { purpose: null }, 7, 'x');
        assert.strictEqual(cleared[0].old, 'Customer visit');
        assert.strictEqual(summary.purpose, undefined);
        assert.throws(() => applyChanges(summary, { category: 'holiday' }, 8, 'x'), /Invalid category/);
    });

    it('exports the logbook as CSV', () => {
        const summary = trip();
        applyChanges(summary, { category: 'business', partner: 'ACME "North"' }, 5, 'x');
        const csv = logbookCsv([summary], {
            lang: 'de',
            meters: 1000,
            unit: 'km',
            formatNumber: (v, d) => v.toFixed(d).replace('.', ','),
        });
        assert.strictEqual(csv.charCodeAt(0), 0xfeff, 'BOM for Excel');
        const lines = csv.substring(1).trim().split('\r\n');
        assert.strictEqual(lines.length, 2);
        assert.ok(lines[0].startsWith('Datum;Abfahrt;Ankunft;Km-Stand Beginn (km)'), lines[0]);
        const fields = lines[1].split(';');
        assert.strictEqual(fields[3], '12000');
        assert.strictEqual(fields[5], '42,1');
        assert.ok(lines[1].includes('"Office; Kiel"'), 'quoted');
        assert.ok(lines[1].includes('Bakery (08:10-08:20)'), lines[1]);
        assert.ok(lines[1].includes(';geschäftlich;'), lines[1]);
        assert.ok(lines[1].includes('"ACME ""North"""'), lines[1]);
        const changes = changesCsv(
            [{ ts: 5, id: summary.id, field: 'category', old: null, new: 'business', source: 'x' }],
            'en',
        );
        assert.ok(changes.includes(';Category;;business;x'), changes);
    });

    it('texts with placeholders and fallback to English', () => {
        assert.strictEqual(
            text('de', 'alarmText', { distance: 63, radius: 50 }),
            '63 m von der Wachposition entfernt (Radius 50 m)',
        );
        assert.strictEqual(text('xx', 'anchorAlarm'), 'Anchor alarm');
        assert.strictEqual(text('en', 'unknownKey'), 'unknownKey');
    });
});
