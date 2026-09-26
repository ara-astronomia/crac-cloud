import inspect
import pytest
from unittest.mock import MagicMock, patch
import crac_cloud.routers.cover_mirror_router as cover_mirror_router
from tests.conftest import FakeRpcError


@pytest.fixture(autouse=True)
def _reset_cover_mirror_channel_health():
    """cover_mirror_client e' un singleton di modulo: un test che fa fallire
    una chiamata reale non deve sporcare i test successivi."""
    cover_mirror_router.cover_mirror_client._health.record_success()


class TestSetCoverMirrorActionRunsInThreadPool:
    def test_route_is_not_a_coroutine(self):
        """Il corpo e' interamente sincrono: async def bloccherebbe l'intero
        event loop di crac-cloud durante il comando, non solo questa richiesta."""
        assert not inspect.iscoroutinefunction(cover_mirror_router.set_action)


class TestGetCoverMirrorStatus:
    def test_uses_short_timeout_for_a_fast_read(self):
        """Lo status risponde in pochi ms a stack sano: senza un timeout
        esplicito la richiesta puo' restare appesa a tempo indefinito quando
        crac-server non risponde."""
        captured = {}

        def fake_set_action(request, **kwargs):
            captured.update(kwargs)
            return MagicMock()

        with patch.object(cover_mirror_router.cover_mirror_client.stub, "SetAction", side_effect=fake_set_action), \
             patch.object(cover_mirror_router.cover_mirror_client, "_parse_cover_mirror_response", return_value={"status": "ok"}):
            cover_mirror_router.get_cover_mirror_status()

        assert captured["timeout"] == 1.5

    def test_skips_the_call_when_the_channel_is_down(self):
        with patch.object(cover_mirror_router.cover_mirror_client._health, "is_down", return_value=True), \
             patch.object(cover_mirror_router.cover_mirror_client.stub, "SetAction") as mock_set_action:
            result = cover_mirror_router.get_cover_mirror_status()

        mock_set_action.assert_not_called()
        assert result["status"] == "ERROR"

    def test_a_parsing_error_does_not_mark_the_channel_down(self):
        """La RPC e' andata a buon fine: un bug nel parsing della risposta
        non e' un crac-server irraggiungibile e non deve avvelenare l'health
        condivisa con set_action."""
        with patch.object(cover_mirror_router.cover_mirror_client.stub, "SetAction", return_value=MagicMock()), \
             patch.object(cover_mirror_router.cover_mirror_client, "_parse_cover_mirror_response", side_effect=ValueError("boom")):
            result = cover_mirror_router.get_cover_mirror_status()

        assert result["status"] == "ERROR"
        assert cover_mirror_router.cover_mirror_client._health.is_down() is False

    def test_a_real_grpc_error_still_marks_the_channel_down(self):
        with patch.object(cover_mirror_router.cover_mirror_client.stub, "SetAction", side_effect=FakeRpcError()):
            cover_mirror_router.get_cover_mirror_status()

        assert cover_mirror_router.cover_mirror_client._health.is_down() is True
