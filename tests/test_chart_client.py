import pytest
from unittest.mock import patch
from crac_cloud.grpc_cloud.chart_cloud import ChartClient


@pytest.fixture(scope="module")
def client():
    return ChartClient(host="localhost", port=50051)


class TestFastFailOnDownChannel:
    def test_get_status_skips_the_call(self, client):
        """Sotto il meteo c'e' un urllib.request.urlopen senza timeout: il
        fast-fail sul canale caduto evita comunque di aspettarlo quando
        crac-server e' irraggiungibile."""
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "GetStatus") as mock_get_status:
            result = client.get_status()

        mock_get_status.assert_not_called()
        assert result == {"error": "crac-server channel is down", "status": "SCONOSCIUTO"}
