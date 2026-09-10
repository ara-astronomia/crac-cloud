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
