import inspect
from unittest.mock import patch
import crac_cloud.routers.cover_mirror_router as cover_mirror_router


class TestSetCoverMirrorActionRunsInThreadPool:
    def test_route_is_not_a_coroutine(self):
        """Il corpo e' interamente sincrono: async def bloccherebbe l'intero
        event loop di crac-cloud durante il comando, non solo questa richiesta."""
        assert not inspect.iscoroutinefunction(cover_mirror_router.set_action)


class TestGetCoverMirrorStatus:
    """Il comportamento (timeout, fast-fail, gestione errori) e' testato a
    livello di CoverMirrorClient.get_status() in test_cover_mirror_client.py;
    qui verifico solo che la route deleghi al client."""

    def test_delegates_to_the_client(self):
        with patch.object(cover_mirror_router.cover_mirror_client, "get_status", return_value={"status": "ok"}) as mock:
            result = cover_mirror_router.get_cover_mirror_status()

        mock.assert_called_once()
        assert result == {"status": "ok"}
