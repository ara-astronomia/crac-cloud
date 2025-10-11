# routers/chart_router.py
from fastapi import APIRouter
from ..grpc_cloud.chart_cloud import ChartClient
from crac_cloud.config import Config

router = APIRouter(prefix="/charts", tags=["Charts"])

# Ottiene i dati di configurazione dal file config.ini
config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

# Inizializza il client gRPC per i grafici
chart_client = ChartClient(host=grpc_host, port=grpc_port)

@router.get("/status")
def get_chart_status():
    """Endpoint per ottenere lo stato dei dati dei grafici e del meteo (usato per il loop di aggiornamento)."""
    return chart_client.get_status()

# ✅ NUOVA ROTTA: Ottiene la configurazione iniziale per i gauge D3.js
@router.get("/gauge-config")
def get_gauge_config():
    """Endpoint per ottenere la configurazione iniziale (min, max, value) dei gauge meteorologici."""
    
    # Chiama il client gRPC per ottenere tutti i dati (status, min, max, value, urn, ecc.)
    status_data = chart_client.get_status()
    
    if "error" in status_data:
        # Se c'è un errore gRPC (es. server CRAC spento), restituiamo un errore gestibile
        return status_data 

    # 🎯 CORREZIONE: Estrae la lista 'charts' e la converte in un dizionario mappato per URN
    if "charts" in status_data and isinstance(status_data["charts"], list):
        # Mappa la lista di chart in un dizionario {urn: chart_data}
        chart_map = {chart['urn']: chart for chart in status_data["charts"]}
        return chart_map
    
    # Restituisce un dizionario vuoto in caso di errore
    return {}

