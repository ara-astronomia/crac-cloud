// alerts.js - What is worth reporting in "Stato di CRaC". No DOM here.
// Every component owns its alert, so a healthy one cannot silence a broken one.

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
    SERVER_ERROR: 'nessuna risposta, i valori a schermo sono fermi',
    CLOUD_ERROR: 'la pagina non riesce a parlare col servizio, i valori a schermo sono fermi',
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
        this.revision = 0;
    }

    /** A status that does not change bumps the count instead of adding an
     *  entry: a ten-minute fault would otherwise leave hundreds behind. */
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
            this.revision += 1;
        }
        if (severity !== HEALTHY) {
            this.revision += 1;
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

const TELESCOPE_OFF = 'DISCONNECTED';
const POWER_ON = 'ON';

/** An unreachable telescope is a fault only while we are powering it, and
 *  until the power status is known there is nothing to report. */
export function telescopeStatusToReport(status, powerStatus) {
    return powerStatus === POWER_ON ? status : null;
}

/** Speed says something only while the telescope runs: powered off it is
 *  SPEED_ERROR by construction, and a lost one needs no second alert. */
export function telescopeSpeedToReport(status, speed) {
    if (status === TELESCOPE_OFF || severityOf(status) !== HEALTHY) return null;
    return speed;
}

export function alertText({ component, status }) {
    return `${component}: ${TEXT_BY_STATUS[status] || UNKNOWN_STATUS_TEXT}`;
}

export function noAlertText() {
    return NO_ALERT_TEXT;
}
