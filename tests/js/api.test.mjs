import { test, afterEach } from 'node:test';
import assert from 'node:assert';

import { isError, mapsApi, outcomeOf, apiGet, healthApi, roofApi } from '../../crac_cloud/static/js/api.js';

// Senza ripristino un test eredita in silenzio la fetch finta di quello prima.
const fetchVera = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchVera; });

test('una risposta con i dati non e\' un errore', () => {
    assert.equal(isError({ status: 'ROOF_CLOSED' }), false);
});

test('una risposta HTTP 200 che contiene error e\' un errore', () => {
    assert.equal(isError({ error: 'Deadline Exceeded', status: 'SCONOSCIUTO' }), true);
});

test('il tetto che risponde ERROR per colpa del collegamento e\' un errore', () => {
    assert.equal(isError({ status: 'ERROR', error: '<_InactiveRpcError...>' }), true);
});

test('una risposta assente e\' un errore', () => {
    assert.equal(isError(null), true);
    assert.equal(isError(undefined), true);
});

test('una risposta vuota e\' un errore', () => {
    assert.equal(isError({}), true);
});

test('le URL delle due immagini portano un cache-buster, che senza non si ricaricherebbero', () => {
    assert.match(mapsApi.trackingChartUrl(), /^\/maps\/tracking_chart\?t=\d+$/);
    assert.match(mapsApi.skyMapUrl(), /^\/maps\/sky_map_fixed\?t=\d+$/);
});

test('l\'airmass invece no: a non farla rileggere dalla cache pensa il server', async () => {
    const chiamate = [];
    globalThis.fetch = async url => {
        chiamate.push(url);
        return { ok: true, json: async () => ({ airmass: 1.2 }) };
    };
    assert.deepEqual(await mapsApi.getAirmass(), { airmass: 1.2 });
    assert.deepEqual(chiamate, ['/maps/airmass']);
});

test('una risposta HTTP, anche di errore, dice che crac-cloud e\' raggiungibile', () => {
    assert.equal(outcomeOf({ status: 'ROOF_CLOSED' }), 'ok');
    assert.equal(outcomeOf({ error: 'Deadline Exceeded' }), 'error');
    assert.equal(outcomeOf({ error: 'HTTP 500 at /maps/airmass' }), 'error');
});

test('solo il rigetto di fetch dice che crac-cloud non si raggiunge', () => {
    assert.equal(outcomeOf({ error: 'Failed to fetch', unreachable: true }), 'unreachable');
});

test('il timeout e\' un esito a se\': non dice chi dei due tace', async () => {
    globalThis.fetch = (url, options) => new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
            const abort = new Error('aborted');
            abort.name = 'AbortError';
            reject(abort);
        });
    });
    const risposta = await apiGet('/roof/status', 10);
    assert.equal(outcomeOf(risposta), 'timeout');
    assert.equal(risposta.unreachable, undefined);
});

test('la sonda di salute che risponde dice ok', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
    assert.equal(await healthApi.probe(), 'ok');
});

test('la sonda di salute in timeout dice irraggiungibile: quella rotta non parla con crac-server', async () => {
    globalThis.fetch = (url, options) => new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
            const abort = new Error('aborted');
            abort.name = 'AbortError';
            reject(abort);
        });
    });
    assert.equal(await healthApi.probe(), 'unreachable');
});

test('le letture di stato mollano dopo 3 secondi: il socket serve alla sonda', async () => {
    globalThis.fetch = (url, options) => new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
            const abort = new Error('aborted');
            abort.name = 'AbortError';
            reject(abort);
        });
    });
    const t0 = Date.now();
    const risposta = await roofApi.getStatus();
    assert.match(risposta.error, /entro 3000ms/);
    assert.ok(Date.now() - t0 < 4000, 'ha aspettato piu\' di quanto dichiara');
});

test('i comandi invece hanno tutto il tempo: crac-server ci mette fino a 5s a rispondere', async () => {
    let deadline;
    globalThis.fetch = async (url, options) => {
        deadline = options.signal;
        return { ok: true, json: async () => ({ status: 'ROOF_OPEN' }) };
    };
    await roofApi.open();
    assert.equal(deadline.aborted, false);
});
