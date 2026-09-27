import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import { initRoofControl, updateRoofUI } from '../../crac_cloud/static/js/roof_control.js';

function fakeElement() {
    const classes = new Set();
    return {
        disabled: false,
        textContent: '',
        style: { setProperty() {} },
        classList: {
            toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
            contains: (name) => classes.has(name),
        },
        addEventListener(type, handler) { this.click = handler; },
    };
}

const fetchVera = globalThis.fetch;
let page;
let comandiInviati;
let rispostaDelServer;

beforeEach(() => {
    page = {
        'roof-buttons': fakeElement(),
        'btn-tetto': fakeElement(),
        'btn-tetto-apri': fakeElement(),
        'btn-tetto-chiudi': fakeElement(),
    };
    globalThis.document = { getElementById: (id) => page[id] };
    comandiInviati = [];
    rispostaDelServer = { status: 'ROOF_CLOSING', gui: { label: 'LABEL_CLOSING', is_disabled: true } };
    globalThis.fetch = async (url, options) => {
        comandiInviati.push(JSON.parse(options.body).action);
        return { ok: true, json: async () => rispostaDelServer };
    };
    initRoofControl();
});

afterEach(() => {
    globalThis.fetch = fetchVera;
    delete globalThis.document;
});

const inErrore = () => page['roof-buttons'].classList.contains('in-error');
const tettoInErrore = { status: 'ROOF_ERROR', gui: { label: 'LABEL_ERROR', is_disabled: false } };
const tettoChiuso = { status: 'ROOF_CLOSED', gui: { label: 'LABEL_CLOSE', is_disabled: false } };

test('il tetto in errore mostra i due pulsanti, entrambi cliccabili', () => {
    updateRoofUI(tettoInErrore);
    assert.equal(inErrore(), true);
    assert.equal(page['btn-tetto-apri'].disabled, false);
    assert.equal(page['btn-tetto-chiudi'].disabled, false);
});

test('quando il tetto esce dall\'errore torna il pulsante unico', () => {
    updateRoofUI(tettoInErrore);
    updateRoofUI(tettoChiuso);
    assert.equal(inErrore(), false);
});

test('un tetto sano non mostra i due pulsanti', () => {
    updateRoofUI(tettoChiuso);
    assert.equal(inErrore(), false);
});

test('in errore Chiudi manda la chiusura e Apri l\'apertura', async () => {
    updateRoofUI(tettoInErrore);
    await page['btn-tetto-chiudi'].click();
    updateRoofUI(tettoInErrore);
    await page['btn-tetto-apri'].click();
    assert.deepEqual(comandiInviati, ['ROOF_CLOSE', 'ROOF_OPEN']);
});

test('mentre il comando e\' in viaggio nessuno dei due pulsanti si puo\' ripremere', async () => {
    updateRoofUI(tettoInErrore);
    let rispondi;
    globalThis.fetch = () => new Promise((resolve) => { rispondi = resolve; });

    const click = page['btn-tetto-chiudi'].click();
    assert.equal(page['btn-tetto-apri'].disabled, true);
    assert.equal(page['btn-tetto-chiudi'].disabled, true);

    rispondi({ ok: true, json: async () => rispostaDelServer });
    await click;
});

test('un comando rifiutato dal server disabilita solo il pulsante premuto', async () => {
    updateRoofUI(tettoInErrore);
    rispostaDelServer = { status: 'ROOF_ERROR', gui: { label: 'LABEL_ERROR', is_disabled: true } };

    await page['btn-tetto-chiudi'].click();

    assert.equal(page['btn-tetto-chiudi'].disabled, true);
    assert.equal(page['btn-tetto-apri'].disabled, false);
});

test('il pulsante unico continua a comandare come prima', async () => {
    updateRoofUI(tettoChiuso);
    await page['btn-tetto'].click();
    assert.deepEqual(comandiInviati, ['ROOF_OPEN']);
});
