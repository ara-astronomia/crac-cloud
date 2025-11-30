# grpc_cloud/curtains_cloud.py
import grpc
from crac_protobuf import curtains_pb2
from crac_protobuf import curtains_pb2_grpc
#from crac_protobuf import button_pb2
from crac_cloud.config import Config

STATUS_LABEL_MAP = {
    "DISABLED": "Disattivata",
    "CLOSED": "Chiusa",
    "STOPPED": "Ferma",
    "OPENED": "Aperta",
    "ERROR": "Errore",
    "DANGER": "Pericolo",
    "OPENING": "Apertura",
    "CLOSING": "Chiusura",
    "DISABLING": "Disattivazione",
}

class CurtainsClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = curtains_pb2_grpc.CurtainStub(self.channel)

    def set_action(self, action):
        request = curtains_pb2.CurtainsRequest(action=action)
        try:
            response = self.stub.SetAction(request)
            return self._parse_response(response)
        except grpc.RpcError as e:
            return {"error": str(e.details())}
    
    def get_status(self):
        """Ottiene lo stato delle tende inviando l'azione CHECK_CURTAIN."""
        request = curtains_pb2.CurtainsRequest(action=curtains_pb2.CurtainsAction.CHECK_CURTAIN)
        try:
            response = self.stub.SetAction(request)
            print("Received response from gRPC server for get_status")  
            print(response)  # Stampa l'intero oggetto di risposta per il debug
            return self._parse_response(response)
        except grpc.RpcError as e:
            return {"error": str(e.details())}
    
    def _parse_response(self, response):
    # --- 1. Parsing degli oggetti 'curtains' ---
        curtains_data = []
        for curtain in response.curtains:
            # Il campo 'status' è su 'curtain', NON su 'response'
            # 1. Ottiene il nome ENUM pulito per lo stato (es. 'CLOSED', 'OPENING')
            status_enum_name = self._get_enum_name(curtain.status) # <-- Variabile corretta
            print(f"Parsing curtain: orientation={curtain.orientation}, status={status_enum_name}, steps={curtain.steps}")
            
            # 2. Ottiene il nome ENUM pulito per l'orientamento (es. 'EAST', 'WEST')
            orientation_name = self._get_enum_name(curtain.orientation)
            print(f"Orientation enum name: {orientation_name}") 
            
            steps_value = curtain.steps 
            print(f"Steps value: {steps_value}")
            
            # 2. Mappa il nome ENUM alla label UI
            status_ui_label = STATUS_LABEL_MAP.get(status_enum_name, status_enum_name)
            print(f"Mapped status label: {status_ui_label}")
            
            curtains_data.append({
                "orientation": orientation_name,
                # Usa la label leggibile dall'utente
                "status": status_ui_label, 
                "steps": steps_value,
                "angle": self._steps_to_angle(steps_value)
            })

        # --- 2. Parsing degli oggetti 'buttons_gui' ---
        buttons_data = []
        for button in response.buttons_gui:
            label_name = self._get_enum_name(button.label)
            key_name = self._get_enum_name(button.key)
            
            buttons_data.append({
                "metadata": button.metadata,
                "label": label_name,
                "is_disabled": button.is_disabled,
                "button_color": {
                    "text_color": button.button_color.text_color,
                    "background_color": button.button_color.background_color,
                },
                "key": key_name,
            })
        
        # --- 3. Restituisci la struttura completa ---
        return {
            "curtains": curtains_data,
            "buttons_gui": buttons_data,
        }
    def _get_enum_name(self, enum_value):
    # Trasforma i nomi ENUM come CURTAIN_DISABLED in DISABLED
        try:
            # Usa il metodo Name() sul campo per ottenere la stringa ENUM completa
            full_name = enum_value.Name(enum_value)
            # Se è un nome standard con underscore, restituisci l'ultima parte
            return full_name.split('_')[-1]
        except AttributeError:
            # Se non è un enum, restituisci il valore così com'è
            return enum_value