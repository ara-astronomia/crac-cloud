/**
 * Aggiorna lo stato, il testo e i colori di un singolo pulsante dell'interfaccia.
 * @param {object} guiItem - L'oggetto GUI specifico per il pulsante (da server).
 * @param {HTMLElement} button - L'elemento DOM del pulsante.
 * @param {string} telescopeStatus - Lo stato globale del telescopio (es. 'PARKED', 'TRACKING').
 */
export function updateSingleButtonUI(guiItem, button, telescopeStatus) {
    console.log('chiamata updateSingleButton in utils.js')
    let newClass = 'status-default';
    if (telescopeStatus.includes('SLEWING') || 
        telescopeStatus.includes('MOVING') || 
        telescopeStatus.includes('UNPARKING') /* se esiste */ ) 
    {
        newClass = 'status-transition';
    } 
    // 1. Estrazione, Inizializzazione e Stato Disabled
    const enumLabel = guiItem.label || "DEFAULT_LABEL";
    
    // ✅ FIX: Inizializza buttonText con un valore di default sicuro
    // Non usare più labelData che causa il ReferenceError
    let buttonText;
    if (enumLabel === 'LABEL_PARK') {
        buttonText = "Park";
    } else if (enumLabel === 'LABEL_FLAT') {
        buttonText = "Flat";
    } else {
        // Fallback per altri elementi GUI se questa funzione dovesse gestirli
        buttonText = enumLabel;
    }
    
    // Usa il valore passato da updateTelescopeUI
    const isDisabled = guiItem.is_disabled; 

    // Pulisci stili CSS di stato precedenti
    button.classList.remove('status-success', 'status-failure', 'status-transition', 'status-moving');
    // 🛑 Pulisci anche stili inline che verranno sovrascritti
    button.style.backgroundColor = '';
    button.style.color = '';
    
    let useServerColor = true; // Assumi di voler usare il colore del server
    console.log(`stato del telescopio e del button :${telescopeStatus} , ${button.id}`) // Aggiunto .id

    // 2. LOGICA CRITICA STATI FINALI/OVERRIDE (Verde/Successo)
    if (button.id === 'btn-park' && telescopeStatus === 'PARKED') {        
        button.classList.add('status-success');
        buttonText = "Parked"; // ✅ Aggiorna il testo qui
        useServerColor = false; 
    } else if (button.id === 'btn-flat' && telescopeStatus === 'FLATTER') {
        button.classList.add('status-success');
        buttonText = "Flatter"; // ✅ Aggiorna il testo qui
        useServerColor = false; 
    } 
    
    // 3. APPLICAZIONE DEGLI STILI INLINE (Dati diretti dal Server)
    const colorData = guiItem.button_color; 
    
    if (useServerColor && colorData) {
        // Applica i colori esatti inviati dal server
        button.style.backgroundColor = colorData.background_color;
        button.style.color = colorData.text_color;
    }
    
    // 4. Aggiornamento UI
    // ✅ Usa la variabile buttonText aggiornata qui
    button.textContent = buttonText; 
    
    // ⚠️ Usa l'is_disabled passato dalla chiamata esplicita
    // button.disabled = isDisabled; 
}