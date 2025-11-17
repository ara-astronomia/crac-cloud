# crac_cloud/image_generator.py

import os
import numpy as np
import matplotlib.pyplot as plt
from astropy.coordinates import EarthLocation, SkyCoord
from astropy.time import Time
import astropy.units as u
from astroplan import Observer, FixedTarget
from astroplan.plots import plot_sky
from astropy.wcs import WCS
from typing import Dict, Tuple

# --- CONFIGURAZIONE ---
# Directory dove verranno salvate le immagini generate
OUTPUT_DIR = "crac_cloud/static/maps"
MAP1_FILENAME = "fixed_field_map.png"
MAP2_FILENAME = "tracking_chart.png"

# --- FUNZIONE PRINCIPALE ---

def generate_telescope_maps(
    geo_data: Dict[str, float], 
    current_eq_coords: Dict[str, float], 
    ccd_data: Dict[str, float]
) -> Tuple[str, str]:
    """
    Genera le due mappe astronomiche: Mappa a campo fisso e Grafico di tracciato.

    Args:
        geo_data: Dati geografici (latitude, longitude, elevation).
        current_eq_coords: Coordinate attuali del telescopio (ra, dec in gradi decimali).
        ccd_data: Dati del campo visivo (width, height in minuti d'arco).

    Returns:
        Una tupla contenente i percorsi completi delle due immagini generate.
    """
    
    # 1. Preparazione delle Variabili
    
    # Crea la directory di output
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    map1_path = os.path.join(OUTPUT_DIR, MAP1_FILENAME)
    map2_path = os.path.join(OUTPUT_DIR, MAP2_FILENAME)

    # Dati di posizione
    location = EarthLocation(
        lat=geo_data['latitude'] * u.deg, 
        lon=geo_data['longitude'] * u.deg, 
        height=geo_data['elevation'] * u.m
    )
    observer = Observer(location=location)
    current_time = Time.now()
    
    # Coordinate del centro/puntamento (convertite in oggetti SkyCoord)
    center_coord = SkyCoord(
        ra=current_eq_coords['ra'] * u.deg, 
        dec=current_eq_coords['dec'] * u.deg, 
        frame='icrs'
    )
    
    # Dimensioni del campo visivo (convertite da minuti d'arco a gradi)
    field_width_deg = ccd_data['width'] / 60
    field_height_deg = ccd_data['height'] / 60
    
    # 2. Generazione delle Mappe
    
    # Mappa 1: Sky Map a Campo Fisso
    _generate_fixed_field_map(center_coord, field_width_deg, field_height_deg, map1_path)

    # Mappa 2: Grafico di Tracciato (Alt-Az)
    _generate_tracking_chart(observer, center_coord, current_time, map2_path)
    
    return map1_path, map2_path

# ----------------------------------------------------------------------
# --- FUNZIONI DI PLOTTING PRIVATE ---
# ----------------------------------------------------------------------

def _generate_fixed_field_map(center_coord: SkyCoord, width_deg: float, height_deg: float, save_path: str):
    """
    Genera la Mappa del Cielo centrata sul puntamento del telescopio con i limiti del campo visivo.
    """
    
    # Crea un oggetto WCS (World Coordinate System) per la proiezione
    w = WCS(naxis=2)
    w.wcs.crpix = [1, 1] 
    w.wcs.cdelt = [-width_deg / 100, height_deg / 100] # Risoluzione (può essere regolata)
    w.wcs.crval = [center_coord.ra.deg, center_coord.dec.deg] 
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"] 
    
    # Crea la figura
    fig = plt.figure(figsize=(8, 8))
    ax = fig.add_subplot(111, projection=w)
    
    # Imposta i limiti dell'asse per il campo visivo (usando i gradi decimali)
    ax.set_xlim(center_coord.ra.deg - width_deg/2, center_coord.ra.deg + width_deg/2)
    ax.set_ylim(center_coord.dec.deg - height_deg/2, center_coord.dec.deg + height_deg/2)
    
    # Aggiungi un marcatore per il punto di puntamento
    ax.plot(
        center_coord.ra.deg, 
        center_coord.dec.deg, 
        'r+', 
        transform=ax.get_transform('icrs'), 
        markersize=12, 
        label='Puntamento Telescopio'
    )
    
    # Etichette e Griglia
    ax.set_xlabel('Ascensione Retta (RA)')
    ax.set_ylabel('Declinazione (DEC)')
    ax.grid(color='gray', alpha=0.5, linestyle='--')
    
    plt.title(f"Campo Visivo ({width_deg*60:.0f}' x {height_deg*60:.0f}') Centrato su Target")
    plt.legend(loc='lower left')
    plt.savefig(save_path, bbox_inches='tight')
    plt.close(fig)


def _generate_tracking_chart(observer: Observer, tracking_coord: SkyCoord, current_time: Time, save_path: str):
    """
    Genera il grafico Alt-Az del tracciato del target con la posizione attuale evidenziata.
    """
    
    # Definisce il target fisso per il tracciato (centro attuale)
    tracking_target = FixedTarget(name='Target', coord=tracking_coord)
    
    # Periodo di osservazione: Tracciato di 10 ore centrato sull'istante attuale
    observe_times = current_time + np.linspace(-5, 5, 50) * u.hour
    
    # Plot del tracciato completo (Alt-Az)
    fig = plt.figure(figsize=(10, 6))
    
    plot_sky(
        tracking_target, 
        observer, 
        observe_times, 
        north_to_east_ccw=False, 
        style_kwargs={'color': 'gray', 'linestyle': ':', 'marker': 'None', 'alpha': 0.7}, 
        label='Tracciato Bersaglio (10h)'
    )

    # Calcola la posizione Alt-Az istantanea del telescopio
    current_altaz = observer.altaz(current_time, tracking_target)

    # Ottieni gli assi del plot
    ax = plt.gca()

    # Plot del punto della POSIZIONE ATTUALE (oggetto colorato)
    ax.plot(
        current_altaz.az.deg, 
        current_altaz.alt.deg, 
        'o', # Marker: cerchio
        color='red', 
        label='Posizione Attuale',
        markersize=10, 
        zorder=10 # Assicura che sia sopra il tracciato
    ) 

    ax.set_title(f"Tracciato Alt-Az del Target")
    ax.legend(loc='upper right')
    
    plt.savefig(save_path, bbox_inches='tight')
    plt.close(fig)