// El Cid — arte procedural "pintado" estilo AoE II DE · núcleo (Canvas 2D, supermuestreo x3)
// window.CidArt: shade, rng, mk, face, terrainTile, treeSvg, palmSvg, bushSvg, rockSvg, iconSvg, resIcon, toUri, CIV_STYLE, PCOLORS
(function () {
'use strict';
const S = 3; // supermuestreo
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
function mix(a, b, t) { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const ch = s => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t); return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join(''); }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S); const x = c.getContext('2d'); x.scale(S, S); x.lineJoin = 'round'; x.lineCap = 'round'; c.w = w; c.h = h; return [c, x]; }
const toUri = c => c.toDataURL ? c.toDataURL() : c;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function path(x, pts) { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); }
function bbox(pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return {x: x0, y: y0, w: x1 - x0, h: y1 - y0}; }
function outline(x, pts, a = 0.7, w = 0.9) { path(x, pts); x.strokeStyle = `rgba(36,21,8,${a})`; x.lineWidth = w; x.stroke(); }
// cara pintada: relleno con gradiente vertical + pinceladas de ruido; opcional textura de sillares/ladrillo/tablas
// o.k tono base, o.tex 'ashlar'|'brick'|'plaster'|'adobe'|'planks'|null, o.ground [a,b] arista del suelo, o.ht altura (para hiladas)
function face(x, pts, col, o = {}) {
  const k = o.k || 0, r = rng(o.seed || 1); const bb = bbox(pts); if (bb.w < 0.5 || bb.h < 0.5) return;
  x.save(); path(x, pts); x.clip();
  const g = x.createLinearGradient(0, bb.y, 0, bb.y + bb.h); g.addColorStop(0, shade(col, k + 0.07)); g.addColorStop(1, shade(col, k - 0.09)); x.fillStyle = g; x.fillRect(bb.x, bb.y, bb.w, bb.h);
  const n = Math.min(900, bb.w * bb.h / (o.dab || 5));
  for (let i = 0; i < n; i++) { x.globalAlpha = 0.35 + r() * 0.35; x.fillStyle = shade(col, k + (r() - 0.5) * (o.amp || 0.2)); x.fillRect(bb.x + r() * bb.w, bb.y + r() * bb.h, 1 + r() * 2.6, 0.8 + r() * 1.4); }
  x.globalAlpha = 1;
  if (o.tex && o.ground) {
    const [a, b] = o.ground, ht = o.ht; const dark = `rgba(30,18,8,${o.tex === 'plaster' ? 0.18 : 0.42})`, lite = 'rgba(255,245,220,0.28)';
    const rowH = o.tex === 'brick' ? 3 : o.tex === 'planks' ? 4 : 5.5, len = Math.hypot(b[0] - a[0], b[1] - a[1]); const blockW = o.tex === 'brick' ? 7 : o.tex === 'adobe' ? 12 : 10;
    for (let yo = 0, row = 0; yo < ht; yo += rowH, row++) {
      const p = [a[0], a[1] - yo], q = [b[0], b[1] - yo];
      if (o.tex !== 'planks') { x.strokeStyle = dark; x.lineWidth = 0.8; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); x.strokeStyle = lite; x.lineWidth = 0.6; x.beginPath(); x.moveTo(p[0], p[1] - 0.9); x.lineTo(q[0], q[1] - 0.9); x.stroke(); }
      const off = (row % 2) * blockW / 2 + (o.tex === 'plaster' ? 0 : r() * 2);
      for (let d = off; d < len; d += blockW + (r() - 0.5) * 3) { const t = d / len; const px = p[0] + (q[0] - p[0]) * t, py = p[1] + (q[1] - p[1]) * t; if (o.tex === 'planks') { x.strokeStyle = dark; x.lineWidth = 0.7; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - ht); x.stroke(); break; } if (o.tex === 'plaster' && r() < 0.6) continue; x.strokeStyle = dark; x.lineWidth = 0.7; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - rowH + 0.5); x.stroke(); if (r() < 0.35) { x.globalAlpha = 0.18; x.fillStyle = r() < 0.5 ? '#fff' : '#000'; const t2 = Math.min(1, (d + blockW * 0.8) / len); const qx = p[0] + (q[0] - p[0]) * t2, qy = p[1] + (q[1] - p[1]) * t2; path(x, [[px, py], [qx, qy], [qx, qy - rowH + 0.5], [px, py - rowH + 0.5]]); x.fill(); x.globalAlpha = 1; } }
    }
    if (o.tex === 'planks') for (let yo = 6; yo < ht; yo += 9) { x.strokeStyle = 'rgba(30,18,8,.35)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(a[0], a[1] - yo); x.lineTo(b[0], b[1] - yo); x.stroke(); }
  }
  // oclusión en la base y sombra de alero
  if (o.ao) { const g2 = x.createLinearGradient(0, bb.y + bb.h - o.ao, 0, bb.y + bb.h); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(20,10,0,.45)'); x.fillStyle = g2; x.fillRect(bb.x, bb.y, bb.w, bb.h); }
  if (o.eave) { const g3 = x.createLinearGradient(0, bb.y, 0, bb.y + o.eave); g3.addColorStop(0, 'rgba(10,5,0,.45)'); g3.addColorStop(1, 'rgba(10,5,0,0)'); x.fillStyle = g3; x.fillRect(bb.x, bb.y, bb.w, bb.h); }
  x.restore();
  if (!o.noOutline) outline(x, pts, o.oa ?? 0.65);
}
function shadowBlob(x, cx, cy, rx, ry, a = 0.4) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, rx); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.7, `rgba(0,0,0,${a * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.translate(cx, cy); x.scale(1, ry / rx); x.translate(-cx, -cy); x.fillStyle = g; x.fillRect(cx - rx, cy - rx, rx * 2, rx * 2); x.restore(); }
function dab(x, px, py, rad, col, a = 1) { x.globalAlpha = a; x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rad, rad * 0.8, 0, 0, 7); x.fill(); x.globalAlpha = 1; }

// ------------------------------------------------------------ estilos por reino
const CIV_STYLE = {
  castilla:   {name: 'Castilla', wall: '#d3be95', tex: 'ashlar', roof: '#a1422a', roofKind: 'hip', roofTex: 'tile', arch: 'round', tower: 'square', accent: '#a52a25', trim: '#efe3c8', timber: '#6b4a2e', device: 'castle', note: 'Caliza clara de sillería, teja árabe roja, torres cuadradas almenadas y entramado de madera. Castillos de frontera.'},
  leon:       {name: 'León', wall: '#b1aa9b', tex: 'ashlar', roof: '#454a57', roofKind: 'hip', roofTex: 'slate', arch: 'round', tower: 'round', accent: '#8b2545', trim: '#dcd6c9', timber: '#4a3a2e', device: 'lion', note: 'Granito gris, pizarra oscura, arcos de medio punto y torres redondas con tejado cónico, herencia romana.'},
  aragon:     {name: 'Aragón y Navarra', wall: '#c39e6c', tex: 'ashlar', roof: '#5d3f23', roofKind: 'gable', roofTex: 'shingle', arch: 'round', tower: 'square', accent: '#c9931f', trim: '#5a3b22', timber: '#4e321c', device: 'bars', note: 'Arenisca dorada, tejados de tablilla a dos aguas muy inclinados y mucha madera pirenaica.'},
  zaragoza:   {name: 'Taifa de Zaragoza', wall: '#d6b883', tex: 'brick', roof: '#35766a', roofKind: 'flat', roofTex: 'glazed', arch: 'horseshoe', tower: 'square', accent: '#2c7566', trim: '#f1e4c6', timber: '#7a5a34', band: true, device: 'star', note: 'Ladrillo y yeso ocre, teja vidriada verde, arcos de herradura y bandas geométricas (Aljafería).'},
  sevilla:    {name: 'Taifa de Sevilla', wall: '#ede3cf', tex: 'plaster', roof: '#b06537', roofKind: 'flat', roofTex: 'terracotta', arch: 'horseshoe', tower: 'square', accent: '#2a5ea7', trim: '#d6b168', timber: '#8a6a44', azulejo: true, palm: true, device: 'star', note: 'Cal blanca, azoteas de terracota, azulejo azul, patios y palmeras. El jardín de al-Ándalus.'},
  almoravide: {name: 'Almorávides', wall: '#b48258', tex: 'adobe', roof: '#986845', roofKind: 'flat', roofTex: 'adobe', arch: 'horseshoe', tower: 'round', accent: '#223a69', trim: '#e2cb9c', timber: '#5a3d24', stepped: true, palm: true, device: 'crescent', note: 'Adobe rojizo, azoteas planas, merlones escalonados, casi sin ornamento. Índigo del velo.'},
};
const PCOLORS = ['#3f8cff', '#e0483f', '#5fbf6a', '#f0c94a'];

// ------------------------------------------------------------ terreno (rombo 64x32 con solapa)
const TERRAIN = {grass: '#5a8b39', water: '#224d7a', tree: '#507a34', berry: '#5a8b39', stone: '#767871', gold: '#877d62', farm: '#b08c50', sand: '#d1bf88', dirt: '#846942', flower: '#5a8b39', shallow: '#4a86a1'};
const FAM = t => t === 'water' || t === 'shallow' ? 'water' : t === 'sand' ? 'sand' : t === 'dirt' || t === 'stone' || t === 'gold' ? 'dirt' : t === 'farm' ? 'farm' : 'grass';
function terrainTile(type, variant = 0) {
  const base = TERRAIN[type] || TERRAIN.grass, fam = FAM(type); const r = rng(variant * 17 + type.length * 131 + 5); const [c, x] = mk(64, 38); const cx = 32, cy = 19;
  x.save(); path(x, [[cx, cy - 16], [cx + 32, cy], [cx, cy + 16], [cx - 32, cy]]); x.clip();
  const g = x.createLinearGradient(0, 3, 0, 35); g.addColorStop(0, shade(base, 0.08)); g.addColorStop(1, shade(base, -0.1)); x.fillStyle = g; x.fillRect(0, 0, 64, 40);
  const amp = fam === 'water' ? 0.12 : fam === 'sand' ? 0.12 : 0.26;
  for (let i = 0; i < 260; i++) { const hue = fam === 'grass' ? mix(base, i % 4 ? '#79a33c' : '#3f6d28', r() * 0.7) : base; x.globalAlpha = 0.5 + r() * 0.4; x.fillStyle = shade(hue, (r() - 0.5) * amp); x.fillRect(r() * 64, r() * 32 + 3, 1 + r() * 3.5, 0.8 + r() * 1.4); }
  x.globalAlpha = 1;
  if (fam === 'grass') { for (let i = 0; i < 34; i++) { const px = 3 + r() * 58, py = 7 + r() * 24; x.strokeStyle = shade(base, i % 3 ? -0.38 : 0.32); x.lineWidth = 0.8; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px - 0.6, py - 2, px + 0.8, py - 4); x.moveTo(px + 1.5, py); x.quadraticCurveTo(px + 2.2, py - 2, px + 1.6, py - 3.6); x.moveTo(px - 1.3, py); x.quadraticCurveTo(px - 2.3, py - 1.6, px - 1.8, py - 3); x.stroke(); } for (let i = 0; i < 5; i++) dab(x, 6 + r() * 52, 8 + r() * 22, 1.2, '#8f8060', 0.6); }
  if (type === 'flower') { const cols = ['#f4d9e6', '#f5e07a', '#ffffff', '#e77c7c', '#b9a3e0']; for (let i = 0; i < 10; i++) { const px = r() * 50 + 7, py = r() * 22 + 8; dab(x, px, py, 1.6, cols[i % 5]); dab(x, px, py, 0.5, '#c99a20'); } }
  if (fam === 'water') { const g2 = x.createRadialGradient(cx, cy, 2, cx, cy, 34); g2.addColorStop(0, shade(base, -0.3)); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = 0.6; x.fillStyle = g2; x.fillRect(0, 0, 64, 40); x.globalAlpha = 1; for (let i = 0; i < 8; i++) { const px = 4 + r() * 46, py = 7 + r() * 20; x.strokeStyle = shade(base, 0.5); x.lineWidth = type === 'shallow' ? 1.1 : 0.9; x.globalAlpha = 0.8; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 4, py - 2.5, px + 8, py); x.quadraticCurveTo(px + 11, py + 2, px + 14, py); x.stroke(); } x.globalAlpha = 1; if (type === 'shallow') for (let i = 0; i < 10; i++) dab(x, r() * 60, r() * 26 + 6, 2 + r() * 2, '#c9bf9a', 0.4); }
  if (fam === 'sand') { for (let i = 0; i < 10; i++) { x.strokeStyle = shade(base, -0.14); x.lineWidth = 0.8; x.beginPath(); const px = r() * 56, py = r() * 26 + 5; x.moveTo(px, py); x.quadraticCurveTo(px + 6, py - 1.5, px + 12, py); x.stroke(); } for (let i = 0; i < 6; i++) dab(x, r() * 60, r() * 28 + 4, 0.9, shade(base, -0.3)); }
  if (fam === 'dirt') { for (let i = 0; i < 12; i++) { dab(x, r() * 60 + 2, r() * 26 + 6, 0.8 + r() * 1.6, shade(base, -0.35)); dab(x, r() * 60 + 2, r() * 26 + 6, 0.8, shade(base, 0.35)); } for (let i = 0; i < 4; i++) { const px = r() * 50 + 5, py = r() * 20 + 8; x.strokeStyle = shade(base, -0.4); x.lineWidth = 0.6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 4, py + 2); x.lineTo(px + 7, py + 1); x.lineTo(px + 11, py + 3); x.stroke(); } }
  if (type === 'farm') for (let k = -3; k <= 3; k++) { const p = lerp([cx - 32, cy], [cx, cy - 16], (k + 3.5) / 7), q = lerp([cx, cy + 16], [cx + 32, cy], (k + 3.5) / 7); x.strokeStyle = shade(base, -0.38); x.lineWidth = 2.4; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); x.strokeStyle = shade(base, 0.2); x.lineWidth = 0.8; x.beginPath(); x.moveTo(p[0], p[1] - 1.8); x.lineTo(q[0], q[1] - 1.8); x.stroke(); }
  x.restore();
  outline(x, [[cx, cy - 16], [cx + 32, cy], [cx, cy + 16], [cx - 32, cy]], 0.06, 0.6);
  return c;
}
// ------------------------------------------------------------ naturaleza
function treeSvg(variant = 0, k = 1) {
  const r = rng(variant * 91 + 3); const sz = 0.72 + k * 0.38; const bx = 32, by = 73; const [c, x] = mk(64, 80);
  shadowBlob(x, bx + 7, by, 19 * sz, 7 * sz, 0.5);
  // tronco con corteza
  const tg = x.createLinearGradient(bx - 5, 0, bx + 5, 0); tg.addColorStop(0, '#7c5636'); tg.addColorStop(0.5, '#5a3d22'); tg.addColorStop(1, '#33200f'); x.fillStyle = tg;
  path(x, [[bx - 9, by + 1], [bx - 4, by - 3], [bx - 3.5, by - 26 * sz], [bx + 3.5, by - 26 * sz], [bx + 4, by - 3], [bx + 10, by + 1]]); x.fill(); outline(x, [[bx - 9, by + 1], [bx - 4, by - 3], [bx - 3.5, by - 26 * sz], [bx + 3.5, by - 26 * sz], [bx + 4, by - 3], [bx + 10, by + 1]]);
  for (let i = 0; i < 7; i++) { x.strokeStyle = 'rgba(30,15,5,.5)'; x.lineWidth = 0.7; x.beginPath(); const yy = by - 4 - i * 3.2 * sz; x.moveTo(bx - 3 + r() * 2, yy); x.quadraticCurveTo(bx + r() * 2 - 1, yy - 1.5, bx + 3 - r() * 2, yy - 1); x.stroke(); }
  const pine = variant % 3 === 2;
  if (pine) {
    for (let i = 0; i < 5; i++) { const cy = by - 18 * sz - i * 11 * sz, rad = (19 - i * 3.4) * sz; const dark = shade('#27552a', -0.15 + i * 0.05), lit = shade('#3f8a3a', i * 0.06);
      const apex = [bx, cy - 15 * sz]; const n = 6; const pts = [apex]; for (let j = 1; j <= n; j++) { const t = j / n; pts.push([bx + rad * t + (j % 2 ? -1.5 : 0), cy - 15 * sz * (1 - t) + (j % 2 ? 1.8 : 0)]); } for (let j = n; j >= 1; j--) { const t = j / n; pts.push([bx - rad * t + (j % 2 ? 1.5 : 0), cy - 15 * sz * (1 - t) + (j % 2 ? 1.8 : 0)]); }
      x.fillStyle = dark; path(x, pts); x.fill(); outline(x, pts, 0.6);
      x.save(); path(x, pts); x.clip(); x.fillStyle = lit; path(x, [[bx, cy - 15 * sz], [bx + rad, cy + 1], [bx - 1, cy + 1]]); x.fill();
      for (let j = 0; j < 40; j++) { const t = r(), u = r(); const px = bx + (u - 0.5) * 2 * rad * (0.2 + 0.8 * t), py = cy - 15 * sz + t * 15 * sz; x.strokeStyle = px > bx ? shade(lit, 0.2 + r() * 0.2) : shade(dark, -0.2 - r() * 0.2); x.lineWidth = 0.7; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 3, py + 2 + r() * 2); x.stroke(); }
      x.restore(); }
    dab(x, bx + 3, by - 30 * sz, 1.5, '#5a3a1a'); dab(x, bx - 4, by - 42 * sz, 1.3, '#5a3a1a');
  } else {
    x.strokeStyle = '#4a3018'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(bx, by - 24 * sz); x.lineTo(bx - 10, by - 34 * sz); x.moveTo(bx, by - 26 * sz); x.lineTo(bx + 9, by - 35 * sz); x.moveTo(bx, by - 28 * sz); x.lineTo(bx - 2, by - 40 * sz); x.stroke();
    const ccy = by - 41 * sz, R = 21 * sz;
    const cg = x.createRadialGradient(bx - 6, ccy - 7, 2, bx, ccy, R + 4); cg.addColorStop(0, '#7dbf50'); cg.addColorStop(0.6, '#3f7f31'); cg.addColorStop(1, '#1f4519');
    x.fillStyle = cg; x.beginPath(); x.ellipse(bx, ccy, R, R * 0.9, 0, 0, 7); x.fill();
    // silueta irregular: racimos
    for (let i = 0; i < 22; i++) { const a = r() * Math.PI * 2, d = (0.4 + r() * 0.65) * R; const px = bx + Math.cos(a) * d, py = ccy + Math.sin(a) * d * 0.85; const rad = (4 + r() * 6) * sz; const lit = (px - bx) * -0.5 + (py - ccy) < -3; dab(x, px, py, rad, lit ? shade('#6db24a', r() * 0.3) : shade('#2f6a2a', -r() * 0.35), 0.92); }
    // hojas
    for (let i = 0; i < 160; i++) { const a = r() * Math.PI * 2, d = r() * (R + 1); const px = bx + Math.cos(a) * d, py = ccy + Math.sin(a) * d * 0.88; const lit = (px - bx) * -0.45 + (py - ccy) < -2; x.globalAlpha = 0.75; x.fillStyle = lit ? (r() < 0.3 ? '#b9e070' : shade('#7dbf50', r() * 0.2)) : (r() < 0.3 ? '#173a14' : shade('#2b5e26', -r() * 0.3)); x.fillRect(px, py, 1 + r() * 1.6, 0.8 + r() * 1.2); }
    x.globalAlpha = 1;
    // contorno
    x.strokeStyle = 'rgba(20,35,10,.7)'; x.lineWidth = 0.9; x.beginPath(); x.ellipse(bx, ccy, R + 0.5, R * 0.9 + 0.5, 0, 0, 7); x.stroke();
  }
  x.strokeStyle = '#3f6a2a'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(bx - 10, by + 1); x.quadraticCurveTo(bx - 6, by - 2, bx - 2, by + 1); x.moveTo(bx + 4, by + 1); x.quadraticCurveTo(bx + 8, by - 2, bx + 12, by + 1); x.stroke();
  return c;
}
function palmSvg() {
  const [c, x] = mk(64, 80); const bx = 32, by = 73; shadowBlob(x, bx + 6, by, 15, 6, 0.45);
  const tg = x.createLinearGradient(bx - 4, 0, bx + 8, 0); tg.addColorStop(0, '#b0864f'); tg.addColorStop(1, '#4e341d'); x.fillStyle = tg;
  const trunk = [[bx - 4, by], [bx - 1, by - 22], [bx + 3, by - 47], [bx + 7, by - 47], [bx + 5, by - 22], [bx + 4, by]]; path(x, trunk); x.fill(); outline(x, trunk);
  for (let i = 0; i < 10; i++) { x.strokeStyle = 'rgba(40,20,5,.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(bx - 3 + i * 0.6, by - 5 - i * 4.4); x.lineTo(bx + 3 + i * 0.4, by - 6 - i * 4.4); x.stroke(); }
  const tx = bx + 5, ty = by - 47;
  for (let i = 0; i < 11; i++) { const a = -Math.PI * 0.08 + i / 10 * Math.PI * 1.16; const ex = tx + Math.cos(a) * 26, ey = ty + Math.sin(a) * 13 + 9; const mx = tx + Math.cos(a) * 15, my = ty - 11 + Math.sin(a) * 4;
    x.strokeStyle = '#1b3f18'; x.lineWidth = 5.5; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(mx, my, ex, ey); x.stroke();
    x.strokeStyle = i % 2 ? '#3e8a35' : '#66b34c'; x.lineWidth = 3.6; x.setLineDash([2.2, 1.3]); x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(mx, my, ex, ey); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#8a5a2a'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(mx, my, ex, ey); x.stroke(); }
  dab(x, tx - 2, ty + 2, 2.8, '#7a4e22'); dab(x, tx + 2, ty + 3, 2.2, '#c2842f'); dab(x, tx, ty + 5, 2, '#8a5a24');
  return c;
}
function bushSvg(k = 1) {
  const r = rng(5); const [c, x] = mk(64, 48); shadowBlob(x, 34, 41, 17, 6.5, 0.45);
  const cg = x.createRadialGradient(28, 24, 2, 33, 30, 20); cg.addColorStop(0, '#6aa842'); cg.addColorStop(0.7, '#3a7430'); cg.addColorStop(1, '#1e4019');
  x.fillStyle = cg; x.beginPath(); x.ellipse(33, 30, 17, 12, 0, 0, 7); x.fill();
  for (let i = 0; i < 14; i++) { const px = 19 + r() * 28, py = 21 + r() * 16; dab(x, px, py, 3.5 + r() * 4, py < 28 ? shade('#6aa842', r() * 0.25) : shade('#2f5e28', -r() * 0.3), 0.9); }
  for (let i = 0; i < 70; i++) { const px = 17 + r() * 32, py = 20 + r() * 18; x.globalAlpha = 0.8; x.fillStyle = py < 27 ? '#a6d86a' : '#1a3a16'; x.fillRect(px, py, 1 + r() * 1.5, 0.8 + r()); }
  x.globalAlpha = 1; x.strokeStyle = 'rgba(20,35,10,.65)'; x.lineWidth = 0.9; x.beginPath(); x.ellipse(33, 30, 17.5, 12.5, 0, 0, 7); x.stroke();
  const n = 5 + Math.round(k * 12); for (let i = 0; i < n; i++) { const px = 19 + r() * 28, py = 22 + r() * 15; dab(x, px + 0.4, py + 0.5, 2.2, '#6a1212'); dab(x, px, py, 1.8, '#d63b3b'); dab(x, px - 0.6, py - 0.6, 0.6, '#fff', 0.8); }
  return c;
}
function rockSvg(gold = false, k = 1) {
  const r = rng(gold ? 11 : 12); const sz = 0.7 + k * 0.3; const base = gold ? '#8b8268' : '#88929a'; const [c, x] = mk(64, 48); shadowBlob(x, 34, 41, 19 * sz, 7 * sz, 0.5);
  for (let i = 0; i < 4; i++) { const px = 16 + i * 10 * sz + (r() - .5) * 6, py = 37 - r() * 5, w = (12 + r() * 9) * sz, h = (10 + r() * 9) * sz;
    const pts = [[px - w / 2, py], [px - w / 2.6, py - h * 0.75], [px - w / 8, py - h], [px + w / 3, py - h * 1.05], [px + w / 2, py - h * 0.4], [px + w / 2.2, py]];
    face(x, pts, base, {k: -0.05, seed: i + 3, amp: 0.3, dab: 3});
    x.fillStyle = shade(base, 0.35); path(x, [[px - w / 2.6, py - h * 0.75], [px - w / 8, py - h], [px + w / 3, py - h * 1.05], [px + w / 8, py - h * 0.55], [px - w / 5, py - h * 0.5]]); x.fill();
    x.globalAlpha = 0.7; x.fillStyle = shade(base, -0.45); path(x, [[px + w / 3, py - h * 1.05], [px + w / 2, py - h * 0.4], [px + w / 2.2, py], [px + w / 8, py - h * 0.2], [px + w / 8, py - h * 0.55]]); x.fill(); x.globalAlpha = 1;
    x.strokeStyle = 'rgba(20,20,20,.5)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(px - w / 6, py - h * 0.5); x.lineTo(px + w / 30, py - h * 0.2); x.lineTo(px - w / 30, py); x.stroke();
    if (gold) for (let j = 0; j < 4; j++) { const gx = px - w / 4 + r() * w / 2, gy = py - h * 0.9 + r() * h * 0.6; x.fillStyle = '#f2c94c'; path(x, [[gx, gy], [gx + 3, gy - 1], [gx + 5, gy + 1], [gx + 2.5, gy + 2.5]]); x.fill(); outline(x, [[gx, gy], [gx + 3, gy - 1], [gx + 5, gy + 1], [gx + 2.5, gy + 2.5]], 0.5, 0.5); x.strokeStyle = '#fff5c0'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(gx + 0.5, gy - 0.2); x.lineTo(gx + 2, gy - 0.6); x.stroke(); }
    else if (i % 2) dab(x, px - w / 4, py - 2, 3, '#5f8a3a', 0.7); }
  return c;
}

// ------------------------------------------------------------ iconos de mando (grabado sobre latón)
const ICONS = {
  attack: [[[8, 32], [26, 14]], [[22, 10], [30, 18]], [[14, 24], [18, 28]], [[29, 9], [32, 6]]], stop: [[[13, 13], [27, 13], [27, 27], [13, 27], [13, 13]]], patrol: [[[9, 20], [31, 20]], [[25, 14], [31, 20], [25, 26]], [[15, 14], [9, 20], [15, 26]]], guard: [[[20, 7], [30, 11], [30, 20], [26, 28], [20, 33], [14, 28], [10, 20], [10, 11], [20, 7]]], garrison: [[[9, 20], [20, 9], [31, 20]], [[14, 20], [14, 32], [26, 32], [26, 20]], [[20, 32], [20, 25]]], ungarrison: [[[14, 12], [14, 30], [26, 30], [26, 12]], [[20, 27], [20, 14]], [[16, 18], [20, 14], [24, 18]]],
  repair: [[[11, 29], [23, 17]], [[26, 10], [31, 14], [27, 19], [22, 15], [26, 10]]], kill: [[[12, 12], [28, 28]], [[28, 12], [12, 28]]], rally: [[[14, 33], [14, 7]], [[14, 7], [28, 12], [14, 17]]], heal: [[[20, 10], [20, 30]], [[10, 20], [30, 20]]], convert: [[[28, 20], [27, 14], [22, 11], [16, 12], [12, 17], [12, 23], [16, 28], [22, 29], [27, 26]], [[25, 9], [26, 14], [21, 15]]], agg: [[[11, 29], [29, 11]], [[21, 11], [29, 11], [29, 19]]], def: [[[20, 7], [30, 11], [30, 20], [26, 28], [20, 33], [14, 28], [10, 20], [10, 11], [20, 7]], [[15, 20], [19, 24], [26, 16]]], hold: [[[11, 14], [29, 14]], [[11, 20], [29, 20]], [[11, 26], [29, 26]]], age: [[[9, 30], [20, 9], [31, 30]], [[13, 30], [27, 30]]], buy: [[[20, 12], [20, 6]], [[16, 9], [20, 6], [24, 9]], [[12, 22], [14, 16], [20, 14], [26, 16], [28, 22], [26, 28], [20, 30], [14, 28], [12, 22]]], sell: [[[20, 28], [20, 34]], [[16, 31], [20, 34], [24, 31]], [[12, 18], [14, 12], [20, 10], [26, 12], [28, 18], [26, 24], [20, 26], [14, 24], [12, 18]]], gate: [[[11, 32], [11, 15], [20, 8], [29, 15], [29, 32]], [[20, 32], [20, 19]]], delete: [[[9, 30], [31, 30]], [[13, 30], [20, 12], [27, 30]]], cancel: [[[20, 10], [27, 13], [30, 20], [27, 27], [20, 30], [13, 27], [10, 20], [13, 13], [20, 10]], [[14, 14], [26, 26]]],
};
const ICON_COL = {stop: '#d8524a', kill: '#d8524a', agg: '#d8524a', delete: '#d8524a', cancel: '#d8524a', heal: '#6fcf7a', def: '#6fcf7a', buy: '#6fcf7a', sell: '#d8524a', age: '#e7c46a', rally: '#e7c46a', convert: '#e7c46a'};
function iconSvg(id, size = 40) {
  const strokes = ICONS[id] || ICONS.stop; const col = ICON_COL[id] || '#efe3c8'; const [c, x] = mk(size, size); const k = size / 40; x.scale(k, k);
  const g = x.createRadialGradient(20, 16, 2, 20, 20, 28); g.addColorStop(0, '#4a3d2c'); g.addColorStop(1, '#1b150e'); x.fillStyle = g; x.fillRect(0, 0, 40, 40);
  const r = rng(3); for (let i = 0; i < 120; i++) { x.globalAlpha = 0.15; x.fillStyle = r() < 0.5 ? '#fff' : '#000'; x.fillRect(r() * 40, r() * 40, 1 + r() * 2, 1); } x.globalAlpha = 1;
  x.strokeStyle = '#8a7248'; x.lineWidth = 1.5; x.strokeRect(0.75, 0.75, 38.5, 38.5); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 1; x.strokeRect(2.5, 2.5, 35, 35);
  const draw = (ox, oy) => { for (const s of strokes) { x.beginPath(); s.forEach((p, i) => i ? x.lineTo(p[0] + ox, p[1] + oy) : x.moveTo(p[0] + ox, p[1] + oy)); x.stroke(); } };
  x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 4; draw(0, 1); x.strokeStyle = col; x.lineWidth = 2.4; draw(0, 0);
  return c;
}
function resIcon(kind) {
  const [c, x] = mk(20, 20);
  if (kind === 'food') { x.fillStyle = '#d9603a'; x.beginPath(); x.arc(10, 11, 6.5, 0, 7); x.fill(); x.strokeStyle = '#5a2a10'; x.lineWidth = 1; x.stroke(); x.strokeStyle = '#3d6b2a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(10, 4.5); x.quadraticCurveTo(11, 1.5, 14, 1.5); x.stroke(); dab(x, 8, 9, 1.6, '#fff', 0.5); }
  if (kind === 'wood') { x.fillStyle = '#a67a48'; path(x, [[3, 13], [12, 4], [16, 8], [7, 17]]); x.fill(); x.strokeStyle = '#4a2e18'; x.lineWidth = 1; x.stroke(); x.fillStyle = '#e0bf86'; x.beginPath(); x.arc(13.5, 6.5, 2.6, 0, 7); x.fill(); x.stroke(); dab(x, 13.5, 6.5, 1, '#a67a48'); }
  if (kind === 'stone') { x.fillStyle = '#a3a7ad'; path(x, [[3, 15], [6, 8], [12, 5], [18, 10], [17, 15]]); x.fill(); x.strokeStyle = '#3a3d44'; x.lineWidth = 1; x.stroke(); x.fillStyle = '#d4d7dc'; path(x, [[6, 8], [12, 5], [15, 7.5], [9, 10.5]]); x.fill(); }
  if (kind === 'gold') { x.fillStyle = '#e8b73a'; path(x, [[10, 2], [18, 10], [10, 18], [2, 10]]); x.fill(); x.strokeStyle = '#6b4a10'; x.lineWidth = 1; x.stroke(); x.fillStyle = '#f7dc7a'; path(x, [[10, 2], [18, 10], [10, 10]]); x.fill(); }
  return c;
}
window.CidArt = Object.assign(window.CidArt || {}, {S, clamp, shade, mix, rng, mk, path, bbox, outline, face, shadowBlob, dab, lerp, toUri, CIV_STYLE, PCOLORS, TERRAIN, terrainTile, treeSvg, palmSvg, bushSvg, rockSvg, iconSvg, resIcon});
})();
