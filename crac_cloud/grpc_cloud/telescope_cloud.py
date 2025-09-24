# grpc_cloud/telescope_cloud.py
import grpc
from crac_protobuf import telescope_pb2
from crac_protobuf import telescope_pb2_grpc
from crac_protobuf import button_pb2

class TelescopeClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = telescope_pb2_grpc.TelescopeStub(self.channel)

    def set_action(self, action: telescope_pb2.TelescopeAction, autolight: bool = False):
        """Sends an action (PARK or FLAT) to the telescope."""
        request = telescope_pb2.TelescopeRequest(action=action, autolight=autolight)
        try:
            response = self.stub.SetAction(request)
            return self._parse_response(response)
        except grpc.RpcError as e:
            return {"error": str(e.details())}

    def _parse_response(self, response):
        """Helper function to parse the common TelescopeResponse."""
        buttons_gui_list = []
        for gui in response.buttons_gui:
            buttons_gui_list.append({
                "metadata": gui.metadata,
                "label": button_pb2.ButtonLabel.Name(gui.label),
                "is_disabled": gui.is_disabled,
                "is_visible": gui.is_visible
            })

        return {
            "status": telescope_pb2.TelescopeStatus.Name(response.status),
            "eq_coords": {"ra": response.eq_coords.ra, "dec": response.eq_coords.dec},
            "aa_coords": {"alt": response.aa_coords.alt, "az": response.aa_coords.az},
            "speed": telescope_pb2.TelescopeSpeed.Name(response.speed),
            "pier_side": telescope_pb2.PierSide.Name(response.pier_side),
            "buttons_gui": buttons_gui_list
        }