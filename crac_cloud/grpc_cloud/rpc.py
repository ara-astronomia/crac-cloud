"""Timeouts and response shapes shared by the gRPC clients. UPS and weather
reads get SLOW_READ_TIMEOUT: server-side they wait on NUT and on an HTTP fetch."""

FAST_READ_TIMEOUT = 1.5
SLOW_READ_TIMEOUT = 5.0
COMMAND_TIMEOUT = 5.0


def error_status(message: str) -> dict:
    """Status payload for a control whose state is unknown: a disabled red button."""
    return {
        "status": "ERROR",
        "gui": {
            "label": "LABEL_ERROR",
            "is_disabled": True,
            "button_color": {"text_color": "white", "background_color": "red"},
        },
        "error": message,
    }
