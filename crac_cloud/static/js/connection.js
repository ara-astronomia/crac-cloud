// =============================================================================
// connection.js - Is crac-server still answering?
//
// No DOM here. A single failed read does not count: the telescope is polled
// every second, so one lost packet would open and close an alert right away.
// =============================================================================

const DEFAULT_TOLERANCE = 2;

export class ConnectionHealth {

    constructor({ tolerance = DEFAULT_TOLERANCE } = {}) {
        this._tolerance = tolerance;
        this._consecutiveFailures = new Map();
    }

    note(endpoint, ok) {
        const failures = ok ? 0 : (this._consecutiveFailures.get(endpoint) || 0) + 1;
        this._consecutiveFailures.set(endpoint, failures);
    }

    isDown() {
        return [...this._consecutiveFailures.values()].some(failures => failures >= this._tolerance);
    }
}
