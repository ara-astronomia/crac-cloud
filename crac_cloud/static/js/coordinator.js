// =============================================================================
// coordinator.js - Orchestratore centrale di CRaC
// È l'UNICO file incluso nell'HTML (oltre a D3).
// Importa tutti i moduli e gestisce i timing di polling.
// =============================================================================

import { initRoofControl, updateRoofUI }             from './roof_control.js';
import { initCurtains, updateCurtainsUI }             from './curtains.js';
import { initTelescopeControl, updateTelescopeUI }    from './telescope_control.js';
import { initButtons, updateButtonsUI }               from './buttons.js';
import { initUps, updateUpsUI }                       from './ups.js';
import { initGauges, updateGaugesUI }                 from './gauges.js';
import { initMaps, refreshTrackingChart, refreshSkyMap } from './maps.js';

import { roofApi, curtainsApi, telescopeApi, buttonsApi, upsApi, weatherApi, mapsApi } from './api.js';

// =============================================================================
// INTERVALLI DI POLLING (ms)
// Basati sull'analisi del server:
//   - telescopio: polling_interval=0.15s server-side → 1s client è più che sufficiente
//   - meteo: time_expired=660s → 60s client
//   - UPS: time_expired=60s → 30s client
//   - tetto/tende: stato discreto → 3s
//   - bottoni: stato GPIO → 3s
//   - mappe: pesanti (DSS download) → tracking 30s, skymap solo se coords cambiano
// =============================================================================
const INTERVALS = {
    telescope:      1000,
    roof:           3000,
    curtains:       3000,
    buttons:        3000,
    ups:           30000,
    weather:       60000,
    trackingChart: 30000,
    airmass:        5000,
};

// =============================================================================
// STATO INTERNO DEL COORDINATOR
// =============================================================================
const state = {
    lastEqCoords: null,          // per rilevare cambio puntamento
    skyMapNeedsRefresh: false,   // flag settato da updateTelescopeUI
    isInitialized: false,
};

// =============================================================================
// LOOP DI POLLING — ogni funzione è autonoma e non blocca le altre
// =============================================================================

async function pollTelescope() {
    const data = await telescopeApi.getStatus();
    if (data && Object.keys(data).length > 0) {
        updateTelescopeUI(data);
        // Controlla se le coordinate sono cambiate per triggerare il refresh skymap
        const eq = data.eq_coords;
        if (eq && eq.ra !== undefined && eq.dec !== undefined) {
            if (_eqCoordsChanged(eq)) {
                state.skyMapNeedsRefresh = true;
            }
        }
    }
}

async function pollRoof() {
    const data = await roofApi.getStatus();
    if (data && Object.keys(data).length > 0) {
        updateRoofUI(data);
    }
}

async function pollCurtains() {
    const data = await curtainsApi.getStatus();
    if (data && Object.keys(data).length > 0) {
        updateCurtainsUI(data);
    }
}

async function pollButtons() {
    const data = await buttonsApi.getStatus();
    if (data && data.buttons) {
        updateButtonsUI(data.buttons);
    }
}

async function pollUps() {
    const data = await upsApi.getStatus();
    if (data && Object.keys(data).length > 0) {
        updateUpsUI(data);
    }
}

async function pollWeather() {
    const data = await weatherApi.getStatus();
    if (data && data.charts) {
        updateGaugesUI(data);
    }
}

async function pollTrackingChart() {
    refreshTrackingChart();  // aggiorna src dell'<img>, non-blocking
}

async function pollAirmass() {
    const data = await mapsApi.getAirmass();
    if (data && data.airmass !== undefined) {
        const el = document.getElementById('airmass');
        if (el) el.textContent = data.airmass;
    }
}

// Skymap: refresh solo se le coordinate sono cambiate
async function checkSkyMapRefresh() {
    if (state.skyMapNeedsRefresh) {
        state.skyMapNeedsRefresh = false;
        refreshSkyMap();
    }
}

// =============================================================================
// UTILITY — rilevamento cambio coordinate
// =============================================================================
const EQ_THRESHOLD = 1e-4; // ~0.36 arcsecondi — soglia ragionevole

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

// =============================================================================
// AVVIO SCHEDULATO — ogni poll è indipendente con il proprio setTimeout ricorsivo
// =============================================================================

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
    // Prima esecuzione immediata
    loop();
}

// =============================================================================
// INIZIALIZZAZIONE
// =============================================================================

async function init() {
    if (state.isInitialized) return;
    state.isInitialized = true;

    console.log('[CRaC] Inizializzazione coordinator...');

    // 1. Inizializza tutti i moduli (listener click, canvas, gauge, ecc.)
    initRoofControl();
    initCurtains();
    initTelescopeControl();
    initButtons();
    initUps();
    await initGauges();   // async: carica gauge-config dal server
    initMaps();

    // 2. Avvia i loop di polling con i rispettivi intervalli
    schedule(pollTelescope,    INTERVALS.telescope);
    schedule(pollRoof,         INTERVALS.roof);
    schedule(pollCurtains,     INTERVALS.curtains);
    schedule(pollButtons,      INTERVALS.buttons);
    schedule(pollUps,          INTERVALS.ups);
    schedule(pollWeather,      INTERVALS.weather);
    schedule(pollTrackingChart,INTERVALS.trackingChart);
    schedule(pollAirmass,      INTERVALS.airmass);

    // 3. Controllo skymap ogni secondo (leggero, aggiorna solo se flag=true)
    setInterval(checkSkyMapRefresh, 1000);

    console.log('[CRaC] Coordinator avviato. Intervalli:', INTERVALS);
}

// Avvio quando il DOM è pronto
document.addEventListener('DOMContentLoaded', init);
