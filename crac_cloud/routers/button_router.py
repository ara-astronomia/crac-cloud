import logging
from fastapi import APIRouter,Depends, HTTPException
from pydantic import BaseModel
from typing import Optional 
from crac_cloud.grpc_cloud.button_cloud import ButtonClient
from crac_protobuf import button_pb2, telescope_pb2
from crac_cloud.config import Config
from crac_cloud.grpc_service import get_grpc_container
from crac_cloud.grpc_cloud.telescope_cloud import TelescopeClient
from crac_cloud.grpc_cloud.button_cloud import ButtonClient as ButtonsClient

logger = logging.getLogger(__name__)

# Definisci la classe Pydantic prima di usarla
class ButtonActionRequest(BaseModel):
    action: str
    key: str | None = None
    type: str = None
    value: Optional[bool] = None  # Aggiungi questo campo opzionale

# Inizializza il router e il client gRPC
router = APIRouter(
    prefix="/buttons",
    tags=["Button Actions"]
)
# Mappa delle chiavi dei bottoni ai loro tipi corrispondenti nel proto
KEY_TO_TYPE_MAP = {
        "KEY_TELE_SWITCH": "TELE_SWITCH",
        "KEY_CCD_SWITCH": "CCD_SWITCH",
        "KEY_FLAT_LIGHT": "FLAT_LIGHT",
        "KEY_DOME_LIGHT": "DOME_LIGHT",
        "KEY_PARK": "TELE_SWITCH", 
        "KEY_FLAT": "TELE_SWITCH",
    }

def get_buttons_client() -> ButtonsClient:
    """Restituisce un'istanza del client gRPC per i pulsanti generici."""
    # ⚠️ AGGIORNA HOST E PORTA SECONDO LA TUA CONFIGURAZIONE ⚠️
    GRPC_HOST = "localhost"  
    GRPC_PORT = 50051        # Usa la stessa porta se i servizi sono sullo stesso server
    return ButtonsClient(host=GRPC_HOST, port=GRPC_PORT) # Assumendo la stessa porta gRPC

def set_autolight_action(autolight_value: bool, telescope_stub):
    """
    Crea e invia la richiesta gRPC per l'Autolight al TelescopeService,
    utilizzando CHECK_TELESCOPE come azione placeholder.
    """
    
    # 1. Definisci l'azione placeholder (dal tuo Enum)
    ACTION_FOR_AUTOLIGHT = 'CHECK_TELESCOPE' 
    
    # 2. Crea il messaggio di richiesta del Telescopio
    request = telescope_pb2.TelescopeRequest(
        action=telescope_pb2.TelescopeAction.Value(ACTION_FOR_AUTOLIGHT),
        autolight=autolight_value  # ✅ Il campo booleano essenziale
    )

    try:
        # 3. Chiama il metodo SetAction sullo stub del Telescopio
        logger.debug(f"Invio Autolight con azione {ACTION_FOR_AUTOLIGHT}: {autolight_value}")
        response = telescope_stub.SetAction(request) 
        # ... (Logica di parsing della risposta) ...
        return {"status": "ok", "message": "Autolight impostato"}
        
    except grpc.RpcError as e:
        logger.error(f"❌ Errore RPC (Autolight): {e.details()}")
        return {"status": "error", "message": f"Errore gRPC Autolight: {e.details()}"}


@router.post("/set_action")
async def set_action(request: ButtonActionRequest, service: get_grpc_container = Depends(get_grpc_container)):
    logger.debug(f"DEBUG: Azione richiesta: {request.action}") # Debug utile
    """
    Gestisce tutte le azioni dei pulsanti in base all'azione richiesta dal frontend.
    """
     # 1. Tenta la conversione dell'Action Enum
    try:
        action_enum = button_pb2.ButtonAction.Value(request.action)
    except ValueError:
        return {"status": "error", "message": f"Unknown action: {request.action}"}

    # --- BLOCCO 1: TURN_ON / TURN_OFF (Interruttori e Luci) ---
    if request.action in ["TURN_ON", "TURN_OFF"]:  
        try:
            button_type_str = KEY_TO_TYPE_MAP[request.key] # Es: 'TELE_SWITCH'
            type_enum = button_pb2.ButtonType.Value(button_type_str)
        except KeyError:
            return {"status": "error", "message": f"Unknown key '{request.key}' in KEY_TO_TYPE_MAP."}
        except ValueError:
            return {"status": "error", "message": f"Type '{button_type_str}' not found in ButtonType enum."}

        # ⚠️ FASE 1 - OTTIENI LO STATO ATTUALE DAL SERVER ⚠️
        try:
            # 💡 CHIAMATA CORRETTA: usa il nome corretto e passa ENTRAMBI gli argomenti
            status_data = service.button_client.get_single_switch_status(request.key, type_enum) 
            current_status = status_data.get("status") # Es: "ON" o "OFF"
            logger.debug(f"DEBUG: Current status for {request.key} is {current_status}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to check current status on server: {e}")
        
        # ... (omissis: FASE 2 - Logica di Commutazione e FASE 3 - Invio) ...       

        action_to_send_enum = None
        if current_status == "ON":
            action_to_send_enum = button_pb2.ButtonAction.TURN_OFF
        elif current_status == "OFF":
            action_to_send_enum = button_pb2.ButtonAction.TURN_ON
        else:
            action_to_send_enum = action_enum 
        
        action_name = button_pb2.ButtonAction.Name(action_to_send_enum) 
        type_name = button_pb2.ButtonType.Name(type_enum)
        # FASE 3 - INVIO DELL'AZIONE CORRETTA AL SERVER
        
        # 💡 NUOVA STAMPA: Cosa inviamo davvero?
        logger.debug(f"DEBUG: Invio Azione Finale gRPC: {action_name} su Tipo: {type_name}") 
        
        response_data = service.button_client.set_switch_action(
            action=action_to_send_enum, # Azione corretta per la commutazione
            button_type=type_enum 
        )        
        # 💡 NUOVA STAMPA: Cosa è tornato dal server CRAC?
        logger.debug(f"DEBUG: Risposta Finale gRPC: {response_data}") 
        return response_data

# ------------------------------------------------------------------
    # --- BLOCCO 2: CHECKBOX Autolight ---
    elif request.action == "CHECK_BUTTON": 
        
        # 1. Verifica la Chiave
        if request.key != 'KEY_AUTOLIGHT':
             logger.warning(f"Attenzione: Ricevuta azione CHECK_BUTTON per chiave non supportata: {request.key}")          
             return {"status": "error", "message": f"SET_VALUE non supportato per la chiave: {request.key}"}
        else:
            logger.debug(f"DEBUG: Chiave valida per CHECK_BUTTON: {request.key}")
        
        # 2. Estrazione del Valore Booleano
        # La richiesta FastAPI (Pydantic model) deve includere 'value: Optional[bool]'
        # Assumendo che 'request' abbia un campo 'value'
        
        if request.value is None:
            return {"status": "error", "message": "Il campo 'value' (boolean) è mancante per SET_VALUE."}
            
        autolight_value = request.value # ✅ Questo è il true/false
        logger.debug(f"DEBUG: Valore Autolight ricevuto: {autolight_value}")        
        # 3. Chiamata al servizio gRPC corretto (TelescopeRetriever)
        try:
        # Chiama la funzione proxy con lo stub del Telescopio e il valore
            response_data = set_autolight_action(
            request.value,
            service.telescope_client.stub # Passa lo stub gRPC corretto
            )
            logger.debug(f"DEBUG: Risposta Finale gRPC Autolight: {response_data}")
            return response_data
            
        except Exception as e:
            # Cattura qualsiasi errore durante la comunicazione gRPC
            raise HTTPException(status_code=500, detail=f"Failed to set Autolight status: {e}")

# ------------------------------------------------------------------
    # --- BLOCCO 3: BUTTON_DEFAULT_ACTION (Azioni Singole come PARK, FLAT, ecc.) ---
    # Questa sezione si attiva se il frontend invia BUTTON_DEFAULT_ACTION.
    if request.action == "BUTTON_DEFAULT_ACTION":
        try:
            button_type_str = KEY_TO_TYPE_MAP[request.key] # Es: 'TELE_SWITCH'
            type_enum_value = button_pb2.ButtonType.Value(button_type_str)
        except (KeyError, ValueError):
            return {"status": "error", "message": f"Unknown key or type for default action: {request.key}"}
        
        # Chiama gRPC inviando l'ID numerico della CHIAVE nel campo BUTTON_TYPE
        # 💡 Ora invia l'ID numerico del ButtonType (un intero)
        return service.button_client.set_switch_action(
            action=action_enum,
            button_type=type_enum_value # ✅ Usa il ButtonType ricavato dalla mappa
        )
    # --- ERRORE FINALE ---
    return {"status": "error", "message": f"Action '{request.action}' not handled by this router."}

@router.get("/status")
async def get_all_button_statuses(service: get_grpc_container = Depends(get_grpc_container)):
    """
    Recupera lo stato attuale di tutti gli interruttori (e i loro dati GUI) per l'aggiornamento master.
    """
    all_statuses = []
    
    # Definisci esplicitamente le chiavi degli SWITCH che richiedono aggiornamento UI
    # Usiamo le stesse chiavi definite nella KEY_TO_TYPE_MAP
    switch_keys_to_check = {
        "KEY_TELE_SWITCH": "TELE_SWITCH",
        "KEY_CCD_SWITCH": "CCD_SWITCH",
        "KEY_FLAT_LIGHT": "FLAT_LIGHT",
        "KEY_DOME_LIGHT": "DOME_LIGHT",
    }
    
    for key_str, type_str in switch_keys_to_check.items():
        try:
            # Converte ButtonType stringa in Enum per il client
            type_enum = button_pb2.ButtonType.Value(type_str)
            
            # Chiama il client gRPC per ottenere lo stato singolo. 
            # Il client restituisce il JSON completo, incluso 'button_gui'.
            status_data = service.button_client.get_single_switch_status(key_str, type_enum)
            
            all_statuses.append(status_data)
            logger.debug(f"DEBUG: Stato ottenuto per {key_str}: {status_data}")

        except Exception as e:
            # Gestisce l'errore per un singolo pulsante senza bloccare il resto
            logger.error(f"❌ Errore nel recupero stato per {key_str}: {e}")
            # Invia uno stato di errore (grigio predefinito)
            all_statuses.append({"key": key_str, "status": "ERROR", "button_gui": {}})

        try:
            # Assumiamo che il TelescopeClient sia esposto via service.telescope_client
            autolight_status = service.telescope_client.get_autolight_status() 
            all_statuses.append(autolight_status)

        except Exception as e:
            logger.error(f"❌ Errore nel recupero Autolight: {e}")
            # Gestisci l'errore per non bloccare il polling    

    # Restituisce un JSON con la lista di tutti gli stati
    return {"buttons": all_statuses}

