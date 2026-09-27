import inspect
from unittest.mock import patch
import crac_cloud.routers.cover_mirror_router as cover_mirror_router


class TestSetActionIsSync:
    def test_route_is_not_a_coroutine(self):
        """Runs in FastAPI's threadpool, so a slow gRPC call cannot block the event loop."""
        assert not inspect.iscoroutinefunction(cover_mirror_router.set_action)


class TestGetCoverMirrorStatus:
    """Timeouts and error handling are tested on CoverMirrorClient.get_status()."""

    def test_delegates_to_the_client(self):
        with patch.object(cover_mirror_router.cover_mirror_client, "get_status", return_value={"status": "ok"}) as mock:
            result = cover_mirror_router.get_cover_mirror_status()

        mock.assert_called_once()
        assert result == {"status": "ok"}


class TestSetAction:
    def test_passes_a_valid_action_to_the_client(self):
        with patch.object(cover_mirror_router.cover_mirror_client, "set_action", return_value={"status": "ok"}) as mock:
            cover_mirror_router.set_action(cover_mirror_router.CoverMirrorActionRequest(action="CLOSE_COVER_MIRROR"))

        mock.assert_called_once_with("CLOSE_COVER_MIRROR")

    def test_rejects_an_action_the_operator_cannot_send(self):
        with patch.object(cover_mirror_router.cover_mirror_client, "set_action") as mock:
            result = cover_mirror_router.set_action(cover_mirror_router.CoverMirrorActionRequest(action="CHECK_COVER_MIRROR"))

        mock.assert_not_called()
        assert result["status"] == "error"
