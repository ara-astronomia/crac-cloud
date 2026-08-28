# crac_cloud/image_generator.py
import logging
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from astroquery.skyview import SkyView

# Workaround: astroplan 0.10.1 passes grid=grid to SkyView.get_images(),
# but astroquery >= 0.4.8 removed that parameter (issue astropy/astroplan#588).
# Remove this patch once astroplan > 0.10.1 is released and the dependency is updated.
_orig_get_images = SkyView.get_images
def _get_images_no_grid(*args, **kwargs):
    kwargs.pop('grid', None)
    return _orig_get_images(*args, **kwargs)
SkyView.get_images = _get_images_no_grid

from astropy.coordinates import EarthLocation, SkyCoord
from astropy.time import Time,TimeDelta
import astropy.units as u
from astroplan import Observer, FixedTarget
from astroplan.plots import plot_sky
from astroplan.plots import plot_finder_image
from astroplan.plots import plot_airmass
import astroplan.plots.finder as finder
from astropy.wcs import WCS
import matplotlib.patches as patches
from typing import Dict, Tuple

from astropy.coordinates import solar_system
from astropy.coordinates.solar_system import get_body
from astropy.coordinates import search_around_sky
import warnings
from astropy.utils.exceptions import AstropyWarning

warnings.filterwarnings('ignore', category=UserWarning, module='matplotlib')
warnings.filterwarnings('ignore', message='.*TimeDelta.*', category=AstropyWarning)

logger = logging.getLogger(__name__)

# --- CONFIGURAZIONE ---
# Directory dove verranno salvate le immagini generate
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(PROJECT_ROOT, "crac_cloud", "static")
OUTPUT_DIR = os.path.join(STATIC_DIR, "maps")
MAP1_FILENAME = "fixed_field_map.png"
MAP2_FILENAME = "tracking_chart.png"
os.makedirs(OUTPUT_DIR, exist_ok=True)

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

    logger.info(">>> OUTPUT_DIR:", OUTPUT_DIR)
    logger.info(">>> Saving field map to:", map1_path)

    # Dati di posizione
    logger.info("TIPI GEO:", type(geo_data['latitude']), type(geo_data['longitude']), type(geo_data['elevation']))

    location = EarthLocation(
        lat=geo_data['latitude'], #* u.deg, 
        lon=geo_data['longitude'], #* u.deg, 
        height=geo_data['elevation'] #* u.m
    )
    observer = Observer(location=location)
    current_time = Time.now()
    
    # Coordinate del centro/puntamento (convertite in oggetti SkyCoord)
    center_coord = SkyCoord(
        ra=current_eq_coords['ra'] * u.deg, 
        dec=current_eq_coords['dec'] * u.deg, 
        frame='icrs'
    )
    logger.info(f"Center Coord: RA={center_coord.ra.deg}, DEC={center_coord.dec.deg}")
    # Dimensioni del campo visivo (convertite da minuti d'arco a gradi)
    field_width_deg = ccd_data['width'] 
    field_height_deg = ccd_data['height']
    logger.info(field_width_deg, field_height_deg)
    
    # 2. Generazione delle Mappe
    
    # Mappa 1: Sky Map a Campo Fisso
    logger.info(center_coord, ccd_data, map1_path, field_width_deg, field_height_deg)
    # Mappa 2: Grafico di Tracciato (Alt-Az)
    try:
        _generate_tracking_chart(observer, center_coord, current_time, map2_path)
    except Exception as e:
        logger.error(f" ❌ Errore nella generazione del grafico di tracciato: {e}")      
    try:     
        _generate_field_map(center_coord, map1_path, field_width_deg, field_height_deg)
    except Exception as e:
        logger.error(f" ❌ Errore nella generazione della mappa del cielo: {e}")   
        fallback = os.path.join(OUTPUT_DIR,  "backup_map.png")
        import shutil
        shutil.copy(fallback, map1_path)
         
    return map1_path, map2_path

# ----------------------------------------------------------------------
# --- FUNZIONI DI PLOTTING SKYMAP ---
# ----------------------------------------------------------------------
def _generate_field_map(center_coord, save_path, field_width_deg, field_height_deg):
    width = (field_width_deg+20) * u.arcmin
    height = (field_height_deg+20) * u.arcmin

    logger.info(f"Scarico immagine DSS per RA={center_coord.ra.deg}, DEC={center_coord.dec.deg}")
    logger.info(f"Dimensioni mappa: {width} x {height}")
    ra_val = float(center_coord.ra.deg)
    ra_val_hour=ra_val *u.hour 
    dec_val = (center_coord.dec) 
    telescope_coord = SkyCoord(ra=ra_val_hour, dec=dec_val, frame='icrs')
    target = FixedTarget(name='Telescope', coord=telescope_coord)
    

    rect_width_arcmin = field_width_deg * u.arcmin
    rect_height_arcmin = field_height_deg * u.arcmin
    download_width = width.to(u.deg)
    download_height = height.to(u.deg)
    # fov_radius deve coprire l'intero campo reale (compreso il margine), non un valore fisso:
    # altrimenti la scala degli assi WCS restituita da plot_finder_image (che dipende
    # dall'immagine DSS scaricata) non corrisponde al campo effettivamente inquadrato.
    fov_radius = max(width, height) / 2
    logger.info(f"Dimensioni immagine scaricata in gradi: {download_width} x {download_height}")
    ax, hdu = plot_finder_image(target, fov_radius=fov_radius, survey="DSS")
    ax.coords[0].set_major_formatter('hh:mm')  # asse RA: solo ore/minuti, niente secondi

    try:
        cdelt1 = abs(hdu.header['CDELT1']) * u.deg # Scala lungo l'asse X
        cdelt2 = abs(hdu.header['CDELT2']) * u.deg # Scala lungo l'asse Y
    except KeyError:
        logger.error(" ❌ Errore: Header FITS non contiene CDELT1/CDELT2. Impossibile calcolare il FoV.")
        # Se non possiamo calcolare, usciamo o usiamo un fallback
        plt.close() 
        return
    # Calcola la scala in arcmin/pixel
    pix_scale_arcmin_x = cdelt1.to(u.arcmin).value 
    pix_scale_arcmin_y = cdelt2.to(u.arcmin).value

    # Conversione da arcmin a pixel
    rect_width_pix = (rect_width_arcmin.to(u.arcmin).value / pix_scale_arcmin_x)
    rect_height_pix = (rect_height_arcmin.to(u.arcmin).value / pix_scale_arcmin_y)

    # 4. AGGIUNTA DEL RETTANGOLO FOV (SOSTITUISCE find.add_fov_rectangle)    
    image_width = hdu.data.shape[1]
    image_height = hdu.data.shape[0]

    # Centratura in pixel
    center_x = image_width / 2
    center_y = image_height / 2    
    bottom_left_x = center_x - (rect_width_pix / 2)
    bottom_left_y = center_y - (rect_height_pix / 2)
    
        # Crea l'oggetto Rectangle
    rect = patches.Rectangle((bottom_left_x, bottom_left_y), rect_width_pix, rect_height_pix,
                             linewidth=1.5, edgecolor='red', facecolor='none', 
                             label=f"FoV ({field_width_deg}' x {field_height_deg}')")
    ax.add_patch(rect)
    ax.set_title("Campo inquadrato")  
    ax.legend(loc='upper right', fontsize=8)
        
    # 5. SALVATAGGIO E PULIZIA
    # Ottieni la figura corrente (quella creata da plot_finder_image)
    current_fig = plt.gcf() 
    
    # Salva la figura corrente
    current_fig.savefig(save_path, bbox_inches="tight", dpi=200)
    
    # Chiudi la figura
    plt.close(current_fig)
    logger.info(f"MAPPA DEL CIELO SALVATA IN {save_path}")
#----------------------------------------------------------------------
#--- FUNZIONI DI PLOTTING TRACKING TELESCOPE ---
#----------------------------------------------------------------------
def _generate_tracking_chart(observer, center_coord, current_time, save_path):

    # 1. Definisci il Target del Telescopio
    ra_val = float(center_coord.ra.deg)
    ra_val_hour=ra_val *u.hour 
    dec_val = (center_coord.dec) 
    telescope_coord = SkyCoord(ra=ra_val_hour, dec=dec_val, frame='icrs')
    telescope_target = FixedTarget(name='Telescope', coord=telescope_coord)
    times = current_time + np.linspace(-12, 12, 100) * u.hour 
 
    # 3. Genera il Grafico
    fig, ax = plt.subplots(1, 1, figsize=(5, 5))
    
    # Traccia la curva Altitudine/Airmass del punto puntato
    plot_airmass(
        telescope_target, 
        observer, 
        times, 
        brightness_shading=True,
        altitude_yaxis=True,
        ax=ax,
        style_kwargs={'color': 'blue'}
    )
    # 4. Aggiungi il Punto Attuale
    # Calcola l'altitudine esatta all'istante attuale
    altaz_now = observer.altaz(current_time, telescope_target.coord)
    alt_now = altaz_now.alt.to(u.deg).value

    time_for_plot =current_time.datetime

    # Aggiungi il marker del punto attuale
    ax.plot(
        time_for_plot,
        alt_now, 
        marker='^',
        markersize=60,         
        color='red',  
        zorder=10 # Assicura che sia sopra la linea
    )
    
    airmass_now = altaz_now.secz.value
    airmass_formatted = f"{airmass_now:.3f}"   
    time_for_plot = current_time.datetime
    
    # 5. AGGIUNGI LINEE DI RIFERIMENTO (VERTICALE e ORIZZONTALE)
    
    # Linea Verticale (Tempo Corrente)
    ax.axvline(
        time_for_plot,
        color='red',
        linestyle='-',
        linewidth=1.5,
        zorder=5,
        label=f'UTC: {time_for_plot.strftime("%d-%m-%Y %H:%M:%S")}'
    )
    
    # Linea Orizzontale (Altitudine Corrente)
    ax.axhline(
        airmass_now,
        color='red',
        linestyle=':',
        linewidth=1,
        zorder=4
        )
   
    ax.axhline(20, color='gray', linestyle='--', linewidth=1, alpha=0.5)

    ax.legend(loc='lower right')
    
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close(fig)

    logger.info(f"GRAFICO DELL'AIRMASS SALVATO IN {save_path}")
    logger.info(f"VALORE AIRMASS ATTUALE: {airmass_formatted}")

def compute_airmass(
        geo_data: Dict[str, float], 
        current_eq_coords: Dict[str, float]
        ) -> Tuple[str, str]:
    """
    Calcola SOLO l'airmass attuale senza generare immagini.
    È leggerissima e veloce (millisecondi).
    """
    logger.info("CALCOLO L'AIRMASS CON COMPUTE_AIRMASS")
    location = EarthLocation(
        lat=geo_data['latitude'], #* u.deg, 
        lon=geo_data['longitude'], #* u.deg, 
        height=geo_data['elevation'] #* u.m
    )
    logger.info(f"Location: {location}")
    observer = Observer(location=location)
    logger.info(f"Observer: {observer}")
    current_time = Time.now()
    
    # Coordinate del centro/puntamento (convertite in oggetti SkyCoord)
    center_coord = SkyCoord(
        ra=current_eq_coords['ra'] * u.deg, 
        dec=current_eq_coords['dec'] * u.deg, 
        frame='icrs'
    )    
    ra_val = float(center_coord.ra.deg)
    ra_val_hour=ra_val *u.hour 
    dec_val = (center_coord.dec) 
    telescope_coord = SkyCoord(ra=ra_val_hour, dec=dec_val, frame='icrs')
    telescope_target = FixedTarget(name='Telescope', coord=telescope_coord)
    altaz_now = observer.altaz(current_time, telescope_target.coord)
    airmass_now = altaz_now.secz.value
    logger.info(f"questo è airmass calcolato da compute_airmass: {airmass_now}")
    
    return float(f"{airmass_now:.3f}")