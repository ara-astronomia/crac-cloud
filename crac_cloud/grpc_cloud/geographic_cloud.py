import logging
import grpc
from crac_protobuf import geographic_pb2
from crac_protobuf import geographic_pb2_grpc
from .rpc import FAST_READ_TIMEOUT

logger = logging.getLogger(__name__)

class GeographicClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.aio.insecure_channel(f'{host}:{port}')
        self.stub = geographic_pb2_grpc.GeographicServiceStub(self.channel)

    async def get_geographic_data(self):
        request = geographic_pb2.GeographicRequest()
        logger.debug("Requesting geographic data from server...")
        try:
            response = await self.stub.GetGeographicInfo(request, timeout=FAST_READ_TIMEOUT)
            logger.debug(f"Geographic data received: lat={response.latitude}, lon={response.longitude}, elev={response.elevation_meters}")
            return {
                "latitude": response.latitude,
                "longitude": response.longitude,
                "elevation": response.elevation_meters,
            }
        except grpc.RpcError as e:
            logger.error(f" ❌ GRPC Error: {e.details()}")
            return None
