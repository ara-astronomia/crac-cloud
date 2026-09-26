import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from crac_cloud.grpc_cloud.telescope_cloud import TelescopeClient
from crac_protobuf import telescope_pb2, button_pb2
from tests.conftest import FakeRpcError


@pytest.fixture(scope="module")
def client():
    return TelescopeClient(host="localhost", port=50051)


@pytest.fixture(autouse=True)
def _reset_channel_health(client):
    """client e' module-scoped: un test che marca il canale giu' non deve
    sporcare i test successivi che non se lo aspettano."""
    client._health.record_success()


def _first_enum_value(enum_type):
    descriptor = enum_type.DESCRIPTOR
    entry = next(iter(descriptor.values_by_number.items()))
    return entry[0], entry[1].name


def _make_response(n_buttons: int):
    status_val, status_name = _first_enum_value(telescope_pb2.TelescopeStatus)
    speed_val, speed_name = _first_enum_value(telescope_pb2.TelescopeSpeed)
    pier_val, pier_name = _first_enum_value(telescope_pb2.PierSide)
    label_val, label_name = _first_enum_value(button_pb2.ButtonLabel)

    mock = MagicMock()
    mock.status = status_val
    mock.speed = speed_val
    mock.pier_side = pier_val
    mock.eq_coords.ra = 10.0
    mock.eq_coords.dec = 20.0
    mock.aa_coords.alt = 45.0
    mock.aa_coords.az = 180.0

    buttons = []
    for _ in range(n_buttons):
        btn = MagicMock()
        btn.label = label_val
        btn.metadata = "btn_meta"
        btn.is_disabled = False
        btn.is_visible = True
        buttons.append(btn)
    mock.buttons_gui = buttons

    return mock, status_name, speed_name, pier_name, label_name


class TestParseTelescopeResponse:
    def test_basic_fields_are_parsed(self, client):
        mock_response, status_name, speed_name, pier_name, label_name = _make_response(1)
        result = client._parse_response(mock_response)

        assert result["status"] == status_name
        assert result["speed"] == speed_name
        assert result["pier_side"] == pier_name
        assert result["eq_coords"] == {"ra": 10.0, "dec": 20.0}
        assert result["aa_coords"] == {"alt": 45.0, "az": 180.0}
        assert len(result["buttons_gui"]) == 1
        assert result["gui"]["label"] == label_name

    def test_no_buttons_gui_returns_fallback(self, client):
        mock_response, *_ = _make_response(0)
        result = client._parse_response(mock_response)

        assert result["buttons_gui"] == []
        assert result["gui"] == {"label": "LABEL_ERROR", "is_disabled": True}


class TestGetStatusTimeout:
    def test_uses_short_timeout_for_a_fast_read(self, client):
        """get_status risponde in pochi ms a stack sano: un timeout da 5s e'
        largo 50-1500 volte il necessario e ritarda inutilmente la diagnosi
        quando crac-server e' morto."""
        mock_response, *_ = _make_response(0)
        captured = {}

        def fake_set_action(request, **kwargs):
            captured.update(kwargs)
            return mock_response

        with patch.object(client.stub, "SetAction", side_effect=fake_set_action):
            client.get_status()

        assert captured["timeout"] == 1.5


class TestFastFailOnDownChannel:
    def test_get_autolight_status_skips_the_call(self, client):
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "SetAction") as mock_set_action:
            result = client.get_autolight_status()

        mock_set_action.assert_not_called()
        assert result == {"key": "KEY_AUTOLIGHT", "status": "UNKNOWN"}

    def test_get_status_skips_the_call(self, client):
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "SetAction") as mock_set_action:
            result = client.get_status()

        mock_set_action.assert_not_called()
        assert result == {"error": "crac-server channel is down"}

    def test_set_action_skips_the_call(self, client):
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "SetAction") as mock_set_action:
            result = client.set_action(telescope_pb2.PARK_POSITION)

        mock_set_action.assert_not_called()
        assert result == {"error": "crac-server channel is down"}

    def test_connect_skips_the_call(self, client):
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "SetAction") as mock_set_action:
            result = client.connect()

        mock_set_action.assert_not_called()
        assert result == {"error": "crac-server channel is down"}

    def test_disconnect_skips_the_call(self, client):
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "SetAction") as mock_set_action:
            result = client.disconnect()

        mock_set_action.assert_not_called()
        assert result == {"error": "crac-server channel is down"}


class _BrokenAutolightResponse:
    """La RPC risponde, ma leggere un campo (qui .speed) solleva un errore
    non di rete - non deve marcare giu' un canale in realta' sano."""

    @property
    def speed(self):
        raise AttributeError("autolight")


class TestGrpcFailuresReturn200WithError:
    """Convenzione del progetto: gli errori di comunicazione col backend
    ritornano 200 con chiave 'error', non un'eccezione - altrimenti il
    frontend perde il dettaglio vero dietro un generico 'HTTP 500'."""

    def test_set_action_returns_error_instead_of_raising(self, client):
        # .name e' letto per il log su errore: serve un oggetto enum, non
        # l'int nudo usato altrove in questo file (bug preesistente, fuori scope qui).
        action = SimpleNamespace(value=telescope_pb2.PARK_POSITION, name="PARK_POSITION")
        with patch.object(client.stub, "SetAction", side_effect=FakeRpcError("boom")):
            result = client.set_action(action)

        assert result == {"error": "boom"}

    def test_connect_returns_error_instead_of_raising(self, client):
        with patch.object(client.stub, "SetAction", side_effect=FakeRpcError("boom")):
            result = client.connect()

        assert result == {"error": "boom"}


class TestGetAutolightStatusDoesNotPoisonHealth:
    def test_a_non_grpc_error_does_not_mark_the_channel_down(self, client):
        with patch.object(client.stub, "SetAction", return_value=_BrokenAutolightResponse()):
            result = client.get_autolight_status()

        assert result == {"key": "KEY_AUTOLIGHT", "status": "UNKNOWN"}
        assert client._health.is_down() is False

    def test_a_real_grpc_error_still_marks_the_channel_down(self, client):
        with patch.object(client.stub, "SetAction", side_effect=FakeRpcError()):
            client.get_autolight_status()

        assert client._health.is_down() is True
