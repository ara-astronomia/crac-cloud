import inspect
from unittest.mock import MagicMock
import crac_cloud.routers.button_router as button_router
from tests.conftest import FakeRpcError


class TestSetButtonActionRunsInThreadPool:
    def test_route_is_not_a_coroutine(self):
        """The body is entirely synchronous: async def would block the whole
        event loop of crac-cloud during the command, not just this request."""
        assert not inspect.iscoroutinefunction(button_router.set_action)


class TestSetAutolightAction:
    def test_a_grpc_error_returns_an_error_payload_instead_of_crashing(self):
        """grpc wasn't imported: a real gRPC error raised NameError instead
        of being handled by the except grpc.RpcError below."""
        telescope_stub = MagicMock()
        telescope_stub.SetAction.side_effect = FakeRpcError("boom")

        result = button_router.set_autolight_action(True, telescope_stub)

        assert result == {"status": "error", "message": "Errore gRPC Autolight: boom"}
