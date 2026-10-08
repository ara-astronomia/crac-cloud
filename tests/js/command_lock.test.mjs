import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import { showLinkDown, showComponentFailing, enableCommand } from '../../crac_cloud/static/js/command_lock.js';

let comandi;
let classiDelBody;
let pulsanti;

beforeEach(() => {
    comandi = [{ disabled: false }, { disabled: false }];
    classiDelBody = new Set();
    pulsanti = Object.fromEntries(
        ['btn-conn-telescopio', 'btn-park', 'btn-flat', 'btn-tetto', 'btn-dome-light']
            .map(id => [id, { id, disabled: false }]),
    );
    globalThis.document = {
        getElementById: id => pulsanti[id] ?? null,
        querySelectorAll: selector => (selector === '.status-button' ? comandi : []),
        body: {
            classList: {
                toggle: (name, on) => (on ? classiDelBody.add(name) : classiDelBody.delete(name)),
            },
        },
    };
});

afterEach(() => {
    showLinkDown(false);
    ['telescope', 'roof', 'buttons', 'curtains', 'cover_mirror'].forEach(endpoint => showComponentFailing(endpoint, false));
    delete globalThis.document;
});

test('con il collegamento perso la pagina e\' ferma e tutti i comandi si disabilitano', () => {
    showLinkDown(true);
    assert.deepEqual(comandi.map(btn => btn.disabled), [true, true]);
    assert.ok(classiDelBody.has('data-stale'));
});

test('a ogni valutazione con il collegamento perso i comandi si disabilitano di nuovo', () => {
    showLinkDown(true);
    comandi[0].disabled = false;
    showLinkDown(true);
    assert.equal(comandi[0].disabled, true);
});

test('con il collegamento perso una lettura non riabilita il comando', () => {
    showLinkDown(true);
    enableCommand(comandi[0], true);
    assert.equal(comandi[0].disabled, true);
});

test('al ritorno del collegamento ogni comando aspetta la sua lettura', () => {
    showLinkDown(true);
    showLinkDown(false);
    assert.deepEqual(comandi.map(btn => btn.disabled), [true, true]);
    assert.ok(!classiDelBody.has('data-stale'));
    enableCommand(comandi[0], true);
    assert.equal(comandi[0].disabled, false);
});

test('con il collegamento attivo il comando segue la lettura', () => {
    enableCommand(comandi[0], false);
    assert.equal(comandi[0].disabled, true);
    enableCommand(comandi[0], true);
    assert.equal(comandi[0].disabled, false);
});

const statoDi = ids => ids.map(id => pulsanti[id].disabled);

test('un componente in errore disabilita solo i suoi pulsanti', () => {
    showComponentFailing('telescope', true);
    assert.deepEqual(statoDi(['btn-conn-telescopio', 'btn-park', 'btn-flat']), [true, true, true]);
    assert.deepEqual(statoDi(['btn-tetto', 'btn-dome-light']), [false, false]);
    assert.ok(!classiDelBody.has('data-stale'));
});

test('finche\' il componente e\' in errore nessuna risposta riabilita i suoi pulsanti', () => {
    showComponentFailing('telescope', true);
    enableCommand(pulsanti['btn-park'], true);
    enableCommand(pulsanti['btn-tetto'], true);
    assert.deepEqual(statoDi(['btn-park', 'btn-tetto']), [true, false]);
});

test('alla lettura riuscita del componente i suoi pulsanti seguono di nuovo crac-server', () => {
    showComponentFailing('roof', true);
    showComponentFailing('roof', false);
    assert.equal(pulsanti['btn-tetto'].disabled, true);
    enableCommand(pulsanti['btn-tetto'], true);
    assert.equal(pulsanti['btn-tetto'].disabled, false);
});

test('gli interruttori in errore disabilitano i quattro pulsanti di alimentazione e luci', () => {
    showComponentFailing('buttons', true);
    assert.equal(pulsanti['btn-dome-light'].disabled, true);
    assert.equal(pulsanti['btn-tetto'].disabled, false);
});

test('meteo e UPS non hanno pulsanti da disabilitare', () => {
    showComponentFailing('ups', true);
    showComponentFailing('charts', true);
    assert.deepEqual(statoDi(Object.keys(pulsanti)), [false, false, false, false, false]);
});
