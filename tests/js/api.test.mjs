import { test } from 'node:test';
import assert from 'node:assert';

import { isError, mapsApi } from '../../crac_cloud/static/js/api.js';

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
