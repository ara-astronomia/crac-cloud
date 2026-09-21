from unittest.mock import patch, MagicMock

import numpy as np
import pytest

import crac_cloud.image_generator as ig


def test_generate_telescope_maps_passes_server_coordinates_untouched(tmp_path, monkeypatch):
    """generate_telescope_maps (the function that receives current_eq_coords from
    crac-server) must build the finder-image target from those exact RA/DEC values,
    with no extra conversion in between."""
    monkeypatch.setattr(ig, 'OUTPUT_DIR', str(tmp_path))
    monkeypatch.setattr(ig, '_generate_tracking_chart', lambda *a, **k: None)

    fake_hdu = MagicMock()
    fake_hdu.header = {'CDELT1': -0.001, 'CDELT2': 0.001}
    fake_hdu.data = np.zeros((100, 100))

    geo_data = {'latitude': 45.0, 'longitude': 11.0, 'elevation': 100}
    current_eq_coords = {'ra': 10.5, 'dec': 45.0}
    ccd_data = {'width': 10, 'height': 10}

    with patch.object(ig, 'plot_finder_image', return_value=(MagicMock(), fake_hdu)) as mock_plot:
        ig.generate_telescope_maps(geo_data, current_eq_coords, ccd_data)

    target = mock_plot.call_args.args[0]
    assert target.coord.ra.deg == pytest.approx(157.5)
    assert target.coord.dec.deg == pytest.approx(45.0)


def test_monkey_patch_strips_grid_before_calling_original():
    """After import, SkyView.get_images must not forward the grid kwarg (astropy/astroplan#588)."""
    import crac_cloud.image_generator as ig  # ensures patch is applied
    from astroquery.skyview import SkyView

    received_kwargs = {}

    def capturing_original(*args, **kwargs):
        received_kwargs.update(kwargs)
        return []

    with patch.object(ig, "_orig_get_images", side_effect=capturing_original):
        SkyView.get_images(position="test", survey="DSS", grid=True, radius=1)

    assert "grid" not in received_kwargs
    assert received_kwargs.get("survey") == "DSS"
