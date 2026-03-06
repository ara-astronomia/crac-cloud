# crac_cloud/grpc_cloud/geographic_cloud.py
import logging
import grpc
from crac_protobuf import geographic_pb2
from crac_protobuf import geographic_pb2_grpc

logger = logging.getLogger(__name__)

class GeographicClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.aio.insecure_channel(f'{host}:{port}')
        self.stub = geographic_pb2_grpc.GeographicServiceStub(self.channel)

    async def get_geographic_data(self):
        request = geographic_pb2.GeographicRequest()
        logger.info("Requesting geographic data from server...")
        try:
            response = await self.stub.GetGeographicInfo(request)
            logger.info(f"Geographic data received: lat={response.latitude}, lon={response.longitude}, elev={response.elevation_meters}")
            return {
                "latitude": response.latitude,
                "longitude": response.longitude,
                "elevation": response.elevation_meters,
            }
        except grpc.RpcError as e:
            logger.error(f" ❌ GRPC Error: {e.details()}")
            return None
