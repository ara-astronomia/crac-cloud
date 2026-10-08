import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import { initCurtains, updateCurtainsUI } from '../../crac_cloud/static/js/curtains.js';
import { showLinkDown } from '../../crac_cloud/static/js/command_lock.js';

function fakeButton() {
    return {
        disabled: true,
        textContent: 'Disattive',
        style: { setProperty() {} },
        addEventListener(type, handler) { this.click = handler; },
    };
}

const fetchVera = globalThis.fetch;
let pulsante;

beforeEach(() => {
    pulsante = fakeButton();
    globalThis.document = {
        getElementById: id => (id === 'btn-curtains' ? pulsante : null),
        querySelectorAll: () => [pulsante],
        body: { classList: { toggle() {} } },
    };
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ error: 'crac-server unavailable' }) });
    initCurtains();
});

afterEach(() => {
    showLinkDown(false);
    globalThis.fetch = fetchVera;
    delete globalThis.document;
});

const tendeDisattive = {
    curtains: [],
    buttons_gui: [{ key: 'KEY_CURTAINS', label: 'LABEL_DISABLE', is_disabled: false }],
};

test('le tende seguono is_disabled di crac-server', () => {
    updateCurtainsUI(tendeDisattive);
    assert.equal(pulsante.disabled, false);
    updateCurtainsUI({ ...tendeDisattive, buttons_gui: [{ ...tendeDisattive.buttons_gui[0], is_disabled: true }] });
    assert.equal(pulsante.disabled, true);
});

test('sotto l\'avviso di collegamento la risposta tardiva al comando non riabilita le tende', async () => {
    updateCurtainsUI(tendeDisattive);
    globalThis.fetch = async () => {
        showLinkDown(true);
        return { ok: true, json: async () => tendeDisattive };
    };
    await pulsante.click();
    assert.equal(pulsante.disabled, true);
});
