// =============================================================================
// api.js - Layer centralizzato per tutte le chiamate HTTP verso il backend
// Tutti gli altri moduli importano da qui. Nessun fetch() altrove.
// =============================================================================

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Fetch con timeout automatico.
 * @returns {Promise<any>} JSON parsato, o {} in caso di errore (non lancia mai).
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
        return await response.json();
    } catch (err) {
        if (err.name === 'AbortError') {
            console.warn(`[API] Timeout (${timeoutMs}ms): ${url}`);
        } else {
            console.warn(`[API] Errore fetch ${url}:`, err.message);
        }
        return {};
    } finally {
        clearTimeout(timer);
    }
}

/**
 * GET generico — restituisce sempre un oggetto (mai undefined/null).
 */
export async function apiGet(endpoint) {
    return fetchWithTimeout(endpoint);
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

// --- Pulsanti / Switch ---
export const buttonsApi = {
    getStatus:   ()                          => apiGet('/buttons/status'),
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
