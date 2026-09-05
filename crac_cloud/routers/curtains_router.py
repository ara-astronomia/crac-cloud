# routers/curtains_router.py
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from ..grpc_cloud.curtains_cloud import CurtainsClient
from crac_cloud.config import Config
from crac_protobuf import curtains_pb2

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/curtains" , tags=["Curtains"])

# Ottiene i dati di configurazione
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

# Inizializza il client gRPC
curtains_client = CurtainsClient(host=grpc_host, port=grpc_port)
logger.debug(f"Initialized CurtainsClient with host={grpc_host}, port={grpc_port}")
@router.get("/status")
def get_curtains_status():
    logger.debug("Ricevuta richiesta di stato tende")
    """Endpoint per ottenere lo stato attuale delle tende."""
    return curtains_client.get_status()

class CurtainsActionModel(BaseModel):
    action: str

@router.post("/control")
def set_curtains_action(data: CurtainsActionModel):
    """Endpoint per abilitare o disabilitare le paratie."""
    logger.info(f"Ricevuta richiesta di azione tende: {data.action}")
    try:
        action_enum = getattr(curtains_pb2, data.action)
        logger.debug(f"Converted action string to enum: {action_enum}")
        return curtains_client.set_action(action=action_enum)
    except AttributeError:
        logger.error(f"❌ Azione tende non valida: {data.action}")
        return {"error": "Invalid curtains action"}, 400

