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

test('conta l\'ultima prova: se crac-cloud ha appena risposto, il muto e\' crac-server', () => {
    const connection = new ConnectionHealth();
    connection.note(TELESCOPE, 'unreachable');
    connection.note(TELESCOPE, 'unreachable');
    connection.note(ROOF, 'error');
    connection.note(ROOF, 'error');
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

test('due sonde di salute fallite di fila incolpano il collegamento col browser', () => {
    const connection = new ConnectionHealth();
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), null);
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), 'cloud');
});

test('la sonda di salute che risponde non zittisce l\'avviso su crac-server', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'error');
    connection.note(ROOF, 'error');
    connection.noteHealth('ok');
    assert.equal(connection.culprit(), 'server');
});

test('la sonda di salute che torna a rispondere chiude l\'avviso del collegamento', () => {
    const connection = new ConnectionHealth();
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    connection.noteHealth('ok');
    assert.equal(connection.culprit(), null);
});

test('una lettura buona dimostra che rispondono entrambi, sonda compresa', () => {
    const connection = new ConnectionHealth();
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    connection.note(ROOF, 'ok');
    assert.equal(connection.culprit(), null);
});

test('con crac-server muto la sonda affamata non sposta la colpa: crac-cloud ha appena risposto', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'error');
    connection.note(ROOF, 'error');
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), 'server');
});

test('letture che scadono senza che nessuno risponda: la sonda muta incolpa il collegamento', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'timeout');
    connection.note(ROOF, 'timeout');
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), 'cloud');
});

test('letture che scadono mentre la sonda risponde: e\' crac-server a prendersela comoda', () => {
    const connection = new ConnectionHealth();
    connection.noteHealth('ok');
    connection.note(ROOF, 'timeout');
    connection.note(ROOF, 'timeout');
    assert.equal(connection.culprit(), 'server');
});

test('se dopo crac-server cade anche il collegamento, la colpa passa al collegamento', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'error');
    connection.note(ROOF, 'error');
    assert.equal(connection.culprit(), 'server');
    connection.note(ROOF, 'unreachable');
    connection.note(ROOF, 'unreachable');
    assert.equal(connection.culprit(), 'cloud');
});

test('se le letture rispondono, una sonda che fallisce da sola non incolpa nessuno', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'ok');
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), null);
});
