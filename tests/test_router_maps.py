"""Every map test patches MAP_GENERATION with its own Condition: an asyncio
primitive binds to the first event loop that waits on it."""
import asyncio
import itertools
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
         patch.object(map_router, "generate_telescope_maps", slow_generation), \
         patch.object(map_router, "MAP_GENERATION", asyncio.Condition()):
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
         patch.object(map_router, "generate_telescope_maps", generation), \
         patch.object(map_router, "LAST_EQ_COORDS", None), \
         patch.object(map_router, "MAP_GENERATION", asyncio.Condition()):
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
         patch.object(map_router, "generate_telescope_maps", slow_generation), \
         patch.object(map_router, "LAST_EQ_COORDS", None), \
         patch.object(map_router, "MAP_GENERATION", asyncio.Condition()):
        await asyncio.gather(map_request(), other_request())

    assert order == ["other request", "map"]


def test_a_sky_map_request_during_generation_gets_the_new_map(tmp_path):
    asyncio.run(_sky_map_during_generation_scenario(tmp_path))


async def _sky_map_during_generation_scenario(tmp_path):
    """A second viewer asking while the first request generates the map for a
    new pointing waits for it instead of reading the previous map."""
    map_path = tmp_path / map_router.MAP1_FILENAME
    map_path.write_bytes(b"previous pointing")

    def slow_generation(*args, **kwargs):
        sleep(0.2)
        map_path.write_bytes(b"new pointing")
        return (str(map_path), str(map_path))

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", return_value={"status": "TELESCOPE_TRACKING", "eq_coords": {"ra": 5.0, "dec": 6.0}}), \
         patch.object(map_router, "generate_telescope_maps", slow_generation), \
         patch.object(map_router, "OUTPUT_DIR", str(tmp_path)), \
         patch.object(map_router, "LAST_EQ_COORDS", {"ra": 1.0, "dec": 2.0}), \
         patch.object(map_router, "MAP_GENERATION", asyncio.Condition()):
        operator, observer = await asyncio.gather(map_router.get_fixed_sky_map(), map_router.get_fixed_sky_map())

    assert operator.body == observer.body == b"new pointing"


def test_a_failed_sky_map_generation_is_retried_on_the_next_request(tmp_path):
    asyncio.run(_failed_generation_scenario(tmp_path))


async def _failed_generation_scenario(tmp_path):
    map_path = tmp_path / map_router.MAP1_FILENAME
    attempts = []

    def generation(*args, **kwargs):
        attempts.append(1)
        if len(attempts) == 1:
            raise OSError("DSS download failed")
        map_path.write_bytes(b"new pointing")
        return (str(map_path), str(map_path))

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", return_value={"status": "TELESCOPE_TRACKING", "eq_coords": {"ra": 5.0, "dec": 6.0}}), \
         patch.object(map_router, "generate_telescope_maps", generation), \
         patch.object(map_router, "OUTPUT_DIR", str(tmp_path)), \
         patch.object(map_router, "LAST_EQ_COORDS", {"ra": 1.0, "dec": 2.0}), \
         patch.object(map_router, "MAP_GENERATION", asyncio.Condition()):
        try:
            await map_router.get_fixed_sky_map()
        except OSError:
            pass
        response = await map_router.get_fixed_sky_map()

    assert response.body == b"new pointing"


def test_during_a_slew_only_the_latest_queued_sky_map_is_generated(tmp_path):
    asyncio.run(_slew_scenario(tmp_path))


async def _slew_scenario(tmp_path):
    """Requests queued behind a generation are superseded by the newest one:
    they skip their own generation and serve the map it produces."""
    map_path = tmp_path / map_router.MAP1_FILENAME
    pointings = itertools.count(1)
    generated = []

    def moving_telescope():
        return {"status": "TELESCOPE_SLEWING", "eq_coords": {"ra": float(next(pointings)), "dec": 0.0}}

    def slow_generation(geo, eq_coords, ccd):
        sleep(0.2)
        generated.append(eq_coords["ra"])
        map_path.write_bytes(f"ra {eq_coords['ra']}".encode())
        return (str(map_path), str(map_path))

    async def later_request():
        await asyncio.sleep(0.05)
        return await map_router.get_fixed_sky_map()

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", moving_telescope), \
         patch.object(map_router, "generate_telescope_maps", slow_generation), \
         patch.object(map_router, "OUTPUT_DIR", str(tmp_path)), \
         patch.object(map_router, "LAST_EQ_COORDS", None), \
         patch.object(map_router, "MAP_GENERATION", asyncio.Condition()):
        first, second, third = await asyncio.gather(
            map_router.get_fixed_sky_map(), later_request(), later_request())

    assert len(generated) == 2
    assert second.body == third.body == f"ra {generated[-1]}".encode()


def test_queued_sky_map_requests_fail_with_the_newest_generation(tmp_path):
    asyncio.run(_failed_newest_generation_scenario(tmp_path))


async def _failed_newest_generation_scenario(tmp_path):
    """When the newest generation fails, the requests it superseded fail too,
    instead of hanging or serving the previous pointing's map as current."""
    map_path = tmp_path / map_router.MAP1_FILENAME
    map_path.write_bytes(b"previous pointing")
    pointings = itertools.count(1)
    generations = itertools.count(1)

    def moving_telescope():
        return {"status": "TELESCOPE_SLEWING", "eq_coords": {"ra": float(next(pointings)), "dec": 0.0}}

    def generation(*args, **kwargs):
        sleep(0.2)
        if next(generations) == 2:
            raise OSError("DSS download failed")
        return (str(map_path), str(map_path))

    async def later_request():
        await asyncio.sleep(0.05)
        return await map_router.get_fixed_sky_map()

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", moving_telescope), \
         patch.object(map_router, "generate_telescope_maps", generation), \
         patch.object(map_router, "OUTPUT_DIR", str(tmp_path)), \
         patch.object(map_router, "LAST_EQ_COORDS", None), \
         patch.object(map_router, "MAP_GENERATION", asyncio.Condition()):
        results = await asyncio.wait_for(asyncio.gather(
            map_router.get_fixed_sky_map(), later_request(), later_request(),
            return_exceptions=True), timeout=2)

    assert [type(result) for result in results[1:]] == [OSError, OSError]
