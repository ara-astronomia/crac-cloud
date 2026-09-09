// =============================================================================
// connection.js - Salute del collegamento con crac-server
//
// Nessun accesso al DOM: qui si decide soltanto se le risposte stanno ancora
// arrivando. Un fallimento isolato non conta: con il telescopio interrogato
// ogni secondo aprirebbe e chiuderebbe avvisi a ogni singolo pacchetto perso.
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
