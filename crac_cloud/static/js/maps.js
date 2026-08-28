// =============================================================================
// maps.js - Modulo puro per il refresh delle mappe astronomiche
// =============================================================================

import { mapsApi } from './api.js';

let trackingImg = null;
let skyMapImg   = null;
let modalOverlay = null;
let modalImg     = null;

export function initMaps() {
    trackingImg = document.getElementById('tracking_chart');
    skyMapImg   = document.getElementById('fixed_sky_map');

    if (skyMapImg) {
        skyMapImg.style.cursor = 'zoom-in';
        skyMapImg.title = 'Clic per ingrandire';
        skyMapImg.addEventListener('click', openSkyMapModal);
    }

    console.log('[Maps] Inizializzato.');
}

/**
 * Modale fullscreen con l'immagine del campo inquadrato a piena
 * risoluzione, creata al volo la prima volta che serve (nessun markup
 * aggiuntivo da mantenere in index.html).
 */
function openSkyMapModal() {
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.className = 'sky-map-modal-overlay';
        modalImg = document.createElement('img');
        modalImg.className = 'sky-map-modal-img';
        modalOverlay.appendChild(modalImg);
        modalOverlay.addEventListener('click', closeSkyMapModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSkyMapModal();
        });
        document.body.appendChild(modalOverlay);
    }
    modalImg.src = skyMapImg.src;
    modalOverlay.classList.add('open');
}

function closeSkyMapModal() {
    if (modalOverlay) modalOverlay.classList.remove('open');
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
