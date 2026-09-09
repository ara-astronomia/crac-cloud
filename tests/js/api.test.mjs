import { test } from 'node:test';
import assert from 'node:assert';

import { isError } from '../../crac_cloud/static/js/api.js';

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
