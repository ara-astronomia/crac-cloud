// Funzione per inviare una richiesta POST al server
// Assicurati che queste funzioni siano importate o esposte a livello globale

async function sendPostRequest(endpoint, data = {}) {
    console.log(`[POST] Invio dati a ${endpoint}`);
    console.log("Dati inviati:", data);
    // 1. Tenta di inviare la richiesta POST
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            
            
        });
        console.log(`[POST] Risposta ricevuta da ${endpoint}:`, response);
        if (!response.ok) {
            // Se lo stato è un errore HTTP (es. 404), lancia un errore esplicito
            const errorText = await response.text();
            throw new Error(`Errore HTTP ${response.status} (${response.statusText}): ${errorText}`);
        }

        // 2. Tenta di parsare la risposta JSON (il router restituisce JSON)
        try {
            return await response.json();
        } catch (e) {
            // Caso in cui la risposta non è JSON (es. un errore interno Uvicorn/FastAPI)
            const textResponse = await response.text();
            console.warn("La risposta non è un JSON valido:", textResponse);
            return { status: "error", message: "Risposta non JSON valida dal server." };
        }

    } catch (e) {
        // Cattura gli errori di rete (es. server non raggiungibile, fetch fallito, CORS)
        console.error("Errore di rete/fetch nella POST:", e);
        // Rilancia l'errore per gestirlo nel listener del pulsante
        throw e; 
    }
}

// Funzione per inviare una richiesta GET al server e ottenere lo stato
async function fetchStatus(endpoint) {
    try {
        const response = await fetch(endpoint);
        
        // Se la risposta è HTTP 4xx/5xx (non OK), lanciamo l'errore per finire nel catch
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} at ${endpoint}`);
        }
        
        const result = await response.json();
        return result; // Successo! Restituisce i dati
        
    } catch (error) {
        console.error('Errore nella richiesta di stato:', error);
        
        // 🎯 GESTIONE DI SICUREZZA: Restituisce un oggetto strutturato vuoto
        // In questo modo, chartStatus non è undefined e il controllo 'if (chartStatus && chartStatus.charts)'
        // può procedere senza bloccarsi.
        return {}; 
    }
}
window.sendPostRequest = sendPostRequest; 
window.fetchStatus = fetchStatus; 

//import { initTelescopeControl } from './telescope_control.js';
import { initRoofControl } from './roof_control.js'; // 🛑 NECESSARIO: Presumo che sia un modulo


// Associa i listener ai pulsanti
document.addEventListener('DOMContentLoaded', () => {
    // Listener per il pulsante del tetto
    if (typeof setupButtonListeners === 'function') {
        setupButtonListeners(); 
    }

    if (typeof initRoofControl === 'function') { 
        initRoofControl(); 
    } 
 
    if (typeof window.initTelescopeControl === 'function') { 
        window.initTelescopeControl(); 
    }
    // Funzione per aggiornare l'interfaccia utente
    async function updateUI() {
        try {
            if (typeof window.updateButtonStatuses === 'function') {
                await window.updateButtonStatuses();
            }
            else {
                console.warn("updateButtonStatuses non è definito.");
            }
            if (typeof fetchCurtainsStatus === 'function') {
                await fetchCurtainsStatus(); // Aggiungi questa chiamata!
            } else {
                // In un ambiente modulare, potresti dover importare esplicitamente fetchCurtainsStatus
                console.warn("fetchCurtainsStatus non è definito o non è nel global scope.");
            }
            
            // 2. Aggiorna lo stato dei button (Tetto, ecc.)
            if (typeof window.updateButtonStatuses === 'function') {
                await window.updateButtonStatuses();
            } else {
                console.warn("updateButtonStatuses non è definito.");
            }
            const chartStatus = await fetchStatus('/charts/status');


            if (chartStatus && chartStatus.charts) {
        
            // Aggiorna la condizione meteo generale (testo)
            document.getElementById('cond_meteo').textContent = chartStatus.status;
            // console.log("Aggiornamento condizione meteo:", chartStatus.status);
            
            chartStatus.charts.forEach(chart => {
            
            // 1. Logica per gli INPUT Standard (Volt, Batterie, ecc.)
            // (Lascia la tua logica esistente qui per gli elementi HTML semplici)
            let elementId = null;


            if (elementId) {
                const element = document.getElementById(elementId);
                if (element && element.tagName === 'INPUT') {
                    element.value = chart.value;
                } else if (element) {
                    element.textContent = chart.value;
                }
            }

            // 2. Logica per i GAUGE (Indicatori D3.js)
            // I gauge sono identificati da una "key" nel gauges.js.
            // Dobbiamo estrarre la chiave (es. "temperature", "humidity") dal chart.urn o chart.title
            
            const gaugeKey = chart.urn.split('/').pop(); // Esempio: "crac:weather/temperature" -> "temperature"
            const gaugeId = `gauge-${gaugeKey}`; // Es: "gauge-temperature"
            
            // Controlla se l'oggetto gauge esiste nella collezione globale
            if (window.gauges && window.gauges[gaugeId]) {
                const gauge = window.gauges[gaugeId];
                // console.log(`[Gauge Update] Trovato gauge ${gaugeId} con valore: ${chart.value}`);
                const roundedValue = parseFloat(chart.value).toFixed(1);
                // Aggiorna il valore interno dell'oggetto gauge
                gauge.value = chart.value; 
                
                // Chiama la funzione di rendering di D3.js per muovere l'ago
                gauge.update(); 
                //console.log(`[Gauge Update] Aggiornato ${gaugeId} con valore: ${roundedValue}`);
                
                // 💡 Aggiorna anche l'unità di misura se necessario (la logica è in gauges.js)
                document.getElementById(`unit-${gaugeId}`).textContent = chart.unit_of_measurement;
            }
            });    
    // ... (Fine della funzione)
    }  

    } catch (e) {
        console.error("Errore nell'aggiornamento dell'UI:", e);
    }
}
updateUI(); // Chiamata iniziale
setInterval(updateUI, 500);
});


