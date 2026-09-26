import inspect
import pytest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
import crac_cloud.routers.roof_router as roof_router
from tests.conftest import FakeRpcError

app = FastAPI()
app.include_router(roof_router.router)
http = TestClient(app)

@pytest.fixture(autouse=True)
def _reset_roof_channel_health():
    """roof_client e' un singleton di modulo: un test che fa fallire una
    chiamata reale marcherebbe il canale giu' anche per i test successivi."""
    roof_router.roof_client._health.record_success()


_PARSED_OK = {
    "status": "ROOF_OPEN",
    "gui": {
        "metadata": "meta",
        "label": "LABEL_OPEN",
        "is_disabled": False,
        "button_color": {"text_color": "white", "background_color": "green"},
    },
}


class TestGetRoofStatus:
    def test_returns_parsed_data(self):
        with patch.object(roof_router.roof_client.stub, "SetAction", return_value=MagicMock()), \
             patch.object(roof_router.roof_client, "_parse_roof_response", return_value=_PARSED_OK):
            resp = http.get("/roof/status")
        assert resp.status_code == 200
        assert resp.json() == _PARSED_OK

    def test_grpc_error_returns_error_status(self):
        with patch.object(roof_router.roof_client.stub, "SetAction", side_effect=FakeRpcError()):
            resp = http.get("/roof/status")
        body = resp.json()
        assert resp.status_code == 200
        assert body["status"] == "ERROR"
        assert body["gui"]["is_disabled"] is True

    def test_uses_short_timeout_for_a_fast_read(self):
        """Lo status risponde in pochi ms a stack sano: senza un timeout
        esplicito la richiesta puo' restare appesa a tempo indefinito quando
        crac-server non risponde."""
        captured = {}

        def fake_set_action(request, **kwargs):
            captured.update(kwargs)
            return MagicMock()

        with patch.object(roof_router.roof_client.stub, "SetAction", side_effect=fake_set_action), \
             patch.object(roof_router.roof_client, "_parse_roof_response", return_value=_PARSED_OK):
            http.get("/roof/status")

        assert captured["timeout"] == 1.5

    def test_skips_the_call_when_the_channel_is_down(self):
        with patch.object(roof_router.roof_client._health, "is_down", return_value=True), \
             patch.object(roof_router.roof_client.stub, "SetAction") as mock_set_action:
            resp = http.get("/roof/status")

        mock_set_action.assert_not_called()
        assert resp.status_code == 200
        assert resp.json()["status"] == "ERROR"


class TestSetRoofActionRunsInThreadPool:
    def test_route_is_not_a_coroutine(self):
        """Il corpo e' interamente sincrono: async def bloccherebbe l'intero
        event loop di crac-cloud durante il comando, non solo questa richiesta."""
        assert not inspect.iscoroutinefunction(roof_router.set_action)


class TestSetRoofAction:
    def test_open_delegates_to_client(self):
        with patch.object(roof_router.roof_client, "set_action", return_value=_PARSED_OK) as mock_sa:
            resp = http.post("/roof/set_action", json={"action": "ROOF_OPEN"})
        assert resp.status_code == 200
        mock_sa.assert_called_once()

    def test_close_delegates_to_client(self):
        with patch.object(roof_router.roof_client, "set_action", return_value=_PARSED_OK) as mock_sa:
            resp = http.post("/roof/set_action", json={"action": "ROOF_CLOSE"})
        assert resp.status_code == 200
        mock_sa.assert_called_once()

    def test_unknown_action_returns_error(self):
        resp = http.post("/roof/set_action", json={"action": "INVALID_ACTION"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "error"
