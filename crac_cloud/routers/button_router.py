from fastapi import APIRouter
from pydantic import BaseModel
from crac_cloud.grpc_cloud.button_cloud import ButtonClient
from crac_protobuf import button_pb2
from crac_cloud.config import Config

# Definisci la classe Pydantic prima di usarla
class ButtonActionRequest(BaseModel):
    action: str
    key: str | None = None
    type: str = None

# Inizializza il router e il client gRPC
router = APIRouter(prefix="/buttons", tags=["Buttons"])
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

button_client = ButtonClient(host=grpc_host, port=grpc_port)

@router.post("/set_action")
async def set_action(request: ButtonActionRequest):
    """Gestisce le azioni dei pulsanti."""
    # Controlla che l'azione e la chiave siano corrette per Park e Flat
    if request.action == "BUTTON_DEFAULT_ACTION":
        if request.key == "KEY_PARK":
            return button_client.set_action(
                button_pb2.BUTTON_DEFAULT_ACTION,
                button_key= button_pb2.KEY_PARK
            )
        elif request.key == "KEY_FLAT":
            return button_client.set_action(
                button_pb2.BUTTON_DEFAULT_ACTION,
                button_key= button_pb2.KEY_FLAT
            )

    # Restituisce un errore se l'azione non è gestita
    return {"status": "error", "message": "Unknown action or key"}
'''
@router.get("/status")
def get_button_status():
    """Endpoint per ottenere lo stato di tutti i bottoni."""
    # Questo metodo usa il client gRPC per ottenere lo stato dei bottoni
    return button_client.get_status()
    '''