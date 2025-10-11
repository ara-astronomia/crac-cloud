// telescope_control.js
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

// telescope_control.js (Modifica di initTelescopeControl)

export function initTelescopeControl() {
   // Mappa tutti gli ID dei pulsanti (Connessione, Park, Flat)
    const buttonIds = Object.values(BUTTON_KEY_MAP); 
    
    buttonIds.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        
        if (!button) {
            console.error(`Pulsante ID:${buttonId} non trovato per l'inizializzazione.`);
            return;
        }

        button.addEventListener('click', () => {
            const actionCommand = button.dataset.action; // Legge l'azione popolata in updateTelescopeUI
            
            if (button.disabled) {
                console.warn(`BLOCCO: Pulsante ${buttonId} disabilitato. Stato corrente: ${lastKnownTelescopeState}.`);
                return;
            }
            
            if (!actionCommand) {
                console.warn(`[Telescope] Pulsante ${buttonId} cliccato ma actionCommand mancante dal server/mappa.`);
                return;
            }

            // Esegue l'azione letta da button.dataset.action
            sendAndDisable(button, actionCommand);
        });
    const connButton = document.getElementById('btn-conn-telescopio');
    const parkButton = document.getElementById(BUTTON_KEY_MAP['KEY_PARK']); // Esempio: se KEY_PARK è la chiave
    const flatButton = document.getElementById(BUTTON_KEY_MAP['KEY_FLAT']); // Esempio: se KEY_FLAT è la chiave 
    if (connButton) {
        // 🎯 Stato di default: ROSSO / Disconnesso / Abilitato
        connButton.disabled = false; // ABILITA il pulsante (pronto al click)
        connButton.style.backgroundColor = 'red';
        connButton.textContent = 'Disconnesso';
        
        // 🎯 Imposta l'azione iniziale per risolvere il 422 al primo click
        // lastKnownTelescopeState è 'DISCONNECTED' per default
        connButton.dataset.action = TELESCOPE_ACTION_MAP['DISCONNECTED']; 
    }
    
    // 🎯 Imposta lo stato iniziale per Park/Flat (Se non connesso, devono essere disabilitati)
    if (parkButton) {
        parkButton.disabled = true; // PARK è disabilitato se DISCONNECTED
    }
    if (flatButton) {
        flatButton.disabled = true; // PARK è disabilitato se DISCONNECTED
    }
    });
    
    // 🛑 AVVIA IL POLLING QUI 🛑
    //startTelescopePolling(); 
}
// 🎯 NUOVA FUNZIONE HELPER: Per gestire l'invio e il blocco in modo pulito
function sendAndDisable(button, actionCommand) {
    console.log(`[CLICK T] Eseguo l'azione: ${actionCommand}`);
    button.disabled = true; 
    
    sendTelescopeCommand(actionCommand) // QUESTA FUNZIONE È CORRETTA NELLA SUA DEFINIZIONE
        .then(response => {
            console.log("Comando Telescopio inviato con successo:", actionCommand);
        })
        .catch(error => {
            alert(`Errore nell'azione ${actionCommand}. Controlla la console.`);
            console.error("Errore POST Telescopio:", error);
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
    if (!statusData) return;
    
    // Aggiorna testo e colore
    label.textContent = statusData.text;
    label.style.backgroundColor = statusData.background_color || '';
    label.style.color = statusData.text_color || '';
};

/** Aggiorna l'interfaccia utente in base alla risposta completa del server. */
function updateTelescopeUI(serverStatusData) { 
    if (!serverStatusData) return; 
    
    lastKnownTelescopeState = serverStatusData.status; 
    const guiList = serverStatusData.buttons_gui || []; 
    const ALT_LABEL_ID = 'lbl_status_altezza_telescopio';
    const AZ_LABEL_ID = 'lbl_status_azimuth_telescopio';

    // A. AGGIORNAMENTO PULSANTI
    guiList.forEach(guiItem => {
        
        // 🎯 USA LA MAPPA IMPORTATA BUTTON_KEY_MAP
        const buttonId = BUTTON_KEY_MAP[guiItem.key]; 
        const button = document.getElementById(buttonId);
        
        if (!button) return; 

        // Testo del Pulsante (Recupero da STATUS_LABELS_MAP)
        const enumLabel = guiItem.label || "LABEL_DEFAULT"; 
        const buttonTextData = STATUS_LABELS_MAP[enumLabel];
        
        button.textContent = buttonTextData ? buttonTextData.text : enumLabel;
        
        // STATO DISABLED
        const isDisabled = guiItem.is_disabled !== undefined ? guiItem.is_disabled : true; 
        button.disabled = isDisabled;
        
        // Colori del Pulsante (Guida da Server)
        if (guiItem.button_color) {
            button.style.backgroundColor = guiItem.button_color.background_color;
            button.style.color = guiItem.button_color.text_color;
        } else {
            button.style.backgroundColor = '';
            button.style.color = '';
        }
        
        if (guiItem.key === "KEY_TELESCOPE_CONNECTION_TOGGLE") {
            // Forza l'uso della mappa locale per garantire che l'azione non sia mai vuota
            button.dataset.action = TELESCOPE_ACTION_MAP[lastKnownTelescopeState]; 
            
        } else if (guiItem.metadata) {
            // Per gli altri pulsanti (Park/Flat), usiamo l'azione fornita dal server
            button.dataset.action = guiItem.metadata; 
        } else {
            // Fallback: Se non c'è azione, usiamo la chiave per non inviare un payload vuoto
            button.dataset.action = guiItem.key; 
        }; 
    });

    // B. AGGIORNAMENTO TRACKING e SLEWING (Sostituisce la logica STATUS_COLORS)
    const currentSpeed = serverStatusData.speed || 'SPEED_NOT_TRACKING';
    let trackingKey; 
    let slewingKey;
    
    if (currentSpeed === 'SPEED_TRACKING') {
        trackingKey = 'TELESCOPE_TRACKING_ON';
        slewingKey = 'TELESCOPE_SLEWING_OFF';
    } else if (currentSpeed === 'SPEED_SLEWING') {
        trackingKey = 'TELESCOPE_TRACKING_OFF';
        slewingKey = 'TELESCOPE_SLEWING_ON';
    } else {
        trackingKey = 'TELESCOPE_TRACKING_OFF';
        slewingKey = 'TELESCOPE_SLEWING_OFF';
    }

    // --- 🎯 INIZIO AGGIORNAMENTO COORDINATE ALT/AZ 🎯 ---

    const altLabel = document.getElementById(ALT_LABEL_ID);
    const azLabel = document.getElementById(AZ_LABEL_ID);
    
    // 1. Estrazione dei dati
    const altCoords = serverStatusData.aa_coords; 
    // Usa la funzione helper basata su STATUS_LABELS_MAP
    applyLabelStatus('lbl_status_tracking', trackingKey);
    applyLabelStatus('lbl_status_slewing', slewingKey);
    
    // C. AGGIORNAMENTO STATO GENERALE
    const currentStatus = serverStatusData.status || 'DISCONNECTED';
    const statusKey = `TELESCOPE_${currentStatus}`; 
    
    
    // Usa la funzione helper basata su STATUS_LABELS_MAP
    applyLabelStatus('lbl_status_connect', statusKey); 
    if (altCoords && altLabel && azLabel) {
        
        const altValue = altCoords.alt;
        const azValue = altCoords.az;

        // 2. Formattazione e Visualizzazione (Usando 2 cifre decimali)
        // L'operatore .toFixed() converte il numero in una stringa con il numero di cifre specificato.
        
        altLabel.textContent = altValue !== undefined 
            ? `${altValue.toFixed(2)}°` 
            : 'N/A'; // Se il valore è mancante

        azLabel.textContent = azValue !== undefined 
            ? `${azValue.toFixed(2)}°` 
            : 'N/A'; // Se il valore è mancante
            
        // Opzionale: Se vuoi distinguere l'azimut cardinale, potresti aggiungere:
        // azLabel.title = translateAzimuthToCardinal(azValue); // Richiede una funzione helper

    } else {
        // Se i dati non sono presenti (es. telescopio disconnesso), mostra N/A
        if (altLabel) altLabel.textContent = 'N/A';
        if (azLabel) azLabel.textContent = 'N/A';
    }

    // --- FINE AGGIORNAMENTO COORDINATE ALT/AZ ---

    // ... (il resto della funzione, come il loop per i pulsanti) ...
 
}
window.updateTelescopeUI = updateTelescopeUI;
window.getTelescopeStatus = getTelescopeStatus;
// Assegna anche la funzione principale di inizializzazione, se non lo fai già
window.initTelescopeControl = initTelescopeControl;