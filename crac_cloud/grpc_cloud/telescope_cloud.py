# grpc_cloud/telescope_cloud.py
import grpc
from crac_protobuf import telescope_pb2
from crac_protobuf import telescope_pb2_grpc
from crac_protobuf import button_pb2
from crac_protobuf import button_pb2_grpc
from crac_cloud.config import Config
from google.protobuf.empty_pb2 import Empty as EmptyMessage

class TelescopeClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = telescope_pb2_grpc.TelescopeStub(self.channel)
        self.button_stub = button_pb2_grpc.ButtonStub(self.channel)  # Stub per i bottoni

    def set_action(self, action: telescope_pb2.TelescopeAction, autolight: bool = False):
        """Sends an action (PARK or FLAT) to the telescope."""
        request = telescope_pb2.TelescopeRequest(action=action, autolight=autolight)
        print(f"Invio SetAction con azione: {action.name}, autolight: {autolight}")
        print(f"Request details: {request}")
        try:
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
        
    def get_status(self):
        """Richiede l'attuale stato operativo e le coordinate del telescopio."""
        request = telescope_pb2.TelescopeRequest(
            action=telescope_pb2.CHECK_TELESCOPE # Invia l'azione di check
        )
        
        print(f"Invio SetAction(CHECK_TELESCOPE) per lo stato.")
        try:
            response = self.stub.SetAction(request) 
            print(response)
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
        # Assumiamo che il metodo gRPC si chiami Disconnect
        request = telescope_pb2.Empty() # Oppure DisconnectRequest se definito
        try:
            # Chiama l'RPC Disconnect
            response = self.stub.Disconnect(request)
            # Analizza la risposta che dovrebbe contenere il nuovo stato (disconnesso)
            return self._parse_response(response)
        except grpc.RpcError as e:
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