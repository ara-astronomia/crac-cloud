import { test } from 'node:test';
import assert from 'node:assert';

import { ConnectionHealth } from '../../crac_cloud/static/js/connection.js';

const ROOF = 'roof';
const TELESCOPE = 'telescope';

test('un fallimento isolato non incolpa nessuno', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'error');
    assert.equal(connection.culprit(), null);
});

test('due risposte di errore di fila incolpano crac-server: se ha risposto, il browser parla', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'error');
    connection.note(ROOF, 'error');
    assert.equal(connection.culprit(), 'server');
});

test('due fallimenti di trasporto di fila incolpano il collegamento col browser', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'unreachable');
    connection.note(ROOF, 'unreachable');
    assert.equal(connection.culprit(), 'cloud');
});

test('se qualcuno ha risposto HTTP la colpa resta di crac-server, anche con altri irraggiungibili', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'error');
    connection.note(ROOF, 'error');
    connection.note(TELESCOPE, 'unreachable');
    connection.note(TELESCOPE, 'unreachable');
    assert.equal(connection.culprit(), 'server');
});

test('una risposta buona chiude tutto, senza aspettare l\'endpoint piu\' lento', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'unreachable');
    connection.note(ROOF, 'unreachable');
    connection.note(TELESCOPE, 'ok');
    assert.equal(connection.culprit(), null);
});

test('endpoint diversi contano separatamente', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'error');
    connection.note(TELESCOPE, 'error');
    assert.equal(connection.culprit(), null);
});

test('il browser che si dichiara offline non aspetta la tolleranza', () => {
    const connection = new ConnectionHealth();
    connection.setBrowserOffline(true);
    assert.equal(connection.culprit(), 'cloud');
});

test('il browser che torna online non basta: la colpa la decidono le letture', () => {
    const connection = new ConnectionHealth();
    connection.setBrowserOffline(true);
    connection.note(ROOF, 'unreachable');
    connection.note(ROOF, 'unreachable');
    connection.setBrowserOffline(false);
    assert.equal(connection.culprit(), 'cloud');
    connection.note(ROOF, 'ok');
    assert.equal(connection.culprit(), null);
});

test('la tolleranza e\' configurabile', () => {
    const connection = new ConnectionHealth({ tolerance: 3 });
    connection.note(ROOF, 'error');
    connection.note(ROOF, 'error');
    assert.equal(connection.culprit(), null);
    connection.note(ROOF, 'error');
    assert.equal(connection.culprit(), 'server');
});
