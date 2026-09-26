import time


class ChannelHealth:
    """Fast-fail su un crac-server morto: dopo un errore di rete registrato
    da record_failure(), le chiamate successive falliscono subito invece di
    aspettare di nuovo il timeout pieno. Il grpc.Channel sincrono non offre
    un get_state() diretto (solo subscribe(), che lascia un watcher attivo
    per tutta la vita del processo) - lo stato lo teniamo noi.

    Il cooldown fa si' che, passato quel tempo, si riprovi comunque: un
    blocco permanente nasconderebbe un crac-server tornato su."""

    COOLDOWN_SECONDS = 5.0

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
