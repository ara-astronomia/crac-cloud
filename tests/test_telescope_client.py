import pytest
from unittest.mock import MagicMock
from crac_cloud.grpc_cloud.telescope_cloud import TelescopeClient
from crac_protobuf import telescope_pb2, button_pb2


@pytest.fixture(scope="module")
def client():
    return TelescopeClient(host="localhost", port=50051)


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
