# grpc_cloud/roof_cloud.py
import grpc
from crac_protobuf import roof_pb2
from crac_protobuf import roof_pb2_grpc
from crac_protobuf import button_pb2

class RoofClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = roof_pb2_grpc.RoofStub(self.channel)

    def _parse_roof_response(self, response: roof_pb2.RoofResponse):
        """Parsing della risposta del tetto per includere i dati della GUI."""
        gui = response.button_gui
        color_data = {
            "text_color": "white",
            "background_color": "gray",
        }
        
        # 🎯 Verifica se i dati del colore sono presenti nel proto di Roof
        # Assumiamo che RoofResponse.button_gui.button_color sia un messaggio
        if gui.HasField("button_color"):
             color_data = {
                "text_color": gui.button_color.text_color, 
                "background_color": gui.button_color.background_color,
            }
        print(f"Parsed roof response: status={roof_pb2.RoofStatus.Name(response.status)}, gui={gui}, color_data={color_data}")
        return {
            "status": roof_pb2.RoofStatus.Name(response.status),
            "gui": { # Usiamo "gui" per coerenza con il JS
                "metadata": gui.metadata,
                "label": button_pb2.ButtonLabel.Name(gui.label), 
                "is_disabled": gui.is_disabled,
                # Includiamo il colore
                "button_color": color_data 
            }
        }
        
    def set_action(self, action_enum): #roof_pb2.RoofAction):
        """Invia un'azione (apri/chiudi) al tetto scorrevole e parsifica la risposta."""
        request = roof_pb2.RoofRequest(action=action_enum)
        try:
            response = self.stub.SetAction(request)
            
            # 🎯 USA IL PARSING QUI
            return self._parse_roof_response(response) 
            
        except grpc.RpcError as e:
            return {"error": str(e.details())}    
