# crac_cloud/routers/roof_router.py
import logging
from fastapi import APIRouter
from crac_cloud.grpc_cloud.roof_cloud import RoofClient
from crac_protobuf import roof_pb2
from crac_cloud.config import Config
from pydantic import BaseModel # ⬅️ Importa BaseModel

logger = logging.getLogger(__name__)

# ⬇️ NUOVA CLASSE PYDANTIC ⬇️
class RoofActionRequest(BaseModel):
    action: str

router = APIRouter(
    prefix="/roof",
    tags=["Roof Action"]
    )
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

roof_client = RoofClient(host=grpc_host, port=grpc_port)

# Aggiungi l'endpoint GET per lo stato
@router.get("/status")
def get_roof_status():
    """Endpoint per ottenere lo stato attuale del tetto."""
    return roof_client.get_status()

# Aggiungi l'endpoint POST per le azioni
@router.post("/set_action")
def set_action(request: RoofActionRequest):
    # ... logica per OPEN/CLOSE ...
    if request.action == "ROOF_OPEN":
        logger.info("Action requested: open the roof") # Debug utile
        # roof_client.set_action ora restituisce l'output parsificato
        return roof_client.set_action(roof_pb2.RoofAction.OPEN) 
        
    elif request.action == "ROOF_CLOSE":
        logger.info("Action requested: close the roof") # Debug utile
        return roof_client.set_action(roof_pb2.RoofAction.CLOSE)
        
    return {"status": "error", "message": f"Azione non valida: {request.action}"} 
