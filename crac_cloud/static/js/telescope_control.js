// =============================================================================
// telescope_control.js - Modulo puro per il controllo del telescopio
// NON fa polling autonomo. Espone init() e updateTelescopeUI().
// =============================================================================

import { STATUS_LABELS_MAP, BUTTON_KEY_MAP, TELESCOPE_ACTION_MAP } from './gui_constants.js';
import { telescopeApi } from './api.js';

// Riferimenti DOM (inizializzati in init)
let connButton = null;
let parkButton = null;
let flatButton = null;
let autolightCheckbox = null;

// =============================================================================
// INIT — registra listener, chiamato una sola volta dal coordinator
// =============================================================================
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

// =============================================================================
// UPDATE — chiamato dal coordinator con i dati freschi del server
// =============================================================================
export function updateTelescopeUI(data) {
    if (!data || Object.keys(data).length === 0) return;

    const serverState = data.status || 'DISCONNECTED';
    const speed       = data.speed  || 'SPEED_NOT_TRACKING';

    const isConnected = !['DISCONNECTED', 'ERROR', 'LOST'].includes(serverState);

    // --- Pulsante connessione ---
    if (connButton) {
        connButton.disabled = false;
        const newText   = isConnected ? 'Connesso' : 'Disconnesso';
        const newAction = isConnected
            ? TELESCOPE_ACTION_MAP['CONNECTED']
            : TELESCOPE_ACTION_MAP['DISCONNECTED'];

        if (connButton.textContent !== newText) connButton.textContent = newText;
        if (connButton.dataset.action !== newAction) connButton.dataset.action = newAction;

        // Colore solido dal server, come gli altri pulsanti (tende, alimentatori,
        // specchio) — non più la classe CSS "pill" traslucida, per coerenza visiva.
        const color = data.gui && data.gui.button_color;
        if (color) {
            connButton.style.setProperty('background-color', color.background_color || '', 'important');
            connButton.style.setProperty('color', color.text_color || '', 'important');
        }
    }

    // --- Park / Flat ---
    if (parkButton) {
        const isParked = serverState === 'PARKED';
        parkButton.disabled = !isConnected;
        parkButton.textContent = isParked ? 'Parked' : 'Park';

        // Colore solido dal server, come connButton — non più la classe CSS
        // "pill" traslucida, per coerenza visiva.
        const color = _findButtonGui(data, 'LABEL_PARK');
        if (color) {
            parkButton.style.setProperty('background-color', color.background_color || '', 'important');
            parkButton.style.setProperty('color', color.text_color || '', 'important');
        }
    }
    if (flatButton) {
        const isFlatter = serverState === 'FLATTER';
        flatButton.disabled = !isConnected;
        flatButton.textContent = isFlatter ? 'Flatter' : 'Flat';

        const color = _findButtonGui(data, 'LABEL_FLAT');
        if (color) {
            flatButton.style.setProperty('background-color', color.background_color || '', 'important');
            flatButton.style.setProperty('color', color.text_color || '', 'important');
        }
    }

    // --- Label connessione / posizione ---
    _applyLabel('lbl_status_connect', `TELESCOPE_${serverState}`);

    // --- Tracking / Slewing ---
    let trackingKey = 'TELESCOPE_TRACKING_OFF';
    let slewingKey  = 'TELESCOPE_SLEWING_OFF';
    if (speed === 'SPEED_TRACKING')  trackingKey = 'TELESCOPE_TRACKING_ON';
    if (speed === 'SPEED_SLEWING')   slewingKey  = 'TELESCOPE_SLEWING_ON';
    _applyLabel('lbl_status_tracking', trackingKey);
    _applyLabel('lbl_status_slewing',  slewingKey);

    // --- Coordinate Alt/Az ---
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

// =============================================================================
// CLICK HANDLERS
// =============================================================================
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
    else connButton.disabled = false;
}

async function handleParkClick() {
    if (!parkButton || parkButton.disabled) return;
    _setButtonTransition(parkButton);
    const autolight = autolightCheckbox ? autolightCheckbox.checked : false;
    const response = await telescopeApi.park(autolight);
    if (response && response.status) updateTelescopeUI(response);
    else parkButton.disabled = false;
}

async function handleFlatClick() {
    if (!flatButton || flatButton.disabled) return;
    _setButtonTransition(flatButton);
    const autolight = autolightCheckbox ? autolightCheckbox.checked : false;
    const response = await telescopeApi.flat(autolight);
    if (response && response.status) updateTelescopeUI(response);
    else flatButton.disabled = false;
}

async function handleAutolightChange() {
    const value = autolightCheckbox.checked;
    const response = await telescopeApi.check(value);
    if (!response || !response.status) {
        // Rollback visivo se il server non risponde
        autolightCheckbox.checked = !value;
    }
}

// =============================================================================
// UTILITY
// =============================================================================
function _applyLabel(elementId, statusKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const d = STATUS_LABELS_MAP[statusKey];
    if (!d) return;
    el.textContent = d.text;
    el.style.backgroundColor = d.background_color || '';
    el.style.color = d.text_color || '';
}

function _findButtonGui(data, label) {
    const entry = data.buttons_gui && data.buttons_gui.find(b => b.label === label);
    return entry && entry.button_color;
}

function _setButtonTransition(btn) {
    btn.disabled = true;
    btn.style.setProperty('background-color', 'orange', 'important');
    btn.style.setProperty('color', 'white', 'important');
}
