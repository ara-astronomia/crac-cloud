# crac_cloud/routers/roof_router.py
from fastapi import APIRouter
from crac_cloud.grpc_cloud.roof_cloud import RoofClient
from crac_protobuf import roof_pb2
from crac_cloud.config import Config
from pydantic import BaseModel # ⬅️ Importa BaseModel

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
    #print("Ottenimento stato tetto...")
    """Endpoint per ottenere lo stato attuale del tetto."""
    try:
        # L'azione CHECK_ROOF è definita nel tuo roof.proto
        request = roof_pb2.RoofRequest(action=roof_pb2.RoofAction.CHECK_ROOF)
        response = roof_client.stub.SetAction(request)
        parsed_data = roof_client._parse_roof_response(response)
        #print (f"Risposta completa inviata al frontend: {parsed_data}") 
        return roof_client._parse_roof_response(response) 
        #return {"status": roof_pb2.RoofStatus.Name(response.status)}
    except Exception as e:
        print(f"Errore nella richiesta di stato del tetto: {e}")
        # Restituisci uno stato di errore ben definito
        return {
            "status": "ERROR",
            "gui": {
                "label": "LABEL_ERROR",
                "is_disabled": True,
                "button_color": {"text_color": "white", "background_color": "red"}
            },
            "error": str(e)
        }

# Aggiungi l'endpoint POST per le azioni
@router.post("/set_action")
async def set_action(request: RoofActionRequest):
    #print(f"Azione richiesta: {request.action}") # Debug utile
    
    # ... logica per OPEN/CLOSE ...
    if request.action == "ROOF_OPEN":
        # roof_client.set_action ora restituisce l'output parsificato
        return roof_client.set_action(roof_pb2.RoofAction.OPEN) 
        
    elif request.action == "ROOF_CLOSE":
        return roof_client.set_action(roof_pb2.RoofAction.CLOSE)
        
    return {"status": "error", "message": f"Azione non valida: {request.action}"} 
