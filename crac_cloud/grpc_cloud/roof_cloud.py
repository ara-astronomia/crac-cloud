# grpc_cloud/roof_cloud.py
import grpc
from crac_protobuf import roof_pb2
from crac_protobuf import roof_pb2_grpc
from crac_protobuf import button_pb2

class RoofClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = roof_pb2_grpc.RoofStub(self.channel)

    def set_action(self, action_enum): #roof_pb2.RoofAction):
        """Invia un'azione (apri/chiudi) al tetto scorrevole."""
        request = roof_pb2.RoofRequest(action=action_enum)
        print(f"questa è la  {request}")
        try:
            response = self.stub.SetAction(request)
            return {
                "status": roof_pb2.RoofStatus.Name(response.status),
                "gui": {
                    "metadata": response.button_gui.metadata,
                    "label": button_pb2.ButtonLabel.Name(response.button_gui.label),
                    "is_disabled": response.button_gui.is_disabled,
                    "is_visible": response.button_gui.is_visible
                }
            }
        except grpc.RpcError as e:
            return {"error": str(e.details())}