# crac_cloud/routers/roof_router.py
from fastapi import APIRouter
from crac_cloud.grpc_cloud.roof_cloud import RoofClient
from crac_protobuf import roof_pb2
from crac_cloud.config import Config

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
async def set_action(action: str):
    if action == "OPEN":
        return roof_client.set_action(roof_pb2.OPEN)
    elif action == "CLOSE":
        return roof_client.set_action(roof_pb2.CLOSE)
    return {"status": "error", "message": "Azione non valida."}