// telescope_control.js

import { updateSingleButtonUI } from './ui_utils.js'; // ✅ Importazione

let isCommandPending = false; 
let lastKnownTelescopeState = 'DISCONNECTED'; // Stato globale
import { 
    STATUS_LABELS_MAP, 
    BUTTON_KEY_MAP,
    TELESCOPE_ACTION_MAP
} from './gui_constants.js'; 

// 🎯 Wrapper attorno all'API globale (come in roof_control.js)
function sendTelescopeCommand(actionCommand) {
    const endpoint = '/telescope/set_action';
    console.log(`[POST T] Invio POST a ${endpoint} con azione: ${actionCommand}`);
    // Accesso all'API globale definita in script.js
    return window.sendPostRequest(endpoint, { action: actionCommand }); 
}

// 🎯 Wrapper per lo stato globale
function getTelescopeStatus() {
    return window.fetchStatus('/telescope/status');
}
let pollingTimer = null;
const POLLING_INTERVAL = 2000; // Aggiornamento ogni 3 secondi (o il tuo valore preferito)

/**
 * Avvia il ciclo di polling per lo stato del telescopio.
 * Usa try...catch per evitare che errori di rete o API blocchino il timer.
 */
export function startTelescopePolling() {
    console.log("Avvio del polling telescopio...");
    
    const poll = async () => {
        try {
            // 🎯 PUNTO CHIAVE: Chiama l'API per ottenere lo stato
            const statusData = await getTelescopeStatus(); 
            
            // Se ha successo: Aggiorna l'interfaccia con i dati reali
            updateTelescopeUI(statusData); 

        } catch (error) {
            // 🛑 GESTIONE DELL'ERRORE: Se l'API fallisce (timeout, 500, ecc.)
            console.error("Errore durante il polling dello stato del telescopio. Il server potrebbe essere irraggiungibile.", error);
        }

        // 🎯 Riavvia il timer SEMPRE, anche in caso di fallimento del 'try'
        pollingTimer = setTimeout(poll, POLLING_INTERVAL);
    };

    // Avvia il ciclo per la prima volta
    pollingTimer = setTimeout(poll, POLLING_INTERVAL);
}

/**
 * Ferma il ciclo di polling.
 */
export function stopTelescopePolling() {
    clearTimeout(pollingTimer);
    console.log("Polling telescopio interrotto.");
}

// telescope_control.js (Modifica di initTelescopeControl)

export function initTelescopeControl() {
   // Mappa tutti gli ID dei pulsanti (Connessione, Park, Flat)
    const buttonIds = Object.values(BUTTON_KEY_MAP); 
    
    buttonIds.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        console.log(`[INIT T] Configuro listener per pulsante: ${buttonId}`, button);
        
        if (buttonId === 'btn-park') {
        // Assegna l'azione fissa all'avvio
        button.dataset.action = TELESCOPE_ACTION_MAP['PARK_ACTION']; 
        } else if (buttonId === 'btn-flat') {
            // Assegna l'azione fissa all'avvio
            button.dataset.action = TELESCOPE_ACTION_MAP['FLAT_ACTION'];
        } 

        button.addEventListener('click', () => {
        const actionCommand = button.dataset.action;
        console.log(actionCommand) 
        
        // La logica di controllo qui
        if (!actionCommand) {
            // Questo ora si verificherà SOLO per 'btn-conn-telescopio' prima del primo polling
            console.warn(`[Telescope] Pulsante ${buttonId} cliccato ma actionCommand mancante.`);
            return;
        }
        
        console.log(`[CLICK DEBUG] Comando bypassato e inviato: ${actionCommand}`);
        sendAndDisable(button, actionCommand);
    });
    });
    // ✅ NUOVA SEZIONE: GESTIONE CHECKBOX AUTOLIGHT
    // -----------------------------------------------------
    const autolightCheckbox = document.getElementById('Autolight');
    const ACTION_CHECK_TELESCOPE = 'CHECK_TELESCOPE'; // Azione placeholder

    if (autolightCheckbox) {
        autolightCheckbox.addEventListener('change', () => {
            const autolightValue = autolightCheckbox.checked; // true o false
            const actionCommand = ACTION_CHECK_TELESCOPE;
            
            console.log(`[AUTOLIGHT] Inviata azione: ${actionCommand}, Valore: ${autolightValue}`);

            // Richiama la funzione di invio, ma DEVI MODIFICARE sendAndDisable
            // per accettare anche il payload 'autolight'. 
            
            // Dato che sendAndDisable non accetta parametri extra, dobbiamo
            // usare una nuova funzione o inviare direttamente il POST qui.
            
            // Usiamo una funzione diretta per semplicità, replicando l'invio corretto:
            
            // 🛑 Necessiti della funzione sendPostRequest che accetta il payload:
            if (typeof sendPostRequest !== 'function') {
                console.error("sendPostRequest non è definito.");
                return;
            }

            // Invio POST all'endpoint del telescopio!
            sendPostRequest('/telescope/set_action', {
                action: actionCommand,
                autolight: autolightValue // ✅ Payload corretto per l'endpoint /telescope/set_action
            })
            .then(response => {
                console.log(`[AUTOLIGHT] Comando inviato con successo.`);
                // Il polling aggiornerà lo switch Luce Cupola
            })
            .catch(error => {
                console.error("[AUTOLIGHT] Errore POST:", error);
                // Ripristino visivo in caso di fallimento della comunicazione
                autolightCheckbox.checked = !autolightValue; 
            });
        });
    }


    console.log("Listener dei pulsanti del telescopio configurati.");
    const connButton = document.getElementById('btn-conn-telescopio');
    const parkButton = document.getElementById('btn-park'); 
    const flatButton = document.getElementById('btn-flat'); 
    if (connButton) {
        // 🎯 Stato di default: ROSSO / Disconnesso / Abilitato
        connButton.disabled = false; // ABILITA il pulsante (pronto al click)
        connButton.style.backgroundColor = 'red';
        connButton.textContent = 'Disconnesso';
        
        // 🎯 Imposta l'azione iniziale per risolvere il 422 al primo click
        connButton.dataset.action = TELESCOPE_ACTION_MAP['DISCONNECTED']; 
    }
    
    // 🎯 Imposta lo stato iniziale per Park/Flat (Se non connesso, devono essere disabilitati)
    if (parkButton) {
        parkButton.disabled = true; // PARK è disabilitato se DISCONNECTED
    }
    if (flatButton) {
        flatButton.disabled = true; // PARK è disabilitato se DISCONNECTED
    }

    startTelescopePolling(); 
}
// 🎯 NUOVA FUNZIONE HELPER: Per gestire l'invio e il blocco in modo pulito
export function sendAndDisable(button, actionCommand) {
    console.log(`[CLICK T] Eseguo l'azione: ${actionCommand}`);
    console.log(`[TRANSITION] Pulsante ${button.id} -> ARANCIONE/TRANSITION`);
    button.disabled = true; 
    button.classList.remove('status-success', 'status-failure');
    button.className = 'status-button status-transition'; // Classe di transizione
    isCommandPending = true;
    sendTelescopeCommand(actionCommand) // QUESTA FUNZIONE È CORRETTA NELLA SUA DEFINIZIONE
        .then(response => {
            console.log("Comando Telescopio inviato con successo:", actionCommand);
            // Aggiorna UI e riabilita
            updateTelescopeUI(response);
            button.disabled = false; // ✅ Riabilitazione in caso di successo
        })
        .catch(error => {
            console.error("Errore POST Telescopio:", error);
            // 🎯 FIX CRITICO: Riabilita il pulsante anche in caso di errore
            isCommandPending = false; 
            button.disabled = false; 
            // Mostra un errore chiaro (l'utente deve sapere che la disconnessione è fallita)
            alert(`Impossibile disconnettere (Errore: ${error.message}).`);
        })
        .finally(() => {
            // L'UI si affida al polling per riabilitare
        });
}
// Funzione helper per applicare lo stato/colore/testo a una label (utilizza STATUS_LABELS_MAP)
const applyLabelStatus = (elementId, statusKey) => {
    const label = document.getElementById(elementId);
    if (!label) return;

    const statusData = STATUS_LABELS_MAP[statusKey];
    console.log(`[LABEL] Aggiorno ${elementId} con stato ${statusKey}:`, statusData);
    if (!statusData) return;
    
    // Aggiorna testo e colore
    label.textContent = statusData.text;
    label.style.backgroundColor = statusData.background_color || '';
    label.style.color = statusData.text_color || '';
};

/** Aggiorna l'interfaccia utente in base alla risposta completa del server. */
function updateTelescopeUI(serverStatusData) { 
    
    // 🛑 1. PROTEZIONE INIZIALE E DEFINIZIONE VARIABILI GLOBALI 🛑
    if (!serverStatusData || Object.keys(serverStatusData).length === 0) {
        console.warn("Dati di stato del server mancanti o vuoti.");
        return; 
    } else {
        console.log("[UI T] Dati di stato ricevuti:", serverStatusData);
    }
    const telescopeStatus = serverStatusData.status; 
    lastKnownTelescopeState = serverStatusData.status; // Aggiorna lo stato globale
    const stableStates = ['PARKED', 'TRACKING', 'FLATTER']; 
    if (isCommandPending && stableStates.includes(telescopeStatus)) {
        isCommandPending = false;
        console.log('[DEBUG] Comando completato. Rilevato stato stabile: ' + telescopeStatus);
    }
    
    const serverState = serverStatusData.status || 'DISCONNECTED'; // STATO REALE
    console.log(`[UI T] Stato telescopio attuale: ${serverState}`);
    const guiList = serverStatusData.buttons_gui || []; 
   
    // Riferimenti ai pulsanti e alle label (Definizione all'inizio!)
    const connButton = document.getElementById(BUTTON_KEY_MAP['KEY_TELESCOPE_CONNECTION_TOGGLE']);
    const parkButton = document.getElementById(BUTTON_KEY_MAP['KEY_PARK']);
    const flatButton = document.getElementById(BUTTON_KEY_MAP['KEY_FLAT']);
    
    const ALT_LABEL_ID = 'lbl_status_altezza_telescopio';
    const AZ_LABEL_ID = 'lbl_status_azimuth_telescopio';
    
    // Determina se il telescopio è in uno stato operativo (Cruciale per i pulsanti)
    const isTelescopeConnected = (
        serverState !== 'DISCONNECTED' && 
        serverState !== 'ERROR' && 
        serverState !== 'CRITICAL_ERROR' &&
        serverState !== 'LOST'
        // Aggiungi qui altri stati non-operativi se necessario
    );
    console.log(`[UI T] isTelescopeConnected: ${isTelescopeConnected}`);

    
    // ----------------------------------------------------------------------
    // A. GESTIONE ESCLUSIVA DEL PULSANTE DI CONNESSIONE (VERDE/ROSSO/ABILITATO)
    // ----------------------------------------------------------------------
    
    if (connButton) {
        connButton.disabled = false; // 🎯 RIABILITA SEMPRE
                // 🎯 NUOVA LOGICA DI PULIZIA AGGRESSIVA:
        connButton.classList.remove(
            'status-failure', 
            'status-stopped',
            'status-transition', 
            'status-success', 
            'status-closed');
        
            console.log(`[UI T] Pulsante connessione pulito. Stato attuale: ${serverState}`);
        
        if (isTelescopeConnected) {
            // console.log(`[DEBUG UI] ENTRO in isTelescopeConnected. Stato: ${serverState}`); 
            connButton.classList.add('status-success'); 
            connButton.textContent = 'Disconnetti'; 
            connButton.dataset.action = TELESCOPE_ACTION_MAP['CONNECTED'];
            
            // Abilita Park/Flat (Se connesso, sono operativi)
            if (parkButton) parkButton.disabled = false;
            if (flatButton) flatButton.disabled = false;
            
        } else {
            // ROSSO / Disconnesso o Errore
            connButton.classList.add('status-failure'); 
            connButton.textContent = 'Connetti'; 
            connButton.dataset.action = TELESCOPE_ACTION_MAP['DISCONNECTED'];
            
            // Disabilita Park/Flat
            if (parkButton) parkButton.disabled = true;
            if (flatButton) flatButton.disabled = true;
        }
    }
    // --- AGGIORNAMENTO STATO FLAT (Usa updateSingleButtonUI) ---
    if (parkButton) {
        const parkGuiItem = {
            label: 'LABEL_PARK',
            is_disabled: parkButton.disabled 
        };
        
        // ✅ CHIAMATA ALLA FUNZIONE MODULARE
        updateSingleButtonUI(parkGuiItem, parkButton, telescopeStatus);
    }

    // --- AGGIORNAMENTO STATO FLAT (Usa updateSingleButtonUI) ---
    if (flatButton) {
            const flatGuiItem = {
            label: 'LABEL_FLAT',
            is_disabled: flatButton.disabled
        };
        
        // ✅ CHIAMATA ALLA FUNZIONE MODULARE
        updateSingleButtonUI(flatGuiItem, flatButton, telescopeStatus);
    }
    // ----------------------------------------------------
    // C. AGGIORNAMENTO ETICHETTE (LABELS: Coordinate, Tracking)
    // ----------------------------------------------------

    // 1. Dati Tracking/Slewing/Status
    const currentSpeed = serverStatusData.speed || 'SPEED_NOT_TRACKING';
    
    let trackingKey = 'TELESCOPE_TRACKING_OFF';
    let slewingKey = 'TELESCOPE_SLEWING_OFF';

    if (currentSpeed === 'SPEED_TRACKING') {
        trackingKey = 'TELESCOPE_TRACKING_ON';
    } else if (currentSpeed === 'SPEED_SLEWING') {
        slewingKey = 'TELESCOPE_SLEWING_ON';
    }
    
    // Applicazione dello Stato
    applyLabelStatus('lbl_status_tracking', trackingKey);
    applyLabelStatus('lbl_status_slewing', slewingKey);
    applyLabelStatus('lbl_status_connect', `TELESCOPE_${serverState}`); // Stato generale (es. TELESCOPE_WEST)

    
    // 2. Dati di Coordinate (Alt/Az) - RISOLVE L'ERRORE DELLE LABEL
    const altLabel = document.getElementById(ALT_LABEL_ID);
    const azLabel = document.getElementById(AZ_LABEL_ID);
    const altCoords = serverStatusData.aa_coords; 

    if (altCoords && altLabel && azLabel) {
        const altValue = altCoords.alt;
        const azValue = altCoords.az;

        altLabel.textContent = altValue !== undefined 
            ? `${altValue.toFixed(2)}°` 
            : 'N/A';

        azLabel.textContent = azValue !== undefined 
            ? `${azValue.toFixed(2)}°` 
            : 'N/A';
            
    } else {
        if (altLabel) altLabel.textContent = 'N/A';
        if (azLabel) azLabel.textContent = 'N/A';
    }
}

window.updateTelescopeUI = updateTelescopeUI;
window.getTelescopeStatus = getTelescopeStatus;
window.initTelescopeControl = initTelescopeControl;