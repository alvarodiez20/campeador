// ============================================================ RENDER ISOMÉTRICO
const $ = s => document.querySelector(s);
const cv = $('#game'), ctx = cv.getContext('2d');
const mm = $('#minimap'), mctx = mm.getContext('2d');
const UI = {selected: [], cam: {x: 0, y: 0, z: 1}, mouse: {x: 0, y: 0, in: false, down: false, sx: 0, sy: 0, drag: false, btn: 0}, placing: null, mode: null, keys: {}, hover: null, lastClick: 0, lastClickId: -1, wallDrag: null, lastSel: '', mmT: 0, chunks: new Map(), chunkT: 0, fogCanvas: null, mmBase: null};
const BLD_HT = {centro: 60, casa: 34, molino: 56, aserradero: 30, mina: 28, granja: 4, cuartel: 52, arqueria: 50, establo: 44, taller: 30, herreria: 44, mercado: 40, monasterio: 72, universidad: 52, torre: 66, muralla: 34, puerta: 38, castillo: 90, maravilla: 150};
const PANEL_H = 176, TOP_H = 44;
// El lienzo se dibuja a la resolución real del monitor: VW/VH son píxeles CSS (lo que mide la
// ventana) y DPR el factor del dispositivo. Sin esto, en cualquier pantalla retina o con
// escalado del sistema el navegador estira el lienzo y se pierde el detalle de los sprites.
let VW = 0, VH = 0, DPR = 0, DPR_MAX = 1;
let SHX = 0, SHY = 0; // sacudida de cámara (solo dibujo: no mueve la cámara real ni el ratón)
const MM = {w: 228, h: 140}; // tamaño CSS del minimapa
function resize() {
  DPR_MAX = Math.min(devicePixelRatio || 1, 2); // por encima de 2 el coste no compensa
  if (!DPR) DPR = DPR_MAX;                      // primer arranque: a la resolución del monitor
  DPR = Math.min(DPR, DPR_MAX);                 // adaptRes puede haberla bajado
  VW = innerWidth; VH = innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (mm.clientWidth > 10) { MM.w = mm.clientWidth; MM.h = mm.clientHeight; } // caja de contenido, sin el borde
  mm.width = Math.round(MM.w * DPR); mm.height = Math.round(MM.h * DPR);
}
addEventListener('resize', resize); resize();
// Resolución adaptativa. Dibujar a 2x cuadruplica los píxeles y hay máquinas que no lo
// sostienen. Se mide en ventanas de 60 fotogramas: si no se sostienen 50 fps se baja la
// escala, y solo se vuelve a subir cuando se va a ritmo de 60 y además el render va holgado
// (el tiempo de render por sí solo no vale: no ve lo que cuesta componer el lienzo).
const PERF = {n: 0, work: 0, sum: 0, cool: 0};
function adaptRes(workMs, dtMs) {
  PERF.n++; PERF.work += workMs; PERF.sum += dtMs;
  if (PERF.n < 60) return;
  const avg = PERF.sum / PERF.n, work = PERF.work / PERF.n;
  PERF.n = 0; PERF.work = 0; PERF.sum = 0;
  if (PERF.cool > 0) { PERF.cool--; return; }
  if (avg > 20 && DPR > 1) { DPR = Math.max(1, DPR - 0.5); resize(); PERF.cool = 3; }
  else if (avg < 17.5 && work < 5 && DPR < DPR_MAX) { DPR = Math.min(DPR_MAX, DPR + 0.5); resize(); PERF.cool = 3; }
}
const viewH = () => VH - PANEL_H - TOP_H; // alto del visor del mapa, entre la barra y el panel
// proyección: mundo (px, 32 por tile) → iso
const isoOf = (wx, wy) => ({x: wx - wy, y: (wx + wy) / 2});
function worldToScreen(wx, wy) { const z = UI.cam.z; return {x: (wx - wy - UI.cam.x) * z + VW / 2 + SHX, y: ((wx + wy) / 2 - UI.cam.y) * z + TOP_H + viewH() / 2 + SHY}; }
function screenToWorld(sx, sy) { const z = UI.cam.z; const ix = (sx - VW / 2) / z + UI.cam.x, iy = (sy - TOP_H - viewH() / 2) / z + UI.cam.y; return {x: iy + ix / 2, y: iy - ix / 2}; }
function clampCam() { const m = G.map, W = m.w * TILE; UI.cam.x = clamp(UI.cam.x, -W + 64, W - 64); UI.cam.y = clamp(UI.cam.y, 32, W - 32); }
function centerOn(wx, wy) { const i = isoOf(wx, wy); UI.cam.x = i.x; UI.cam.y = i.y; clampCam(); }
function facingOf(dx, dy) { const ix = dx - dy, iy = (dx + dy) / 2; if (Math.abs(ix) > Math.abs(iy) * 1.3) return ix > 0 ? 1 : 3; return iy > 0 ? 0 : 2; }

// ------------------------------------------------------------ terreno por trozos
const CH = 16;
function chunkCanvas(cx, cy) {
  const key = cx + ',' + cy; if (UI.chunks.has(key)) return UI.chunks.get(key);
  const m = G.map; const W = CH * 64 + 64, H = CH * 32 + 48;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const ox0 = (cx * CH - cy * CH) * 32 - CH * 32 - 32, oy0 = (cx * CH + cy * CH) * 16 - 6;
  for (let ty = cy * CH; ty < Math.min(m.h, cy * CH + CH); ty++) for (let tx = cx * CH; tx < Math.min(m.w, cx * CH + CH); tx++) {
    const i = m.idx(tx, ty); const t = m.terrain[i];
    let tt = t; if (t === T_TREE || t === T_BERRY || t === T_FLOWER) tt = t === T_FLOWER ? T_FLOWER : T_GRASS; if (t === T_STONE || t === T_GOLD) tt = T_DIRT;
    const fam = FAMILY(tt);
    const nb = [m.t(tx, ty - 1), m.t(tx + 1, ty), m.t(tx, ty + 1), m.t(tx - 1, ty)].map(n => { if (n === T_TREE || n === T_BERRY) n = T_GRASS; if (n === T_STONE || n === T_GOLD) n = T_DIRT; let f = FAMILY(n); if (f === 'shallow') f = 'water'; return f === fam || (fam === 'water' && f === 'water') ? '' : f; });
    const nbKey = nb.map(f => f ? f[0] : '.').join('');
    const img = terrainTile(tt, (fam === 'water' || fam === 'shallow') ? 0 : m.variant[i], nbKey, nb.some(Boolean) ? nb : null);
    const ix = (tx - ty) * 32 - 32 - ox0, iy = (tx + ty) * 16 - 3 - oy0;
    x.drawImage(img, ix, iy, 64, 38);
  }
  const entry = {c, ox: ox0, oy: oy0}; UI.chunks.set(key, entry); return entry;
}
function drawTerrain() {
  const m = G.map, z = UI.cam.z;
  if (m.dirty) { UI.chunkT -= 1; if (UI.chunkT <= 0) { UI.chunks.clear(); m.dirty = false; UI.chunkT = 90; } }
  const nC = Math.ceil(m.w / CH);
  // Los trozos se solapan (1088 px de lienzo cada 512 de paso) y las fichas llevan solapa
  // inferior, así que hay que pintarlos de fondo a frente: en isométrico la profundidad es
  // cx+cy. Recorrerlos por filas dejaba costuras donde un trozo lejano tapaba a uno cercano.
  for (let d = 0; d <= (nC - 1) * 2; d++) for (let cx = Math.max(0, d - nC + 1); cx <= Math.min(nC - 1, d); cx++) {
    const cy = d - cx;
    const ox = (cx * CH - cy * CH) * 32 - CH * 32 - 32, oy = (cx * CH + cy * CH) * 16 - 6;
    const sx = (ox - UI.cam.x) * z + VW / 2 + SHX, sy = (oy - UI.cam.y) * z + TOP_H + viewH() / 2 + SHY;
    const W = (CH * 64 + 64) * z, H = (CH * 32 + 48) * z;
    if (sx + W < 0 || sy + H < TOP_H || sx > VW || sy > VH - PANEL_H) continue;
    const ch = chunkCanvas(cx, cy);
    ctx.drawImage(ch.c, sx, sy, W, H);
  }
}
// ------------------------------------------------------------ entidades
function unitAnimState(u) {
  const o = u.order;
  if (o && o.type === 'attack' && u.cd > 0 && !u.path.length) { const t = 1 - u.cd / u.def.cd; return {anim: 'attack', frame: t < 0.3 ? 0 : t < 0.6 ? 1 : 2}; }
  if (o && (o.type === 'gather' || o.type === 'build' || o.type === 'repair') && !u.path.length && u.gatherT !== undefined && (u.anim > 0)) return {anim: 'work', frame: Math.floor(u.anim) % 4};
  if (u.path.length) return {anim: 'walk', frame: Math.floor(u.anim) % 4};
  return {anim: 'idle', frame: 0};
}
function unitFacing(u) {
  const o = u.order;
  if (o && (o.type === 'attack' || o.type === 'heal' || o.type === 'convert') && !u.path.length) { const t = G.byId[o.tid]; if (t) return facingOf(t.x - u.x, t.y - u.y); }
  if (u.path.length) { const n = u.path[0]; return facingOf((n.x + .5) * TILE - u.x, (n.y + .5) * TILE - u.y); }
  if (o && o.type === 'gather' && !u.path.length) return facingOf((o.tx + .5) * TILE - u.x, (o.ty + .5) * TILE - u.y);
  if (o && (o.type === 'build' || o.type === 'repair')) { const b = G.byId[o.tid]; if (b) return facingOf(b.x - u.x, b.y - u.y); }
  return u.lastFacing ?? 0;
}
// Precalentado: la primera vez que una unidad gira, golpea o recolecta hay que generar ese
// sprite, y eso se nota como un tirón. Aquí se van generando por adelantado los que faltan,
// con un presupuesto por fotograma para no robarle tiempo al dibujado.
const WARM = {q: null, t: 0};
const WARM_POSES = [['idle', 0], ['walk', 1], ['walk', 3], ['walk', 0], ['work', 0], ['work', 1], ['work', 2], ['attack', 0], ['attack', 1], ['attack', 2]];
function warmSprites(ms) {
  if ((!WARM.q || !WARM.q.length) && WARM.t <= 0) {
    const seen = new Set(), q = [];
    for (const u of G.units) { const k = u.type + ':' + u.owner; if (seen.has(k)) continue; seen.add(k);
      const fake = {type: u.type, def: u.def, owner: u.owner, relic: false};
      for (const side of [0, 1]) for (const [a, f] of WARM_POSES) q.push([fake, side, a, f]); }
    WARM.q = q; WARM.t = 5; // se rehace cada cinco segundos por si aparecen tipos nuevos
  }
  if (!WARM.q || !WARM.q.length) return;
  const t0 = performance.now();
  while (WARM.q.length && performance.now() - t0 < ms) { const j = WARM.q.pop(); unitSprite(j[0], '', j[1] ? 1 : 0, j[2], j[3], null); }
}
function drawUnit(u) {
  const z = UI.cam.z, s = worldToScreen(u.x, u.y);
  const facing = unitFacing(u); u.lastFacing = facing;
  const st = unitAnimState(u);
  const sp = unitSprite(u, civOf(u.owner).style, facing, st.anim, st.frame, u.carry && u.carry.amt > 0 ? u.carry.type : null);
  const sel = UI.selected.includes(u);
  if (sel) { ctx.strokeStyle = allied(u.owner, HUMAN) ? '#c6f5c9' : '#ffb4ae'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(s.x, s.y, (u.def.cls === 'cab' || u.def.cls === 'sit' ? 16 : 11) * z, (u.def.cls === 'cab' || u.def.cls === 'sit' ? 7 : 5) * z, 0, 0, 7); ctx.stroke(); }
  // la pose ya mueve brazos y piernas dentro del sprite; aquí solo el empuje del cuerpo entero
  const ln = sp.lean || 0, flip = facing === 3; // el oeste es el este espejado
  const ax = (facing === 1 || flip) ? ln : 0, ay = facing === 0 ? ln * 0.5 : facing === 2 ? -ln * 0.5 : 0;
  if (flip) { ctx.save(); ctx.translate(s.x * 2, 0); ctx.scale(-1, 1); }
  ctx.drawImage(sp.c, s.x - sp.ax * z + ax * z, s.y - sp.ay * z + ay * z, 64 * z, 80 * z);
  if (flip) ctx.restore();
  const top = s.y - (u.def.cls === 'cab' ? 44 : u.def.cls === 'sit' ? 30 : 36) * z;
  if (u.hp < u.maxHp || sel || OPTS.hp) drawHpBar(s.x, top, 22 * z, u.hp / u.maxHp);
  if (sel && u.stance && u.owner === HUMAN) { ctx.fillStyle = '#fff'; ctx.font = `${9 * z}px system-ui`; ctx.fillText(u.stance === 1 ? 'D' : 'H', s.x + 12 * z, top - 2); }
  if (u.order && u.order.type === 'convert' && u.convT > 0) drawHpBar(s.x, top - 5 * z, 22 * z, u.convT / 8, '#d9a441');
}
function drawHpBar(x, y, w, k, col) { ctx.fillStyle = '#000a'; ctx.fillRect(x - w / 2, y, w, 3); ctx.fillStyle = col || (k > .6 ? '#5fbf6a' : k > .3 ? '#e8c34a' : '#e0483f'); ctx.fillRect(x - w / 2, y, w * k, 3); }
function wallMask(b) {
  const m = G.map; let mask = 0;
  const ok = (x, y) => { if (!m.inside(x, y)) return false; const o = G.byId[m.bld[m.idx(x, y)]]; return !!(o && o.owner === b.owner && (o.def.wall || o.def.gate || o.type === 'torre' || o.type === 'castillo')); };
  if (ok(b.tx, b.ty - 1)) mask |= 1; if (ok(b.tx + 1, b.ty)) mask |= 2; if (ok(b.tx, b.ty + 1)) mask |= 4; if (ok(b.tx - 1, b.ty)) mask |= 8;
  return mask;
}
function drawBuilding(b, vis) {
  const z = UI.cam.z, s = worldToScreen(b.tx * TILE, b.ty * TILE);
  const stage = b.built >= 1 ? 3 : b.built < 0.33 ? 0 : b.built < 0.66 ? 1 : 2;
  const extra = (b.def.gate && b.closed ? 'closed' : '') + (b.type === 'molino' && b.built >= 1 ? 's' + (Math.floor(G.time * 6) % 8) : '');
  const sp = buildingSprite(b.type, b.owner, stage, (b.def.wall || b.def.gate) ? wallMask(b) : 0, extra);
  const sel = UI.selected.includes(b);
  if (sel) drawFootprint(b.tx, b.ty, b.w, b.h, allied(b.owner, HUMAN) ? '#c6f5c9' : '#ffb4ae', null);
  ctx.save(); if (!vis) ctx.globalAlpha = 0.6;
  ctx.drawImage(sp.c, s.x - sp.ax * z, s.y - sp.ay * z, sp.c.width / ISO.S * z, sp.c.height / ISO.S * z);
  ctx.restore();
  // humo si está dañado
  if (b.built >= 1 && b.hp < b.maxHp * 0.5 && vis) { const n = b.hp < b.maxHp * 0.25 ? 3 : 1; for (let k = 0; k < n; k++) { const t = (G.time * 0.7 + k * 0.37 + b.id * 0.13) % 1; const px = s.x + ((k - 1) * 10 + Math.sin(G.time * 2 + k) * 4) * z, py = s.y - (BLD_HT[b.type] * 0.5 + t * 30) * z; ctx.fillStyle = `rgba(60,55,50,${(1 - t) * 0.55})`; ctx.beginPath(); ctx.arc(px, py, (4 + t * 8) * z, 0, 7); ctx.fill(); } if (b.hp < b.maxHp * 0.25) { ctx.fillStyle = `rgba(255,${120 + Math.sin(G.time * 12) * 40},40,0.8)`; ctx.beginPath(); ctx.arc(s.x + 6 * z, s.y - 8 * z, (3 + Math.sin(G.time * 9) * 1) * z, 0, 7); ctx.fill(); } }
  const top = s.y - (BLD_HT[b.type] + 10) * z;
  if (sel || b.hp < b.maxHp || b.built < 1 || OPTS.hp) drawHpBar(s.x, top, Math.max(30, (b.w + b.h) * 12) * z, b.built < 1 ? b.built : b.hp / b.maxHp, b.built < 1 ? '#d9a441' : null);
  if (b.garrison.length && allied(b.owner, HUMAN)) { ctx.fillStyle = '#0d1216cc'; ctx.fillRect(s.x - 12 * z, top - 14 * z, 26 * z, 11 * z); ctx.fillStyle = '#fff'; ctx.font = `${9 * z}px system-ui`; ctx.fillText('⌂' + b.garrison.length, s.x - 10 * z, top - 5 * z); }
  if (b.def.wonder && b.wonderT !== null && b.built >= 1) { ctx.fillStyle = '#0d1216cc'; ctx.fillRect(s.x - 24 * z, top - 28 * z, 48 * z, 14 * z); ctx.fillStyle = '#f0c94a'; ctx.font = `${10 * z}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(fmtTime(b.wonderT), s.x, top - 17 * z); ctx.textAlign = 'left'; }
  if (sel && b.rally && b.owner === HUMAN) { const r = b.rally.tid ? G.byId[b.rally.tid] : b.rally; if (r) { const p = worldToScreen(r.x, r.y), c = worldToScreen(b.x, b.y); ctx.strokeStyle = '#fff8'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#d9a441'; ctx.fillRect(p.x - 1, p.y - 18, 2, 18); ctx.beginPath(); ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x + 10, p.y - 14); ctx.lineTo(p.x, p.y - 10); ctx.fill(); } }
}
function drawFootprint(tx, ty, w, h, stroke, fill) {
  const p = [worldToScreen(tx * TILE, ty * TILE), worldToScreen((tx + w) * TILE, ty * TILE), worldToScreen((tx + w) * TILE, (ty + h) * TILE), worldToScreen(tx * TILE, (ty + h) * TILE)];
  ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}
function drawTerrainObject(tx, ty, t, amount) {
  const z = UI.cam.z, s = worldToScreen((tx + .5) * TILE, (ty + .5) * TILE);
  const k = amount / (TILE_AMOUNT[t] || 1);
  if (t === T_TREE) { const m = G.map; const palm = (m.t(tx + 1, ty) === T_SAND) + (m.t(tx - 1, ty) === T_SAND) + (m.t(tx, ty + 1) === T_SAND) + (m.t(tx, ty - 1) === T_SAND) >= 3; // solo en dunas y oasis, no en playas ni caminos
    const sp = treeSprite((tx * 7 + ty * 13) % 4, k, palm); ctx.drawImage(sp, s.x - 32 * z, s.y - 72 * z, 64 * z, 80 * z); }
  else if (t === T_BERRY) { const sp = bushSprite(k); ctx.drawImage(sp, s.x - 32 * z, s.y - 40 * z, 64 * z, 48 * z); }
  else { const sp = rockSprite(t === T_GOLD, k); ctx.drawImage(sp, s.x - 32 * z, s.y - 40 * z, 64 * z, 48 * z); }
}
function isTileVisible(b) { const m = G.map; for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) if (m.visible[m.idx(x, y)]) return true; return false; }
function isBuildingExplored(b) { const m = G.map; for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) if (m.explored[m.idx(x, y)]) return true; return false; }
function inView(wx, wy, pad) { const s = worldToScreen(wx, wy); return s.x > -pad && s.x < VW + pad && s.y > TOP_H - pad && s.y < VH - PANEL_H + pad; }
function render() {
  const m = G.map, z = UI.cam.z;
  ctx.fillStyle = '#0b0f12'; ctx.fillRect(0, 0, VW, VH);
  const sk = G.shake || 0;
  SHX = sk > 0 ? (Math.random() - 0.5) * 11 * sk : 0; SHY = sk > 0 ? (Math.random() - 0.5) * 7 * sk : 0;
  ctx.save(); ctx.beginPath(); ctx.rect(0, TOP_H, VW, viewH()); ctx.clip();
  drawTerrain();
  // recoger entidades visibles
  const list = [];
  // rango de tiles visibles: convertir esquinas de pantalla a mundo
  const c1 = screenToWorld(0, TOP_H), c2 = screenToWorld(VW, TOP_H), c3 = screenToWorld(0, VH - PANEL_H), c4 = screenToWorld(VW, VH - PANEL_H);
  const tx0 = clamp(Math.floor(Math.min(c1.x, c2.x, c3.x, c4.x) / TILE) - 2, 0, m.w - 1), tx1 = clamp(Math.ceil(Math.max(c1.x, c2.x, c3.x, c4.x) / TILE) + 2, 0, m.w - 1);
  const ty0 = clamp(Math.floor(Math.min(c1.y, c2.y, c3.y, c4.y) / TILE) - 2, 0, m.h - 1), ty1 = clamp(Math.ceil(Math.max(c1.y, c2.y, c3.y, c4.y) / TILE) + 3, 0, m.h - 1);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const i = m.idx(tx, ty); const t = m.terrain[i]; if ((t === T_TREE || t === T_BERRY || t === T_STONE || t === T_GOLD) && m.explored[i]) { if (!inView((tx + .5) * TILE, (ty + .5) * TILE, 90)) continue; list.push({d: (tx + ty + 1) * TILE, obj: true, tx, ty, t, amount: m.amount[i]}); } }
  for (const b of G.buildings) { if (!inView(b.x, b.y, 200 + BLD_HT[b.type])) continue; const vis = allied(b.owner, HUMAN) || isTileVisible(b); if (vis || isBuildingExplored(b)) list.push({d: (b.tx + b.w + b.ty + b.h) * TILE - 8, e: b, vis}); }
  for (const u of G.units) { if (!inView(u.x, u.y, 80)) continue; if (allied(u.owner, HUMAN) || m.visible[m.idx(u.tx, u.ty)]) list.push({d: u.x + u.y, e: u}); }
  for (const rl of m.relics) if (!rl.carrier && !rl.holder && m.explored[m.idx(rl.x, rl.y)] && inView((rl.x + .5) * TILE, (rl.y + .5) * TILE, 60)) list.push({d: (rl.x + rl.y + 1) * TILE, relic: rl});
  for (const f of G.fx) if (f.t === 'death' && f.type) list.push({d: f.x + f.y - 1, fx: f});
  list.sort((a, b) => a.d - b.d);
  if (UI.placing) drawPlacement();
  for (const e of UI.selected) if (e.kind === 'unit' && e.order && (e.order.type === 'patrol' || e.order.type === 'guard')) { const t = e.order.type === 'guard' ? G.byId[e.order.tid] : {x: e.order.x, y: e.order.y}; if (t) { const a = worldToScreen(e.x, e.y), b = worldToScreen(t.x, t.y); ctx.strokeStyle = '#ffffff55'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); } }
  for (const it of list) {
    if (it.obj) drawTerrainObject(it.tx, it.ty, it.t, it.amount);
    else if (it.relic) { const s = worldToScreen((it.relic.x + .5) * TILE, (it.relic.y + .5) * TILE); ctx.drawImage(relicSprite(), s.x - 16 * z, s.y - 36 * z, 32 * z, 40 * z); }
    else if (it.fx) { const f = it.fx; const s = worldToScreen(f.x, f.y); const fake = {type: f.type, def: UNITS[f.type], owner: f.owner, relic: false}; const sp = unitSprite(fake, civOf(f.owner).style, 0, 'dead', 0); ctx.globalAlpha = Math.min(1, f.life / 1.5); ctx.drawImage(sp.c, s.x - sp.ax * z, s.y - sp.ay * z, 64 * z, 80 * z); ctx.globalAlpha = 1; }
    else if (it.e.kind === 'bld') drawBuilding(it.e, it.vis);
    else drawUnit(it.e);
  }
  // proyectiles
  for (const p of G.projectiles) { const s = worldToScreen(p.x, p.y); const h = Math.sin(Math.min(1, p.t / p.dur) * Math.PI) * (p.kind === 'rock' ? 60 : 22) * z; if (p.kind === 'rock') { ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 4 * z, 2 * z, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(s.x, s.y - h - 6 * z, 4 * z, 0, 7); ctx.fill(); } else { const a = worldToScreen(p.sx, p.sy), b = worldToScreen(p.tx, p.ty); const ang = Math.atan2(b.y - a.y, b.x - a.x); ctx.strokeStyle = '#f0e8d8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x - Math.cos(ang) * 7 * z, s.y - h - 8 * z - Math.sin(ang) * 7 * z); ctx.lineTo(s.x + Math.cos(ang) * 7 * z, s.y - h - 8 * z + Math.sin(ang) * 7 * z); ctx.stroke(); } }
  // efectos
  for (const f of G.fx) {
    const s = worldToScreen(f.x, f.y);
    if (f.t === 'hit') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y - 14 * z, 3 * z * (f.life / 0.25), 0, 7); ctx.fill(); }
    else if (f.t === 'boom') { ctx.strokeStyle = '#f0c94a'; ctx.lineWidth = 3; ctx.globalAlpha = f.life / 0.5; ctx.beginPath(); ctx.ellipse(s.x, s.y, (f.r * (1 - f.life / 0.5) + 4) * z, (f.r * (1 - f.life / 0.5) + 4) * z * 0.5, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; for (let k = 0; k < 5; k++) { ctx.fillStyle = `rgba(90,70,50,${f.life})`; ctx.beginPath(); ctx.arc(s.x + Math.cos(k * 1.3) * (1 - f.life) * 30 * z, s.y - 6 * z - (1 - f.life) * 20 * z + Math.sin(k) * 6 * z, (5 + k) * z * (0.5 + f.life), 0, 7); ctx.fill(); } }
    else if (f.t === 'ruin') { ctx.globalAlpha = Math.min(1, f.life / 1.2); for (let k = 0; k < 6; k++) { ctx.fillStyle = `rgba(80,70,60,${0.6})`; ctx.beginPath(); ctx.arc(s.x + Math.cos(k * 1.1) * f.w * 12 * z, s.y - 10 * z - (1.2 - f.life) * 25 * z, (6 + k * 2) * z, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
    else if (f.t === 'ping') { ctx.strokeStyle = '#5fbf6a'; ctx.lineWidth = 2; ctx.globalAlpha = f.life; ctx.beginPath(); ctx.ellipse(s.x, s.y, 14 * z * (1 - f.life) + 4, 7 * z * (1 - f.life) + 2, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (f.t === 'heal') { ctx.fillStyle = '#b6f0bb'; ctx.globalAlpha = f.life; for (let k = 0; k < 3; k++) { const yy = s.y - 24 * z - (0.8 - f.life) * 20 * z; ctx.fillRect(s.x - 8 * z + k * 8 * z, yy, 2 * z, 6 * z); ctx.fillRect(s.x - 10 * z + k * 8 * z, yy + 2 * z, 6 * z, 2 * z); } ctx.globalAlpha = 1; }
    else if (f.t === 'part') { // la posición sale de la edad: parábola con gravedad
      const age = f.max - f.life, s2 = worldToScreen(f.x + f.vx * age, f.y + f.vy * age);
      const h = Math.max(0, f.vz * age - f.g * age * age / 2), rr = Math.max(1, f.r * z);
      ctx.globalAlpha = Math.min(1, f.life / f.max * 1.7); ctx.fillStyle = f.c;
      ctx.fillRect(s2.x - rr / 2, s2.y - h * z - rr / 2, rr, rr); ctx.globalAlpha = 1;
    }
    else if (f.t === 'float') {
      const age = f.max - f.life; ctx.globalAlpha = Math.min(1, f.life / f.max * 2.2);
      ctx.font = `bold ${12 * z}px Cinzel, Georgia, serif`; ctx.textAlign = 'center';
      const yy = s.y - (24 + age * 30) * z;
      ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3.5 * z; ctx.strokeText(f.txt, s.x, yy);
      ctx.fillStyle = f.c; ctx.fillText(f.txt, s.x, yy);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
    else if (f.t === 'conv') { ctx.strokeStyle = '#d9a441'; ctx.globalAlpha = f.life * 2; ctx.beginPath(); ctx.ellipse(s.x, s.y - 4 * z, 12 * z * (1 - f.life), 6 * z * (1 - f.life), 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  drawFog();
  const M = UI.mouse;
  if (M.drag && M.btn === 0 && !UI.placing) { ctx.strokeStyle = '#c6f5c9'; ctx.fillStyle = '#c6f5c922'; const x = Math.min(M.sx, M.x), y = Math.min(M.sy, M.y), w = Math.abs(M.x - M.sx), h = Math.abs(M.y - M.sy); ctx.fillRect(x, y, w, h); ctx.strokeRect(x + .5, y + .5, w, h); }
  if (UI.hover && !UI.placing) {
    const e = UI.hover; const s = worldToScreen(e.x, e.y); ctx.font = '12px system-ui';
    const label = e.def.name + (e.owner === HUMAN ? '' : ` (${P(e.owner).name}${allied(e.owner, HUMAN) ? ', aliado' : ''})`) + (e.kind === 'bld' && e.garrison.length ? ` · ${e.garrison.length} dentro` : '');
    const tw = ctx.measureText(label).width; const ty = e.kind === 'bld' ? s.y - (BLD_HT[e.type] + (e.w + e.h) * 8 + 34) * z : s.y - 50 * z;
    ctx.fillStyle = '#0d1216dd'; ctx.fillRect(s.x - tw / 2 - 6, ty, tw + 12, 18); ctx.fillStyle = allied(e.owner, HUMAN) ? '#e8e2d3' : '#ffb4ae'; ctx.textAlign = 'center'; ctx.fillText(label, s.x, ty + 13); ctx.textAlign = 'left';
  }
  ctx.restore();
  renderMinimap();
}
function fogTransform(target, z, ox, oy, d = 1) { target.setTransform(z * d, 0.5 * z * d, -z * d, 0.5 * z * d, ox * d, oy * d); }
function drawFog() {
  const m = G.map, z = UI.cam.z;
  if (!UI.fogCanvas) { UI.fogCanvas = document.createElement('canvas'); UI.fogCanvas.width = m.w; UI.fogCanvas.height = m.h; }
  if (UI.fogStamp !== G.fogT) { UI.fogStamp = G.fogT; const fc = UI.fogCanvas.getContext('2d'); const img = fc.createImageData(m.w, m.h); const d = img.data; for (let i = 0; i < m.w * m.h; i++) { const k = i * 4; d[k] = 8; d[k + 1] = 12; d[k + 2] = 18; d[k + 3] = m.visible[i] ? 0 : m.explored[i] ? 115 : 255; } fc.putImageData(img, 0, 0); }
  const o = worldToScreen(0, 0);
  ctx.save(); fogTransform(ctx, z, o.x, o.y, DPR); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(UI.fogCanvas, 0, 0, m.w, m.h, -TILE / 2, -TILE / 2, m.w * TILE, m.h * TILE);
  ctx.restore();
}
function drawPlacement() {
  const P_ = UI.placing, z = UI.cam.z, def = BUILDINGS[P_.type];
  for (const t of placementTiles()) {
    const ok = G.map.canPlace(t.x, t.y, def.w, def.h, HUMAN);
    drawFootprint(t.x, t.y, def.w, def.h, ok ? '#5fbf6a' : '#e0483f', ok ? '#5fbf6a55' : '#e0483f55');
    const sp = buildingSprite(P_.type, HUMAN, 3, def.wall ? 0 : 0); const s = worldToScreen(t.x * TILE, t.y * TILE);
    ctx.globalAlpha = 0.55; ctx.drawImage(sp.c, s.x - sp.ax * z, s.y - sp.ay * z, sp.c.width / ISO.S * z, sp.c.height / ISO.S * z); ctx.globalAlpha = 1;
    if (def.atk) { const c = worldToScreen((t.x + def.w / 2) * TILE, (t.y + def.h / 2) * TILE); const r = (def.rng * TILE + Math.max(def.w, def.h) * TILE / 2) * z; ctx.strokeStyle = '#ffffff66'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r / 2, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  }
}
function placementTiles() {
  const P_ = UI.placing, w = screenToWorld(UI.mouse.x, UI.mouse.y), def = BUILDINGS[P_.type];
  const tx = Math.floor(w.x / TILE - def.w / 2 + 0.5), ty = Math.floor(w.y / TILE - def.h / 2 + 0.5);
  if (UI.wallDrag && def.wall) {
    const out = []; let x = UI.wallDrag.x, y = UI.wallDrag.y; const seen = new Set();
    for (let k = 0; k < 80; k++) { const key = x + ',' + y; if (!seen.has(key)) { seen.add(key); out.push({x, y}); } if (x === tx && y === ty) break; if (Math.abs(tx - x) > Math.abs(ty - y)) x += Math.sign(tx - x); else y += Math.sign(ty - y); }
    return out;
  }
  return [{x: tx, y: ty}];
}
// ------------------------------------------------------------ minimapa (rombo)
function mmScale() { const m = G.map; return Math.min(MM.w / (2 * m.w * TILE), MM.h / (m.h * TILE)); }
function mmTransform(c) { const s = mmScale() * DPR; c.setTransform(s, 0.5 * s, -s, 0.5 * s, MM.w * DPR / 2, (MM.h - G.map.h * TILE * mmScale()) / 2 * DPR); }
function renderMinimap() {
  const m = G.map;
  if (UI.mmT-- <= 0) {
    UI.mmT = 8;
    if (!UI.mmBase) { UI.mmBase = document.createElement('canvas'); UI.mmBase.width = m.w; UI.mmBase.height = m.h; }
    const c = UI.mmBase.getContext('2d'); const img = c.createImageData(m.w, m.h); const d = img.data;
    const cols = {}; for (const k in MMCOL) { const n = parseInt(MMCOL[k].slice(1), 16); cols[k] = [n >> 16, (n >> 8) & 255, n & 255]; }
    for (let i = 0; i < m.w * m.h; i++) { const k = i * 4; if (!m.explored[i]) { d[k + 3] = 255; continue; } const cc = cols[m.terrain[i]]; const f = m.visible[i] ? 1 : 0.55; d[k] = cc[0] * f; d[k + 1] = cc[1] * f; d[k + 2] = cc[2] * f; d[k + 3] = 255; }
    c.putImageData(img, 0, 0);
  }
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.fillStyle = '#0b0f12'; mctx.fillRect(0, 0, mm.width, mm.height);
  mmTransform(mctx); mctx.imageSmoothingEnabled = false;
  mctx.drawImage(UI.mmBase, 0, 0, m.w, m.h, 0, 0, m.w * TILE, m.h * TILE);
  const px = TILE * 1.2;
  for (const b of G.buildings) if (allied(b.owner, HUMAN) || isBuildingExplored(b)) { mctx.fillStyle = P(b.owner).color; mctx.fillRect(b.tx * TILE, b.ty * TILE, Math.max(1.5, b.w) * TILE, Math.max(1.5, b.h) * TILE); }
  for (const u of G.units) if (allied(u.owner, HUMAN) || m.visible[m.idx(u.tx, u.ty)]) { mctx.fillStyle = u.owner === HUMAN ? '#bfe0ff' : P(u.owner).color; mctx.fillRect(u.x - px / 2, u.y - px / 2, px, px); }
  for (const rl of m.relics) if (!rl.carrier && !rl.holder && m.explored[m.idx(rl.x, rl.y)]) { mctx.fillStyle = '#fff'; mctx.fillRect(rl.x * TILE, rl.y * TILE, TILE * 1.5, TILE * 1.5); }
  for (const ev of G.events) if (G.time - ev.t < 6) { mctx.strokeStyle = '#fff'; mctx.lineWidth = TILE; mctx.beginPath(); mctx.arc(ev.x, ev.y, TILE * (3 + ((G.time * 3) % 3)), 0, 7); mctx.stroke(); }
  if (G.events.length > 12) G.events.splice(0, G.events.length - 12);
  // rectángulo de cámara (paralelogramo en mundo)
  const cs = [screenToWorld(0, TOP_H), screenToWorld(VW, TOP_H), screenToWorld(VW, VH - PANEL_H), screenToWorld(0, VH - PANEL_H)];
  mctx.strokeStyle = '#fff'; mctx.lineWidth = TILE * 0.8; mctx.beginPath(); cs.forEach((p, i) => i ? mctx.lineTo(p.x, p.y) : mctx.moveTo(p.x, p.y)); mctx.closePath(); mctx.stroke();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
}
const MMCOL = {[T_GRASS]: '#4c8a3f', [T_WATER]: '#2f6fa8', [T_TREE]: '#2f5a28', [T_BERRY]: '#c6503a', [T_STONE]: '#a9b3b6', [T_GOLD]: '#f0c94a', [T_FARM]: '#c9a85a', [T_SAND]: '#d3c58a', [T_DIRT]: '#7d6d49', [T_FLOWER]: '#4c8a3f', [T_SHALLOW]: '#6fa3c8'};
function mmToWorld(mx, my) { const s = mmScale(); const ix = (mx - MM.w / 2) / s, iy = (my - (MM.h - G.map.h * TILE * s) / 2) / s; return {x: iy + ix / 2, y: iy - ix / 2}; }
