// =========================================================================
// roof_control.js - MODULO DI CONTROLLO TETTO TELESCOPICO (Definitivo)
// =========================================================================

// 🎯 Mappa di traduzione ENUM -> Etichetta UI leggibile
// Contiene solo le etichette pertinenti al Tetto e quelle generiche
let lastKnownRoofState = 'DEFAULT'; 

// Mappatura: STATO_CORRENTE_SERVER (stringa enum) -> AZIONE_DA_INVIARE (stringa enum)

import { ROOF_STATE_TO_ACTION_MAP, STATUS_LABELS_MAP } from './gui_constants.js'; 
// =========================================================================
// FUNZIONI DI COMUNICAZIONE (GET/POST)
// =========================================================================

/** Invia un'azione (OPEN/CLOSE) al backend. */
function sendRoofCommand(action) {
    const endpoint = '/roof/set_action';
    console.log(`[POST] Invio POST a ${endpoint} con azione: ${action}`);
    
    return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action })
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
        return response.json(); // Restituisce l'oggetto completo {status, gui}
    })
    .catch(error => {
        console.error(`Errore durante l'azione ${action}:`, error);
        alert(`Errore nell'esecuzione dell'azione ${action}.`);
        throw error; 
    });
}

/** Ottiene lo stato attuale completo del tetto tramite GET. */
function getRoofStatus() {
    console.log("[GET] Esecuzione fetch GET /roof/status...");
    return fetch('/roof/status', { method: 'GET' })
        .then(response => {
            if (!response.ok) throw new Error('Errore nel recupero stato tetto.');
            
            // 🎯 PUNTO CRITICO: Esegui la conversione JSON!
            return response.json(); 
        })
        .then(data => {
            // Qui 'data' è l'oggetto JSON { status: 'ROOF_CLOSED', gui: {...} }
            lastKnownRoofState = data.status; 
            return data; 
        })
        .catch(error => {
            console.error("Errore GET stato:", error);
            // Restituisce un oggetto di errore
            return { status: "ERROR", gui: { label: "LABEL_ERROR", is_disabled: true } }; 
        });
}

// =========================================================================
// FUNZIONI DI AGGIORNAMENTO UI E POLLING
// =========================================================================

/** Aggiorna l'interfaccia utente in base alla risposta completa del server. */
function updateRoofUI(serverStatusData, button) {
    
    console.log("[UI] Aggiornamento UI tetto con dati:");
    // Fallback: assicurati che serverStatusData esista
    if (!serverStatusData) {
        console.warn("dati di stato mancanti!!!");
        return; 
    }
    // 1. Estrazione dati
    // 🛑 ASSICURATI DI ACCEDERE AL CAMPO 'status'
    // Se 'serverStatusData.status' non è presente, usa una stringa vuota per sicurezza!
    console.log("[DEBUG ROOF PAYLOAD]", serverStatusData);
    const serverState = serverStatusData.status || ''; 
    const gui = serverStatusData.gui || {}; 
    // 🎯 NUOVE RIGHE NECESSARIE: Estrai l'etichetta ENUM
    const enumLabel = gui.label || "DEFAULT_LABEL";
    
    // 🛑 VECCHIA RIGA 96 (SPOSTATA E CORRETTA): Ora LABEL_TRANSLATION_MAP e enumLabel sono definite
    const labelData = STATUS_LABELS_MAP[enumLabel];
    const buttonText = labelData ? labelData.text : enumLabel;
    const isDisabled = gui.is_disabled !== undefined ? gui.is_disabled : true; 
    
    // 🎯 LOG DI DEBUG CRITICO: Controlla il tipo
    console.log(`[STATUS] Tetto GUI - Label: ${enumLabel} | Disabled: ${isDisabled}`);
    console.log("[DEBUG] Oggetto button in updateRoofUI:", button); 
    console.log(`[DEBUG UI] Stato estratto: ${serverState} (Tipo: ${typeof serverState})`);

    // Dopo questo log, la variabile è garantita essere una stringa (grazie a || '')
    // e il codice non dovrebbe bloccarsi qui sotto:
    
    // 2. Logica di determinazione della classe
    //console.log(serverState);
    let newClass = 'status-default';
    if (serverState === 'ROOF_CLOSED') newClass = 'status-closed';
    else if (serverState === 'ROOF_OPENED') newClass = 'status-open';
    // ✅ ORA serverState è una stringa, e includes() funziona    
    else if (serverState.includes('ROOF_CLOSING') || serverState.includes('ROOF_OPENING')) newClass = 'status-transition';
    else if (serverState === 'ROOF_ERROR' || serverState === 'ROOF_DANGER' || serverState === 'ERROR') newClass = 'status-error';


    // Rimuovi TUTTE le classi di stato precedenti
    button.classList.remove('status-closed', 'status-open', 'status-error', 'status-default');

    // 4. Aggiornamento UI
    button.textContent = buttonText;
    console.log(`[UI] Aggiornamento UI: Testo='${buttonText}', Classe='${newClass}', Disabilitato=${isDisabled}`);
    button.classList.add(newClass);
    button.disabled = isDisabled;
    
    button.style.backgroundColor = '';
    button.style.color = ''; 
    // 🎯 Stile guidato dal server (se implementato)
    if (newClass !== 'status-transition' && gui.button_color) {
        button.style.backgroundColor = gui.button_color.background_color;
        button.style.color = gui.button_color.text_color;
    }
    console.log("[UI] Aggiornamento UI tetto completato.");
}


/** Avvia il polling periodico dello stato. */
function startRoofStatusPolling(button) {
    const POLL_INTERVAL_MS = 3000;
    
    console.log(`[POLL] Avvio polling stato tetto ogni ${POLL_INTERVAL_MS}ms`);
    
    const poll = () => {
        getRoofStatus()
            .then(data => {
                updateRoofUI(data, button); 
            })
            .finally(() => {
                setTimeout(poll, POLL_INTERVAL_MS);
            });
    };

    poll();
}

// =========================================================================
// INIZIALIZZAZIONE
// =========================================================================

export function initRoofControl() {
    const roofButton = document.getElementById('btn-tetto');
        
    if (!roofButton) {
        console.error("Elemento del Tetto (#btn-tetto ) non trovato.");
        return; 
    }
    
    // 1. Carica lo stato iniziale e avvia il polling (aggiorna l'UI)
    getRoofStatus()
        .then(initialData => {
            updateRoofUI(initialData, roofButton);
            startRoofStatusPolling(roofButton);
        });

    // 2. Listener del Click
    roofButton.addEventListener('click', (event) => {
        if (roofButton.disabled) {
            console.warn("Pulsante Tetto disabilitato, click ignorato.");
            return;
        }
        else {
            console.log("Pulsante Tetto cliccato.");
        }

        // DEDUZIONE DELLO STATO: Leggiamo la classe per dedurre lo stato del server
        const currentState = lastKnownRoofState; 
    
    // Mappa lo stato tecnico all'azione richiesta (es. ROOF_CLOSED -> OPEN)
        const commandToSend = ROOF_STATE_TO_ACTION_MAP[currentState]; 

        console.log(`[CLICK] Stato dedotto dal server: ${currentState}, Comando da inviare: ${commandToSend}`);
        
        if (!commandToSend) {
            console.warn(`Stato: ${currentState}. Comando non inviabile.`);
            return; 
        }
        
        roofButton.disabled = true;

        sendRoofCommand(commandToSend)
            // ...
    });

}

// 3. Avvio del modulo
document.addEventListener('DOMContentLoaded', initRoofControl);