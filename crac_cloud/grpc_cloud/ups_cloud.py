# grpc_cloud/ups_cloud.py
import logging
import grpc
from crac_protobuf import ups_pb2
from crac_protobuf import ups_pb2_grpc
from crac_protobuf import chart_pb2

logger = logging.getLogger(__name__)

class UpsClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = ups_pb2_grpc.UpsStub(self.channel)

    def get_status(self):
        """Ottiene lo stato degli UPS e i dati per i grafici."""
        request = ups_pb2.UpsRequest()
        try:
            response = self.stub.GetStatus(request)
            charts_list = []
            for chart in response.charts:
                # Parsing della chart
                chart_data = {
                    "value": chart.chart.value,
                    "title": chart.chart.title,
                    "min": chart.chart.min,
                    "max": chart.chart.max,
                    "urn": chart.chart.urn,
                    "unit_of_measurement": chart.chart.unit_of_measurement,
                    "status": chart_pb2.ChartStatus.Name(chart.chart.status),
                }

                # Parsing degli stati della batteria
                battery_statuses_list = [
                    ups_pb2.BatteryStatus.Name(status) for status in chart.battery_statuses
                ]
                logger.debug(f"DEBUG: Questo è lo status_list delle batterie:{battery_statuses_list}")
                charts_list.append({
                    "chart": chart_data,
                    "battery_statuses": battery_statuses_list
                })

            return {
                "updated_at": response.updated_at,
                "charts": charts_list,
                "status": ups_pb2.UpsStatus.Name(response.status),
                "interval": response.interval,
                "devices": list(response.devices)
            }
        except grpc.RpcError as e:
            logger.error(f"❌ Errore gRPC: Il servizio UPS non ha risposto. Dettagli: {e.details()}")
            return {"error": str(e.details())}