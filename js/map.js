// ============================================================ MAPA
class GameMap {
  constructor(size, seed, type, nPlayers) {
    this.w = size; this.h = size; this.type = type || 'praderas'; this.nPlayers = nPlayers || 2;
    const n = size * size;
    this.terrain = new Uint8Array(n); this.amount = new Uint16Array(n); this.bld = new Int32Array(n).fill(-1);
    this.explored = new Uint8Array(n); this.visible = new Uint8Array(n); this.variant = new Uint8Array(n);
    this.dirty = true; this.relics = [];
    this.rng = mulberry(seed); this.seed = seed;
    this.generate();
  }
  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  t(x, y) { return this.inside(x, y) ? this.terrain[this.idx(x, y)] : T_WATER; }
  walkableTerrain(x, y) { const t = this.t(x, y); return t !== T_WATER && t !== T_TREE && t !== T_STONE && t !== T_GOLD && t !== T_BERRY; }
  passable(x, y, owner) {
    if (!this.inside(x, y) || !this.walkableTerrain(x, y)) return false;
    const b = this.bld[this.idx(x, y)];
    if (b < 0) return true;
    const e = G.byId[b];
    return !!(e && ((e.def.gate && !e.closed) || (e.def.farm && e.built >= 1)) && allied(e.owner, owner));
  }
  free(x, y) { return this.inside(x, y) && this.walkableTerrain(x, y) && this.bld[this.idx(x, y)] < 0; }
  noise(x, y, s, off) {
    const gx = x / s + off, gy = y / s + off * 7;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const h = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7 + off * 74.7) * 43758.5453; return n - Math.floor(n); };
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (h(x0, y0) * (1 - u) + h(x0 + 1, y0) * u) * (1 - v) + (h(x0, y0 + 1) * (1 - u) + h(x0 + 1, y0 + 1) * u) * v;
  }
  generate() {
    const w = this.w, h = this.h, r = this.rng, type = this.type;
    const off = r() * 100;
    const forestT = type === 'bosque' ? 0.5 : 0.63, waterT = type === 'oasis' ? 0.95 : type === 'bosque' ? 0.8 : 0.72;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = this.idx(x, y);
      this.variant[i] = Math.floor(r() * 4);
      const n1 = this.noise(x, y, 9, off) * 0.6 + this.noise(x, y, 4, off + 3) * 0.4;
      const n2 = this.noise(x, y, 7, off + 11) * 0.65 + this.noise(x, y, 3, off + 5) * 0.35;
      const n3 = this.noise(x, y, 5, off + 23);
      let t = T_GRASS;
      if (n1 > waterT) t = T_WATER;
      else if (n1 > waterT - 0.06) t = T_SAND;
      else if (n2 > forestT) t = T_TREE;
      else if (n3 > 0.8 && r() < 0.5) t = T_DIRT;
      else if (n3 < 0.2 && r() < 0.08) t = T_FLOWER;
      this.terrain[i] = t;
      if (t === T_TREE) this.amount[i] = TILE_AMOUNT[T_TREE];
    }
    if (type === 'oasis') { // lago central
      const cx = w / 2, cy = h / 2, R = w * 0.14;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - cx, y - cy) + this.noise(x, y, 6, off + 9) * 5; const i = this.idx(x, y); if (d < R) this.terrain[i] = T_WATER, this.amount[i] = 0; else if (d < R + 2.5) this.terrain[i] = T_SAND, this.amount[i] = 0; }
    }
    if (type === 'rios') this.rivers(off);
    // borde: árboles
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { const i = this.idx(x, y); this.terrain[i] = T_TREE; this.amount[i] = 90; }
    // posiciones de inicio
    const m = 8;
    const corners = [{x: m, y: m}, {x: w - m - 3, y: h - m - 3}, {x: w - m - 3, y: m}, {x: m, y: h - m - 3}];
    if (this.nPlayers === 2 && r() < 0.5) { corners[1] = {x: w - m - 3, y: m}; corners[2] = {x: w - m - 3, y: h - m - 3}; }
    this.starts = corners.slice(0, this.nPlayers);
    for (const s of this.starts) {
      this.clearArea(s.x - 6, s.y - 6, 15, 15);
      this.cluster(T_BERRY, s.x + 1, s.y + 1, 7, 6, 8);
      this.cluster(T_GOLD, s.x + 1, s.y + 1, 10, 6, 7);
      this.cluster(T_STONE, s.x + 1, s.y + 1, 11, 4, 5);
      this.cluster(T_TREE, s.x + 1, s.y + 1, 11, 26, 34);
      this.cluster(T_TREE, s.x + 1, s.y + 1, 14, 20, 28);
      this.cluster(T_BERRY, s.x + 1, s.y + 1, 13, 4, 5);
    }
    // recursos neutrales
    const n = Math.floor(w * h / (type === 'oasis' ? 380 : 520));
    for (let i = 0; i < n; i++) {
      const gx = type === 'oasis' ? w / 2 + (r() - .5) * w * 0.5 : r() * w, gy = type === 'oasis' ? h / 2 + (r() - .5) * h * 0.5 : r() * h;
      this.cluster(T_GOLD, gx, gy, 0, 4, 7); this.cluster(T_STONE, r() * w, r() * h, 0, 3, 6); this.cluster(T_BERRY, r() * w, r() * h, 0, 4, 6);
    }
    // conectividad: caminos entre todas las bases
    for (let a = 0; a < this.starts.length; a++) for (let b = a + 1; b < this.starts.length; b++) this.carvePath(this.starts[a].x + 1, this.starts[a].y + 1, this.starts[b].x + 1, this.starts[b].y + 1);
    // reliquias
    const nR = this.nPlayers + 2;
    for (let i = 0; i < nR; i++) { let tries = 0; while (tries++ < 200) { const x = 3 + Math.floor(r() * (w - 6)), y = 3 + Math.floor(r() * (h - 6)); if (this.t(x, y) === T_GRASS && !this.nearStart(x, y, 12) && this.hasFreeNeighbor(x, y)) { this.relics.push({x, y, carrier: 0, holder: 0}); break; } } }
  }
  rivers(off) {
    const w = this.w, h = this.h, r = this.rng;
    const nR = w > 90 ? 2 : 1;
    for (let k = 0; k < nR; k++) {
      const vertical = k % 2 === 0 ? r() < 0.5 : true;
      const pos = 0.35 + r() * 0.3, amp = 6 + r() * 6, freq = 0.06 + r() * 0.05;
      const fordEvery = 14;
      for (let i = 0; i < (vertical ? h : w); i++) {
        const c = Math.round((vertical ? w : h) * pos + Math.sin(i * freq + off) * amp);
        const isFord = (i + k * 7) % fordEvery < 3;
        for (let d = -1; d <= 1; d++) {
          const x = vertical ? c + d : i, y = vertical ? i : c + d;
          if (!this.inside(x, y)) continue;
          const j = this.idx(x, y);
          this.terrain[j] = isFord ? T_SHALLOW : T_WATER; this.amount[j] = 0;
        }
        for (const d of [-2, 2]) { const x = vertical ? c + d : i, y = vertical ? i : c + d; if (this.inside(x, y) && this.terrain[this.idx(x, y)] !== T_WATER && this.terrain[this.idx(x, y)] !== T_SHALLOW) { this.terrain[this.idx(x, y)] = T_SAND; this.amount[this.idx(x, y)] = 0; } }
      }
    }
  }
  clearArea(x0, y0, w, h) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.inside(x, y) && x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1) { this.terrain[this.idx(x, y)] = T_GRASS; this.amount[this.idx(x, y)] = 0; } }
  cluster(type, cx, cy, radius, min, max) {
    const r = this.rng;
    let ox, oy, tries = 0;
    do { const a = r() * Math.PI * 2, d = radius ? radius + r() * 3 : 0; ox = Math.round(cx + Math.cos(a) * d); oy = Math.round(cy + Math.sin(a) * d); tries++; }
    while (tries < 60 && !(this.inside(ox, oy) && this.t(ox, oy) === T_GRASS && !this.nearStart(ox, oy, radius ? 4 : 9)));
    if (tries >= 60) return;
    const count = min + Math.floor(r() * (max - min + 1));
    const cells = [[ox, oy]]; const set = new Set([this.idx(ox, oy)]);
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 20) {
      const [bx, by] = cells[Math.floor(r() * cells.length)];
      const nx = bx + Math.floor(r() * 3) - 1, ny = by + Math.floor(r() * 3) - 1;
      if (!this.inside(nx, ny) || nx < 1 || ny < 1 || nx >= this.w - 1 || ny >= this.h - 1) continue;
      const i = this.idx(nx, ny);
      if (this.terrain[i] !== T_GRASS && this.terrain[i] !== T_DIRT && this.terrain[i] !== T_FLOWER) continue;
      if (this.nearStart(nx, ny, radius ? 4 : 9)) continue;
      this.terrain[i] = type; this.amount[i] = TILE_AMOUNT[type];
      if (!set.has(i)) { set.add(i); cells.push([nx, ny]); }
      placed++;
    }
  }
  nearStart(x, y, d) { return this.starts.some(s => Math.abs(s.x + 1 - x) <= d && Math.abs(s.y + 1 - y) <= d); }
  carvePath(x0, y0, x1, y1) {
    let x = x0, y = y0; const r = this.rng;
    while (x !== x1 || y !== y1) {
      if (Math.abs(x1 - x) > Math.abs(y1 - y) || (r() < 0.5 && x !== x1)) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!this.inside(x + dx, y + dy)) continue;
        const i = this.idx(x + dx, y + dy);
        if (this.terrain[i] === T_WATER) this.terrain[i] = T_SHALLOW;
        if (this.terrain[i] === T_TREE && r() < 0.7) { this.terrain[i] = T_GRASS; this.amount[i] = 0; }
      }
    }
  }
  nearestResource(tx, ty, resType, maxR = 14, owner) {
    let best = null, bd = 1e9;
    for (let y = Math.max(0, ty - maxR); y <= Math.min(this.h - 1, ty + maxR); y++)
      for (let x = Math.max(0, tx - maxR); x <= Math.min(this.w - 1, tx + maxR); x++) {
        const i = this.idx(x, y), t = this.terrain[i];
        if (RES_OF_TILE[t] !== resType || this.amount[i] <= 0) continue;
        if (t === T_FARM) { const b = G.byId[this.bld[i]]; if (!b || b.owner !== owner || b.built < 1) continue; }
        else if (!this.hasFreeNeighbor(x, y)) continue;
        const d = (x - tx) ** 2 + (y - ty) ** 2;
        if (d < bd) { bd = d; best = {x, y}; }
      }
    return best;
  }
  hasFreeNeighbor(x, y) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.walkableTerrain(x + dx, y + dy) && this.bld[this.idx(x + dx, y + dy)] < 0) return true; return false; }
  canPlace(tx, ty, w, h, owner, ignoreUnits = false) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) {
      if (!this.inside(x, y) || x < 1 || y < 1 || x >= this.w - 1 || y >= this.h - 1) return false;
      const t = this.terrain[this.idx(x, y)];
      if (t !== T_GRASS && t !== T_DIRT && t !== T_SAND && t !== T_FLOWER) return false;
      if (this.bld[this.idx(x, y)] >= 0) return false;
      if (this.relics.some(rl => !rl.carrier && !rl.holder && rl.x === x && rl.y === y)) return false;
    }
    if (!ignoreUnits) for (const u of G.units) { if (!allied(u.owner, owner) && u.tx >= tx && u.tx < tx + w && u.ty >= ty && u.ty < ty + h) return false; }
    return true;
  }
  setBuildingTiles(b, id) { for (let y = b.ty; y < b.ty + b.def.h; y++) for (let x = b.tx; x < b.tx + b.def.w; x++) this.bld[this.idx(x, y)] = id; }
  reveal(cx, cy, r) {
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, Math.ceil(cx + r)); x++)
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2) { const i = this.idx(x, y); this.visible[i] = 1; this.explored[i] = 1; }
  }
}

// ============================================================ A*
class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]];
let pathBudget = 0; // nodos expandidos por paso de simulación (para repartir la carga)
function findPath(map, sx, sy, gx, gy, owner, goalFn, maxNodes = 7000) {
  const W = map.w, start = map.idx(sx, sy);
  if (goalFn(sx, sy)) return [];
  const g = new Map(), came = new Map(), closed = new Set();
  const heap = new Heap();
  const hf = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  g.set(start, 0); heap.push({i: start, x: sx, y: sy, f: hf(sx, sy)});
  let bestI = start, bestH = hf(sx, sy), n = 0;
  while (heap.size && n++ < maxNodes) {
    const cur = heap.pop();
    if (closed.has(cur.i)) continue;
    closed.add(cur.i);
    if (goalFn(cur.x, cur.y)) { bestI = cur.i; bestH = -1; break; }
    const h0 = hf(cur.x, cur.y); if (h0 < bestH) { bestH = h0; bestI = cur.i; }
    const cg = g.get(cur.i);
    for (const [dx, dy, c] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!map.passable(nx, ny, owner)) continue;
      if (dx && dy && (!map.passable(cur.x + dx, cur.y, owner) || !map.passable(cur.x, cur.y + dy, owner))) continue;
      const ni = ny * W + nx; if (closed.has(ni)) continue;
      const cost = c * (map.terrain[ni] === T_SHALLOW ? 1.6 : 1);
      const ng = cg + cost;
      if (ng < (g.get(ni) ?? 1e9)) { g.set(ni, ng); came.set(ni, cur.i); heap.push({i: ni, x: nx, y: ny, f: ng + hf(nx, ny)}); }
    }
  }
  pathBudget += n;
  const path = []; let i = bestI;
  while (i !== start) { path.push({x: i % W, y: Math.floor(i / W)}); i = came.get(i); if (i === undefined) break; }
  path.reverse();
  return path;
}
