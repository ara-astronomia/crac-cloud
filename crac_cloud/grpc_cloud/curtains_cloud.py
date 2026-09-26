# grpc_cloud/curtains_cloud.py
import logging
import grpc
from crac_protobuf import curtains_pb2
from crac_protobuf import curtains_pb2_grpc
from crac_protobuf import button_pb2
from crac_cloud.config import Config
from .channel_health import ChannelHealth, CHANNEL_DOWN_MESSAGE

logger = logging.getLogger(__name__)

STATUS_LABEL_MAP = {
    "CURTAIN_DISABLED": "Disattivata", 
    "CURTAIN_CLOSED": "Chiusa",     
    "CURTAIN_STOPPED": "Ferma",
    "CURTAIN_OPENED": "Aperta",
    "CURTAIN_ERROR": "Errore",
    "CURTAIN_DANGER": "Pericolo",
    "CURTAIN_OPENING": "Apertura",
    "CURTAIN_CLOSING": "Chiusura",
}

class CurtainsClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = curtains_pb2_grpc.CurtainStub(self.channel)
        self._health = ChannelHealth()
        encoder_config = Config.get_section("encoder_step")
        tende_config = Config.get_section("tende")

        self.N_STEP_CORSA = int(encoder_config.get("n_step_corsa", 205))
        self.ALPHA_MIN = float(tende_config.get("alpha_min", -12.0))
        self.MAX_ANGLE = float(tende_config.get("max_est", 70.0))  # assumes East/West are equal
        self.MIN_ANGLE = float(tende_config.get("park_est", 0.0))

        self.TOTAL_ANGLE_RANGE = self.MAX_ANGLE - self.ALPHA_MIN

        if self.N_STEP_CORSA > 0:
            self.DEGREE_PER_STEP = self.TOTAL_ANGLE_RANGE / self.N_STEP_CORSA
        else:
            self.DEGREE_PER_STEP = 0.0
            
        logger.debug(f"DEGREE_PER_STEP calculated: {self.DEGREE_PER_STEP}")

    def _steps_to_angle(self, steps):
        """Converts steps to an angle in degrees: (steps * DEGREE_PER_STEP) + ALPHA_MIN,
        clamped to [ALPHA_MIN, MAX_ANGLE]."""
        raw_angle = (steps * self.DEGREE_PER_STEP) + self.ALPHA_MIN
        clamped_angle = max(self.ALPHA_MIN, min(self.MAX_ANGLE, raw_angle))
        return float(clamped_angle)

    def set_action(self, action):
        request = curtains_pb2.CurtainsRequest(action=action)
        if self._health.is_down():
            return {"error": CHANNEL_DOWN_MESSAGE}
        try:
            response = self.stub.SetAction(request, timeout=5.0)
            self._health.record_success()
            logger.debug(f"Curtains SetAction response: {response}")
            return self._parse_response(response)
        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f" ❌ gRPC error (curtains action): {e.details()}")
            return {"error": str(e.details())}

    def get_status(self):
        """Fetches the curtains' status by sending the CHECK_CURTAIN action."""
        request = curtains_pb2.CurtainsRequest(action=curtains_pb2.CurtainsAction.CHECK_CURTAIN)
        if self._health.is_down():
            return {"error": CHANNEL_DOWN_MESSAGE}
        try:
            response = self.stub.SetAction(request, timeout=1.5)
            self._health.record_success()
            logger.debug(f"Curtains CheckCurtain response: {response}")
            try:
                return self._parse_response(response)
            except Exception as parse_error:
                logger.error(f" ❌ Parsing error in _parse_response: {parse_error}")
                return {"error": f"Parsing failed: {parse_error}", "curtains": []}
        except grpc.RpcError as e:
            self._health.record_failure()
            logger.error(f" ❌ gRPC error (curtains status): {e.details()}")
            return {"error": str(e.details())}
    
    def _parse_response(self, response):
        curtains_data = []
        for curtain in response.curtains:
            status_enum_name = self._get_enum_name(curtain.status, curtains_pb2.CurtainStatus)
            orientation_enum_name = self._get_enum_name(curtain.orientation, curtains_pb2.CurtainOrientation)
            steps_value = curtain.steps

            # Kept as raw enum: the frontend maps it to text/color via STATUS_LABELS_MAP.
            status_enum_label = status_enum_name
            status_ui_text = STATUS_LABEL_MAP.get(status_enum_name, status_enum_name)
            logger.debug(f"Status curtain:{orientation_enum_name}, {steps_value}, {status_ui_text}")

            curtains_data.append({
                "orientation": orientation_enum_name,
                "status": status_enum_label,
                "steps": steps_value,
                "angle": self._steps_to_angle(steps_value)
            })
        buttons_data = []
        for button in response.buttons_gui:
            label_name = self._get_enum_name(button.label, button_pb2.ButtonLabel)
            key_name = self._get_enum_name(button.key, button_pb2.ButtonKey)
            
            buttons_data.append({
                "metadata": button.metadata,
                "label": label_name,
                "is_disabled": button.is_disabled,
                "button_color": {
                    "text_color": button.button_color.text_color,
                    "background_color": button.button_color.background_color,
                },
                "key": key_name,
            })
        return {
            "curtains": curtains_data,
            "buttons_gui": buttons_data,
        }
    def _get_enum_name(self, enum_value, enum_class):
        """Maps a numeric enum value to its name (e.g. 1 -> EAST) using the given enum class."""
        try:
            enum_descriptor = enum_class.DESCRIPTOR
            enum_value_desc = enum_descriptor.values_by_number.get(enum_value)

            if enum_value_desc:
                return enum_value_desc.name
            
            return str(enum_value) 
                
        except Exception as e:
            logger.error(f" ❌ Enum conversion error {enum_class.__name__}: {e}")
            return str(enum_value)