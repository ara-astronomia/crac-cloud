import inspect
from unittest.mock import patch
import crac_cloud.routers.cover_mirror_router as cover_mirror_router


class TestSetCoverMirrorActionRunsInThreadPool:
    def test_route_is_not_a_coroutine(self):
        """The body is entirely synchronous: async def would block the whole
        event loop of crac-cloud during the command, not just this request."""
        assert not inspect.iscoroutinefunction(cover_mirror_router.set_action)


class TestGetCoverMirrorStatus:
    """Behavior (timeout, fast-fail, error handling) is tested at the
    CoverMirrorClient.get_status() level in test_cover_mirror_client.py;
    here I only check that the route delegates to the client."""

    def test_delegates_to_the_client(self):
        with patch.object(cover_mirror_router.cover_mirror_client, "get_status", return_value={"status": "ok"}) as mock:
            result = cover_mirror_router.get_cover_mirror_status()

        mock.assert_called_once()
        assert result == {"status": "ok"}
