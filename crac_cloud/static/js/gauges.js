// Questo script disegna i gauge SVG usando la libreria D3.js.
// Si affida al caricamento globale di D3.js nell'HTML.

// Dizionario di mapping URN del backend -> Chiave pulita (come usata in gaugeMeta e HTML ID)
// Assicurati che questi URN corrispondano esattamente a ciò che ricevi dal backend.
const keyMapping = {
  // QUESTE CHIAVI DEVONO ESSERE CORRETTE UNA VOLTA CHE CONOSCI L'OUTPUT REALE DEL BACKEND
  "weather.chart.temperature": "temperature",
  "weather.chart.humidity": "humidity",
  "weather.chart.wind": "wind_speed",         
  "weather.chart.wind_gust": "wind_gust_speed", 
  "weather.chart.rain_rate": "rain_rate",
  "weather.chart.barometer": "barometer",
  "weather.chart.barometer_trend": "barometer_trend"
  // Aggiungi altre mappature se necessario
};

// Dizionario: label e unità di misura per ogni gauge
const gaugeMeta = {
  temperature: { label: "Temperatura", unit: "°C" },
  humidity: { label: "Umidità", unit: "%" },
  wind_speed: { label: "Vento", unit: "km/h" },
  wind_gust_speed: { label: "Raffiche", unit: "km/h" },
  rain_rate: { label: "Pioggia", unit: "mm/h" },
  barometer: { label: "Pressione", unit: "hPa" },
  barometer_trend: { label: "Tendenza Pressione", unit: "hPa/h" }
};

// Chiama l'API e crea i gauge
console.log("Inizio caricamento configurazione gauge da /charts/gauge-config...");

// ✅ Uso del percorso /charts/gauge-config
fetch("/charts/gauge-config") 
  .then(res => {
    if (!res.ok) {
        // Se la risposta non è OK (es. 404), genera un errore visibile
        throw new Error(`HTTP error! status: ${res.status}. URL errato o server non raggiungibile.`);
    }
    // console.log("Caricamento configurazione gauge riuscito. Tentativo di disegno.");
    return res.json();
  })
  .then(configs => {
    if (!window.gauges) window.gauges = {};

    // ⚠️ Controlla qui se d3 è disponibile PRIMA di chiamare createGauge
    if (typeof d3 === 'undefined') {
        console.error("❌ Errore: la libreria D3.js non è definita. Caricamento D3 fallito.");
        return;
    }

    // 🎯 LOG DI DEBUG: Stampa tutti gli URN ricevuti dal backend
    console.log("✅ URN Ricevuti dal Backend:", Object.keys(configs)); 

    for (const key in configs) {
      // 1. Mappa la chiave URN del backend (es. weather.chart.wind) alla chiave pulita (es. wind_speed)
      const cleanKey = keyMapping[key] || key; 
      
      // Se la chiave pulita è uguale alla chiave originale, significa che la mappatura è fallita, 
      // e tenteremo di usare l'URN completo come ID (fallendo).
      if (cleanKey === key) {
          console.warn(`⚠️ Mappatura non trovata per URN: ${key}. Tentativo di usare URN come ID.`);
      }

      // La tendenza barometro non è un gauge D3, è solo testo gestito in script.js
      if (cleanKey === 'barometer_trend') {
          continue; 
      }
      
      const config = configs[key];
      const meta = gaugeMeta[cleanKey] || { label: cleanKey, unit: "" }; 
      
      // Passa la chiave pulita alla funzione createGauge
      const gauge = createGauge(cleanKey, config, meta); 
      // console.log(`Gauge creato per ${cleanKey} (da URN: ${key}):`, gauge);

      if (gauge) {
        // Memorizza l'oggetto gauge per l'aggiornamento in script.js
        window.gauges[`gauge-${cleanKey}`] = gauge; 
      }
    }
  })
  .catch(err => console.error("❌ Errore caricamento gauge config:", err));


// Crea un gauge D3.js e restituisce un oggetto { value, update() }
function createGauge(key, config, meta) {
  // Configurazione con fallback (per evitare NaN o undefined)
  const lower_bound = config.lower_bound || config.min;
  //console.log("Lower Bound:", lower_bound);
  const upper_bound = config.upper_bound || config.max ;
  //console.log("Upper Bound:", upper_bound);

  // Fallback per warning e error: se assenti, usiamo il range intero.
  const warning = config.warning ;
  //console.log("Warning Threshold:", warning);
  const error = config.error;
  //console.log("Error Threshold:", error);

  // L'ID è ora costruito con la chiave pulita (es. "gauge-wind_speed")
  const id = `gauge-${key}`; 
  
  // Aggiungiamo la logica di escape solo se la chiave contiene ancora punti (nonostante il mapping fallito)
  const escapedId = id.includes('.') ? id.replace(/\./g, '\\.') : id;

  //console.log(`Creazione gauge per: ${key} con ID HTML atteso: #${id}`);
  
  const width = 200, height = 250, radius = 80;
  const min = lower_bound, max = upper_bound;
  let value = config.value || min; // Usa il valore iniziale da config

  // ✅ UTILIZZO CORRETTO DI d3.select con ID pulito (o escapato se fallisce)
  const container = d3.select(`#${escapedId}`); 
  // console.log(`Selezionato container per #${escapedId}:`, container.empty() ? "Non trovato" : "Trovato");

  if (container.empty()) {
      // Il messaggio di avviso ora è più preciso
      console.warn(`Container HTML #${id} non trovato nel DOM. Il backend ha inviato un URN (${key}) non mappato correttamente o l'ID HTML non corrisponde.`);
      return null;
  }

  // Pulisci l'SVG esistente prima di disegnare
  container.selectAll("*").remove();

  const svg = container
    .attr("viewBox", `0 0 ${width} ${height}`)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2 - 20})`);

  // Sfondo circolare scuro
  svg.append("circle")
    .attr("r", radius + 7)
    .attr("fill", "#272727")
    .attr("stroke", "#1b160e")
    .attr("stroke-width", 8);


  // parametri per l'impostazione dell'inzio e della fine dell'angolo della scala graduata forzando lo standard a -135°/+135°
  const startAngle = -Math.PI * 0.75 -90 * (Math.PI / 180); // Inizio a -135 gradi
  const endAngle = Math.PI * 0.75 -90 * (Math.PI / 180);
  const angleRange = endAngle - startAngle;
  //console.log("Angle Range (radians):", angleRange);

  // Mappa il valore all'angolo
  const scaleToAngle = val => startAngle + ((val - min) / (max - min)) * angleRange; 
  // Mappa il valore alla rotazione della lancetta (aggiungendo 90 gradi per l'allineamento)
  const valueToRotation = val => (scaleToAngle(Math.max(min, Math.min(max, val))) * 180 / Math.PI) +90; 

  // Settori colorati
  let sectors = [];
  
  // Identifica se si tratta di un Barometro o se la scala di rischio è invertita (W < E)
  const isBarometerInverted = config.urn.includes("barometer");

  // --- LOGICA DI CREAZIONE SETTORI ---

  // 1. Scenario Completo (tutti i limiti presenti e validi)
  if (warning != null && error != null && warning < error) {
    
    // Per il Barometro, invertiamo i colori: Rosso è il primo settore, Bianco l'ultimo
    if (isBarometerInverted) {
      sectors.push({ from: lower_bound, to: warning, color: "#ca2c2c" });    // Rosso: 980 -> 990 (Danger)
      sectors.push({ from: warning, to: error, color: "#c19d50" });          // Giallo: 990 -> 1005 (Warning)
      sectors.push({ from: error, to: upper_bound, color: "white" });        // Bianco: 1005 -> 1045 (Normal)
    } 
    // Per tutti gli altri gauge (standard)
    else {
      sectors.push({ from: lower_bound, to: warning, color: "white" });      // Bianco
      sectors.push({ from: warning, to: error, color: "#c19d50" });          // Giallo
      sectors.push({ from: error, to: upper_bound, color: "#ca2c2c" });      // Rosso
    }
  } 
  
  // 2. Scenario Solo Warning (es. Temperatura)
  else if (warning != null && error == null) {
    // Il resto del range è Warning (giallo) o, se invertito, dipende dal caso (usiamo giallo per default)
    sectors.push({ from: lower_bound, to: warning, color: "white" });
    sectors.push({ from: warning, to: upper_bound, color: "#c19d50" }); 
  }
  
  // 3. Scenario Fallback (Nessun limite valido)
  else {
    sectors.push({ from: lower_bound, to: upper_bound, color: "white" });
  }
  //console.log("Settori:", sectors);

  sectors.forEach(s => {
    // ✅ UTILIZZO CORRETTO DI d3.arc
    //parametri per disegnare gli archi colorati
    const arcFunc = d3.arc()
      .innerRadius(radius -30)
      .outerRadius(radius)
      .startAngle(scaleToAngle(s.from)+90 * (Math.PI / 180)) // Aggiungi 90 gradi in radianti
      .endAngle(scaleToAngle(s.to)+90 * (Math.PI / 180));

    svg.append("path")
      .attr("d", arcFunc())
      .attr("fill", s.color);
  });

  // Tacche
  const stepMain = Math.round((max - min) / 5);
  const stepMinor = stepMain / 10;

  // ✅ UTILIZZO CORRETTO DI d3.range
  // console.log(min, max)
  // console.log(stepMinor)
  const tickValues = d3.range(min, max + stepMinor, stepMinor);

  tickValues.forEach(val => {
    const angle = scaleToAngle(val);
    const isMain = (val - min) % stepMain === 0;
    const length = isMain ? 8 : 2;

    const x1 = Math.cos(angle) * radius;
    const y1 = Math.sin(angle) * radius;
    const x2 = Math.cos(angle) * (radius - length);
    const y2 = Math.sin(angle) * (radius - length);

    svg.append("line")
      .attr("x1", x1).attr("y1", y1)
      .attr("x2", x2).attr("y2", y2)
      .attr("stroke", "#333").attr("stroke-width", 2);

    if (isMain) {
      const labelRadius = radius - 18;
      svg.append("text")
        .attr("x", Math.cos(angle) * labelRadius)
        .attr("y", Math.sin(angle) * labelRadius)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "12px")
        .attr("fill", "black")
        .text(val.toFixed(0));
    }
  });

  // Lancetta
  const needleAngle = valueToRotation(value);
  const needleGroup = svg.append("g").attr("transform", `rotate(${needleAngle})`);
  //console.log("Rotazione iniziale lancetta:", needleAngle);

  // ✅ UTILIZZO CORRETTO DI d3.path
  const needlePath = d3.path();
  needlePath.moveTo(0, -radius + 20);
  needlePath.lineTo(-6, 10);
  needlePath.lineTo(6, 10);
  needlePath.closePath();

  needleGroup.append("path")
    .attr("d", needlePath.toString())
    .attr("fill", "white")
    .attr("stroke", "#822525").attr("stroke-width", 1);

  // Cerchio centrale
  svg.append("circle")
    .attr("r", 7)
    .attr("fill", "#1b160e")
    .attr("stroke", "#822525").attr("stroke-width", 1);

  // Testo Etichetta (Temperatura, Umidità, etc.)
  svg.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 33)
    .attr("font-size", "12px")
    .attr("fill", "white")
    .text(meta.label);

  // Box per il valore numerico
  svg.append("rect")
    .attr("x", -36).attr("y", radius - 32)
    .attr("width", 74).attr("height", 22)
    .attr("fill", "#d3dcd2").attr("stroke", "#333").attr("stroke-width", 3);

   // Testo del valore
  const valueText = svg.append("text")
    .attr("id", `value-${id}`)
    .attr("x", 0)
    .attr("y", radius - 34 + 17)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .attr("font-weight", "bold")
    .text(`${parseFloat(value).toFixed(1)} ${meta.unit}`);

  // Funzione di aggiornamento
  const update = () => {
    const rotation = valueToRotation(value);
    needleGroup.transition().duration(500).attr("transform", `rotate(${rotation})`);
    valueText.text(`${parseFloat(value).toFixed(1)} ${meta.unit}`);
  };

  return { 
    get value() { return value; },
    set value(v) { value = v; },
    update
  };
}