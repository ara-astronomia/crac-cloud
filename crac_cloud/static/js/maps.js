// crac_cloud/static/js/map.js

// Intervallo di aggiornamento: 30 minuti (1,800,000 millisecondi)
const MAP_REFRESH_INTERVAL_MS = 1800000; 

/**
 * Aggiorna gli elementi img delle mappe aggiungendo un timestamp
 * per bypassare la cache del browser e forzare la rigenerazione.
 */
function refreshMaps() {
    console.log(`[MAPS] Forcing refresh of generated maps every ${MAP_REFRESH_INTERVAL_MS / 60000} minutes.`);
    const timestamp = new Date().getTime();
    
    // Mappa 1: Campo Visivo Fisso
    const fixedMap = document.getElementById('fixed_sky_map');
    if (fixedMap) {
        fixedMap.src = `/maps/sky_map_fixed?t=${timestamp}`;
    }
    
    // Mappa 2: Grafico di Tracciato Alt-Az
    const trackingChart = document.getElementById('tracking_chart');
    if (trackingChart) {
        trackingChart.src = `/maps/tracking_chart?t=${timestamp}`;
    }
}

/**
 * Inizializza il ciclo di ricaricamento delle mappe.
 * Si assicura che il DOM sia caricato prima di eseguire.
 */
function initMapRefresh() {
    // Esegue la prima ricarica immediatamente
    refreshMaps(); 
    
    // Imposta l'aggiornamento a intervalli regolari
    setInterval(refreshMaps, MAP_REFRESH_INTERVAL_MS);
}

// Avvia l'inizializzazione quando la pagina è completamente caricata
window.addEventListener('load', initMapRefresh);