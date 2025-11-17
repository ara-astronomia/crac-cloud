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
        // Aggiorna un elemento di stato generale se l'API ha restituito un errore
        return;
    }
    
    console.log("[UPS] Data received successfully:", data);

    // Esempio di come potresti iterare sui grafici
    data.charts.forEach(item => {
        const chart = item.chart;
        
        // Cerchiamo l'elemento HTML dove mostrare il valore
        // Ad esempio, usiamo l'URN per creare un ID DOM unico (es: 'ups-apc-3000-battery')
        const elementId = chart.urn.replace(/\./g, '-'); 
        
        let elementValue = document.getElementById(elementId + '-value');
        let elementTitle = document.getElementById(elementId + '-title');

        if (elementValue) {
            elementValue.textContent = `${chart.value.toFixed(1)} ${chart.unit_of_measurement}`;
        }
        if (elementTitle) {
            elementTitle.textContent = `${chart.title} - ${chart.urn.split('.')[1]}`;
        }
        
        // Qui dovresti implementare la logica per aggiornare barre di progresso e colori
        // (Simile a quanto facevi nel tuo UpsConverter Python)
    });
    
    // Aggiorna l'orario dell'ultimo aggiornamento
    const updatedAtElement = document.getElementById('ups-updated-at');
    if (updatedAtElement) {
        updatedAtElement.textContent = new Date(data.updated_at * 1000).toLocaleTimeString();
    }
}

// Avvia il recupero dei dati immediatamente e poi a intervalli regolari
window.onload = function() {
    fetchUpsStatus();
    setInterval(fetchUpsStatus, POLLING_INTERVAL_MS);
};