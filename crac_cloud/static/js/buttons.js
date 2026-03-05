// =============================================================================
// buttons.js - Modulo puro per gli switch alimentatori e luci
// =============================================================================

import { buttonsApi } from './api.js';

const BUTTON_IDS = ['btn-tele-switch', 'btn-ccd-switch', 'btn-flat-light', 'btn-dome-light'];

const KEY_TO_ID = {
    'KEY_TELE_SWITCH': 'btn-tele-switch',
    'KEY_CCD_SWITCH':  'btn-ccd-switch',
    'KEY_FLAT_LIGHT':  'btn-flat-light',
    'KEY_DOME_LIGHT':  'btn-dome-light',
};

const LABEL_MAP = {
    'LABEL_ON':  'Acceso',
    'LABEL_OFF': 'Spento',
};

// =============================================================================
// INIT
// =============================================================================
export function initButtons() {
    BUTTON_IDS.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => handleButtonClick(btn));
        }
    });
    console.log('[Buttons] Inizializzato.');
}

// =============================================================================
// UPDATE — chiamato dal coordinator
// =============================================================================
export function updateButtonsUI(buttons) {
    if (!Array.isArray(buttons)) return;

    buttons.forEach(button => {
        const btnId = KEY_TO_ID[button.key];
        if (!btnId) return;
        const btn = document.getElementById(btnId);
        if (!btn) return;

        const gui = button.button_gui || {};
        const label = LABEL_MAP[gui.label] || gui.label || '';
        if (btn.textContent !== label) btn.textContent = label;
        btn.disabled = gui.is_disabled || false;

        if (gui.button_color) {
            btn.style.setProperty('background-color', gui.button_color.background_color || '', 'important');
            btn.style.setProperty('color', gui.button_color.text_color || '', 'important');
        }
        btn.dataset.status = gui.label === 'LABEL_ON' ? 'ON' : 'OFF';
    });
}

// =============================================================================
// CLICK HANDLER — toggle in base allo stato attuale
// =============================================================================
async function handleButtonClick(btn) {
    if (btn.disabled) return;

    // Ottieni la key dal mapping inverso
    const key = Object.entries(KEY_TO_ID).find(([, id]) => id === btn.id)?.[0];
    if (!key) return;

    const currentStatus = btn.dataset.status || 'OFF';
    const action = currentStatus === 'ON' ? 'TURN_OFF' : 'TURN_ON';

    // Optimistic UI
    btn.disabled = true;

    const response = await buttonsApi.toggle(key, action);
    if (response && response.button_gui) {
        // Aggiornamento immediato dalla risposta del server
        updateButtonsUI([{ key, button_gui: response.button_gui }]);
    } else {
        btn.disabled = false;
    }
}
