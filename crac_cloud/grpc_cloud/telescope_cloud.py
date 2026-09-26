import logging
import grpc
from crac_protobuf import telescope_pb2
from crac_protobuf import telescope_pb2_grpc
from crac_protobuf import button_pb2
from crac_protobuf import button_pb2_grpc
from ..state import GLOBAL_CLIENT_STATE
from .rpc import FAST_READ_TIMEOUT, COMMAND_TIMEOUT

logger = logging.getLogger(__name__)


def _action_value(action) -> int:
    """Accepts both the TelescopeAction enum wrapper and its bare int value."""
    return int(getattr(action, "value", action))


class TelescopeClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = telescope_pb2_grpc.TelescopeStub(self.channel)
        self.button_stub = button_pb2_grpc.ButtonStub(self.channel)

    def get_autolight_status(self):
        """Fetches the Autolight flag from the TelescopeService."""
        ACTION_FOR_STATUS = 'CHECK_TELESCOPE'
        current_autolight_flag = GLOBAL_CLIENT_STATE.autolight_status
        request = telescope_pb2.TelescopeRequest(
            action=telescope_pb2.TelescopeAction.Value(ACTION_FOR_STATUS),
            autolight=current_autolight_flag
        )

        try:
            response = self.stub.SetAction(request, timeout=FAST_READ_TIMEOUT)
            logger.debug(f"telescope_cloud response: {response}")
            logger.debug(f"autolight status: {response.autolight}")
            return {
                "key": "KEY_AUTOLIGHT",
                "status": "ON" if response.speed == telescope_pb2.TelescopeSpeed.SPEED_TRACKING else "OFF",
                "is_checkbox": True
            }
        except Exception as e:
            logger.error(f" ❌ Error while fetching the autolight status: {e}")
            return {"key": "KEY_AUTOLIGHT", "status": "UNKNOWN"}

    def set_action(self, action: telescope_pb2.TelescopeAction, autolight: bool = False):
        """Sends an action (PARK or FLAT) to the telescope."""
        action_value = _action_value(action)
        request = telescope_pb2.TelescopeRequest(action=action_value, autolight=autolight)
        try:
            response = self.stub.SetAction(request, timeout=COMMAND_TIMEOUT)
            return self._parse_response(response)
        except grpc.RpcError as e:
            action_name = telescope_pb2.TelescopeAction.Name(action_value)
            logger.error(f"\n🚨 gRPC error detected for action {action_name}: status code: {e.code().name}, details: {e.details()}")
            return {"error": str(e.details())}
        except Exception as general_error:
            import traceback
            logger.error(f"\n🛑 Uncaught fatal error: {type(general_error).__name__}: {general_error}")
            traceback.print_exc()
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"Fatal error in SetAction.")

    def get_status(self):
        """Fetches the telescope's current operating status and coordinates."""
        request = telescope_pb2.TelescopeRequest(
            action=telescope_pb2.CHECK_TELESCOPE
        )

        logger.debug(f"Sending SetAction(CHECK_TELESCOPE) to get the status.")
        try:
            response = self.stub.SetAction(request, timeout=FAST_READ_TIMEOUT)
            return self._parse_response(response)
        except grpc.RpcError as e:
            logger.error(f"❌ gRPC error: the telescope service did not answer. Details: {e.details()}")
            return {"error": str(e.details())}

    def connect(self):
        """Connects the server to the telescope via SetAction."""
        action_enum = telescope_pb2.TELESCOPE_CONNECT
        request = telescope_pb2.TelescopeRequest(action=action_enum, autolight=False)

        logger.debug(f"Sending SetAction(TELESCOPE_CONNECT) to the gRPC server: {request}")
        logger.debug(f"Sending Connect to connect the telescope. {request}")
        try:
            response = self.stub.SetAction(request, timeout=COMMAND_TIMEOUT)
            logger.debug(f"gRPC response: {response}")
            return self._parse_response(response)
        except grpc.RpcError as e:
            logger.error(f" ❌ gRPC error (telescope connection): {e.details()}")
            return {"error": str(e.details())}

    def disconnect(self):
        """Disconnects the server from the telescope."""
        action_enum = telescope_pb2.TELESCOPE_DISCONNECT
        request = telescope_pb2.TelescopeRequest(action=action_enum, autolight=False)
        try:
            response = self.stub.SetAction(request, timeout=COMMAND_TIMEOUT)
            logger.debug(f"gRPC response to the disconnect request: {response}")
            return self._parse_response(response)
        except grpc.RpcError as e:
            logger.error(f" ❌ gRPC error: the service did not answer. {e.details()}")
            return {"error": str(e.details())}

    def _parse_response(self, response):
        """Parses a TelescopeResponse. The first button, the CONNECT/DISCONNECT
        toggle, is also exposed under the top-level 'gui' key read by the frontend."""
        first_button_gui = response.buttons_gui[0] if response.buttons_gui else None

        parsed_data = {
            "status": telescope_pb2.TelescopeStatus.Name(response.status),
            "eq_coords": {"ra": response.eq_coords.ra, "dec": response.eq_coords.dec},
            "aa_coords": {"alt": response.aa_coords.alt, "az": response.aa_coords.az},
            "speed": telescope_pb2.TelescopeSpeed.Name(response.speed),
            "pier_side": telescope_pb2.PierSide.Name(response.pier_side),
            "buttons_gui": []
        }

        for gui in response.buttons_gui:
             parsed_data["buttons_gui"].append({
                "metadata": gui.metadata,
                "label": button_pb2.ButtonLabel.Name(gui.label),
                "is_disabled": gui.is_disabled,
                "is_visible": gui.is_visible,
                "button_color": self.__button_color(gui)
            })

        if first_button_gui:
            parsed_data["gui"] = {
                "label": button_pb2.ButtonLabel.Name(first_button_gui.label),
                "is_disabled": first_button_gui.is_disabled,
                "is_visible": first_button_gui.is_visible,
                "button_color": self.__button_color(first_button_gui)
            }
        else:
            parsed_data["gui"] = {"label": "LABEL_ERROR", "is_disabled": True}

        return parsed_data

    def __button_color(self, gui) -> dict | None:
        if not gui.HasField("button_color"):
            return None
        return {
            "text_color": gui.button_color.text_color,
            "background_color": gui.button_color.background_color,
        }
