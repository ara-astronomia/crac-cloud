import pytest
from crac_cloud.grpc_cloud.curtains_cloud import CurtainsClient
from crac_protobuf import curtains_pb2


@pytest.fixture(scope="module")
def client():
    return CurtainsClient(host="localhost", port=50051)


class TestStepsToAngle:
    def test_zero_steps_returns_alpha_min(self, client):
        assert client._steps_to_angle(0) == pytest.approx(client.ALPHA_MIN)

    def test_max_steps_returns_max_angle(self, client):
        assert client._steps_to_angle(client.N_STEP_CORSA) == pytest.approx(client.MAX_ANGLE)

    def test_midpoint_is_within_range(self, client):
        result = client._steps_to_angle(client.N_STEP_CORSA / 2)
        assert client.ALPHA_MIN < result < client.MAX_ANGLE

    def test_negative_steps_clamp_to_alpha_min(self, client):
        assert client._steps_to_angle(-50) == pytest.approx(client.ALPHA_MIN)

    def test_steps_beyond_max_clamp_to_max_angle(self, client):
        assert client._steps_to_angle(client.N_STEP_CORSA * 2) == pytest.approx(client.MAX_ANGLE)

    def test_angle_increases_with_steps(self, client):
        low = client._steps_to_angle(10)
        high = client._steps_to_angle(100)
        assert high > low


class TestGetEnumName:
    def test_known_status_value_returns_name(self, client):
        val = curtains_pb2.CurtainStatus.Value("CURTAIN_DISABLED")
        assert client._get_enum_name(val, curtains_pb2.CurtainStatus) == "CURTAIN_DISABLED"

    def test_known_orientation_value_returns_name(self, client):
        descriptor = curtains_pb2.CurtainOrientation.DESCRIPTOR
        first = next(iter(descriptor.values_by_number.items()))
        value, desc = first
        assert client._get_enum_name(value, curtains_pb2.CurtainOrientation) == desc.name

    def test_unknown_value_returns_string_repr(self, client):
        assert client._get_enum_name(9999, curtains_pb2.CurtainStatus) == "9999"
