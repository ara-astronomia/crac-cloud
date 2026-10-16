import { test } from 'node:test';
import assert from 'node:assert';

import { AlertRegistry, SEVERITY } from '../../crac_cloud/static/js/alerts.js';

const ROOF = 'Tetto';
const COVER = 'Copertura specchio';
const LINK = 'Collegamento a crac-server';

test('uno stato di errore apre un avviso per quel componente', () => {
    const registry = new AlertRegistry();
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    const current = registry.current();
    assert.equal(current.length, 1);
    assert.equal(current[0].component, ROOF);
    assert.equal(current[0].status, 'ROOF_ERROR');
    assert.equal(current[0].severity, SEVERITY.ERROR);
    assert.equal(current[0].count, 1);
});

test('uno stato sano non apre nulla', () => {
    const registry = new AlertRegistry();
    registry.record(ROOF, 'ROOF_CLOSED', 1000);
    assert.equal(registry.current().length, 0);
    assert.equal(registry.history().length, 0);
});

test('lo stesso errore ripetuto dal polling conta le occorrenze invece di duplicare', () => {
    const registry = new AlertRegistry();
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    registry.record(ROOF, 'ROOF_ERROR', 4000);
    registry.record(ROOF, 'ROOF_ERROR', 7000);
    const current = registry.current();
    assert.equal(current.length, 1);
    assert.equal(current[0].count, 3);
    assert.equal(current[0].firstSeenAt, 1000);
    assert.equal(current[0].lastSeenAt, 7000);
});

test('due componenti in errore convivono, non si sostituiscono', () => {
    const registry = new AlertRegistry();
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    registry.record(COVER, 'COVER_MIRROR_ERROR', 2000);
    assert.deepEqual(registry.current().map(a => a.component).sort(), [COVER, ROOF].sort());
});

test('il rientro chiude solo l\'avviso del componente rientrato', () => {
    const registry = new AlertRegistry();
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    registry.record(COVER, 'COVER_MIRROR_ERROR', 2000);
    registry.record(ROOF, 'ROOF_CLOSED', 3000);
    const current = registry.current();
    assert.equal(current.length, 1);
    assert.equal(current[0].component, COVER);
});

test('un avviso rientrato resta nello storico con l\'ora di chiusura', () => {
    const registry = new AlertRegistry();
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    registry.record(ROOF, 'ROOF_CLOSED', 5000);
    const history = registry.history();
    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'ROOF_ERROR');
    assert.equal(history[0].resolvedAt, 5000);
});

test('lo storico ha in cima la transizione piu\' recente', () => {
    const registry = new AlertRegistry();
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    registry.record(COVER, 'COVER_MIRROR_ERROR', 2000);
    assert.equal(registry.history()[0].component, COVER);
});

test('cambiare tipo di guasto sullo stesso componente e\' una nuova voce', () => {
    const registry = new AlertRegistry();
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    registry.record(ROOF, 'ROOF_DANGER', 2000);
    assert.equal(registry.current().length, 1);
    assert.equal(registry.current()[0].status, 'ROOF_DANGER');
    assert.equal(registry.history().length, 2);
    assert.equal(registry.history()[1].resolvedAt, 2000);
});

test('gli stati di pericolo sono avvisi con severita\' propria', () => {
    const registry = new AlertRegistry();
    registry.record('Tenda est', 'CURTAIN_DANGER', 1000);
    registry.record('Telescopio', 'LOST', 1000);
    registry.record('Telescopio velocita\'', 'SPEED_ERROR', 1000);
    const bySeverity = Object.fromEntries(registry.current().map(a => [a.component, a.severity]));
    assert.equal(bySeverity['Tenda est'], SEVERITY.DANGER);
    assert.equal(bySeverity['Telescopio'], SEVERITY.ERROR);
    assert.equal(bySeverity['Telescopio velocita\''], SEVERITY.ERROR);
});

test('lo storico non cresce oltre il limite, e tiene le voci piu\' recenti', () => {
    const registry = new AlertRegistry({ historyLimit: 3 });
    for (let i = 1; i <= 5; i++) {
        registry.record(`Componente ${i}`, 'ROOF_ERROR', i * 1000);
        registry.record(`Componente ${i}`, 'ROOF_CLOSED', i * 1000 + 500);
    }
    const history = registry.history();
    assert.equal(history.length, 3);
    assert.equal(history[0].component, 'Componente 5');
});

test('un avviso ancora aperto non viene scartato dal limite dello storico', () => {
    const registry = new AlertRegistry({ historyLimit: 2 });
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    for (let i = 1; i <= 5; i++) {
        registry.record(`Altro ${i}`, 'COVER_MIRROR_ERROR', i * 1000);
        registry.record(`Altro ${i}`, 'COVER_MIRROR_CLOSED', i * 1000 + 500);
    }
    assert.equal(registry.current().length, 1);
    assert.equal(registry.current()[0].component, ROOF);
});

import { alertText, noAlertText } from '../../crac_cloud/static/js/alerts.js';

test('il testo di un avviso nomina il componente e cosa gli succede', () => {
    assert.equal(
        alertText({ component: 'Copertura specchio', status: 'COVER_MIRROR_ERROR' }),
        'Copertura specchio: errore',
    );
});

test('il telescopio perso ha un testo suo, non un generico errore', () => {
    assert.equal(
        alertText({ component: 'Telescopio', status: 'LOST' }),
        'Telescopio: connessione persa',
    );
});

test('un pericolo si legge come attenzione, non come guasto', () => {
    assert.equal(
        alertText({ component: 'Tenda est', status: 'CURTAIN_DANGER' }),
        'Tenda est: attenzione, posizione di pericolo',
    );
});

test('uno stato senza testo dedicato non stampa undefined', () => {
    const text = alertText({ component: 'Tetto', status: 'ROOF_SOMETHING_NEW' });
    assert.ok(text.startsWith('Tetto: '));
    assert.ok(!text.includes('undefined'));
});

test('un componente che non si riesce a leggere e\' un guasto con un testo suo', () => {
    const registry = new AlertRegistry();
    registry.record('Lettura tetto', 'READ_ERROR', 1000);
    const [alert] = registry.current();
    assert.equal(alert.severity, SEVERITY.ERROR);
    assert.equal(alertText(alert), 'Lettura tetto: nessuna risposta, i valori del pannello sono fermi');
});

test('a riposo la sezione ha il suo messaggio', () => {
    assert.equal(noAlertText(), 'Nessun errore riscontrato');
});

import { telescopeSpeedToReport } from '../../crac_cloud/static/js/alerts.js';

test('a telescopio spento la velocita\' non e\' un guasto', () => {
    assert.equal(telescopeSpeedToReport('DISCONNECTED', 'SPEED_ERROR'), null);
});

test('a telescopio gia\' in avviso la velocita\' non ne aggiunge un secondo', () => {
    assert.equal(telescopeSpeedToReport('LOST', 'SPEED_ERROR'), null);
    assert.equal(telescopeSpeedToReport('ERROR', 'SPEED_ERROR'), null);
});

test('a telescopio operativo la velocita\' illeggibile e\' un guasto suo', () => {
    assert.equal(telescopeSpeedToReport('PARKED', 'SPEED_ERROR'), 'SPEED_ERROR');
    assert.equal(telescopeSpeedToReport('EAST', 'SPEED_TRACKING'), 'SPEED_TRACKING');
});

test('le ripetizioni non contano come cambiamenti dello storico', () => {
    const registry = new AlertRegistry();
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    const afterFirst = registry.revision;
    registry.record(ROOF, 'ROOF_ERROR', 2000);
    registry.record(ROOF, 'ROOF_ERROR', 3000);
    assert.equal(registry.revision, afterFirst);
});

test('aprire e chiudere un avviso cambia la revisione dello storico', () => {
    const registry = new AlertRegistry();
    const atStart = registry.revision;
    registry.record(ROOF, 'ROOF_ERROR', 1000);
    const afterOpen = registry.revision;
    assert.notEqual(afterOpen, atStart);
    registry.record(ROOF, 'ROOF_CLOSED', 2000);
    assert.notEqual(registry.revision, afterOpen);
});

test('uno stato sano su un componente mai visto non cambia nulla', () => {
    const registry = new AlertRegistry();
    const atStart = registry.revision;
    registry.record(ROOF, 'ROOF_CLOSED', 1000);
    assert.equal(registry.revision, atStart);
});

import { telescopeStatusToReport } from '../../crac_cloud/static/js/alerts.js';

test('con l\'alimentatore del telescopio spento, irraggiungibile non e\' un guasto', () => {
    assert.equal(telescopeStatusToReport('LOST', 'OFF'), null);
    assert.equal(telescopeStatusToReport('ERROR', 'OFF'), null);
});

test('finche\' non si sa se e\' alimentato non si segnala nulla', () => {
    assert.equal(telescopeStatusToReport('LOST', undefined), null);
});

test('con l\'alimentatore acceso, irraggiungibile e\' un guasto', () => {
    assert.equal(telescopeStatusToReport('LOST', 'ON'), 'LOST');
});

test('lo stato normale passa comunque, per chiudere gli avvisi aperti', () => {
    assert.equal(telescopeStatusToReport('PARKED', 'ON'), 'PARKED');
});

test('il collegamento perso e\' un errore, e il testo dice che i valori sono fermi', () => {
    const registry = new AlertRegistry();
    registry.record(LINK, 'SERVER_ERROR', 1000);
    assert.equal(registry.current()[0].severity, SEVERITY.ERROR);
    assert.equal(alertText({ component: LINK, status: 'SERVER_ERROR' }),
                 `${LINK}: nessuna risposta, i valori a schermo sono fermi`);
});

test('il collegamento col servizio perso ha un testo suo, che non nomina crac-server', () => {
    const CLOUD_LINK = 'Collegamento a crac-cloud';
    assert.equal(alertText({ component: CLOUD_LINK, status: 'CLOUD_ERROR' }),
                 `${CLOUD_LINK}: la pagina non riesce a parlare col servizio, i valori a schermo sono fermi`);
});

import { emergencyClosureAlertText, EMERGENCY_CLOSURE_STATUS } from '../../crac_cloud/static/js/alerts.js';

const EC = 'Chiusura d\'emergenza';

test('chiusura bloccata per meteo: testo con causa, blocco e azione', () => {
    const text = emergencyClosureAlertText({
        status: EMERGENCY_CLOSURE_STATUS.BLOCKED,
        triggers: [1],  // WEATHER
        block_reason: 1,  // TELESCOPE_UNKNOWN
        status_since: 1000,
    });
    assert.equal(text, 'bloccata: tetto andrebbe chiuso per meteo, ma posizione del telescopio sconosciuta. Azione: collegare il telescopio');
});

test('chiusura non bloccata non ha testo', () => {
    assert.equal(emergencyClosureAlertText(null), null);
    assert.equal(emergencyClosureAlertText({ status: EMERGENCY_CLOSURE_STATUS.IDLE, triggers: [], block_reason: 0 }), null);
    assert.equal(emergencyClosureAlertText({ status: EMERGENCY_CLOSURE_STATUS.COMPLETED, triggers: [1], block_reason: 0 }), null);
});

test('piu\' trigger si leggono in fila e il block reason guida l\'azione', () => {
    const text = emergencyClosureAlertText({
        status: EMERGENCY_CLOSURE_STATUS.BLOCKED,
        triggers: [1, 2],  // WEATHER + UPS
        block_reason: 2,  // PARK_NOT_REACHED
    });
    assert.ok(text.includes('per meteo e UPS'));
    assert.ok(text.includes('park non raggiunto'));
    assert.ok(text.includes('Azione: portare il telescopio in park a mano'));
});

test('senza trigger riconoscibili l\'avviso resta visibile con causa generica', () => {
    const text = emergencyClosureAlertText({ status: EMERGENCY_CLOSURE_STATUS.BLOCKED, triggers: [0], block_reason: 1 });
    assert.equal(text, 'bloccata: tetto andrebbe chiuso per una condizione critica, ma posizione del telescopio sconosciuta. Azione: collegare il telescopio');
    assert.ok(emergencyClosureAlertText({ status: EMERGENCY_CLOSURE_STATUS.BLOCKED, triggers: [], block_reason: 1 }).includes('una condizione critica'));
});

test('l\'avviso di chiusura bloccata e\' un errore col testo completo', () => {
    const registry = new AlertRegistry();
    const details = emergencyClosureAlertText({
        status: EMERGENCY_CLOSURE_STATUS.BLOCKED,
        triggers: [1],
        block_reason: 1,
    });
    registry.record(EC, 'EMERGENCY_CLOSURE_BLOCKED', 1000, details);
    const [alert] = registry.current();
    assert.equal(alert.severity, SEVERITY.ERROR);
    assert.equal(alertText(alert), `${EC}: bloccata: tetto andrebbe chiuso per meteo, ma posizione del telescopio sconosciuta. Azione: collegare il telescopio`);
});

test('il rientro della chiusura bloccata chiude l\'avviso e lo mette in storico', () => {
    const registry = new AlertRegistry();
    registry.record(EC, 'EMERGENCY_CLOSURE_BLOCKED', 1000, 'bloccata: tetto andrebbe chiuso per meteo');
    registry.record(EC, null, 2000);
    assert.equal(registry.current().length, 0);
    assert.equal(registry.history().length, 1);
    assert.equal(registry.history()[0].status, 'EMERGENCY_CLOSURE_BLOCKED');
});

import {
    emergencyClosureCompletedText,
    emergencyClosureStatusToReport,
} from '../../crac_cloud/static/js/alerts.js';

test('chiusura completata per meteo: il tetto rimane chiuso', () => {
    const text = emergencyClosureCompletedText({
        status: EMERGENCY_CLOSURE_STATUS.COMPLETED,
        triggers: [1],
    });
    assert.equal(text, 'completata: il tetto rimane chiuso per meteo');
});

test('chiusura completata per UPS nomina l\'UPS', () => {
    const text = emergencyClosureCompletedText({
        status: EMERGENCY_CLOSURE_STATUS.COMPLETED,
        triggers: [2],
    });
    assert.equal(text, 'completata: il tetto rimane chiuso per UPS');
});

test('chiusura completata con piu\' trigger li legge in fila', () => {
    const text = emergencyClosureCompletedText({
        status: EMERGENCY_CLOSURE_STATUS.COMPLETED,
        triggers: [1, 2],
    });
    assert.ok(text.includes('per meteo e UPS'));
});

test('chiusura completata senza trigger riconoscibili resta generica', () => {
    const text = emergencyClosureCompletedText({
        status: EMERGENCY_CLOSURE_STATUS.COMPLETED,
        triggers: [0],
    });
    assert.equal(text, 'completata: il tetto rimane chiuso per una condizione critica');
});

test('la chiusura non completata non ha testo di completamento', () => {
    assert.equal(emergencyClosureCompletedText(null), null);
    assert.equal(emergencyClosureCompletedText({ status: EMERGENCY_CLOSURE_STATUS.IDLE, triggers: [] }), null);
    assert.equal(emergencyClosureCompletedText({ status: EMERGENCY_CLOSURE_STATUS.BLOCKED, triggers: [1] }), null);
});

test('lo stato della chiusura diventa avviso solo per bloccata e completata', () => {
    assert.equal(emergencyClosureStatusToReport(null), null);
    assert.equal(emergencyClosureStatusToReport({ status: EMERGENCY_CLOSURE_STATUS.IDLE, triggers: [] }), null);
    assert.equal(emergencyClosureStatusToReport({ status: EMERGENCY_CLOSURE_STATUS.IN_PROGRESS, triggers: [1] }), null);
    assert.equal(emergencyClosureStatusToReport({ status: EMERGENCY_CLOSURE_STATUS.BLOCKED, triggers: [1] }), 'EMERGENCY_CLOSURE_BLOCKED');
    assert.equal(emergencyClosureStatusToReport({ status: EMERGENCY_CLOSURE_STATUS.COMPLETED, triggers: [1] }), 'EMERGENCY_CLOSURE_COMPLETED');
});

test('l\'avviso di chiusura completata e\' informativo, non un errore', () => {
    const registry = new AlertRegistry();
    const details = emergencyClosureCompletedText({
        status: EMERGENCY_CLOSURE_STATUS.COMPLETED,
        triggers: [1],
    });
    registry.record(EC, 'EMERGENCY_CLOSURE_COMPLETED', 1000, details);
    const [alert] = registry.current();
    assert.equal(alert.severity, SEVERITY.INFO);
    assert.equal(alertText(alert), `${EC}: completata: il tetto rimane chiuso per meteo`);
});

test('da bloccata a completata l\'errore rientra e resta visibile l\'informativo', () => {
    const registry = new AlertRegistry();
    registry.record(EC, 'EMERGENCY_CLOSURE_BLOCKED', 1000, 'bloccata: tetto andrebbe chiuso per meteo');
    registry.record(EC, 'EMERGENCY_CLOSURE_COMPLETED', 2000, 'completata: il tetto rimane chiuso per meteo');
    const current = registry.current();
    assert.equal(current.length, 1);
    assert.equal(current[0].status, 'EMERGENCY_CLOSURE_COMPLETED');
    assert.equal(current[0].severity, SEVERITY.INFO);
    const [resolved] = registry.history().filter(entry => entry.status === 'EMERGENCY_CLOSURE_BLOCKED');
    assert.equal(resolved.resolvedAt, 2000);
});

test('il ritorno in IDLE chiude l\'avviso di chiusura completata', () => {
    const registry = new AlertRegistry();
    registry.record(EC, 'EMERGENCY_CLOSURE_COMPLETED', 1000, 'completata: il tetto rimane chiuso per meteo');
    registry.record(EC, null, 2000);
    assert.equal(registry.current().length, 0);
    assert.equal(registry.history().length, 1);
    assert.equal(registry.history()[0].status, 'EMERGENCY_CLOSURE_COMPLETED');
});
