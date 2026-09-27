import pytest
from unittest.mock import MagicMock, patch
from crac_cloud.grpc_cloud.cover_mirror_cloud import CoverMirrorClient
from crac_cloud.grpc_cloud.rpc import FAST_READ_TIMEOUT
from crac_protobuf import cover_mirror_pb2, button_pb2
from tests.conftest import FakeRpcError


@pytest.fixture(scope="module")
def client():
    return CoverMirrorClient(host="localhost", port=50051)


def _make_response(action, status=cover_mirror_pb2.CoverMirrorStatus.COVER_MIRROR_ERROR):
    mock = MagicMock()
    mock.status = status
    mock.button_gui.HasField.return_value = True
    mock.button_gui.label = button_pb2.ButtonLabel.LABEL_ERROR
    mock.button_gui.metadata = action
    mock.button_gui.is_disabled = False
    mock.button_gui.button_color.text_color = "white"
    mock.button_gui.button_color.background_color = "red"
    return mock


def test_metadata_is_the_action_name_not_a_number(client):
    parsed = client._parse_cover_mirror_response(
        _make_response(cover_mirror_pb2.CoverMirrorAction.CLOSE_COVER_MIRROR)
    )
    assert parsed["gui"]["metadata"] == "CLOSE_COVER_MIRROR"


def test_metadata_open_action(client):
    parsed = client._parse_cover_mirror_response(
        _make_response(cover_mirror_pb2.CoverMirrorAction.OPEN_COVER_MIRROR)
    )
    assert parsed["gui"]["metadata"] == "OPEN_COVER_MIRROR"


def test_status_and_label_stay_names(client):
    parsed = client._parse_cover_mirror_response(
        _make_response(cover_mirror_pb2.CoverMirrorAction.OPEN_COVER_MIRROR)
    )
    assert parsed["status"] == "COVER_MIRROR_ERROR"
    assert parsed["gui"]["label"] == "LABEL_ERROR"
    assert parsed["gui"]["button_color"] == {"text_color": "white", "background_color": "red"}


def test_missing_button_color_falls_back_to_gray(client):
    response = _make_response(cover_mirror_pb2.CoverMirrorAction.OPEN_COVER_MIRROR)
    response.button_gui.HasField.return_value = False
    parsed = client._parse_cover_mirror_response(response)
    assert parsed["gui"]["button_color"] == {"text_color": "white", "background_color": "gray"}


class TestGetStatus:
    def test_returns_parsed_data(self, client):
        response = _make_response(cover_mirror_pb2.CoverMirrorAction.OPEN_COVER_MIRROR)
        with patch.object(client.stub, "SetAction", return_value=response):
            result = client.get_status()

        assert result["gui"]["metadata"] == "OPEN_COVER_MIRROR"

    def test_uses_short_timeout_for_a_fast_read(self, client):
        captured = {}

        def fake_set_action(request, **kwargs):
            captured.update(kwargs)
            return _make_response(cover_mirror_pb2.CoverMirrorAction.OPEN_COVER_MIRROR)

        with patch.object(client.stub, "SetAction", side_effect=fake_set_action):
            client.get_status()

        assert captured["timeout"] == FAST_READ_TIMEOUT

    def test_a_grpc_error_returns_error_status(self, client):
        with patch.object(client.stub, "SetAction", side_effect=FakeRpcError("boom")):
            result = client.get_status()

        assert result["status"] == "ERROR"

    def test_a_parsing_error_returns_error_status(self, client):
        with patch.object(client.stub, "SetAction", return_value=MagicMock()), \
             patch.object(client, "_parse_cover_mirror_response", side_effect=ValueError("boom")):
            result = client.get_status()

        assert result["status"] == "ERROR"
