import inspect
from unittest.mock import MagicMock
import crac_cloud.routers.button_router as button_router
from tests.conftest import FakeRpcError


class TestSetButtonActionRunsInThreadPool:
    def test_route_is_not_a_coroutine(self):
        """Il corpo e' interamente sincrono: async def bloccherebbe l'intero
        event loop di crac-cloud durante il comando, non solo questa richiesta."""
        assert not inspect.iscoroutinefunction(button_router.set_action)


class TestSetAutolightAction:
    def test_a_grpc_error_returns_an_error_payload_instead_of_crashing(self):
        """grpc non era importato: un vero errore gRPC sollevava NameError
        invece di essere gestito dall'except grpc.RpcError sottostante."""
        telescope_stub = MagicMock()
        telescope_stub.SetAction.side_effect = FakeRpcError("boom")

        result = button_router.set_autolight_action(True, telescope_stub)

        assert result == {"status": "error", "message": "Errore gRPC Autolight: boom"}
