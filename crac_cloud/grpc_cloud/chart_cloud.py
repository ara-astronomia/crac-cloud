# grpc_cloud/chart_cloud.py
import grpc
from crac_protobuf import chart_pb2
from crac_protobuf import chart_pb2_grpc

# Dizionario di traduzione per gli stati meteo (Enum di Protobuf)
WEATHER_STATUS_TRANSLATIONS = {
    "WEATHER_STATUS_NORMAL": "CONDIZIONI METEO ADEGUATE",
    "WEATHER_STATUS_WARNING": "ATTENZIONE CONDIZIONI METEO POCO IDONEE",
    "WEATHER_STATUS_ERROR": "CONDIZIONI METEO AVVERSE",
    "UNKNOWN": "SCONOSCIUTO"
}

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
                    # print (thresholds_list )
                # Estrae le soglie di WARNING e ERROR per i gauge
                
                # Inizializza min/max/warning/error con i valori di base
                chart_data = {
                    "value": chart.value,
                    "title": chart.title,
                    "min": chart.min,
                    "max": chart.max,
                    "urn": chart.urn,
                    "unit_of_measurement": chart.unit_of_measurement,
                    "status": chart_pb2.ChartStatus.Name(chart.status),
                    # Aggiunge i campi per i gauge (inclusi per la rotta /gauge-config)
                    "lower_bound": chart.min,
                    "upper_bound": chart.max,
                    "thresholds": thresholds_list,
                    "warning": None, # Inizializzato a None
                    "error": None    # Inizializzato a None
                }
                                # Trova e assegna i valori di Warning/Error dalle soglie
                for threshold in chart.thresholds:
                    threshold_type_name = chart_pb2.ThresholdType.Name(threshold.threshold_type)
                    if threshold_type_name in ["THRESHOLD_TYPE_WARNING", "WARNING"]:                        
                        # ✅ Assegna il limite INFERIORE del range WARNING
                        if chart_data["warning"] is None:
                            chart_data["warning"] = threshold.lower_bound
                    elif threshold_type_name in ["THRESHOLD_TYPE_NORMAL", "NORMAL"] and "barometer" in chart.urn:
                        if chart_data["error"] is None:
                            chart_data["error"] = threshold.lower_bound # Assegna 1005.0
                    elif threshold_type_name in ["THRESHOLD_TYPE_ERROR", "ERROR", "THRESHOLD_TYPE_DANGER"]:
                        # ✅ Assegna il limite INFERIORE del range DANGER/ERROR
                        if chart_data["error"] is None:
                            chart_data["error"] = threshold.lower_bound
                                    
                charts_list.append(chart_data)
                #print(charts_list)

            # Traduce lo stato meteo da ENUM in Italiano
            weather_status_name = chart_pb2.WeatherStatus.Name(response.status)
            translated_status = WEATHER_STATUS_TRANSLATIONS.get(weather_status_name, weather_status_name)

            return {
                "updated_at": response.updated_at,
                "charts": charts_list,
                "status": translated_status, # ✅ STATO TRADOTTO
                "interval": response.interval
            }
        except grpc.RpcError as e:
            # Gestione errore gRPC, fondamentale per il debug
            print(f"❌ Errore RPC (ChartStatus): {e.details()}")
            return {"error": str(e.details()), "status": "SCONOSCIUTO"}