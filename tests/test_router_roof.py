import inspect
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
import crac_cloud.routers.roof_router as roof_router

app = FastAPI()
app.include_router(roof_router.router)
http = TestClient(app)

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
    """Timeouts and error handling are tested on RoofClient.get_status()."""

    def test_delegates_to_the_client(self):
        with patch.object(roof_router.roof_client, "get_status", return_value=_PARSED_OK) as mock:
            resp = http.get("/roof/status")

        mock.assert_called_once()
        assert resp.status_code == 200
        assert resp.json() == _PARSED_OK


class TestSetActionIsSync:
    def test_route_is_not_a_coroutine(self):
        """Runs in FastAPI's threadpool, so a slow gRPC call cannot block the event loop."""
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
