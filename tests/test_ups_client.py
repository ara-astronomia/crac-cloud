import pytest
from unittest.mock import patch
from crac_cloud.grpc_cloud.ups_cloud import UpsClient
from crac_cloud.grpc_cloud.channel_health import CHANNEL_DOWN_MESSAGE


@pytest.fixture(scope="module")
def client():
    return UpsClient(host="localhost", port=50051)


class TestFastFailOnDownChannel:
    def test_get_status_skips_the_call(self, client):
        """Underneath the UPS call there's a NUT query with its own long
        timeout: fast-failing on a down channel avoids waiting for it
        anyway when crac-server is unreachable."""
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "GetStatus") as mock_get_status:
            result = client.get_status()

        mock_get_status.assert_not_called()
        assert result == {"error": CHANNEL_DOWN_MESSAGE}
