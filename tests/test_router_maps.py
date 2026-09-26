import asyncio
from time import sleep
from unittest.mock import AsyncMock, patch

import crac_cloud.routers.map_router as map_router

_GEO = {"latitude": 42.0, "longitude": 12.9, "elevation": 470.0}
_CCD = {"width": 4656, "height": 3520}


def test_a_slow_telescope_lets_the_other_requests_through():
    asyncio.run(_slow_telescope_scenario())


async def _slow_telescope_scenario():
    """La lettura del telescopio e' sincrona: se resta sul loop, con crac-server
    lento nessun'altra richiesta viene servita, /health compresa."""
    def lettura_lenta():
        sleep(0.3)
        return {"status": "DISCONNECTED"}

    ordine = []

    async def mappe():
        await map_router._get_all_required_data()
        ordine.append("mappe")

    async def altra_richiesta():
        await asyncio.sleep(0.05)
        ordine.append("altra richiesta")

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", lettura_lenta):
        await asyncio.gather(mappe(), altra_richiesta())

    assert ordine == ["altra richiesta", "mappe"]


def test_a_slow_tracking_chart_generation_lets_the_other_requests_through():
    asyncio.run(_slow_tracking_chart_scenario())


async def _slow_tracking_chart_scenario():
    """generate_telescope_maps scarica una lastra DSS e disegna con matplotlib
    in modo sincrono: se resta sul loop, con crac-server lento nessun'altra
    richiesta viene servita."""
    def generazione_lenta(*args, **kwargs):
        sleep(0.3)
        return ("/dev/null", "/dev/null")

    ordine = []

    async def mappa():
        await map_router.get_tracking_chart()
        ordine.append("mappa")

    async def altra_richiesta():
        await asyncio.sleep(0.05)
        ordine.append("altra richiesta")

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", return_value={"status": "TELESCOPE_TRACKING", "eq_coords": {"ra": 1.0, "dec": 2.0}}), \
         patch.object(map_router, "generate_telescope_maps", generazione_lenta):
        await asyncio.gather(mappa(), altra_richiesta())

    assert ordine == ["altra richiesta", "mappa"]


def test_a_slow_sky_map_generation_lets_the_other_requests_through():
    asyncio.run(_slow_sky_map_scenario())


async def _slow_sky_map_scenario():
    """Stesso difetto di get_tracking_chart: generate_telescope_maps sincrona
    dentro una route async blocca il loop anche per get_fixed_sky_map."""
    def generazione_lenta(*args, **kwargs):
        sleep(0.3)
        return ("/dev/null", "/dev/null")

    ordine = []

    async def mappa():
        await map_router.get_fixed_sky_map()
        ordine.append("mappa")

    async def altra_richiesta():
        await asyncio.sleep(0.05)
        ordine.append("altra richiesta")

    with patch.object(map_router.geo_client, "get_geographic_data", AsyncMock(return_value=_GEO)), \
         patch.object(map_router.image_config_client, "get_ccd_image_data", AsyncMock(return_value=_CCD)), \
         patch.object(map_router.telescope_client, "get_status", return_value={"status": "TELESCOPE_TRACKING", "eq_coords": {"ra": 1.0, "dec": 2.0}}), \
         patch.object(map_router, "generate_telescope_maps", generazione_lenta):
        await asyncio.gather(mappa(), altra_richiesta())

    assert ordine == ["altra richiesta", "mappa"]
