// crac_cloud/static/js/map.js

const MAP_REFRESH_INTERVAL_MS = 30000; // 30 secondi

/**
 * Aggiorna un singolo elemento immagine solo se l'endpoint restituisce un'immagine valida.
 */
async function refreshMap(mapId, url, fallbackUrl) {
    try {
        const response = await fetch(`${url}?t=${new Date().getTime()}`);

        // Controllo MIME TYPE prima ancora del blob()
        const contentType = response.headers.get("content-type") || "";

        if (!response.ok || !contentType.includes("image")) {
            throw new Error(`Contenuto non immagine: ${contentType}`);
        }

        const blob = await response.blob();
        const imgElem = document.getElementById(mapId);
        if (imgElem) {
            imgElem.src = URL.createObjectURL(blob);
        }
    } catch (err) {
        console.warn(`[MAPS] Impossibile aggiornare ${mapId}:`, err);

        if (fallbackUrl) {
            document.getElementById(mapId).src = fallbackUrl;
        }
    }
}


/**
 * Aggiorna entrambe le mappe.
 */
function refreshMaps() {
    refreshMap(
        'tracking_chart',
        '/maps/tracking_chart',
        '/static/maps/tracking_error.png'  // fallback diverso
    );
    refreshMap(
        'fixed_sky_map',
        '/maps/sky_map_fixed',
        '/static/maps/backup_map.png'    // fallback SOLO per la mappa fissa
    );

    
    refreshAirmass();
}
/**
 * Recupera l'airmass dall'endpoint backend e aggiorna la label HTML.
 */
async function refreshAirmass() {
    try {
        const response = await fetch("/maps/airmass?t=" + Date.now());
        if (!response.ok) throw new Error("Errore fetch air mass");
        const data = await response.json();
        const airmassLabel = document.getElementById("airmass");
        if (airmassLabel) {
            airmassLabel.innerText = data.airmass ?? "No data";
        }
    } catch (err) {
        console.error("Errore aggiornamento airmass:", err);
    }
}

/**
 * Inizializza il ciclo di aggiornamento delle mappe.
 */
function initMapRefresh() {
    refreshMaps(); // Prima ricarica immediata
    setInterval(refreshMaps, MAP_REFRESH_INTERVAL_MS);
}

window.addEventListener('load', initMapRefresh);
