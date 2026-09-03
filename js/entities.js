// ============================================================ ESTADO DEL JUEGO
let G = null;
function allied(a, b) { return a === b || (G.players[a] && G.players[b] && G.players[a].team === G.players[b].team); }
function P(owner) { return G.players[owner]; }
function civOf(owner) { return CIVS[G.players[owner].civ]; }
function civFx(owner) { return civOf(owner).fx || {}; }

function newGame(opts) {
  const size = opts.size || 80;
  G = {
    opts, map: null, units: [], buildings: [], byId: {}, nextId: 1, time: 0, speed: 1, paused: false, over: false, players: [],
    lastAttackAlert: -99, projectiles: [], fx: [], groups: {}, events: [], history: [], wonder: null, mission: null, flags: {}, msgs: [], sim: 0,
  };
  const pdefs = opts.players;
  G.map = new GameMap(size, opts.seed || Math.floor(Math.random() * 1e9), opts.mapType, pdefs.length);
  const startRes = [{food: 200, wood: 200, stone: 100, gold: 100}, {food: 1200, wood: 1200, stone: 600, gold: 800}, {food: 5000, wood: 5000, stone: 3000, gold: 4000}][opts.start || 0];
  const startAge = [0, 1, 3][opts.start || 0];
  pdefs.forEach((pd, i) => {
    const bonus = pd.human ? [1, 1] : [[0.9, 0.9], [1.25, 1.2], [1.6, 1.5], [2.2, 2]][pd.diff ?? 1];
    const civ = CIVS[pd.civ];
    const res = {}; for (const k of RES) res[k] = Math.round(startRes[k] * (pd.human ? 1 : bonus[0]) * (pd.resMul || 1));
    if (civ.fx.startRes) for (const k in civ.fx.startRes) res[k] += civ.fx.startRes[k];
    if (pd.res) for (const k in pd.res) res[k] = pd.res[k];
    const pl = {id: i, name: pd.name || (pd.human ? 'Tú' : civ.name), civ: pd.civ, team: pd.team ?? i, human: !!pd.human, res, age: pd.age ?? startAge, techs: new Set(), lines: {},
      stats: {trained: 0, killed: 0, lost: 0, razed: 0, gathered: 0, converted: 0}, alive: true, ai: null, diff: pd.diff ?? 1, bell: false, market: {food: 100, wood: 100, stone: 130, gold: 100}, color: PCOLORS[i], dark: PDARK[i], lastAlert: -99, personality: pd.personality || null};
    G.players.push(pl);
  });
  // colocar bases
  pdefs.forEach((pd, i) => {
    const s = G.map.starts[i]; const pl = G.players[i];
    pl.immortal = !!pd.noBase;
    let tc = null;
    if (!pd.noBase) {
      tc = addBuilding(i, 'centro', s.x, s.y, true);
      for (let k = 0; k < (pd.villagers ?? 3); k++) spawnUnit(i, 'aldeano', tc);
      if (pd.scout !== false) spawnUnit(i, 'explorador', tc);
      if ((opts.mapType === 'fortaleza' && !pd.noWalls) || pd.fortress) buildFortress(i, s);
    } else tc = {x: (s.x + 1.5) * TILE, y: (s.y + 1.5) * TILE, tx: s.x + 1, ty: s.y + 1, w: 1, h: 1};
    if (pl.age >= 3) { for (const l in LINES) pl.lines[l] = LINES[l].length - 1; }
    if (pl.age === 2) { pl.lines.milicia = 1; pl.lines.arquero = 1; pl.lines.lancero = 1; }
    if (pd.extra) for (const ex of pd.extra) { if (ex.b) { const b = placeExtra(i, ex.b, s.x + ex.dx, s.y + ex.dy); if (b && ex.wonder) b.wonderT = ex.wonder; } else if (ex.u) for (let k = 0; k < (ex.n || 1); k++) spawnUnit(i, ex.u, tc, ex.hero); }
  });
  G.players.forEach((pl, i) => { if (!pl.human) pl.ai = new AI(i, pl.diff, pl.personality); });
  if (opts.mission !== undefined && opts.mission !== null) setupMission(opts.mission);
  return G;
}
function placeExtra(owner, type, tx, ty) {
  const def = BUILDINGS[type]; const m = G.map;
  let spot = null;
  for (let r = 0; r <= 10 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) { if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; const x = tx + dx, y = ty + dy; let ok = true; for (let yy = y; yy < y + def.h && ok; yy++) for (let xx = x; xx < x + def.w && ok; xx++) if (!m.inside(xx, yy) || xx < 1 || yy < 1 || xx >= m.w - 1 || yy >= m.h - 1 || m.bld[m.idx(xx, yy)] >= 0 || m.t(xx, yy) === T_WATER) ok = false; if (ok) spot = {x, y}; }
  if (!spot) return null;
  for (let yy = spot.y; yy < spot.y + def.h; yy++) for (let xx = spot.x; xx < spot.x + def.w; xx++) { const i = m.idx(xx, yy); m.terrain[i] = T_GRASS; m.amount[i] = 0; }
  return addBuilding(owner, type, spot.x, spot.y, true);
}
function buildFortress(owner, s) {
  const x0 = s.x - 6, y0 = s.y - 6, x1 = s.x + 8, y1 = s.y + 8;
  P(owner).age = Math.max(P(owner).age, 1);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
    if (!G.map.canPlace(x, y, 1, 1, owner, true)) continue;
    const corner = (x === x0 || x === x1) && (y === y0 || y === y1);
    const mid = (x === Math.floor((x0 + x1) / 2) && (y === y0 || y === y1)) || (y === Math.floor((y0 + y1) / 2) && (x === x0 || x === x1));
    addBuilding(owner, corner ? 'torre' : mid ? 'puerta' : 'muralla', x, y, true);
  }
}

// ------------------------------------------------------------ costes y estadísticas (civilización + tecnologías)
function techFx(owner, key) { let v = 0; for (const t of P(owner).techs) { const f = TECHS[t].fx; if (f && f[key]) v += f[key]; } return v; }
function unitCost(owner, type) { const d = UNITS[type], fx = civFx(owner); const c = {}; const mul = (fx.unitCost && fx.unitCost[d.cls]) || 1; for (const k in d.cost) c[k] = Math.round(d.cost[k] * mul); return c; }
function bldCost(owner, type) { const d = BUILDINGS[type], fx = civFx(owner); const c = {}; const mul = (fx.bldCost && fx.bldCost[type]) || (d.farm && fx.farmCost) || 1; for (const k in d.cost) c[k] = Math.round(d.cost[k] * mul); return c; }
function techCost(owner, id) { const d = TECHS[id], fx = civFx(owner); const c = {}; for (const k in d.cost) c[k] = Math.round(d.cost[k] * (1 - (fx.techDiscount || 0))); return c; }
function unitAtk(u) { const d = u.def; let a = d.atk; if (d.rng > 0) a += techFx(u.owner, 'rangeAtk') + (d.cls === 'sit' ? techFx(u.owner, 'siegeAtk') : 0); else if (d.cls === 'inf' || d.cls === 'cab') a += techFx(u.owner, 'meleeAtk'); return a; }
function unitArm(u, pierce) { const d = u.def; let b = (d.cls === 'inf' || d.cls === 'cab') ? techFx(u.owner, 'meleeArm') : d.cls === 'ald' ? techFx(u.owner, 'villArm') : 0; return d.arm[pierce ? 1 : 0] + b; }
function unitRange(u) { const d = u.def; if (d.rng <= 0) return 0; return d.rng + techFx(u.owner, 'range') + (d.cls === 'arc' ? (civFx(u.owner).rangeBonus || 0) : 0); }
function unitSpd(u) { const d = u.def, fx = civFx(u.owner); let s = d.spd; if (fx.spd && fx.spd[d.cls]) s *= 1 + fx.spd[d.cls]; if (d.cls === 'mnk') s *= 1 + techFx(u.owner, 'monkSpd'); if (u.relic) s *= 0.85; return s; }
function unitLos(u) { return u.def.los + (u.type === 'explorador' || u.type === 'jinete' ? (civFx(u.owner).scoutLos || 0) : 0); }
function unitMaxHp(owner, type) { const d = UNITS[type]; return d.hp + (d.cls === 'ald' ? techFx(owner, 'villHp') : 0); }
function bldArm(b, pierce) { return b.def.arm[pierce ? 1 : 0] + techFx(b.owner, 'bldArm'); }
function bldMaxHp(b) { return Math.round(b.def.hp * (1 + techFx(b.owner, 'bldHp') + (civFx(b.owner).bldHp || 0))); }
function bldLos(b) { return (b.def.los || 5) + techFx(b.owner, 'bldLos') + Math.max(b.w, b.h) / 2; }
const popCache = {sim: -1, count: [], cap: []};
function popCount(owner) { if (popCache.sim !== G.sim) { popCache.sim = G.sim; popCache.count = G.players.map(() => 0); popCache.cap = G.players.map(() => 0); for (const u of G.units) popCache.count[u.owner]++; for (const b of G.buildings) { for (const q of b.queue) if (q.kind === 'unit') popCache.count[b.owner]++; popCache.count[b.owner] += b.garrison.length; if (b.built >= 1 && b.def.pop) popCache.cap[b.owner] += b.def.pop; } } return popCache.count[owner]; }
function popCap(owner) { popCount(owner); return Math.min(popCache.cap[owner], MAX_POP); }
function canAfford(owner, cost) { for (const k in cost) if (P(owner).res[k] < cost[k]) return false; return true; }
function pay(owner, cost, sign = -1) { for (const k in cost) P(owner).res[k] += sign * cost[k]; }
function missingRes(owner, cost) { const m = []; for (const k in cost) if (P(owner).res[k] < cost[k]) m.push(RES_ES[k].toLowerCase()); return m; }
function lineUnit(owner, base) { const l = UNITS[base].line; if (!l) return base; return LINES[l][P(owner).lines[l] || 0]; }
function trainsOf(b) { return (b.def.trains || []).map(t => t === 'UNIQUE' ? civOf(b.owner).unique : lineUnit(b.owner, t)); }

// ------------------------------------------------------------ crear / eliminar entidades
function addBuilding(owner, type, tx, ty, complete = false) {
  const def = BUILDINGS[type];
  const b = {id: G.nextId++, kind: 'bld', owner, type, def, tx, ty, w: def.w, h: def.h, x: (tx + def.w / 2) * TILE, y: (ty + def.h / 2) * TILE,
    built: complete ? 1 : 0, hp: 0, queue: [], progress: 0, rally: null, cd: 0, builders: 0, lastHit: -99, garrison: [], closed: false, relics: 0, wonderT: null};
  b.maxHp = bldMaxHp(b); b.hp = complete ? b.maxHp : Math.max(1, b.maxHp * 0.08);
  G.buildings.push(b); G.byId[b.id] = b; G.map.setBuildingTiles(b, b.id);
  if (def.farm && complete) finishFarm(b);
  if (def.wonder && complete) { b.wonderT = b.wonderT ?? WONDER_TIME; }
  for (const u of G.units) if (u.tx >= tx && u.tx < tx + def.w && u.ty >= ty && u.ty < ty + def.h) { const t = freeTileAround(b, u.owner); if (t) { u.x = (t.x + .5) * TILE; u.y = (t.y + .5) * TILE; updateTile(u); } }
  return b;
}
function finishFarm(b) { for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) { const i = G.map.idx(x, y); G.map.terrain[i] = T_FARM; G.map.amount[i] = 60000; } G.map.dirty = true; }
function freeTileAround(b, owner, radius = 6) {
  const tx = b.tx ?? Math.floor(b.x / TILE), ty = b.ty ?? Math.floor(b.y / TILE), w = b.w || 1, h = b.h || 1;
  for (let r = 1; r <= radius; r++) {
    const cands = [];
    for (let y = ty - r; y < ty + h + r; y++) for (let x = tx - r; x < tx + w + r; x++) {
      if (x > tx - r && x < tx + w + r - 1 && y > ty - r && y < ty + h + r - 1) continue;
      if (G.map.passable(x, y, owner)) cands.push({x, y});
    }
    if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
  }
  return null;
}
function spawnUnit(owner, type, from, hero) {
  const def = UNITS[type];
  const t = freeTileAround(from, owner) || {x: from.tx ?? Math.floor(from.x / TILE), y: from.ty ?? Math.floor(from.y / TILE)};
  const hp = unitMaxHp(owner, type);
  const u = {id: G.nextId++, kind: 'unit', owner, type, def, x: (t.x + .5) * TILE + rnd(-6, 6), y: (t.y + .5) * TILE + rnd(-6, 6), hp, maxHp: hp,
    order: null, queue: [], path: [], cd: 0, carry: null, gatherT: 0, scanT: Math.random() * .3, repathT: 0, stuck: 0, lastHit: -99, facing: 1, anim: 0, idleT: 0, stance: def.hero ? 1 : 0, convT: 0, relic: false, fleeT: 0};
  updateTile(u);
  G.units.push(u); G.byId[u.id] = u; if (!def.hero) P(owner).stats.trained++; popCache.sim = -1;
  return u;
}
function updateTile(u) { u.tx = clamp(Math.floor(u.x / TILE), 0, G.map.w - 1); u.ty = clamp(Math.floor(u.y / TILE), 0, G.map.h - 1); }
function removeEntity(e, silent) {
  delete G.byId[e.id]; popCache.sim = -1;
  if (e.kind === 'unit') {
    const i = G.units.indexOf(e); if (i >= 0) G.units.splice(i, 1);
    if (e.relic) { const rl = G.map.relics.find(r => r.carrier === e.id); if (rl) { rl.carrier = 0; rl.x = e.tx; rl.y = e.ty; } }
  } else {
    const i = G.buildings.indexOf(e); if (i >= 0) G.buildings.splice(i, 1);
    for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) { const k = G.map.idx(x, y); G.map.bld[k] = -1; if (G.map.terrain[k] === T_FARM) { G.map.terrain[k] = T_DIRT; G.map.amount[k] = 0; G.map.dirty = true; } }
    for (const q of e.queue) { const c = q.cost; if (c) pay(e.owner, c, 1); }
    // los guarnecidos salen (o mueren si el edificio se destruye con violencia: salen con la mitad de vida)
    for (const u of e.garrison) { u.hp = Math.max(1, u.hp * (silent ? 1 : 0.5)); const t = freeTileAround(e, u.owner) || {x: e.tx, y: e.ty}; u.x = (t.x + .5) * TILE; u.y = (t.y + .5) * TILE; updateTile(u); u.inside = null; G.units.push(u); G.byId[u.id] = u; }
    e.garrison = [];
    for (let k = 0; k < e.relics; k++) { const rl = G.map.relics.find(r => r.holder === e.id); if (rl) { rl.holder = 0; const t = freeTileAround(e, e.owner) || {x: e.tx, y: e.ty}; rl.x = t.x; rl.y = t.y; } }
  }
  for (const u of G.units) { if (u.order && u.order.tid === e.id) { u.order = null; u.path = []; } u.queue = u.queue.filter(o => o.tid !== e.id); }
  for (const b of G.buildings) if (b.rally && b.rally.tid === e.id) b.rally = null;
  if (typeof UI !== 'undefined' && UI.selected) UI.selected = UI.selected.filter(s => s !== e);
}

// ------------------------------------------------------------ geometría y búsqueda
function rectOf(e) { return e.kind === 'bld' ? {x: e.tx * TILE, y: e.ty * TILE, w: e.w * TILE, h: e.h * TILE} : {x: e.x - 9, y: e.y - 9, w: 18, h: 18}; }
function distToEntity(x, y, e) { const r = rectOf(e); const dx = Math.max(r.x - x, 0, x - r.x - r.w), dy = Math.max(r.y - y, 0, y - r.y - r.h); return Math.hypot(dx, dy); }
function tileDistToRect(tx, ty, e) { return distToEntity((tx + .5) * TILE, (ty + .5) * TILE, e); }
function dropOffFor(u, resType) { let best = null, bd = 1e9; for (const b of G.buildings) if (b.owner === u.owner && b.built >= 1 && b.def.drop && b.def.drop.includes(resType)) { const d = distToEntity(u.x, u.y, b); if (d < bd) { bd = d; best = b; } } return best; }
function hostile(a, b) { return !allied(a.owner, b.owner); }
function nearestEnemy(e, rangePx, filter) {
  let best = null, bd = 1e9;
  for (const u of G.units) if (!allied(u.owner, e.owner) && (!filter || filter(u))) { const d = distToEntity(e.x, e.y, u); if (d < bd && d <= rangePx) { bd = d; best = u; } }
  for (const b of G.buildings) if (!allied(b.owner, e.owner) && (!filter || filter(b))) { const d = distToEntity(e.x, e.y, b); if (d < bd && d <= rangePx) { bd = d; best = b; } }
  return best;
}
function nearestBuilding(owner, x, y, filter) { let best = null, bd = 1e9; for (const b of G.buildings) if (b.owner === owner && (!filter || filter(b))) { const d = distToEntity(x, y, b); if (d < bd) { bd = d; best = b; } } return best; }
function garrisonCap(b) { return b.built >= 1 ? (b.def.garrison || 0) : 0; }
function canGarrison(u, b) { if (!allied(u.owner, b.owner) || !garrisonCap(b) || b.garrison.length >= garrisonCap(b)) return false; if (u.def.cls === 'sit') return false; if (b.type !== 'centro' && b.type !== 'castillo' && b.type !== 'torre' && u.def.cls === 'ald') return b.type === 'casa' ? false : true; return true; }

// ------------------------------------------------------------ órdenes
function attackRangePx(u) { return unitRange(u) * TILE + TILE * 0.85; }
function setPath(u, gx, gy, goalFn) { u.path = findPath(G.map, u.tx, u.ty, gx, gy, u.owner, goalFn); u.repathT = 0.8 + Math.random() * 0.4; u.stuck = 0; }
function issue(u, order, queued = false) {
  if (u.hp <= 0 || u.inside) return;
  if (queued && u.order) { u.queue.push(order); return; }
  u.queue = [];
  startOrder(u, order);
}
function startOrder(u, order) {
  u.order = order; u.path = []; u.gatherT = 0; u.convT = 0;
  const m = G.map;
  switch (order.type) {
    case 'move': case 'attackmove': case 'patrol': {
      const gx = clamp(Math.floor(order.x / TILE), 0, m.w - 1), gy = clamp(Math.floor(order.y / TILE), 0, m.h - 1);
      setPath(u, gx, gy, (x, y) => x === gx && y === gy);
      break;
    }
    case 'gather': {
      const t = m.terrain[m.idx(order.tx, order.ty)]; const rt = RES_OF_TILE[t];
      if (!rt) { u.order = null; return; }
      order.res = rt;
      if (u.carry && u.carry.type !== rt && u.carry.amt > 0) u.carry = null;
      setPath(u, order.tx, order.ty, (x, y) => Math.abs(x - order.tx) <= 1 && Math.abs(y - order.ty) <= 1);
      break;
    }
    case 'return': {
      const b = dropOffFor(u, u.carry.type); if (!b) { u.order = null; return; }
      order.tid = b.id;
      setPath(u, b.tx + 1, b.ty + 1, (x, y) => tileDistToRect(x, y, b) < TILE * 0.9);
      break;
    }
    case 'build': case 'repair': case 'garrison': case 'deposit': {
      const b = G.byId[order.tid]; if (!b) { u.order = null; return; }
      setPath(u, b.tx, b.ty, (x, y) => tileDistToRect(x, y, b) < TILE * 0.9);
      break;
    }
    case 'attack': case 'heal': case 'convert': {
      const t = G.byId[order.tid]; if (!t) { u.order = null; return; }
      const r = order.type === 'attack' ? attackRangePx(u) : TILE * 4.5;
      setPath(u, Math.floor(t.x / TILE), Math.floor(t.y / TILE), (x, y) => tileDistToRect(x, y, t) <= r - TILE * 0.35);
      break;
    }
    case 'guard': { const t = G.byId[order.tid]; if (!t) { u.order = null; return; } setPath(u, Math.floor(t.x / TILE), Math.floor(t.y / TILE), (x, y) => tileDistToRect(x, y, t) <= TILE * 2); break; }
    case 'pickrelic': { const rl = G.map.relics[order.ri]; if (!rl || rl.carrier || rl.holder) { u.order = null; return; } setPath(u, rl.x, rl.y, (x, y) => Math.abs(x - rl.x) <= 1 && Math.abs(y - rl.y) <= 1); break; }
  }
}
function nextOrder(u) { u.order = null; u.path = []; if (u.queue.length) startOrder(u, u.queue.shift()); }

// ------------------------------------------------------------ daño y combate
function alertPlayer(owner, x, y, msg) {
  const pl = P(owner); if (!pl.human) return;
  if (G.time - pl.lastAlert > 12) { pl.lastAlert = G.time; log(msg || '¡Nos atacan!', 'warn'); sfx('horn'); }
  if (!G.events.length || dist(G.events[G.events.length - 1].x, G.events[G.events.length - 1].y, x, y) > TILE * 8 || G.time - G.events[G.events.length - 1].t > 10) G.events.push({x, y, t: G.time});
}
function dealDamage(src, target, amount, pierce) {
  if (!target || target.hp <= 0 || !G.byId[target.id]) return;
  const arm = target.kind === 'unit' ? unitArm(target, pierce) : bldArm(target, pierce);
  const dmg = Math.max(1, amount - arm);
  target.hp -= dmg; target.lastHit = G.time;
  if (src && !allied(src.owner, target.owner)) alertPlayer(target.owner, target.x, target.y);
  if (target.kind === 'unit' && src && src.kind === 'unit' && !allied(src.owner, target.owner)) {
    if (target.def.cls === 'ald') {
      // huir: guarnecerse en el centro/torre más cercano o alejarse
      const flee = P(target.owner).human ? OPTS.flee : true;
      if (flee && src.def.cls !== 'ald' && (!target.order || target.order.type !== 'garrison') && G.time - target.fleeT > 6) {
        target.fleeT = G.time;
        const b = nearestBuilding(target.owner, target.x, target.y, x => (x.type === 'centro' || x.type === 'castillo' || x.type === 'torre') && canGarrison(target, x) && distToEntity(target.x, target.y, x) < TILE * 14);
        const prev = target.order;
        if (b) { issue(target, {type: 'garrison', tid: b.id, flee: true}); if (prev && prev.type === 'gather') target.queue.push(prev); }
        else { const tc = nearestBuilding(target.owner, target.x, target.y, x => x.type === 'centro'); if (tc) { issue(target, {type: 'move', x: tc.x + rnd(-40, 40), y: tc.y + rnd(-40, 40)}); if (prev && prev.type === 'gather') target.queue.push(prev); } }
      }
    } else if (target.def.cls !== 'mnk' && target.stance !== 2 && (!target.order || target.order.type === 'move' && !P(target.owner).human || target.order.type === 'guard' || (target.order.type === 'attack' && target.order.auto && G.byId[target.order.tid] && G.byId[target.order.tid].kind === 'bld'))) {
      const o = {type: 'attack', tid: src.id, auto: true, home: target.order && target.order.type === 'guard' ? null : {x: target.x, y: target.y}};
      if (target.order && target.order.type === 'guard') { target.queue.unshift(target.order); startOrder(target, o); } else issue(target, o);
    }
  }
  if (target.kind === 'bld' && src && !allied(src.owner, target.owner)) {
    for (const u of G.units) if (allied(u.owner, target.owner) && u.def.cls !== 'ald' && u.def.cls !== 'mnk' && !u.order && u.stance !== 2 && distToEntity(u.x, u.y, target) < TILE * 9) issue(u, {type: 'attack', tid: src.id, auto: true, home: {x: u.x, y: u.y}});
  }
  if (target.hp <= 0) killEntity(target, src);
}
function killEntity(target, src) {
  if (target.kind === 'unit') {
    P(target.owner).stats.lost++; if (src && !allied(src.owner, target.owner)) P(src.owner).stats.killed++;
    G.fx.push({t: 'death', x: target.x, y: target.y, c: P(target.owner).color, life: 4, type: target.type, owner: target.owner});
    if (target.def.hero) { log(`${target.def.name} ha caído`, 'warn'); G.flags['dead_' + target.type] = true; }
    if (P(target.owner).human) sfx('death');
  } else {
    if (src && !allied(src.owner, target.owner)) P(src.owner).stats.razed++;
    G.fx.push({t: 'ruin', x: target.x, y: target.y, w: target.w, life: 1.2});
    if (P(target.owner).human) { log(`Hemos perdido: ${target.def.name}`, 'warn'); sfx('crumble'); } else if (src && P(src.owner).human) { log(`Destruido: ${target.def.name} de ${P(target.owner).name}`, 'good'); sfx('crumble'); }
    if (target.def.wonder) { log(`¡La Maravilla de ${P(target.owner).name} ha sido destruida!`, src && P(src.owner).human ? 'good' : 'warn'); }
  }
  removeEntity(target);
}
function fireProjectile(src, target, dmg, splash, kind) {
  const tx = target.x, ty = target.y, d = dist(src.x, src.y, tx, ty);
  G.projectiles.push({x: src.x, y: src.y - (src.kind === 'bld' ? src.h * 10 : 8), sx: src.x, sy: src.y, tx, ty, t: 0, dur: Math.max(0.15, d / (kind === 'rock' ? 220 : 420)), src, target, dmg, splash, kind, owner: src.owner});
}
function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i]; p.t += dt;
    const k = Math.min(1, p.t / p.dur);
    p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * (p.kind === 'rock' ? 60 : 18);
    if (k >= 1) {
      G.projectiles.splice(i, 1);
      if (p.splash) {
        G.fx.push({t: 'boom', x: p.tx, y: p.ty, life: 0.5, r: p.splash * TILE}); sfx('boom', p.tx, p.ty);
        for (const e of [...G.units, ...G.buildings]) if (!allied(e.owner, p.owner) && distToEntity(p.tx, p.ty, e) <= p.splash * TILE) dealDamage(p.src, e, e.kind === 'bld' ? p.dmg : Math.round(p.dmg * 0.5), true);
      } else if (p.target && p.target.hp > 0 && G.byId[p.target.id]) {
        if (p.target.kind === 'bld' || dist(p.tx, p.ty, p.target.x, p.target.y) < TILE * 0.9) dealDamage(p.src, p.target, p.dmg, true);
      }
    }
  }
}
function attackTarget(u, t) {
  u.cd = u.def.cd * (u.def.cls === 'sit' ? 1 : 1);
  u.facing = t.x < u.x ? -1 : 1;
  let atk = unitAtk(u);
  const cls = t.kind === 'bld' ? 'bld' : t.def.cls;
  if (u.def.bonus && u.def.bonus[cls]) atk = Math.round(atk * u.def.bonus[cls]);
  else if (t.kind === 'bld' && u.def.cls !== 'sit') atk = Math.max(1, Math.round(atk * (u.def.cls === 'ald' ? 1 : 0.6)));
  if (u.def.rng > 0) { fireProjectile(u, t, atk, u.def.splash, u.def.cls === 'sit' ? 'rock' : 'arrow'); if (u.def.cls === 'arc') sfx('arrow', u.x, u.y); }
  else { dealDamage(u, t, atk, false); G.fx.push({t: 'hit', x: t.x + rnd(-6, 6), y: t.y + rnd(-6, 6), life: 0.25}); sfx(t.kind === 'bld' ? 'thud' : 'clash', u.x, u.y); }
}

// ============================================================ UNIDADES
function moveAlong(u, dt) {
  if (!u.path.length) return false;
  const n = u.path[0], gx = (n.x + .5) * TILE, gy = (n.y + .5) * TILE;
  const d = dist(u.x, u.y, gx, gy);
  let step = unitSpd(u) * dt; if (G.map.terrain[G.map.idx(u.tx, u.ty)] === T_SHALLOW) step *= 0.6;
  if (!G.map.passable(n.x, n.y, u.owner)) { u.stuck += dt; if (u.stuck > 0.3) { u.repathT = 0; u.stuck = 0; } return true; }
  if (d <= step) { u.x = gx; u.y = gy; u.path.shift(); } else { u.x += (gx - u.x) / d * step; u.y += (gy - u.y) / d * step; }
  if (gx !== u.x) u.facing = gx < u.x ? -1 : 1;
  u.anim += dt * 8;
  updateTile(u);
  return true;
}
function approach(u, t, dt) {
  const r = rectOf(t); const px = clamp(u.x, r.x, r.x + r.w), py = clamp(u.y, r.y, r.y + r.h);
  const d = dist(u.x, u.y, px, py); if (d < 1) return;
  const step = Math.min(d, unitSpd(u) * dt); const nx = u.x + (px - u.x) / d * step, ny = u.y + (py - u.y) / d * step;
  if (G.map.passable(Math.floor(nx / TILE), Math.floor(ny / TILE), u.owner) || t.kind === 'bld') { u.x = nx; u.y = ny; updateTile(u); u.anim += dt * 8; }
}
function separate(u, dt) {
  let px = 0, py = 0;
  const cell = G.grid; // rejilla espacial de unidades
  const cx = Math.floor(u.x / 64), cy = Math.floor(u.y / 64);
  for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
    const list = cell.get(gx + ',' + gy); if (!list) continue;
    for (const o of list) {
      if (o === u) continue;
      const dx = u.x - o.x, dy = u.y - o.y; const d2 = dx * dx + dy * dy;
      if (d2 < 22 * 22 && d2 > 0.01) { const d = Math.sqrt(d2); const f = (22 - d) / 22; px += dx / d * f; py += dy / d * f; }
    }
  }
  if (px || py) { const nx = u.x + px * 40 * dt, ny = u.y + py * 40 * dt; if (G.map.passable(Math.floor(nx / TILE), Math.floor(ny / TILE), u.owner)) { u.x = nx; u.y = ny; updateTile(u); } }
}
function buildGrid() { const g = new Map(); for (const u of G.units) { const k = Math.floor(u.x / 64) + ',' + Math.floor(u.y / 64); let l = g.get(k); if (!l) g.set(k, l = []); l.push(u); } G.grid = g; }
function scanTarget(u) {
  const losPx = unitLos(u) * TILE;
  const r = u.stance === 2 ? attackRangePx(u) : u.stance === 1 ? Math.min(losPx, attackRangePx(u) + TILE * 2) : losPx;
  const isAI = !P(u.owner).human;
  // prioridad: unidades enemigas que pueden atacar, luego el resto, luego edificios con ataque; los edificios inertes solo en atacar-mover o IA
  return nearestEnemy(u, r, e => e.kind === 'unit' ? (e.def.cls !== 'ald' || isAI || u.order) : (e.def.atk || isAI || (u.order && u.order.type === 'attackmove')) && !(e.def.wall && !isAI));
}
function updateUnit(u, dt) {
  u.cd = Math.max(0, u.cd - dt); u.repathT -= dt; u.scanT -= dt;
  const regen = (u.def.regen || 0) + (civFx(u.owner).regen || 0);
  if (regen && u.hp < u.maxHp && G.time - u.lastHit > 5) u.hp = Math.min(u.maxHp, u.hp + regen * dt);
  const o = u.order, m = G.map;
  if (!o) {
    u.idleT += dt;
    if (u.def.cls !== 'ald' && u.def.cls !== 'mnk' && u.scanT <= 0) { u.scanT = 0.35; const e = scanTarget(u); if (e) issue(u, {type: 'attack', tid: e.id, auto: true, home: {x: u.x, y: u.y}}); }
    if (u.def.cls === 'mnk' && u.scanT <= 0) { u.scanT = 0.5; let best = null, bd = 1e9; for (const a of G.units) if (allied(a.owner, u.owner) && a !== u && a.hp < a.maxHp * 0.9 && !a.inside) { const d = dist(u.x, u.y, a.x, a.y); if (d < TILE * 8 && d < bd) { bd = d; best = a; } } if (best) issue(u, {type: 'heal', tid: best.id, auto: true}); }
    if (u.def.cls === 'ald' && u.carry && u.carry.amt > 0 && dropOffFor(u, u.carry.type)) issue(u, {type: 'return'});
    separate(u, dt);
    return;
  }
  u.idleT = 0;
  switch (o.type) {
    case 'move': {
      if (u.path.length) { moveAlong(u, dt); if (u.repathT <= 0) { const gx = Math.floor(o.x / TILE), gy = Math.floor(o.y / TILE); setPath(u, gx, gy, (x, y) => x === gx && y === gy); } }
      else nextOrder(u);
      separate(u, dt); break;
    }
    case 'patrol': {
      if (u.def.cls !== 'ald' && u.scanT <= 0) { u.scanT = 0.3; const e = scanTarget(u); if (e) { u.queue.unshift(o); startOrder(u, {type: 'attack', tid: e.id, auto: true}); break; } }
      if (u.path.length) moveAlong(u, dt); else { u.queue.unshift({type: 'patrol', x: o.px, y: o.py, px: o.x, py: o.y}); nextOrder(u); }
      separate(u, dt); break;
    }
    case 'attackmove': {
      if (u.scanT <= 0 && u.def.cls !== 'ald' && u.def.cls !== 'mnk') { u.scanT = 0.3; const e = scanTarget(u); if (e) { u.queue.unshift(o); startOrder(u, {type: 'attack', tid: e.id, auto: true}); break; } }
      if (u.path.length) moveAlong(u, dt); else nextOrder(u);
      separate(u, dt); break;
    }
    case 'guard': {
      const t = G.byId[o.tid]; if (!t) { nextOrder(u); break; }
      if (u.def.cls !== 'ald' && u.scanT <= 0) { u.scanT = 0.3; const e = nearestEnemy(t, TILE * 7, e => e.kind === 'unit' || e.def.atk); if (e) { u.queue.unshift(o); startOrder(u, {type: 'attack', tid: e.id, auto: true}); break; } }
      const d = distToEntity(u.x, u.y, t);
      if (d > TILE * 2.5) { if (u.repathT <= 0 || !u.path.length) setPath(u, Math.floor(t.x / TILE), Math.floor(t.y / TILE), (x, y) => tileDistToRect(x, y, t) <= TILE * 2); moveAlong(u, dt); } else u.path = [];
      separate(u, dt); break;
    }
    case 'attack': {
      const t = G.byId[o.tid];
      if (!t || t.hp <= 0 || t.inside) { nextOrder(u); break; }
      const d = distToEntity(u.x, u.y, t), r = attackRangePx(u);
      if (u.def.minRng && d < u.def.minRng * TILE && t.kind === 'unit') { // asedio: demasiado cerca, retroceder
        const ang = Math.atan2(u.y - t.y, u.x - t.x); const nx = u.x + Math.cos(ang) * unitSpd(u) * dt, ny = u.y + Math.sin(ang) * unitSpd(u) * dt; if (m.passable(Math.floor(nx / TILE), Math.floor(ny / TILE), u.owner)) { u.x = nx; u.y = ny; updateTile(u); } break;
      }
      if (d <= r) { u.path = []; if (u.cd <= 0) attackTarget(u, t); if (u.def.rng > 0 && t.kind === 'unit') separate(u, dt); }
      else {
        if (o.auto && (u.stance === 2 || (u.stance === 1 && o.home && dist(u.x, u.y, o.home.x, o.home.y) > TILE * 4) || (o.home && dist(u.x, u.y, o.home.x, o.home.y) > TILE * 14))) { if (o.home && u.stance !== 2) u.queue.unshift({type: 'move', x: o.home.x, y: o.home.y}); nextOrder(u); break; }
        if (u.repathT <= 0 || !u.path.length) { if (u.repathT <= 0) setPath(u, Math.floor(t.x / TILE), Math.floor(t.y / TILE), (x, y) => tileDistToRect(x, y, t) <= r - TILE * 0.35); if (!u.path.length && d > r) { if (d < r + TILE * 1.5) approach(u, t, dt); else { u.stuck += dt; if (u.stuck > 6) { nextOrder(u); break; } } } }
        moveAlong(u, dt); separate(u, dt);
      }
      break;
    }
    case 'heal': {
      const t = G.byId[o.tid]; if (!t || t.inside || t.hp >= t.maxHp) { nextOrder(u); break; }
      const d = distToEntity(u.x, u.y, t);
      if (d <= TILE * 4) { u.path = []; t.hp = Math.min(t.maxHp, t.hp + 4 * (1 + techFx(u.owner, 'heal')) * dt); u.anim += dt * 3; if (Math.floor(G.time * 2) !== Math.floor((G.time - dt) * 2)) G.fx.push({t: 'heal', x: t.x, y: t.y, life: 0.5}); }
      else { if (u.repathT <= 0 || !u.path.length) { if (u.repathT <= 0) setPath(u, Math.floor(t.x / TILE), Math.floor(t.y / TILE), (x, y) => tileDistToRect(x, y, t) <= TILE * 3.5); if (!u.path.length && d < TILE * 5.5) approach(u, t, dt); } moveAlong(u, dt); separate(u, dt); }
      break;
    }
    case 'convert': {
      const t = G.byId[o.tid]; if (!t || t.inside || allied(t.owner, u.owner) || t.def.hero || t.kind === 'bld') { nextOrder(u); break; }
      const d = distToEntity(u.x, u.y, t);
      if (u.cd > 0) { if (d > TILE * 5) { moveAlong(u, dt); } break; }
      if (d <= TILE * 4.5) {
        u.path = []; u.facing = t.x < u.x ? -1 : 1;
        const need = (8 + Math.random() * 0.01) * (civFx(u.owner).convertMul || 1) * (1 + techFx(t.owner, 'faith')) * (t.def.cls === 'sit' ? 1.5 : 1);
        u.convT += dt; if (Math.floor(G.time * 3) !== Math.floor((G.time - dt) * 3)) G.fx.push({t: 'conv', x: t.x, y: t.y, life: 0.4});
        if (u.convT >= need) {
          const old = t.owner; t.owner = u.owner; t.order = null; t.queue = []; t.path = []; t.carry = null; t.convT = 0; t.stance = 0;
          P(u.owner).stats.converted++; P(old).stats.lost++;
          if (P(u.owner).human) log(`¡Convertido: ${t.def.name}!`, 'good'); else if (P(old).human) log(`El enemigo ha convertido a tu ${t.def.name}`, 'warn');
          sfx('convert', t.x, t.y); G.fx.push({t: 'heal', x: t.x, y: t.y, life: 0.8});
          u.cd = 30; u.convT = 0; nextOrder(u);
          if (typeof UI !== 'undefined') UI.selected = UI.selected.filter(s => s !== t);
        }
      } else { u.convT = Math.max(0, u.convT - dt); if (u.repathT <= 0 || !u.path.length) { if (u.repathT <= 0) setPath(u, Math.floor(t.x / TILE), Math.floor(t.y / TILE), (x, y) => tileDistToRect(x, y, t) <= TILE * 4); if (!u.path.length && d < TILE * 6) approach(u, t, dt); } moveAlong(u, dt); separate(u, dt); }
      break;
    }
    case 'pickrelic': {
      const rl = m.relics[o.ri]; if (!rl || rl.carrier || rl.holder || u.relic) { nextOrder(u); break; }
      if (Math.abs(u.tx - rl.x) <= 1 && Math.abs(u.ty - rl.y) <= 1) { rl.carrier = u.id; u.relic = true; if (P(u.owner).human) log('Reliquia recogida. Llévala a un monasterio.', 'good'); sfx('chime'); const mo = nearestBuilding(u.owner, u.x, u.y, b => b.def.relics && b.built >= 1); nextOrder(u); if (mo && !u.order) issue(u, {type: 'deposit', tid: mo.id}); }
      else { if (!u.path.length && u.repathT <= 0) startOrder(u, o); moveAlong(u, dt); separate(u, dt); }
      break;
    }
    case 'deposit': {
      const b = G.byId[o.tid]; if (!b || !u.relic || !b.def.relics || b.built < 1) { nextOrder(u); break; }
      if (distToEntity(u.x, u.y, b) < TILE * 1.2) { const rl = m.relics.find(r => r.carrier === u.id); if (rl) { rl.carrier = 0; rl.holder = b.id; b.relics++; } u.relic = false; if (P(u.owner).human) log('Reliquia depositada: +oro constante', 'good'); sfx('fanfare2'); nextOrder(u); }
      else { if (!u.path.length && u.repathT <= 0) startOrder(u, o); if (!u.path.length) approach(u, b, dt); moveAlong(u, dt); separate(u, dt); }
      break;
    }
    case 'garrison': {
      const b = G.byId[o.tid]; if (!b || !canGarrison(u, b)) { nextOrder(u); break; }
      if (distToEntity(u.x, u.y, b) < TILE * 1.2) { enterBuilding(u, b); break; }
      if (!u.path.length && u.repathT <= 0) startOrder(u, o); if (!u.path.length) { if (distToEntity(u.x, u.y, b) < TILE * 2.5) approach(u, b, dt); else { u.stuck += dt; if (u.stuck > 6) { nextOrder(u); break; } } }
      moveAlong(u, dt); separate(u, dt); break;
    }
    case 'gather': {
      const i = m.idx(o.tx, o.ty), t = m.terrain[i];
      if (RES_OF_TILE[t] !== o.res || m.amount[i] <= 0 || (t === T_FARM && !(G.byId[m.bld[i]] && G.byId[m.bld[i]].owner === u.owner))) {
        const nr = m.nearestResource(o.tx, o.ty, o.res, 12, u.owner);
        if (nr) startOrder(u, {type: 'gather', tx: nr.x, ty: nr.y}); else { if (u.carry && u.carry.amt > 0) startOrder(u, {type: 'return'}); else nextOrder(u); }
        break;
      }
      if (Math.abs(u.tx - o.tx) <= 1 && Math.abs(u.ty - o.ty) <= 1 && !u.path.length) {
        u.facing = o.tx * TILE + 16 < u.x ? -1 : 1;
        const cap = 10 + techFx(u.owner, 'carry');
        if (!u.carry || u.carry.type !== o.res) u.carry = {type: o.res, amt: 0};
        if (u.carry.amt >= cap) { u.queue.unshift(o); startOrder(u, {type: 'return'}); break; }
        const fx = civFx(u.owner); const gm = (fx.gather && fx.gather[o.res]) || 0;
        let base = {food: t === T_FARM ? 0.5 * (1 + techFx(u.owner, 'farm')) : 0.62, wood: 0.6 * (1 + techFx(u.owner, 'gatherWood')), stone: 0.55 * (1 + techFx(u.owner, 'gatherMine')), gold: 0.55 * (1 + techFx(u.owner, 'gatherMine'))}[o.res];
        base *= (1 + techFx(u.owner, 'gather') + gm) * (P(u.owner).ai ? P(u.owner).ai.eco : 1);
        u.gatherT += dt * base; u.anim += dt * 6;
        if (u.gatherT >= 1) { const n = Math.floor(u.gatherT); u.gatherT -= n; const take = Math.min(n, m.amount[i]); u.carry.amt += take; if (t !== T_FARM) m.amount[i] -= take; if (t === T_TREE) m.dirty = true; if (m.amount[i] <= 0) { if (t !== T_FARM) m.terrain[i] = T_DIRT; m.dirty = true; } }
      } else {
        if (!u.path.length && u.repathT <= 0) setPath(u, o.tx, o.ty, (x, y) => Math.abs(x - o.tx) <= 1 && Math.abs(y - o.ty) <= 1);
        if (!u.path.length && u.repathT > 0) { u.stuck += dt; if (u.stuck > 3) { const nr = m.nearestResource(u.tx, u.ty, o.res, 12, u.owner); if (nr && (nr.x !== o.tx || nr.y !== o.ty)) startOrder(u, {type: 'gather', tx: nr.x, ty: nr.y}); else nextOrder(u); break; } }
        moveAlong(u, dt); separate(u, dt);
      }
      break;
    }
    case 'return': {
      const b = G.byId[o.tid];
      if (!b || !u.carry) { nextOrder(u); break; }
      if (distToEntity(u.x, u.y, b) < TILE * 0.95) { P(u.owner).res[u.carry.type] += u.carry.amt; P(u.owner).stats.gathered += u.carry.amt; u.carry = null; nextOrder(u); }
      else { if (!u.path.length && u.repathT <= 0) startOrder(u, o); if (!u.path.length) approach(u, b, dt); moveAlong(u, dt); separate(u, dt); }
      break;
    }
    case 'build': case 'repair': {
      const b = G.byId[o.tid];
      if (!b || (o.type === 'build' && b.built >= 1) || (o.type === 'repair' && b.hp >= b.maxHp)) {
        if (b && o.type === 'build' && b.built >= 1) {
          if (b.def.farm) { startOrder(u, {type: 'gather', tx: b.tx, ty: b.ty}); break; }
          if (b.def.drop && !u.queue.length && b.type !== 'centro') { let nr = null; for (const rt of (b.type === 'mina' ? ['gold', 'stone'] : b.def.drop)) { nr = G.map.nearestResource(b.tx, b.ty, rt, 8, u.owner); if (nr) break; } if (nr) { startOrder(u, {type: 'gather', tx: nr.x, ty: nr.y}); break; } }
        }
        nextOrder(u); break;
      }
      if (distToEntity(u.x, u.y, b) < TILE * 0.95) {
        u.path = []; u.anim += dt * 6; u.facing = b.x < u.x ? -1 : 1;
        if (o.type === 'build') { const rate = 1 / b.def.time * (1 / (1 + 0.3 * Math.max(0, b.builders))); b.builders++; b.built = Math.min(1, b.built + rate * dt); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.92 * rate * dt); if (b.built >= 1) onBuilt(b); if (Math.random() < dt * 2) sfx('hammer', u.x, u.y); }
        else { const cost = bldCost(u.owner, b.type); const rate = 1 / b.def.time * 1.5; const heal = b.maxHp * rate * dt; let ok = true; for (const k in cost) { const c = cost[k] * 0.25 * rate * dt; if (P(u.owner).res[k] < c) ok = false; else P(u.owner).res[k] -= c; } if (ok) b.hp = Math.min(b.maxHp, b.hp + heal); else { if (P(u.owner).human) log('Sin recursos para reparar', 'warn'); nextOrder(u); } }
      } else { if (!u.path.length && u.repathT <= 0) startOrder(u, o); if (!u.path.length) { if (distToEntity(u.x, u.y, b) < TILE * 2) approach(u, b, dt); else { u.stuck += dt; if (u.stuck > 6) { nextOrder(u); break; } } } moveAlong(u, dt); separate(u, dt); }
      break;
    }
  }
}
function onBuilt(b) {
  b.built = 1; b.hp = b.maxHp;
  if (b.def.farm) finishFarm(b);
  if (b.def.wonder) { b.wonderT = WONDER_TIME; log(`¡${P(b.owner).name} ha completado una Maravilla! Cuenta atrás: ${Math.round(WONDER_TIME / 60)} minutos`, P(b.owner).human ? 'good' : 'warn'); sfx('fanfare'); }
  if (P(b.owner).human && !b.def.wall) { log(`${b.def.name} terminado`, 'good'); sfx('chime'); }
}
function enterBuilding(u, b) {
  u.order = null; u.queue = u.queue.filter(q => q.type === 'gather'); u.path = []; u.inside = b.id;
  const i = G.units.indexOf(u); if (i >= 0) G.units.splice(i, 1);
  b.garrison.push(u); popCache.sim = -1;
  if (typeof UI !== 'undefined') UI.selected = UI.selected.filter(s => s !== u);
}
function ungarrison(b, only) {
  const out = only ? b.garrison.filter(only) : b.garrison.slice();
  b.garrison = b.garrison.filter(u => !out.includes(u)); popCache.sim = -1;
  for (const u of out) { const t = freeTileAround(b, u.owner) || {x: b.tx, y: b.ty}; u.x = (t.x + .5) * TILE + rnd(-6, 6); u.y = (t.y + .5) * TILE + rnd(-6, 6); updateTile(u); u.inside = null; G.units.push(u); G.byId[u.id] = u; u.fleeT = G.time; if (u.queue.length) nextOrder(u); }
  return out;
}
function townBell(owner) {
  const pl = P(owner);
  if (!pl.bell) {
    let n = 0;
    for (const u of G.units.slice()) if (u.owner === owner && u.def.cls === 'ald') { const b = nearestBuilding(owner, u.x, u.y, x => canGarrison(u, x) && (x.type === 'centro' || x.type === 'castillo' || x.type === 'torre')); if (b) { const prev = u.order; issue(u, {type: 'garrison', tid: b.id, flee: true}); if (prev && prev.type === 'gather') u.queue.push(prev); n++; } }
    pl.bell = true; if (pl.human) { log(`Campana: ${n} aldeanos corren a refugiarse`, 'warn'); sfx('bell'); }
  } else {
    for (const b of G.buildings) if (b.owner === owner && b.garrison.length) ungarrison(b, u => u.def.cls === 'ald');
    for (const u of G.units) if (u.owner === owner && u.order && u.order.type === 'garrison' && u.order.flee) nextOrder(u);
    pl.bell = false; if (pl.human) { log('Los aldeanos vuelven al trabajo', 'good'); sfx('bell'); }
  }
}

// ============================================================ EDIFICIOS
function queueCost(owner, item) { return item.kind === 'unit' ? unitCost(owner, item.id) : item.kind === 'tech' ? techCost(owner, item.id) : AGE_COST[item.id]; }
function enqueue(b, item, owner) {
  if (b.queue.length >= 10 || b.built < 1) return false;
  const cost = queueCost(owner, item);
  if (!canAfford(owner, cost)) { if (P(owner).human) log('Faltan recursos: ' + missingRes(owner, cost).join(', '), 'warn'); return false; }
  if (item.kind === 'unit' && popCount(owner) >= popCap(owner)) { if (P(owner).human) log('Necesitas más casas', 'warn'); return false; }
  if (item.kind === 'tech' && (P(owner).techs.has(item.id) || G.buildings.some(o => o.owner === owner && o.queue.some(q => q.kind === 'tech' && q.id === item.id)))) return false;
  if (item.kind === 'age' && G.buildings.some(o => o.owner === owner && o.queue.some(q => q.kind === 'age'))) return false;
  pay(owner, cost); item.cost = cost; popCache.sim = -1;
  item.t = item.kind === 'unit' ? UNITS[item.id].time * (UNITS[item.id].cls !== 'ald' ? 1 - techFx(owner, 'trainSpd') : 1) : item.kind === 'tech' ? TECHS[item.id].time : AGE_TIME[item.id];
  b.queue.push(item);
  return true;
}
function dequeue(b, i) { const q = b.queue[i]; if (!q) return; popCache.sim = -1; pay(b.owner, q.cost, 1); b.queue.splice(i, 1); if (i === 0) b.progress = 0; }
function applyTech(owner, id) {
  const pl = P(owner), t = TECHS[id]; pl.techs.add(id);
  if (t.line) { pl.lines[t.line] = Math.max(pl.lines[t.line] || 0, t.level); const nt = LINES[t.line][t.level]; for (const u of G.units) if (u.owner === owner && u.def.line === t.line) { const k = u.hp / u.maxHp; u.type = nt; u.def = UNITS[nt]; u.maxHp = unitMaxHp(owner, nt); u.hp = Math.round(u.maxHp * k); } for (const b of G.buildings) for (const g of b.garrison) if (g.owner === owner && g.def.line === t.line) { g.type = nt; g.def = UNITS[nt]; g.maxHp = unitMaxHp(owner, nt); g.hp = g.maxHp; } }
  if (t.fx && (t.fx.villHp)) for (const u of G.units) if (u.owner === owner && u.def.cls === 'ald') { u.maxHp = unitMaxHp(owner, 'aldeano'); u.hp += t.fx.villHp; }
  if (t.fx && t.fx.spy) { for (const b of G.buildings) if (!allied(b.owner, owner)) G.map.reveal(b.x / TILE, b.y / TILE, Math.max(b.w, b.h) / 2 + 1); }
  for (const o of G.buildings) if (o.owner === owner) { const k = o.hp / o.maxHp; o.maxHp = bldMaxHp(o); o.hp = Math.round(o.maxHp * k); }
  if (pl.human) { log(`Investigado: ${t.name}`, 'good'); sfx('fanfare2'); }
}
function updateBuilding(b, dt) {
  b.builders = 0;
  if (b.built < 1) return;
  if (b.queue.length) {
    const q = b.queue[0];
    if (q.kind === 'unit' && popCount(b.owner) - b.queue.filter(x => x.kind === 'unit').length >= popCap(b.owner)) { /* bloqueado */ }
    else {
      b.progress += dt;
      if (b.progress >= q.t) {
        b.progress = 0; b.queue.shift();
        if (q.kind === 'unit') { const u = spawnUnit(b.owner, lineUnit(b.owner, q.id) === q.id ? q.id : lineUnit(b.owner, q.id), b); applyRally(b, u); }
        else if (q.kind === 'tech') applyTech(b.owner, q.id);
        else if (q.kind === 'age') { P(b.owner).age = q.id; log(P(b.owner).human ? `¡Has alcanzado la ${AGES[q.id]}!` : `${P(b.owner).name} ha alcanzado la ${AGES[q.id]}`, P(b.owner).human ? 'good' : 'info'); if (P(b.owner).human) sfx('fanfare'); }
      }
    }
  }
  // reliquias
  if (b.relics) P(b.owner).res.gold += 0.5 * b.relics * dt * (civFx(b.owner).relicGold || 1);
  // maravilla
  if (b.def.wonder && b.wonderT !== null) { b.wonderT -= dt; if (b.wonderT <= 0) { endGame(allied(b.owner, HUMAN), `La Maravilla de ${P(b.owner).name} ha resistido. La historia recordará este reinado.`); b.wonderT = null; } }
  // disparos
  if (b.def.atk) {
    b.cd -= dt;
    if (b.cd <= 0) {
      const rng = (b.def.rng + techFx(b.owner, 'range')) * TILE + Math.max(b.w, b.h) * TILE / 2;
      const rate = 1.8 / (1 + techFx(b.owner, 'towerRate'));
      let shots = (b.def.multi || 1) + (b.type === 'centro' ? (civFx(b.owner).tcArrows || 0) : 0);
      for (const g of b.garrison) if (g.def.cls === 'arc' || g.def.cls === 'ald') shots++;
      let fired = 0; const targets = [];
      for (const u of G.units) if (!allied(u.owner, b.owner) && distToEntity(b.x, b.y, u) <= rng) targets.push(u);
      targets.sort((a, c) => distToEntity(b.x, b.y, a) - distToEntity(b.x, b.y, c));
      for (let k = 0; k < shots && targets.length; k++) { fireProjectile(b, targets[k % targets.length], b.def.atk + techFx(b.owner, 'rangeAtk'), 0, 'arrow'); fired++; }
      if (!fired && b.type !== 'centro') for (const o of G.buildings) if (!allied(o.owner, b.owner) && distToEntity(b.x, b.y, o) <= rng) { fireProjectile(b, o, b.def.atk, 0, 'arrow'); break; }
      b.cd = rate;
    }
  }
  // curación de guarnecidos
  for (const g of b.garrison) if (g.hp < g.maxHp) g.hp = Math.min(g.maxHp, g.hp + 1.5 * dt);
}
function applyRally(b, u) {
  const r = b.rally; if (!r) return;
  if (r.tid) { const t = G.byId[r.tid]; if (!t) return; if (t.kind === 'bld' && allied(t.owner, b.owner)) issue(u, t.def.farm ? {type: 'gather', tx: t.tx, ty: t.ty} : t.built < 1 ? {type: 'build', tid: t.id} : canGarrison(u, t) ? {type: 'garrison', tid: t.id} : {type: 'move', x: t.x, y: t.y}); else if (!allied(t.owner, b.owner)) issue(u, u.def.cls === 'ald' ? {type: 'move', x: t.x, y: t.y} : {type: 'attack', tid: t.id}); else issue(u, {type: 'guard', tid: t.id}); }
  else if (r.res && u.def.cls === 'ald') issue(u, {type: 'gather', tx: r.tx, ty: r.ty});
  else issue(u, {type: u.def.cls === 'ald' || u.def.cls === 'mnk' ? 'move' : 'attackmove', x: r.x, y: r.y});
}
// mercado
function marketPrice(owner, res, buy) { const pl = P(owner); const base = pl.market[res]; const fee = 0.3 * (civFx(owner).marketRate || 1) * (1 - techFx(owner, 'marketRate') * 0.5); return Math.max(10, Math.round(buy ? base * (1 + fee) : base * (1 - fee))); }
function marketTrade(owner, res, buy) {
  const pl = P(owner); const price = marketPrice(owner, res, buy);
  if (buy) { if (pl.res.gold < price) { if (pl.human) log('No tienes oro suficiente', 'warn'); return false; } pl.res.gold -= price; pl.res[res] += 100; pl.market[res] = Math.min(9999, Math.round(pl.market[res] * 1.08)); }
  else { if (pl.res[res] < 100) { if (pl.human) log(`No tienes 100 de ${RES_ES[res].toLowerCase()}`, 'warn'); return false; } pl.res[res] -= 100; pl.res.gold += price; pl.market[res] = Math.max(15, Math.round(pl.market[res] * 0.92)); }
  if (pl.human) sfx('coin');
  return true;
}
function updateMarkets(dt) { for (const pl of G.players) for (const k of ['food', 'wood', 'stone']) { const base = k === 'stone' ? 130 : 100; pl.market[k] += (base - pl.market[k]) * 0.01 * dt; } }

// ============================================================ SIMULACIÓN
function simulate(dt) {
  G.time += dt; G.sim++;
  pathBudget = 0;
  buildGrid();
  for (const u of G.units) updateUnit(u, dt);
  for (const b of G.buildings) updateBuilding(b, dt);
  updateProjectiles(dt); updateMarkets(dt);
  for (let i = G.fx.length - 1; i >= 0; i--) { G.fx[i].life -= dt; if (G.fx[i].life <= 0) G.fx.splice(i, 1); }
  for (const pl of G.players) if (pl.ai && pl.alive) pl.ai.update(dt);
  G.fogT = (G.fogT || 0) - dt; if (G.fogT <= 0) { G.fogT = 0.25; recomputeFog(); }
  if (G.sim % 300 === 0) recordHistory();
  if (G.mission) updateMission(dt);
  checkPlayersAlive();
}
function recomputeFog() {
  const m = G.map; m.visible.fill(0);
  for (const u of G.units) if (allied(u.owner, HUMAN)) m.reveal(u.x / TILE, u.y / TILE, unitLos(u));
  for (const b of G.buildings) if (allied(b.owner, HUMAN)) m.reveal(b.x / TILE, b.y / TILE, bldLos(b));
  if (G.revealAll) { m.visible.fill(1); m.explored.fill(1); }
}
function score(owner) { let s = 0; for (const u of G.units) if (u.owner === owner) s += Object.values(u.def.cost).reduce((a, b) => a + b, 0) / 10; for (const b of G.buildings) if (b.owner === owner) s += Object.values(b.def.cost).reduce((a, b) => a + b, 0) / 10 * b.built + b.garrison.length; s += P(owner).techs.size * 20 + P(owner).age * 100 + P(owner).stats.gathered / 40; return Math.round(s); }
function recordHistory() { G.history.push({t: G.time, s: G.players.map(pl => pl.alive ? score(pl.id) : 0)}); }
function playerAlive(p) { return G.buildings.some(b => b.owner === p && !b.def.wall && !b.def.gate && !b.def.farm) || G.units.some(u => u.owner === p && (u.def.cls === 'ald' || u.def.hero)); }
function checkPlayersAlive() {
  if (G.over) return;
  for (const pl of G.players) if (pl.alive && !pl.immortal && !playerAlive(pl.id)) { pl.alive = false; log(`${pl.name} ha sido eliminado`, pl.human ? 'warn' : 'good'); for (const u of G.units.slice()) if (u.owner === pl.id) removeEntity(u, true); for (const b of G.buildings.slice()) if (b.owner === pl.id) removeEntity(b, true); }
  if (G.mission) return; // la misión decide victoria y derrota
  const humanAlive = P(HUMAN).alive;
  const enemiesAlive = G.players.some(pl => pl.alive && !allied(pl.id, HUMAN));
  if (!humanAlive) endGame(false, 'Tu ciudad ha caído. Pero en esta tierra los reinos se reconstruyen tantas veces como haga falta.');
  else if (!enemiesAlive) endGame(true, 'Todos los reinos rivales han sido sometidos. Tu nombre correrá por las crónicas de Hispania.');
}
