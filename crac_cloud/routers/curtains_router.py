# routers/curtains_router.py
from fastapi import APIRouter
from pydantic import BaseModel
from ..grpc_cloud.curtains_cloud import CurtainsClient
from crac_cloud.config import Config
from crac_protobuf import curtains_pb2

router = APIRouter(prefix="/curtains" , tags=["Curtains"])

# Ottiene i dati di configurazione
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

# Inizializza il client gRPC
curtains_client = CurtainsClient(host=grpc_host, port=grpc_port)
print(f"Initialized CurtainsClient with host={grpc_host}, port={grpc_port}")
@router.get("/status")
def get_curtains_status():
    print("Ricevuta richiesta di stato tende")
    """Endpoint per ottenere lo stato attuale delle tende."""
    return curtains_client.get_status()

class CurtainsActionModel(BaseModel):
    action: str

@router.post("/control")
def set_curtains_action(data: CurtainsActionModel):
    """Endpoint per abilitare o disabilitare le paratie."""
    print(f"Ricevuta richiesta di azione tende: {data.action}")
    try:
        action_enum = getattr(curtains_pb2, data.action)
        print(f"Converted action string to enum: {action_enum}")
        return curtains_client.set_action(action=action_enum)
    except AttributeError:
        return {"error": "Invalid curtains action"}, 400

