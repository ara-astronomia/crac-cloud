import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import { initRoofControl, updateRoofUI } from '../../crac_cloud/static/js/roof_control.js';

const OPEN = 1;
const CLOSE = 2;

function fakeButton() {
    return {
        disabled: false,
        textContent: '',
        style: { setProperty() {} },
        addEventListener(type, handler) { this.click = handler; },
    };
}

const fetchVera = globalThis.fetch;
let pulsante;
let comandiInviati;

beforeEach(() => {
    pulsante = fakeButton();
    globalThis.document = { getElementById: () => pulsante };
    comandiInviati = [];
    globalThis.fetch = async (url, options) => {
        comandiInviati.push(JSON.parse(options.body).action);
        return { ok: true, json: async () => ({ status: 'ROOF_OPENING', gui: { label: 'LABEL_OPENING', is_disabled: true } }) };
    };
    initRoofControl();
});

afterEach(() => {
    globalThis.fetch = fetchVera;
    delete globalThis.document;
});

const tettoInErrore = (metadata) => ({ status: 'ROOF_ERROR', gui: { label: 'LABEL_ERROR', metadata, is_disabled: false } });

test('in errore il pulsante manda il comando che propone crac-server', async () => {
    updateRoofUI(tettoInErrore(OPEN));
    await pulsante.click();
    updateRoofUI(tettoInErrore(CLOSE));
    await pulsante.click();
    assert.deepEqual(comandiInviati, ['ROOF_OPEN', 'ROOF_CLOSE']);
});

test('in errore il pulsante dice che cosa fara\' il click', () => {
    updateRoofUI(tettoInErrore(OPEN));
    assert.equal(pulsante.textContent, 'Errore: apri');
    updateRoofUI(tettoInErrore(CLOSE));
    assert.equal(pulsante.textContent, 'Errore: chiudi');
});

test('in errore senza un comando proposto il click non manda niente', async () => {
    updateRoofUI(tettoInErrore(undefined));
    await pulsante.click();
    assert.deepEqual(comandiInviati, []);
});

test('fuori dall\'errore il pulsante continua a comandare come prima', async () => {
    updateRoofUI({ status: 'ROOF_CLOSED', gui: { label: 'LABEL_CLOSE', metadata: OPEN, is_disabled: false } });
    assert.equal(pulsante.textContent, 'Chiuso');
    await pulsante.click();
    assert.deepEqual(comandiInviati, ['ROOF_OPEN']);
});
