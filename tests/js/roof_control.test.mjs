import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import { initRoofControl, updateRoofUI } from '../../crac_cloud/static/js/roof_control.js';
import { showLinkDown } from '../../crac_cloud/static/js/command_lock.js';

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
    globalThis.document = {
        getElementById: () => pulsante,
        querySelectorAll: () => [pulsante],
        body: { classList: { toggle() {} } },
    };
    comandiInviati = [];
    globalThis.fetch = async (url, options) => {
        comandiInviati.push(JSON.parse(options.body).action);
        return { ok: true, json: async () => ({ status: 'ROOF_OPENING', gui: { label: 'LABEL_OPENING', is_disabled: true } }) };
    };
    initRoofControl();
});

afterEach(() => {
    showLinkDown(false);
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

test('il pulsante segue is_disabled di crac-server', () => {
    updateRoofUI({ status: 'ROOF_CLOSED', gui: { label: 'LABEL_CLOSE', is_disabled: true } });
    assert.equal(pulsante.disabled, true);
});

test('una lettura senza dati grafici non abilita e non ridipinge il pulsante', () => {
    pulsante.disabled = true;
    pulsante.textContent = 'Chiuso';
    updateRoofUI({ status: 'ROOF_CLOSED' });
    updateRoofUI({ status: 'ROOF_CLOSED', gui: { is_disabled: false } });
    assert.equal(pulsante.disabled, true);
    assert.equal(pulsante.textContent, 'Chiuso');
});

test('una risposta al comando senza dati grafici non riabilita il pulsante', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'error', message: 'Azione non valida' }) });
    updateRoofUI({ status: 'ROOF_CLOSED', gui: { label: 'LABEL_CLOSE', metadata: OPEN, is_disabled: false } });
    await pulsante.click();
    assert.equal(pulsante.disabled, true);
});

test('sotto l\'avviso di collegamento la risposta tardiva al comando non riabilita il tetto', async () => {
    const tettoChiuso = { status: 'ROOF_CLOSED', gui: { label: 'LABEL_CLOSE', metadata: OPEN, is_disabled: false } };
    updateRoofUI(tettoChiuso);
    globalThis.fetch = async () => {
        showLinkDown(true);
        return { ok: true, json: async () => tettoChiuso };
    };
    await pulsante.click();
    assert.equal(pulsante.disabled, true);
});

test('una risposta al comando con un errore non riabilita il pulsante', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ error: 'crac-server unavailable' }) });
    updateRoofUI({ status: 'ROOF_CLOSED', gui: { label: 'LABEL_CLOSE', metadata: OPEN, is_disabled: false } });
    await pulsante.click();
    assert.equal(pulsante.disabled, true);
});
