import grpc
from crac_protobuf import cover_mirror_pb2
from crac_protobuf import cover_mirror_pb2_grpc
from crac_protobuf import button_pb2


class CoverMirrorClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = cover_mirror_pb2_grpc.CoverMirrorStub(self.channel)

    def _parse_cover_mirror_response(self, response: cover_mirror_pb2.CoverMirrorResponse):
        gui = response.button_gui
        color_data = {
            "text_color": "white",
            "background_color": "gray",
        }
        if gui.HasField("button_color"):
            color_data = {
                "text_color": gui.button_color.text_color,
                "background_color": gui.button_color.background_color,
            }
        return {
            "status": cover_mirror_pb2.CoverMirrorStatus.Name(response.status),
            "gui": {
                "metadata": gui.metadata,
                "label": button_pb2.ButtonLabel.Name(gui.label),
                "is_disabled": gui.is_disabled,
                "button_color": color_data,
            }
        }

    def set_action(self, action_enum):
        request = cover_mirror_pb2.CoverMirrorRequest(action=action_enum)
        try:
            response = self.stub.SetAction(request, timeout=5.0)
            print (f"questo è il response: {response}")
            return self._parse_cover_mirror_response(response)
        except grpc.RpcError as e:
            return {"error": str(e.details())}