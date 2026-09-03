// ============================================================ SPRITES PROCEDURALES (isométrico 2:1)
// Todo el arte se genera en tiempo de carga con Canvas 2D y se guarda en caché.
const ISO = {TW: 64, TH: 32, S: 2}; // ancho/alto de rombo (px de mundo → 1 tile = 32 px de mundo) y sobremuestreo de sprites
const SPR = {cache: new Map(), water: []};
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w * ISO.S); c.height = Math.ceil(h * ISO.S); const x = c.getContext('2d'); x.scale(ISO.S, ISO.S); x.lineJoin = 'round'; return [c, x]; }
function shade(hex, k) { // aclara (k>0) u oscurece (k<0) un color #rrggbb
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
function srng(seed) { return mulberry(seed); }

// ------------------------------------------------------------ terreno
const TERRAIN_BASE = {[T_GRASS]: '#5b9a45', [T_WATER]: '#2d6ea3', [T_TREE]: '#568f42', [T_BERRY]: '#5b9a45', [T_STONE]: '#7d8a8e', [T_GOLD]: '#8b8571', [T_FARM]: '#c4a45a', [T_SAND]: '#d2c48b', [T_DIRT]: '#8d7b53', [T_FLOWER]: '#5b9a45', [T_SHALLOW]: '#5f9ec4'};
const FAMILY = t => t === T_WATER ? 'water' : t === T_SHALLOW ? 'shallow' : t === T_SAND ? 'sand' : t === T_DIRT || t === T_STONE || t === T_GOLD ? 'dirt' : t === T_FARM ? 'farm' : 'grass';
function diamondPath(x, cx, cy, w, h) { x.beginPath(); x.moveTo(cx, cy - h / 2); x.lineTo(cx + w / 2, cy); x.lineTo(cx, cy + h / 2); x.lineTo(cx - w / 2, cy); x.closePath(); }
// rombo 64x32 con textura; `nb` = familias de los 4 vecinos [N(-y), E(+x), S(+y), W(-x)] para mezclar bordes
function terrainTile(type, variant, nbKey, nb) {
  const key = 't' + type + ':' + variant + ':' + nbKey;
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const [c, x] = mkCanvas(ISO.TW, ISO.TH + 6);
  const cx = 32, cy = 16 + 3, base = TERRAIN_BASE[type]; const r = srng(type * 131 + variant * 17 + 7);
  x.save(); diamondPath(x, cx, cy, 64, 32); x.clip();
  x.fillStyle = base; x.fillRect(0, 0, 64, 40);
  // moteado
  const fam = FAMILY(type);
  const amp = fam === 'water' ? 0.05 : fam === 'shallow' ? 0.06 : fam === 'sand' ? 0.1 : 0.16;
  for (let i = 0; i < 70; i++) { const px = r() * 64, py = r() * 32 + 3; x.fillStyle = shade(base, (r() - 0.5) * amp); x.fillRect(px, py, 2 + r() * 3, 1.2 + r()); }
  if (fam === 'grass') for (let i = 0; i < 10; i++) { const px = r() * 60 + 2, py = r() * 26 + 6; x.strokeStyle = shade(base, -0.25); x.lineWidth = 0.8; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 1, py - 3); x.stroke(); x.beginPath(); x.moveTo(px + 2, py); x.lineTo(px + 3, py - 2.5); x.stroke(); }
  if (type === T_FLOWER) { const cols = ['#f4d9e6', '#f5e07a', '#ffffff', '#ee9c9c']; for (let i = 0; i < 6; i++) { x.fillStyle = cols[Math.floor(r() * 4)]; x.beginPath(); x.arc(r() * 50 + 7, r() * 22 + 8, 1.4, 0, 7); x.fill(); } }
  if (fam === 'water' || fam === 'shallow') { x.strokeStyle = shade(base, 0.25); x.lineWidth = 1; for (let i = 0; i < 4; i++) { const px = 8 + r() * 44, py = 8 + r() * 18; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 4, py - 2, px + 9, py); x.stroke(); } }
  if (fam === 'sand') { x.fillStyle = shade(base, -0.12); for (let i = 0; i < 12; i++) x.fillRect(r() * 60, r() * 28 + 4, 3, 1); }
  if (type === T_FARM) { x.strokeStyle = shade(base, -0.28); x.lineWidth = 1.5; for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(cx - 32 + 6, cy + k * 4 - 3 + 16 * 0); x.lineTo(cx, cy + k * 4 - 3 - 16 + 16); x.stroke(); } x.strokeStyle = '#8fbf5a'; x.lineWidth = 1; for (let i = 0; i < 14; i++) { const px = 10 + r() * 44, py = 6 + r() * 20; x.beginPath(); x.moveTo(px, py + 2); x.lineTo(px, py - 2); x.stroke(); } }
  // mezcla con vecinos de otra familia
  if (nb && fam !== 'water' && fam !== 'shallow') {
    const edges = [[cx, cy - 16, cx + 32, cy], [cx + 32, cy, cx, cy + 16], [cx, cy + 16, cx - 32, cy], [cx - 32, cy, cx, cy - 16]]; // N-E, E-S, S-W, W-N
    // vecino N está en el borde superior izquierdo (W-N), E en N-E, S en E-S, W en S-W
    const map = [3, 0, 1, 2];
    nb.forEach((f, i) => {
      if (!f || f === fam) return;
      let col = TERRAIN_BASE[{water: T_WATER, shallow: T_SHALLOW, sand: T_SAND, dirt: T_DIRT, farm: T_FARM, grass: T_GRASS}[f]];
      if (f === 'water' || f === 'shallow') col = fam === 'sand' ? '#b9c9a6' : '#8fb08a'; // orilla húmeda
      const [ax, ay, bx, by] = edges[map[i]];
      const g = x.createLinearGradient((ax + bx) / 2, (ay + by) / 2, cx, cy);
      g.addColorStop(0, col + 'cc'); g.addColorStop(0.45, col + '00');
      x.fillStyle = g; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.lineTo(cx, cy); x.closePath(); x.fill();
    });
  }
  x.restore();
  // borde sutil
  if (fam !== 'water' && fam !== 'shallow') { x.strokeStyle = fam === 'grass' ? '#00000008' : '#00000010'; x.lineWidth = 0.6; diamondPath(x, cx, cy, 64, 32); x.stroke(); }
  SPR.cache.set(key, c); return c;
}
// ------------------------------------------------------------ objetos del terreno (árboles, minas, bayas)
function treeSprite(variant, k) { // k: 0..1 restante
  const key = 'tree' + variant + ':' + Math.round(k * 3);
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const [c, x] = mkCanvas(64, 80); const r = srng(variant * 91 + 3); const sz = 0.75 + Math.round(k * 3) / 3 * 0.35;
  const bx = 32, by = 72;
  x.fillStyle = '#00000033'; x.beginPath(); x.ellipse(bx + 6, by, 16 * sz, 7 * sz, 0, 0, 7); x.fill();
  x.fillStyle = '#5a3d22'; x.fillRect(bx - 2.5, by - 22 * sz, 5, 22 * sz); x.fillStyle = '#3d2814'; x.fillRect(bx + 1, by - 22 * sz, 1.5, 22 * sz);
  const layers = variant % 2 ? 3 : 4;
  for (let i = 0; i < layers; i++) {
    const cy = by - 26 * sz - i * 11 * sz, rad = (17 - i * 3.2) * sz;
    x.fillStyle = shade('#2f6a2a', -0.15 + i * 0.05); x.beginPath(); x.ellipse(bx + 1, cy + 3, rad, rad * 0.8, 0, 0, 7); x.fill();
    x.fillStyle = shade('#3f8a36', i * 0.08); x.beginPath(); x.ellipse(bx - 2, cy, rad * 0.95, rad * 0.75, 0, 0, 7); x.fill();
    for (let j = 0; j < 5; j++) { x.fillStyle = shade('#4f9f44', r() * 0.25); x.beginPath(); x.arc(bx - 2 + (r() - .5) * rad * 1.4, cy + (r() - .5) * rad, rad * 0.22, 0, 7); x.fill(); }
  }
  SPR.cache.set(key, c); return c;
}
function bushSprite(k) {
  const key = 'bush' + Math.round(k * 3);
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const [c, x] = mkCanvas(64, 48); const r = srng(5);
  x.fillStyle = '#00000030'; x.beginPath(); x.ellipse(34, 40, 16, 6, 0, 0, 7); x.fill();
  for (let i = 0; i < 6; i++) { x.fillStyle = shade('#3f7a34', (r() - .5) * 0.3); x.beginPath(); x.arc(20 + r() * 24, 24 + r() * 12, 7 + r() * 4, 0, 7); x.fill(); }
  const n = 4 + Math.round(k * 8); x.fillStyle = '#d63b3b'; for (let i = 0; i < n; i++) { x.beginPath(); x.arc(18 + r() * 28, 22 + r() * 14, 1.8, 0, 7); x.fill(); }
  SPR.cache.set(key, c); return c;
}
function rockSprite(gold, k) {
  const key = (gold ? 'gold' : 'rock') + Math.round(k * 3);
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const [c, x] = mkCanvas(64, 48); const r = srng(gold ? 11 : 12); const sz = 0.7 + Math.round(k * 3) / 3 * 0.3;
  x.fillStyle = '#00000033'; x.beginPath(); x.ellipse(34, 40, 18 * sz, 7 * sz, 0, 0, 7); x.fill();
  const base = gold ? '#9a8f70' : '#8c979b';
  for (let i = 0; i < 3; i++) {
    const px = 18 + i * 12 * sz + (r() - .5) * 6, py = 36 - (r()) * 6, w = (12 + r() * 8) * sz, h = (10 + r() * 8) * sz;
    x.fillStyle = shade(base, -0.25); x.beginPath(); x.moveTo(px - w / 2, py); x.lineTo(px - w / 3, py - h); x.lineTo(px + w / 3, py - h * 1.1); x.lineTo(px + w / 2, py); x.closePath(); x.fill();
    x.fillStyle = shade(base, 0.15); x.beginPath(); x.moveTo(px - w / 3, py - h); x.lineTo(px + w / 3, py - h * 1.1); x.lineTo(px + w / 6, py - h * 0.5); x.lineTo(px - w / 6, py - h * 0.55); x.closePath(); x.fill();
    if (gold) { x.fillStyle = '#f5d24f'; for (let j = 0; j < 3; j++) x.fillRect(px - w / 4 + r() * w / 2, py - h * 0.9 + r() * h * 0.6, 3, 2.5); }
  }
  SPR.cache.set(key, c); return c;
}
function relicSprite() {
  if (SPR.cache.has('relic')) return SPR.cache.get('relic');
  const [c, x] = mkCanvas(32, 40);
  x.fillStyle = '#00000033'; x.beginPath(); x.ellipse(16, 36, 9, 4, 0, 0, 7); x.fill();
  x.fillStyle = '#c9a23a'; x.fillRect(9, 14, 14, 20); x.fillStyle = '#f0d060'; x.fillRect(11, 16, 10, 16); x.fillStyle = '#8a6a1a'; x.fillRect(9, 12, 14, 4);
  x.fillStyle = '#fff'; x.fillRect(15, 18, 2, 12); x.fillRect(12, 21, 8, 2);
  SPR.cache.set('relic', c); return c;
}

// ------------------------------------------------------------ edificios
// Caja isométrica: huesped en (0,0)=esquina superior del rombo de la planta. w,h en tiles; ht en px de alto.
function isoBox(x, ox, oy, w, h, ht, col, opts = {}) {
  const TW = 32, TH = 16; // medio rombo por tile
  const top = {x: ox, y: oy}, right = {x: ox + w * TW, y: oy + w * TH}, bottom = {x: ox + (w - h) * TW, y: oy + (w + h) * TH}, left = {x: ox - h * TW, y: oy + h * TH};
  // cara izquierda (SW)
  x.fillStyle = shade(col, opts.lk ?? -0.28); x.beginPath(); x.moveTo(left.x, left.y - ht); x.lineTo(bottom.x, bottom.y - ht); x.lineTo(bottom.x, bottom.y); x.lineTo(left.x, left.y); x.closePath(); x.fill();
  // cara derecha (SE)
  x.fillStyle = shade(col, opts.rk ?? -0.1); x.beginPath(); x.moveTo(bottom.x, bottom.y - ht); x.lineTo(right.x, right.y - ht); x.lineTo(right.x, right.y); x.lineTo(bottom.x, bottom.y); x.closePath(); x.fill();
  // tapa
  if (!opts.noTop) { x.fillStyle = shade(col, opts.tk ?? 0.12); x.beginPath(); x.moveTo(top.x, top.y - ht); x.lineTo(right.x, right.y - ht); x.lineTo(bottom.x, bottom.y - ht); x.lineTo(left.x, left.y - ht); x.closePath(); x.fill(); }
  x.strokeStyle = '#00000040'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(left.x, left.y - ht); x.lineTo(bottom.x, bottom.y - ht); x.lineTo(right.x, right.y - ht); x.moveTo(bottom.x, bottom.y - ht); x.lineTo(bottom.x, bottom.y); x.stroke();
  return {top, right, bottom, left};
}
// tejado a cuatro aguas sobre una caja w×h a altura ht, con cumbrera a ht+rh
function hipRoof(x, ox, oy, w, h, ht, rh, col) {
  const TW = 32, TH = 16;
  const top = {x: ox, y: oy - ht}, right = {x: ox + w * TW, y: oy + w * TH - ht}, bottom = {x: ox + (w - h) * TW, y: oy + (w + h) * TH - ht}, left = {x: ox - h * TW, y: oy + h * TH - ht};
  const cx = (top.x + bottom.x) / 2, cy = (top.y + bottom.y) / 2;
  const long = w >= h; // cumbrera paralela al lado largo
  const inset = 0.3;
  const r1 = long ? {x: cx + (top.x - left.x) * inset * 0 - (right.x - left.x) * 0.5 * (1 - 2 * inset) * 0 + (left.x - cx) * (1 - 2 * inset) * 0.5 * 0, y: 0} : null;
  // extremos de la cumbrera: interpolar entre los puntos medios de los lados cortos
  const mA = long ? {x: (top.x + left.x) / 2, y: (top.y + left.y) / 2} : {x: (top.x + right.x) / 2, y: (top.y + right.y) / 2};
  const mB = long ? {x: (right.x + bottom.x) / 2, y: (right.y + bottom.y) / 2} : {x: (left.x + bottom.x) / 2, y: (left.y + bottom.y) / 2};
  const A = {x: mA.x + (mB.x - mA.x) * inset, y: mA.y + (mB.y - mA.y) * inset - rh}, B = {x: mB.x + (mA.x - mB.x) * inset, y: mB.y + (mA.y - mB.y) * inset - rh};
  const faces = long ? [[top, right, B, A, 0.1], [right, bottom, B, B, -0.1], [bottom, left, A, B, -0.3], [left, top, A, A, -0.05]] : [[top, right, A, A, 0.1], [right, bottom, B, A, -0.1], [bottom, left, B, B, -0.3], [left, top, A, B, -0.05]];
  for (const [p, q, s1, s2, k] of faces) { x.fillStyle = shade(col, k); x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.lineTo(s2.x, s2.y); x.lineTo(s1.x, s1.y); x.closePath(); x.fill(); x.strokeStyle = '#00000030'; x.lineWidth = 0.6; x.stroke(); }
  return {A, B};
}
function roofTexture(x, col, seed, area) { const r = srng(seed); x.save(); x.globalAlpha = 0.25; for (let i = 0; i < 40; i++) { x.fillStyle = shade(col, (r() - .5) * 0.5); x.fillRect(area.x + r() * area.w, area.y + r() * area.h, 4, 1.2); } x.restore(); }
function banner(x, px, py, col, ht = 22) { x.fillStyle = '#4a3a2a'; x.fillRect(px - 0.7, py - ht, 1.4, ht); x.fillStyle = col; x.beginPath(); x.moveTo(px, py - ht); x.lineTo(px + 9, py - ht + 3); x.lineTo(px, py - ht + 7); x.closePath(); x.fill(); }
function scaffold(x, ox, oy, w, h, ht) { const TW = 32, TH = 16; x.strokeStyle = '#8a6a3a'; x.lineWidth = 1.2; const pts = [{x: ox, y: oy}, {x: ox + w * TW, y: oy + w * TH}, {x: ox + (w - h) * TW, y: oy + (w + h) * TH}, {x: ox - h * TW, y: oy + h * TH}]; for (const p of pts) { x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x, p.y - ht); x.stroke(); } for (let k = 1; k <= 2; k++) { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p.x, p.y - ht * k / 3) : x.moveTo(p.x, p.y - ht * k / 3)); x.closePath(); x.stroke(); } }

const BLD_COL = {centro: '#c9b48c', casa: '#c7b393', molino: '#c9b48c', aserradero: '#a8814f', mina: '#9a8f7a', cuartel: '#b7a58a', arqueria: '#b7a58a', establo: '#b09068', taller: '#8f7f6a', herreria: '#7f7472', mercado: '#c9b48c', monasterio: '#d6cbb4', universidad: '#cfc2a4', torre: '#a2a2aa', muralla: '#9d9da6', puerta: '#9d9da6', castillo: '#9a9aa4', maravilla: '#e0d3b5', granja: '#c4a45a'};
const ROOF_COL = {centro: '#9c3f34', casa: '#a75a3f', molino: '#7a6a4a', aserradero: '#6e5a3a', mina: '#5e6a70', cuartel: '#5b4a8a', arqueria: '#3e7a6a', establo: '#7a5a2a', taller: '#4a4a4a', herreria: '#3a3a44', universidad: '#7a3a6a', mercado: '#b8763b', monasterio: '#8a6a4a', maravilla: '#d9a441'};
// sprite de edificio. stage: 0..2 en obras, 3 terminado. mask: conexiones de muralla N,E,S,W (bits 1,2,4,8)
function buildingSprite(type, colIdx, stage, mask = 0, extra = '') {
  const key = 'b' + type + ':' + colIdx + ':' + stage + ':' + mask + ':' + extra;
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const d = BUILDINGS[type], w = d.w, h = d.h; const pcol = PCOLORS[colIdx];
  const HT = {centro: 34, casa: 22, molino: 24, aserradero: 18, mina: 16, granja: 0, cuartel: 30, arqueria: 28, establo: 24, taller: 22, herreria: 22, mercado: 20, monasterio: 30, universidad: 30, torre: 58, muralla: 26, puerta: 30, castillo: 52, maravilla: 70}[type] || 24;
  const topPad = HT + 60; const W = (w + h) * 32 + 8, H = (w + h) * 16 + topPad + 8;
  const [c, x] = mkCanvas(W, H);
  const ox = h * 32 + 4, oy = topPad; // esquina superior del rombo de la planta
  const col = BLD_COL[type] || '#bbb', roof = ROOF_COL[type];
  // sombra y suelo
  x.fillStyle = '#00000022'; x.beginPath(); x.moveTo(ox + 4, oy + 2); x.lineTo(ox + w * 32 + 8, oy + w * 16 + 4); x.lineTo(ox + (w - h) * 32 + 8, oy + (w + h) * 16 + 6); x.lineTo(ox - h * 32 + 4, oy + h * 16 + 4); x.closePath(); x.fill();
  if (type === 'granja') { // campo: textura de surcos ya en el terreno; aquí solo vallado
    x.strokeStyle = '#6e5a3a'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(ox, oy - 2); x.lineTo(ox + w * 32, oy + w * 16 - 2); x.lineTo(ox + (w - h) * 32, oy + (w + h) * 16 - 2); x.lineTo(ox - h * 32, oy + h * 16 - 2); x.closePath(); x.stroke();
    for (let i = 0; i <= 8; i++) { const t = i / 8; const px = ox + w * 32 * t, py = oy + w * 16 * t - 2; x.fillStyle = '#7e6a48'; x.fillRect(px - 1, py - 5, 2, 6); const qx = ox - h * 32 * t, qy = oy + h * 16 * t - 2; x.fillRect(qx - 1, qy - 5, 2, 6); }
    if (stage < 3) { x.fillStyle = '#8b7a5288'; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + w * 32, oy + w * 16); x.lineTo(ox + (w - h) * 32, oy + (w + h) * 16); x.lineTo(ox - h * 32, oy + h * 16); x.closePath(); x.fill(); }
    SPR.cache.set(key, {c, ax: ox, ay: oy}); return SPR.cache.get(key);
  }
  if (stage < 3) { // en obras: cimientos + andamio + parte de muros
    const frac = [0.15, 0.45, 0.8][stage];
    x.fillStyle = '#a89878'; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + w * 32, oy + w * 16); x.lineTo(ox + (w - h) * 32, oy + (w + h) * 16); x.lineTo(ox - h * 32, oy + h * 16); x.closePath(); x.fill();
    isoBox(x, ox, oy, w, h, HT * frac, col, {tk: 0.05});
    scaffold(x, ox, oy, w, h, HT);
    const r = srng(stage + 3); x.fillStyle = '#6e5a3a'; for (let i = 0; i < 6; i++) x.fillRect(ox - h * 32 + r() * (w + h) * 32 * 0.8 + 4, oy + (w + h) * 16 - 4 - r() * 6, 8, 3);
    SPR.cache.set(key, {c, ax: ox, ay: oy}); return SPR.cache.get(key);
  }
  const r = srng(type.length * 7 + colIdx);
  if (type === 'muralla' || type === 'puerta') {
    // tramo de muralla con conexiones
    const TW = 32, TH = 16, ht = HT;
    const cx = ox, cy = oy + 16; // centro del rombo
    const seg = (dx, dy) => { // pieza que va del centro al borde en dirección (dx,dy) en tiles
      const ex = cx + (dx - dy) * TW / 2, ey = cy + (dx + dy) * TH / 2;
      x.fillStyle = shade(col, dy > 0 || dx > 0 ? -0.12 : -0.3); const wdt = 8;
      const nx = -(ey - cy), ny = (ex - cx); const nl = Math.hypot(nx, ny) || 1; const px = nx / nl * wdt / 2, py = ny / nl * wdt / 4;
      x.beginPath(); x.moveTo(cx + px, cy + py - ht); x.lineTo(ex + px, ey + py - ht); x.lineTo(ex + px, ey + py); x.lineTo(cx + px, cy + py); x.closePath(); x.fill();
      x.fillStyle = shade(col, -0.35); x.beginPath(); x.moveTo(cx - px, cy - py - ht); x.lineTo(ex - px, ey - py - ht); x.lineTo(ex - px, ey - py); x.lineTo(cx - px, cy - py); x.closePath(); x.fill();
      x.fillStyle = shade(col, 0.1); x.beginPath(); x.moveTo(cx + px, cy + py - ht); x.lineTo(ex + px, ey + py - ht); x.lineTo(ex - px, ey - py - ht); x.lineTo(cx - px, cy - py - ht); x.closePath(); x.fill();
      // almenas
      x.fillStyle = shade(col, 0.2); for (let k = 0.2; k < 1; k += 0.3) { x.fillRect(cx + (ex - cx) * k - 2, cy + (ey - cy) * k - ht - 4, 4, 4); }
    };
    const conns = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    // primero los tramos traseros (N y W), luego el bloque central, luego E y S
    if (mask & 1) seg(0, -1); if (mask & 8) seg(-1, 0);
    isoBox(x, cx - 6, cy - 3, 0.375, 0.375, ht + 3, col, {tk: 0.15});
    if (type === 'puerta') { x.fillStyle = extra === 'closed' ? '#3a2a16' : '#6e4a2a'; x.fillRect(cx - 5, cy - ht + 4, 10, ht - 4); x.fillStyle = '#c9b48c'; x.fillRect(cx - 5, cy - ht + 4, 10, 2); if (extra === 'closed') { x.fillStyle = '#999'; x.fillRect(cx - 5, cy - ht / 2, 10, 2); } }
    if (mask & 2) seg(1, 0); if (mask & 4) seg(0, 1);
    x.fillStyle = shade(col, 0.25); x.fillRect(cx - 4, cy - ht - 7, 3, 4); x.fillRect(cx + 1, cy - ht - 7, 3, 4);
    SPR.cache.set(key, {c, ax: ox, ay: oy}); return SPR.cache.get(key);
  }
  if (type === 'torre') {
    const b = isoBox(x, ox, oy, 1, 1, HT, col, {lk: -0.32, rk: -0.14, tk: 0.1});
    x.fillStyle = shade(col, 0.22); for (let i = 0; i < 4; i++) { const t = i / 4; x.fillRect(b.left.x + (b.bottom.x - b.left.x) * t + 2, b.left.y + (b.bottom.y - b.left.y) * t - HT - 5, 4, 5); x.fillRect(b.bottom.x + (b.right.x - b.bottom.x) * t + 2, b.bottom.y + (b.right.y - b.bottom.y) * t - HT - 5, 4, 5); }
    x.fillStyle = '#2a2a30'; x.fillRect(b.bottom.x - 3, b.bottom.y - HT * 0.55, 3, 6); x.fillRect(b.bottom.x + 4, b.bottom.y - HT * 0.7, 3, 6);
    banner(x, b.top.x, b.top.y - HT, pcol, 18);
    SPR.cache.set(key, {c, ax: ox, ay: oy}); return SPR.cache.get(key);
  }
  if (type === 'castillo') {
    const b = isoBox(x, ox + 16, oy + 8, 3, 3, 30, col, {lk: -0.3, rk: -0.12, tk: 0.05});
    // torreones en las 4 esquinas
    for (const [dx, dy] of [[0, 0], [3, 0], [0, 3], [3, 3]]) { const tb = isoBox(x, ox + (dx - dy) * 32, oy + (dx + dy) * 16, 1, 1, HT, col, {lk: -0.34, rk: -0.16, tk: 0.14}); x.fillStyle = shade(col, 0.25); for (let i = 0; i < 3; i++) { const t = i / 3; x.fillRect(tb.left.x + (tb.bottom.x - tb.left.x) * t + 3, tb.left.y + (tb.bottom.y - tb.left.y) * t - HT - 4, 4, 4); x.fillRect(tb.bottom.x + (tb.right.x - tb.bottom.x) * t + 3, tb.bottom.y + (tb.right.y - tb.bottom.y) * t - HT - 4, 4, 4); } if (dx === 3 && dy === 0) banner(x, tb.top.x, tb.top.y - HT, pcol, 24); }
    // torre del homenaje
    const k = isoBox(x, ox + 8, oy + 20, 1.5, 1.5, 62, col, {lk: -0.28, rk: -0.1, tk: 0.16});
    x.fillStyle = '#2a2a30'; x.fillRect(k.bottom.x - 3, k.bottom.y - 40, 3, 7); x.fillRect(k.bottom.x + 4, k.bottom.y - 50, 3, 7);
    x.fillStyle = pcol; x.fillRect(k.bottom.x - 10, k.bottom.y - 30, 20, 10);
    banner(x, k.top.x, k.top.y - 62, pcol, 26);
    x.fillStyle = '#3a2a16'; x.fillRect(b.bottom.x - 5, b.bottom.y - 14, 10, 14);
    SPR.cache.set(key, {c, ax: ox, ay: oy}); return SPR.cache.get(key);
  }
  if (type === 'maravilla') {
    isoBox(x, ox, oy, w, h, 14, col, {tk: 0.1});
    const b = isoBox(x, ox + 8, oy + 12, 3.5, 3.5, 40, col, {lk: -0.25, rk: -0.08, tk: 0.14});
    // nave con tejado y torre-campanario
    hipRoof(x, ox + 8, oy + 12, 3.5, 3.5, 40, 18, roof);
    const t = isoBox(x, ox + 20, oy + 6, 1.2, 1.2, 76, col, {lk: -0.3, rk: -0.12, tk: 0.16});
    x.fillStyle = roof; x.beginPath(); x.moveTo(t.left.x - 2, t.left.y - 76); x.lineTo(t.top.x + 8, t.top.y - 76 - 30); x.lineTo(t.right.x + 2, t.right.y - 76); x.lineTo(t.bottom.x, t.bottom.y - 76); x.closePath(); x.fill();
    x.fillStyle = '#f0d060'; x.fillRect(t.top.x + 7, t.top.y - 76 - 42, 2, 14); x.fillRect(t.top.x + 3, t.top.y - 76 - 38, 10, 2);
    for (let i = 0; i < 3; i++) { x.fillStyle = '#2a2a40'; x.fillRect(b.bottom.x + 8 + i * 12, b.bottom.y - 28 - i * 6, 4, 10); x.fillRect(b.bottom.x - 12 - i * 12, b.bottom.y - 28 - i * 6, 4, 10); }
    x.fillStyle = '#3a2a16'; x.fillRect(b.bottom.x - 4, b.bottom.y - 16, 8, 16);
    banner(x, b.right.x, b.right.y - 40, pcol, 20);
    SPR.cache.set(key, {c, ax: ox, ay: oy}); return SPR.cache.get(key);
  }
  // edificio genérico: caja + tejado + detalles
  const b = isoBox(x, ox, oy, w, h, HT, col, {lk: -0.3, rk: -0.12, tk: 0.05});
  const withRoof = !['mina', 'aserradero', 'taller'].includes(type);
  if (withRoof) { const rf = hipRoof(x, ox, oy, w, h, HT, 10 + w * 4, roof); roofTexture(x, roof, type.length, {x: b.left.x, y: b.top.y - HT - 20, w: (w + h) * 32, h: 24}); }
  // puerta y ventanas en la cara derecha
  x.fillStyle = '#3a2a16'; x.fillRect(b.bottom.x + 6, b.bottom.y - 14 - 3, 8, 14);
  x.fillStyle = '#2a2a30'; for (let i = 1; i < w; i++) x.fillRect(b.bottom.x + 8 + i * 22, b.bottom.y - HT * 0.6 - i * 11, 4, 5);
  for (let i = 1; i < h; i++) x.fillRect(b.bottom.x - 12 - i * 22, b.bottom.y - HT * 0.6 - i * 11, 4, 5);
  if (type === 'centro') { const t = isoBox(x, ox + 32, oy + 16, 1, 1, HT + 26, col, {lk: -0.32, rk: -0.14, tk: 0.14}); x.fillStyle = shade(col, 0.25); for (let i = 0; i < 3; i++) { const k = i / 3; x.fillRect(t.left.x + (t.bottom.x - t.left.x) * k + 3, t.left.y + (t.bottom.y - t.left.y) * k - HT - 26 - 4, 4, 4); x.fillRect(t.bottom.x + (t.right.x - t.bottom.x) * k + 3, t.bottom.y + (t.right.y - t.bottom.y) * k - HT - 26 - 4, 4, 4); } banner(x, t.top.x, t.top.y - HT - 26, pcol, 26); x.fillStyle = pcol; x.fillRect(b.bottom.x - 14, b.bottom.y - HT + 6, 6, 10); x.fillRect(b.bottom.x + 20, b.bottom.y - HT + 12, 6, 10); }
  if (type === 'casa') { x.fillStyle = '#8a7a5a'; x.fillRect(b.top.x - 4, b.top.y - HT - 22, 5, 14); }
  if (type === 'molino') { x.fillStyle = '#6e5a3a'; x.fillRect(b.top.x - 3, b.top.y - HT - 30, 6, 32); }
  if (type === 'aserradero') { x.fillStyle = '#5a3d22'; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(b.left.x + 14 + i * 8, b.left.y - 6 - i * 3, 9, 3.5, -0.4, 0, 7); x.fill(); } x.fillStyle = '#8a6a3a'; x.fillRect(b.top.x - 2, b.top.y - HT - 12, 4, 12); x.fillRect(b.right.x - 10, b.right.y - HT - 12, 4, 12); x.fillRect(b.top.x - 2, b.top.y - HT - 12, 40, 3); }
  if (type === 'mina') { x.fillStyle = '#4a4038'; x.beginPath(); x.moveTo(b.bottom.x + 4, b.bottom.y - 2); x.lineTo(b.bottom.x + 14, b.bottom.y - 18); x.lineTo(b.bottom.x + 26, b.bottom.y - 8); x.closePath(); x.fill(); x.fillStyle = '#f0c94a'; x.fillRect(b.left.x + 10, b.left.y - 5, 4, 3); x.fillRect(b.left.x + 16, b.left.y - 3, 4, 3); x.fillStyle = '#b8b8c0'; x.fillRect(b.left.x + 22, b.left.y - 6, 5, 4); }
  if (type === 'taller') { x.fillStyle = '#6e5a3a'; x.fillRect(b.top.x - 30, b.top.y - HT - 2, 60, 3); x.fillStyle = '#4a4a4a'; x.fillRect(b.bottom.x - 22, b.bottom.y - HT - 4, 14, 8); x.fillStyle = '#5a3d22'; x.fillRect(b.left.x + 8, b.left.y - 4, 20, 3); }
  if (type === 'herreria') { x.fillStyle = '#444'; x.fillRect(b.right.x - 14, b.right.y - HT - 22, 6, 16); x.fillStyle = '#e0483f'; x.fillRect(b.bottom.x + 18, b.bottom.y - 16, 6, 6); x.fillStyle = '#ff9a3f'; x.fillRect(b.bottom.x + 19, b.bottom.y - 15, 4, 3); }
  if (type === 'mercado') { for (let i = 0; i < 3; i++) { x.fillStyle = i % 2 ? '#e0483f' : '#e8e2d3'; x.beginPath(); x.moveTo(b.bottom.x + 4 + i * 14, b.bottom.y - 4 - i * 7); x.lineTo(b.bottom.x + 16 + i * 14, b.bottom.y - 10 - i * 7); x.lineTo(b.bottom.x + 16 + i * 14, b.bottom.y - 16 - i * 7); x.lineTo(b.bottom.x + 4 + i * 14, b.bottom.y - 10 - i * 7); x.closePath(); x.fill(); } }
  if (type === 'monasterio') { x.fillStyle = '#f0d060'; x.fillRect(b.top.x - 1, b.top.y - HT - 40, 2, 16); x.fillRect(b.top.x - 5, b.top.y - HT - 36, 10, 2); x.fillStyle = '#2a2a40'; x.fillRect(b.bottom.x + 20, b.bottom.y - HT * 0.7, 4, 9); x.fillRect(b.bottom.x + 30, b.bottom.y - HT * 0.7 - 5, 4, 9); }
  if (type === 'universidad') { x.fillStyle = '#e8e2d3'; for (let i = 0; i < 4; i++) x.fillRect(b.bottom.x + 4 + i * 12, b.bottom.y - HT + 8 - i * 6, 3, HT - 12); }
  if (type === 'cuartel' || type === 'arqueria' || type === 'establo') { banner(x, b.right.x - 2, b.right.y - HT, pcol, 20); if (type === 'establo') { x.fillStyle = '#c9b48c'; x.fillRect(b.left.x + 6, b.left.y - 3, 24, 3); x.fillRect(b.left.x + 6, b.left.y - 9, 24, 2); } if (type === 'arqueria') { x.fillStyle = '#e8e2d3'; x.beginPath(); x.arc(b.left.x + 16, b.left.y - 8, 5, 0, 7); x.fill(); x.fillStyle = '#e0483f'; x.beginPath(); x.arc(b.left.x + 16, b.left.y - 8, 2.5, 0, 7); x.fill(); } if (type === 'cuartel') { x.fillStyle = '#c9c9d0'; x.fillRect(b.left.x + 10, b.left.y - 16, 2, 14); x.fillRect(b.left.x + 16, b.left.y - 15, 2, 13); } }
  // franja de color
  x.fillStyle = pcol; x.fillRect(b.bottom.x + 1, b.bottom.y - 4, (b.right.x - b.bottom.x) * 0.9, 2.5);
  SPR.cache.set(key, {c, ax: ox, ay: oy}); return SPR.cache.get(key);
}

// ------------------------------------------------------------ unidades
// facing: 0 = S (hacia abajo/derecha), 1 = E (derecha), 2 = N (arriba), 3 = W (espejo de E)
// anim: 'idle' | 'walk' | 'attack' | 'work' | 'dead'
function unitStyle(u, civStyle) {
  const t = u.type, d = u.def, cls = d.cls;
  const st = {cls, mounted: cls === 'cab', armor: 0, helmet: 'none', weapon: 'none', shield: false, robe: cls === 'mnk', horse: '#6b4a2b', cape: false, turban: false, veil: false, hero: !!d.hero, skin: '#e8c39e'};
  if (civStyle === 'andalusi') st.turban = true; if (civStyle === 'almoravide') st.veil = true;
  switch (t) {
    case 'aldeano': st.weapon = 'tool'; st.helmet = civStyle === 'cristiano' ? 'hood' : 'none'; break;
    case 'milicia': st.weapon = 'sword'; st.helmet = 'cap'; st.shield = true; break;
    case 'espada': st.weapon = 'sword'; st.helmet = 'nasal'; st.shield = true; st.armor = 1; break;
    case 'campeon': st.weapon = 'sword'; st.helmet = 'full'; st.shield = true; st.armor = 2; break;
    case 'lancero': st.weapon = 'spear'; st.helmet = 'cap'; break;
    case 'piquero': st.weapon = 'spear'; st.helmet = 'nasal'; st.armor = 1; break;
    case 'alabardero': st.weapon = 'halberd'; st.helmet = 'nasal'; st.armor = 1; break;
    case 'arquero': st.weapon = 'bow'; break;
    case 'ballestero': st.weapon = 'crossbow'; st.helmet = 'cap'; break;
    case 'arbalestero': st.weapon = 'crossbow'; st.helmet = 'nasal'; st.armor = 1; st.shield = true; break;
    case 'explorador': st.weapon = 'spear'; st.horse = '#8a6a4a'; break;
    case 'jinete': st.weapon = 'spear'; st.helmet = 'cap'; st.horse = '#8a6a4a'; break;
    case 'caballero': st.weapon = 'lance'; st.helmet = 'nasal'; st.armor = 1; st.shield = true; break;
    case 'paladin': st.weapon = 'lance'; st.helmet = 'full'; st.armor = 2; st.shield = true; st.horse = '#4a3a2a'; break;
    case 'caballero_villano': st.weapon = 'spear'; st.helmet = 'cap'; st.shield = true; st.horse = '#a08060'; break;
    case 'infanzon': st.weapon = 'sword'; st.helmet = 'nasal'; st.armor = 2; st.shield = true; st.cape = true; break;
    case 'almogavar': st.weapon = 'spear'; st.helmet = 'none'; st.shield = false; break;
    case 'arquero_saraqusta': st.weapon = 'bow'; st.turban = true; break;
    case 'jinete_andalusi': st.weapon = 'spear'; st.turban = true; st.horse = '#d8c8a8'; st.shield = true; break;
    case 'lamtuna': st.weapon = 'spear'; st.veil = true; st.shield = true; st.armor = 1; break;
    case 'monje': st.weapon = 'staff'; break;
    case 'rodrigo': st.weapon = 'sword'; st.helmet = 'nasal'; st.armor = 2; st.shield = true; st.cape = true; st.horse = '#e8e0d0'; break;
    case 'alvar': st.weapon = 'lance'; st.helmet = 'nasal'; st.armor = 2; st.shield = true; st.cape = true; break;
    case 'jimena': st.weapon = 'none'; st.robe = true; st.cape = true; break;
    case 'sancho': st.weapon = 'sword'; st.helmet = 'crown'; st.armor = 2; st.cape = true; st.shield = true; break;
    case 'vellido': st.weapon = 'spear'; st.helmet = 'cap'; st.horse = '#3a2a1a'; break;
    case 'berenguer': st.weapon = 'sword'; st.helmet = 'crown'; st.armor = 2; st.cape = true; st.shield = true; break;
    case 'yusuf': case 'abubakr': st.weapon = 'sword'; st.veil = true; st.armor = 2; st.cape = true; st.horse = '#d8c8a8'; break;
  }
  return st;
}
const RES_COL = {food: '#e07a4f', wood: '#8fbf5a', stone: '#b8b8c0', gold: '#f0c94a'};
function unitSprite(u, civStyle, facing, anim, frame, carry) {
  const colIdx = P(u.owner).id;
  const key = 'u' + u.type + ':' + civStyle + ':' + colIdx + ':' + facing + ':' + anim + ':' + frame + ':' + (carry || '');
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const [c, x] = mkCanvas(64, 80); const st = unitStyle(u, civStyle); const pcol = PCOLORS[colIdx], pdark = PDARK[colIdx];
  const mirror = facing === 3; const f = mirror ? 1 : 0; // dibujamos E y espejamos para W
  x.translate(32, 76); if (mirror) x.scale(-1, 1);
  const dir = facing === 3 ? 1 : facing; // 0 S, 1 E(side), 2 N
  if (u.def.cls === 'sit') { drawSiege(x, u.type, dir, anim, frame, pcol); }
  else if (anim === 'dead') { drawFallen(x, st, pcol); }
  else {
    // sombra
    x.fillStyle = '#00000038'; x.beginPath(); x.ellipse(0, 0, st.mounted ? 15 : 9, st.mounted ? 6 : 4, 0, 0, 7); x.fill();
    if (st.hero) { x.strokeStyle = '#f0c94aaa'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(0, 0, st.mounted ? 17 : 12, st.mounted ? 7 : 5, 0, 0, 7); x.stroke(); }
    let ry = 0;
    if (st.mounted) { drawHorse(x, st, dir, anim, frame); ry = -16; }
    drawFigure(x, st, pcol, pdark, dir, anim, frame, ry, st.mounted);
    if (carry && !st.mounted) { x.fillStyle = RES_COL[carry]; x.fillRect(dir === 2 ? -3 : 5, ry - 20, 6, 5); x.strokeStyle = '#0006'; x.lineWidth = 0.6; x.strokeRect(dir === 2 ? -3 : 5, ry - 20, 6, 5); }
    if (u.relic) { x.fillStyle = '#f0d060'; x.fillRect(dir === 2 ? -4 : 6, ry - 24, 6, 8); }
  }
  const sp = {c, ax: 32, ay: 76}; SPR.cache.set(key, sp); return sp;
}
function limb(x, x1, y1, x2, y2, w, col) { x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); }
function drawFigure(x, st, pcol, pdark, dir, anim, frame, ry, mounted) {
  const skin = st.skin, tunic = st.armor >= 2 ? '#b9bcc4' : pcol, tunicDark = st.armor >= 2 ? '#8a8d95' : pdark;
  const walk = anim === 'walk' || anim === 'work' ? Math.sin(frame / 4 * Math.PI * 2) : 0;
  const atk = anim === 'attack' ? frame : -1; // 0 preparar, 1 golpe, 2 recuperar
  const legs = mounted ? 0 : 1;
  const hy = ry; // altura de la cadera
  // piernas
  if (legs) {
    const la = walk * 4, lb = -walk * 4;
    if (dir === 1) { limb(x, -2, hy - 8, -2 + la, hy, 3.2, '#4a3a2a'); limb(x, 2, hy - 8, 2 + lb, hy, 3.2, '#5a4a3a'); }
    else { limb(x, -3, hy - 8, -3 + la * 0.3, hy - Math.abs(la) * 0.3, 3.2, '#4a3a2a'); limb(x, 3, hy - 8, 3 + lb * 0.3, hy - Math.abs(lb) * 0.3, 3.2, '#5a4a3a'); }
  } else { // piernas del jinete colgando
    if (dir !== 2) limb(x, 4, hy - 6, 6, hy + 4, 3, '#4a3a2a'); if (dir !== 0) limb(x, -4, hy - 6, -6, hy + 4, 3, '#4a3a2a');
  }
  // capa
  if (st.cape && dir !== 0) { x.fillStyle = shade(pcol, -0.35); x.beginPath(); x.moveTo(-5, hy - 20); x.lineTo(5, hy - 20); x.lineTo(7 + walk, hy - 2); x.lineTo(-7 - walk, hy - 2); x.closePath(); x.fill(); }
  // torso
  if (st.robe) { x.fillStyle = st.hero ? shade(pcol, 0.4) : '#e8e2d3'; x.beginPath(); x.moveTo(-6, hy); x.lineTo(6, hy); x.lineTo(4, hy - 20); x.lineTo(-4, hy - 20); x.closePath(); x.fill(); x.fillStyle = pcol; x.fillRect(-1.5, hy - 18, 3, 16); }
  else { x.fillStyle = tunic; x.beginPath(); x.roundRect(-5.5, hy - 21, 11, 14, 3); x.fill(); x.fillStyle = tunicDark; x.fillRect(-5.5, hy - 10, 11, 3); if (st.armor >= 1 && st.armor < 2) { x.fillStyle = '#9a9ea8aa'; x.fillRect(-4.5, hy - 20, 9, 8); } x.fillStyle = '#5a3d22'; x.fillRect(-5.5, hy - 9, 11, 1.5); }
  if (st.cape && dir === 0) { x.fillStyle = shade(pcol, -0.35); x.fillRect(-6.5, hy - 20, 2, 16); x.fillRect(4.5, hy - 20, 2, 16); }
  // brazos + arma
  const armCol = st.armor >= 2 ? '#9a9ea8' : skin;
  const wx = 6, wy = hy - 16; // hombro derecho
  let ax = 0, ay = 0; // desplazamiento del brazo de ataque
  if (atk === 0) { ax = -3; ay = -6; } else if (atk === 1) { ax = 7; ay = 3; } else if (atk === 2) { ax = 3; ay = -2; }
  const wk = anim === 'work' ? Math.sin(frame / 4 * Math.PI * 2) * 5 : 0;
  if (dir === 2) { // de espaldas: escudo a la espalda, arma asomando
    limb(x, -5, hy - 17, -7, hy - 8, 2.6, armCol); limb(x, 5, hy - 17, 7, hy - 8, 2.6, armCol);
    if (st.shield) { x.fillStyle = pdark; x.beginPath(); x.ellipse(-1, hy - 14, 5, 6.5, 0, 0, 7); x.fill(); x.strokeStyle = '#ddd'; x.lineWidth = 0.8; x.stroke(); }
    drawWeapon(x, st.weapon, 7, hy - 10, dir, atk, wk, pcol);
  } else {
    // brazo izquierdo (escudo)
    if (dir === 0) { limb(x, -5, hy - 17, -7 + walk, hy - 9, 2.6, armCol); if (st.shield) { x.fillStyle = pcol; x.beginPath(); x.ellipse(-7, hy - 12, 4.5, 6, 0, 0, 7); x.fill(); x.strokeStyle = '#e8e2d3'; x.lineWidth = 1; x.stroke(); x.fillStyle = '#e8e2d3'; x.fillRect(-7.7, hy - 15, 1.4, 6); } }
    else { limb(x, -2, hy - 17, -4, hy - 9, 2.6, armCol); if (st.shield) { x.fillStyle = pcol; x.beginPath(); x.ellipse(-2, hy - 12, 2.5, 6, 0, 0, 7); x.fill(); } }
    // brazo derecho con arma
    limb(x, 5, hy - 17, wx + ax + wk * 0.4, hy - 9 + ay, 2.6, armCol);
    drawWeapon(x, st.weapon, wx + ax + wk * 0.4, hy - 9 + ay, dir, atk, wk, pcol);
  }
  // cabeza
  const hx = 0, hy2 = hy - 26;
  x.fillStyle = st.veil ? '#2a3a6a' : skin; x.beginPath(); x.arc(hx, hy2, 4.6, 0, 7); x.fill();
  if (st.veil) { x.fillStyle = skin; x.fillRect(hx - 3, hy2 - 2, 6, 2.2); x.fillStyle = '#2a3a6a'; x.beginPath(); x.arc(hx, hy2 - 3, 5, Math.PI, 0); x.fill(); }
  else if (st.turban) { x.fillStyle = '#eee8dc'; x.beginPath(); x.ellipse(hx, hy2 - 3, 5.5, 3.6, 0, 0, 7); x.fill(); x.strokeStyle = '#c9c0b0'; x.lineWidth = 0.7; x.beginPath(); x.ellipse(hx, hy2 - 3.5, 4, 2, 0, 0, 7); x.stroke(); }
  else if (st.helmet === 'cap') { x.fillStyle = '#7a6a4a'; x.beginPath(); x.arc(hx, hy2 - 1, 4.8, Math.PI, 0); x.fill(); }
  else if (st.helmet === 'nasal') { x.fillStyle = '#a8acb4'; x.beginPath(); x.moveTo(hx - 5, hy2 - 1); x.lineTo(hx, hy2 - 8); x.lineTo(hx + 5, hy2 - 1); x.closePath(); x.fill(); x.fillRect(hx - 0.7, hy2 - 2, 1.4, 5); }
  else if (st.helmet === 'full') { x.fillStyle = '#a8acb4'; x.beginPath(); x.arc(hx, hy2 - 1, 5, Math.PI, 0); x.fill(); x.fillRect(hx - 5, hy2 - 1, 10, 4); x.fillStyle = '#222'; x.fillRect(hx - 3.5, hy2 - 0.5, 7, 1.2); }
  else if (st.helmet === 'crown') { x.fillStyle = '#f0d060'; x.beginPath(); x.moveTo(hx - 5, hy2 - 3); x.lineTo(hx - 5, hy2 - 8); x.lineTo(hx - 2.5, hy2 - 5); x.lineTo(hx, hy2 - 9); x.lineTo(hx + 2.5, hy2 - 5); x.lineTo(hx + 5, hy2 - 8); x.lineTo(hx + 5, hy2 - 3); x.closePath(); x.fill(); }
  else if (st.helmet === 'hood') { x.fillStyle = '#8a6a3a'; x.beginPath(); x.arc(hx, hy2 - 1, 5, Math.PI, 0); x.fill(); x.fillRect(hx - 6, hy2 - 1.5, 12, 1.8); }
  else if (st.robe && !st.hero) { x.fillStyle = '#5a3d22'; x.beginPath(); x.arc(hx, hy2 - 2, 4.6, Math.PI, 0); x.fill(); x.fillStyle = skin; x.beginPath(); x.arc(hx, hy2 - 3.5, 2, 0, 7); x.fill(); }
  else if (st.robe && st.hero) { x.fillStyle = '#e8e2d3'; x.beginPath(); x.arc(hx, hy2 - 2, 5, Math.PI, 0); x.fill(); x.fillRect(hx - 5, hy2 - 2, 10, 8); x.fillStyle = skin; x.beginPath(); x.arc(hx, hy2, 3.6, 0, 7); x.fill(); }
  else { x.fillStyle = '#3a2a1a'; x.beginPath(); x.arc(hx, hy2 - 1.5, 4.6, Math.PI, 0); x.fill(); }
  if (dir === 0 && !st.veil && st.helmet !== 'full') { x.fillStyle = '#2a1a0a'; x.fillRect(hx - 2, hy2 - 0.5, 1, 1); x.fillRect(hx + 1, hy2 - 0.5, 1, 1); }
}
function drawWeapon(x, w, px, py, dir, atk, wk, pcol) {
  const a = atk === 1 ? 0.9 : atk === 0 ? -0.6 : atk === 2 ? 0.3 : dir === 1 ? -0.2 : 0;
  x.save(); x.translate(px, py); x.rotate(a);
  switch (w) {
    case 'sword': limb(x, 0, 0, 0, -16, 2, '#dfe3ea'); limb(x, -3, -3, 3, -3, 1.6, '#8a6a3a'); break;
    case 'spear': limb(x, 0, 6, 0, -22, 1.6, '#8a6a3a'); x.fillStyle = '#dfe3ea'; x.beginPath(); x.moveTo(-1.6, -22); x.lineTo(0, -28); x.lineTo(1.6, -22); x.closePath(); x.fill(); break;
    case 'halberd': limb(x, 0, 8, 0, -24, 1.8, '#8a6a3a'); x.fillStyle = '#dfe3ea'; x.beginPath(); x.moveTo(0, -30); x.lineTo(3, -25); x.lineTo(0, -18); x.lineTo(-4, -22); x.closePath(); x.fill(); break;
    case 'lance': limb(x, 0, 10, 0, -30, 1.8, '#a08060'); x.fillStyle = '#dfe3ea'; x.beginPath(); x.moveTo(-1.5, -30); x.lineTo(0, -35); x.lineTo(1.5, -30); x.closePath(); x.fill(); x.fillStyle = pcol; x.fillRect(0, -28, 6, 3); break;
    case 'bow': x.strokeStyle = '#a8804a'; x.lineWidth = 1.6; x.beginPath(); x.arc(0, -6, 9, -1.3, 1.3); x.stroke(); x.strokeStyle = '#ddd'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(2.4, -14.7); x.lineTo(atk === 0 ? -4 : 2.4, atk === 0 ? -6 : -6); x.lineTo(2.4, 2.7); x.stroke(); break;
    case 'crossbow': limb(x, 0, 2, 0, -12, 2.4, '#6e5a3a'); limb(x, -7, -10, 7, -10, 1.6, '#a8804a'); break;
    case 'staff': limb(x, 0, 8, 0, -22, 1.6, '#8a6a3a'); x.fillStyle = '#f0d060'; x.fillRect(-2.5, -25, 5, 1.6); x.fillRect(-0.8, -28, 1.6, 7); break;
    case 'tool': limb(x, 0, 4, 0, -12 - wk * 0.6, 1.6, '#8a6a3a'); x.fillStyle = '#9a9ea8'; x.fillRect(-4, -14 - wk * 0.6, 8, 2.4); break;
  }
  x.restore();
}
function drawHorse(x, st, dir, anim, frame) {
  const col = st.horse, dark = shade(col, -0.3);
  const gal = anim === 'walk' ? Math.sin(frame / 4 * Math.PI * 2) : 0;
  const bob = anim === 'walk' ? Math.abs(gal) * 1.5 : 0;
  if (dir === 1) {
    // patas
    limb(x, -8, -8 - bob, -10 - gal * 4, 0, 3, dark); limb(x, -5, -8 - bob, -4 + gal * 4, 0, 3, col); limb(x, 6, -8 - bob, 5 - gal * 4, 0, 3, dark); limb(x, 9, -8 - bob, 11 + gal * 4, 0, 3, col);
    x.fillStyle = col; x.beginPath(); x.ellipse(0, -13 - bob, 14, 6.5, 0, 0, 7); x.fill();
    x.fillStyle = dark; x.beginPath(); x.moveTo(-13, -14 - bob); x.quadraticCurveTo(-18, -10, -17, -2); x.quadraticCurveTo(-15, -8, -12, -10); x.fill(); // cola
    x.fillStyle = col; x.beginPath(); x.moveTo(10, -16 - bob); x.lineTo(19, -24 - bob); x.lineTo(22, -18 - bob); x.lineTo(15, -12 - bob); x.closePath(); x.fill(); // cuello
    x.fillStyle = shade(col, 0.05); x.beginPath(); x.ellipse(22, -22 - bob, 5.5, 3.5, 0.4, 0, 7); x.fill(); // cabeza
    x.fillStyle = dark; x.fillRect(19, -27 - bob, 2, 3); x.fillRect(16, -26 - bob, 2, 3); x.fillRect(12, -22 - bob, 6, 2);
    x.fillStyle = shade(st.horse, -0.5); x.fillRect(-4, -18 - bob, 9, 3); // silla
  } else if (dir === 0) {
    limb(x, -6, -8 - bob, -7 - gal * 2, 0, 3, dark); limb(x, 6, -8 - bob, 7 + gal * 2, 0, 3, col); limb(x, -3, -10 - bob, -3, -3, 2.6, dark); limb(x, 3, -10 - bob, 3, -3, 2.6, col);
    x.fillStyle = col; x.beginPath(); x.ellipse(0, -14 - bob, 8, 9, 0, 0, 7); x.fill();
    x.fillStyle = col; x.beginPath(); x.moveTo(-5, -20 - bob); x.lineTo(5, -20 - bob); x.lineTo(4, -26 - bob); x.lineTo(-4, -26 - bob); x.closePath(); x.fill();
    x.fillStyle = shade(col, 0.05); x.beginPath(); x.ellipse(0, -26 - bob, 4.5, 6, 0, 0, 7); x.fill(); x.fillStyle = dark; x.fillRect(-4, -31 - bob, 2, 3); x.fillRect(2, -31 - bob, 2, 3); x.fillStyle = '#222'; x.fillRect(-2, -27 - bob, 1, 1); x.fillRect(1, -27 - bob, 1, 1);
  } else {
    limb(x, -6, -8 - bob, -7 - gal * 2, 0, 3, dark); limb(x, 6, -8 - bob, 7 + gal * 2, 0, 3, col);
    x.fillStyle = col; x.beginPath(); x.ellipse(0, -14 - bob, 8, 9, 0, 0, 7); x.fill();
    x.fillStyle = dark; x.beginPath(); x.moveTo(-3, -10 - bob); x.quadraticCurveTo(0, -2, 3, -10 - bob); x.fill();
    x.fillStyle = col; x.beginPath(); x.moveTo(-4, -20 - bob); x.lineTo(4, -20 - bob); x.lineTo(3, -28 - bob); x.lineTo(-3, -28 - bob); x.closePath(); x.fill(); x.fillStyle = dark; x.fillRect(-3, -31 - bob, 2, 3); x.fillRect(1, -31 - bob, 2, 3);
  }
}
function drawFallen(x, st, pcol) {
  x.fillStyle = '#00000030'; x.beginPath(); x.ellipse(0, -1, 14, 5, 0, 0, 7); x.fill();
  x.save(); x.rotate(Math.PI / 2 * 0.95); x.translate(0, 8);
  x.fillStyle = pcol; x.beginPath(); x.roundRect(-5, -14, 10, 12, 3); x.fill(); x.fillStyle = st.skin; x.beginPath(); x.arc(0, -19, 4.2, 0, 7); x.fill(); limb(x, -3, -3, -4, 6, 3, '#4a3a2a'); limb(x, 3, -3, 4, 6, 3, '#5a4a3a');
  x.restore();
  if (st.mounted) { x.fillStyle = st.horse; x.beginPath(); x.ellipse(10, -4, 14, 5, 0.1, 0, 7); x.fill(); }
}
function drawSiege(x, type, dir, anim, frame, pcol) {
  x.fillStyle = '#00000038'; x.beginPath(); x.ellipse(0, 0, 16, 7, 0, 0, 7); x.fill();
  const roll = anim === 'walk' ? frame : 0;
  const wheel = (wx, wy) => { x.fillStyle = '#3a2a16'; x.beginPath(); x.ellipse(wx, wy, dir === 1 ? 5 : 3, 5, 0, 0, 7); x.fill(); x.strokeStyle = '#8a6a3a'; x.lineWidth = 1; x.beginPath(); x.moveTo(wx, wy - 4); x.lineTo(wx, wy + 4); x.moveTo(wx - 4, wy); x.lineTo(wx + 4, wy); x.stroke(); };
  if (type === 'ariete') {
    x.fillStyle = '#6e5a3a'; x.beginPath(); x.moveTo(-14, -6); x.lineTo(0, -20); x.lineTo(14, -6); x.closePath(); x.fill(); x.fillStyle = '#5a3d22'; x.fillRect(-16, -8, 32, 4);
    x.fillStyle = '#4a3a2a'; x.fillRect(-18, -6, 36, 3); x.fillStyle = '#9a9ea8'; x.fillRect(dir === 2 ? -20 : 16, -8, 5, 6);
    wheel(-10, -2); wheel(10, -2);
    x.fillStyle = pcol; x.fillRect(-4, -18, 8, 3);
  } else {
    x.fillStyle = '#7a5a36'; x.fillRect(-12, -10, 24, 7); x.fillStyle = '#5a3d22'; x.fillRect(-13, -11, 26, 2);
    wheel(-9, -3); wheel(9, -3);
    const arm = anim === 'attack' ? (frame === 0 ? -1.2 : frame === 1 ? 0.3 : -0.4) : -1.0;
    x.save(); x.translate(-4, -11); x.rotate(arm); limb(x, 0, 0, 0, type === 'trabuco' ? -30 : -22, 2.6, '#c9b48a'); if (type === 'trabuco') { x.fillStyle = '#4a4a4a'; x.fillRect(-4, 4, 8, 6); } x.fillStyle = '#555'; x.beginPath(); x.arc(0, type === 'trabuco' ? -30 : -22, 3, 0, 7); x.fill(); x.restore();
    x.fillStyle = '#8a6a3a'; x.fillRect(-1, -22, 2, 12); x.fillStyle = pcol; x.fillRect(-6, -9, 12, 3);
  }
}
// iconos para la interfaz
function iconCanvas(kind, id, colIdx, size = 40) {
  const key = 'icon' + kind + ':' + id + ':' + colIdx + ':' + size;
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size * 2; const x = c.getContext('2d'); x.scale(2, 2);
  x.fillStyle = '#1a1410'; x.fillRect(0, 0, size, size);
  const grad = x.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size); grad.addColorStop(0, '#3a3024'); grad.addColorStop(1, '#151009'); x.fillStyle = grad; x.fillRect(0, 0, size, size);
  if (kind === 'unit') {
    const fake = {type: id, def: UNITS[id], owner: colIdx, relic: false};
    const civStyle = 'cristiano';
    const sp = unitSprite(fake, civStyle, 0, 'idle', 0);
    const sc = size / 44; x.drawImage(sp.c, size / 2 - 32 * sc, size - 4 - 76 * sc + 12 * sc, 64 * sc, 80 * sc);
  } else if (kind === 'bld') {
    const sp = buildingSprite(id, colIdx, 3, 15);
    const sc = Math.min((size - 4) / (sp.c.width / ISO.S), (size - 4) / (sp.c.height / ISO.S));
    x.drawImage(sp.c, size / 2 - sp.c.width / ISO.S * sc / 2, size / 2 - sp.c.height / ISO.S * sc / 2 + 2, sp.c.width / ISO.S * sc, sp.c.height / ISO.S * sc);
  } else if (kind === 'tech') {
    x.fillStyle = '#d9a441'; x.font = 'bold 16px serif'; x.textAlign = 'center'; x.fillText(id, size / 2, size / 2 + 6);
  } else if (kind === 'cmd') {
    x.strokeStyle = '#e8e2d3'; x.lineWidth = 2.2; x.lineCap = 'round'; const s = size;
    const P_ = (pts) => { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0] * s, p[1] * s) : x.moveTo(p[0] * s, p[1] * s)); x.stroke(); };
    switch (id) {
      case 'attack': P_([[0.25, 0.75], [0.7, 0.3]]); P_([[0.6, 0.2], [0.8, 0.4]]); P_([[0.3, 0.6], [0.4, 0.7]]); break;
      case 'stop': x.fillStyle = '#e0483f'; x.beginPath(); x.rect(s * 0.3, s * 0.3, s * 0.4, s * 0.4); x.fill(); break;
      case 'patrol': P_([[0.25, 0.5], [0.75, 0.5]]); P_([[0.6, 0.35], [0.75, 0.5], [0.6, 0.65]]); P_([[0.4, 0.35], [0.25, 0.5], [0.4, 0.65]]); break;
      case 'guard': P_([[0.5, 0.2], [0.75, 0.3], [0.7, 0.6], [0.5, 0.8], [0.3, 0.6], [0.25, 0.3], [0.5, 0.2]]); break;
      case 'garrison': P_([[0.25, 0.5], [0.5, 0.25], [0.75, 0.5]]); P_([[0.35, 0.5], [0.35, 0.78], [0.65, 0.78], [0.65, 0.5]]); P_([[0.5, 0.78], [0.5, 0.6]]); break;
      case 'ungarrison': P_([[0.35, 0.3], [0.35, 0.75], [0.65, 0.75], [0.65, 0.3]]); P_([[0.5, 0.35], [0.5, 0.7]]); P_([[0.4, 0.45], [0.5, 0.35], [0.6, 0.45]]); break;
      case 'repair': P_([[0.3, 0.7], [0.6, 0.4]]); x.fillStyle = '#e8e2d3'; x.beginPath(); x.arc(s * 0.65, s * 0.35, s * 0.12, 0, 7); x.fill(); break;
      case 'kill': x.strokeStyle = '#e0483f'; P_([[0.3, 0.3], [0.7, 0.7]]); P_([[0.7, 0.3], [0.3, 0.7]]); break;
      case 'rally': P_([[0.35, 0.8], [0.35, 0.2]]); x.fillStyle = '#d9a441'; x.beginPath(); x.moveTo(s * 0.35, s * 0.2); x.lineTo(s * 0.7, s * 0.32); x.lineTo(s * 0.35, s * 0.45); x.fill(); break;
      case 'heal': x.strokeStyle = '#5fbf6a'; P_([[0.5, 0.25], [0.5, 0.75]]); P_([[0.25, 0.5], [0.75, 0.5]]); break;
      case 'convert': x.strokeStyle = '#d9a441'; x.beginPath(); x.arc(s * 0.5, s * 0.5, s * 0.22, 0, 5); x.stroke(); P_([[0.62, 0.3], [0.72, 0.28], [0.7, 0.4]]); break;
      case 'agg': x.strokeStyle = '#e0483f'; P_([[0.3, 0.7], [0.7, 0.3]]); P_([[0.5, 0.3], [0.7, 0.3], [0.7, 0.5]]); break;
      case 'def': x.strokeStyle = '#5fbf6a'; P_([[0.5, 0.2], [0.75, 0.3], [0.7, 0.6], [0.5, 0.8], [0.3, 0.6], [0.25, 0.3], [0.5, 0.2]]); P_([[0.4, 0.5], [0.5, 0.6], [0.65, 0.4]]); break;
      case 'hold': x.strokeStyle = '#b8b8c0'; P_([[0.3, 0.35], [0.7, 0.35]]); P_([[0.3, 0.5], [0.7, 0.5]]); P_([[0.3, 0.65], [0.7, 0.65]]); break;
      case 'age': x.strokeStyle = '#d9a441'; P_([[0.25, 0.7], [0.5, 0.25], [0.75, 0.7]]); P_([[0.35, 0.7], [0.65, 0.7]]); break;
      case 'buy': x.fillStyle = '#f0c94a'; x.beginPath(); x.arc(s * 0.5, s * 0.5, s * 0.18, 0, 7); x.fill(); x.strokeStyle = '#5fbf6a'; P_([[0.5, 0.15], [0.5, 0.3]]); P_([[0.42, 0.22], [0.5, 0.15], [0.58, 0.22]]); break;
      case 'sell': x.fillStyle = '#f0c94a'; x.beginPath(); x.arc(s * 0.5, s * 0.5, s * 0.18, 0, 7); x.fill(); x.strokeStyle = '#e0483f'; P_([[0.5, 0.75], [0.5, 0.9]]); P_([[0.42, 0.83], [0.5, 0.9], [0.58, 0.83]]); break;
      case 'gate': P_([[0.3, 0.75], [0.3, 0.35], [0.5, 0.2], [0.7, 0.35], [0.7, 0.75]]); P_([[0.5, 0.75], [0.5, 0.45]]); break;
      case 'delete': x.strokeStyle = '#e0483f'; P_([[0.25, 0.7], [0.75, 0.7]]); P_([[0.35, 0.7], [0.5, 0.3], [0.65, 0.7]]); break;
      case 'cancel': x.strokeStyle = '#e0483f'; x.beginPath(); x.arc(s * 0.5, s * 0.5, s * 0.22, 0, 7); x.stroke(); P_([[0.35, 0.35], [0.65, 0.65]]); break;
    }
  }
  x.strokeStyle = '#6a5a3a'; x.lineWidth = 1.5; x.strokeRect(0.75, 0.75, size - 1.5, size - 1.5);
  SPR.cache.set(key, c); return c;
}
