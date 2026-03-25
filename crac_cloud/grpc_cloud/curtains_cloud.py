# grpc_cloud/curtains_cloud.py
import logging
import grpc
from crac_protobuf import curtains_pb2
from crac_protobuf import curtains_pb2_grpc
from crac_protobuf import button_pb2
from crac_cloud.config import Config

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
        encoder_config = Config.get_section("encoder_step")
        tende_config = Config.get_section("tende")

        self.N_STEP_CORSA = int(encoder_config.get("n_step_corsa", 205))
        self.ALPHA_MIN = float(tende_config.get("alpha_min", -12.0))
        self.MAX_ANGLE = float(tende_config.get("max_est", 70.0))# Assume che Est/West siano uguali
        self.MIN_ANGLE = float(tende_config.get("park_est", 0.0))
        
        # 1. Calcola l'escursione angolare totale (es. 70 - (-12) = 82 gradi)
        self.TOTAL_ANGLE_RANGE = self.MAX_ANGLE - self.ALPHA_MIN
        
        # 2. Calcola la costante: Quanti gradi per ogni step?
        if self.N_STEP_CORSA > 0:
            self.DEGREE_PER_STEP = self.TOTAL_ANGLE_RANGE / self.N_STEP_CORSA
        else:
            self.DEGREE_PER_STEP = 0.0
            
        logger.debug(f"DEGREE_PER_STEP calculated: {self.DEGREE_PER_STEP}")

    def _steps_to_angle(self, steps):
        """
        Converte i passi (steps) in un angolo in gradi, tenendo conto dell'offset ALPHA_MIN.
        Angolo = (Steps * DEGREE_PER_STEP) + ALPHA_MIN
        """
        
        # Calcola l'angolo grezzo
        raw_angle = (steps * self.DEGREE_PER_STEP) + self.ALPHA_MIN
        
        # 2. Limita l'angolo all'intervallo valido (clamping)
        # L'angolo deve essere compreso tra il valore di park/minimo (-12.0) e il massimo (70.0)
        clamped_angle = max(self.ALPHA_MIN, min(self.MAX_ANGLE, raw_angle))
        
        return float(clamped_angle)

    def set_action(self, action):
        request = curtains_pb2.CurtainsRequest(action=action)
        try:
            response = self.stub.SetAction(request)
            logger.debug(f"DEBUG stato tende: {response}")  # Stampa l'intero oggetto di risposta per il debug  
            return self._parse_response(response)
        except grpc.RpcError as e:
            return {"error": str(e.details())}
    
    def get_status(self):
        """Ottiene lo stato delle tende inviando l'azione CHECK_CURTAIN."""
        request = curtains_pb2.CurtainsRequest(action=curtains_pb2.CurtainsAction.CHECK_CURTAIN)
        try:
            response = self.stub.SetAction(request)
            logger.debug(f"DEBUG stato tende: {response}")  # Stampa l'intero oggetto di risposta per il debug
            try:
                return self._parse_response(response) # 🛑 Il crash avviene qui
            except Exception as parse_error:
                logger.error(f" ❌ ERRORE DI PARSING in _parse_response: {parse_error}")
                return {"error": f"Parsing failed: {parse_error}", "curtains": []}
        except grpc.RpcError as e:
            return {"error": str(e.details())}
    
    def _parse_response(self, response):
    # --- 1. Parsing degli oggetti 'curtains' ---
        curtains_data = []
        for curtain in response.curtains:
            status_enum_name = self._get_enum_name(curtain.status, curtains_pb2.CurtainStatus)

            # 2. Mappatura dell'ORIENTAMENTO
            orientation_enum_name = self._get_enum_name(curtain.orientation, curtains_pb2.CurtainOrientation)
            steps_value = curtain.steps

            # 3. Mantieni enum come stato e orientamento grezzi per il frontend
            #    Il frontend mappa poi in testo/colore usando STATUS_LABELS_MAP
            status_enum_label = status_enum_name
            status_ui_text = STATUS_LABEL_MAP.get(status_enum_name, status_enum_name)
            logger.info(f"Status curtain:{orientation_enum_name}, {steps_value}, {status_ui_text}")

            curtains_data.append({
                "orientation": orientation_enum_name,
                "status": status_enum_label,
                "steps": steps_value,
                "angle": self._steps_to_angle(steps_value)
            })
        # --- 2. Parsing degli oggetti 'buttons_gui' ---
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
        #logger.debug(f"Parsed buttons data: {buttons_data}")
        # --- 3. Restituisci la struttura completa ---
        return {
            "curtains": curtains_data,
            "buttons_gui": buttons_data,
        }
    def _get_enum_name(self, enum_value, enum_class):
        """
        Mappa un valore numerico ENUM alla sua stringa (es. 1 -> EAST), 
        usando la classe ENUM fornita.
        """
        try:
            # Usiamo il descrittore della CLASSE ENUM fornita (es. CurtainOrientation)
            enum_descriptor = enum_class.DESCRIPTOR
            
            # Ottiene l'oggetto EnumValueDescriptor
            enum_value_desc = enum_descriptor.values_by_number.get(enum_value)
            
            if enum_value_desc:
                full_name = enum_value_desc.name # Es: 'CURTAIN_EAST'
                
                # Restituisce solo l'ultima parte della stringa (es: 'EAST')
                # Questo è essenziale per avere 'EAST' e non 'CURTAIN_EAST'
                return full_name
            
            return str(enum_value) 
                
        except Exception as e:
            logger.error(f" ❌ ERRORE di conversione ENUM {enum_class.__name__}: {e}")
            return str(enum_value)