# grpc_cloud/telescope_cloud.py
import grpc
from crac_protobuf import telescope_pb2
from crac_protobuf import telescope_pb2_grpc
from crac_protobuf import button_pb2
from crac_protobuf import button_pb2_grpc
from crac_cloud.config import Config
from google.protobuf.empty_pb2 import Empty as EmptyMessage
from ..state import GLOBAL_CLIENT_STATE


class TelescopeClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = telescope_pb2_grpc.TelescopeStub(self.channel)
        self.button_stub = button_pb2_grpc.ButtonStub(self.channel)  # Stub per i bottoni

    # Nuovo metodo per leggere lo stato dell'Autolight
    def get_autolight_status(self):
        """
        Invia una richiesta di stato al TelescopeService per recuperare il flag Autolight.
        """
        ACTION_FOR_STATUS = 'CHECK_TELESCOPE' 
        current_autolight_flag = GLOBAL_CLIENT_STATE.autolight_status
        request = telescope_pb2.TelescopeRequest(
            action=telescope_pb2.TelescopeAction.Value(ACTION_FOR_STATUS),
            autolight=current_autolight_flag
        )
        print(f" questa è la request in telescope_cloud: {request}")
        try:
            # Chiama il metodo SetAction (o GetStatus se esiste)
            response = self.stub.SetAction(request) 
            print(f" questa è la response in telescope_cloud: {response}")
            
            # 🛑 QUI DEVI VEDERE SE response CONTIENE IL CAMPO AUTOLIGHT 🛑
            
            # Se il campo esistesse (es. response.autolight_status):
            # is_autolight_on = response.autolight_status
            
            # Dato che non sappiamo come si chiama, assumiamo che l'handler Autolight
            # aggiorni un campo di stato booleano (inventiamo 'is_autolight_active')
            
            # --- Per ora, assumiamo che lo stato sia letto dalla response in qualche modo ---
            
            # Qui dovresti implementare la logica per estrarre lo stato 'ON'/'OFF' dal tuo response
            
            # Per ora, restituiamo un formato consistente
            return {
                "key": "KEY_AUTOLIGHT",
                "status": "ON" if response.speed == telescope_pb2.TelescopeSpeed.SPEED_TRACKING else "OFF", # Esempio temporaneo!
                "is_checkbox": True 
            }
            
        except Exception as e:
            # ... (Gestione degli errori) ...
            return {"key": "KEY_AUTOLIGHT", "status": "UNKNOWN"}

    def set_action(self, action: telescope_pb2.TelescopeAction, autolight: bool = False):
        try:
            action_value = int(action.value) 
            print(f"siamo in set/action di Telescope_cloud:{action_value}")
        except AttributeError:
        # Se non ha .value (vecchia versione Python/Protobuf), basta la conversione
            action_value = int(action)
        """Sends an action (PARK or FLAT) to the telescope."""
        request = telescope_pb2.TelescopeRequest(action=action_value, autolight=autolight)
        print(f"Invio SetAction in telescope_cloud con azione: {action_value}, autolight: {autolight}")
        print(f"Request details: {request}")
        response = self.stub.SetAction(request)
        print (f"questa è la response: {response}")
        try:
            print("prova il try")
            response = self.stub.SetAction(request)
            print (f"questa è la response: {response}")
            return self._parse_response(response)
        except grpc.RpcError as e:
        # 1. ✅ LOGGA L'ERRORE nel terminale Python
            error_details = e.details()
            error_code = e.code().name
            
            print(f"\n🚨 ERRORE gRPC RILEVATO per Azione {action.name}:")
            print(f"   Codice di Stato: {error_code}")
            print(f"   Dettagli: {error_details}")
            
            # 2. ✅ RILANCIA UN'ECCEZIONE HTTP CHE FASTAPI PUÒ GESTIRE
            from fastapi import HTTPException
            # Restituisce al frontend un 503 (Servizio non disponibile) o 500
            raise HTTPException(
                status_code=500,
                detail=f"gRPC Service Error ({error_code}): {error_details}"
            )
        except Exception as general_error:
        # 🚨 Questo blocco è FONDAMENTALE per catturare eccezioni inattese 🚨
            import traceback
            print(f"\n🛑 ERRORE FATALE NON CATTURATO: {type(general_error).__name__}: {general_error}")
            traceback.print_exc()
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"Errore fatale in SetAction.")
    
    def get_status(self):
        """Richiede l'attuale stato operativo e le coordinate del telescopio."""
        request = telescope_pb2.TelescopeRequest(
            action=telescope_pb2.CHECK_TELESCOPE # Invia l'azione di check
        )
        
        print(f"Invio SetAction(CHECK_TELESCOPE) per lo stato.")
        try:
            response = self.stub.SetAction(request) 
            #print(response)
            return self._parse_response(response)
        except grpc.RpcError as e:
            # Assicurati di gestire l'errore per non rompere il router (restituisci stato d'errore)
            return {"error": str(e.details())}

    def connect(self):
        """Tenta di connettere il server al telescopio tramite SetAction."""
    
    # 1. Definisci l'azione enum corretta
        action_enum = telescope_pb2.TELESCOPE_CONNECT
        
        # 2. Crea la richiesta (usando il modello TelescopeRequest)
        request = telescope_pb2.TelescopeRequest(action=action_enum, autolight=False) 
        
        print(f"Invio SetAction(TELESCOPE_CONNECT) al server gRPC: {request}")
        print(f"Invio Connect per connettere il telescopio. {request}")
        try:
            # Chiama l'RPC Connect
            response = self.stub.SetAction(request)
            print(f"Risposta gRPC risposta: {response}")
            # Analizza la risposta che dovrebbe contenere il nuovo stato (connesso)
            return self._parse_response(response)
        except grpc.RpcError as e:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=500,
                detail=f"gRPC Service Error: {e.details()}"
            )

    def disconnect(self):
        """Disconnette il server dal telescopio."""
        action_enum = telescope_pb2.TELESCOPE_DISCONNECT
        # Assumiamo che il metodo gRPC si chiami Disconnect
        request = telescope_pb2.TelescopeRequest(action=action_enum, autolight=False) 
        # request = telescope_pb2.Empty() # Oppure DisconnectRequest se definito
        try:
            # Chiama l'RPC Disconnect
            # response = self.stub.Disconnect(request)
            response = self.stub.SetAction(request)
            print(f"Risposta gRPC alla richiesta di disconnessione: {response}")
            # Analizza la risposta che dovrebbe contenere il nuovo stato (disconnesso)
            return self._parse_response(response)
        except grpc.RpcError as e:
            error_message = f"Errore gRPC: Il servizio non ha risposto. {e.details()}"
            print(error_message) # Assicurati di vederlo!
            return {"error": str(e.details())}
        
    def _parse_response(self, response):
        """Helper function to parse the common TelescopeResponse."""
        
        # 🎯 ASSUNZIONE CHIAVE: Per il frontend, raggruppiamo i dati del primo pulsante
        # (che assumiamo essere quello di CONNECT/DISCONNECT) come 'gui'.
        # Se non ci sono bottoni, usiamo un fallback.
        
        first_button_gui = response.buttons_gui[0] if response.buttons_gui else None
        
        # 1. Dati specifici del Telescopio (per display futuro)
        parsed_data = {
            "status": telescope_pb2.TelescopeStatus.Name(response.status),
            "eq_coords": {"ra": response.eq_coords.ra, "dec": response.eq_coords.dec},
            "aa_coords": {"alt": response.aa_coords.alt, "az": response.aa_coords.az},
            "speed": telescope_pb2.TelescopeSpeed.Name(response.speed),
            "pier_side": telescope_pb2.PierSide.Name(response.pier_side),
            "buttons_gui": [] # Manteniamo la lista completa per riferimento futuro
        }
        
        # 2. Popoliamo la lista completa dei bottoni
        for gui in response.buttons_gui:
             parsed_data["buttons_gui"].append({
                "metadata": gui.metadata,
                "label": button_pb2.ButtonLabel.Name(gui.label),
                "is_disabled": gui.is_disabled,
                "is_visible": gui.is_visible
            })

        # 3. 🎯 Aggiungiamo la chiave 'gui' per il pulsante CONNECT/DISCONNECT che usa il frontend JS
        if first_button_gui:
            parsed_data["gui"] = {
                "label": button_pb2.ButtonLabel.Name(first_button_gui.label),
                "is_disabled": first_button_gui.is_disabled,
                "is_visible": first_button_gui.is_visible
                # NOTA: Assicurati che il tuo protobuf TelescopeResponse includa i campi 
                # button_color se vuoi stilizzare anche questo pulsante!
            }
        else:
            # Fallback se non ci sono bottoni
            parsed_data["gui"] = {"label": "LABEL_ERROR", "is_disabled": True}


        return parsed_data