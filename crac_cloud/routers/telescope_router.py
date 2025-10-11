# routers/telescope_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..grpc_cloud.telescope_cloud import TelescopeClient
from crac_cloud.config import Config
from crac_protobuf import telescope_pb2

router = APIRouter(prefix="/telescope", tags=["Telescope"])

# Pydantic model for request validation
class TelescopeActionModel(BaseModel):
    action: str
    autolight: bool = False

# Get configuration and initialize the gRPC client
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

telescope_client = TelescopeClient(host=grpc_host, port=grpc_port)

@router.get("/status")
def get_telescope_status():
    """Endpoint per ottenere lo stato completo del telescopio (connessione, coordinate, stato)."""
    print("Ottenimento stato telescopio...")
    response_data = telescope_client.get_status()
    try:
        # Assumiamo che il gRPC client abbia un metodo get_status()
        response_data = telescope_client.get_status()
        
        # 🎯 Il frontend JS si aspetta la chiave 'status' e 'gui' (o 'buttons_gui' in questo caso)
        # La funzione del client deve parsare e restituire i dati nel formato corretto.
        return response_data
        
    except Exception as e:
        print(f"Errore nella richiesta di stato del telescopio: {e}")
        # In caso di errore gRPC, restituiamo un errore standard
        return {
            "status": "ERROR",
            "error": str(e),
            "gui": {"label": "LABEL_ERROR", "is_disabled": True}
        }


@router.post("/set_action")
def set_telescope_action(data: TelescopeActionModel):
    """Endpoint per inviare un'azione (CONNECT, DISCONNECT, PARK, FLAT) al telescopio."""
    print(f"Azione telescopio richiesta: {data.action}")
    try:
        action = data.action
        
        # 1. Gestione CONNECT/DISCONNECT
        if action == "TELESCOPE_CONNECT":
            print(f"Connessione al telescopio... {telescope_client}")
            return telescope_client.connect()
        elif action == "TELESCOPE_DISCONNECT":
            return telescope_client.disconnect()
            
        # 2. Gestione PARK/FLAT
        elif action in ["PARK_POSITION", "FLAT_POSITION"]:
            action_enum = getattr(telescope_pb2, action)
            return telescope_client.set_action(action=action_enum, autolight=data.autolight)
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Supported: CONNECT, DISCONNECT, PARK_POSITION, FLAT_POSITION.")

    except AttributeError:
        raise HTTPException(status_code=400, detail="Invalid telescope action")
    except Exception as e:
        # Gestione degli errori gRPC o di altro tipo
        raise HTTPException(status_code=500, detail=f"Failed to execute action: {e}")

# L'endpoint power_on è asincrono e dovrebbe usare HTTPException
    
@router.post("/telescope/power_on")
async def power_on_telescope():
    print(f"Powering on the telescope...{response_data}")
    # Chiama la logica del client/simulatore
    try:
        response_data = await telescope_client.power_on()
        return {"message": "Telescope powered on successfully", "status": response_data}
    except Exception as e:
        # Gestione degli errori, se il simulatore non risponde
        raise HTTPException(status_code=500, detail=f"Failed to power on: {e}")