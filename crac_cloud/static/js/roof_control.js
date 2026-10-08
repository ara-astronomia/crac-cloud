/** roof_control.js - The roof. Draws what the coordinator hands over, polls nothing. */

import { labelText, ROOF_STATE_TO_ACTION_MAP } from './gui_constants.js';
import { roofApi } from './api.js';
import { enableCommand } from './command_lock.js';

/** RoofAction values from the contract. In error the position of the roof is
 *  unknown, so crac-server tells which command the button offers. */
const COMMAND_OFFERED_IN_ERROR = {
    1: { command: 'ROOF_OPEN', text: 'apri' },
    2: { command: 'ROOF_CLOSE', text: 'chiudi' },
};

/** While OPENING/CLOSING crac-server still sends the previous red or green. */
const IN_MOTION_COLOR = { background_color: 'orange', text_color: 'white' };

let lastKnownRoofState = 'ROOF_DEFAULT_STATUS';
let offeredInError = null;
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

/** Without its own gui from crac-server the button keeps what it shows. */
export function updateRoofUI(data) {
    if (!roofButton || !data || !data.gui || !data.gui.label) return;

    const serverState = data.status || '';
    lastKnownRoofState = serverState;

    const gui = data.gui;
    const enumLabel = gui.label;
    const isDisabled = !!gui.is_disabled;

    offeredInError = serverState === 'ROOF_ERROR' ? COMMAND_OFFERED_IN_ERROR[gui.metadata] : null;
    roofButton.textContent = offeredInError
        ? `${labelText(enumLabel)}: ${offeredInError.text}`
        : labelText(enumLabel);
    enableCommand(roofButton, !isDisabled);

    const color = serverState.includes('ING') ? IN_MOTION_COLOR : gui.button_color;
    if (color) {
        roofButton.style.setProperty('background-color', color.background_color || '', 'important');
        roofButton.style.setProperty('color', color.text_color || '', 'important');
    }
}

async function handleRoofClick() {
    if (roofButton.disabled) return;

    const commandToSend = lastKnownRoofState === 'ROOF_ERROR'
        ? offeredInError?.command
        : ROOF_STATE_TO_ACTION_MAP[lastKnownRoofState];
    if (!commandToSend) {
        console.warn(`[Roof] Nessun comando per stato: ${lastKnownRoofState}`);
        return;
    }

    roofButton.disabled = true;
    roofButton.style.setProperty('background-color', 'orange', 'important');
    roofButton.style.setProperty('color', 'white', 'important');

    const action = commandToSend === 'ROOF_OPEN' ? roofApi.open : roofApi.close;
    const response = await action();

    if (response && response.status) {
        updateRoofUI(response);
    }
}
