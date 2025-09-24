# grpc_cloud/curtains_cloud.py
import grpc
from crac_protobuf import curtains_pb2
from crac_protobuf import curtains_pb2_grpc
#from crac_protobuf import button_pb2
from crac_cloud.config import Config

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
            return self._parse_response(response)
        except grpc.RpcError as e:
            return {"error": str(e.details())}
    
    def _parse_response(self, response):
        status = curtains_pb2.CurtainStatus.Name(response.status)
        return {
            "status": status,
            "curtain_east_steps": response.curtain_east.steps,
            "curtain_west_steps": response.curtain_west.steps,
        }
