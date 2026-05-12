# crac_cloud/grpc_service.py

import grpc
from crac_cloud.config import Config

from crac_cloud.grpc_cloud.button_cloud import ButtonClient
from crac_cloud.grpc_cloud.curtains_cloud import CurtainsClient
from crac_cloud.grpc_cloud.roof_cloud import RoofClient
from crac_cloud.grpc_cloud.telescope_cloud import TelescopeClient
from crac_cloud.grpc_cloud.ups_cloud import UpsClient
from crac_cloud.grpc_cloud.chart_cloud import ChartClient
from crac_cloud.grpc_cloud.cover_mirror_cloud import CoverMirrorClient  
from crac_cloud.grpc_cloud.geographic_cloud import GeographicClient
from crac_cloud.grpc_cloud.image_config_cloud import ImageConfigClient


class GrpcServiceContainer:
    """Contenitore per tutti i client gRPC dell'applicazione."""
    
    def __init__(self):
        config = Config.get_section("server")
        grpc_host = config.get("ip")
        grpc_port = int(config.get("port", "50051"))

        # Inizializza tutti i client gRPC
        self.button_client = ButtonClient(host=grpc_host, port=grpc_port)
        self.curtains_client = CurtainsClient(host=grpc_host, port=grpc_port)
        self.telescope_client = TelescopeClient(host=grpc_host, port=grpc_port)
        self.roof_client = RoofClient(host=grpc_host, port=grpc_port)
        self.ups_client = UpsClient(host=grpc_host, port=grpc_port)
        self.chart_client = ChartClient(host=grpc_host, port=grpc_port)
        self.geographic_client = GeographicClient(host=grpc_host, port=grpc_port)
        self.image_config_client = ImageConfigClient(host=grpc_host, port=grpc_port)
            # Aggiungi il client per la copertura dello specchio    
        self.cover_mirror_client = CoverMirrorClient(host=grpc_host, port=grpc_port)    


# Singleton
grpc_container = GrpcServiceContainer()

def get_grpc_container():
    return grpc_container
