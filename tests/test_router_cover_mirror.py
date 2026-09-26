import inspect
from unittest.mock import MagicMock, patch
import crac_cloud.routers.cover_mirror_router as cover_mirror_router


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
