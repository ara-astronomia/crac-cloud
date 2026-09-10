// =============================================================================
// connection.js - Which of the two links is down?
//
// The browser talks to crac-cloud, crac-cloud talks to crac-server, and the
// page must not blame the wrong one: an answer that arrived over HTTP, even a
// failing one, proves the browser side is fine.
//
// No DOM here. A single failed read does not count: the telescope is polled
// every second, so one lost packet would open and close an alert right away.
//
// One answer proves the link is alive, so it clears the failures counted for
// every endpoint: the slowest of them is polled once a minute, and waiting for
// it would keep claiming the server is silent minutes after it came back. The
// price is that a single broken endpoint stays unreported while the others
// answer, which is the job of per-panel freshness, not of this file.
// =============================================================================

const DEFAULT_TOLERANCE = 2;

export const CLOUD = 'cloud';
export const SERVER = 'server';

export class ConnectionHealth {

    constructor({ tolerance = DEFAULT_TOLERANCE } = {}) {
        this._tolerance = tolerance;
        this._failures = new Map();
        this._browserOffline = false;
    }

    note(endpoint, outcome) {
        if (outcome === 'ok') return this._failures.clear();
        const previous = this._failures.get(endpoint);
        this._failures.set(endpoint, { count: (previous ? previous.count : 0) + 1, outcome });
    }

    setBrowserOffline(isOffline) {
        this._browserOffline = isOffline;
    }

    culprit() {
        if (this._browserOffline) return CLOUD;
        const lasting = [...this._failures.values()].filter(failure => failure.count >= this._tolerance);
        if (lasting.length === 0) return null;
        return lasting.some(failure => failure.outcome !== 'unreachable') ? SERVER : CLOUD;
    }
}
