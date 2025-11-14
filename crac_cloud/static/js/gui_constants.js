export const STATUS_LABELS_MAP = {
    "NO_ALERT":{text:"Nessun errore riscontrato", text_color: "green", background_color: "white"},
    "ALERT_TELESCOPE_LOST":{text: "Connessione con il telescopio persa", text_color: "white", background_color: "red"},
    "ALERT_TELESCOPE_ERROR":{text: "Errore del telescopio", text_color: "white", background_color: "red"},
    "ALERT_CHECK_CURTAINS_SWITCH":{text: "Controllare switch tende - ricalibrazione", text_color: "white", background_color: "red"},
    "ALERT_CRAC_ANOMALY":{text:"Anomalia CRaC: stato invalido dei componenti", text_color: "white", background_color: "red"},
    "ALERT_TELESCOPE_ROOF":{text:"Attenzione, Telescopio vicino al tetto", text_color: "white", background_color: "red"},
    "ALERT_TELESCOPE_ROOF_CLOSING":{text: "Attenzione, Telescopio non in park e tetto in chiusura", text_color: "white", background_color: "red"},
    "ALERT_TELESCOPE_OPERATIVE":{text: "Attenzione telescopio operativo: {status}", text_color: "white", background_color: "red"},
    "ALERT_CURTAINS_ENABLED":{text: "Attenzione tende aperte", text_color: "white", background_color: "red"},
    "ALERT_ROOF_CLOSED":{text: "Attenzione tetto chiuso", text_color: "white", background_color: "red"},
    "CURTAIN_DISABLED":{text: "Disattivata", text_color: "black", background_color: "white"},
    "CURTAIN_CLOSED":{text: "Chiusa", text_color: "red", background_color: "white"},
    "CURTAIN_STOPPED":{text: "Ferma", text_color: "red", background_color: "white"},
    "CURTAIN_OPENED":{text: "Aperta", text_color: "green", background_color: "white"},
    "CURTAIN_ERROR":{text: "Errore", text_color: "red", background_color: "white"},
    "CURTAIN_DANGER":{text: "Pericolo", text_color: "white", background_color: "red"},
    "CURTAIN_OPENING":{text: "Apertura", text_color: "orange", background_color: "white"},
    "CURTAIN_CLOSING":{text: "Chiusura", text_color: "orange", background_color: "white"},
    "CURTAIN_DISABLING":{text: "Disattivazione", text_color: "black", background_color: "white"},
    "TELESCOPE_PARKED":{text: "Parked", text_color: "green", background_color: "white"},
    "TELESCOPE_FLATTER":{text: "Flatter", text_color: "green", background_color: "white"},
    "TELESCOPE_SECURE":{text: "In Sicurezza", text_color: "green", background_color: "white"},
    "TELESCOPE_SYNC_OFF":{text: "No Sync", text_color: "black", background_color: "white"},
    "TELESCOPE_SYNC_ON":{text: "Sync On", text_color: "green", background_color: "white"},
    "TELESCOPE_NORTHEAST":{text: "NordEst", text_color: "green", background_color: "white"},
    "TELESCOPE_EAST":{text: "Est", text_color: "green", background_color: "white"},
    "TELESCOPE_SOUTHEAST":{text: "SudEst", text_color: "green", background_color: "white"},
    "TELESCOPE_SOUTHWEST":{text: "SudOvest", text_color: "green", background_color: "white"},
    "TELESCOPE_WEST":{text: "Ovest", text_color: "green", background_color: "white"},
    "TELESCOPE_NORTHWEST":{text: "NordOvest", text_color: "green", background_color: "white"},
    "TELESCOPE_ANOMALY":{text: "Anomalia", text_color: "red", background_color: "white"},
    "TELESCOPE_ERROR":{text: "Errore", text_color: "red", background_color: "white"},
    "TELESCOPE_TRACKING_ON":{text: "Track On", text_color: "green", background_color: "white"},
    "TELESCOPE_TRACKING_OFF":{text: "Track Off", text_color: "black", background_color: "white"},
    "TELESCOPE_SLEWING_ON":{text: "Slewing On", text_color: "green", background_color: "white"},
    "TELESCOPE_SLEWING_OFF":{text: "Slewing Off", text_color: "black", background_color: "white"},
    "TELESCOPE_DISCONNECTED":{text: "Disconnesso", text_color: "black", background_color: "white"},
    "LABEL_CLOSE":{text: "Chiuso", text_color: "black", background_color: "white"},
    "LABEL_OPEN":{text: "Aperto", text_color: "green", background_color: "white"},
    "LABEL_OPENING":{text: "Chiusura", text_color: "orange", background_color: "white"},
    "LABEL_CLOSING":{text: "Apertura", text_color: "orange", background_color: "white"},
    "LABEL_ERROR":{text: "Errore", text_color: "white", background_color: "red"},
    "ON":{text: "On", text_color: "green", background_color: "white"},
    "OFF":{text: "Off", text_color: "black", background_color: "white"},
    "STAND_BY":{text: "Standby", text_color: "orange", background_color: "white"},
}

export const BUTTON_KEY_MAP = {
    "KEY_TELESCOPE_CONNECTION_TOGGLE": "btn-conn-telescopio", // ID del pulsante di connessione
    "KEY_PARK": "btn-park",
    "KEY_FLAT": "btn-flat" // ID del pulsante Park
    // ...
};
export const ROOF_STATE_TO_ACTION_MAP ={
    "ROOF_CLOSED": "ROOF_OPEN", 
    "ROOF_OPENED": "ROOF_CLOSE", 
    "ROOF_CLOSING": null, 
    "ROOF_OPENING": null, 
    "ROOF_DANGER": null,
    "ROOF_ERROR": null,
    "ERROR": null 

}
export const TELESCOPE_ACTION_MAP = {
    "DISCONNECTED": "TELESCOPE_CONNECT", 
    "CONNECTED": "TELESCOPE_DISCONNECT",
    "PARK_ACTION": "PARK_POSITION", 
    "FLAT_ACTION": "FLAT_POSITION", 
    // ✅ Stati di Ritorno (non sono azioni, ma li terremo qui se il tuo codice li usa)
    "PARKED": "PARKED", 
    "FLATTER": "FLATTER", 
    
    // Stati di transizione o errore
    "CONNECTING": null, 
    "DISCONNECTING": null,
    "LOST":  "TELESCOPE_CONNECT",
    "ERROR": null
};