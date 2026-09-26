# grpc_cloud/telescope_cloud.py
import logging
import grpc
from crac_protobuf import telescope_pb2
from crac_protobuf import telescope_pb2_grpc
from crac_protobuf import button_pb2
from crac_protobuf import button_pb2_grpc
from crac_cloud.config import Config
from google.protobuf.empty_pb2 import Empty as EmptyMessage
from ..state import GLOBAL_CLIENT_STATE
from .channel_health import ChannelHealth, CHANNEL_DOWN_MESSAGE

logger = logging.getLogger(__name__)

class TelescopeClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = telescope_pb2_grpc.TelescopeStub(self.channel)
        self.button_stub = button_pb2_grpc.ButtonStub(self.channel)
        self._health = ChannelHealth()

    def get_autolight_status(self):
        """Fetches the Autolight flag from the TelescopeService."""
        ACTION_FOR_STATUS = 'CHECK_TELESCOPE'
        current_autolight_flag = GLOBAL_CLIENT_STATE.autolight_status
        request = telescope_pb2.TelescopeRequest(
            action=telescope_pb2.TelescopeAction.Value(ACTION_FOR_STATUS),
            autolight=current_autolight_flag
        )

        if self._health.is_down():
            return {"key": "KEY_AUTOLIGHT", "status": "UNKNOWN"}

        try:
            response = self.stub.SetAction(request, timeout=1.5)
            self._health.record_success()
            logger.debug(f"telescope_cloud response: {response}")
            logger.debug(f"autolight status: {response.autolight}")
            return {
                "key": "KEY_AUTOLIGHT",
                "status": "ON" if response.speed == telescope_pb2.TelescopeSpeed.SPEED_TRACKING else "OFF",
                "is_checkbox": True
            }

        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f" ❌ Error while fetching the autolight status: {e}")
            return {"key": "KEY_AUTOLIGHT", "status": "UNKNOWN"}
        except Exception as e:
            logger.error(f" ❌ Error while fetching the autolight status: {e}")
            return {"key": "KEY_AUTOLIGHT", "status": "UNKNOWN"}

    def set_action(self, action: telescope_pb2.TelescopeAction, autolight: bool = False):
        try:
            action_value = int(action.value)
        except AttributeError:
            # No .value (bare int instead of the enum wrapper): convert directly.
            action_value = int(action)
        """Sends an action (PARK or FLAT) to the telescope."""
        request = telescope_pb2.TelescopeRequest(action=action_value, autolight=autolight)
        if self._health.is_down():
            return {"error": CHANNEL_DOWN_MESSAGE}
        try:
            response = self.stub.SetAction(request, timeout=5.0)
            self._health.record_success()
            return self._parse_response(response)
        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f"\n🚨 gRPC error detected for action {action.name}: status code: {e.code().name}, details: {e.details()}")
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
        if self._health.is_down():
            return {"error": CHANNEL_DOWN_MESSAGE}
        try:
            response = self.stub.SetAction(request, timeout=1.5)
            self._health.record_success()
            return self._parse_response(response)
        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f"❌ gRPC error: the telescope service did not answer. Details: {e.details()}")
            return {"error": str(e.details())}

    def connect(self):
        """Connects the server to the telescope via SetAction."""
        action_enum = telescope_pb2.TELESCOPE_CONNECT
        request = telescope_pb2.TelescopeRequest(action=action_enum, autolight=False)

        logger.debug(f"Sending SetAction(TELESCOPE_CONNECT) to the gRPC server: {request}")
        logger.debug(f"Sending Connect to connect the telescope. {request}")
        if self._health.is_down():
            return {"error": CHANNEL_DOWN_MESSAGE}
        try:
            response = self.stub.SetAction(request, timeout=5.0)
            self._health.record_success()
            logger.debug(f"gRPC response: {response}")
            return self._parse_response(response)
        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f" ❌ gRPC error (telescope connection): {e.details()}")
            return {"error": str(e.details())}

    def disconnect(self):
        """Disconnects the server from the telescope."""
        action_enum = telescope_pb2.TELESCOPE_DISCONNECT
        request = telescope_pb2.TelescopeRequest(action=action_enum, autolight=False)
        if self._health.is_down():
            return {"error": CHANNEL_DOWN_MESSAGE}
        try:
            response = self.stub.SetAction(request, timeout=5.0)
            self._health.record_success()
            logger.debug(f"gRPC response to the disconnect request: {response}")
            return self._parse_response(response)
        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f" ❌ gRPC error: the service did not answer. {e.details()}")
            return {"error": str(e.details())}

    def _parse_response(self, response):
        """Helper function to parse the common TelescopeResponse."""
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

        # The CONNECT/DISCONNECT button the frontend reads from a top-level 'gui' key.
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
