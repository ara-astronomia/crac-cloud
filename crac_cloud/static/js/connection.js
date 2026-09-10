// =============================================================================
// connection.js - Is crac-server still answering?
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

export class ConnectionHealth {

    constructor({ tolerance = DEFAULT_TOLERANCE } = {}) {
        this._tolerance = tolerance;
        this._consecutiveFailures = new Map();
    }

    note(endpoint, ok) {
        if (ok) return this._consecutiveFailures.clear();
        this._consecutiveFailures.set(endpoint, (this._consecutiveFailures.get(endpoint) || 0) + 1);
    }

    isDown() {
        return [...this._consecutiveFailures.values()].some(failures => failures >= this._tolerance);
    }
}
