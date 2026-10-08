/** connection.js - Which of the two links is down. No DOM here. */

/** One lost packet is not a fault: a component or the health probe fails
 *  after this many failed reads in a row. */
const DEFAULT_TOLERANCE = 2;

/** crac-server has no probe of its own: one failing component is that
 *  component, two at once are the link. */
const COMPONENTS_FOR_A_SERVER_LINK_DOWN = 2;

/** Every component comes through crac-server, so any good read proves the link.
 *  4s is the 3s round of the fast components plus a slow answer. */
const SERVER_SILENCE_MS = 4000;

export const CLOUD = 'cloud';
export const SERVER = 'server';

export class ConnectionHealth {

    constructor({ tolerance = DEFAULT_TOLERANCE } = {}) {
        this._tolerance = tolerance;
        this._failures = new Map();
        this._lastOkAt = null;
        this._healthFailures = 0;
        this._lastOutcome = null;
        this._browserOffline = false;
    }

    /** A read that worked clears only its own component. */
    note(endpoint, outcome, now = Date.now()) {
        this._lastOutcome = outcome;
        if (outcome === 'ok') {
            this._healthFailures = 0;
            this._lastOkAt = now;
            this._failures.delete(endpoint);
            return;
        }
        const previous = this._failures.get(endpoint);
        this._failures.set(endpoint, (previous || 0) + 1);
    }

    isFailing(endpoint) {
        return (this._failures.get(endpoint) || 0) >= this._tolerance;
    }

    noteHealth(outcome) {
        this._healthFailures = outcome === 'ok' ? 0 : this._healthFailures + 1;
    }

    setBrowserOffline(isOffline) {
        this._browserOffline = isOffline;
    }

    /** crac-cloud is blamed only by the browser and by the health probe, which a
     *  read just answered by crac-cloud overrides: the probe may be starved. */
    culprit(now = Date.now()) {
        if (this._browserOffline) return CLOUD;
        const cloudJustAnswered = this._lastOutcome === 'ok' || this._lastOutcome === 'error';
        if (this._healthFailures >= this._tolerance && !cloudJustAnswered) return CLOUD;
        const serverJustAnswered = this._lastOkAt !== null && now - this._lastOkAt <= SERVER_SILENCE_MS;
        const failing = [...this._failures.keys()].filter(endpoint => this.isFailing(endpoint));
        return failing.length >= COMPONENTS_FOR_A_SERVER_LINK_DOWN && !serverJustAnswered ? SERVER : null;
    }
}
