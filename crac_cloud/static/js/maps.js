// maps.js - Refresh of the astronomical maps.

import { mapsApi } from './api.js';

let trackingImg = null;
let skyMapImg   = null;
let modalOverlay = null;
let modalImg     = null;
let zoomable     = false;   // finché il primo poll non dice il contrario

export function initMaps() {
    trackingImg = document.getElementById('tracking_chart');
    skyMapImg   = document.getElementById('fixed_sky_map');

    if (skyMapImg) {
        skyMapImg.addEventListener('click', openSkyMapModal);
        setSkyMapZoomable(zoomable);
    }

    console.log('[Maps] Inizializzato.');
}

/** Built on first use, so index.html carries no markup for it. */
function openSkyMapModal() {
    if (!zoomable) return;
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

/** Enlarging the placeholder PNG the server sends instead of the map - not
 *  connected, parked, flat - makes no sense. */
export function setSkyMapZoomable(value) {
    zoomable = value;
    if (!skyMapImg) return;
    skyMapImg.style.cursor = value ? 'zoom-in' : 'default';
    skyMapImg.title = value ? 'Clic per ingrandire' : '';
}

/** The changing URL is what makes the <img> reload. */
export function refreshTrackingChart() {
    if (!trackingImg) return;
    trackingImg.src = mapsApi.trackingChartUrl();
}

/** Called only when the pointing changed. */
export function refreshSkyMap() {
    if (!skyMapImg) return;
    skyMapImg.src = mapsApi.skyMapUrl();
}
