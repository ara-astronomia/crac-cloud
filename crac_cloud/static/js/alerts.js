// =============================================================================
// alerts.js - Registro degli avvisi mostrati in "Stato di CRaC"
//
// Nessun accesso al DOM: qui si decide *cosa* segnalare, il disegno sta
// altrove. Ogni componente ha al massimo un avviso aperto, come nel vecchio
// crac-client, ma senza il suo difetto: lì lo slot era unico e il pannello
// che stava bene cancellava l'avviso di quello guasto.
// =============================================================================

export const SEVERITY = {
    ERROR: 'error',
    DANGER: 'danger',
};

const HEALTHY = null;

const NO_ALERT_TEXT = 'Nessun errore riscontrato';

const TEXT_BY_STATUS = {
    LOST: 'connessione persa',
    ERROR: 'errore',
    SPEED_ERROR: 'velocita\' non leggibile',
    ROOF_ERROR: 'errore',
    CURTAIN_ERROR: 'errore',
    COVER_MIRROR_ERROR: 'errore',
    ROOF_DANGER: 'attenzione, posizione di pericolo',
    CURTAIN_DANGER: 'attenzione, posizione di pericolo',
};

const UNKNOWN_STATUS_TEXT = 'stato anomalo';

const DEFAULT_HISTORY_LIMIT = 50;

function severityOf(status) {
    if (!status) return HEALTHY;
    if (status === 'ERROR' || status === 'LOST' || status.endsWith('_ERROR')) return SEVERITY.ERROR;
    if (status.endsWith('_DANGER')) return SEVERITY.DANGER;
    return HEALTHY;
}

export class AlertRegistry {

    constructor({ historyLimit = DEFAULT_HISTORY_LIMIT } = {}) {
        this._historyLimit = historyLimit;
        this._entries = [];
    }

    /**
     * Registra lo stato letto per un componente. Chiamata a ogni polling:
     * uno stato che non cambia aggiorna il conteggio invece di aggiungere
     * una voce, altrimenti un guasto di dieci minuti ne produrrebbe centinaia.
     */
    record(component, status, at) {
        const open = this._openEntryFor(component);
        const severity = severityOf(status);

        if (open && open.status === status) {
            open.count += 1;
            open.lastSeenAt = at;
            return;
        }
        if (open) {
            open.resolvedAt = at;
        }
        if (severity !== HEALTHY) {
            this._entries.push({
                component, status, severity,
                firstSeenAt: at, lastSeenAt: at,
                count: 1, resolvedAt: null,
            });
        }
        this._forgetOldestResolved();
    }

    current() {
        return this._entries.filter(entry => entry.resolvedAt === null);
    }

    history() {
        return [...this._entries].reverse();
    }

    _openEntryFor(component) {
        return this._entries.find(entry => entry.component === component && entry.resolvedAt === null);
    }

    _forgetOldestResolved() {
        while (this._entries.length > this._historyLimit) {
            const oldest = this._entries.findIndex(entry => entry.resolvedAt !== null);
            if (oldest === -1) return;
            this._entries.splice(oldest, 1);
        }
    }
}

export function alertText({ component, status }) {
    return `${component}: ${TEXT_BY_STATUS[status] || UNKNOWN_STATUS_TEXT}`;
}

export function noAlertText() {
    return NO_ALERT_TEXT;
}
