import grpc


class FakeRpcError(grpc.RpcError):
    def __init__(self, msg="grpc error"):
        self._msg = msg

    def details(self):
        return self._msg

    def code(self):
        return grpc.StatusCode.UNAVAILABLE
