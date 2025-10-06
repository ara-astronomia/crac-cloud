# routers/telescope_router.py
from fastapi import APIRouter
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

@router.post("/set_action")
def set_telescope_action(data: TelescopeActionModel):
    """Endpoint to send a PARK or FLAT action to the telescope."""
    try:
        print("test router telescope")
        # Validate that the action is either PARK_POSITION or FLAT_POSITION
        if data.action not in ["PARK_POSITION", "FLAT_POSITION"]:
            return {"error": "Invalid action. Only PARK_POSITION and FLAT_POSITION are supported."}, 400

        action_enum = getattr(telescope_pb2, data.action)
        return telescope_client.set_action(action=action_enum, autolight=data.autolight)
    except AttributeError:
        return {"error": "Invalid telescope action"}, 400
    
@router.post("/telescope/power_on")
async def power_on_telescope():
    print("Powering on the telescope...")
    # Chiama la logica del client/simulatore
    try:
        response_data = await telescope_client.power_on()
        return {"message": "Telescope powered on successfully", "status": response_data}
    except Exception as e:
        # Gestione degli errori, se il simulatore non risponde
        raise HTTPException(status_code=500, detail=f"Failed to power on: {e}")