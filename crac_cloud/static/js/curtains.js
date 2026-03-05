// =============================================================================
// curtains.js - Modulo puro per il controllo delle tende
// =============================================================================

import { curtainsApi } from './api.js';
import { STATUS_LABELS_MAP } from './gui_constants.js';

// Canvas e configurazione geometrica
let canvas = null;
let ctx = null;
const config = {
    l: 340, h: 0,
    conv: Math.PI / 180,
    alpha_min_conf: -12,
    t_base: 340 / 4.25,
    delta_pt_base: 1.9 * (340 / 4.25),
    tenda_raggio: 110,
    ROOF_ANGLE: 20,
};

let curtainButton = null;
let curtainsEnabled = false;

// =============================================================================
// INIT
// =============================================================================
export function initCurtains() {
    curtainButton = document.getElementById('btn-curtains');
    console.log('[Curtains] btn-curtains trovato:', curtainButton);
    canvas = document.getElementById('curtainsCanvas');
    ctx = canvas ? canvas.getContext('2d') : null;

    if (canvas) {
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        canvas.width  = rect.width  || 340;
        canvas.height = rect.height || 200;
        config.l = canvas.width;
        config.h = canvas.height;
        config.t_base = config.l / 4.25;
        config.delta_pt_base = 1.9 * config.t_base;
    }

    if (curtainButton) {
        curtainButton.addEventListener('click', handleCurtainClick);
    }
    console.log('[Curtains] Inizializzato.');
}

// =============================================================================
// UPDATE — chiamato dal coordinator
// =============================================================================
export function updateCurtainsUI(data) {
    console.log('[Curtains] updateCurtainsUI data:', JSON.stringify(data));
    if (!data || !data.curtains) return;

    const curtains = data.curtains;
    const buttons_gui = data.buttons_gui || [];

    // Aggiorna pulsante dalla GUI del server
    const enableGui = buttons_gui.find(b => b.key === 'KEY_CURTAINS');
    if (enableGui && curtainButton) {
        const labelData = STATUS_LABELS_MAP[enableGui.label] || {};
        curtainButton.textContent = labelData.text || enableGui.label;
        curtainButton.disabled = enableGui.is_disabled || false;
        if (enableGui.button_color) {
            curtainButton.style.backgroundColor = enableGui.button_color.background_color || '';
            curtainButton.style.color = enableGui.button_color.text_color || '';
        }
        curtainsEnabled = enableGui.label === 'LABEL_DISABLE'; // "Disattiva" = tende attive
    }

    // Aggiorna label per ogni tenda
    curtains.forEach(curtain => {
        const angle = curtain.angle ?? 0;  // usa direttamente l'angolo dal server
        const status = curtain.status || '';

        if (curtain.orientation === 'East') {        // ← corretto
            _setText('lbl_altezza_tenda_est',  `${angle.toFixed(1)}°`);
            _setStatus('lbl_status_tenda_est', { text: status });
        } else if (curtain.orientation === 'West') { // ← corretto
            _setText('lbl_altezza_tenda_ovest',  `${angle.toFixed(1)}°`);
            _setStatus('lbl_status_tenda_ovest', { text: status });
        }
    });

    // Aggiorna grafica canvas
    if (ctx) {
        const eastCurtain = curtains.find(c => c.orientation === 'East');
        const westCurtain = curtains.find(c => c.orientation === 'West');
        const alphaEast = eastCurtain ? eastCurtain.angle : config.alpha_min_conf;
        const alphaWest = westCurtain ? westCurtain.angle : config.alpha_min_conf;
        _drawCurtains(alphaEast, alphaWest);
    }


}

export function updateRoofBackground(roofStatus) {
    const bg = document.getElementById('roof-background');
    if (!bg) return;
    bg.src = roofStatus === 'ROOF_OPENED'
        ? '/static/images/background_curtains_open.png'
        : '/static/images/background_curtains_close.png';
}
// =============================================================================
// CLICK HANDLER
// =============================================================================
async function handleCurtainClick() {
    console.log('[Curtains] Click ricevuto, curtainsEnabled:', curtainsEnabled);
    if (!curtainButton || curtainButton.disabled) return;

    curtainButton.disabled = true;
    curtainButton.textContent = 'Invio...';

    const fn = curtainsEnabled ? curtainsApi.enable : curtainsApi.disable;
    const response = await fn();
    if (response && response.curtains) {
        updateCurtainsUI(response);
    } else {
        curtainButton.disabled = false;
    }
}

// =============================================================================
// DISEGNO CANVAS (logica invariata, solo refactored)
// =============================================================================
function _stepsToAngle(steps) {
    // Conversione steps → gradi (basata su n_step_corsa=205, max_est=70)
    const n_step_corsa = 205;
    const max_alt = 70;
    const park_alt = 0;
    const angle = park_alt + (steps / n_step_corsa) * (max_alt - park_alt) + config.alpha_min_conf;
    return Math.max(config.alpha_min_conf, Math.min(90, angle));
}

function _drawCurtains(alphaEast, alphaWest) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const leftPoints  = _createPolygon(alphaWest, 'W');
    const rightPoints = _createPolygon(alphaEast, 'E');
    _drawPolygon(leftPoints,  '#151617ff');
    _drawPolygon(rightPoints, '#151617ff');
}

function _createPolygon(alpha, orientation) {
    const { conv, alpha_min_conf, tenda_raggio: t, delta_pt_base: delta_pt, h, l, ROOF_ANGLE: roofAngle } = config;
    const i = orientation === 'W' ? 1 : -1;
    const startAngleOffset = orientation === 'E' ? 180 : 0;
    const baseAngleSign    = orientation === 'E' ? 1 : -1;
    const y = Math.round((h / 3) * 1.8);
    const x = Math.round((l / 2) + (i * delta_pt / 2));
    const pt = [x, y];

    if (Math.abs(alpha - alpha_min_conf) < 0.1) {
        const totalDeg = startAngleOffset + (baseAngleSign * roofAngle);
        const rad = totalDeg * conv;
        return [pt, [x + Math.round(Math.cos(rad) * t), y - Math.round(Math.sin(rad) * t)]];
    }

    const relOpen = alpha - alpha_min_conf;
    const angles  = [roofAngle, roofAngle - relOpen * 0.25, roofAngle - relOpen * 0.5, roofAngle - relOpen * 0.75, roofAngle - relOpen];
    const points  = [pt];
    for (const deg of angles) {
        const rad = (startAngleOffset + baseAngleSign * deg) * conv;
        points.push([x + Math.round(Math.cos(rad) * t), y - Math.round(Math.sin(rad) * t)]);
    }
    return points;
}

function _drawPolygon(points, color) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function _updateRoofBackground(isOpen) {
    const bg = document.getElementById('roof-background');
    if (bg) bg.src = isOpen
        ? '/static/images/background_curtains_open.png'
        : '/static/images/background_curtains_close.png';
}

function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function _setStatus(id, statusData) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = statusData.text || '';
    el.style.color = statusData.text_color || '';
    el.style.backgroundColor = statusData.background_color || '';
}
