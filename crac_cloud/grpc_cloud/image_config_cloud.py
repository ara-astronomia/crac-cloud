# crac_cloud/grpc_cloud/image_config_cloud.py

import grpc
from crac_protobuf import data_image_pb2
from crac_protobuf import data_image_pb2_grpc

class ImageConfigClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = data_image_pb2_grpc.ImageConfigServiceStub(self.channel)

    def get_ccd_image_data(self):
        request = data_image_pb2.ImageConfigRequest()
        try:
            response = self.stub.GetCCDImageData(request)
            return {
                "width": response.field_of_view_width,
                "height": response.field_of_view_height
            }
        except grpc.RpcError as e:
            print(f"GRPC Error fetching image config: {e.details()}")
            return None