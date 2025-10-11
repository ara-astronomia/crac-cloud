// File: /static/js/buttons.js

// Dipendenze: Necessita delle funzioni sendPostRequest e fetchStatus definite in script.js

// === 1. LOGICA DI AGGIORNAMENTO GUI DEI PULSANTI ===
// (Funzione per applicare i dati della risposta gRPC al pulsante HTML)
function applyButtonGui(buttonElement, guiData) {
    if (buttonElement && guiData) {
        //console.log(`Aggiornamento GUI per ${buttonElement.id}:`, guiData);
        // Aggiorna l'Etichetta (traduzione da ENUM a italiano)
        if (guiData.label === 'LABEL_ON') {
            buttonElement.textContent = 'Acceso';
        } else if (guiData.label === 'LABEL_OFF') {
            buttonElement.textContent = 'Spento';
        } 
        // Aggiungi qui altre label specifiche per il telescopio/connessione se necessario
        
        // Aggiorna i Colori
        if (guiData.button_color) {
            //console.log(`Aggiornamento colori per ${buttonElement.id}:`, guiData.button_color);
            buttonElement.style.setProperty(
                'background-color', 
                guiData.button_color.background_color, 
                'important'
            );
            buttonElement.style.setProperty(
                'color', 
                guiData.button_color.text_color, 
                'important'
            );
        }

        // Aggiorna lo stato Disabilitato
        buttonElement.disabled = guiData.is_disabled; 
        buttonElement.dataset.status = guiData.label === 'LABEL_ON' ? 'ON' : 'OFF';
    }
}

// === 2. GESTIONE DEI LISTENER (CLICK) ===
function setupButtonListeners() {
    
    // Elenco degli interruttori e dei loro ID HTML
    const buttonMap = [
        { id: 'btn-tele-switch', key: 'KEY_TELE_SWITCH', action: 'TURN_ON' }, 
        { id: 'btn-ccd-switch', key: 'KEY_CCD_SWITCH', action: 'TURN_ON' },
        { id: 'btn-flat-light', key: 'KEY_FLAT_LIGHT', action: 'TURN_ON' },
        { id: 'btn-dome-light', key: 'KEY_DOME_LIGHT', action: 'TURN_ON' },
        { id: 'btn-park', key: 'KEY_PARK', action: 'BUTTON_DEFAULT_ACTION' },
        { id: 'btn-flat', key: 'KEY_FLAT', action: 'BUTTON_DEFAULT_ACTION' }
        // Aggiungi qui 'btn-conn-telescopio' con type 'TELESCOPE_CONNECT' se gestito qui
    ];

    buttonMap.forEach(buttonInfo => {
        const btn = document.getElementById(buttonInfo.id);
        //console.log(`Setup listener per ${buttonInfo.id}`);
        if (btn) {
            btn.addEventListener('click', async () => {
                // VERIFICA DI SICUREZZA: Controlla che sendPostRequest esista!
                //console.log(`[JS DEBUG] Invia POST per Key: ${buttonInfo.key}, Action: ${buttonInfo.action}`);
                if (typeof sendPostRequest !== 'function') {
                    console.error("sendPostRequest non è definito. Controlla l'ordine degli script.");
                    return; // Blocca l'esecuzione del listener in caso di errore
                }
                try {
                const response = await sendPostRequest('/buttons/set_action', {
                    key: buttonInfo.key,       // Es: 'KEY_CCD_SWITCH' o 'KEY_PARK'
                    action: buttonInfo.action  // Es: 'TURN_ON' o 'BUTTON_DEFAULT_ACTION'
                });

                // AGGIORNAMENTO ISTANTANEO
                /*if (response && response.button_gui) {
                    console.log(`[JS] Aggiornamento Immediato: Stato finale ricevuto: ${response.button_gui.label}`);
                    applyButtonGui(btn, response.button_gui); 
                } else {
                    console.warn("Risposta server OK, ma dati GUI mancanti o formato errato.");
               }*/  
                } catch (error) {
                    console.error("Errore nell'invio della richiesta POST:", error);
                }
            });
        }
    });    
}

// === 3. AGGIORNAMENTO DI STATO NEL LOOP ===
async function updateButtonStatuses() {
    if (typeof fetchStatus !== 'function') {
        console.error("fetchStatus non è definito.");
        return;
    }
    //console.log("Aggiornamento stato pulsanti in corso...");
    // ⚠️ L'endpoint ora restituisce {buttons: [{key:..., status:...}]}
    const response = await fetchStatus('/buttons/status');
    //console.log("Aggiornamento stato pulsanti in corso...");
    const buttonsStatus = response ? response.buttons : null; // Estrai la lista
    //console.log("Stato pulsanti ricevuto:", buttonsStatus);

    if (buttonsStatus && Array.isArray(buttonsStatus)) {
        buttonsStatus.forEach(button => {
            
            // 💡 Trova l'ID HTML usando la CHIAVE (non il TIPO)
            console.log("Stato pulsanti ricevuto:", buttonsStatus);

    if (buttonsStatus && Array.isArray(buttonsStatus)) {
        buttonsStatus.forEach(button => {
            
            // 💡 Trova l'ID HTML usando la CHIAVE (non il TIPO)
            let rawKey = button.key.toLowerCase(); 
            let cleanKey = rawKey.replace('key_', '').replace(/_/g, '-'); 
            let btnId = 'btn-' + cleanKey; 
            const btn = document.getElementById(btnId);
            //console.log(`Aggiornamento stato per ${btnId}:`, button);
            
            if (btn) {                
                if (button.button_gui) { 
                    applyButtonGui(btn, button.button_gui);
                }
            }
        });
    }
        });
    }
}
