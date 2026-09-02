// =============================================================================
// roof_control.js - Modulo puro per il controllo del tetto
// NON fa polling autonomo. Espone init() e updateRoofUI().
// Il coordinator chiama updateRoofUI() con i dati freschi.
// =============================================================================

import { STATUS_LABELS_MAP, ROOF_STATE_TO_ACTION_MAP } from './gui_constants.js';
import { roofApi } from './api.js';

let lastKnownRoofState = 'ROOF_DEFAULT_STATUS';
let roofButton = null;

// =============================================================================
// INIT — registra listener click, chiamato una sola volta dal coordinator
// =============================================================================
export function initRoofControl() {
    roofButton = document.getElementById('btn-tetto');
    if (!roofButton) {
        console.error('[Roof] Pulsante #btn-tetto non trovato.');
        return;
    }
    roofButton.addEventListener('click', handleRoofClick);
    console.log('[Roof] Inizializzato.');
}

// =============================================================================
// UPDATE — chiamato dal coordinator con i dati freschi del server
// =============================================================================
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

    // Colore solido, come gli altri pulsanti (tende, alimentatori, specchio).
    // Il server manda ancora il colore rosso/verde dello stato precedente durante
    // OPENING/CLOSING (vedi roof_converter.py), quindi qui lo sovrascriviamo con
    // l'arancione locale finché non arriva lo stato finale.
    let color = gui.button_color;
    if (serverState.includes('ING')) {
        color = { background_color: 'orange', text_color: 'white' };
    }
    if (color) {
        roofButton.style.setProperty('background-color', color.background_color || '', 'important');
        roofButton.style.setProperty('color', color.text_color || '', 'important');
    }
}

// =============================================================================
// CLICK HANDLER
// =============================================================================
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
