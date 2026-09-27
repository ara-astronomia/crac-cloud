import asyncio
from unittest.mock import MagicMock, patch
from crac_cloud.grpc_cloud.geographic_cloud import GeographicClient
from crac_cloud.grpc_cloud.image_config_cloud import ImageConfigClient
from crac_cloud.grpc_cloud.rpc import FAST_READ_TIMEOUT


async def _timeout_used(client_class, stub_method, call):
    client = client_class(host="localhost", port=50051)
    captured = {}

    async def fake_call(request, **kwargs):
        captured.update(kwargs)
        return MagicMock()

    with patch.object(client.stub, stub_method, side_effect=fake_call):
        await call(client)
    return captured["timeout"]


def test_geographic_data_uses_a_read_timeout():
    timeout = asyncio.run(_timeout_used(GeographicClient, "GetGeographicInfo", lambda c: c.get_geographic_data()))
    assert timeout == FAST_READ_TIMEOUT


def test_ccd_image_data_uses_a_read_timeout():
    timeout = asyncio.run(_timeout_used(ImageConfigClient, "GetCCDImageData", lambda c: c.get_ccd_image_data()))
    assert timeout == FAST_READ_TIMEOUT
