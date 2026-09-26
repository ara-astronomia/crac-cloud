import asyncio
import threading
from time import sleep
from unittest.mock import AsyncMock, patch

import crac_cloud.routers.map_router as map_router

_GEO = {"latitude": 42.0, "longitude": 12.9, "elevation": 470.0}
_CCD = {"width": 4656, "height": 3520}


def test_a_slow_telescope_lets_the_other_requests_through():
    asyncio.run(_slow_telescope_scenario())


async def _slow_telescope_scenario():
    """The synchronous telescope read runs off the event loop, so other requests are still served."""
    def slow_read():
        sleep(0.3)
        return {"status": "DISCONNECTED"}

    order = []

    async def maps():
        await map_router._get_all_required_data()
        order.append("maps")

    async def other_request():
        await asyncio.sleep(0.05)
        order.append("other request")

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", slow_read):
        await asyncio.gather(maps(), other_request())

    assert order == ["other request", "maps"]


def test_a_slow_tracking_chart_generation_lets_the_other_requests_through():
    asyncio.run(_slow_tracking_chart_scenario())


async def _slow_tracking_chart_scenario():
    """Map generation (DSS download, matplotlib) runs off the event loop, so other requests are still served."""
    def slow_generation(*args, **kwargs):
        sleep(0.3)
        return ("/dev/null", "/dev/null")

    order = []

    async def map_request():
        await map_router.get_tracking_chart()
        order.append("map")

    async def other_request():
        await asyncio.sleep(0.05)
        order.append("other request")

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", return_value={"status": "TELESCOPE_TRACKING", "eq_coords": {"ra": 1.0, "dec": 2.0}}), \
         patch.object(map_router, "generate_telescope_maps", slow_generation):
        await asyncio.gather(map_request(), other_request())

    assert order == ["other request", "map"]


def test_concurrent_map_requests_do_not_run_generation_in_parallel():
    asyncio.run(_concurrent_map_generation_scenario())


async def _concurrent_map_generation_scenario():
    """generate_telescope_maps uses matplotlib's global state and fixed output
    paths, so two map requests never generate in parallel."""
    lock = threading.Lock()
    state = {"concurrent": 0, "max_concurrent": 0}

    def generation(*args, **kwargs):
        with lock:
            state["concurrent"] += 1
            state["max_concurrent"] = max(state["max_concurrent"], state["concurrent"])
        sleep(0.1)
        with lock:
            state["concurrent"] -= 1
        return ("/dev/null", "/dev/null")

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", return_value={"status": "TELESCOPE_TRACKING", "eq_coords": {"ra": 99.0, "dec": 88.0}}), \
         patch.object(map_router, "generate_telescope_maps", generation):
        await asyncio.gather(map_router.get_tracking_chart(), map_router.get_fixed_sky_map())

    assert state["max_concurrent"] == 1


def test_a_slow_sky_map_generation_lets_the_other_requests_through():
    asyncio.run(_slow_sky_map_scenario())


async def _slow_sky_map_scenario():
    """Sky map generation runs off the event loop, so other requests are still served."""
    def slow_generation(*args, **kwargs):
        sleep(0.3)
        return ("/dev/null", "/dev/null")

    order = []

    async def map_request():
        await map_router.get_fixed_sky_map()
        order.append("map")

    async def other_request():
        await asyncio.sleep(0.05)
        order.append("other request")

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", return_value={"status": "TELESCOPE_TRACKING", "eq_coords": {"ra": 1.0, "dec": 2.0}}), \
         patch.object(map_router, "generate_telescope_maps", slow_generation):
        await asyncio.gather(map_request(), other_request())

    assert order == ["other request", "map"]
