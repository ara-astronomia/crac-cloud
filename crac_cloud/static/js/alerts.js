/** alerts.js - What is worth reporting in "Stato di CRaC". No DOM here.
 *  Every component owns its alert, so a healthy one cannot silence a broken one. */

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
    READ_ERROR: 'nessuna risposta, i valori del pannello sono fermi',
    SERVER_ERROR: 'nessuna risposta, i valori a schermo sono fermi',
    CLOUD_ERROR: 'la pagina non riesce a parlare col servizio, i valori a schermo sono fermi',
    ROOF_DANGER: 'attenzione, posizione di pericolo',
    CURTAIN_DANGER: 'attenzione, posizione di pericolo',
    EMERGENCY_CLOSURE_BLOCKED: 'chiusura d\'emergenza bloccata',
};

// Emergency closure status constants from protobuf
const EMERGENCY_CLOSURE_STATUS = {
    UNSPECIFIED: 0,
    IDLE: 1,
    IN_PROGRESS: 2,
    COMPLETED: 3,
    BLOCKED: 4,
};

// Emergency closure block reason constants from protobuf
const EMERGENCY_CLOSURE_BLOCK_REASON = {
    UNSPECIFIED: 0,
    TELESCOPE_UNKNOWN: 1,
    PARK_NOT_REACHED: 2,
    CURTAINS_NOT_DISABLED: 3,
    ROOF_NOT_CLOSED: 4,
    INTERNAL_ERROR: 5,
};

// Emergency closure trigger constants from protobuf
const EMERGENCY_CLOSURE_TRIGGER = {
    UNSPECIFIED: 0,
    WEATHER: 1,
    UPS: 2,
    WEATHER_UNAVAILABLE: 3,
    UPS_UNAVAILABLE: 4,
};

// Map trigger enum to human-readable text
const TRIGGER_TEXT = {
    1: 'meteo',
    2: 'UPS',
    3: 'dati meteo non disponibili',
    4: 'dati UPS non disponibili',
};

// Map block reason enum to human-readable text
const BLOCK_REASON_TEXT = {
    1: 'posizione del telescopio sconosciuta',
    2: 'park non raggiunto',
    3: 'tende non disattivate',
    4: 'tetto non chiuso',
    5: 'errore interno',
};

// Map trigger to action text for operator
const TRIGGER_ACTION_TEXT = {
    1: 'collegare il telescopio o risolvere il problema meteo',
    2: 'collegare il telescopio o risolvere il problema UPS',
    3: 'attendere il ripristino della connessione meteo',
    4: 'attendere il ripristino della connessione UPS',
};

const UNKNOWN_STATUS_TEXT = 'stato anomalo';

const DEFAULT_HISTORY_LIMIT = 50;

function severityOf(status) {
    if (!status) return HEALTHY;
    if (status === 'ERROR' || status === 'LOST' || status.endsWith('_ERROR') || 
        status === 'EMERGENCY_CLOSURE_BLOCKED') return SEVERITY.ERROR;
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

export function alertText({ component, status, emergencyClosureDetails }) {
    if (status === 'EMERGENCY_CLOSURE_BLOCKED' && emergencyClosureDetails) {
        return emergencyClosureDetails;
    }
    return `${component}: ${TEXT_BY_STATUS[status] || UNKNOWN_STATUS_TEXT}`;
}

export function noAlertText() {
    return NO_ALERT_TEXT;
}

/** Generates alert text for emergency closure blocked state.
 *  Returns null if emergency_closure is not blocked, otherwise returns
 *  an object with component and status for alertText(). */
export function emergencyClosureAlertText(emergencyClosure) {
    if (!emergencyClosure || emergencyClosure.status !== EMERGENCY_CLOSURE_STATUS.BLOCKED) {
        return null;
    }

    // Determine which triggers are active
    const activeTriggers = [];
    for (const trigger of emergencyClosure.triggers) {
        if (trigger !== EMERGENCY_CLOSURE_TRIGGER.UNSPECIFIED && TRIGGER_TEXT[trigger]) {
            activeTriggers.push(TRIGGER_TEXT[trigger]);
        }
    }

    if (activeTriggers.length === 0) {
        return null;
    }

    const triggerText = activeTriggers.join(' e ');
    const blockReason = BLOCK_REASON_TEXT[emergencyClosure.block_reason] || UNKNOWN_STATUS_TEXT;
    
    // For the action, use the first trigger or a generic message
    const firstTrigger = emergencyClosure.triggers[0];
    const actionText = TRIGGER_ACTION_TEXT[firstTrigger] || 'verificare il sistema';

    // Build the full alert text
    const component = 'Chiusura d\'emergenza';
    const statusText = `bloccata: tetto andrebbe chiuso per ${triggerText}, ma ${blockReason}. Azione: ${actionText}`;

    return { component, status: statusText };
}
