from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import Dict
import asyncio
import re

# Importa i moduli per la logica cloud
from crac_cloud.config import Config
from crac_cloud.grpc_cloud.geographic_cloud import GeographicClient
from crac_cloud.grpc_cloud.image_config_cloud import ImageConfigClient
from crac_cloud.grpc_cloud.telescope_cloud import TelescopeClient
from crac_cloud.image_generator import generate_telescope_maps, compute_airmass, MAP1_FILENAME, MAP2_FILENAME 
import astroplan
import sys

print("Python path:", sys.executable)
print("Astroplan path:", astroplan.__file__)
print("Astroplan version:", astroplan.__version__)

router = APIRouter(prefix="/maps", tags=["Maps"])


config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

geo_client = GeographicClient(host=grpc_host, port=grpc_port)
image_config_client = ImageConfigClient(host=grpc_host, port=grpc_port)
telescope_client = TelescopeClient(host=grpc_host, port=grpc_port)
print("Map router: Client gRPC inizializzati.")
LAST_EQ_COORDS = None

# --------------------------------------------------------------
# ASYNC: recupera TUTTI i dati richiesti
# --------------------------------------------------------------
# Funzione di utilità per convertire DMS in decimali

async def _get_all_required_data() -> dict:
    print("Recupero dati dai servizi gRPC...")

    # Lancia le richieste async in parallelo
    geo_task = asyncio.create_task(geo_client.get_geographic_data())
    ccd_task = asyncio.create_task(image_config_client.get_ccd_image_data())
    

    # Recupera lo stato telescopio (sincrono per ora)
    telescope_status = telescope_client.get_status()

    # Attendi risposte asincrone
    geo_data, ccd_data = await asyncio.gather(geo_task, ccd_task)
    print(f"questo è il dato ccd_task che torna dal server {ccd_data} , {geo_data}")

    # --- Controllo dati geografici ---
    print(f"questi sono i geodata che tornano dal server: {geo_data}")

    if not geo_data or not all(k in geo_data for k in ['latitude', 'longitude', 'elevation']):
        raise HTTPException(status_code=503, detail="Impossibile recuperare i dati geografici dal server.")

    # --- Controllo CCD ---
    if not ccd_data or not all(k in ccd_data for k in ['width', 'height']):
        raise HTTPException(status_code=503, detail="Impossibile recuperare i dati CCD dal server.")

    # --- Controllo telescopio ---
    tel_state = telescope_status.get("status", "DISCONNECTED")

    if tel_state in ["DISCONNECTED", "ERROR", "CRITICAL_ERROR", "LOST"]:
        print(">>> Telescopio non connesso → eq_coords = None")
        return {
            "geo_data": geo_data,
            "ccd_data": ccd_data,
            "eq_coords": None
        }

    eq_coords = telescope_status.get("eq_coords", None)
    if not eq_coords or not all(k in eq_coords for k in ["ra", "dec"]):
        print(">>> Telescopio connesso ma coordinate mancanti → eq_coords = None")
        eq_coords = None

    print(f"Coordinate Equatoriali: {eq_coords}")
    print(f"Geo (decimale): {geo_data}")
    print(f"CCD: {ccd_data}")

    return {
        "geo_data": geo_data,
        "ccd_data": ccd_data,
        "eq_coords": eq_coords
    }

#---------------------------------------------------------------
#CONTROLO IL CAMBIAMENTO DELLE COORDINATE EQUATORIALI
#---------------------------------------------------------------
def eq_coords_changed(new_coords: dict) -> bool:
    global LAST_EQ_COORDS
    
    if new_coords is None:
        return False  # niente coordinate = niente confronto
    if LAST_EQ_COORDS is None:
        LAST_EQ_COORDS = new_coords
        return True  # prima volta che le riceviamo
    
    changed = (
        abs(new_coords["ra"] - LAST_EQ_COORDS["ra"]) > 1e-6 or
        abs(new_coords["dec"] - LAST_EQ_COORDS["dec"]) > 1e-6
    )
    if changed:
        LAST_EQ_COORDS = new_coords
    return changed
# --------------------------------------------------------------
# ENDPOINT 1 – Tracking map
# --------------------------------------------------------------
@router.get("/tracking_chart")
async def get_tracking_chart(t: float = None):
    print("ORA ENTRATO IN /tracking_chart")
    try:
        data = await _get_all_required_data()

        # Se il telescopio è OFFLINE → niente tracking chart
        if data["eq_coords"] is None:
            return {
                "error": "TELESCOPE_NOT_CONNECTED",
                "message": "Connetti il telescopio per generare il grafico di tracking."
            }

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

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore interno: {e}")
# --------------------------------------------------------------
# ENDPOINT 2 – Sky map
# --------------------------------------------------------------
@router.get("/sky_map_fixed")
async def get_fixed_sky_map(t: float = None):
    print(">>> ENTRATO IN /sky_map_fixed")

    try:
        data = await _get_all_required_data()

        # Se il telescopio è OFFLINE → niente mappa
        if data["eq_coords"] is None:
            return {
                "error": "TELESCOPE_NOT_CONNECTED",
                "message": "Connetti il telescopio per generare la mappa del campo."
            }
        coords_have_changed = eq_coords_changed(data["eq_coords"])
        print(f"Coordinate eq cambiate? {coords_have_changed}")  

        map1_path, _ = generate_telescope_maps(
            data["geo_data"],
            data["eq_coords"],
            data["ccd_data"]
        )   

        if not coords_have_changed:
            print("Coordinate eq non cambiate, riuso l'ultima mappa generata.")
            return FileResponse(
                path=map1_path,
                media_type="image/png",
                filename=MAP1_FILENAME
            )   
        
        return FileResponse(
            path=map1_path,
            media_type="image/png",
            filename=MAP1_FILENAME
        )

    except Exception as e:
        print(">>> ERRORE NELL'ENDPOINT:", e)
        raise
# --------------------------------------------------------------
# ENDPOINT 3 – AIRMASS
# --------------------------------------------------------------

@router.get("/airmass")
async def get_airmass():
    print("ENDPOINT /airmass CHIAMATO")
    try:
        data = await _get_all_required_data()

        # Se il telescopio è OFFLINE → niente tracking chart
        if data["eq_coords"] is None:
            return {
                "error": "TELESCOPE_NOT_CONNECTED",
                "message": "Connetti il telescopio per generare il grafico di tracking."
            }

        airmass_now = compute_airmass(
            data["geo_data"],
            data["eq_coords"]
        )

        return {"airmass": f"{airmass_now:.3f}"}


    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore interno: {e}")
