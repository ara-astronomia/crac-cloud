// Funzione per inviare una richiesta POST al server
async function sendPostRequest(endpoint, data = {}) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        const result = await response.json();
        console.log(result);
        return result;
    } catch (error) {
        console.error('Errore nella richiesta:', error);
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

    // Listener per i pulsanti delle tende
    document.getElementById('btn-curtains').addEventListener('click', () => {
        const action = document.getElementById('btn-curtains').textContent.includes('Disattive') ? 'ENABLE' : 'DISABLE';
        sendPostRequest('/curtains/set_action', { action: action });
    });
    document.getElementById('btn-calibra').addEventListener('click', () => {
        sendPostRequest('/curtains/set_action', { action: 'CALIBRATE_CURTAINS' });
    });

    // Listener per i pulsanti degli interruttori e luci
    document.getElementById('btn-tele-switch').addEventListener('click', () => {
    const action = document.getElementById('btn-tele-switch').textContent.includes('Spento') ? 'TURN_ON' : 'TURN_OFF';
    sendPostRequest('/buttons/set_action', {
        action: action,
        key: null, // Non ha una chiave, quindi invia null
        type: 'TELE_SWITCH'
    });
    });
    document.getElementById('btn-ccd-switch').addEventListener('click', () => {
    const action = document.getElementById('btn-ccd-switch').textContent.includes('Spento') ? 'TURN_ON' : 'TURN_OFF';
    sendPostRequest('/buttons/set_action', {
        action: action,
        key: null,
        type: 'CCD_SWITCH'
    });
    });
    document.getElementById('btn-flat-light').addEventListener('click', () => {
    const action = document.getElementById('btn-flat-light').textContent.includes('Spento') ? 'TURN_ON' : 'TURN_OFF';
    sendPostRequest('/buttons/set_action', {
        action: action,
        key: null,
        type: 'FLAT_LIGHT'
    });
});
    document.getElementById('btn-dome-light').addEventListener('click', () => {
    const action = document.getElementById('btn-dome-light').textContent.includes('Spento') ? 'TURN_ON' : 'TURN_OFF';
    sendPostRequest('/buttons/set_action', {
        action: action,
        key: null,
        type: 'DOME_LIGHT'
    });
});

    
    // Funzione per aggiornare l'interfaccia utente
    async function updateUI() {
        // Aggiorna lo stato dei bottoni
        const buttonsStatus = await fetchStatus('/buttons/status');
        if (buttonsStatus && buttonsStatus.buttons) {
            buttonsStatus.buttons.forEach(button => {
                // Trova il pulsante corrispondente in base al tipo e aggiorna il testo
                const btnId = button.type === 'CCD_SWITCH' ? 'btn-ccd-switch' :
                              button.type === 'TELE_SWITCH' ? 'btn-tele-switch' :
                              button.type === 'FLAT_LIGHT' ? 'btn-flat-light' :
                              button.type === 'DOME_LIGHT' ? 'btn-dome-light' : null;
                if (btnId) {
                    const btn = document.getElementById(btnId);
                    if (btn) {
                        btn.textContent = button.status === 'ON' ? 'Acceso' : 'Spento';
                    }
                }
            });
        }
        
        // Aggiorna lo stato delle tende
        const curtainsStatus = await fetchStatus('/curtains/status');
        if (curtainsStatus && curtainsStatus.curtains) {
            curtainsStatus.curtains.forEach(curtain => {
                const labelId = curtain.orientation === 'CURTAIN_EAST' ? 'lbl_altezza_tenda_est' : 'lbl_altezza_tenda_ovest';
                const statusId = curtain.orientation === 'CURTAIN_EAST' ? 'lbl_status_tenda_est' : 'lbl_status_tenda_ovest';
                
                document.getElementById(labelId).textContent = curtain.steps;
                document.getElementById(statusId).textContent = curtain.status.replace('CURTAIN_', '');
            });
        }

        // Aggiorna lo stato del tetto
        const roofStatus = await fetchStatus('/roof/status');
        if (roofStatus && roofStatus.status) {
            const btnTetto = document.getElementById('btn-tetto');
            btnTetto.textContent = roofStatus.status.includes('CLOSED') ? 'Chiuso' :
                                   roofStatus.status.includes('OPENED') ? 'Aperto' :
                                   roofStatus.status.includes('CLOSING') ? 'Chiusura...' :
                                   roofStatus.status.includes('OPENING') ? 'Apertura...' : 'Stato Sconosciuto';
            btnTetto.disabled = roofStatus.status.includes('CLOSING') || roofStatus.status.includes('OPENING');
        }

        // Aggiorna lo stato degli UPS
        const upsStatus = await fetchStatus('/ups/status');
        if (upsStatus && upsStatus.charts) {
             upsStatus.charts.forEach(upsChart => {
                const chart = upsChart.chart;
                if (chart.urn.includes('dome')) {
                    if (chart.title.includes('Tensione Rete')) {
                        document.getElementById('volt_rete_dome').value = chart.value;
                    } else if (chart.title.includes('Batterie')) {
                        document.getElementById('percent_batt_dome').value = chart.value;
                    }
                } else if (chart.urn.includes('room')) {
                    if (chart.title.includes('Tensione Rete')) {
                        document.getElementById('volt_rete_room').value = chart.value;
                    } else if (chart.title.includes('Batterie')) {
                        document.getElementById('percent_batt_room').value = chart.value;
                    }
                }
            });
        }
        
        // Aggiorna lo stato meteo e i grafici
        const chartStatus = await fetchStatus('/charts/status');
        if (chartStatus && chartStatus.charts) {
            // Aggiorna le label per la tendenza del barometro
            document.getElementById('cond_meteo').textContent = chartStatus.status;
            
            // Qui dovrai integrare una libreria come Plotly.js o simile per disegnare i grafici
            // Sostituisci il codice qui sotto con la logica di disegno dei grafici
            // Ad esempio: drawChart('gauge-temperature', chartData);
        }
        
    }

    // Esegue l'aggiornamento dell'UI ogni 2 secondi
    setInterval(updateUI, 2000);
});