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

    // Classe CSS in base allo stato
    let newClass = 'status-default';
    if (serverState === 'ROOF_CLOSED')       newClass = 'status-failure';
    else if (serverState === 'ROOF_OPENED')  newClass = 'status-success';
    else if (serverState.includes('ING'))    newClass = 'status-transition';
    else if (serverState.includes('ERROR') || serverState.includes('DANGER')) newClass = 'status-error';

    roofButton.classList.remove('status-failure', 'status-success', 'status-transition', 'status-error', 'status-default');
    roofButton.classList.add(newClass);
    roofButton.textContent = buttonText;
    roofButton.disabled = isDisabled;

    // Colori dal server (solo se non in transizione)
    roofButton.style.backgroundColor = '';
    roofButton.style.color = '';
    if (!serverState.includes('ING') && gui.button_color) {
        roofButton.style.backgroundColor = gui.button_color.background_color || '';
        roofButton.style.color = gui.button_color.text_color || '';
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
    roofButton.classList.remove('status-success', 'status-failure', 'status-error');
    roofButton.classList.add('status-transition');

    const action = commandToSend === 'ROOF_OPEN' ? roofApi.open : roofApi.close;
    const response = await action();

    // Il prossimo poll del coordinator aggiornerà lo stato definitivo.
    // Se c'è una risposta immediata, aggiorniamo subito.
    if (response && response.status) {
        updateRoofUI(response);
    }
}
