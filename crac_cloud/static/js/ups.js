// =============================================================================
// ups.js - Modulo puro per lo stato UPS
// =============================================================================

export function initUps() {
    console.log('[UPS] Inizializzato.');
}

export function updateUpsUI(data) {
    if (!data || !data.charts) return;

    const chartsMap = {};
    data.charts.forEach(item => {
        if (item.chart && item.chart.urn) {
            chartsMap[item.chart.urn] = item.chart;
        }
    });

    _updateElement(chartsMap, 'ups.apc-3000.chart.battery',   'value_batt_room',  'percent_batt_room',  0);
    _updateElement(chartsMap, 'ups.apc-3000.chart.voltage',   'value_volt_room',  'volt_rete_room',     1);
    _updateElement(chartsMap, 'ups.cyberpower.chart.battery', 'value_batt_dome',  'percent_batt_dome',  0);
    _updateElement(chartsMap, 'ups.cyberpower.chart.voltage', 'value_volt_dome',  'volt_rete_dome',     1);
}

function _updateElement(chartsMap, urn, valueId, meterId, decimals) {
    const chart = chartsMap[urn];
    if (!chart) return;
    const value = chart.value.toFixed(decimals);
    const valueEl = document.getElementById(valueId);
    const meterEl = document.getElementById(meterId);
    if (valueEl) valueEl.textContent = value;
    if (meterEl) meterEl.value = value;
}
