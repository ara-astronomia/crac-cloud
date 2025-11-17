from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
import os
import time
from typing import Dict

# Importa i moduli per la logica cloud
from crac_cloud.grpc_cloud.geographic_cloud import GeographicClient
from crac_cloud.grpc_cloud.image_config_cloud import ImageConfigClient
from crac_cloud.grpc_cloud.telescope_cloud import TelescopeClient 
from crac_cloud.image_generator import generate_telescope_maps, OUTPUT_DIR, MAP1_FILENAME, MAP2_FILENAME

# Inizializzazione del Router
router = APIRouter(prefix="/maps", tags=["Maps"])

# --- DIPENDENZE (Simulazione) ---
# N.B.: In un'applicazione FastAPI reale, questi client verrebbero iniettati 
# tramite un pattern di Dependency Injection (DI) o inizializzati all'avvio dell'app.
# Per semplicità, li inizializziamo qui assumendo i tuoi host/port del server.

# Sostituisci con gli indirizzi corretti del tuo CRAC-Server
SERVER_HOST = "localhost" 
SERVER_PORT = 50051 # Porta comune per i servizi gRPC (ad esempio)

# Inizializza i client gRPC
try:
    # Assumiamo che i client siano implementati per connettersi a SERVER_HOST:SERVER_PORT
    # (Potresti dover adattare le porte se i servizi sono su porte diverse)
    geo_client = GeographicClient(SERVER_HOST, SERVER_PORT)
    image_config_client = ImageConfigClient(SERVER_HOST, SERVER_PORT)
    telescope_client = TelescopeClient(SERVER_HOST, SERVER_PORT)
except Exception as e:
    # Gestione semplice degli errori di connessione all'avvio
    print(f"Errore durante l'inizializzazione dei client gRPC: {e}")


def _get_all_required_data() -> Dict:
    """Recupera tutti i dati necessari dai servizi gRPC."""
    
    # Recupera i dati geografici (Lat/Lon/Elev)
    geo_data = geo_client.get_geographic_data()
    if not geo_data or not all(key in geo_data for key in ['latitude', 'longitude', 'elevation']):
        raise HTTPException(status_code=503, detail="Impossibile recuperare i dati geografici dal server.")

    # Recupera i dati di configurazione CCD (FOV)
    ccd_data = image_config_client.get_ccd_image_data()
    if not ccd_data or not all(key in ccd_data for key in ['width', 'height']):
        raise HTTPException(status_code=503, detail="Impossibile recuperare i dati di configurazione immagine dal server.")

    # Recupera lo stato attuale del telescopio (incluse le Eq Coords)
    telescope_status = telescope_client.get_status()
    if not telescope_status or 'eq_coords' not in telescope_status:
        raise HTTPException(status_code=503, detail="Impossibile recuperare lo stato del telescopio dal server.")
    
    # Assicurati che le coordinate equatoriali siano presenti e valide
    eq_coords = telescope_status['eq_coords']
    if not eq_coords or not all(key in eq_coords for key in ['ra', 'dec']):
        raise HTTPException(status_code=503, detail="Coordinate equatoriali non valide o mancanti.")

    return {
        "geo_data": geo_data,
        "ccd_data": ccd_data,
        "eq_coords": eq_coords
    }

# --- ENDPOINTS ---

@router.get("/sky_map_fixed")
def get_fixed_sky_map(t: float = None):
    """
    Genera e restituisce la mappa del cielo a campo visivo fisso (MAPPA 1).
    Il parametro 't' (timestamp) è usato per forzare il ricaricamento del browser.
    """
    try:
        data = _get_all_required_data()
        
        # Genera ENTRAMBE le mappe (perché la logica di generazione è unificata)
        map1_path, _ = generate_telescope_maps(
            data["geo_data"],
            data["eq_coords"],
            data["ccd_data"]
        )
        
        return FileResponse(
            path=map1_path,
            media_type="image/png",
            filename=MAP1_FILENAME
        )
        
    except HTTPException as e:
        # Passa l'errore HTTP (es. 503 Service Unavailable)
        raise e
    except Exception as e:
        # Errore interno (es. Matplotlib crash o I/O)
        raise HTTPException(status_code=500, detail=f"Errore interno nella generazione della mappa: {e}")


@router.get("/tracking_chart")
def get_tracking_chart(t: float = None):
    """
    Genera e restituisce il grafico di tracciato Alt-Az (MAPPA 2).
    Il parametro 't' (timestamp) è usato per forzare il ricaricamento del browser.
    """
    try:
        data = _get_all_required_data()
        
        # Genera ENTRAMBE le mappe
        _, map2_path = generate_telescope_maps(
            data["geo_data"],
            data["eq_coords"],
            data["ccd_data"]
        )
        
        return FileResponse(
            path=map2_path,
            media_type="image/png",
            filename=MAP2_FILENAME
        )
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore interno nella generazione del tracciato: {e}")