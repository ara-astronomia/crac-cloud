class ClientState:
    """Contenitore per lo stato globale persistente nel router."""
    # Definisce la variabile che salverà l'ultimo stato noto di Autolight
    autolight_status: bool = False

# Istanza singola che sarà importata e condivisa
GLOBAL_CLIENT_STATE = ClientState()