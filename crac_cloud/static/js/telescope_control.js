/** telescope_control.js - The telescope. Draws what the coordinator hands over, polls nothing. */

import { STATUS_LABELS_MAP, BUTTON_KEY_MAP, TELESCOPE_ACTION_MAP } from './gui_constants.js';
import { telescopeApi } from './api.js';
import { enableCommand } from './command_lock.js';

let connButton = null;
let parkButton = null;
let flatButton = null;
let autolightCheckbox = null;

export function initTelescopeControl() {
    connButton        = document.getElementById(BUTTON_KEY_MAP['KEY_TELESCOPE_CONNECTION_TOGGLE']);
    parkButton        = document.getElementById(BUTTON_KEY_MAP['KEY_PARK']);
    flatButton        = document.getElementById(BUTTON_KEY_MAP['KEY_FLAT']);
    autolightCheckbox = document.getElementById('Autolight');

    if (connButton) {
        connButton.dataset.action = TELESCOPE_ACTION_MAP['DISCONNECTED'];
        connButton.addEventListener('click', handleConnClick);
    }
    if (parkButton) {
        parkButton.dataset.action = TELESCOPE_ACTION_MAP['PARK_ACTION'];
        parkButton.addEventListener('click', handleParkClick);
    }
    if (flatButton) {
        flatButton.dataset.action = TELESCOPE_ACTION_MAP['FLAT_ACTION'];
        flatButton.addEventListener('click', handleFlatClick);
    }
    if (autolightCheckbox) {
        autolightCheckbox.addEventListener('change', handleAutolightChange);
    }

    console.log('[Telescope] Inizializzato.');
}

export function updateTelescopeUI(data) {
    if (!data || Object.keys(data).length === 0) return;

    const serverState = data.status || 'DISCONNECTED';
    const speed       = data.speed  || 'SPEED_NOT_TRACKING';

    const isConnected = !['DISCONNECTED', 'ERROR', 'LOST'].includes(serverState);

    _updateConnButton(data.gui, isConnected);
    _updateParkFlatButton(parkButton, _findButtonGui(data, 'LABEL_PARK'), isConnected,
        serverState === 'PARKED' ? 'Parked' : 'Park');
    _updateParkFlatButton(flatButton, _findButtonGui(data, 'LABEL_FLAT'), isConnected,
        serverState === 'FLATTER' ? 'Flatter' : 'Flat');

    _applyLabel('lbl_status_connect', `TELESCOPE_${serverState}`);

    let trackingKey = 'TELESCOPE_TRACKING_OFF';
    let slewingKey  = 'TELESCOPE_SLEWING_OFF';
    if (speed === 'SPEED_TRACKING')  trackingKey = 'TELESCOPE_TRACKING_ON';
    if (speed === 'SPEED_SLEWING')   slewingKey  = 'TELESCOPE_SLEWING_ON';
    _applyLabel('lbl_status_tracking', trackingKey);
    _applyLabel('lbl_status_slewing',  slewingKey);

    const altLabel = document.getElementById('lbl_status_altezza_telescopio');
    const azLabel  = document.getElementById('lbl_status_azimuth_telescopio');
    const aa = data.aa_coords;
    if (aa) {
        if (altLabel) altLabel.textContent = aa.alt !== undefined ? `${aa.alt.toFixed(2)}°` : 'N/A';
        if (azLabel)  azLabel.textContent  = aa.az  !== undefined ? `${aa.az.toFixed(2)}°`  : 'N/A';
    } else {
        if (altLabel) altLabel.textContent = 'N/A';
        if (azLabel)  azLabel.textContent  = 'N/A';
    }
}

async function handleConnClick() {
    if (!connButton || connButton.disabled) return;
    const action = connButton.dataset.action;
    if (!action) return;

    _setButtonTransition(connButton);
    const fn = action === TELESCOPE_ACTION_MAP['CONNECTED']
        ? telescopeApi.disconnect
        : telescopeApi.connect;
    const response = await fn();
    if (response && response.status) updateTelescopeUI(response);
}

async function handleParkClick() {
    if (!parkButton || parkButton.disabled) return;
    _setButtonTransition(parkButton);
    const autolight = autolightCheckbox ? autolightCheckbox.checked : false;
    const response = await telescopeApi.park(autolight);
    if (response && response.status) updateTelescopeUI(response);
}

async function handleFlatClick() {
    if (!flatButton || flatButton.disabled) return;
    _setButtonTransition(flatButton);
    const autolight = autolightCheckbox ? autolightCheckbox.checked : false;
    const response = await telescopeApi.flat(autolight);
    if (response && response.status) updateTelescopeUI(response);
}

async function handleAutolightChange() {
    const value = autolightCheckbox.checked;
    const response = await telescopeApi.check(value);
    if (!response || !response.status) {
        autolightCheckbox.checked = !value;
    }
}

function _applyLabel(elementId, statusKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const d = STATUS_LABELS_MAP[statusKey];
    if (!d) return;
    el.textContent = d.text;
    el.style.backgroundColor = d.background_color || '';
    el.style.color = d.text_color || '';
}

/** Without its own gui from crac-server the button keeps what it shows. */
function _updateConnButton(gui, isConnected) {
    if (!connButton || !gui || !gui.label) return;
    enableCommand(connButton, !gui.is_disabled);
    connButton.textContent = isConnected ? 'Connesso' : 'Disconnesso';
    connButton.dataset.action = isConnected
        ? TELESCOPE_ACTION_MAP['CONNECTED']
        : TELESCOPE_ACTION_MAP['DISCONNECTED'];
    _paint(connButton, gui.button_color);
}

/** crac-server enables Park and Flat also on a powered telescope that is not
 *  connected, so the button needs both the server and a connection. */
function _updateParkFlatButton(button, gui, isConnected, text) {
    if (!button || !gui) return;
    enableCommand(button, !gui.is_disabled && isConnected);
    button.textContent = text;
    _paint(button, gui.button_color);
}

function _paint(button, color) {
    if (!color) return;
    button.style.setProperty('background-color', color.background_color || '', 'important');
    button.style.setProperty('color', color.text_color || '', 'important');
}

function _findButtonGui(data, label) {
    return data.buttons_gui && data.buttons_gui.find(b => b.label === label);
}

function _setButtonTransition(btn) {
    btn.disabled = true;
    btn.style.setProperty('background-color', 'orange', 'important');
    btn.style.setProperty('color', 'white', 'important');
}
