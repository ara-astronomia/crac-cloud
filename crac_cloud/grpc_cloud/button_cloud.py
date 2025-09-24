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

    def set_action(self, action: button_pb2.ButtonAction, button_type: button_pb2.ButtonType):
        """Invia un'azione a un bottone specifico."""
        # Crea il messaggio di richiesta usando le classi generate da protobuf
        request = button_pb2.ButtonRequest(action=action, type=button_type)
        try:
            # Chiama il metodo RPC "SetAction"
            response = self.stub.SetAction(request)
            # Restituisce i dati della risposta in un formato JSON-friendly
            return {
                "status": button_pb2.ButtonStatus.Name(response.status),
                "type": button_pb2.ButtonType.Name(response.type),
                "gui": {
                    "metadata": response.button_gui.metadata,
                    "label": button_pb2.ButtonLabel.Name(response.button_gui.label),
                    "is_disabled": response.button_gui.is_disabled,
                    "is_visible": response.button_gui.is_visible
                }
            }
        except grpc.RpcError as e:
            return {"error": str(e.details())}
    
    def get_status(self):
        """Ottiene lo stato di tutti i bottoni."""
        request = button_pb2.ButtonsRequest()
        try:
            response = self.stub.GetStatus(request)
            # Mappa la lista di risposte protobuf in una lista di dizionari Python
            button_list = []
            for btn in response.buttons:
                button_list.append({
                    "status": button_pb2.ButtonStatus.Name(btn.status),
                    "type": button_pb2.ButtonType.Name(btn.type),
                    "gui": {
                        "metadata": btn.button_gui.metadata,
                        "label": button_pb2.ButtonLabel.Name(btn.button_gui.label),
                        "is_disabled": btn.button_gui.is_disabled,
                        "is_visible": btn.button_gui.is_visible
                    }
                })
            return {"buttons": button_list}
        except grpc.RpcError as e:
            return {"error": str(e.details())}