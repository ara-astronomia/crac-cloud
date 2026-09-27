"""Every map test patches MAP_GENERATION_LOCK with its own lock: an asyncio
lock binds to the first event loop that waits on it."""
import asyncio
import itertools
import threading
from time import sleep
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

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
         patch.object(map_router, "MAP_GENERATION_LOCK", asyncio.Lock()):
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
         patch.object(map_router, "MAP_GENERATION_LOCK", asyncio.Lock()):
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
         patch.object(map_router, "MAP_GENERATION_LOCK", asyncio.Lock()):
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
         patch.object(map_router, "MAP_GENERATION_LOCK", asyncio.Lock()):
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
         patch.object(map_router, "MAP_GENERATION_LOCK", asyncio.Lock()):
        try:
            await map_router.get_fixed_sky_map()
        except OSError:
            pass
        response = await map_router.get_fixed_sky_map()

    assert response.body == b"new pointing"


def test_a_slow_airmass_computation_lets_the_other_requests_through():
    asyncio.run(_slow_airmass_scenario())


async def _slow_airmass_scenario():
    """compute_airmass may load or download IERS tables, so it runs off the event loop."""
    def slow_airmass(*args):
        sleep(0.3)
        return 1.2

    order = []

    async def airmass_request():
        await map_router.get_airmass()
        order.append("airmass")

    async def other_request():
        await asyncio.sleep(0.05)
        order.append("other request")

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", return_value={"status": "TELESCOPE_TRACKING", "eq_coords": {"ra": 1.0, "dec": 2.0}}), \
         patch.object(map_router, "compute_airmass", slow_airmass):
        await asyncio.gather(airmass_request(), other_request())

    assert order == ["other request", "airmass"]


@pytest.mark.parametrize("route, placeholder", [
    ("get_tracking_chart", "airmass_not_available.png"),
    ("get_fixed_sky_map", "tele_not_connected.png"),
])
def test_map_images_fall_back_to_a_placeholder_when_crac_server_does_not_answer(route, placeholder):
    """The browser shows these routes in an <img>: an error body would draw a broken image."""
    async def scenario():
        with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=None)), \
             patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=None)), \
             patch.object(map_router.telescope_client, "get_status", return_value={"error": "deadline exceeded"}):
            return await getattr(map_router, route)()

    response = asyncio.run(scenario())

    assert response.media_type == "image/png"
    assert response.headers["content-disposition"] == f"inline; filename={placeholder}"


def _slewing(ra):
    return {"status": "WEST", "speed": "SPEED_SLEWING", "eq_coords": {"ra": ra, "dec": 0.0}}


@pytest.mark.parametrize("route, filename", [
    ("get_tracking_chart", map_router.MAP2_FILENAME),
    ("get_fixed_sky_map", map_router.MAP1_FILENAME),
])
def test_no_map_is_generated_during_a_slew(tmp_path, route, filename):
    """A map drawn mid-slew is wrong by the time it arrives: the last map is served instead."""
    (tmp_path / filename).write_bytes(b"last map")
    generation = MagicMock()

    async def scenario():
        with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
             patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
             patch.object(map_router.telescope_client, "get_status", return_value=_slewing(3.0)), \
             patch.object(map_router, "generate_telescope_maps", generation), \
             patch.object(map_router, "OUTPUT_DIR", str(tmp_path)), \
             patch.object(map_router, "LAST_EQ_COORDS", None), \
             patch.object(map_router, "MAP_GENERATION_LOCK", asyncio.Lock()):
            return await getattr(map_router, route)()

    response = asyncio.run(scenario())

    generation.assert_not_called()
    assert response.body == b"last map"


def test_the_sky_map_is_generated_once_when_the_slew_ends(tmp_path):
    asyncio.run(_slew_then_track_scenario(tmp_path))


async def _slew_then_track_scenario(tmp_path):
    map_path = tmp_path / map_router.MAP1_FILENAME
    map_path.write_bytes(b"previous pointing")
    telescope = iter([_slewing(1.0), _slewing(2.0), _slewing(3.0),
                      {"status": "WEST", "speed": "SPEED_TRACKING", "eq_coords": {"ra": 3.0, "dec": 0.0}}])
    generated = []

    def generation(geo, eq_coords, ccd):
        generated.append(eq_coords["ra"])
        map_path.write_bytes(b"final pointing")
        return (str(map_path), str(map_path))

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", lambda: next(telescope)), \
         patch.object(map_router, "generate_telescope_maps", generation), \
         patch.object(map_router, "OUTPUT_DIR", str(tmp_path)), \
         patch.object(map_router, "LAST_EQ_COORDS", None), \
         patch.object(map_router, "MAP_GENERATION_LOCK", asyncio.Lock()):
        responses = [await map_router.get_fixed_sky_map() for _ in range(4)]

    assert generated == [3.0]
    assert [r.body for r in responses] == [b"previous pointing"] * 3 + [b"final pointing"]
