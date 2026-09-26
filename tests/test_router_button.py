import inspect
import crac_cloud.routers.button_router as button_router


class TestSetButtonActionRunsInThreadPool:
    def test_route_is_not_a_coroutine(self):
        """Il corpo e' interamente sincrono: async def bloccherebbe l'intero
        event loop di crac-cloud durante il comando, non solo questa richiesta."""
        assert not inspect.iscoroutinefunction(button_router.set_action)
