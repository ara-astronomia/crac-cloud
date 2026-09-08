import pytest
from unittest.mock import MagicMock
from crac_cloud.grpc_cloud.cover_mirror_cloud import CoverMirrorClient
from crac_protobuf import cover_mirror_pb2, button_pb2


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
