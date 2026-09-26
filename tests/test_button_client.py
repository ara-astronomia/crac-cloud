import pytest
from unittest.mock import MagicMock, patch
from crac_cloud.grpc_cloud.button_cloud import ButtonClient
from crac_cloud.grpc_cloud.channel_health import CHANNEL_DOWN_MESSAGE
from crac_protobuf import button_pb2


@pytest.fixture(scope="module")
def client():
    return ButtonClient(host="localhost", port=50051)


def _first_enum_value(enum_type):
    descriptor = enum_type.DESCRIPTOR
    entry = next(iter(descriptor.values_by_number.items()))
    return entry[0], entry[1].name


def _make_response():
    status_val, status_name = _first_enum_value(button_pb2.ButtonStatus)
    type_val, type_name = _first_enum_value(button_pb2.ButtonType)
    label_val, label_name = _first_enum_value(button_pb2.ButtonLabel)
    key_val, key_name = _first_enum_value(button_pb2.ButtonKey)

    mock = MagicMock()
    mock.status = status_val
    mock.type = type_val
    mock.button_gui.metadata = "meta"
    mock.button_gui.label = label_val
    mock.button_gui.is_disabled = False
    mock.button_gui.key = key_val
    mock.button_gui.HasField.return_value = False
    return mock, type_val


class TestGetSingleSwitchStatusTimeout:
    def test_uses_short_timeout_for_a_fast_read(self, client):
        """get_single_switch_status answers in a few ms on a healthy stack: a
        5s timeout is 50-1500x more than needed and needlessly delays
        diagnosis when crac-server is dead."""
        response, type_val = _make_response()
        captured = {}

        def fake_set_action(request, **kwargs):
            captured.update(kwargs)
            return response

        with patch.object(client.stub, "SetAction", side_effect=fake_set_action):
            client.get_single_switch_status("KEY_TELE_SWITCH", type_val)

        assert captured["timeout"] == 1.5


class TestFastFailOnDownChannel:
    def test_set_switch_action_skips_the_call(self, client):
        response, type_val = _make_response()
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "SetAction") as mock_set_action:
            result = client.set_switch_action(type_val, button_pb2.ButtonAction.TURN_ON)

        mock_set_action.assert_not_called()
        assert result == {"status": "error", "message": CHANNEL_DOWN_MESSAGE}

    def test_get_single_switch_status_skips_the_call(self, client):
        _, type_val = _make_response()
        with patch.object(client._health, "is_down", return_value=True), \
             patch.object(client.stub, "SetAction") as mock_set_action:
            result = client.get_single_switch_status("KEY_TELE_SWITCH", type_val)

        mock_set_action.assert_not_called()
        assert result == {"error": CHANNEL_DOWN_MESSAGE, "status": "UNKNOWN"}
