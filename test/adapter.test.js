'use strict';

const assert = require('node:assert');
const setup = require('@iobroker/legacy-testing');

let objects = null;
let states = null;

const LAT = 54.32;
const LON = 10.13;
const M_PER_DEG_LON = 111320 * Math.cos((LAT * Math.PI) / 180);

function getState(id) {
    return new Promise((resolve, reject) =>
        states.getState(id, (err, state) => (err ? reject(err) : resolve(state))),
    );
}

function setState(id, state) {
    return new Promise((resolve, reject) => states.setState(id, state, err => (err ? reject(err) : resolve())));
}

function readFile(adapter, name) {
    return new Promise(resolve => objects.readFile(adapter, name, (err, data) => resolve(err ? null : data)));
}

async function waitFor(check, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const result = await check();
        if (result) {
            return result;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Timeout');
}

describe('trips: adapter', () => {
    before('Start js-controller', function (done) {
        this.timeout(600000); // because of the first installation from npm
        setup.adapterStarted = false;

        setup.setupController(async () => {
            const config = await setup.getAdapterConfig();
            config.common.enabled = true;
            config.common.loglevel = 'debug';
            config.native.objects = [
                {
                    enabled: true,
                    name: 'Car',
                    type: 'car',
                    useIgnition: true,
                    consumptionMode: 'distance',
                    consumption: 6,
                    consumptionUnit: 'l',
                    price: 1.8,
                    notify: false,
                },
            ];
            config.native.sources = [
                {
                    enabled: true,
                    object: 'Car',
                    type: 'generic',
                    priority: 1,
                    positionFormat: 'latlon',
                    positionId: '0_userdata.0.car.position',
                    speedId: '0_userdata.0.car.speed',
                    speedUnit: 'km/h',
                    maxAge: 60,
                },
            ];
            config.native.places = [{ name: 'Home', latitude: LAT, longitude: LON, radius: 100, privacy: false }];
            config.native.homePlace = 'Home';
            config.native.liveInterval = 1;
            await setup.setAdapterConfig(config.common, config.native);

            setup.startController(true, (_objects, _states) => {
                objects = _objects;
                states = _states;
                done();
            });
        });
    });

    it('creates the states of the object', async () => {
        await waitFor(async () => {
            const state = await getState('trips.0.Car.live.active');
            return state && state.val === false;
        });
    }).timeout(30000);

    it('records a trip of 10 km and its consumption', async () => {
        // 60 km/h eastwards, one position per second, with time stamps of the last 15 minutes
        const start = Date.now() - 15 * 60000;
        const speed = 60 / 3.6;
        for (let i = 0; i < 600; i++) {
            const ts = start + i * 1000;
            const lon = LON + (i * speed) / M_PER_DEG_LON;
            await setState('0_userdata.0.car.speed', { val: i ? 60 : 0, ack: true, ts });
            await setState('0_userdata.0.car.position', { val: `${LAT};${lon.toFixed(7)}`, ack: true, ts });
        }
        await waitFor(async () => (await getState('trips.0.Car.live.active'))?.val === true);
        const live = await getState('trips.0.Car.live.distance');
        assert.ok(live.val > 9, `live distance ${live.val}`);

        const previousId = (await getState('trips.0.Car.lastTrip.id'))?.val;
        await setState('trips.0.Car.control.endTrip', { val: true, ack: false });
        await waitFor(async () => {
            const state = await getState('trips.0.Car.lastTrip.id');
            return state?.val && state.val !== previousId;
        });
        const distance = await getState('trips.0.Car.lastTrip.distance');
        assert.ok(Math.abs(distance.val - 10) < 0.3, `distance ${distance.val} km`);
        assert.strictEqual((await getState('trips.0.Car.lastTrip.from')).val, 'Home');
        const consumption = (await getState('trips.0.Car.lastTrip.consumption')).val;
        assert.ok(Math.abs(consumption - 0.6) < 0.02, `consumption ${consumption}`);
        const cost = (await getState('trips.0.Car.lastTrip.cost')).val;
        assert.ok(Math.abs(cost - 1.08) < 0.05, `cost ${cost}`);
        assert.strictEqual((await getState('trips.0.Car.stats.total.trips')).val, 1);
        assert.strictEqual((await getState('trips.0.Car.live.active')).val, false);

        const gpx = (await getState('trips.0.Car.lastTrip.gpx')).val;
        assert.ok(gpx.startsWith('/trips.0/Car/tracks/'), gpx);
        const file = await readFile('trips.0', gpx.replace('/trips.0/', ''));
        assert.ok(file && file.toString().includes('<trkpt'), 'GPX file stored');
    }).timeout(120000);

    after('Stop js-controller', function (done) {
        this.timeout(10000);
        setup.stopController(() => done());
    });
});
