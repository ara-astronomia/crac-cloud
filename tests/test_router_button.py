import inspect
from unittest.mock import MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from crac_protobuf import button_pb2
import crac_cloud.routers.button_router as button_router
from crac_cloud.grpc_cloud.rpc import COMMAND_TIMEOUT
from crac_cloud.grpc_service import get_grpc_container
from tests.conftest import FakeRpcError


def _http_with(service):
    app = FastAPI()
    app.include_router(button_router.router)
    app.dependency_overrides[get_grpc_container] = lambda: service
    return TestClient(app)


class TestSetActionIsSync:
    def test_route_is_not_a_coroutine(self):
        """Runs in FastAPI's threadpool, so a slow gRPC call cannot block the event loop."""
        assert not inspect.iscoroutinefunction(button_router.set_action)


class TestSetAction:
    def test_turn_on_flips_a_switch_that_is_on(self):
        service = MagicMock()
        service.button_client.get_single_switch_status.return_value = {"status": "ON"}
        service.button_client.set_switch_action.return_value = {"status": "OFF"}

        resp = _http_with(service).post("/buttons/set_action", json={"action": "TURN_ON", "key": "KEY_DOME_LIGHT"})

        assert resp.json() == {"status": "OFF"}
        service.button_client.set_switch_action.assert_called_once_with(
            action=button_pb2.ButtonAction.TURN_OFF,
            button_type=button_pb2.ButtonType.Value("DOME_LIGHT"),
        )

    def test_check_button_sets_the_autolight(self):
        sent = []
        service = MagicMock()
        service.telescope_client.stub.SetAction.side_effect = lambda request, **kwargs: sent.append(request)

        resp = _http_with(service).post("/buttons/set_action", json={"action": "CHECK_BUTTON", "key": "KEY_AUTOLIGHT", "value": True})

        assert resp.json() == {"status": "ok", "message": "Autolight impostato"}
        assert [request.autolight for request in sent] == [True]

    def test_default_action_is_sent_as_is(self):
        service = MagicMock()
        service.button_client.set_switch_action.return_value = {"status": "ok"}

        _http_with(service).post("/buttons/set_action", json={"action": "BUTTON_DEFAULT_ACTION", "key": "KEY_PARK"})

        service.button_client.set_switch_action.assert_called_once_with(
            action=button_pb2.ButtonAction.Value("BUTTON_DEFAULT_ACTION"),
            button_type=button_pb2.ButtonType.Value("TELE_SWITCH"),
        )

    def test_unknown_action_returns_an_error(self):
        resp = _http_with(MagicMock()).post("/buttons/set_action", json={"action": "NOPE"})

        assert resp.json()["status"] == "error"


class TestSetAutolightAction:
    def test_a_grpc_error_returns_an_error_payload(self):
        telescope_stub = MagicMock()
        telescope_stub.SetAction.side_effect = FakeRpcError("boom")

        result = button_router.set_autolight_action(True, telescope_stub)

        assert result == {"status": "error", "message": "Errore gRPC Autolight: boom"}

    def test_uses_a_command_timeout(self):
        captured = {}

        def fake_set_action(request, **kwargs):
            captured.update(kwargs)

        telescope_stub = MagicMock()
        telescope_stub.SetAction.side_effect = fake_set_action

        button_router.set_autolight_action(True, telescope_stub)

        assert captured["timeout"] == COMMAND_TIMEOUT
