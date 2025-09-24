# routers/chart_router.py
from fastapi import APIRouter
from ..grpc_cloud.chart_cloud import ChartClient
from crac_cloud.config import Config

router = APIRouter(prefix="/charts", tags=["Charts"])

# Ottiene i dati di configurazione dal file config.ini
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")  # Usa un valore di default in caso di errore
grpc_port = int(config.get("port", "50051")) # Converte la porta in intero

# Inizializza il client gRPC per i grafici
chart_client = ChartClient(host=grpc_host, port=grpc_port)

@router.get("/status")
def get_chart_status():
    """Endpoint per ottenere lo stato dei dati dei grafici e del meteo."""
    return chart_client.get_status()