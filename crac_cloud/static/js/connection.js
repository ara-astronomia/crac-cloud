// =============================================================================
// connection.js - Which of the two links is down?
//
// The browser talks to crac-cloud, crac-cloud talks to crac-server, and the
// page must not blame the wrong one: an answer that arrived over HTTP, even a
// failing one, proves the browser side is fine.
//
// A read that never comes back proves nothing by itself, because crac-cloud
// waits on crac-server for seconds before giving up. That is what the health
// probe is for: it answers without leaving crac-cloud, so its silence can only
// mean the browser is cut off.
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
        this._healthFailures = 0;
        this._lastOutcome = null;
        this._browserOffline = false;
    }

    note(endpoint, outcome) {
        this._lastOutcome = outcome;
        if (outcome === 'ok') {
            this._healthFailures = 0;
            return this._failures.clear();
        }
        const previous = this._failures.get(endpoint);
        this._failures.set(endpoint, { count: (previous ? previous.count : 0) + 1, outcome });
    }

    noteHealth(outcome) {
        this._healthFailures = outcome === 'ok' ? 0 : this._healthFailures + 1;
    }

    setBrowserOffline(isOffline) {
        this._browserOffline = isOffline;
    }

    culprit() {
        if (this._browserOffline) return CLOUD;
        const cloudJustAnswered = this._lastOutcome === 'error';
        if (this._healthFailures >= this._tolerance && !cloudJustAnswered) return CLOUD;
        const lasting = [...this._failures.values()].filter(failure => failure.count >= this._tolerance);
        if (lasting.length === 0) return null;
        if (cloudJustAnswered) return SERVER;
        return lasting.some(failure => failure.outcome === 'unreachable') ? CLOUD : SERVER;
    }
}
