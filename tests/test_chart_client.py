from unittest.mock import MagicMock, patch
from crac_cloud.grpc_cloud.chart_cloud import ChartClient
from crac_cloud.grpc_cloud.rpc import SLOW_READ_TIMEOUT


def test_get_status_uses_the_slow_read_timeout():
    client = ChartClient(host="localhost", port=50051)
    captured = {}

    def fake_get_status(request, **kwargs):
        captured.update(kwargs)
        return MagicMock(charts=[], status=0)

    with patch.object(client.stub, "GetStatus", side_effect=fake_get_status):
        client.get_status()

    assert captured["timeout"] == SLOW_READ_TIMEOUT
