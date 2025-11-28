// crac_cloud/static/js/ups.js

const UPS_STATUS_URL = '/ups/status';
const POLLING_INTERVAL_MS = 10000; // Aggiorna ogni 10 secondi

/**
 * Funzione principale per recuperare lo stato dell'UPS tramite API.
 */
async function fetchUpsStatus() {
    console.log(`[UPS] Fetching data from: ${UPS_STATUS_URL}`);

    try {
        const response = await fetch(UPS_STATUS_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("[UPS] Data fetched:", data);
        
        // Chiamiamo la funzione che aggiorna l'interfaccia utente
        updateUpsUI(data);

    } catch (error) {
        console.error(`[UPS ERROR] Failed to fetch UPS data:`, error);
        // Puoi aggiungere qui una logica per mostrare un messaggio di errore nell'UI
    }
}

/**
 * Aggiorna gli elementi HTML con i dati ricevuti dal server.
 * Questa funzione dovrà essere adattata in base all'HTML della tua UI.
 */
function updateUpsUI(data) {
    if (data.error) {
        console.error(`[UPS API Error]: ${data.error}`);
        return;
    }

    // 1. Mappa i dati per un accesso rapido usando l'URN come chiave
    const chartsMap = {};
    data.charts.forEach(item => {
        chartsMap[item.chart.urn] = item.chart;
    });

    // 2. MAPPATURA ESPLICITA E AGGIORNAMENTO

    // --- UTILITY FUNCTION ---
    // Funzione per aggiornare sia lo span del valore che la barra <meter>
    function updateElement(urn, valueElementId, meterElementId, decimals) {
        const chart = chartsMap[urn];
        if (chart) {
            // Prepara il valore formattato
            const value = chart.value.toFixed(decimals); 
            
            // Aggiorna lo SPAN del valore (es: 220.5)
            const valueEl = document.getElementById(valueElementId);
            if (valueEl) valueEl.textContent = value;

            // Aggiorna la barra METER
            const meterEl = document.getElementById(meterElementId);
            if (meterEl) meterEl.value = value;
            
            // Log per debug (assicurati che questo sia corretto)
            // console.log(`[UPS] Updated ${valueElementId} to: ${value}`);
        }
    }

    // --- AGGIORNAMENTO CONTROL ROOM (apc-3000) ---
    
    // Batteria Room (%): toFixed(0)
    updateElement('ups.apc-3000.chart.battery', 'value_batt_room', 'percent_batt_room', 0);

    // Voltaggio Room (V): toFixed(1)
    updateElement('ups.apc-3000.chart.voltage', 'value_volt_room', 'volt_rete_room', 1);


    // --- AGGIORNAMENTO CUPOLA (cyberpower) ---
    
    // Batteria Cupola (%): toFixed(0)
    updateElement('ups.cyberpower.chart.battery', 'value_batt_dome', 'percent_batt_dome', 0);

    // Voltaggio Cupola (V): toFixed(1)
    updateElement('ups.cyberpower.chart.voltage', 'value_volt_dome', 'volt_rete_dome', 1);

    // 3. Aggiorna l'orario dell'ultimo aggiornamento (se l'ID esiste)
    const updatedAtElement = document.getElementById('ups-updated-at');
    if (updatedAtElement) {
        // updated_at è un timestamp (secondi)
        updatedAtElement.textContent = new Date(data.updated_at * 1000).toLocaleTimeString(); 
    }
}

// Avvia il recupero dei dati immediatamente e poi a intervalli regolari
window.onload = function() {
    fetchUpsStatus();
    setInterval(fetchUpsStatus, POLLING_INTERVAL_MS);
};