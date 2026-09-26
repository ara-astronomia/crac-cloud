import time

CHANNEL_DOWN_MESSAGE = "crac-server channel is down"


def down_error() -> dict:
    return {"error": CHANNEL_DOWN_MESSAGE}


def error_status(message: str) -> dict:
    return {
        "status": "ERROR",
        "gui": {
            "label": "LABEL_ERROR",
            "is_disabled": True,
            "button_color": {"text_color": "white", "background_color": "red"},
        },
        "error": message,
    }


class ChannelHealth:
    """Fast-fails a down channel: after record_failure(), calls fail
    immediately for COOLDOWN_SECONDS, then retry. The sync grpc.Channel has
    no direct get_state(): we track the state ourselves."""

    COOLDOWN_SECONDS = 2.0

    def __init__(self):
        self._down_since = None

    def record_failure(self):
        self._down_since = time.monotonic()

    def record_success(self):
        self._down_since = None

    def is_down(self) -> bool:
        if self._down_since is None:
            return False
        return (time.monotonic() - self._down_since) < self.COOLDOWN_SECONDS
