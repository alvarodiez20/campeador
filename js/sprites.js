// ============================================================ SPRITES PROCEDURALES (isométrico 2:1)
// Todo el arte se genera en tiempo de carga con Canvas 2D y se guarda en caché.
const ISO = {TW: 64, TH: 32, S: 3}; // ancho/alto de rombo (px de mundo → 1 tile = 32 px de mundo) y sobremuestreo de sprites
const SPR = {cache: new Map(), water: []};
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w * ISO.S); c.height = Math.ceil(h * ISO.S); const x = c.getContext('2d'); x.scale(ISO.S, ISO.S); x.lineJoin = 'round'; return [c, x]; }
function shade(hex, k) { // aclara (k>0) u oscurece (k<0) un color #rrggbb
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
function srng(seed) { return mulberry(seed); }

// ------------------------------------------------------------ puente con el arte pintado (window.CidArt)
// CidArt genera el arte definitivo (terreno, edificios por reino, unidades e iconos); aquí solo se adapta
// a las firmas que ya usan render.js y ui.js: mismo anclaje, misma caché, mismos tamaños lógicos.
const ART = window.CidArt;
const ART_TNAME = {[T_GRASS]: 'grass', [T_WATER]: 'water', [T_TREE]: 'tree', [T_BERRY]: 'berry', [T_STONE]: 'stone', [T_GOLD]: 'gold', [T_FARM]: 'farm', [T_SAND]: 'sand', [T_DIRT]: 'dirt', [T_FLOWER]: 'flower', [T_SHALLOW]: 'shallow'};
const FAM_TNAME = {water: 'water', shallow: 'shallow', sand: 'sand', dirt: 'dirt', farm: 'farm', grass: 'grass'};
function civKeyOf(owner) { const p = typeof G !== 'undefined' && G && G.players ? G.players[owner] : null; return p && ART.CIV_STYLE[p.civ] ? p.civ : 'castilla'; }

// ------------------------------------------------------------ terreno
const FAMILY = t => t === T_WATER ? 'water' : t === T_SHALLOW ? 'shallow' : t === T_SAND ? 'sand' : t === T_DIRT || t === T_STONE || t === T_GOLD ? 'dirt' : t === T_FARM ? 'farm' : 'grass';
function diamondPath(x, cx, cy, w, h) { x.beginPath(); x.moveTo(cx, cy - h / 2); x.lineTo(cx + w / 2, cy); x.lineTo(cx, cy + h / 2); x.lineTo(cx - w / 2, cy); x.closePath(); }
// rombo 64x32 con textura; `nb` = familias de los 4 vecinos [N(-y), E(+x), S(+y), W(-x)] para mezclar bordes
function terrainTile(type, variant, nbKey, nb) {
  const key = 't' + type + ':' + variant + ':' + nbKey;
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const c = ART.terrainTile(ART_TNAME[type] || 'grass', variant); const x = c.getContext('2d');
  const cx = 32, cy = 19, fam = FAMILY(type);
  // mezcla con vecinos de otra familia (se conserva del render original)
  if (nb && fam !== 'water' && fam !== 'shallow') {
    x.save(); diamondPath(x, cx, cy, 64, 32); x.clip();
    const edges = [[cx, cy - 16, cx + 32, cy], [cx + 32, cy, cx, cy + 16], [cx, cy + 16, cx - 32, cy], [cx - 32, cy, cx, cy - 16]]; // N-E, E-S, S-W, W-N
    const map = [3, 0, 1, 2]; // vecino N en W-N, E en N-E, S en E-S, W en S-W
    nb.forEach((f, i) => {
      if (!f || f === fam) return;
      let col = ART.TERRAIN[FAM_TNAME[f] || 'grass'];
      if (f === 'water' || f === 'shallow') col = fam === 'sand' ? '#b9c9a6' : '#8fb08a'; // orilla húmeda
      const [ax, ay, bx, by] = edges[map[i]];
      const g = x.createLinearGradient((ax + bx) / 2, (ay + by) / 2, cx, cy);
      g.addColorStop(0, col + 'cc'); g.addColorStop(0.45, col + '00');
      x.fillStyle = g; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.lineTo(cx, cy); x.closePath(); x.fill();
    });
    x.restore();
  }
  SPR.cache.set(key, c); return c;
}
// ------------------------------------------------------------ objetos del terreno (árboles, minas, bayas)
function treeSprite(variant, k, palm) {
  const kk = Math.round(k * 3) / 3;
  const key = 'tree' + variant + ':' + Math.round(k * 3) + (palm ? ':p' : '');
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const c = palm ? ART.palmSvg() : ART.treeSvg(variant, kk);
  SPR.cache.set(key, c); return c;
}
function bushSprite(k) {
  const key = 'bush' + Math.round(k * 3);
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const c = ART.bushSvg(Math.round(k * 3) / 3);
  SPR.cache.set(key, c); return c;
}
function rockSprite(gold, k) {
  const key = (gold ? 'gold' : 'rock') + Math.round(k * 3);
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const c = ART.rockSvg(gold, Math.round(k * 3) / 3);
  SPR.cache.set(key, c); return c;
}
function relicSprite() {
  if (SPR.cache.has('relic')) return SPR.cache.get('relic');
  const [c, x] = ART.mk(32, 40);
  ART.shadowBlob(x, 16, 35, 9, 4, 0.5);
  ART.face(x, [[9, 34], [23, 34], [23, 15], [9, 15]], '#b8912e', {k: 0, seed: 4, amp: 0.2, dab: 3});
  ART.face(x, [[7, 15], [25, 15], [23, 11], [9, 11]], '#8a6a1a', {k: 0.1, seed: 6, amp: 0.2});
  x.fillStyle = '#f0d060'; x.fillRect(11, 17, 10, 15); x.strokeStyle = 'rgba(60,40,5,.7)'; x.lineWidth = 0.7; x.strokeRect(11, 17, 10, 15);
  x.fillStyle = '#efe6d4'; x.fillRect(15.2, 19, 1.8, 11.5); x.fillRect(12.4, 22.4, 7.4, 1.8);
  for (const [px, py] of [[11, 15], [21, 15], [11, 34], [21, 34]]) ART.dab(x, px, py, 1.3, '#f7e39a');
  ART.dab(x, 16, 9.5, 2.2, '#f0d060'); ART.dab(x, 16, 9, 1, '#fff8d0');
  const g = x.createRadialGradient(16, 22, 2, 16, 22, 18); g.addColorStop(0, 'rgba(255,225,140,.35)'); g.addColorStop(1, 'rgba(255,225,140,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 40);
  SPR.cache.set('relic', c); return c;
}

// ------------------------------------------------------------ edificios
function buildingSprite(type, owner, stage, mask = 0, extra = '') {
  const civ = civKeyOf(owner), colIdx = owner & 3;
  const key = 'b' + type + ':' + civ + ':' + colIdx + ':' + stage + ':' + mask + ':' + extra;
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const sail = /s(\d)/.exec(extra); 
  const sp = stage < 3 ? constructionSprite(type, civ, stage)
    : ART.buildingSprite(type, civ, colIdx, {mask, closed: extra.includes('closed'), sail: sail ? +sail[1] * (Math.PI / 16) : 0});
  SPR.cache.set(key, sp); return sp;
}
// obra en curso: solar removido, muros a media altura en el estilo del reino, andamio, pluma y materiales
function constructionSprite(type, civ, stage) {
  const s = ART.CIV_STYLE[civ] || ART.CIV_STYLE.castilla; const [w, h, HT] = ART.BDEF[type];
  const TW = 32, TH = 16; const topPad = HT + 74, W = (w + h) * TW + 24, H = (w + h) * TH + topPad + 12;
  const [c, x] = ART.mk(W, H); const ox = h * TW + 12, oy = topPad; const cor = ART.corners(ox, oy, w, h);
  const pts = [cor.top, cor.right, cor.bottom, cor.left];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const inner = (a, b) => [cor.left[0] + (cor.top[0] - cor.left[0]) * a + (cor.bottom[0] - cor.left[0]) * b, cor.left[1] + (cor.top[1] - cor.left[1]) * a + (cor.bottom[1] - cor.left[1]) * b];
  // sombra del solar y tierra removida
  x.globalAlpha = 0.3; x.fillStyle = '#000'; ART.path(x, pts.map(p => [p[0] + 5, p[1] + 4])); x.fill(); x.globalAlpha = 1;
  ART.face(x, pts, '#6d5029', {k: 0, seed: 5, amp: 0.28, dab: 3});
  const r = srng(stage * 7 + w * 13 + type.length);
  for (let i = 0; i < 30; i++) { const p = inner(r(), r()); ART.dab(x, p[0], p[1], 0.9 + r() * 1.7, r() < 0.5 ? '#5f4728' : '#a2854f', 0.85); }
  // zanja de cimentación
  x.strokeStyle = 'rgba(30,18,8,.5)'; x.lineWidth = 2.4; ART.path(x, [inner(0.12, 0.12), inner(0.88, 0.12), inner(0.88, 0.88), inner(0.12, 0.88)]); x.stroke();
  const frac = [0.3, 0.56, 0.82][stage];
  const ht = Math.max(6, HT * frac);
  if (HT > 4) ART.box(x, ox, oy, w, h, ht, s, {noTop: true, ao: 5, seed: 11});
  // andamio: postes en las esquinas, dos hiladas de travesaños y tablones
  const sh = Math.max(15, ht + 9);
  for (const p of pts) ART.post(x, p, sh, s.timber, 2.2);
  for (let k = 1; k <= 2; k++) { const y = sh * k / 3;
    x.strokeStyle = 'rgba(30,15,5,.75)'; x.lineWidth = 2.4; ART.path(x, pts.map(p => [p[0], p[1] - y])); x.stroke();
    x.strokeStyle = ART.shade(s.timber, 0.28); x.lineWidth = 1.3; x.stroke(); }
  for (let i = 0; i < 3; i++) { const t = (i + 0.5) / 3; const a = lerp2(cor.bottom, cor.right, t);
    x.fillStyle = ART.shade(s.timber, i % 2 ? 0.18 : -0.02); x.fillRect(a[0] - 4, a[1] - sh * 2 / 3 - 1.8, 8, 2); x.strokeStyle = 'rgba(30,15,5,.6)'; x.lineWidth = 0.5; x.strokeRect(a[0] - 4, a[1] - sh * 2 / 3 - 1.8, 8, 2); }
  // pluma de obra en los edificios grandes
  if (w >= 3) { const b0 = lerp2(cor.left, cor.top, 0.25); ART.post(x, b0, sh + 14, s.timber, 3);
    x.strokeStyle = 'rgba(30,15,5,.8)'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(b0[0], b0[1] - sh - 12); x.lineTo(b0[0] + 20, b0[1] - sh - 24); x.stroke();
    x.strokeStyle = ART.shade(s.timber, 0.2); x.lineWidth = 1.9; x.stroke();
    x.strokeStyle = '#c9b48a'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(b0[0] + 20, b0[1] - sh - 24); x.lineTo(b0[0] + 20, b0[1] - sh - 6); x.stroke();
    ART.face(x, [[b0[0] + 16, b0[1] - sh - 6], [b0[0] + 24, b0[1] - sh - 8], [b0[0] + 24, b0[1] - sh - 2], [b0[0] + 16, b0[1] - sh]], s.wall, {k: -0.1, seed: 13, amp: 0.12}); }
  // sillares y montones de material al pie
  for (let i = 0; i < 3; i++) { const p = lerp2(cor.left, cor.bottom, 0.25 + i * 0.22);
    ART.face(x, [[p[0] - 5, p[1] + 1], [p[0] + 1, p[1] - 2], [p[0] + 1, p[1] - 7], [p[0] - 5, p[1] - 4]], s.wall, {k: -0.12, seed: 20 + i, amp: 0.12});
    ART.face(x, [[p[0] + 1, p[1] - 2], [p[0] + 7, p[1] + 1], [p[0] + 7, p[1] - 4], [p[0] + 1, p[1] - 7]], s.wall, {k: -0.3, seed: 24 + i, amp: 0.12}); }
  const q = lerp2(cor.bottom, cor.right, 0.7); ART.dab(x, q[0], q[1] - 2, 3.6, '#9a9ea8', 0.95); ART.dab(x, q[0] + 5, q[1], 2.8, '#8a8e98', 0.95); ART.dab(x, q[0] - 4, q[1] + 1, 2.2, '#b0b4bc', 0.9);
  return {c, ax: ox, ay: oy};
}
// ------------------------------------------------------------ unidades
const RES_COL = {food: '#e07a4f', wood: '#8fbf5a', stone: '#b8b8c0', gold: '#f0c94a'};
// ------------------------------------------------------------ poses de animación
// El arte no trae fotogramas: se le pasa una pose y genera ese instante. Los fotogramas se
// canonizan (en un ciclo de paso, el 0 y el 2 son la misma pose) para no llenar la caché.
const RANGED = {bow: 1, crossbow: 1}, THRUST = {spear: 1, lance: 1, halberd: 1};
function poseOf(anim, frame, type) {
  const w = (ART.USTYLE[type] || {}).weapon;
  if (anim === 'walk') {
    const ph = [0, 1, 0, 2][frame & 3], d = ph === 0 ? 0 : ph === 1 ? 4.2 : -4.2;
    return {k: 'w' + ph, leg: [d, -d], lift: ph ? 1.6 : 0, bob: ph ? 0 : -1.8, sw: d * 0.05, h: d, hb: ph ? 0 : -1.6};
  }
  // Signo del giro (medido, no deducido): negativo lleva el arma al frente, positivo la carga atrás.
  if (anim === 'work') { // recolectar, construir, reparar: alza la herramienta y descarga el golpe
    const ph = [0, 1, 2, 1][frame & 3], sw = [1.3, 0.2, -1.3][ph];
    return {k: 'k' + ph, leg: [-1.2, 1.2], sw, bob: [-0.9, 0, 1.3][ph], wx: [-0.5, 0, 1.2][ph], lean: [-0.8, 0, 2.4][ph]};
  }
  if (anim === 'attack') { // el fotograma 0 es el impacto; el 2, el arma ya cargada para el siguiente
    const ph = frame % 3;
    // de tajo gira sobre el hombro; de asta va calada y estoca; a distancia tensa y suelta
    const sw = THRUST[w] ? [-1.55, -1.3, -1.05][ph] : RANGED[w] ? [-0.2, 0, 0.25][ph] : [-1.4, 0, 1.2][ph];
    const wx = THRUST[w] ? [3, 0.5, -1.5][ph] : RANGED[w] ? [2.5, 0.5, -2][ph] : [1, 0, -0.5][ph];
    return {k: 'a' + ph, leg: [-1.6, 1.6], sw, wx, bob: [0.9, 0, -0.8][ph], lean: [3, 1, -1.5][ph], h: [2, 0, -2][ph], hb: [0.6, 0, -0.8][ph]};
  }
  return {k: 'i'};
}

// El arte pintado tiene vista frontal y de perfil; la pose de cada fotograma se genera aparte
function unitSprite(u, civStyle, facing, anim, frame, carry) {
  const colIdx = P(u.owner).id, civ = civKeyOf(u.owner);
  const side = facing === 1 || facing === 3, mirror = facing === 3;
  const res = carry || '', pose = anim === 'dead' ? {k: 'd'} : poseOf(anim, frame, u.type);
  const key = 'u' + u.type + ':' + civ + ':' + colIdx + ':' + (anim === 'dead' ? 'd' : side ? 's' : 'f') + (mirror ? 'm' : '') + ':' + pose.k + ':' + res + (u.relic ? ':r' : '');
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  const base = ART.unitSprite(u.type, civ, colIdx, anim === 'dead' ? true : side, anim === 'dead' ? null : pose);
  let sp;
  if (anim === 'dead') { // el caído se tumba sobre el sprite de perfil
    const [c, x] = mkCanvas(64, 80);
    x.translate(30, 73); x.rotate(-1.28); x.globalAlpha = 0.92; x.drawImage(base.c, -32, -76, 64, 80);
    sp = {c, ax: 32, ay: 76};
  } else if (!mirror && !res && !u.relic) { sp = base; }
  else {
    const [c, x] = mkCanvas(64, 80);
    if (mirror) { x.translate(64, 0); x.scale(-1, 1); }
    x.drawImage(base.c, 0, 0, 64, 80);
    if (mirror) { x.scale(-1, 1); x.translate(-64, 0); }
    const mounted = !!(ART.USTYLE[u.type] || {}).mounted;
    if (res && !mounted) { const px = side ? (mirror ? 21 : 37) : 38, py = 54 + (pose.bob || 0); // fardo al hombro
      x.fillStyle = RES_COL[res]; x.fillRect(px, py, 7, 6); x.strokeStyle = 'rgba(30,15,5,.7)'; x.lineWidth = 0.8; x.strokeRect(px, py, 7, 6); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(px + 0.8, py + 0.8, 5.4, 1.6); }
    if (u.relic) { x.fillStyle = '#c9a23a'; x.fillRect(24, 46, 7, 10); x.fillStyle = '#f0d060'; x.fillRect(25.2, 47.2, 4.6, 7.6); x.fillStyle = '#fff'; x.fillRect(27.2, 48.4, 1.2, 6); x.fillRect(25.6, 50.6, 4.4, 1.2); }
    sp = {c, ax: 32, ay: 76};
  }
  sp.lean = pose.lean || 0;
  SPR.cache.set(key, sp); return sp;
}
function iconCanvas(kind, id, colIdx, size = 40) {
  const key = 'icon' + kind + ':' + id + ':' + colIdx + ':' + size;
  if (SPR.cache.has(key)) return SPR.cache.get(key);
  if (kind === 'cmd') { const c = ART.iconSvg(id, size); SPR.cache.set(key, c); return c; }
  const [c, x] = ART.mk(size, size);
  // fondo de latón grabado, igual que los iconos de mando
  const g = x.createRadialGradient(size * 0.5, size * 0.4, 2, size * 0.5, size * 0.5, size * 0.7); g.addColorStop(0, '#4a3d2c'); g.addColorStop(1, '#1b150e'); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const r = srng(id.length * 13 + size); for (let i = 0; i < 120; i++) { x.globalAlpha = 0.13; x.fillStyle = r() < 0.5 ? '#fff' : '#000'; x.fillRect(r() * size, r() * size, 1 + r() * 2, 1); } x.globalAlpha = 1;
  if (kind === 'unit') {
    const civ = civKeyOf(colIdx); const sp = ART.unitSprite(id, civ, (colIdx | 0) & 3, false);
    const sc = size / 46; x.drawImage(sp.c, size / 2 - 32 * sc, size - 3 - 76 * sc + 10 * sc, 64 * sc, 80 * sc);
  } else if (kind === 'bld') {
    const civ = civKeyOf(colIdx); const sp = ART.buildingSprite(id, civ, (colIdx | 0) & 3, {mask: 15});
    const lw = sp.c.width / ART.S, lh = sp.c.height / ART.S;
    const sc = Math.min((size - 4) / lw, (size - 4) / lh) * 1.15;
    x.drawImage(sp.c, size / 2 - lw * sc / 2, size / 2 - lh * sc / 2 + size * 0.12, lw * sc, lh * sc);
  } else if (kind === 'tech') {
    x.fillStyle = '#e7c46a'; x.font = `bold ${Math.round(size * 0.44)}px Cinzel, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(id, size / 2, size * 0.54);
  }
  x.strokeStyle = '#8a7248'; x.lineWidth = 1.5; x.strokeRect(0.75, 0.75, size - 1.5, size - 1.5);
  x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 1; x.strokeRect(2.5, 2.5, size - 5, size - 5);
  SPR.cache.set(key, c); return c;
}
