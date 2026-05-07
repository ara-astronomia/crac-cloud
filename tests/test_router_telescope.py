from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
import crac_cloud.routers.telescope_router as telescope_router

app = FastAPI()
app.include_router(telescope_router.router)
http = TestClient(app)

_STATUS_OK = {
    "status": "TELESCOPE_TRACKING",
    "eq_coords": {"ra": 10.0, "dec": 20.0},
    "aa_coords": {"alt": 45.0, "az": 180.0},
    "speed": "SPEED_TRACKING",
    "pier_side": "PIER_WEST",
    "buttons_gui": [],
    "gui": {"label": "LABEL_DISCONNECT", "is_disabled": False, "is_visible": True},
}


class TestGetTelescopeStatus:
    def test_returns_client_output(self):
        with patch.object(telescope_router.telescope_client, "get_status", return_value=_STATUS_OK):
            resp = http.get("/telescope/status")
        assert resp.status_code == 200
        assert resp.json() == _STATUS_OK

    def test_exception_returns_error_response(self):
        with patch.object(telescope_router.telescope_client, "get_status", side_effect=Exception("down")):
            resp = http.get("/telescope/status")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ERROR"


class TestSetTelescopeAction:
    def test_connect_delegates_to_client(self):
        with patch.object(telescope_router.telescope_client, "connect", return_value=_STATUS_OK) as mock:
            resp = http.post("/telescope/set_action", json={"action": "TELESCOPE_CONNECT"})
        assert resp.status_code == 200
        mock.assert_called_once()

    def test_disconnect_delegates_to_client(self):
        with patch.object(telescope_router.telescope_client, "disconnect", return_value=_STATUS_OK) as mock:
            resp = http.post("/telescope/set_action", json={"action": "TELESCOPE_DISCONNECT"})
        assert resp.status_code == 200
        mock.assert_called_once()

    def test_park_position_delegates_to_set_action(self):
        with patch.object(telescope_router.telescope_client, "set_action", return_value=_STATUS_OK) as mock:
            resp = http.post("/telescope/set_action", json={"action": "PARK_POSITION", "autolight": False})
        assert resp.status_code == 200
        mock.assert_called_once()

    def test_unsupported_action_returns_400(self):
        resp = http.post("/telescope/set_action", json={"action": "INVALID_ACTION_XYZ"})
        assert resp.status_code == 400
