# routers/curtains_router.py
from fastapi import APIRouter
from pydantic import BaseModel
from ..grpc_cloud.curtains_cloud import CurtainsClient
from crac_cloud.config import Config
from crac_protobuf import curtains_pb2

router = APIRouter(prefix="/curtains") #, tags=["Curtains"])

# Ottiene i dati di configurazione
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

# Inizializza il client gRPC
curtains_client = CurtainsClient(host=grpc_host, port=grpc_port)
@router.get("/status")
def get_curtains_status():
    """Endpoint per ottenere lo stato attuale delle tende."""
    return curtains_client.get_status()

@router.post("/set_action")
async def set_action(action: str):
    # La tua logica per i comandi di apertura/chiusura
    pass

'''

class CurtainsActionModel(BaseModel):
    action: str

@router.post("/set_action")
def set_curtains_action(data: CurtainsActionModel):
    """Endpoint per abilitare o disabilitare le paratie."""
    try:
        action_enum = getattr(curtains_pb2, data.action)
        return curtains_client.set_action(action=action_enum)
    except AttributeError:
        return {"error": "Invalid curtains action"}, 400

@router.get("/status")
def get_curtains_status():
    """Endpoint per ottenere lo stato attuale delle paratie."""
    return curtains_client.get_status()
    '''