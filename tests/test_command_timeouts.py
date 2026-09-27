from unittest.mock import MagicMock
import pytest
from crac_cloud.grpc_cloud.button_cloud import ButtonClient
from crac_cloud.grpc_cloud.cover_mirror_cloud import CoverMirrorClient
from crac_cloud.grpc_cloud.curtains_cloud import CurtainsClient
from crac_cloud.grpc_cloud.roof_cloud import RoofClient
from crac_cloud.grpc_cloud.rpc import COMMAND_TIMEOUT
from crac_cloud.grpc_cloud.telescope_cloud import TelescopeClient

COMMANDS = [
    (ButtonClient, lambda client: client.set_switch_action(button_type=0, action=0)),
    (TelescopeClient, lambda client: client.set_action(0)),
    (TelescopeClient, lambda client: client.connect()),
    (TelescopeClient, lambda client: client.disconnect()),
    (RoofClient, lambda client: client.set_action(0)),
    (CoverMirrorClient, lambda client: client.set_action(0)),
    (CurtainsClient, lambda client: client.set_action(0)),
]


@pytest.mark.parametrize("client_class, command", COMMANDS, ids=[
    "switch", "telescope_action", "telescope_connect", "telescope_disconnect", "roof", "cover_mirror", "curtains"])
def test_every_command_uses_the_command_timeout(client_class, command):
    """A hung crac-server holds a command at most COMMAND_TIMEOUT."""
    client = client_class(host="localhost", port=50051)
    client.stub = MagicMock()

    try:
        command(client)
    except Exception:
        pass

    client.stub.SetAction.assert_called_once()
    assert client.stub.SetAction.call_args.kwargs["timeout"] == COMMAND_TIMEOUT
