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


def js_text_keys(name):
    """Parse a `const NAME = { number: 'text', ... };` block, returning the keys."""
    return {int(key) for key in re.findall(r"(\d+):\s*'", _js_block(name))}


def proto_enum(enum, prefix):
    return {name.removeprefix(prefix): value for name, value in enum.items()}


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
        expected = {value for _, value in EmergencyClosureTrigger.items() if value != 0}
        assert js_text_keys("TRIGGER_TEXT") == expected

    def test_block_reason_text_covers_every_reason(self):
        expected = {value for _, value in EmergencyClosureBlockReason.items() if value != 0}
        assert js_text_keys("BLOCK_REASON_TEXT") == expected

    def test_block_reason_action_covers_a_subset_of_reasons(self):
        known = {value for _, value in EmergencyClosureBlockReason.items() if value != 0}
        assert js_text_keys("BLOCK_REASON_ACTION_TEXT") <= known
