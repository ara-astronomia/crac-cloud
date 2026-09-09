// =============================================================================
// coordinator.js - The only file the page loads (besides D3): it wires the
// modules together and owns the polling timings.
// =============================================================================

import { initRoofControl, updateRoofUI }             from './roof_control.js';
import { initCurtains, updateCurtainsUI, updateRoofBackground } from './curtains.js';
import { initTelescopeControl, updateTelescopeUI }    from './telescope_control.js';
import { initButtons, updateButtonsUI, initCoverMirror, updateCoverMirrorUI  } from './buttons.js';
import { initUps, updateUpsUI }                       from './ups.js';
import { initGauges, updateGaugesUI }                 from './gauges.js';
import { initMaps, refreshTrackingChart, refreshSkyMap, setSkyMapZoomable } from './maps.js';

import { roofApi, curtainsApi, telescopeApi, buttonsApi, upsApi, weatherApi, mapsApi, coverMirrorApi, isError } from './api.js';
import { AlertRegistry, telescopeSpeedToReport, telescopeStatusToReport } from './alerts.js';
import { ConnectionHealth } from './connection.js';
import { renderAlerts } from './status_panel.js';

console.log('[CRaC] coordinator.js loaded');

/**
 * Polling intervals in ms, paced on how often crac-server itself refreshes:
 * telescope 0.15s server side, UPS 60s, weather 660s. Maps are expensive (they
 * download DSS plates), so the sky map is refreshed only on a new pointing.
 */
const INTERVALS = {
    telescope:      1000,
    roof:           3000,
    curtains:       3000,
    buttons:        3000,
    ups:           30000,
    weather:       60000,
    trackingChart: 30000,
    airmass:        5000,
    cover_mirror:   3000,
};

const STATUSES_SERVED_AS_PLACEHOLDER_IMAGE = [
    'DISCONNECTED', 'ERROR', 'CRITICAL_ERROR', 'LOST', 'PARKED', 'FLATTER',
];

const state = {
    lastEqCoords: null,
    lastTelStatus: null,
    telescopePowerStatus: undefined,
    skyMapNeedsRefresh: false,
    isInitialized: false,
};

const alerts = new AlertRegistry();
const connection = new ConnectionHealth();

const ALL_SWITCHES_OFF = ['KEY_TELE_SWITCH', 'KEY_CCD_SWITCH', 'KEY_FLAT_LIGHT', 'KEY_DOME_LIGHT'].map(key => ({
    key,
    status: 'OFF',
    button_gui: {
        label: 'LABEL_OFF',
        is_disabled: false,
        button_color: { text_color: 'white', background_color: 'red' },
    },
}));

const COMPONENT = {
    link: 'Collegamento a crac-server',
    telescope: 'Telescopio',
    telescopeSpeed: 'Velocita\' telescopio',
    roof: 'Tetto',
    coverMirror: 'Copertura specchio',
    curtain: { CURTAIN_EAST: 'Tenda est', CURTAIN_WEST: 'Tenda ovest' },
};

function recordAlert(component, status) {
    alerts.record(component, status, Date.now());
    renderAlerts(alerts);
}

/**
 * Records how a read went and answers whether its data can be used. While the
 * link is down the panels keep their last values: the page is dimmed so those
 * numbers are seen for what they are, no longer updated.
 */
function received(endpoint, data) {
    const ok = !isError(data);
    connection.note(endpoint, ok);
    const down = connection.isDown();
    recordAlert(COMPONENT.link, down ? 'SERVER_ERROR' : null);
    document.body.classList.toggle('data-stale', down);
    return ok;
}

async function pollTelescope() {
    const data = await telescopeApi.getStatus();
    if (received('telescope', data)) {
        updateTelescopeUI(data);
        const telescopeStatus = telescopeStatusToReport(data.status, state.telescopePowerStatus);
        recordAlert(COMPONENT.telescope, telescopeStatus);
        recordAlert(
            COMPONENT.telescopeSpeed,
            telescopeStatus === null ? null : telescopeSpeedToReport(data.status, data.speed),
        );
        const eq = data.eq_coords;
        setSkyMapZoomable(
            !!eq && eq.ra !== undefined && eq.dec !== undefined &&
            !STATUSES_SERVED_AS_PLACEHOLDER_IMAGE.includes(data.status)
        );
        if (eq && eq.ra !== undefined && eq.dec !== undefined) {
            if (_eqCoordsChanged(eq)) {
                state.skyMapNeedsRefresh = true;
            }
        }
        if (_telescopeStatusChanged(data.status)) {
            state.skyMapNeedsRefresh = true;
        }
    }
}

async function pollRoof() {
    const data = await roofApi.getStatus();
    if (received('roof', data)) {
        updateRoofUI(data);
        updateRoofBackground(data.status);
        recordAlert(COMPONENT.roof, data.status);
    }
}

async function pollCurtains() {
    const data = await curtainsApi.getStatus();
    if (received('curtains', data)) {
        updateCurtainsUI(data);
        (data.curtains || []).forEach(curtain => {
            const component = COMPONENT.curtain[curtain.orientation];
            if (component) recordAlert(component, curtain.status);
        });
    }
}

async function pollButtons() {
    const data = await buttonsApi.getStatus();
    console.log('[Coordinator] Buttons API response:', data);
    if (data && data.buttons) {
        console.log('[Coordinator] Buttons data received:', data.buttons.length, 'items');
        updateButtonsUI(data.buttons);
        const telescopePower = data.buttons.find(button => button.key === 'KEY_TELE_SWITCH');
        if (telescopePower) state.telescopePowerStatus = telescopePower.status;
    } else {
        console.warn('[Coordinator] No buttons data from API, using fallback');
        updateButtonsUI(ALL_SWITCHES_OFF);
    }
}

async function pollCoverMirror() {
    const data = await coverMirrorApi.getStatus();
    if (received('cover_mirror', data)) {
        updateCoverMirrorUI(data);
        recordAlert(COMPONENT.coverMirror, data.status);
    }
}

async function pollUps() {
    const data = await upsApi.getStatus();
    if (received('ups', data)) {
        updateUpsUI(data);
    }
}

async function pollWeather() {
    const data = await weatherApi.getStatus();
    if (received('charts', data) && data.charts) {
        updateGaugesUI(data);
    }
}

async function pollTrackingChart() {
    refreshTrackingChart();
}

/**
 * With the telescope not connected the endpoint answers with an error instead
 * of a value: that is a legitimate state, not a broken link.
 */
async function pollAirmass() {
    const data = await mapsApi.getAirmass();
    const el = document.getElementById('airmass');
    if (!el || !data) return;
    if (data.error) el.textContent = 'N/D';
    else if (data.airmass !== undefined) el.textContent = data.airmass;
}

async function checkSkyMapRefresh() {
    if (state.skyMapNeedsRefresh) {
        state.skyMapNeedsRefresh = false;
        refreshSkyMap();
    }
}

const EQ_THRESHOLD = 1e-4;   // ~0.36 arcseconds

/**
 * While the telescope tracks, eq_coords stays put on a fixed RA/DEC: the alt/az
 * drift that takes it out of PARKED/FLATTER is invisible to _eqCoordsChanged,
 * and the placeholder image the server serves for those states would stay on
 * screen. The status needs a trigger of its own.
 */
function _telescopeStatusChanged(status) {
    if (status === undefined || status === state.lastTelStatus) return false;
    state.lastTelStatus = status;
    return true;
}

function _eqCoordsChanged(newCoords) {
    if (!state.lastEqCoords) {
        state.lastEqCoords = { ...newCoords };
        return true;
    }
    const changed = (
        Math.abs(newCoords.ra  - state.lastEqCoords.ra)  > EQ_THRESHOLD ||
        Math.abs(newCoords.dec - state.lastEqCoords.dec) > EQ_THRESHOLD
    );
    if (changed) {
        state.lastEqCoords = { ...newCoords };
    }
    return changed;
}

function schedule(fn, intervalMs) {
    const loop = async () => {
        try {
            await fn();
        } catch (err) {
            console.error(`[Coordinator] Errore in ${fn.name}:`, err);
        } finally {
            setTimeout(loop, intervalMs);
        }
    };
    loop();
}

async function init() {
    if (state.isInitialized) return;
    state.isInitialized = true;

    console.log('[CRaC] Inizializzazione coordinator...');

    initRoofControl();
    initCurtains();
    initTelescopeControl();
    initButtons();
    initCoverMirror();
    initUps();
    await initGauges();   // async: carica gauge-config dal server
    initMaps();

    setTimeout(() => schedule(pollTelescope,    INTERVALS.telescope),    0);
    setTimeout(() => schedule(pollRoof,         INTERVALS.roof),         500);
    setTimeout(() => schedule(pollCurtains,     INTERVALS.curtains),     1000);
    setTimeout(() => schedule(pollButtons,      INTERVALS.buttons),      1500);
    setTimeout(() => schedule(pollCoverMirror,  INTERVALS.cover_mirror), 2000);
    setTimeout(() => schedule(pollUps,          INTERVALS.ups),          2500);
    setTimeout(() => schedule(pollWeather,      INTERVALS.weather),      3000);
    setTimeout(() => schedule(pollTrackingChart,INTERVALS.trackingChart),3500);
    setTimeout(() => schedule(pollAirmass,      INTERVALS.airmass),      4000);

    setInterval(checkSkyMapRefresh, 1000);

    console.log('[CRaC] Coordinator avviato. Intervalli:', INTERVALS);
}

document.addEventListener('DOMContentLoaded', init);
