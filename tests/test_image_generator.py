from unittest.mock import patch


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
