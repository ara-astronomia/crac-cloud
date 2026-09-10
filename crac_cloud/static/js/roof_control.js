// roof_control.js - The roof. Draws what the coordinator hands over, polls nothing.

import { STATUS_LABELS_MAP, ROOF_STATE_TO_ACTION_MAP } from './gui_constants.js';
import { roofApi } from './api.js';

let lastKnownRoofState = 'ROOF_DEFAULT_STATUS';
let roofButton = null;

export function initRoofControl() {
    roofButton = document.getElementById('btn-tetto');
    if (!roofButton) {
        console.error('[Roof] Pulsante #btn-tetto non trovato.');
        return;
    }
    roofButton.addEventListener('click', handleRoofClick);
    console.log('[Roof] Inizializzato.');
}

export function updateRoofUI(data) {
    if (!roofButton || !data) return;

    const serverState = data.status || '';
    lastKnownRoofState = serverState;

    const gui = data.gui || {};
    const enumLabel = gui.label || 'DEFAULT_LABEL';
    const labelData = STATUS_LABELS_MAP[enumLabel] || {};
    const buttonText = labelData.text || enumLabel;
    const isDisabled = gui.is_disabled !== undefined ? gui.is_disabled : false;

    roofButton.textContent = buttonText;
    roofButton.disabled = isDisabled;

    // While OPENING/CLOSING the server still sends the previous red/green, so
    // the orange is put on here until the final status arrives.
    let color = gui.button_color;
    if (serverState.includes('ING')) {
        color = { background_color: 'orange', text_color: 'white' };
    }
    if (color) {
        roofButton.style.setProperty('background-color', color.background_color || '', 'important');
        roofButton.style.setProperty('color', color.text_color || '', 'important');
    }
}

async function handleRoofClick() {
    if (roofButton.disabled) return;

    const commandToSend = ROOF_STATE_TO_ACTION_MAP[lastKnownRoofState];
    if (!commandToSend) {
        console.warn(`[Roof] Nessun comando per stato: ${lastKnownRoofState}`);
        return;
    }

    // Optimistic UI: disabilita subito il pulsante
    roofButton.disabled = true;
    roofButton.style.setProperty('background-color', 'orange', 'important');
    roofButton.style.setProperty('color', 'white', 'important');

    const action = commandToSend === 'ROOF_OPEN' ? roofApi.open : roofApi.close;
    const response = await action();

    // Il prossimo poll del coordinator aggiornerà lo stato definitivo.
    // Se c'è una risposta immediata, aggiorniamo subito.
    if (response && response.status) {
        updateRoofUI(response);
    }
}
