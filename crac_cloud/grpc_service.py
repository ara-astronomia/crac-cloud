# crac_cloud/grpc_service.py
import grpc
from crac_cloud.config import Config
from crac_cloud.grpc_cloud.button_cloud import ButtonClient
from crac_cloud.grpc_cloud.curtains_cloud import CurtainsClient
from crac_cloud.grpc_cloud.roof_cloud import RoofClient
from crac_cloud.grpc_cloud.telescope_cloud import TelescopeClient
from crac_cloud.grpc_cloud.ups_cloud import UpsClient
from crac_cloud.grpc_cloud.chart_cloud import ChartClient
# Importa qui tutti gli altri client (TelescopeClient, RoofClient, ecc.)

class GrpcServiceContainer:
    """Contenitore per tutti i client gRPC dell'applicazione."""
    
    def __init__(self):
        config = Config.get_section("server")
        grpc_host = config.get("ip")
        grpc_port = int(config.get("port", "50051"))
        
        # Inizializza tutti i client una sola volta
        # N.B.: Ho forzato '127.0.0.1' qui per testare il loopback, come suggerito
        self.button_client = ButtonClient(host=grpc_host, port=grpc_port)
        self.curtains_client = CurtainsClient(host=grpc_host, port=grpc_port)
        self.telescope_client = TelescopeClient(host=grpc_host, port=grpc_port)
        self.roof_client = RoofClient(host=grpc_host, port=grpc_port)
        self.ups_client = UpsClient(host=grpc_host, port=grpc_port)
        self.chart_client = ChartClient(host=grpc_host, port=grpc_port)

# Istanza singola (Singleton) del container
grpc_container = GrpcServiceContainer()

def get_grpc_container():
    """Funzione di dipendenza di FastAPI per accedere ai client."""
    return grpc_container