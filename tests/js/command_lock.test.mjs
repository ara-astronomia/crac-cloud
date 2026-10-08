import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import { showLinkDown, enableCommand } from '../../crac_cloud/static/js/command_lock.js';

let comandi;
let classiDelBody;

beforeEach(() => {
    comandi = [{ disabled: false }, { disabled: false }];
    classiDelBody = new Set();
    globalThis.document = {
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
