"""The frontend copies the protobuf enums by hand in alerts.js. These tests
fail when crac-protobuf renumbers an enum and the copy is not updated."""
import re
from pathlib import Path

from crac_protobuf.emergency_closure_pb2 import (
    EmergencyClosureBlockReason,
    EmergencyClosureStatus,
    EmergencyClosureTrigger,
)

ALERTS_JS = Path(__file__).parent.parent / "crac_cloud" / "static" / "js" / "alerts.js"


def _js_block(name):
    source = ALERTS_JS.read_text()
    match = re.search(rf"(?:export )?const {name} = \{{(.*?)\}};", source, re.S)
    assert match, f"{name} not found in alerts.js"
    return match.group(1)


def js_enum(name):
    """Parse a `const NAME = { KEY: number, ... };` block from alerts.js."""
    return {key: int(value) for key, value in re.findall(r"(\w+):\s*(\d+)", _js_block(name))}


def js_named_keys(name):
    """Parse a `const NAME = { [CONST.KEY]: 'text', ... };` block, returning the keys.

    Raw numeric keys are rejected: they would bypass the check against the proto names.
    """
    block = _js_block(name)
    assert not re.search(r"^\s*\d+\s*:", block, re.M), f"{name} has a raw numeric key"
    return set(re.findall(r"\[\w+\.(\w+)\]", block))


def proto_enum(enum, prefix):
    return {name.removeprefix(prefix): value for name, value in enum.items()}


def proto_names(enum, prefix):
    return {name.removeprefix(prefix) for name, value in enum.items() if value != 0}


class TestProtoEnumSync:

    def test_closure_status_matches_proto(self):
        assert js_enum("EMERGENCY_CLOSURE_STATUS") == proto_enum(
            EmergencyClosureStatus, "EMERGENCY_CLOSURE_STATUS_",
        )

    def test_closure_trigger_matches_proto(self):
        assert js_enum("EMERGENCY_CLOSURE_TRIGGER") == proto_enum(
            EmergencyClosureTrigger, "EMERGENCY_CLOSURE_TRIGGER_",
        )

    def test_block_reason_matches_proto(self):
        assert js_enum("EMERGENCY_CLOSURE_BLOCK_REASON") == proto_enum(
            EmergencyClosureBlockReason, "EMERGENCY_CLOSURE_BLOCK_REASON_",
        )

    def test_trigger_text_covers_every_trigger(self):
        assert js_named_keys("TRIGGER_TEXT") == proto_names(
            EmergencyClosureTrigger, "EMERGENCY_CLOSURE_TRIGGER_",
        )

    def test_block_reason_text_covers_every_reason(self):
        assert js_named_keys("BLOCK_REASON_TEXT") == proto_names(
            EmergencyClosureBlockReason, "EMERGENCY_CLOSURE_BLOCK_REASON_",
        )

    def test_block_reason_action_covers_the_reasons_with_a_known_action(self):
        known = proto_names(EmergencyClosureBlockReason, "EMERGENCY_CLOSURE_BLOCK_REASON_")
        keys = js_named_keys("BLOCK_REASON_ACTION_TEXT")
        assert keys <= known
        assert {"TELESCOPE_UNKNOWN", "PARK_NOT_REACHED", "CURTAINS_NOT_DISABLED"} <= keys
