import pytest
from unittest.mock import MagicMock, patch
from crac_cloud.grpc_cloud.roof_cloud import RoofClient
from crac_protobuf import roof_pb2, button_pb2
from tests.conftest import FakeRpcError


@pytest.fixture(scope="module")
def client():
    return RoofClient(host="localhost", port=50051)


@pytest.fixture(autouse=True)
def _reset_channel_health(client):
    """client e' module-scoped: un test che marca il canale giu' non deve
    sporcare i test successivi che non se lo aspettano."""
    client._health.record_success()


def _first_enum_value(enum_type):
    descriptor = enum_type.DESCRIPTOR
    entry = next(iter(descriptor.values_by_number.items()))
    return entry[0], entry[1].name


def _make_response(has_color: bool):
    status_val, status_name = _first_enum_value(roof_pb2.RoofStatus)
    label_val, label_name = _first_enum_value(button_pb2.ButtonLabel)

    mock = MagicMock()
    mock.status = status_val
    mock.button_gui.HasField.return_value = has_color
    mock.button_gui.label = label_val
    mock.button_gui.metadata = "meta"
    mock.button_gui.is_disabled = False
    mock.button_gui.button_color.text_color = "red"
    mock.button_gui.button_color.background_color = "blue"
    return mock, status_name, label_name


class TestParseRoofResponse:
    def test_with_color_returns_proto_colors(self, client):
        mock_response, status_name, label_name = _make_response(has_color=True)
        result = client._parse_roof_response(mock_response)

        assert result["status"] == status_name
        assert result["gui"]["label"] == label_name
        assert result["gui"]["is_disabled"] is False
        assert result["gui"]["button_color"] == {
            "text_color": "red",
            "background_color": "blue",
        }

    def test_without_color_uses_default_gray(self, client):
        mock_response, _, _ = _make_response(has_color=False)
        result = client._parse_roof_response(mock_response)

        assert result["gui"]["button_color"] == {
            "text_color": "white",
            "background_color": "gray",
        }


class TestFastFailOnDownChannel:
    def test_set_action_skips_the_call(self, client):
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "SetAction") as mock_set_action:
            result = client.set_action(roof_pb2.RoofAction.CLOSE)

        mock_set_action.assert_not_called()
        assert result == {"error": "crac-server channel is down"}


class TestGetStatus:
    def test_returns_parsed_data(self, client):
        mock_response, status_name, label_name = _make_response(has_color=True)
        with patch.object(client.stub, "SetAction", return_value=mock_response):
            result = client.get_status()

        assert result["status"] == status_name
        assert result["gui"]["label"] == label_name

    def test_uses_short_timeout_for_a_fast_read(self, client):
        captured = {}

        def fake_set_action(request, **kwargs):
            captured.update(kwargs)
            return _make_response(has_color=False)[0]

        with patch.object(client.stub, "SetAction", side_effect=fake_set_action):
            client.get_status()

        assert captured["timeout"] == 1.5

    def test_skips_the_call_when_the_channel_is_down(self, client):
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "SetAction") as mock_set_action:
            result = client.get_status()

        mock_set_action.assert_not_called()
        assert result["status"] == "ERROR"
        assert result["error"] == "crac-server channel is down"

    def test_a_grpc_error_returns_error_status_and_marks_the_channel_down(self, client):
        with patch.object(client.stub, "SetAction", side_effect=FakeRpcError("boom")):
            result = client.get_status()

        assert result["status"] == "ERROR"
        assert result["gui"]["is_disabled"] is True
        assert client._health.is_down() is True

    def test_a_parsing_error_returns_error_status_without_marking_the_channel_down(self, client):
        """La RPC e' andata a buon fine: un bug nel parsing della risposta
        non e' un crac-server irraggiungibile."""
        with patch.object(client.stub, "SetAction", return_value=MagicMock()), \
             patch.object(client, "_parse_roof_response", side_effect=ValueError("boom")):
            result = client.get_status()

        assert result["status"] == "ERROR"
        assert client._health.is_down() is False
