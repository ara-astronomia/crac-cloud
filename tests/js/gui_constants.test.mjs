import { test } from 'node:test';
import assert from 'node:assert';

import { labelText } from '../../crac_cloud/static/js/gui_constants.js';

test('il tetto in movimento dice quello che sta facendo', () => {
    assert.equal(labelText('LABEL_OPENING'), 'Apertura');
    assert.equal(labelText('LABEL_CLOSING'), 'Chiusura');
});

test('anche gli interruttori pescano dalla stessa mappa', () => {
    assert.equal(labelText('LABEL_ON'), 'Acceso');
    assert.equal(labelText('LABEL_OFF'), 'Spento');
});

test('una label senza traduzione finisce a schermo come arriva', () => {
    assert.equal(labelText('LABEL_CALIBRATE'), 'LABEL_CALIBRATE');
});
