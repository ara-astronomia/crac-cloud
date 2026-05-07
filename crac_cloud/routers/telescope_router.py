# routers/telescope_router.py
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..grpc_cloud.telescope_cloud import TelescopeClient
from crac_cloud.config import Config
from crac_protobuf import telescope_pb2

logger = logging.getLogger(__name__)

from ..state import GLOBAL_CLIENT_STATE

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
    try:
        return telescope_client.get_status()
    except Exception as e:
        logger.error(f"❌ Errore nella richiesta di stato del telescopio: {e}")
        return {
            "status": "ERROR",
            "error": str(e),
            "gui": {"label": "LABEL_ERROR", "is_disabled": True}
        }


@router.post("/set_action")
def set_telescope_action(data: TelescopeActionModel):
    """Endpoint per inviare un'azione (CONNECT, DISCONNECT, PARK, FLAT) al telescopio."""

    try:
        action = data.action
        
        # 1. Gestione CONNECT/DISCONNECT
        if action == "TELESCOPE_CONNECT":
            logger.info(f"Connessione al telescopio... {telescope_client}") 
            return telescope_client.connect()
        elif action == "TELESCOPE_DISCONNECT":
            logger.info(f"Disconnetto il telescopio... {telescope_client}")
            return telescope_client.disconnect()
            
        # 2. Gestione PARK/FLAT
        elif action in ["PARK_POSITION", "FLAT_POSITION", "CHECK_TELESCOPE"]:
            GLOBAL_CLIENT_STATE.autolight_status = data.autolight
            try:
                action_name_in_pb2 = action 
                action_enum = getattr(telescope_pb2, action_name_in_pb2)
                logger.info(f"action enum: {action_enum}, {action_name_in_pb2}")
            except AttributeError:
                # 🎯 TENTA 2: Se fallisce, tenta l'accesso diretto alla classe ENUM (la tua versione)
                action_enum = getattr(telescope_pb2.TelescopeAction, action)#autolight1=data.autolight
                logger.info(f'action_enum: {action_enum}')            
            return telescope_client.set_action(action=action_enum, autolight=data.autolight)
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Supported: CONNECT, DISCONNECT, PARK_POSITION, FLAT_POSITION.")

    except HTTPException:
        raise
    except AttributeError:
        raise HTTPException(status_code=400, detail="Invalid telescope action")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute action: {e}")

# L'endpoint power_on è asincrono e dovrebbe usare HTTPException
    
@router.post("/telescope/power_on")
async def power_on_telescope():
    # Chiama la logica del client/simulatore
    try:
        response_data = await telescope_client.power_on()
        return {"message": "Telescope powered on successfully", "status": response_data}
    except Exception as e:
        logger.error(f"❌ Errore durante l'accensione del telescopio: {e}")
        # Gestione degli errori, se il simulatore non risponde
        raise HTTPException(status_code=500, detail=f"Failed to power on: {e}")