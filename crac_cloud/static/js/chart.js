//import { sendBuffer } from './ws.js';
//import * as proto from './proto/proto_bundle_pb.js';

export function handleChartMessage(buffer) {
    const status = ChartStatus.deserializeBinary(buffer);

    // Recupera i valori dal messaggio Protobuf
    const temp = status.getTemperature();     // °C
    const humidity = status.getHumidity();    // %
    const wind = status.getWind();            // km/h
    const gust = status.getGust();            // km/h
    const pressure = status.getPressure();    // hPa
    const rain =  status.getRain();            // mm/h

    // Aggiorna i gauge
    updateGauge("gauge-temperature", temp);
    updateGauge("gauge-humidity", humidity);
    updateGauge("gauge-wind_speed", wind);
    updateGauge("gauge-wind_gust_speed", gust);
    updateGauge("gauge-barometer", pressure);
    updateGauge("gauge-rain_rate", rain);
    }

    export function testUpdateGauges() {
    updateGauge("gauge-temperature", 22);
    updateGauge("gauge-humidity", 75);
    updateGauge("gauge-wind_speed", 8);
    updateGauge("gauge-wind_gust_speed", 12);
    updateGauge("gauge-barometer", 1015);
    updateGauge("gauge-rain_rate", 1.2);
}
// Funzione generica per aggiornare il valore di un gauge
function updateGauge(gaugeId, value) {
    const gauge = window.gauges?.[gaugeId];
    if (gauge) {
        gauge.value = value;
        gauge.update();
    }
}