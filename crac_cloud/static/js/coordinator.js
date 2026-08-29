// =============================================================================
// coordinator.js - Orchestratore centrale di CRaC
// È l'UNICO file incluso nell'HTML (oltre a D3).
// Importa tutti i moduli e gestisce i timing di polling.
// =============================================================================

import { initRoofControl, updateRoofUI }             from './roof_control.js';
import { initCurtains, updateCurtainsUI, updateRoofBackground } from './curtains.js';
import { initTelescopeControl, updateTelescopeUI }    from './telescope_control.js';
import { initButtons, updateButtonsUI, initCoverMirror, updateCoverMirrorUI  } from './buttons.js';
import { initUps, updateUpsUI }                       from './ups.js';
import { initGauges, updateGaugesUI }                 from './gauges.js';
import { initMaps, refreshTrackingChart, refreshSkyMap } from './maps.js';

import { roofApi, curtainsApi, telescopeApi, buttonsApi, upsApi, weatherApi, mapsApi, coverMirrorApi } from './api.js';

console.log('[CRaC] coordinator.js loaded');

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
    cover_mirror:   3000,
};

// =============================================================================
// STATO INTERNO DEL COORDINATOR
// =============================================================================
const state = {
    lastEqCoords: null,          // per rilevare cambio puntamento
    lastTelStatus: null,         // per rilevare transizioni PARKED/FLATTER <-> altro
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
        // eq_coords resta fermo mentre il telescopio traccia (segue una RA/DEC
        // fissa): la deriva alt/az che fa uscire da PARKED/FLATTER (es. verso
        // SECURE) non viene mai rilevata dal controllo sopra, lasciando la
        // foto statica "in park"/"in flat" mostrata dal server congelata
        // sullo schermo. Serve un trigger indipendente sul cambio di status.
        if (data.status !== undefined && data.status !== state.lastTelStatus) {
            state.lastTelStatus = data.status;
            state.skyMapNeedsRefresh = true;
        }
    }
}

async function pollRoof() {
    const data = await roofApi.getStatus();
    if (data && Object.keys(data).length > 0) {
        updateRoofUI(data);
        updateRoofBackground(data.status);
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
    console.log('[Coordinator] Buttons API response:', data);
    if (data && data.buttons) {
        console.log('[Coordinator] Buttons data received:', data.buttons.length, 'items');
        updateButtonsUI(data.buttons);
    } else {
        console.warn('[Coordinator] No buttons data from API, using fallback');
        // Fallback: mostra pulsanti in stato "Spento" con colori rossi
        const fallbackButtons = [
            {
                key: 'KEY_TELE_SWITCH',
                status: 'OFF',
                button_gui: {
                    label: 'LABEL_OFF',
                    is_disabled: false,
                    button_color: { text_color: 'white', background_color: 'red' }
                }
            },
            {
                key: 'KEY_CCD_SWITCH',
                status: 'OFF',
                button_gui: {
                    label: 'LABEL_OFF',
                    is_disabled: false,
                    button_color: { text_color: 'white', background_color: 'red' }
                }
            },
            {
                key: 'KEY_FLAT_LIGHT',
                status: 'OFF',
                button_gui: {
                    label: 'LABEL_OFF',
                    is_disabled: false,
                    button_color: { text_color: 'white', background_color: 'red' }
                }
            },
            {
                key: 'KEY_DOME_LIGHT',
                status: 'OFF',
                button_gui: {
                    label: 'LABEL_OFF',
                    is_disabled: false,
                    button_color: { text_color: 'white', background_color: 'red' }
                }
            }
        ];
        updateButtonsUI(fallbackButtons);
    }
}

async function pollCoverMirror() {
    const data = await coverMirrorApi.getStatus();
    if (data && Object.keys(data).length > 0) {
        updateCoverMirrorUI(data);
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
    const el = document.getElementById('airmass');
    if (!el || !data) return;
    // telescopio non connesso: l'endpoint risponde con error, non con un valore
    if (data.error) el.textContent = 'N/D';
    else if (data.airmass !== undefined) el.textContent = data.airmass;
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
    initCoverMirror();
    initUps();
    await initGauges();   // async: carica gauge-config dal server
    initMaps();

    // 2. Avvia i loop di polling con i rispettivi intervalli
    setTimeout(() => schedule(pollTelescope,    INTERVALS.telescope),    0);
    setTimeout(() => schedule(pollRoof,         INTERVALS.roof),         500);
    setTimeout(() => schedule(pollCurtains,     INTERVALS.curtains),     1000);
    setTimeout(() => schedule(pollButtons,      INTERVALS.buttons),      1500);
    setTimeout(() => schedule(pollCoverMirror,  INTERVALS.cover_mirror), 2000);
    setTimeout(() => schedule(pollUps,          INTERVALS.ups),          2500);
    setTimeout(() => schedule(pollWeather,      INTERVALS.weather),      3000);
    setTimeout(() => schedule(pollTrackingChart,INTERVALS.trackingChart),3500);
    setTimeout(() => schedule(pollAirmass,      INTERVALS.airmass),      4000);

    // 3. Controllo skymap ogni secondo (leggero, aggiorna solo se flag=true)
    setInterval(checkSkyMapRefresh, 1000);

    console.log('[CRaC] Coordinator avviato. Intervalli:', INTERVALS);
}

// Avvio quando il DOM è pronto
document.addEventListener('DOMContentLoaded', init);
