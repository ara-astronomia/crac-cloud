// Funzione per inviare una richiesta POST al server
async function sendPostRequest(endpoint, data = {}) {
    console.log(`[POST] Invio dati a ${endpoint}:`, data);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
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
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Errore nella richiesta di stato:', error);
    }
}

// Associa i listener ai pulsanti
document.addEventListener('DOMContentLoaded', () => {
    // Listener per il pulsante del tetto
    if (typeof setupButtonListeners === 'function') {
        // Questa riga esegue tutto il codice in buttons.js, 
        // inclusi i console.log e i listener per tele-switch, ccd-switch, ecc.
        setupButtonListeners(); 
    }

    document.getElementById('btn-tetto').addEventListener('click', () => {
        // La logica del pulsante deve decidere se inviare OPEN o CLOSE
        const action = document.getElementById('btn-tetto').textContent.includes('Chiuso') ? 'OPEN' : 'CLOSE';
        sendPostRequest('/roof/set_action', { action: action });
    });

    // Listener per i pulsanti del telescopio
    document.getElementById('btn-conn-telescopio').addEventListener('click', () => {
        const action = document.getElementById('btn-conn-telescopio').textContent.includes('Disconnesso') ? 'TELESCOPE_CONNECT' : 'TELESCOPE_DISCONNECT';
        sendPostRequest('/button/set_action', { action: action });
    });
    document.getElementById('btn-park').addEventListener('click', () => {
    // Invia il comando al router dei pulsanti
    sendPostRequest('/buttons/set_action', {
        action: 'BUTTON_DEFAULT_ACTION', // L'azione generica per i pulsanti
        type: 'TELE_SWITCH', // Se necessario per identificare il gruppo
        key: 'KEY_PARK' // La chiave specifica per il pulsante
    });
    });
    document.getElementById('btn-flat').addEventListener('click', () => {
    // Invia il comando al router dei pulsanti
    sendPostRequest('/buttons/set_action', {
        action: 'BUTTON_DEFAULT_ACTION', // L'azione generica per i pulsanti
        type: 'TELE_SWITCH', // Se necessario per identificare il gruppo
        key: 'KEY_FLAT' // La chiave specifica per il pulsante
    });
    });

    // Funzione per aggiornare l'interfaccia utente
    async function updateUI() {
        // Aggiorna lo stato dei bottoni
        // 💡 NUOVA LOGICA: Chiama la funzione corretta da buttons.js
        if (typeof updateButtonStatuses === 'function') {
            await updateButtonStatuses();
        }               
    }

    // Esegue l'aggiornamento dell'UI ogni 2 secondi
    setInterval(updateUI, 2000);
});