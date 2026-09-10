from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import crac_cloud.app as app_module
import crac_cloud.routers.roof_router as roof_router

http = TestClient(app_module.app)

_PARSED_OK = {"status": "ROOF_OPEN", "gui": {"label": "LABEL_OPEN"}}


def test_json_responses_are_never_cached():
    with patch.object(roof_router.roof_client.stub, "SetAction", return_value=MagicMock()), \
         patch.object(roof_router.roof_client, "_parse_roof_response", return_value=_PARSED_OK):
        resp = http.get("/roof/status")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    assert resp.headers["cache-control"] == "no-store"


def test_the_page_itself_keeps_its_own_caching():
    resp = http.get("/")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    assert "cache-control" not in resp.headers


def test_health_answers_without_talking_to_crac_server():
    with patch.object(roof_router.roof_client.stub, "SetAction", side_effect=AssertionError("gRPC non deve essere toccato")):
        resp = http.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert resp.headers["cache-control"] == "no-store"
