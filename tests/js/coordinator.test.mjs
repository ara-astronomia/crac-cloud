import { test } from 'node:test';
import assert from 'node:assert';

// coordinator.js is the only module the page loads: if any import in its
// graph does not resolve, the whole frontend dies and every button stays
// disabled. Importing it here fails the suite exactly like the browser does.
test('coordinator.js si carica: ogni import del grafo dei moduli risolve', async () => {
    let registered = null;
    globalThis.document = {
        addEventListener: (event, fn) => { if (event === 'DOMContentLoaded') registered = fn; },
    };
    try {
        const mod = await import('../../crac_cloud/static/js/coordinator.js');
        assert.ok(mod);
        assert.equal(typeof registered, 'function');
    } finally {
        delete globalThis.document;
    }
});
