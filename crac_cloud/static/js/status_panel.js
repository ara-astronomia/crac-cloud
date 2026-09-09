// =============================================================================
// status_panel.js - Disegna gli avvisi di "Stato di CRaC"
// La decisione di cosa segnalare sta in alerts.js: qui si scrive soltanto.
// =============================================================================

import { alertText, noAlertText } from './alerts.js';

const SEVERITY_CLASS = {
    error: 'status-label-failure',
    danger: 'status-label-warning',
};

function formatTime(at) {
    return new Date(at).toLocaleTimeString('it-IT');
}

function currentItem(alert) {
    const item = document.createElement('li');
    item.className = `alert-item ${SEVERITY_CLASS[alert.severity] || ''}`;
    const repetitions = alert.count > 1 ? ` (${alert.count} volte, ultima ${formatTime(alert.lastSeenAt)})` : '';
    item.textContent = `${formatTime(alert.firstSeenAt)} - ${alertText(alert)}${repetitions}`;
    return item;
}

function historyItem(alert) {
    const item = document.createElement('li');
    item.className = 'alert-history-item';
    const closing = alert.resolvedAt ? ` - rientrato alle ${formatTime(alert.resolvedAt)}` : ' - in corso';
    item.textContent = `${formatTime(alert.firstSeenAt)} - ${alertText(alert)}${closing}`;
    return item;
}

export function renderAlerts(registry) {
    const summary = document.getElementById('lbl_status');
    const currentList = document.getElementById('alerts-current');
    const historyList = document.getElementById('alerts-history');
    if (!summary || !currentList || !historyList) return;

    const current = registry.current();
    summary.textContent = current.length === 0
        ? noAlertText()
        : `${current.length} ${current.length === 1 ? 'avviso attivo' : 'avvisi attivi'}`;
    summary.classList.toggle('status-label-failure', current.some(a => a.severity === 'error'));
    summary.classList.toggle('status-label-warning', current.length > 0 && !current.some(a => a.severity === 'error'));

    currentList.replaceChildren(...current.map(currentItem));
    historyList.replaceChildren(...registry.history().map(historyItem));
}
