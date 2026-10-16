// status_panel.js - Draws what alerts.js decided.
// The history is redrawn only on change: rebuilding it resets the reader's scroll.

import { alertText, noAlertText } from './alerts.js';

const SEVERITY_CLASS = {
    error: 'status-label-failure',
    danger: 'status-label-warning',
    info: 'status-label-info',
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

let renderedHistoryRevision = null;

export function renderAlerts(registry) {
    const summary = document.getElementById('lbl_status');
    const currentList = document.getElementById('alerts-current');
    const historyList = document.getElementById('alerts-history');
    if (!summary || !currentList || !historyList) return;

    const current = registry.current();
    summary.textContent = current.length === 0
        ? noAlertText()
        : `${current.length} ${current.length === 1 ? 'avviso attivo' : 'avvisi attivi'}`;
    const hasError = current.some(a => a.severity === 'error');
    const hasDanger = current.some(a => a.severity === 'danger');
    summary.classList.toggle('status-label-failure', hasError);
    summary.classList.toggle('status-label-warning', !hasError && hasDanger);
    summary.classList.toggle('status-label-info', !hasError && !hasDanger && current.length > 0);

    currentList.replaceChildren(...current.map(currentItem));

    if (renderedHistoryRevision === registry.revision) return;
    renderedHistoryRevision = registry.revision;
    historyList.replaceChildren(...registry.history().map(historyItem));
}
