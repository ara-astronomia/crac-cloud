from unittest.mock import patch
from crac_cloud.grpc_cloud.channel_health import ChannelHealth, CHANNEL_DOWN_MESSAGE, down_error, error_status


class TestChannelHealth:
    def test_starts_not_down(self):
        assert ChannelHealth().is_down() is False

    def test_a_recorded_failure_marks_it_down(self):
        health = ChannelHealth()
        health.record_failure()
        assert health.is_down() is True

    def test_a_recorded_success_clears_it(self):
        health = ChannelHealth()
        health.record_failure()
        health.record_success()
        assert health.is_down() is False

    def test_retries_again_after_the_cooldown(self):
        """A permanent block would hide crac-server coming back up: after
        the cooldown, the next call must be able to genuinely retry."""
        health = ChannelHealth()
        health.record_failure()

        with patch("crac_cloud.grpc_cloud.channel_health.time.monotonic", return_value=health._down_since + ChannelHealth.COOLDOWN_SECONDS + 0.1):
            assert health.is_down() is False


class TestDownError:
    def test_returns_the_shared_message(self):
        assert down_error() == {"error": CHANNEL_DOWN_MESSAGE}


class TestErrorStatus:
    def test_builds_the_button_error_shape(self):
        assert error_status("boom") == {
            "status": "ERROR",
            "gui": {
                "label": "LABEL_ERROR",
                "is_disabled": True,
                "button_color": {"text_color": "white", "background_color": "red"},
            },
            "error": "boom",
        }
