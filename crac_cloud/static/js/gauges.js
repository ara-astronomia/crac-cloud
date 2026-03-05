// =============================================================================
// gauges.js - Gauge D3.js per i dati meteo
// Dipende da D3 caricato globalmente nell'HTML.
// =============================================================================

import { weatherApi } from './api.js';

const KEY_MAPPING = {
    'weather.chart.temperature': 'temperature',
    'weather.chart.humidity':    'humidity',
    'weather.chart.wind':        'wind_speed',
    'weather.chart.wind_gust':   'wind_gust_speed',
    'weather.chart.rain_rate':   'rain_rate',
    'weather.chart.barometer':   'barometer',
};

const GAUGE_META = {
    temperature:    { label: 'Temperatura', unit: '°C' },
    humidity:       { label: 'Umidità',     unit: '%' },
    wind_speed:     { label: 'Vento',       unit: 'km/h' },
    wind_gust_speed:{ label: 'Raffiche',    unit: 'km/h' },
    rain_rate:      { label: 'Pioggia',     unit: 'mm/h' },
    barometer:      { label: 'Pressione',   unit: 'hPa' },
};

// Registro interno dei gauge creati
const gaugeRegistry = {};

// =============================================================================
// INIT — carica la configurazione dal server e crea i gauge
// =============================================================================
export async function initGauges() {
    if (typeof d3 === 'undefined') {
        console.error('[Gauges] D3.js non disponibile.');
        return;
    }

    const configs = await weatherApi.getGaugeConfig();
    if (!configs || Object.keys(configs).length === 0) {
        console.warn('[Gauges] Configurazione gauge non disponibile (server offline?)');
        return;
    }

    for (const urn in configs) {
        const cleanKey = KEY_MAPPING[urn];
        if (!cleanKey || cleanKey === 'barometer_trend') continue;

        const meta   = GAUGE_META[cleanKey] || { label: cleanKey, unit: '' };
        const config = configs[urn];
        const gauge  = _createGauge(cleanKey, config, meta);
        if (gauge) gaugeRegistry[`gauge-${cleanKey}`] = gauge;
    }

    console.log(`[Gauges] Inizializzati ${Object.keys(gaugeRegistry).length} gauge.`);
}

// =============================================================================
// UPDATE — chiamato dal coordinator con i dati freschi del server
// =============================================================================
export function updateGaugesUI(data) {
    if (!data || !data.charts) return;

    // Aggiorna label stato meteo generale
    const condEl = document.getElementById('cond_meteo');
    if (condEl && data.status) condEl.textContent = _translateWeatherStatus(data.status);

    data.charts.forEach(chart => {
        const cleanKey = KEY_MAPPING[chart.urn];
        if (!cleanKey) return;

        const gaugeId = `gauge-${cleanKey}`;
        const gauge   = gaugeRegistry[gaugeId];
        if (gauge) {
            gauge.value = chart.value;
            gauge.update();
        }
    });
}

function _translateWeatherStatus(status) {
    const map = {
        'WEATHER_STATUS_NORMAL':      'Condizioni Meteo Adeguate',
        'WEATHER_STATUS_WARNING':     'Attenzione: Condizioni Meteo in Peggioramento',
        'WEATHER_STATUS_DANGER':      'PERICOLO: Condizioni Meteo Critiche',
        'WEATHER_STATUS_UNSPECIFIED': 'Condizioni Meteo Non Conosciute',
    };
    return map[status] || status;
}

// =============================================================================
// CREAZIONE GAUGE D3 (logica invariata rispetto all'originale)
// =============================================================================
function _createGauge(key, config, meta) {
    const id        = `gauge-${key}`;
    const container = d3.select(`#${id}`);
    if (container.empty()) {
        console.warn(`[Gauges] Container #${id} non trovato.`);
        return null;
    }

    const lower_bound = config.lower_bound ?? config.min ?? 0;
    const upper_bound = config.upper_bound ?? config.max ?? 100;
    const warning     = config.warning ?? null;
    const error       = config.error   ?? null;

    const width = 200, height = 250, radius = 80;
    const min = lower_bound, max = upper_bound;
    let value = config.value ?? min;

    container.selectAll('*').remove();

    const svg = container
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2 - 20})`);

    svg.append('circle')
        .attr('r', radius + 7)
        .attr('fill', '#272727')
        .attr('stroke', '#1b160e')
        .attr('stroke-width', 8);

    const startAngle = -Math.PI * 0.75 - 90 * (Math.PI / 180);
    const endAngle   =  Math.PI * 0.75 - 90 * (Math.PI / 180);
    const angleRange = endAngle - startAngle;

    const scaleToAngle   = val => startAngle + ((val - min) / (max - min)) * angleRange;
    const valueToRotation= val => (scaleToAngle(Math.max(min, Math.min(max, val))) * 180 / Math.PI) + 90;

    // Settori
    const isInverted = (config.urn || '').includes('barometer');
    let sectors = [];
    if (warning != null && error != null && warning < error) {
        sectors = isInverted
            ? [{ from: lower_bound, to: warning, color: '#ca2c2c' }, { from: warning, to: error, color: '#c19d50' }, { from: error, to: upper_bound, color: 'white' }]
            : [{ from: lower_bound, to: warning, color: 'white' },   { from: warning, to: error, color: '#c19d50' }, { from: error, to: upper_bound, color: '#ca2c2c' }];
    } else if (warning != null) {
        sectors = [{ from: lower_bound, to: warning, color: 'white' }, { from: warning, to: upper_bound, color: '#c19d50' }];
    } else {
        sectors = [{ from: lower_bound, to: upper_bound, color: 'white' }];
    }

    sectors.forEach(s => {
        const arcFunc = d3.arc()
            .innerRadius(radius - 30).outerRadius(radius)
            .startAngle(scaleToAngle(s.from) + 90 * (Math.PI / 180))
            .endAngle(scaleToAngle(s.to)   + 90 * (Math.PI / 180));
        svg.append('path').attr('d', arcFunc()).attr('fill', s.color);
    });

    // Tacche
    const stepMain  = Math.round((max - min) / 5);
    const stepMinor = stepMain / 10;
    d3.range(min, max + stepMinor, stepMinor).forEach(val => {
        const angle  = scaleToAngle(val);
        const isMain = (val - min) % stepMain === 0;
        const len    = isMain ? 8 : 2;
        svg.append('line')
            .attr('x1', Math.cos(angle) * radius).attr('y1', Math.sin(angle) * radius)
            .attr('x2', Math.cos(angle) * (radius - len)).attr('y2', Math.sin(angle) * (radius - len))
            .attr('stroke', '#333').attr('stroke-width', 2);
        if (isMain) {
            svg.append('text')
                .attr('x', Math.cos(angle) * (radius - 18)).attr('y', Math.sin(angle) * (radius - 18))
                .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
                .attr('font-size', '12px').attr('fill', 'black')
                .text(val.toFixed(0));
        }
    });

    // Lancetta
    const needleGroup = svg.append('g').attr('transform', `rotate(${valueToRotation(value)})`);
    const needlePath  = d3.path();
    needlePath.moveTo(0, -radius + 20); needlePath.lineTo(-6, 10); needlePath.lineTo(6, 10); needlePath.closePath();
    needleGroup.append('path').attr('d', needlePath.toString()).attr('fill', 'white').attr('stroke', '#822525').attr('stroke-width', 1);
    svg.append('circle').attr('r', 7).attr('fill', '#1b160e').attr('stroke', '#822525').attr('stroke-width', 1);

    // Label e valore
    svg.append('text').attr('text-anchor', 'middle').attr('y', 33).attr('font-size', '12px').attr('fill', 'white').text(meta.label);
    svg.append('rect').attr('x', -36).attr('y', radius - 32).attr('width', 74).attr('height', 22).attr('fill', '#d3dcd2').attr('stroke', '#333').attr('stroke-width', 3);

    const valueText = svg.append('text')
        .attr('x', 0).attr('y', radius - 34 + 17)
        .attr('text-anchor', 'middle').attr('font-size', '14px').attr('font-weight', 'bold')
        .text(`${parseFloat(value).toFixed(1)} ${meta.unit}`);

    const update = () => {
        needleGroup.transition().duration(500).attr('transform', `rotate(${valueToRotation(value)})`);
        valueText.text(`${parseFloat(value).toFixed(1)} ${meta.unit}`);
    };

    return {
        get value() { return value; },
        set value(v) { value = v; },
        update,
    };
}
