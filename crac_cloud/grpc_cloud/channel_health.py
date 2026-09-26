import time


class ChannelHealth:
    """Fast-fail su un canale caduto: dopo record_failure() le chiamate
    successive falliscono subito, per COOLDOWN_SECONDS, poi si riprova.
    Il grpc.Channel sincrono non ha un get_state() diretto: lo stato lo teniamo noi."""

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
