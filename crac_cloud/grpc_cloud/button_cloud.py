import logging
import grpc
from crac_protobuf import button_pb2
from crac_protobuf import button_pb2_grpc
from .rpc import FAST_READ_TIMEOUT, COMMAND_TIMEOUT

logger = logging.getLogger(__name__)

class ButtonClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = button_pb2_grpc.ButtonStub(self.channel)

    def set_switch_action(self, button_type, action):
        """Sends a TURN_ON/TURN_OFF action to the ButtonService for a switch."""
        request = button_pb2.ButtonRequest(
            type=button_type,
            action=action,
            )
        try:
            response = self.stub.SetAction(request, timeout=COMMAND_TIMEOUT)
            return self._parse_button_response(response)
        except grpc.RpcError as e:
            logger.error(f" ❌ RPC error (write) for type {button_pb2.ButtonType.Name(button_type)}: {e.details()}")
            return {"status": "error", "message": f"Errore gRPC durante l'azione: {e.details()}"}

    def get_single_switch_status(self, button_key_str, button_type):
        """Reads a single switch's status by calling SetAction (CHECK_BUTTON)."""
        request = button_pb2.ButtonRequest(
            type=button_type,
            action=button_pb2.ButtonAction.CHECK_BUTTON,
        )
        try:
            response = self.stub.SetAction(request, timeout=FAST_READ_TIMEOUT)

            parsed_response = self._parse_button_response(response)
            parsed_response["key"] = button_key_str
            return parsed_response
        except grpc.RpcError as e:
            logger.error(f" ❌ RPC error (read) for {button_key_str} (type {button_pb2.ButtonType.Name(button_type)}): {e.details()}")
            return {"error": str(e.details()), "status": "UNKNOWN"}
        
    def _parse_button_response(self, response: button_pb2.ButtonResponse):
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
            "status": button_pb2.ButtonStatus.Name(response.status),
            "type": button_pb2.ButtonType.Name(response.type),
            "button_gui": {
                "metadata": gui.metadata,
                "label": button_pb2.ButtonLabel.Name(gui.label),
                "is_disabled": gui.is_disabled,
                "key": button_pb2.ButtonKey.Name(gui.key),
                "button_color": color_data
            }
        }
 
    