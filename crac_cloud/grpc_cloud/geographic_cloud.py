# crac_cloud/grpc_cloud/geographic_cloud.py

import grpc
from crac_protobuf import geographic_pb2
from crac_protobuf import geographic_pb2_grpc

class GeographicClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = geographic_pb2_grpc.GeographicServiceStub(self.channel)

    def get_geographic_data(self):
        request = geographic_pb2.GeographicRequest()
        try:
            response = self.stub.GetGeographicInfo(request)
            return {
                "latitude": response.latitude,
                "longitude": response.longitude,
                "elevation": response.elevation_meters,
            }
        except grpc.RpcError as e:
            # Gestione degli errori gRPC
            print(f"GRPC Error: {e.details()}")
            return None