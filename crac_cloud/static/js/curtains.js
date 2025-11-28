config.l = canvas.width;
config.h = canvas.height;

function createPolygonCoordinates(alpha, orientation, config) {
    const conv = config.conv;
    const alpha_min_conf = config.alpha_min_conf;
    const t = config.t;
    const delta_pt = config.delta_pt;
    const h = config.h;
    const l = config.l;

    const angolo_min = alpha_min_conf * conv;
    const angolo1 = ((alpha / 4) + alpha_min_conf) * conv;
    const angolo2 = ((alpha / 2) + alpha_min_conf) * conv;
    const angolo3 = (((alpha / 4) * 3) + alpha_min_conf) * conv;
    const angolo = (alpha + alpha_min_conf) * conv;

    const i = orientation === "E" ? 1 : -1;

    const y = (h / 3) * 2;
    const x = (l / 2) + (i * delta_pt / 2);

    const pt1 = [
                x + i * Math.round(Math.cos(angolo_min) * t),
                y - Math.round(Math.sin(angolo_min) * t)
            ];

    const pt2 = [
                x + i * Math.round(Math.cos(angolo1) * t),
                y - Math.round(Math.sin(angolo1) * t)
            ];
    const pt3 = [
                x + i * Math.round(Math.cos(angolo2) * t),
                y - Math.round(Math.sin(angolo2) * t)
            ];
    const pt4 = [
                x + i * Math.round(Math.cos(angolo3) * t),
                y - Math.round(Math.sin(angolo3) * t)
            ];
    const pt5 = [
            x + i * Math.round(Math.cos(angolo) * t),
            y - Math.round(Math.sin(angolo) * t)
        ];

    const pt = [x, y];

    return [pt, pt1, pt2, pt3, pt4, pt5];
}

function drawPolygon(ctx, points, color) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}
function updateRoofBackground(isOpen) {
    const bg = document.getElementById('background');
    if (isOpen) {
        bg.src = "/static/img/cielo_stellato.png";
    } else {
        bg.src = "/static/img/chiuso.png";
    }
}

function drawCurtains(ctx, leftAlpha, rightAlpha, config) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const leftPoints = createPolygonCoordinates(leftAlpha, 'W', config);
    const rightPoints = createPolygonCoordinates(rightAlpha, 'E', config);

    ctx.fillStyle = 'blue';
    drawPolygon(ctx, leftPoints, 'blue');
    drawPolygon(ctx, rightPoints, 'blue');
}

function drawClosedRoof(ctx, config) {
    const { l, h, delta_pt, t } = config;

    const p1 = [(l/2 - delta_pt/2) - (0.9*t), h];
    const p2 = [(l/2 - delta_pt/2) - (0.9*t), (h/12)*10];
    const p3 = [l/2, 1.2*(h/2)];
    const p4 = [(l/2 + delta_pt/2) + (0.9*t), (h/12)*10];
    const p5 = [(l/2 + delta_pt/2) + (0.9*t), h];

    const p6 = [1, h];
    const p7 = [l-1, h];
    const p8 = [l-1, (h/11)*8];
    const p9 = [l/2, (h/11)*4.5];
    const p10 = [1, (h/11)*8];

    drawPolygon(ctx, [p6, p7, p8, p9, p10], '#D8D8D8');
    drawPolygon(ctx, [p1, p5, p4, p3, p2], '#848484');
}
