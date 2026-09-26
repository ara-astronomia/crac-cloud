import logging
import grpc
from crac_protobuf import cover_mirror_pb2
from crac_protobuf import cover_mirror_pb2_grpc
from crac_protobuf import button_pb2
from .channel_health import ChannelHealth, CHANNEL_DOWN_MESSAGE, down_error, error_status

logger = logging.getLogger(__name__)


class CoverMirrorClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = cover_mirror_pb2_grpc.CoverMirrorStub(self.channel)
        self._health = ChannelHealth()

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
                "metadata": cover_mirror_pb2.CoverMirrorAction.Name(gui.metadata),
                "label": button_pb2.ButtonLabel.Name(gui.label),
                "is_disabled": gui.is_disabled,
                "button_color": color_data,
            }
        }

    def set_action(self, action_enum):
        request = cover_mirror_pb2.CoverMirrorRequest(action=action_enum)
        if self._health.is_down():
            return down_error()
        try:
            response = self.stub.SetAction(request, timeout=5.0)
            self._health.record_success()
            logger.debug(f"Mirror cover SetAction response: {response}")
            return self._parse_cover_mirror_response(response)
        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f" ❌ gRPC error (mirror cover action): {e.details()}")
            return {"error": str(e.details())}

    def get_status(self):
        """Fetches the mirror cover's current status."""
        if self._health.is_down():
            return error_status(CHANNEL_DOWN_MESSAGE)
        request = cover_mirror_pb2.CoverMirrorRequest(action=cover_mirror_pb2.CoverMirrorAction.CHECK_COVER_MIRROR)
        try:
            response = self.stub.SetAction(request, timeout=1.5)
            self._health.record_success()
        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f"❌ Error while requesting the mirror cover status: {e}")
            return error_status(str(e.details()))
        try:
            return self._parse_cover_mirror_response(response)
        except Exception as e:
            logger.error(f"❌ Error while requesting the mirror cover status: {e}")
            return error_status(str(e))