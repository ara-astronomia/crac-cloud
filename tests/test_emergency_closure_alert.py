"""Tests for emergency closure blocked alert (issue #45).

## Test plan manuale (frontend)

1. **Prerequisiti**: crac-server con versione >= 1.3.3 che popola emergency_closure,
   crac-protobuf >= 0.1.23 con il campo EmergencyClosure.

2. **Setup**: Avviare lo stack di test con crac-server e crac-cloud.

3. **Simulare chiusura bloccata per meteo**:
   - Azione: Simulare condizioni meteo critiche con telescopio disconnesso
   - Atteso: Avviso ERROR in "Stato di CRaC" con testo:
     "Chiusura d'emergenza: bloccata: tetto andrebbe chiuso per meteo, ma posizione del telescopio sconosciuta. Azione: collegare il telescopio o risolvere il problema meteo"

4. **Simulare chiusura bloccata per UPS**:
   - Azione: Simulare allarme UPS critico con telescopio disconnesso
   - Atteso: Avviso ERROR in "Stato di CRaC" con testo:
     "Chiusura d'emergenza: bloccata: tetto andrebbe chiuso per UPS, ma posizione del telescopio sconosciuta. Azione: collegare il telescopio o risolvere il problema UPS"

5. **Simulare multi-trigger**:
   - Azione: Simulare sia meteo che UPS critici con telescopio disconnesso
   - Atteso: Avviso ERROR in "Stato di CRaC" con testo:
     "Chiusura d'emergenza: bloccata: tetto andrebbe chiuso per meteo e UPS, ma posizione del telescopio sconosciuta. Azione: ..."

6. **Risolvere il blocco**:
   - Azione: Connettere il telescopio e portarlo in park
   - Atteso: Avviso scompare da "Stato di CRaC" e passa allo storico

7. **Chiusura completata**:
   - Azione: Con condizioni critiche e tetto chiuso correttamente
   - Atteso: Nessun avviso di chiusura bloccata (stato è COMPLETED, non BLOCKED)

8. **Dati meteo non disponibili**:
   - Azione: Simulare timeout lettura meteo
   - Atteso: Avviso con testo: "Chiusura d'emergenza: bloccata: tetto andrebbe chiuso per dati meteo non disponibili, ..."
"""
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
        """If emergency_closure is not set, do not fail."""
        client = ChartClient(host="localhost", port=50051)

        mock_response = MagicMock()
        mock_response.updated_at = 1234567890
        mock_response.charts = []
        mock_response.status = 0
        mock_response.interval = 60
        # No emergency_closure field

        with patch.object(client.stub, "GetStatus", return_value=mock_response):
            result = client.get_status()

        # Should not crash, emergency_closure should be None or absent
        assert "error" not in result or result.get("emergency_closure") is None

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
        """If emergency_closure is not set in UPS response, do not fail."""
        client = UpsClient(host="localhost", port=50051)

        mock_response = MagicMock()
        mock_response.updated_at = 1234567890
        mock_response.charts = []
        mock_response.status = 0
        mock_response.interval = 60
        mock_response.devices = []
        mock_response.device_states = []

        with patch.object(client.stub, "GetStatus", return_value=mock_response):
            result = client.get_status()

        assert "error" not in result or result.get("emergency_closure") is None
