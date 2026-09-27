// roof_control.js - The roof. Draws what the coordinator hands over, polls nothing.

import { labelText, ROOF_STATE_TO_ACTION_MAP } from './gui_constants.js';
import { roofApi } from './api.js';

let lastKnownRoofState = 'ROOF_DEFAULT_STATUS';
let roofButtons = null;
let roofButton = null;
let openButton = null;
let closeButton = null;

export function initRoofControl() {
    roofButtons = document.getElementById('roof-buttons');
    roofButton = document.getElementById('btn-tetto');
    openButton = document.getElementById('btn-tetto-apri');
    closeButton = document.getElementById('btn-tetto-chiudi');
    if (!roofButtons || !roofButton || !openButton || !closeButton) {
        console.error('[Roof] Pulsanti del tetto non trovati.');
        return;
    }
    roofButton.addEventListener('click', handleRoofClick);
    openButton.addEventListener('click', () => sendFromError(openButton, 'ROOF_OPEN'));
    closeButton.addEventListener('click', () => sendFromError(closeButton, 'ROOF_CLOSE'));
    console.log('[Roof] Inizializzato.');
}

export function updateRoofUI(data) {
    if (!roofButton || !data) return;

    const serverState = data.status || '';
    lastKnownRoofState = serverState;

    const gui = data.gui || {};
    const enumLabel = gui.label || 'DEFAULT_LABEL';
    const isDisabled = gui.is_disabled !== undefined ? gui.is_disabled : false;

    roofButtons.classList.toggle('in-error', serverState === 'ROOF_ERROR');
    roofButton.textContent = labelText(enumLabel);
    roofButton.disabled = isDisabled;
    openButton.disabled = false;
    closeButton.disabled = false;

    // While OPENING/CLOSING the server still sends the previous red/green, so
    // the orange is put on here until the final status arrives.
    let color = gui.button_color;
    if (serverState.includes('ING')) {
        color = { background_color: 'orange', text_color: 'white' };
    }
    if (color) {
        for (const button of [roofButton, openButton, closeButton]) {
            paint(button, color);
        }
    }
}

function paint(button, color) {
    button.style.setProperty('background-color', color.background_color || '', 'important');
    button.style.setProperty('color', color.text_color || '', 'important');
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
    paint(roofButton, { background_color: 'orange', text_color: 'white' });

    const response = await send(commandToSend);

    // Il prossimo poll del coordinator aggiornerà lo stato definitivo.
    // Se c'è una risposta immediata, aggiorniamo subito.
    if (response && response.status) {
        updateRoofUI(response);
    }
}

/** With the roof in error the server checks the command against the way it
 *  would move the roof, and a refusal comes back as a disabled button: only
 *  the pressed one is disabled, the other direction may still be allowed. */
async function sendFromError(pressed, command) {
    if (pressed.disabled) return;
    openButton.disabled = true;
    closeButton.disabled = true;

    const response = await send(command);

    if (response && response.status) {
        const refused = response.status === 'ROOF_ERROR' && response.gui?.is_disabled;
        updateRoofUI(response);
        pressed.disabled = Boolean(refused);
    }
}

function send(command) {
    return command === 'ROOF_OPEN' ? roofApi.open() : roofApi.close();
}
