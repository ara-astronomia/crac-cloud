import { test } from 'node:test';
import assert from 'node:assert';

import { ConnectionHealth } from '../../crac_cloud/static/js/connection.js';

const ROOF = 'roof';
const TELESCOPE = 'telescope';
const COVER = 'cover_mirror';
const UPS = 'ups';
const WEATHER = 'charts';

function fail(connection, outcome, ...endpoints) {
    endpoints.forEach(endpoint => connection.note(endpoint, outcome));
}

test('un componente in errore da solo non incolpa nessuno', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'error');
    assert.equal(connection.culprit(), null);
});

test('due componenti con due letture fallite di fila ciascuno incolpano crac-server', () => {
    const connection = new ConnectionHealth();
    fail(connection, 'error', ROOF, TELESCOPE);
    assert.equal(connection.culprit(), null);
    fail(connection, 'error', ROOF, TELESCOPE);
    assert.equal(connection.culprit(), 'server');
});

test('un componente e\' in errore dopo due letture fallite di fila, e torna con la prima buona', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'error');
    assert.equal(connection.isFailing(ROOF), false);
    connection.note(ROOF, 'timeout');
    assert.equal(connection.isFailing(ROOF), true);
    connection.note(TELESCOPE, 'ok');
    assert.equal(connection.isFailing(ROOF), true);
    connection.note(ROOF, 'ok');
    assert.equal(connection.isFailing(ROOF), false);
});

test('un solo componente che fallisce di continuo non e\' il collegamento perso', () => {
    const connection = new ConnectionHealth();
    fail(connection, 'error', TELESCOPE, TELESCOPE, TELESCOPE, TELESCOPE, TELESCOPE);
    assert.equal(connection.culprit(), null);
});

test('un solo componente in errore mentre gli altri rispondono non accende mai l\'avviso', () => {
    const connection = new ConnectionHealth();
    const culprits = [];
    for (let i = 0; i < 5; i++) {
        [[ROOF, 'ok'], [TELESCOPE, 'error'], [TELESCOPE, 'error']].forEach(([endpoint, outcome]) => {
            connection.note(endpoint, outcome);
            culprits.push(connection.culprit());
        });
    }
    assert.deepEqual(new Set(culprits), new Set([null]));
});

test('una lettura buona azzera solo lo stato del proprio componente', () => {
    const connection = new ConnectionHealth();
    fail(connection, 'error', TELESCOPE, COVER);
    connection.note(ROOF, 'ok');
    fail(connection, 'error', TELESCOPE, COVER);
    assert.equal(connection.culprit(), 'server');
    connection.note(TELESCOPE, 'ok');
    assert.equal(connection.culprit(), null);
});

test('al ritorno di crac-server i fallimenti vecchi dei componenti lenti non tengono l\'avviso', () => {
    const connection = new ConnectionHealth();
    [0, 1].forEach(t => [UPS, WEATHER].forEach(endpoint => connection.note(endpoint, 'error', t * 1000)));
    assert.equal(connection.culprit(2000), 'server');
    connection.note(TELESCOPE, 'ok', 3000);
    assert.equal(connection.culprit(15000), null);
});

test('le letture che non raggiungono crac-cloud non lo incolpano: lo decide la sonda', () => {
    const connection = new ConnectionHealth();
    fail(connection, 'unreachable', ROOF, ROOF, ROOF);
    assert.equal(connection.culprit(), null);
});

test('il browser che si dichiara offline incolpa subito il collegamento', () => {
    const connection = new ConnectionHealth();
    connection.setBrowserOffline(true);
    assert.equal(connection.culprit(), 'cloud');
});

test('il browser che torna online chiude l\'avviso del collegamento', () => {
    const connection = new ConnectionHealth();
    connection.setBrowserOffline(true);
    connection.setBrowserOffline(false);
    assert.equal(connection.culprit(), null);
});

test('la tolleranza della sonda e\' configurabile', () => {
    const connection = new ConnectionHealth({ tolerance: 3 });
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), null);
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), 'cloud');
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
    fail(connection, 'error', ROOF, TELESCOPE, ROOF, TELESCOPE);
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
    fail(connection, 'error', ROOF, TELESCOPE, ROOF, TELESCOPE);
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), 'server');
});

test('letture che scadono senza che nessuno risponda: la sonda muta incolpa il collegamento', () => {
    const connection = new ConnectionHealth();
    fail(connection, 'timeout', ROOF, TELESCOPE, ROOF, TELESCOPE);
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), 'cloud');
});

test('letture che scadono mentre la sonda risponde: e\' crac-server a prendersela comoda', () => {
    const connection = new ConnectionHealth();
    connection.noteHealth('ok');
    fail(connection, 'timeout', ROOF, TELESCOPE, ROOF, TELESCOPE);
    assert.equal(connection.culprit(), 'server');
});

test('se dopo crac-server cade anche il collegamento, la colpa passa al collegamento', () => {
    const connection = new ConnectionHealth();
    fail(connection, 'error', ROOF, TELESCOPE, ROOF, TELESCOPE);
    assert.equal(connection.culprit(), 'server');
    fail(connection, 'unreachable', ROOF, TELESCOPE);
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), 'cloud');
});

test('se le letture rispondono, una sonda che fallisce da sola non incolpa nessuno', () => {
    const connection = new ConnectionHealth();
    connection.note(ROOF, 'ok');
    connection.noteHealth('unreachable');
    connection.noteHealth('unreachable');
    assert.equal(connection.culprit(), null);
});
