/** alerts.js - What is worth reporting in "Stato di CRaC". No DOM here.
 *  Every component owns its alert, so a healthy one cannot silence a broken one. */

export const SEVERITY = {
    ERROR: 'error',
    DANGER: 'danger',
    INFO: 'info',
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
    READ_ERROR: 'nessuna risposta, i valori del pannello sono fermi',
    SERVER_ERROR: 'nessuna risposta, i valori a schermo sono fermi',
    CLOUD_ERROR: 'la pagina non riesce a parlare col servizio, i valori a schermo sono fermi',
    ROOF_DANGER: 'attenzione, posizione di pericolo',
    CURTAIN_DANGER: 'attenzione, posizione di pericolo',
    UPS_STATUS_DANGER: 'UPS in condizione critica',
    UPS_STATUS_UNSPECIFIED: 'UPS non leggibile o con dati mancanti',
    EMERGENCY_CLOSURE_BLOCKED: 'chiusura d\'emergenza bloccata',
    EMERGENCY_CLOSURE_COMPLETED: 'tetto chiuso per una condizione critica',
};

// Emergency closure status constants from protobuf
export const EMERGENCY_CLOSURE_STATUS = {
    UNSPECIFIED: 0,
    IDLE: 1,
    IN_PROGRESS: 2,
    COMPLETED: 3,
    BLOCKED: 4,
};

// Emergency closure block reason constants from protobuf
export const EMERGENCY_CLOSURE_BLOCK_REASON = {
    UNSPECIFIED: 0,
    TELESCOPE_UNKNOWN: 1,
    PARK_NOT_REACHED: 2,
    CURTAINS_NOT_DISABLED: 3,
    ROOF_NOT_CLOSED: 4,
    INTERNAL_ERROR: 5,
};

// Emergency closure trigger constants from protobuf
export const EMERGENCY_CLOSURE_TRIGGER = {
    UNSPECIFIED: 0,
    WEATHER: 1,
    UPS: 2,
    WEATHER_UNAVAILABLE: 3,
    UPS_UNAVAILABLE: 4,
};

// Map trigger enum to human-readable text
const TRIGGER_TEXT = {
    [EMERGENCY_CLOSURE_TRIGGER.WEATHER]: 'meteo',
    [EMERGENCY_CLOSURE_TRIGGER.UPS]: 'UPS',
    [EMERGENCY_CLOSURE_TRIGGER.WEATHER_UNAVAILABLE]: 'dati meteo non disponibili',
    [EMERGENCY_CLOSURE_TRIGGER.UPS_UNAVAILABLE]: 'dati UPS non disponibili',
};

// Map block reason enum to human-readable text
const BLOCK_REASON_TEXT = {
    [EMERGENCY_CLOSURE_BLOCK_REASON.TELESCOPE_UNKNOWN]: 'posizione del telescopio sconosciuta',
    [EMERGENCY_CLOSURE_BLOCK_REASON.PARK_NOT_REACHED]: 'park non raggiunto',
    [EMERGENCY_CLOSURE_BLOCK_REASON.CURTAINS_NOT_DISABLED]: 'tende non disattivate',
    [EMERGENCY_CLOSURE_BLOCK_REASON.ROOF_NOT_CLOSED]: 'tetto non chiuso',
    [EMERGENCY_CLOSURE_BLOCK_REASON.INTERNAL_ERROR]: 'errore interno',
};

// Map block reason to the action the operator can take
const BLOCK_REASON_ACTION_TEXT = {
    [EMERGENCY_CLOSURE_BLOCK_REASON.TELESCOPE_UNKNOWN]: 'collegare il telescopio',
    [EMERGENCY_CLOSURE_BLOCK_REASON.PARK_NOT_REACHED]: 'portare il telescopio in park a mano',
    [EMERGENCY_CLOSURE_BLOCK_REASON.CURTAINS_NOT_DISABLED]: 'abbassare le tende a mano',
};

const UNKNOWN_STATUS_TEXT = 'stato anomalo';

const DEFAULT_HISTORY_LIMIT = 50;

function severityOf(status) {
    if (!status) return HEALTHY;
    if (status === 'ERROR' || status === 'LOST' || status.endsWith('_ERROR') ||
        status === 'UPS_STATUS_UNSPECIFIED' ||
        status === 'EMERGENCY_CLOSURE_BLOCKED') return SEVERITY.ERROR;
    if (status.endsWith('_DANGER')) return SEVERITY.DANGER;
    if (status === 'EMERGENCY_CLOSURE_COMPLETED') return SEVERITY.INFO;
    return HEALTHY;
}

export class AlertRegistry {

    constructor({ historyLimit = DEFAULT_HISTORY_LIMIT } = {}) {
        this._historyLimit = historyLimit;
        this._entries = [];
        this.revision = 0;
    }

    /** A status that does not change bumps the count instead of adding an
     *  entry: a ten-minute fault would otherwise leave hundreds behind.
     *  `details` carries the long text of statuses that need one. */
    record(component, status, at, details = null) {
        const open = this._openEntryFor(component);
        const severity = severityOf(status);

        if (open && open.status === status) {
            open.count += 1;
            open.lastSeenAt = at;
            if (details) open.emergencyClosureDetails = details;
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
                emergencyClosureDetails: details,
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

export function alertText({ component, status, emergencyClosureDetails }) {
    if (emergencyClosureDetails && (status === 'EMERGENCY_CLOSURE_BLOCKED' ||
                                    status === 'EMERGENCY_CLOSURE_COMPLETED')) {
        return `${component}: ${emergencyClosureDetails}`;
    }
    return `${component}: ${TEXT_BY_STATUS[status] || UNKNOWN_STATUS_TEXT}`;
}

export function noAlertText() {
    return NO_ALERT_TEXT;
}

/** Why the closure is running, in one readable phrase. */
function triggerTextOf(emergencyClosure) {
    const activeTriggers = (emergencyClosure.triggers || [])
        .filter(trigger => trigger !== EMERGENCY_CLOSURE_TRIGGER.UNSPECIFIED && TRIGGER_TEXT[trigger])
        .map(trigger => TRIGGER_TEXT[trigger]);
    return activeTriggers.length > 0 ? activeTriggers.join(' e ') : 'una condizione critica';
}

/** Which alert status an emergency closure state maps to: blocked and
 *  completed are worth telling, the others are not. */
export function emergencyClosureStatusToReport(emergencyClosure) {
    if (!emergencyClosure) return null;
    if (emergencyClosure.status === EMERGENCY_CLOSURE_STATUS.BLOCKED) return 'EMERGENCY_CLOSURE_BLOCKED';
    if (emergencyClosure.status === EMERGENCY_CLOSURE_STATUS.COMPLETED) return 'EMERGENCY_CLOSURE_COMPLETED';
    return null;
}

/** Detail text for a blocked emergency closure: why the roof should close,
 *  why crac-server does not, and what the operator can do. Null when the
 *  closure is not blocked. */
export function emergencyClosureAlertText(emergencyClosure) {
    if (!emergencyClosure || emergencyClosure.status !== EMERGENCY_CLOSURE_STATUS.BLOCKED) {
        return null;
    }

    const triggerText = triggerTextOf(emergencyClosure);
    const blockReason = BLOCK_REASON_TEXT[emergencyClosure.block_reason] || UNKNOWN_STATUS_TEXT;
    const actionText = BLOCK_REASON_ACTION_TEXT[emergencyClosure.block_reason] || 'verificare il sistema';

    return `bloccata: tetto andrebbe chiuso per ${triggerText}, ma ${blockReason}. Azione: ${actionText}`;
}

/** Detail text for a completed emergency closure: the roof stays closed
 *  until the critical condition ends. Null when the closure is not completed. */
export function emergencyClosureCompletedText(emergencyClosure) {
    if (!emergencyClosure || emergencyClosure.status !== EMERGENCY_CLOSURE_STATUS.COMPLETED) {
        return null;
    }

    return `completata: il tetto rimane chiuso per ${triggerTextOf(emergencyClosure)}`;
}
