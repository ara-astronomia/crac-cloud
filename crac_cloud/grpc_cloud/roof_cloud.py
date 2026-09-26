# grpc_cloud/roof_cloud.py
import logging
import grpc
from crac_protobuf import roof_pb2
from crac_protobuf import roof_pb2_grpc
from crac_protobuf import button_pb2
from .channel_health import ChannelHealth, CHANNEL_DOWN_MESSAGE

logger = logging.getLogger(__name__)


def _error_status(message: str) -> dict:
    return {
        "status": "ERROR",
        "gui": {
            "label": "LABEL_ERROR",
            "is_disabled": True,
            "button_color": {"text_color": "white", "background_color": "red"},
        },
        "error": message,
    }


class RoofClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = roof_pb2_grpc.RoofStub(self.channel)
        self._health = ChannelHealth()

    def _parse_roof_response(self, response: roof_pb2.RoofResponse):
        """Parses the roof response, including the GUI data."""
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
            "status": roof_pb2.RoofStatus.Name(response.status),
            "gui": {
                "metadata": gui.metadata,
                "label": button_pb2.ButtonLabel.Name(gui.label),
                "is_disabled": gui.is_disabled,
                "button_color": color_data
            }
        }

    def set_action(self, action_enum):
        """Sends an open/close action to the sliding roof and parses the response."""
        request = roof_pb2.RoofRequest(action=action_enum)
        if self._health.is_down():
            return {"error": CHANNEL_DOWN_MESSAGE}
        try:
            response = self.stub.SetAction(request, timeout=5.0)
            self._health.record_success()
            return self._parse_roof_response(response)

        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f" ❌ gRPC error (roof action): {e.details()}")
            return {"error": str(e.details())}

    def get_status(self):
        """Fetches the roof's current status."""
        if self._health.is_down():
            return _error_status(CHANNEL_DOWN_MESSAGE)
        request = roof_pb2.RoofRequest(action=roof_pb2.RoofAction.CHECK_ROOF)
        try:
            response = self.stub.SetAction(request, timeout=1.5)
            self._health.record_success()
        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f" ❌ Error while requesting the roof status: {e}")
            return _error_status(str(e.details()))
        try:
            return self._parse_roof_response(response)
        except Exception as e:
            logger.error(f" ❌ Error while requesting the roof status: {e}")
            return _error_status(str(e))
