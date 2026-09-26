import logging
import os
import shutil
import tempfile
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from astroquery.skyview import SkyView

_orig_get_images = SkyView.get_images
def _get_images_no_grid(*args, **kwargs):
    """astroplan 0.10.1 still passes grid= to SkyView.get_images(), which astroquery
    >= 0.4.8 no longer accepts. Drop this patch once astroplan > 0.10.1 is in use."""
    kwargs.pop('grid', None)
    return _orig_get_images(*args, **kwargs)
SkyView.get_images = _get_images_no_grid

from astropy.coordinates import EarthLocation, SkyCoord
from astropy.time import Time
import astropy.units as u
from astroplan import Observer, FixedTarget
from astroplan.plots import plot_finder_image
from astroplan.plots import plot_airmass
import matplotlib.patches as patches
from typing import Dict, Tuple

import warnings
from astropy.utils.exceptions import AstropyWarning

warnings.filterwarnings('ignore', category=UserWarning, module='matplotlib')
warnings.filterwarnings('ignore', message='.*TimeDelta.*', category=AstropyWarning)

logger = logging.getLogger(__name__)


def _telescope_coord(current_eq_coords: Dict[str, float]) -> SkyCoord:
    """Builds a SkyCoord from crac-server's eq_coords (ra in decimal hours, dec in decimal degrees)."""
    return SkyCoord(
        ra=current_eq_coords['ra'] * u.hourangle,
        dec=current_eq_coords['dec'] * u.deg,
        frame='icrs'
    )


def _write_atomically(save_path, write):
    """Writes through `write(tmp_path)` into a uniquely named temporary file, then
    renames it over save_path: a concurrent reader always gets a whole file."""
    fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(save_path), suffix=".png")
    os.close(fd)
    try:
        write(tmp_path)
        os.chmod(tmp_path, 0o644)
        os.replace(tmp_path, save_path)
    except BaseException:
        os.remove(tmp_path)
        raise


def _save_atomically(figure, save_path, **savefig_kwargs):
    _write_atomically(save_path, lambda tmp_path: figure.savefig(tmp_path, **savefig_kwargs))


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(PROJECT_ROOT, "crac_cloud", "static")
OUTPUT_DIR = os.path.join(STATIC_DIR, "maps")
MAP1_FILENAME = "fixed_field_map.png"
MAP2_FILENAME = "tracking_chart.png"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def generate_telescope_maps(
    geo_data: Dict[str, float],
    current_eq_coords: Dict[str, float],
    ccd_data: Dict[str, float]
) -> Tuple[str, str]:
    """Generates the fixed field map and the tracking chart for the current
    telescope position, and returns their paths. ccd_data holds the field
    of view in arcminutes; eq_coords as in _telescope_coord."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    map1_path = os.path.join(OUTPUT_DIR, MAP1_FILENAME)
    map2_path = os.path.join(OUTPUT_DIR, MAP2_FILENAME)

    location = EarthLocation(
        lat=geo_data['latitude'],
        lon=geo_data['longitude'],
        height=geo_data['elevation']
    )
    observer = Observer(location=location)
    current_time = Time.now()

    center_coord = _telescope_coord(current_eq_coords)
    logger.info(f"Center Coord: RA={center_coord.ra.deg}, DEC={center_coord.dec.deg}")
    field_width_deg = ccd_data['width']
    field_height_deg = ccd_data['height']
    logger.debug(f"Field of view: width={field_width_deg}, height={field_height_deg}")

    try:
        _generate_tracking_chart(observer, center_coord, current_time, map2_path)
    except Exception as e:
        logger.error(f" ❌ Error while generating the tracking chart: {e}")
    try:
        _generate_field_map(center_coord, map1_path, field_width_deg, field_height_deg)
    except Exception as e:
        logger.error(f" ❌ Error while generating the sky map: {e}")
        fallback = os.path.join(OUTPUT_DIR,  "backup_map.png")
        _write_atomically(map1_path, lambda tmp_path: shutil.copy(fallback, tmp_path))

    return map1_path, map2_path


def _generate_field_map(center_coord, save_path, field_width_deg, field_height_deg):
    """Draws the DSS finder image around the pointing with the camera's field of
    view as a red rectangle. fov_radius covers the whole field plus margin, so the
    WCS axes of the downloaded image match the area actually framed."""
    width = (field_width_deg+20) * u.arcmin
    height = (field_height_deg+20) * u.arcmin

    logger.info(f"Downloading DSS image for RA={center_coord.ra.deg}, DEC={center_coord.dec.deg}")
    logger.debug(f"Map size: {width} x {height}")
    target = FixedTarget(name='Telescope', coord=center_coord)

    rect_width_arcmin = field_width_deg * u.arcmin
    rect_height_arcmin = field_height_deg * u.arcmin
    download_width = width.to(u.deg)
    download_height = height.to(u.deg)
    fov_radius = max(width, height) / 2
    logger.debug(f"Downloaded image size in degrees: {download_width} x {download_height}")
    ax, hdu = plot_finder_image(target, fov_radius=fov_radius, survey="DSS")
    ax.coords[0].set_major_formatter('hh:mm')

    try:
        cdelt1 = abs(hdu.header['CDELT1']) * u.deg
        cdelt2 = abs(hdu.header['CDELT2']) * u.deg
    except KeyError:
        logger.error(" ❌ Error: FITS header has no CDELT1/CDELT2, cannot compute the FoV.")
        plt.close()
        return
    pix_scale_arcmin_x = cdelt1.to(u.arcmin).value
    pix_scale_arcmin_y = cdelt2.to(u.arcmin).value

    rect_width_pix = (rect_width_arcmin.to(u.arcmin).value / pix_scale_arcmin_x)
    rect_height_pix = (rect_height_arcmin.to(u.arcmin).value / pix_scale_arcmin_y)

    image_width = hdu.data.shape[1]
    image_height = hdu.data.shape[0]

    center_x = image_width / 2
    center_y = image_height / 2
    bottom_left_x = center_x - (rect_width_pix / 2)
    bottom_left_y = center_y - (rect_height_pix / 2)

    rect = patches.Rectangle((bottom_left_x, bottom_left_y), rect_width_pix, rect_height_pix,
                             linewidth=1.5, edgecolor='red', facecolor='none',
                             label=f"FoV ({field_width_deg}' x {field_height_deg}')")
    ax.add_patch(rect)
    ax.set_title("Campo inquadrato")
    ax.legend(loc='upper right', fontsize=8)

    finder_figure = plt.gcf()
    _save_atomically(finder_figure, save_path, bbox_inches="tight", dpi=200)
    plt.close(finder_figure)
    logger.info(f"Sky map saved to {save_path}")


def _generate_tracking_chart(observer, center_coord, current_time, save_path):
    """Draws the altitude/airmass curve of the pointing over ±12 hours, with the
    current time and position marked in red."""
    telescope_target = FixedTarget(name='Telescope', coord=center_coord)
    times = current_time + np.linspace(-12, 12, 100) * u.hour

    fig, ax = plt.subplots(1, 1, figsize=(5, 5))

    plot_airmass(
        telescope_target,
        observer,
        times,
        brightness_shading=True,
        altitude_yaxis=True,
        ax=ax,
        style_kwargs={'color': 'blue'}
    )
    altaz_now = observer.altaz(current_time, telescope_target.coord)
    alt_now = altaz_now.alt.to(u.deg).value

    time_for_plot = current_time.datetime

    ax.plot(
        time_for_plot,
        alt_now,
        marker='^',
        markersize=60,
        color='red',
        zorder=10
    )

    airmass_now = altaz_now.secz.value
    airmass_formatted = f"{airmass_now:.3f}"

    ax.axvline(
        time_for_plot,
        color='red',
        linestyle='-',
        linewidth=1.5,
        zorder=5,
        label=f'UTC: {time_for_plot.strftime("%d-%m-%Y %H:%M:%S")}'
    )

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
    _save_atomically(fig, save_path)
    plt.close(fig)

    logger.info(f"Airmass chart saved to {save_path}")
    logger.debug(f"Current airmass: {airmass_formatted}")

def compute_airmass(
        geo_data: Dict[str, float],
        current_eq_coords: Dict[str, float]
        ) -> float:
    """Computes only the current airmass, without drawing anything."""
    logger.debug("Computing the airmass")
    location = EarthLocation(
        lat=geo_data['latitude'],
        lon=geo_data['longitude'],
        height=geo_data['elevation']
    )
    logger.debug(f"Location: {location}")
    observer = Observer(location=location)
    logger.debug(f"Observer: {observer}")
    current_time = Time.now()

    center_coord = _telescope_coord(current_eq_coords)
    telescope_target = FixedTarget(name='Telescope', coord=center_coord)
    altaz_now = observer.altaz(current_time, telescope_target.coord)
    airmass_now = altaz_now.secz.value
    logger.debug(f"Computed airmass: {airmass_now}")

    return float(f"{airmass_now:.3f}")
