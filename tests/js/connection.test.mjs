import { test } from 'node:test';
import assert from 'node:assert';

import { ConnectionHealth } from '../../crac_cloud/static/js/connection.js';

const ROOF = 'roof';
const TELESCOPE = 'telescope';

test('un fallimento isolato non dichiara giu\' il collegamento', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, false);
    assert.equal(connection.isDown(), false);
});

test('due fallimenti di fila sullo stesso endpoint dichiarano giu\' il collegamento', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, false);
    connection.note(ROOF, false);
    assert.equal(connection.isDown(), true);
});

test('una risposta buona azzera il conteggio e riporta su il collegamento', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, false);
    connection.note(ROOF, false);
    connection.note(ROOF, true);
    assert.equal(connection.isDown(), false);
    connection.note(ROOF, false);
    assert.equal(connection.isDown(), false);
});

test('endpoint diversi contano separatamente', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, false);
    connection.note(TELESCOPE, false);
    assert.equal(connection.isDown(), false);
});

test('un endpoint giu\' basta a dichiarare giu\' il collegamento', () => {
    const connection = new ConnectionHealth();
    connection.note(TELESCOPE, true);
    connection.note(ROOF, false);
    connection.note(ROOF, false);
    assert.equal(connection.isDown(), true);
});

test('la tolleranza e\' configurabile', () => {
    const connection = new ConnectionHealth({ tolerance: 3 });
    connection.note(ROOF, false);
    connection.note(ROOF, false);
    assert.equal(connection.isDown(), false);
    connection.note(ROOF, false);
    assert.equal(connection.isDown(), true);
});
