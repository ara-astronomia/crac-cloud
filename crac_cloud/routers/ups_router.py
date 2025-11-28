# routers/ups_router.py
from fastapi import APIRouter
from ..grpc_cloud.ups_cloud import UpsClient
from crac_cloud.config import Config

router = APIRouter(prefix="/ups", tags=["UPS"])
#print("Ups router initialized")
#print(router)

# Ottiene i dati di configurazione
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

# Inizializza il client gRPC per gli UPS
ups_client = UpsClient(host=grpc_host, port=grpc_port)

@router.get("/status")
def get_ups_status():
    """Endpoint per ottenere lo stato degli UPS."""
    #print(f"stato UPS: {ups_client}")
    return ups_client.get_status()