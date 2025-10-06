# crac_cloud/routers/roof_router.py
from fastapi import APIRouter
from crac_cloud.grpc_cloud.roof_cloud import RoofClient
from crac_protobuf import roof_pb2
from crac_cloud.config import Config
from pydantic import BaseModel # ⬅️ Importa BaseModel

# ⬇️ NUOVA CLASSE PYDANTIC ⬇️
class RoofActionRequest(BaseModel):
    action: str

router = APIRouter(prefix="/roof")
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

roof_client = RoofClient(host=grpc_host, port=grpc_port)

# Aggiungi l'endpoint GET per lo stato
@router.get("/status")
def get_roof_status():
    """Endpoint per ottenere lo stato attuale del tetto."""
    try:
        # L'azione CHECK_ROOF è definita nel tuo roof.proto
        request = roof_pb2.RoofRequest(action=roof_pb2.RoofAction.CHECK_ROOF)
        response = roof_client.stub.SetAction(request)
        return {"status": roof_pb2.RoofStatus.Name(response.status)}
    except Exception as e:
        return {"error": str(e)}

# Aggiungi l'endpoint POST per le azioni
@router.post("/set_action")
async def set_action(request: RoofActionRequest):
    
    print(f"Azione richiesta: {request.action}") # Debug utile
    
    # Assicurati che il tuo client gRPC (roof_client) usi le costanti enum corrette 
    # e che il metodo set_action sia definito nello stub gRPC.
    
    if request.action == "OPEN":
        print("Tentativo di apertura tetto...")
        # Usa l'azione Enum completa per chiarezza
        return roof_client.set_action(roof_pb2.RoofAction.OPEN) 
        
    elif request.action == "CLOSE":
        print("Tentativo di chiusura tetto...")
        # Usa l'azione Enum completa per chiarezza
        return roof_client.set_action(roof_pb2.RoofAction.CLOSE)
        
    # Questo return è ESSENZIALE se nessuna delle condizioni è soddisfatta
    return {"status": "error", "message": f"Azione non valida: {request.action}"}
    
