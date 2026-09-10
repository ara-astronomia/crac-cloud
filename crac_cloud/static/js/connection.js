// connection.js - Which of the two links is down. No DOM here.

// The telescope is polled every second: one lost packet must not open an alert.
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
