import logging
import grpc
from crac_protobuf import chart_pb2
from crac_protobuf import chart_pb2_grpc
from .rpc import SLOW_READ_TIMEOUT

logger = logging.getLogger(__name__)
WEATHER_STATUS_TRANSLATIONS = {
    "WEATHER_STATUS_NORMAL": "CONDIZIONI METEO ADEGUATE",
    "WEATHER_STATUS_WARNING": "ATTENZIONE CONDIZIONI METEO POCO IDONEE",
    "WEATHER_STATUS_DANGER": "CONDIZIONI METEO AVVERSE",
    "WEATHER_STATUS_UNSPECIFIED": "SCONOSCIUTO"
}

class ChartClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = chart_pb2_grpc.WeatherStub(self.channel)

    def get_status(self):
        """Fetches the weather status and chart data."""
        request = chart_pb2.WeatherRequest()
        try:
            response = self.stub.GetStatus(request, timeout=SLOW_READ_TIMEOUT)

            charts_list = []
            for chart in response.charts:
                thresholds_list = []
                for threshold in chart.thresholds:                    
                    thresholds_list.append({
                        "threshold_type": chart_pb2.ThresholdType.Name(threshold.threshold_type),
                        "upper_bound": threshold.upper_bound,
                        "lower_bound": threshold.lower_bound
                    })
                chart_data = {
                    "value": chart.value,
                    "title": chart.title,
                    "min": chart.min,
                    "max": chart.max,
                    "urn": chart.urn,
                    "unit_of_measurement": chart.unit_of_measurement,
                    "status": chart_pb2.ChartStatus.Name(chart.status),
                    "lower_bound": chart.min,
                    "upper_bound": chart.max,
                    "thresholds": thresholds_list,
                    "warning": None,
                    "error": None
                }
                for threshold in chart.thresholds:
                    threshold_type_name = chart_pb2.ThresholdType.Name(threshold.threshold_type)
                    if threshold_type_name == "THRESHOLD_TYPE_WARNING":
                        if chart_data["warning"] is None:
                            chart_data["warning"] = threshold.lower_bound
                    elif threshold_type_name == "THRESHOLD_TYPE_NORMAL" and "barometer" in chart.urn:
                        if chart_data["error"] is None:
                            chart_data["error"] = threshold.lower_bound
                    elif threshold_type_name == "THRESHOLD_TYPE_DANGER":
                        if chart_data["error"] is None:
                            chart_data["error"] = threshold.lower_bound

                charts_list.append(chart_data)

            weather_status_name = chart_pb2.WeatherStatus.Name(response.status)
            translated_status = WEATHER_STATUS_TRANSLATIONS.get(weather_status_name, weather_status_name)

            emergency_closure_data = None
            if hasattr(response, 'emergency_closure'):
                ec = response.emergency_closure
                if ec.status != 0:
                    emergency_closure_data = {
                        "status": ec.status,
                        "triggers": list(ec.triggers),
                        "block_reason": ec.block_reason,
                        "status_since": ec.status_since,
                    }

            result = {
                "updated_at": response.updated_at,
                "charts": charts_list,
                "status": translated_status,
                "interval": response.interval,
            }
            if emergency_closure_data is not None:
                result["emergency_closure"] = emergency_closure_data

            return result
        except grpc.RpcError as e:
            logger.error(f" ❌ RPC error (ChartStatus): {e.details()}")
            return {"error": str(e.details()), "status": "SCONOSCIUTO"}