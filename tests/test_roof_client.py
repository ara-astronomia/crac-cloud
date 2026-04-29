import pytest
from unittest.mock import MagicMock
from crac_cloud.grpc_cloud.roof_cloud import RoofClient
from crac_protobuf import roof_pb2, button_pb2


@pytest.fixture(scope="module")
def client():
    return RoofClient(host="localhost", port=50051)


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
