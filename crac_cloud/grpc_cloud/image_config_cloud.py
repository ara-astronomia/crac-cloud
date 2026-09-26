import logging
import grpc.aio
from crac_protobuf import data_image_pb2
from crac_protobuf import data_image_pb2_grpc
from .rpc import FAST_READ_TIMEOUT

logger = logging.getLogger(__name__)

class ImageConfigClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.aio.insecure_channel(f"{host}:{port}")
        logger.debug(f"ImageConfigClient: async gRPC channel created for {host}:{port}")
        self.stub = data_image_pb2_grpc.ImageConfigServiceStub(self.channel)

    async def get_ccd_image_data(self):
        request = data_image_pb2.ImageConfigRequest()
        logger.debug("Requesting CCD image config data from server...")

        try:
            response = await self.stub.GetCCDImageData(request, timeout=FAST_READ_TIMEOUT)

            logger.debug(
                f"Image config data received: width={response.field_of_view_width}, height={response.field_of_view_height}"
            )

            return {
                "width": response.field_of_view_width,
                "height": response.field_of_view_height
            }

        except grpc.RpcError as e:
            logger.error(f"❌ GRPC Error fetching image config: {e.details()}")
            return None
