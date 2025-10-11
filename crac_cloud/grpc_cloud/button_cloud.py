# grpc_cloud/button_cloud.py
import grpc
from crac_protobuf import button_pb2
from crac_protobuf import button_pb2_grpc

class ButtonClient:
    def __init__(self, host: str, port: int):
        # Crea il canale di comunicazione con il server gRPC
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        # Crea lo stub, che è il client che useremo per chiamare i metodi RPC
        self.stub = button_pb2_grpc.ButtonStub(self.channel)

    def set_switch_action(self, button_type, action):
        """Invia un'azione (TURN_ON/TURN_OFF) al ButtonService per un interruttore."""
        # Crea il messaggio di richiesta usando le classi generate da protobuf
        print(f"Invio SetAction con tipo: {button_type}, azione: {action}")
        request = button_pb2.ButtonRequest(
            type=button_type,
            action=action,
            )
        try:
            response = self.stub.SetAction(request) 
            #print(response)
            # Qui usiamo un parser specifico per ButtonResponse
            return self._parse_button_response(response) 
        except grpc.RpcError as e:
            print(f"❌ Errore RPC (Scrittura) per Tipo {button_type.name}: {e.details()}")
            return {"status": "error", "message": f"Errore gRPC durante l'azione: {e.details()}"}
        
    def get_single_switch_status(self, button_key_str, button_type):
        """
        Recupera lo stato di un singolo pulsante chiamando SetAction (CHECK_BUTTON).
        """
        request = button_pb2.ButtonRequest(
            type=button_type, #pb2.ButtonType.Value(button_type),
            action=button_pb2.ButtonAction.CHECK_BUTTON,
        )
        print(f"richiesta :{request} per il button_key_str: {button_key_str} e button_type: {button_type}")
        try:
            response = self.stub.SetAction(request)
            #print(f"response :{response} per il button_key_str: {button_key_str} e button_type: {button_type}")
            #print("Response from get_button_status:", response.status, button_key_str)
            parsed_response = self._parse_button_response(response)
            parsed_response["key"] = button_key_str # Aggiungi la chiave alla radice per il router
            return parsed_response
        except grpc.RpcError as e:
            return {"error": str(e.details()), "status": "UNKNOWN"}
        
    def _parse_button_response(self, response: button_pb2.ButtonResponse):
        # Implementa qui il parsing robusto per ButtonResponse (come discusso prima)
        gui = response.button_gui
        color_data = {
            "text_color": "white",  # Default o valore dal proto
            "background_color": "gray",
        }
        if gui.HasField("button_color"):
             color_data = {
                # NON usare ButtonColor.Name(), perché questi campi sono già STRINGHE nel proto
                "text_color": gui.button_color.text_color, 
                "background_color": gui.button_color.background_color,
            }

        return {
            "status": button_pb2.ButtonStatus.Name(response.status),
            "type": button_pb2.ButtonType.Name(response.type),
            "button_gui": {
                "metadata": gui.metadata,
                "label": button_pb2.ButtonLabel.Name(gui.label), # Questo converte ENUM a stringa (es. 'LABEL_ON')
                "is_disabled": gui.is_disabled,
                "key": button_pb2.ButtonKey.Name(gui.key),
                
                # Assicurati che il tuo frontend si aspetti il nome 'button_color' con il suo dizionario interno
                "button_color": color_data 
            }
        }
    