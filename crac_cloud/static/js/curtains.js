// file: /static/js/curtains.js

// --- 0. Setup Iniziale e Configurazione ---

// Variabile di stato locale (true = Aperte)
let curtainsOpen = false; 

// Ottieni gli elementi del DOM.
// Nota: Devono essere eseguiti dopo che il DOM è pronto (in window.onload)
const canvas = document.getElementById('curtainsCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const L_BASE = 340; 
const T_BASE_CALC = L_BASE / 4.25; // circa 91.76

// Configurazione geometrica per il disegno
const config = {
    // I valori iniziali per l e h vengono impostati in window.onload
    l: L_BASE, // Larghezza predefinita
    h: L_BASE/1.8, // Altezza predefinita
    conv: Math.PI / 180, // Gradi a radianti
    alpha_min_conf: 15, // Angolo minimo di inizio (gradi)
    t_base : T_BASE_CALC, // Lunghezza del raggio della tenda
    delta_pt_base: 1.7 *T_BASE_CALC, // Distanza dal centro dei punti di pivot
    tenda_raggio: 100
};

// file: /static/js/curtains.js

// ... (omesso setup) ...

function fetchCurtainsStatus() {
    fetch('/curtains/status')
    .then(response => response.json())
    .then(data => {
        
        if (data.error) {
            console.error("Errore nel recupero dello stato:", data.error);
            const button = document.getElementById('btn-curtains');
            button.textContent = "Errore Stato";
            button.disabled = true;
            return;
        }

        const curtains = data.curtains;
        if (!curtains || curtains.length === 0) {
             console.warn("Nessun dato tende ricevuto.");
             return;
        }
            
        // --- INIZIO LOGICA UNIFICATA ---
        
        // Usiamo la prima tenda come riferimento per la visualizzazione generale e il pulsante
        const first_curtain = curtains[0];
        const angle = first_curtain.angle || 0;
        const status = first_curtain.status || 'UNKNOWN';

        // 1. Aggiorna lo stato logico globale per il pulsante
        // Se l'angolo è maggiore dell'angolo minimo di apertura + tolleranza, consideriamo 'aperto'.
        curtainsOpen = (angle > config.alpha_min_conf + 1); 

        // 2. Aggiorna la visualizzazione grafica (chiamando la funzione che disegna i poligoni)
        // NOTA: Qui inviamo l'angolo unico per entrambe le tende, come da tua logica attuale.
        updateCurtainsVisualization(angle, status, status); 

        // 3. Aggiorna il testo e lo stato del pulsante
        const button = document.getElementById('btn-curtains');
        
        if (status === 'Apertura' || status === 'Chiusura' || status === 'Disattivazione') {
             button.disabled = true; 
             button.textContent = status + '...'; 
        } else {
             button.disabled = false;
             if (curtainsOpen) {
                 button.textContent = 'Disattiva';
             } else {
                 button.textContent = 'Attiva';
             }
        }

        // 4. *** AGGIORNAMENTO SPECIFICO DELLE LABEL UI PER OGNI TENDA (Logica Corretta) ***
        curtains.forEach(curtain => {
            const orientation = curtain.orientation; 
            const status_label = curtain.status;     
            const angle_value = curtain.angle;       
            
            if (orientation === 'WEST') {
                // IDs dalla tua UI: Alt_Ovest e Tenda_Ovest
                const altOvest = document.getElementById('Alt_Ovest');
                if (altOvest) altOvest.textContent = angle_value.toFixed(1) + '°';
                
                const tendaOvest = document.getElementById('Tenda_Ovest');
                if (tendaOvest) tendaOvest.textContent = status_label;

            } else if (orientation === 'EAST') {
                // IDs dalla tua UI: Alt_Est e Tenda_Est
                const altEst = document.getElementById('Alt_Est');
                if (altEst) altEst.textContent = angle_value.toFixed(1) + '°';
                
                const tendaEst = document.getElementById('Tenda_Est');
                if (tendaEst) tendaEst.textContent = status_label;
            }
        });
        
    }) // Chiusura corretta del .then(data => { ... })
    .catch(error => {
        console.error('Errore di rete durante il polling:', error);
        const button = document.getElementById('btn-curtains');
        button.disabled = false;
        button.textContent = "Errore Rete";
    });
}
// --- 1. Funzioni di Calcolo e Disegno ---
function createPolygonCoordinates(alpha, orientation, config) {
    const conv = config.conv;
    const alpha_min_conf = config.alpha_min_conf;
    const t = config.tenda_raggio;
    const delta_pt = config.delta_pt_base;
    const h = config.h;
    const l = config.l;

    // Convenzione: 
    // Ovest (W) è a DX  --> i = 1
    // Est (E) è a SX  --> i = -1
    const i = orientation === "W" ? 1 : -1;

      
    const startAngleOffset = (orientation === "E") ? 180 : 0; 
    const baseAngleSign = (orientation === "E") ? 1 : -1;
    

    // Angoli in gradi (0 = chiusa, alpha = aperta)
    const anglesInDegrees = [
        alpha_min_conf,
        (alpha / 4) + alpha_min_conf,
        (alpha / 2) + alpha_min_conf,
        ((alpha / 4) * 3) + alpha_min_conf,
        alpha + alpha_min_conf
    ];

    const verticalOffset = 1.8; // Prova 1.9 o 1.8. Se 2.0 era (h/3)*2
    const y = Math.round((config.h / 3) * verticalOffset); // Altezza fissa per il punto di pivot
    const x = Math.round((config.l / 2) + (i * delta_pt / 2)); // Posizione orizzontale del punto di pivot
    const pt = [x, y]; // Punto di pivot (centro)
    
    const points = [pt];

    // Iterazione sui 5 angoli
    for (const degree of anglesInDegrees) {
        
        // Calcola l'angolo in gradi rispetto al lato Est o Ovest.
        // Se Ovest (DX), l'angolo va in senso orario (negativo).
        // Se Est (SX), l'angolo va in senso antiorario (positivo) partendo da 180.
        const totalDegree = startAngleOffset + (baseAngleSign * degree);
        
        // Converte in radianti
        const rad = totalDegree * conv;
        
        // Calcola il punto usando la trigonometria standard
        const pointX = x + Math.round(Math.cos(rad) * t);
        const pointY = y - Math.round(Math.sin(rad) * t); 
        
        points.push([pointX, pointY]);
    }

    // Le coordinate ritornate sono [pt_centro, pt1, pt2, pt3, pt4, pt5]
    return points;
}

function drawPolygon(ctx, points, color) {
    // ... (Il codice che hai fornito qui è CORRETTO) ...
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    
    // Disegna le linee bianche per la struttura (come nell'immagine)
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function updateRoofBackground(isOpen) {
    const bg = document.getElementById('background');
    if (bg) {
        if (isOpen) {
            bg.src = "/static/img/cielo_stellato.png";
        } else {
            // Nota: devi assicurarti di avere un'immagine per il tetto chiuso
            bg.src = "/static/img/chiuso.png"; 
        }
    }
}

function drawCurtains(ctx, leftAlpha, rightAlpha, config) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Disegna prima la base chiusa (per coprire l'area sotto le tende)
    drawClosedRoof(ctx, config); 
    
    // Disegna le tende
    const leftPoints = createPolygonCoordinates(leftAlpha, 'W', config);
    const rightPoints = createPolygonCoordinates(rightAlpha, 'E', config);

    drawPolygon(ctx, leftPoints, '#3498db'); // Colore blu per le tende
    drawPolygon(ctx, rightPoints, '#3498db');
}

function drawClosedRoof(ctx, config) {
    const l = config.l;
    const h = config.h;
    // Usiamo i parametri di base per il disegno della struttura
    const t_base = config.t_base;       
    const delta_pt_base = config.delta_pt_base; 

    // Poligono esterno (Base - Grigio Chiaro)
    const p6 = [1, h];
    const p7 = [l-1, h];
    const p8 = [l-1, (h/11)*8];
    const p9 = [l/2, (h/11)*4.5];
    const p10 = [1, (h/11)*8];
    
    // Calcoliamo i punti X con Math.round() come richiesto dalla logica Python
    const p1_x = (l/2 - delta_pt_base/2) - (0.9 * t_base);
    const p2_x = p1_x;
    const p4_x = (l/2 + delta_pt_base/2) + (0.9 * t_base);
    const p5_x = p4_x;
    
    // Poligono interno (Tetto - Grigio Scuro)
    const p1 = [Math.round(p1_x), h];
    const p2 = [Math.round(p2_x), (h/12)*10];
    const p3 = [l/2, 1.2 * (h/2)];
    const p4 = [Math.round(p4_x), (h/12)*10];
    const p5 = [Math.round(p5_x), h];
    
    // 1. Disegna il Poligono Esterno (Grigio Chiaro)
    drawPolygon(ctx, [p6, p7, p8, p9, p10], '#D8D8D8'); 

    // 2. Disegna il Poligono Interno (Grigio Scuro)
    // QUESTO È IL POLIGONO MANCANTE che definisce la sezione del muro.
    drawPolygon(ctx, [p1, p5, p4, p3, p2], '#848484'); 
}

// --- 2. Funzioni di Logica e Aggiornamento Frontend ---

/**
 * Aggiorna la visualizzazione grafica e le label di stato.
 * @param {number} angle - Angolo raggiunto (0-90 gradi)
 * @param {string} status_est - Messaggio di stato per la tenda Est
 * @param {string} status_ovest - Messaggio di stato per la tenda Ovest
 */
function updateCurtainsVisualization(angle, status_est, status_ovest) {
    // 1. Aggiornamento della grafica delle tende
    drawCurtains(ctx, angle, angle, config); 
    
    // 2. Aggiornamento dello sfondo (aperto/chiuso)
    const isOpen = angle > (config.alpha_min_conf + 1); 
    updateRoofBackground(isOpen);

    // 3. Aggiornamento delle etichette (Label)

    // Altezza (Angolo)
    const angleText = angle.toFixed(1) + '°';
    document.getElementById('lbl_altezza_tenda_ovest').textContent = angleText;
    document.getElementById('lbl_altezza_tenda_est').textContent = angleText; 

    // Stato
    document.getElementById('lbl_status_tenda_ovest').textContent = status_ovest;
    document.getElementById('lbl_status_tenda_est').textContent = status_est;
}

/**
 * Gestisce il click del pulsante 'btn-curtains' e invia il comando al cloud.
 */
function toggleCurtains() {
    // Determina l'azione successiva e il messaggio di attesa
    const button = document.getElementById('btn-curtains');
    // 1. Determina il comando da inviare (in base allo stato ATTUALE riflesso dal server)
    const command = curtainsOpen ? 'deactivate' : 'activate';
    
    // 2. Disabilita il pulsante durante l'invio del comando
    button.disabled = true; 
    button.textContent = 'Invio...'; // Feedback visivo immediato

    // Invio della richiesta al Cloud (Backend Python)
    fetch('/curtains/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: action })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error("Errore nell'invio del comando:", data.message);
            // In caso di errore, riattiva il pulsante per permettere un nuovo tentativo
            button.disabled = false;
            button.textContent = curtainsOpen ? 'Disattiva' : 'Attiva'; 
        } else {
            // 3. Comando inviato con successo. Forza il polling per raccogliere il nuovo stato.
            // Il polling aggiornerà la grafica e il pulsante.
            fetchCurtainsStatus();
        }
    })
    .catch(error => {
        console.error('Errore di rete durante il comando:', error);
        button.disabled = false;
        button.textContent = curtainsOpen ? 'Disattiva' : 'Attiva'; 
    });
}


// --- 3. Inizializzazione all'avvio ---

window.addEventListener('load', () => {
    const canvas = document.getElementById('curtainsCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

    if (canvas && ctx) {
        const container = canvas.parentElement; // container-img-tende
        
        // 1. Legge le dimensioni REALI del container dal DOM
        const rect = container.getBoundingClientRect();
        
        // 2. Imposta le dimensioni INTERNE (disegno) del canvas
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // 3. Aggiorna la configurazione (l'oggetto globale 'config')
        config.l = canvas.width;
        config.h = canvas.height;
        
        // ... (resto dell'inizializzazione) ...
        drawClosedRoof(ctx, config); 
        drawCurtains(ctx, 0, 0, config); // Disegna le tende iniziali
        updateCurtainsVisualization(0, 'CHIUSA', 'CHIUSA');
    } else {
        console.error("ERRORE: Elemento Canvas non trovato!");
    }
});