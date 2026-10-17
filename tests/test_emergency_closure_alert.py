"""Tests for the emergency closure blocked alert. The manual frontend test
plan lives in the pull request description."""
from unittest.mock import MagicMock, patch
from crac_cloud.grpc_cloud.chart_cloud import ChartClient
from crac_cloud.grpc_cloud.ups_cloud import UpsClient
from crac_cloud.grpc_cloud.rpc import SLOW_READ_TIMEOUT


class TestEmergencyClosureAlert:
    """Tests for the emergency closure blocked alert functionality."""

    def test_get_status_includes_emergency_closure(self):
        """WeatherResponse carries emergency_closure; chart_client must extract it."""
        client = ChartClient(host="localhost", port=50051)
        captured = {}

        # Mock response with emergency_closure field
        mock_response = MagicMock()
        mock_response.updated_at = 1234567890
        mock_response.charts = []
        mock_response.status = 0  # WEATHER_STATUS_NORMAL
        mock_response.interval = 60
        # emergency_closure field should be present
        mock_response.emergency_closure.status = 4  # BLOCKED
        mock_response.emergency_closure.triggers = [1]  # WEATHER
        mock_response.emergency_closure.block_reason = 1  # TELESCOPE_UNKNOWN
        mock_response.emergency_closure.status_since = 1234567800

        def fake_get_status(request, **kwargs):
            captured.update(kwargs)
            return mock_response

        with patch.object(client.stub, "GetStatus", side_effect=fake_get_status):
            result = client.get_status()

        assert captured["timeout"] == SLOW_READ_TIMEOUT
        # The result should include emergency_closure data
        assert "emergency_closure" in result
        assert result["emergency_closure"]["status"] == 4  # BLOCKED
        assert result["emergency_closure"]["triggers"] == [1]
        assert result["emergency_closure"]["block_reason"] == 1
        assert result["emergency_closure"]["status_since"] == 1234567800

    def test_get_status_handles_missing_emergency_closure(self):
        """A response without the emergency_closure field yields no key."""
        client = ChartClient(host="localhost", port=50051)

        mock_response = MagicMock(spec=["updated_at", "charts", "status", "interval"])
        mock_response.updated_at = 1234567890
        mock_response.charts = []
        mock_response.status = 0
        mock_response.interval = 60

        with patch.object(client.stub, "GetStatus", return_value=mock_response):
            result = client.get_status()

        assert "emergency_closure" not in result

    def test_get_status_emergency_closure_idle(self):
        """When emergency_closure status is IDLE, no alert should be triggered."""
        client = ChartClient(host="localhost", port=50051)

        mock_response = MagicMock()
        mock_response.updated_at = 1234567890
        mock_response.charts = []
        mock_response.status = 0
        mock_response.interval = 60
        mock_response.emergency_closure.status = 1  # IDLE
        mock_response.emergency_closure.triggers = []
        mock_response.emergency_closure.block_reason = 0
        mock_response.emergency_closure.status_since = 1234567800

        with patch.object(client.stub, "GetStatus", return_value=mock_response):
            result = client.get_status()

        assert result["emergency_closure"]["status"] == 1  # IDLE

    def test_get_status_emergency_closure_blocked_weather(self):
        """When emergency_closure is BLOCKED due to weather, alert should indicate weather."""
        client = ChartClient(host="localhost", port=50051)

        mock_response = MagicMock()
        mock_response.updated_at = 1234567890
        mock_response.charts = []
        mock_response.status = 2  # WEATHER_STATUS_WARNING
        mock_response.interval = 60
        mock_response.emergency_closure.status = 4  # BLOCKED
        mock_response.emergency_closure.triggers = [1]  # WEATHER
        mock_response.emergency_closure.block_reason = 1  # TELESCOPE_UNKNOWN
        mock_response.emergency_closure.status_since = 1234567800

        with patch.object(client.stub, "GetStatus", return_value=mock_response):
            result = client.get_status()

        assert result["emergency_closure"]["status"] == 4  # BLOCKED
        assert 1 in result["emergency_closure"]["triggers"]  # WEATHER

    def test_get_status_emergency_closure_blocked_ups(self):
        """When emergency_closure is BLOCKED due to UPS, alert should indicate UPS."""
        client = ChartClient(host="localhost", port=50051)

        mock_response = MagicMock()
        mock_response.updated_at = 1234567890
        mock_response.charts = []
        mock_response.status = 0
        mock_response.interval = 60
        mock_response.emergency_closure.status = 4  # BLOCKED
        mock_response.emergency_closure.triggers = [2]  # UPS
        mock_response.emergency_closure.block_reason = 1  # TELESCOPE_UNKNOWN
        mock_response.emergency_closure.status_since = 1234567800

        with patch.object(client.stub, "GetStatus", return_value=mock_response):
            result = client.get_status()

        assert result["emergency_closure"]["status"] == 4  # BLOCKED
        assert 2 in result["emergency_closure"]["triggers"]  # UPS


class TestUpsEmergencyClosureAlert:
    """Tests for emergency closure from UPS response."""

    def test_ups_get_status_includes_emergency_closure(self):
        """UpsResponse carries emergency_closure; ups_client must extract it."""
        client = UpsClient(host="localhost", port=50051)
        captured = {}

        # Mock response with emergency_closure field
        mock_response = MagicMock()
        mock_response.updated_at = 1234567890
        mock_response.charts = []
        mock_response.status = 0
        mock_response.interval = 60
        mock_response.devices = []
        mock_response.device_states = []
        # emergency_closure field
        mock_response.emergency_closure.status = 4  # BLOCKED
        mock_response.emergency_closure.triggers = [2]  # UPS
        mock_response.emergency_closure.block_reason = 1  # TELESCOPE_UNKNOWN
        mock_response.emergency_closure.status_since = 1234567800

        def fake_get_status(request, **kwargs):
            captured.update(kwargs)
            return mock_response

        with patch.object(client.stub, "GetStatus", side_effect=fake_get_status):
            result = client.get_status()

        assert captured["timeout"] == SLOW_READ_TIMEOUT
        assert "emergency_closure" in result
        assert result["emergency_closure"]["status"] == 4  # BLOCKED
        assert result["emergency_closure"]["triggers"] == [2]

    def test_ups_get_status_handles_missing_emergency_closure(self):
        """A UPS response without the emergency_closure field yields no key."""
        client = UpsClient(host="localhost", port=50051)

        mock_response = MagicMock(spec=["updated_at", "charts", "status", "interval", "devices"])
        mock_response.updated_at = 1234567890
        mock_response.charts = []
        mock_response.status = 0
        mock_response.interval = 60
        mock_response.devices = []

        with patch.object(client.stub, "GetStatus", return_value=mock_response):
            result = client.get_status()

        assert "emergency_closure" not in result
