# grpc_cloud/chart_cloud.py
import grpc
from crac_protobuf import chart_pb2
from crac_protobuf import chart_pb2_grpc

class ChartClient:
    def __init__(self, host: str, port: int):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = chart_pb2_grpc.WeatherStub(self.channel)

    def get_status(self):
        """Ottiene lo stato meteorologico e i dati per i grafici."""
        request = chart_pb2.WeatherRequest()
        try:
            response = self.stub.GetStatus(request)
            
            charts_list = []
            for chart in response.charts:
                thresholds_list = []
                for threshold in chart.thresholds:
                    thresholds_list.append({
                        "threshold_type": chart_pb2.ThresholdType.Name(threshold.threshold_type),
                        "upper_bound": threshold.upper_bound,
                        "lower_bound": threshold.lower_bound
                    })
                
                charts_list.append({
                    "value": chart.value,
                    "title": chart.title,
                    "min": chart.min,
                    "max": chart.max,
                    "urn": chart.urn,
                    "thresholds": thresholds_list,
                    "unit_of_measurement": chart.unit_of_measurement,
                    "status": chart_pb2.ChartStatus.Name(chart.status)
                })

            return {
                "updated_at": response.updated_at,
                "charts": charts_list,
                "status": chart_pb2.WeatherStatus.Name(response.status),
                "interval": response.interval
            }
        except grpc.RpcError as e:
            return {"error": str(e.details())}