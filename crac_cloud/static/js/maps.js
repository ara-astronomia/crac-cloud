// =============================================================================
// maps.js - Modulo puro per il refresh delle mappe astronomiche
// =============================================================================

import { mapsApi } from './api.js';

let trackingImg = null;
let skyMapImg   = null;

export function initMaps() {
    trackingImg = document.getElementById('tracking_chart');
    skyMapImg   = document.getElementById('fixed_sky_map');
    console.log('[Maps] Inizializzato.');
}

/**
 * Aggiorna il grafico di tracking (chiamato dal coordinator ogni 30s).
 * Usa un cache-buster nell'URL per forzare il reload dell'<img>.
 */
export function refreshTrackingChart() {
    if (!trackingImg) return;
    const newUrl = mapsApi.trackingChartUrl();
    // Cambia src solo se l'URL è diverso (evita reload inutili)
    if (!trackingImg.src.startsWith(window.location.origin + '/maps/tracking_chart')) {
        trackingImg.src = newUrl;
    } else {
        trackingImg.src = newUrl; // il cache-buster assicura il reload
    }
}

/**
 * Aggiorna la sky map — chiamato dal coordinator solo se le coordinate sono cambiate.
 */
export function refreshSkyMap() {
    if (!skyMapImg) return;
    skyMapImg.src = mapsApi.skyMapUrl();
}
