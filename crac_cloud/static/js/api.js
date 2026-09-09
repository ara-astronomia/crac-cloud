// =============================================================================
// api.js - Layer centralizzato per tutte le chiamate HTTP verso il backend
// Tutti gli altri moduli importano da qui. Nessun fetch() altrove.
// =============================================================================

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Fetch con timeout automatico.
 * @returns {Promise<any>} JSON parsato, o { error } se la risposta non arriva
 * (non lancia mai). E' la stessa forma che crac-cloud usa quando e' crac-server
 * a non rispondere, cosi' un solo controllo copre entrambi i casi.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
        return await response.json();
    } catch (err) {
        if (err.name !== 'AbortError') console.warn(`[API] Errore fetch ${url}:`, err.message);
        return { error: err.name === 'AbortError' ? `nessuna risposta entro ${timeoutMs}ms` : err.message };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Vero quando la risposta non porta dati utilizzabili: crac-cloud risponde 200
 * anche quando il gRPC verso crac-server fallisce, e mette il motivo in `error`.
 */
export function isError(payload) {
    return !payload || typeof payload !== 'object' || 'error' in payload || Object.keys(payload).length === 0;
}

/**
 * GET generico — restituisce sempre un oggetto (mai undefined/null).
 */
export async function apiGet(endpoint, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return fetchWithTimeout(endpoint, {}, timeoutMs);
}

/**
 * POST generico — restituisce sempre un oggetto (mai undefined/null).
 */
export async function apiPost(endpoint, data = {}) {
    return fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// =============================================================================
// API specifiche per dominio — nomi espliciti, nessun magic string altrove
// =============================================================================

// --- Telescopio ---
export const telescopeApi = {
    getStatus: ()                         => apiGet('/telescope/status'),
    connect:   ()                         => apiPost('/telescope/set_action', { action: 'TELESCOPE_CONNECT' }),
    disconnect:()                         => apiPost('/telescope/set_action', { action: 'TELESCOPE_DISCONNECT' }),
    park:      (autolight = false)        => apiPost('/telescope/set_action', { action: 'PARK_POSITION', autolight }),
    flat:      (autolight = false)        => apiPost('/telescope/set_action', { action: 'FLAT_POSITION', autolight }),
    check:     (autolight = false)        => apiPost('/telescope/set_action', { action: 'CHECK_TELESCOPE', autolight }),
};

// --- Tetto ---
export const roofApi = {
    getStatus: () => apiGet('/roof/status'),
    open:      () => apiPost('/roof/set_action', { action: 'ROOF_OPEN' }),
    close:     () => apiPost('/roof/set_action', { action: 'ROOF_CLOSE' }),
};

// --- Tende ---
export const curtainsApi = {
    getStatus: () => apiGet('/curtains/status'),
    enable:    () => apiPost('/curtains/control', { action: 'ENABLE' }),
    disable:   () => apiPost('/curtains/control', { action: 'DISABLE' }),
};

// --- Cover Mirror ---
export const coverMirrorApi = {
    getStatus: () => apiGet('/cover_mirror/status'),
    open:      () => apiPost('/cover_mirror/set_action', { action: 'OPEN_COVER_MIRROR' }),
    close:     () => apiPost('/cover_mirror/set_action', { action: 'CLOSE_COVER_MIRROR' }),
};

// --- Pulsanti / Switch ---
export const buttonsApi = {
    getStatus:   ()                          => apiGet('/buttons/status', 15000),
    toggle:      (key, action = 'TURN_ON')   => apiPost('/buttons/set_action', { key, action }),
};

// --- UPS ---
export const upsApi = {
    getStatus: () => apiGet('/ups/status'),
};

// --- Meteo / Gauge ---
export const weatherApi = {
    getStatus:   () => apiGet('/charts/status'),
    getGaugeConfig: () => apiGet('/charts/gauge-config'),
};

// --- Mappe ---
export const mapsApi = {
    // Restituisce URL con cache-buster per forzare il reload dell'<img>
    trackingChartUrl: () => `/maps/tracking_chart?t=${Date.now()}`,
    skyMapUrl:        () => `/maps/sky_map_fixed?t=${Date.now()}`,
    getAirmass:       () => apiGet(`/maps/airmass?t=${Date.now()}`),
};
