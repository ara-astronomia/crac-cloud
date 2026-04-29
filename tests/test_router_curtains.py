from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
import crac_cloud.routers.curtains_router as curtains_router

app = FastAPI()
app.include_router(curtains_router.router)
http = TestClient(app)

_STATUS_OK = {
    "curtains": [
        {"orientation": "CURTAIN_EAST", "status": "CURTAIN_OPENED", "steps": 100, "angle": 28.0}
    ],
    "buttons_gui": [],
}


class TestGetCurtainsStatus:
    def test_returns_client_output(self):
        with patch.object(curtains_router.curtains_client, "get_status", return_value=_STATUS_OK):
            resp = http.get("/curtains/status")
        assert resp.status_code == 200
        assert resp.json() == _STATUS_OK


class TestSetCurtainsAction:
    def test_valid_enum_action_delegates_to_client(self):
        with patch.object(curtains_router.curtains_client, "set_action", return_value=_STATUS_OK) as mock_sa:
            resp = http.post("/curtains/control", json={"action": "CHECK_CURTAIN"})
        assert resp.status_code == 200
        mock_sa.assert_called_once()

    def test_invalid_enum_action_returns_400_tuple(self):
        resp = http.post("/curtains/control", json={"action": "THIS_DOES_NOT_EXIST_XYZ"})
        # The router returns a (dict, 400) tuple on AttributeError;
        # FastAPI serialises it as a JSON array with status 200.
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert body[0].get("error") == "Invalid curtains action"
