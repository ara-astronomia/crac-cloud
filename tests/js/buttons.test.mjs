import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import {
    initButtons, updateButtonsUI, initCoverMirror, updateCoverMirrorUI,
} from '../../crac_cloud/static/js/buttons.js';

function fakeButton(id) {
    return {
        id,
        disabled: true,
        textContent: 'Spento',
        dataset: {},
        style: { setProperty() {} },
        addEventListener(type, handler) { this.click = handler; },
    };
}

const fetchVera = globalThis.fetch;
let pulsanti;
let rispostaAlComando;

beforeEach(() => {
    pulsanti = Object.fromEntries(
        ['btn-tele-switch', 'btn-ccd-switch', 'btn-flat-light', 'btn-dome-light', 'btn-cover-mirror']
            .map(id => [id, fakeButton(id)]),
    );
    globalThis.document = { getElementById: id => pulsanti[id] ?? null };
    rispostaAlComando = { status: 'error', message: 'crac-server unavailable' };
    globalThis.fetch = async () => ({ ok: true, json: async () => rispostaAlComando });
    initButtons();
    initCoverMirror();
});

afterEach(() => {
    globalThis.fetch = fetchVera;
    delete globalThis.document;
});

const luceCupola = (button_gui) => ({ key: 'KEY_DOME_LIGHT', button_gui });

test('un interruttore segue is_disabled di crac-server', () => {
    updateButtonsUI([luceCupola({ label: 'LABEL_OFF', is_disabled: true })]);
    assert.equal(pulsanti['btn-dome-light'].disabled, true);
    updateButtonsUI([luceCupola({ label: 'LABEL_OFF', is_disabled: false })]);
    assert.equal(pulsanti['btn-dome-light'].disabled, false);
});

test('un interruttore senza etichetta non si abilita', () => {
    updateButtonsUI([luceCupola({ is_disabled: false })]);
    assert.equal(pulsanti['btn-dome-light'].disabled, true);
});

test('un comando senza dati grafici in risposta non riabilita l\'interruttore', async () => {
    updateButtonsUI([luceCupola({ label: 'LABEL_OFF', is_disabled: false })]);
    await pulsanti['btn-dome-light'].click();
    assert.equal(pulsanti['btn-dome-light'].disabled, true);
});

test('la copertura specchio segue is_disabled di crac-server', () => {
    updateCoverMirrorUI({ status: 'CLOSED', gui: { label: 'LABEL_CLOSE', is_disabled: true } });
    assert.equal(pulsanti['btn-cover-mirror'].disabled, true);
    updateCoverMirrorUI({ status: 'CLOSED', gui: { label: 'LABEL_CLOSE', is_disabled: false } });
    assert.equal(pulsanti['btn-cover-mirror'].disabled, false);
});

test('la copertura specchio senza etichetta non si abilita e non perde il testo', () => {
    updateCoverMirrorUI({ status: 'CLOSED', gui: { is_disabled: false } });
    assert.equal(pulsanti['btn-cover-mirror'].disabled, true);
    assert.equal(pulsanti['btn-cover-mirror'].textContent, 'Spento');
});

test('un comando alla copertura senza dati grafici in risposta non la riabilita', async () => {
    updateCoverMirrorUI({ status: 'CLOSED', gui: { label: 'LABEL_CLOSE', is_disabled: false, metadata: 'OPEN_COVER_MIRROR' } });
    await pulsanti['btn-cover-mirror'].click();
    assert.equal(pulsanti['btn-cover-mirror'].disabled, true);
});
