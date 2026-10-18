from unittest.mock import MagicMock, patch
from crac_protobuf import chart_pb2
from crac_cloud.grpc_cloud.chart_cloud import ChartClient, WEATHER_STATUS_TRANSLATIONS
from crac_cloud.grpc_cloud.rpc import SLOW_READ_TIMEOUT


def _client_returning(response):
    client = ChartClient(host="localhost", port=50051)
    with patch.object(client.stub, "GetStatus", return_value=response):
        return client.get_status()


def _chart(urn, *thresholds):
    return chart_pb2.Chart(
        value=1.0,
        title="Chart",
        urn=urn,
        thresholds=thresholds,
    )


def test_get_status_uses_the_slow_read_timeout():
    client = ChartClient(host="localhost", port=50051)
    captured = {}

    def fake_get_status(request, **kwargs):
        captured.update(kwargs)
        return MagicMock(charts=[], status=0)

    with patch.object(client.stub, "GetStatus", side_effect=fake_get_status):
        client.get_status()

    assert captured["timeout"] == SLOW_READ_TIMEOUT


def test_warning_threshold_sets_the_warning_band():
    threshold = chart_pb2.Threshold(
        threshold_type=chart_pb2.THRESHOLD_TYPE_WARNING,
        lower_bound=22.5,
    )
    response = chart_pb2.WeatherResponse(
        charts=[_chart("temperature", threshold)],
        status=chart_pb2.WEATHER_STATUS_NORMAL,
    )

    result = _client_returning(response)

    chart = result["charts"][0]
    assert chart["warning"] == 22.5
    assert chart["error"] is None


def test_danger_threshold_sets_the_error_band():
    threshold = chart_pb2.Threshold(
        threshold_type=chart_pb2.THRESHOLD_TYPE_DANGER,
        lower_bound=30.0,
    )
    response = chart_pb2.WeatherResponse(
        charts=[_chart("temperature", threshold)],
        status=chart_pb2.WEATHER_STATUS_NORMAL,
    )

    result = _client_returning(response)

    chart = result["charts"][0]
    assert chart["warning"] is None
    assert chart["error"] == 30.0


def test_barometer_normal_threshold_sets_the_error_band():
    threshold = chart_pb2.Threshold(
        threshold_type=chart_pb2.THRESHOLD_TYPE_NORMAL,
        lower_bound=1013.0,
    )
    response = chart_pb2.WeatherResponse(
        charts=[_chart("climate-barometer", threshold)],
        status=chart_pb2.WEATHER_STATUS_NORMAL,
    )

    result = _client_returning(response)

    chart = result["charts"][0]
    assert chart["error"] == 1013.0


def test_normal_threshold_outside_the_barometer_sets_no_band():
    threshold = chart_pb2.Threshold(
        threshold_type=chart_pb2.THRESHOLD_TYPE_NORMAL,
        lower_bound=15.0,
    )
    response = chart_pb2.WeatherResponse(
        charts=[_chart("temperature", threshold)],
        status=chart_pb2.WEATHER_STATUS_NORMAL,
    )

    result = _client_returning(response)

    chart = result["charts"][0]
    assert chart["warning"] is None
    assert chart["error"] is None


def test_danger_weather_status_is_translated():
    response = chart_pb2.WeatherResponse(
        charts=[],
        status=chart_pb2.WEATHER_STATUS_DANGER,
    )

    result = _client_returning(response)

    assert result["status"] == "CONDIZIONI METEO AVVERSE"


def test_unspecified_weather_status_is_translated():
    response = chart_pb2.WeatherResponse(
        charts=[],
        status=chart_pb2.WEATHER_STATUS_UNSPECIFIED,
    )

    result = _client_returning(response)

    assert result["status"] == "SCONOSCIUTO"


def test_weather_status_translations_cover_only_real_enum_names():
    assert set(WEATHER_STATUS_TRANSLATIONS) == set(chart_pb2.WeatherStatus.keys())
