import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import { initTelescopeControl, updateTelescopeUI } from '../../crac_cloud/static/js/telescope_control.js';
import { showLinkDown, showComponentFailing } from '../../crac_cloud/static/js/command_lock.js';

function fakeButton(id) {
    return {
        id,
        disabled: true,
        textContent: '',
        dataset: {},
        style: { setProperty() {} },
        addEventListener(type, handler) { this.click = handler; },
    };
}

const fetchVera = globalThis.fetch;
let pulsanti;
let rispostaAlComando;

beforeEach(() => {
    pulsanti = {
        'btn-conn-telescopio': fakeButton('btn-conn-telescopio'),
        'btn-park': fakeButton('btn-park'),
        'btn-flat': fakeButton('btn-flat'),
    };
    globalThis.document = {
        getElementById: id => pulsanti[id] ?? null,
        querySelectorAll: () => Object.values(pulsanti),
        body: { classList: { toggle() {} } },
    };
    rispostaAlComando = { error: 'crac-server unavailable' };
    globalThis.fetch = async () => ({ ok: true, json: async () => rispostaAlComando });
    initTelescopeControl();
});

afterEach(() => {
    showLinkDown(false);
    showComponentFailing('telescope', false);
    globalThis.fetch = fetchVera;
    delete globalThis.document;
});

const color = { background_color: 'white', text_color: 'black' };

function telescopio(status, { conn = false, park = false, flat = false } = {}) {
    const connLabel = status === 'DISCONNECTED' || status === 'LOST'
        ? 'LABEL_TELESCOPE_DISCONNECTED' : 'LABEL_TELESCOPE_CONNECTED';
    return {
        status,
        speed: 'SPEED_NOT_TRACKING',
        buttons_gui: [
            { label: connLabel, is_disabled: conn, button_color: color },
            { label: 'LABEL_PARK', is_disabled: park, button_color: color },
            { label: 'LABEL_FLAT', is_disabled: flat, button_color: color },
        ],
        gui: { label: connLabel, is_disabled: conn, button_color: color },
    };
}

test('alimentazione spenta: crac-server disabilita Connetti e il pulsante resta disabilitato', () => {
    updateTelescopeUI(telescopio('LOST', { conn: true, park: true, flat: true }));
    assert.equal(pulsanti['btn-conn-telescopio'].disabled, true);
});

test('Connetti si abilita quando crac-server lo manda abilitato', () => {
    updateTelescopeUI(telescopio('DISCONNECTED'));
    assert.equal(pulsanti['btn-conn-telescopio'].disabled, false);
});

test('senza il proprio dato grafico Connetti non si abilita', () => {
    const { gui, buttons_gui, ...soloStato } = telescopio('DISCONNECTED');
    updateTelescopeUI(soloStato);
    assert.equal(pulsanti['btn-conn-telescopio'].disabled, true);
});

test('connesso, Park e Flat seguono is_disabled di crac-server', () => {
    updateTelescopeUI(telescopio('TRACKING', { park: true, flat: true }));
    assert.equal(pulsanti['btn-park'].disabled, true);
    assert.equal(pulsanti['btn-flat'].disabled, true);
    updateTelescopeUI(telescopio('TRACKING'));
    assert.equal(pulsanti['btn-park'].disabled, false);
    assert.equal(pulsanti['btn-flat'].disabled, false);
});

test('disconnesso, Park e Flat restano disabilitati anche se crac-server li abilita', () => {
    updateTelescopeUI(telescopio('DISCONNECTED'));
    assert.equal(pulsanti['btn-park'].disabled, true);
    assert.equal(pulsanti['btn-flat'].disabled, true);
});

test('senza il proprio dato grafico Park e Flat non si abilitano', () => {
    updateTelescopeUI({ ...telescopio('TRACKING'), buttons_gui: [] });
    assert.equal(pulsanti['btn-park'].disabled, true);
    assert.equal(pulsanti['btn-flat'].disabled, true);
});

test('un comando che fallisce non riabilita il pulsante: lo decide la lettura seguente', async () => {
    updateTelescopeUI(telescopio('DISCONNECTED'));
    await pulsanti['btn-conn-telescopio'].click();
    assert.equal(pulsanti['btn-conn-telescopio'].disabled, true);

    updateTelescopeUI(telescopio('TRACKING'));
    await pulsanti['btn-park'].click();
    assert.equal(pulsanti['btn-park'].disabled, true);
    await pulsanti['btn-flat'].click();
    assert.equal(pulsanti['btn-flat'].disabled, true);
});

test('sotto l\'avviso di collegamento la risposta tardiva al comando non riabilita i pulsanti', async () => {
    updateTelescopeUI(telescopio('TRACKING'));
    globalThis.fetch = async () => {
        showLinkDown(true);
        return { ok: true, json: async () => telescopio('TRACKING') };
    };
    await pulsanti['btn-park'].click();
    assert.deepEqual(
        ['btn-conn-telescopio', 'btn-park', 'btn-flat'].map(id => pulsanti[id].disabled),
        [true, true, true],
    );
});

test('con la lettura del telescopio in errore la risposta tardiva al comando non riabilita i pulsanti', async () => {
    updateTelescopeUI(telescopio('TRACKING'));
    globalThis.fetch = async () => {
        showComponentFailing('telescope', true);
        return { ok: true, json: async () => telescopio('TRACKING') };
    };
    await pulsanti['btn-park'].click();
    assert.deepEqual(
        ['btn-conn-telescopio', 'btn-park', 'btn-flat'].map(id => pulsanti[id].disabled),
        [true, true, true],
    );
});
