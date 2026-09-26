from unittest.mock import patch
from crac_cloud.grpc_cloud.channel_health import ChannelHealth


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
        """Un blocco permanente nasconderebbe crac-server tornato su: dopo
        il cooldown la chiamata successiva deve poter riprovare davvero."""
        health = ChannelHealth()
        health.record_failure()

        with patch("crac_cloud.grpc_cloud.channel_health.time.monotonic", return_value=health._down_since + ChannelHealth.COOLDOWN_SECONDS + 0.1):
            assert health.is_down() is False
