// =============================================================================
// api.js - The one place where crac-cloud is called. No fetch() anywhere else.
// =============================================================================

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Never throws: a request that does not come back resolves to { error }, the
 * same shape crac-cloud already answers with when crac-server is unreachable,
 * so a single check covers both.
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
 * True when a response carries no usable data. crac-cloud answers 200 even when
 * its gRPC call to crac-server fails, and puts the reason in `error`.
 */
export function isError(payload) {
    return !payload || typeof payload !== 'object' || 'error' in payload || Object.keys(payload).length === 0;
}

export async function apiGet(endpoint, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return fetchWithTimeout(endpoint, {}, timeoutMs);
}

export async function apiPost(endpoint, data = {}) {
    return fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export const telescopeApi = {
    getStatus: ()                         => apiGet('/telescope/status'),
    connect:   ()                         => apiPost('/telescope/set_action', { action: 'TELESCOPE_CONNECT' }),
    disconnect:()                         => apiPost('/telescope/set_action', { action: 'TELESCOPE_DISCONNECT' }),
    park:      (autolight = false)        => apiPost('/telescope/set_action', { action: 'PARK_POSITION', autolight }),
    flat:      (autolight = false)        => apiPost('/telescope/set_action', { action: 'FLAT_POSITION', autolight }),
    check:     (autolight = false)        => apiPost('/telescope/set_action', { action: 'CHECK_TELESCOPE', autolight }),
};

export const roofApi = {
    getStatus: () => apiGet('/roof/status'),
    open:      () => apiPost('/roof/set_action', { action: 'ROOF_OPEN' }),
    close:     () => apiPost('/roof/set_action', { action: 'ROOF_CLOSE' }),
};

export const curtainsApi = {
    getStatus: () => apiGet('/curtains/status'),
    enable:    () => apiPost('/curtains/control', { action: 'ENABLE' }),
    disable:   () => apiPost('/curtains/control', { action: 'DISABLE' }),
};

export const coverMirrorApi = {
    getStatus: () => apiGet('/cover_mirror/status'),
    open:      () => apiPost('/cover_mirror/set_action', { action: 'OPEN_COVER_MIRROR' }),
    close:     () => apiPost('/cover_mirror/set_action', { action: 'CLOSE_COVER_MIRROR' }),
};

export const buttonsApi = {
    getStatus:   ()                          => apiGet('/buttons/status', 15000),
    toggle:      (key, action = 'TURN_ON')   => apiPost('/buttons/set_action', { key, action }),
};

export const upsApi = {
    getStatus: () => apiGet('/ups/status'),
};

export const weatherApi = {
    getStatus:   () => apiGet('/charts/status'),
    getGaugeConfig: () => apiGet('/charts/gauge-config'),
};

/**
 * Assigning an <img> the same src it already has requests nothing, so the two
 * map images need a URL that changes. The JSON endpoints do not: crac-cloud
 * answers them with Cache-Control: no-store.
 */
const cacheBuster = () => `t=${Date.now()}`;

export const mapsApi = {
    trackingChartUrl: () => `/maps/tracking_chart?${cacheBuster()}`,
    skyMapUrl:        () => `/maps/sky_map_fixed?${cacheBuster()}`,
    getAirmass:       () => apiGet('/maps/airmass'),
};
