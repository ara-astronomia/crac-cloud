// api.js - The one place where crac-cloud is called. No fetch() anywhere else.

const DEFAULT_TIMEOUT_MS = 10000;

// A hanging read holds one of the six sockets the browser grants per origin,
// and the health probe queues behind it.
const STATUS_TIMEOUT_MS = 3000;

/** Never throws: a request that does not come back resolves to { error }, the
 *  shape crac-cloud already answers with when crac-server is unreachable. */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
        return await response.json();
    } catch (err) {
        if (err.name === 'AbortError') return { error: `nessuna risposta entro ${timeoutMs}ms`, timedOut: true };
        console.warn(`[API] Errore fetch ${url}:`, err.message);
        return err instanceof TypeError
            ? { error: err.message, unreachable: true }
            : { error: err.message };
    } finally {
        clearTimeout(timer);
    }
}

/** crac-cloud answers 200 even when its gRPC call to crac-server fails, and
 *  puts the reason in `error`. */
export function isError(payload) {
    return !payload || typeof payload !== 'object' || 'error' in payload || Object.keys(payload).length === 0;
}

/** Only 'error' proves crac-cloud answered. A timeout proves nothing: with
 *  crac-server down /roof/status takes 14.7s while crac-cloud is fine. */
export function outcomeOf(payload) {
    if (payload && payload.unreachable) return 'unreachable';
    if (payload && payload.timedOut) return 'timeout';
    return isError(payload) ? 'error' : 'ok';
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
    getStatus: ()                         => apiGet('/telescope/status', STATUS_TIMEOUT_MS),
    connect:   ()                         => apiPost('/telescope/set_action', { action: 'TELESCOPE_CONNECT' }),
    disconnect:()                         => apiPost('/telescope/set_action', { action: 'TELESCOPE_DISCONNECT' }),
    park:      (autolight = false)        => apiPost('/telescope/set_action', { action: 'PARK_POSITION', autolight }),
    flat:      (autolight = false)        => apiPost('/telescope/set_action', { action: 'FLAT_POSITION', autolight }),
    check:     (autolight = false)        => apiPost('/telescope/set_action', { action: 'CHECK_TELESCOPE', autolight }),
};

export const roofApi = {
    getStatus: () => apiGet('/roof/status', STATUS_TIMEOUT_MS),
    open:      () => apiPost('/roof/set_action', { action: 'ROOF_OPEN' }),
    close:     () => apiPost('/roof/set_action', { action: 'ROOF_CLOSE' }),
};

export const curtainsApi = {
    getStatus: () => apiGet('/curtains/status', STATUS_TIMEOUT_MS),
    enable:    () => apiPost('/curtains/control', { action: 'ENABLE' }),
    disable:   () => apiPost('/curtains/control', { action: 'DISABLE' }),
};

export const coverMirrorApi = {
    getStatus: () => apiGet('/cover_mirror/status', STATUS_TIMEOUT_MS),
    open:      () => apiPost('/cover_mirror/set_action', { action: 'OPEN_COVER_MIRROR' }),
    close:     () => apiPost('/cover_mirror/set_action', { action: 'CLOSE_COVER_MIRROR' }),
};

export const buttonsApi = {
    getStatus:   ()                          => apiGet('/buttons/status', STATUS_TIMEOUT_MS),
    toggle:      (key, action = 'TURN_ON')   => apiPost('/buttons/set_action', { key, action }),
};

export const upsApi = {
    getStatus: () => apiGet('/ups/status', STATUS_TIMEOUT_MS),
};

export const weatherApi = {
    getStatus:   () => apiGet('/charts/status', STATUS_TIMEOUT_MS),
    getGaugeConfig: () => apiGet('/charts/gauge-config'),
};

// This route never leaves crac-cloud, so however it fails the answer is the
// same: the browser is not reaching the service.
const HEALTH_TIMEOUT_MS = 2000;

export const healthApi = {
    probe: async () => (isError(await apiGet('/health', HEALTH_TIMEOUT_MS)) ? 'unreachable' : 'ok'),
};

// An <img> given the src it already has requests nothing; the JSON endpoints
// need none of this, they come with Cache-Control: no-store.
const cacheBuster = () => `t=${Date.now()}`;

export const mapsApi = {
    trackingChartUrl: () => `/maps/tracking_chart?${cacheBuster()}`,
    skyMapUrl:        () => `/maps/sky_map_fixed?${cacheBuster()}`,
    getAirmass:       () => apiGet('/maps/airmass'),
};
