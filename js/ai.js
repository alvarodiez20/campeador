// ============================================================ INTELIGENCIA ARTIFICIAL
const PERSONALITIES = {
  equilibrado: {name: 'equilibrado', villMul: 1, attackMul: 1, gapMul: 1, towers: 1, wonder: false},
  agresivo:    {name: 'agresivo', villMul: 0.8, attackMul: 0.6, gapMul: 0.75, towers: 0.5, wonder: false},
  economico:   {name: 'económico', villMul: 1.25, attackMul: 1.5, gapMul: 1.2, towers: 0.7, wonder: true},
  defensivo:   {name: 'defensivo', villMul: 1, attackMul: 1.3, gapMul: 1.3, towers: 2.5, wonder: true},
};
class AI {
  constructor(owner, diff, personality) {
    this.owner = owner; this.diff = diff;
    this.pers = PERSONALITIES[personality] || PERSONALITIES[pick(Object.keys(PERSONALITIES))];
    this.eco = [0.8, 1.0, 1.25, 1.6][diff];
    const vt = [[12, 16, 20, 22], [18, 24, 30, 34], [20, 28, 34, 38], [22, 30, 38, 42]][diff];
    this.villTarget = vt.map(v => Math.round(v * this.pers.villMul));
    this.firstAttack = [600, 420, 300, 200][diff] * this.pers.attackMul;
    this.waveGap = [150, 120, 95, 75][diff] * this.pers.gapMul;
    this.tick = 0; this.wave = 0; this.nextAttack = this.firstAttack; this.farmCount = 0; this.towerT = 200 / this.pers.towers; this.saving = false;
    this.scoutPts = []; this.campaign = null; this.passiveUntil = 0; this.bellT = 0; this.attackGroup = null; this.expandT = 600;
  }
  get pl() { return P(this.owner); }
  get mine() { return G.buildings.filter(b => b.owner === this.owner); }
  get vills() { return G.units.filter(u => u.owner === this.owner && u.def.cls === 'ald'); }
  get army() { return G.units.filter(u => u.owner === this.owner && u.def.cls !== 'ald' && u.def.cls !== 'mnk' && !u.def.hero); }
  get monks() { return G.units.filter(u => u.owner === this.owner && u.def.cls === 'mnk'); }
  enemies() { return G.players.filter(p => p.alive && !allied(p.id, this.owner)); }
  update(dt) {
    this.tick += dt;
    if (this.tick < 1) return;
    this.tick = 0;
    if (this.disabled) return;
    const tc = this.mine.find(b => b.type === 'centro' && b.built >= 1);
    this.tc = tc;
    if (!tc) this.rebuildTC();
    this.manageVillagers();
    this.manageBuildings();
    this.manageProduction();
    this.manageArmy();
    this.manageResearch();
    this.manageMarket();
    this.manageMonks();
    this.manageScout();
    this.manageGarrison();
  }
  rebuildTC() {
    const v = this.vills; if (!v.length) return;
    const site = this.mine.find(b => b.type === 'centro' && b.built < 1);
    if (site) { this.assignBuilders(site, 3); return; }
    if (canAfford(this.owner, bldCost(this.owner, 'centro'))) { const s = this.findSpot(3, 3, v[0].tx, v[0].ty, 10, 1); if (s) this.build('centro', s.x, s.y, 3); }
  }
  // ---------- economía
  manageVillagers() {
    const v = this.vills; if (!v.length) return;
    const age = this.pl.age; const r = this.pl.res;
    const ratio = [{food: .5, wood: .4, gold: .1, stone: 0}, {food: .4, wood: .32, gold: .2, stone: .08}, {food: .34, wood: .3, gold: .26, stone: .1}, {food: .32, wood: .28, gold: .3, stone: .1}][age];
    const nextAge = AGE_COST[age + 1];
    if (nextAge) for (const k in nextAge) if (r[k] < nextAge[k]) ratio[k] += 0.12;
    if (r.wood < 60 && G.time > 120) ratio.wood += 0.1;
    if (this.pers.towers >= 2 || this.pers.wonder) ratio.stone += 0.05;
    for (const k of RES) { if (r[k] > 1500) ratio[k] *= 0.15; else if (r[k] > 700) ratio[k] *= 0.5; }
    if (r.food < 150) ratio.food += 0.1;
    { const sum = RES.reduce((a, k) => a + ratio[k], 0); for (const k of RES) ratio[k] /= sum; }
    const counts = {food: 0, wood: 0, stone: 0, gold: 0};
    for (const u of v) if (u.order && (u.order.type === 'gather' || u.order.type === 'return')) { const res = u.order.res || (u.carry && u.carry.type) || (u.queue[0] && u.queue[0].res); if (res) counts[res]++; }
    const total = v.length;
    const idle = v.filter(u => !u.order);
    const rebalance = Math.floor(G.time) % 8 === 0;
    const pool = idle.length ? idle : rebalance ? [this.mostOverstaffed(v, counts, ratio, total)].filter(Boolean) : [];
    for (const u of pool) {
      let best = null, bd = -1e9;
      for (const k of RES) { const d = ratio[k] * total - counts[k]; if (d > bd) { bd = d; best = k; } }
      if (!this.sendToGather(u, best)) { for (const k of ['wood', 'food', 'gold', 'stone']) if (k !== best && this.sendToGather(u, k)) { best = k; break; } }
      counts[best]++;
    }
  }
  mostOverstaffed(v, counts, ratio, total) {
    let worst = null, wd = 0;
    for (const k of RES) { const d = counts[k] - ratio[k] * total; if (d > wd + 1.5) { wd = d; worst = k; } }
    if (!worst) return null;
    return v.find(u => u.order && u.order.type === 'gather' && u.order.res === worst && (!u.carry || u.carry.amt < 3));
  }
  sendToGather(u, res) {
    const base = this.tc || this.mine[0]; if (!base) return false;
    if (res === 'food') {
      const farms = this.mine.filter(b => b.def.farm && b.built >= 1);
      const load = f => this.vills.filter(v => v.order && v.order.type === 'gather' && v.order.tx >= f.tx && v.order.tx < f.tx + 2 && v.order.ty >= f.ty && v.order.ty < f.ty + 2).length;
      const free = farms.filter(f => load(f) < 2).sort((a, b) => distToEntity(u.x, u.y, a) - distToEntity(u.x, u.y, b));
      if (free.length) { issue(u, {type: 'gather', tx: free[0].tx, ty: free[0].ty}); return true; }
      const drops = this.mine.filter(b => b.built >= 1 && b.def.drop && b.def.drop.includes('food'));
      for (const d of drops) { const t = G.map.nearestResource(d.tx + 1, d.ty + 1, 'food', 9, this.owner); if (t && G.map.terrain[G.map.idx(t.x, t.y)] !== T_FARM) { issue(u, {type: 'gather', tx: t.x, ty: t.y}); return true; } }
      if (this.buildFarm()) { const f = this.mine.find(b => b.def.farm && b.built < 1 && !this.vills.some(v => v.order && v.order.type === 'build' && v.order.tid === b.id)) || this.mine.find(b => b.def.farm && b.built < 1); if (f) { issue(u, {type: 'build', tid: f.id}); return true; } }
      const t = G.map.nearestResource(base.tx + 1, base.ty + 1, 'food', 18, this.owner); if (t) { issue(u, {type: 'gather', tx: t.x, ty: t.y}); return true; }
      return false;
    }
    let t = null;
    for (const d of this.mine.filter(b => b.built >= 1 && b.def.drop && b.def.drop.includes(res))) { t = G.map.nearestResource(d.tx + 1, d.ty + 1, res, 10, this.owner); if (t) break; }
    if (!t) t = G.map.nearestResource(base.tx + 1, base.ty + 1, res, 18, this.owner) || G.map.nearestResource(base.tx + 1, base.ty + 1, res, 48, this.owner);
    if (!t) return false;
    issue(u, {type: 'gather', tx: t.x, ty: t.y});
    return true;
  }
  buildFarm() {
    const drop = this.mine.filter(b => b.built >= 1 && (b.type === 'molino' || b.type === 'centro'));
    if (!drop.length) return false;
    if (this.mine.filter(b => b.def.farm && b.built < 1).length >= 3) return true;
    if (!canAfford(this.owner, bldCost(this.owner, 'granja'))) return false;
    const near = drop[this.farmCount % drop.length];
    const spot = this.findSpot(2, 2, near.tx + 1, near.ty + 1, 6, 0) || this.findSpot(2, 2, near.tx + 1, near.ty + 1, 9, 0);
    if (!spot) return false;
    this.build('granja', spot.x, spot.y, 1); this.farmCount++;
    return true;
  }
  // ---------- edificios
  manageBuildings() {
    const mine = this.mine, v = this.vills, tc = this.tc || mine[0];
    if (!tc || !v.length) return;
    for (const b of mine) if (b.built < 1) { const builders = v.filter(u => u.order && u.order.type === 'build' && u.order.tid === b.id).length; const want = b.def.w >= 4 ? 4 : b.def.w >= 3 ? 2 : 1; if (builders < want) this.assignBuilders(b, want - builders); }
    const under = t => mine.some(b => b.type === t && b.built < 1);
    const has = t => mine.filter(b => b.type === t && b.built >= 1).length;
    const age = this.pl.age, r = this.pl.res;
    const pop = popCount(this.owner), cap = popCap(this.owner);
    const aff = t => canAfford(this.owner, bldCost(this.owner, t));
    const place = (t, w, near, R, gap, n) => { const s = this.findSpot(w, w, near.tx + 1, near.ty + 1, R, gap); if (s) { this.build(t, s.x, s.y, n); return true; } return false; };
    if (cap - pop < 5 && cap < MAX_POP && !under('casa') && aff('casa')) { if (place('casa', 2, tc, 14, 1, 1)) return; }
    // almacenes cerca de los recursos que se explotan
    for (const res of RES) {
      const gatherers = v.filter(u => u.order && u.order.type === 'gather' && u.order.res === res);
      if (gatherers.length < 2) continue;
      const g = gatherers[0]; const o = g.order;
      const drop = dropOffFor(g, res);
      const dd = drop ? Math.hypot(drop.x / TILE - o.tx, drop.y / TILE - o.ty) : 99;
      if (dd > 8) {
        const type = res === 'food' ? 'molino' : res === 'wood' ? 'aserradero' : 'mina';
        if (under(type) || !aff(type)) continue;
        const s = this.findSpot(2, 2, o.tx, o.ty, 5, 1);
        if (s) { this.build(type, s.x, s.y, 1); return; }
      }
    }
    const milNear = v.length >= 6;
    if (milNear && !has('cuartel') && !under('cuartel') && aff('cuartel')) { if (place('cuartel', 3, tc, 14, 1, 2)) return; }
    if (age >= 1 && !has('arqueria') && !under('arqueria') && aff('arqueria')) { if (place('arqueria', 3, tc, 14, 1, 2)) return; }
    if (age >= 1 && !has('herreria') && !under('herreria') && r.wood > 300 && aff('herreria')) { if (place('herreria', 2, tc, 14, 1, 1)) return; }
    if (age >= 1 && !has('mercado') && !under('mercado') && r.wood > 400 && aff('mercado') && (this.diff >= 1)) { if (place('mercado', 3, tc, 16, 1, 1)) return; }
    if (age >= 1 && !has('establo') && !under('establo') && aff('establo') && (age >= 2 || r.wood > 400)) { if (place('establo', 3, tc, 14, 1, 2)) return; }
    if (age >= 2 && this.diff >= 1 && !has('taller') && !under('taller') && r.wood > 450 && aff('taller')) { if (place('taller', 3, tc, 14, 1, 2)) return; }
    if (age >= 2 && this.diff >= 1 && !has('monasterio') && !under('monasterio') && r.wood > 500 && aff('monasterio')) { if (place('monasterio', 3, tc, 14, 1, 1)) return; }
    if (age >= 2 && this.diff >= 2 && !has('universidad') && !under('universidad') && r.wood > 600 && aff('universidad')) { if (place('universidad', 3, tc, 14, 1, 2)) return; }
    if (age >= 2 && this.diff >= 1 && !has('castillo') && !under('castillo') && r.stone > 800 * (this.pers.towers >= 2 ? 0.85 : 1) && aff('castillo')) { if (place('castillo', 4, tc, 16, 1, 3)) return; }
    if (age >= 2 && has('cuartel') === 1 && !under('cuartel') && r.wood > 600 && aff('cuartel')) { if (place('cuartel', 3, tc, 14, 1, 2)) return; }
    if (age >= 2 && this.diff >= 2 && has('arqueria') === 1 && !under('arqueria') && r.wood > 900 && aff('arqueria')) { if (place('arqueria', 3, tc, 14, 1, 2)) return; }
    if (age >= 3 && this.diff >= 2 && has('establo') === 1 && !under('establo') && r.wood > 1200 && aff('establo')) { if (place('establo', 3, tc, 14, 1, 2)) return; }
    // maravilla (personalidades constructoras)
    if (age >= 3 && this.pers.wonder && !has('maravilla') && !under('maravilla') && r.wood > 1400 && r.stone > 1400 && r.gold > 1400 && !G.buildings.some(b => b.def.wonder)) { if (place('maravilla', 5, tc, 18, 1, 6)) { log(`${this.pl.name} ha empezado a construir una Maravilla`, 'warn'); return; } }
    // segundo centro urbano (expansión) en Castillos
    this.expandT -= 1;
    if (age >= 2 && this.diff >= 2 && this.expandT <= 0 && has('centro') < 2 && !under('centro') && r.wood > 500 && r.stone > 200 && aff('centro')) {
      this.expandT = 300;
      const far = G.map.nearestResource(tc.tx + 1, tc.ty + 1, 'gold', 40, this.owner);
      if (far && Math.hypot(far.x - tc.tx, far.y - tc.ty) > 14) { const s = this.findSpot(3, 3, far.x, far.y, 6, 1); if (s) { this.build('centro', s.x, s.y, 3); return; } }
    }
    // torres
    this.towerT -= 1;
    if (age >= 1 && this.towerT <= 0 && r.stone > 200 && !under('torre') && has('torre') < (2 + this.diff * 2) * this.pers.towers) {
      this.towerT = 150 / this.pers.towers;
      // junto a un grupo de recolectores o hacia el enemigo
      const g = v.filter(u => u.order && u.order.type === 'gather'); const at = g.length && Math.random() < 0.6 ? {tx: g[Math.floor(Math.random() * g.length)].order.tx, ty: g[Math.floor(Math.random() * g.length)].order.ty} : (() => { const d = this.enemyDir(); return {tx: Math.round(tc.tx + 1 + d.x * 7), ty: Math.round(tc.ty + 1 + d.y * 7)}; })();
      const s = this.findSpot(1, 1, at.tx, at.ty, 5, 1); if (s) { this.build('torre', s.x, s.y, 1); return; }
    }
    if (mine.filter(b => b.def.farm).length >= 6 && has('molino') < 1 + Math.floor(mine.filter(b => b.def.farm).length / 8) && !under('molino') && aff('molino')) { if (place('molino', 2, tc, 12, 1, 1)) return; }
    if (r.wood > 250 && r.food < 300 && !G.map.nearestResource(tc.tx + 1, tc.ty + 1, 'food', 16, this.owner)) this.buildFarm();
  }
  enemyDir() { const e = G.buildings.find(b => !allied(b.owner, this.owner)) || {x: G.map.w * TILE / 2, y: G.map.h * TILE / 2}; const tc = this.tc || this.mine[0]; const dx = e.x - tc.x, dy = e.y - tc.y, d = Math.hypot(dx, dy) || 1; return {x: dx / d, y: dy / d}; }
  findSpot(w, h, cx, cy, maxR, gap) {
    for (let r = 2; r <= maxR; r++) {
      const cands = [];
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.abs(x - cx) !== r && Math.abs(y - cy) !== r) continue;
        if (!G.map.canPlace(x - gap, y - gap, w + gap * 2, h + gap * 2, this.owner, true)) continue;
        cands.push({x, y});
      }
      if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
    }
    return null;
  }
  build(type, tx, ty, nBuilders) {
    const def = BUILDINGS[type];
    if (!G.map.canPlace(tx, ty, def.w, def.h, this.owner, true)) return null;
    pay(this.owner, bldCost(this.owner, type));
    const b = addBuilding(this.owner, type, tx, ty, false);
    this.assignBuilders(b, nBuilders);
    return b;
  }
  assignBuilders(b, n) {
    const v = this.vills.filter(u => !(u.order && (u.order.type === 'build' || u.order.type === 'garrison'))).sort((a, c) => distToEntity(a.x, a.y, b) - distToEntity(c.x, c.y, b));
    for (let i = 0; i < Math.min(n, v.length); i++) { const u = v[i]; const prev = u.order; issue(u, {type: 'build', tid: b.id}); if (prev && prev.type === 'gather') u.queue.push(prev); }
  }
  // ---------- producción
  manageProduction() {
    const tc = this.tc; const age = this.pl.age; const r = this.pl.res;
    const vt = this.villTarget[age], v = this.vills.length;
    const pop = popCount(this.owner), cap = popCap(this.owner);
    const wantAge = tc && age < 3 && v >= vt - 6 && G.time > [0, 150, 420, 720][age + 1] * (this.diff >= 2 ? 0.7 : 1) && !tc.queue.some(q => q.kind === 'age');
    this.saving = !!wantAge;
    const ageFood = wantAge ? (AGE_COST[age + 1].food || 0) : 0;
    for (const c of this.mine.filter(b => b.type === 'centro' && b.built >= 1)) if (c.queue.length < 2 && v + c.queue.length < vt && pop < cap && (!wantAge || v < vt - 3 || r.food > ageFood + 60)) enqueue(c, {kind: 'unit', id: 'aldeano'}, this.owner);
    if (wantAge && canAfford(this.owner, AGE_COST[age + 1])) {
      const types = new Set(this.mine.filter(x => x.built >= 1 && !x.def.wall && !x.def.gate && !x.def.farm && x.type !== 'casa').map(x => x.type)).size;
      if (types >= AGE_REQ[age + 1]) { while (tc.queue.length) dequeue(tc, 0); enqueue(tc, {kind: 'age', id: age + 1}, this.owner); this.saving = false; }
    }
    const armyN = this.army.length;
    const wantMil = G.time >= this.passiveUntil && (v >= vt - 4 || r.food > 400) && (!this.saving || armyN < 3 + this.diff || r.food > (AGE_COST[age + 1] || {food: 0}).food + 200);
    if (!wantMil || pop >= cap) return;
    // composición: contrarrestar al enemigo
    const enemyU = G.units.filter(u => !allied(u.owner, this.owner) && u.def.cls !== 'ald');
    const cnt = c => enemyU.filter(u => u.def.cls === c).length;
    const eCab = cnt('cab'), eArc = cnt('arc'), eInf = cnt('inf');
    const comp = this.army.reduce((a, u) => (a[u.def.cls] = (a[u.def.cls] || 0) + 1, a), {});
    const enemyBld = G.buildings.filter(b => !allied(b.owner, this.owner) && (b.def.atk || b.type === 'castillo')).length;
    for (const b of this.mine) {
      if (b.built < 1 || !b.def.trains || b.queue.length >= 1) continue;
      const avail = trainsOf(b).filter(t => UNITS[t].age <= age);
      let choice = null;
      if (b.type === 'cuartel') { const wantLance = eCab >= 3 && (comp.inf || 0) % 2 === 0 && age >= 1; choice = wantLance ? avail.find(t => UNITS[t].line === 'lancero') : avail.find(t => UNITS[t].line === 'milicia'); }
      else if (b.type === 'arqueria') choice = eArc > eInf + 3 && (comp.arc || 0) > 4 ? null : avail[0];
      else if (b.type === 'establo') { const c = avail.filter(t => UNITS[t].line !== 'explorador'); choice = c.length && (eArc >= 2 || Math.random() < 0.7) ? c[0] : (comp.cab || 0) < 2 && age < 2 ? null : null; if (!choice && age >= 2 && avail.find(t => UNITS[t].line === 'explorador') && (comp.cab || 0) < 3) choice = avail.find(t => UNITS[t].line === 'explorador'); }
      else if (b.type === 'taller') { const nSit = comp.sit || 0; choice = nSit < 2 + this.diff + (enemyBld > 3 ? 2 : 0) ? (enemyBld > 2 && nSit % 2 === 0 ? avail.find(t => UNITS[t].line === 'catapulta') : avail.find(t => t === 'ariete') || avail[0]) : null; }
      else if (b.type === 'castillo') choice = avail[0];
      else if (b.type === 'monasterio') choice = this.monks.length < (this.diff >= 2 ? 3 : 1) && r.gold > 300 ? 'monje' : null;
      if (!choice) continue;
      if (canAfford(this.owner, unitCost(this.owner, choice))) enqueue(b, {kind: 'unit', id: choice}, this.owner);
    }
  }
  manageResearch() {
    const age = this.pl.age; const r = this.pl.res;
    if (r.food < 250 || r.gold < 120 || this.saving) return;
    const prio = ['l_espada', 'l_ballestero', 'forja', 'flechas', 'armadura', 'cosecha', 'hacha', 'pico', 'telar', 'l_piquero', 'l_jinete', 'carretilla', 'forja2', 'flechas2', 'armadura2', 'l_campeon', 'l_arbalestero', 'l_paladin', 'l_trabuco', 'balistica', 'mamposteria', 'conscripcion', 'forja3', 'flechas3', 'armadura3', 'quimica', 'arquitectura', 'l_alabardero', 'fervor', 'sanacion', 'gremio', 'campana'];
    for (const b of this.mine) {
      if (b.built < 1 || !b.def.techs || b.queue.length) continue;
      const cands = b.def.techs.filter(id => !this.pl.techs.has(id) && TECHS[id].age <= age && (!TECHS[id].req || this.pl.techs.has(TECHS[id].req)) && canAfford(this.owner, techCost(this.owner, id)));
      cands.sort((a, c) => prio.indexOf(a) - prio.indexOf(c));
      if (cands.length) { enqueue(b, {kind: 'tech', id: cands[0]}, this.owner); return; }
    }
  }
  manageMarket() {
    const mk = this.mine.find(b => b.type === 'mercado' && b.built >= 1); if (!mk) return;
    const r = this.pl.res;
    if (Math.floor(G.time) % 10 !== 0) return;
    for (const k of ['food', 'wood', 'stone']) if (r[k] > (this.saving ? 900 : 1600)) { marketTrade(this.owner, k, false); return; }
    if (r.gold > 500) { for (const k of ['food', 'wood']) if (r[k] < 120) { marketTrade(this.owner, k, true); return; } }
    if (this.saving && r.gold > 800) { const need = AGE_COST[this.pl.age + 1]; if (need && need.food && r.food < need.food) { marketTrade(this.owner, 'food', true); } }
  }
  manageMonks() {
    for (const mk of this.monks) {
      if (mk.order && mk.order.type !== 'move') continue;
      if (mk.relic) { const mo = nearestBuilding(this.owner, mk.x, mk.y, b => b.def.relics && b.built >= 1); if (mo) issue(mk, {type: 'deposit', tid: mo.id}); continue; }
      const mo = nearestBuilding(this.owner, mk.x, mk.y, b => b.def.relics && b.built >= 1); if (!mo) continue;
      let best = -1, bd = 1e9;
      G.map.relics.forEach((rl, i) => { if (rl.carrier || rl.holder) return; const d = Math.hypot(rl.x * TILE - mk.x, rl.y * TILE - mk.y); if (d < bd && d < TILE * 45) { bd = d; best = i; } });
      if (best >= 0) issue(mk, {type: 'pickrelic', ri: best});
      else if (!mk.order) { const tc = this.tc; if (tc && distToEntity(mk.x, mk.y, tc) > TILE * 6) issue(mk, {type: 'move', x: tc.x + rnd(-60, 60), y: tc.y + rnd(-60, 60)}); }
    }
  }
  manageScout() {
    const sc = G.units.find(u => u.owner === this.owner && (u.type === 'explorador' || u.type === 'jinete') && !u.order);
    if (!sc || G.time > 480 || this.diff === 0) return;
    if (!this.scoutPts.length) { const m = G.map; for (let i = 0; i < 12; i++) this.scoutPts.push({x: (0.1 + Math.random() * 0.8) * m.w * TILE, y: (0.1 + Math.random() * 0.8) * m.h * TILE}); }
    const p = this.scoutPts.shift(); issue(sc, {type: 'move', x: p.x, y: p.y});
  }
  manageGarrison() {
    // campana: si hay soldados enemigos cerca de los aldeanos y no hay ejército suficiente, refugiarse
    const v = this.vills;
    const threats = G.units.filter(u => !allied(u.owner, this.owner) && u.def.cls !== 'ald' && u.def.cls !== 'mnk' && u.def.cls !== 'sit' && u.def.line !== 'explorador');
    const nearV = threats.filter(t => v.some(x => dist(x.x, x.y, t.x, t.y) < TILE * 7));
    const nearB = threats.filter(t => this.mine.some(b => b.garrison.length && distToEntity(t.x, t.y, b) < TILE * 9));
    if (nearV.length >= 2 && !this.pl.bell && this.army.length < nearV.length * 1.5) { townBell(this.owner); this.bellT = G.time; }
    else if (this.pl.bell && G.time - this.bellT > 20 && !nearV.length && !nearB.length) townBell(this.owner);
    else if (this.pl.bell && G.time - this.bellT > 90) townBell(this.owner);
  }
  // ---------- ejército
  manageArmy() {
    const army = this.army; const tc = this.tc || this.mine[0];
    if (!tc) return;
    // defensa
    const intruders = G.units.filter(u => !allied(u.owner, this.owner) && u.def.cls !== 'ald' && this.mine.some(b => distToEntity(u.x, u.y, b) < TILE * 10));
    if (intruders.length) {
      const defenders = army.filter(u => !this.attackGroup || !this.attackGroup.ids.has(u.id) || distToEntity(u.x, u.y, tc) < TILE * 25);
      for (const u of defenders) if (!u.order || u.order.type !== 'attack') { const t = intruders.reduce((a, c) => distToEntity(u.x, u.y, c) < distToEntity(u.x, u.y, a) ? c : a); issue(u, {type: 'attack', tid: t.id}); }
      // recuperar aldeanos: los que están ociosos lejos vuelven
      if (this.attackGroup && intruders.length > army.length * 0.5) { this.recall(); }
    }
    // grupo de ataque en curso: retirada si va mal
    if (this.attackGroup) {
      const alive = army.filter(u => this.attackGroup.ids.has(u.id));
      const hp = alive.reduce((a, u) => a + u.hp, 0);
      if (!alive.length || (hp < this.attackGroup.hp0 * 0.3 && alive.length < this.attackGroup.n0 * 0.5)) { if (alive.length) this.recall(); this.attackGroup = null; }
      else if (G.time - this.attackGroup.t0 > 240) { const t = this.pickTarget(); if (t) for (const u of alive) if (!u.order) issue(u, {type: 'attackmove', x: t.x, y: t.y}); this.attackGroup.t0 = G.time; }
    }
    if (G.time < this.passiveUntil) return;
    // ataque por oleadas
    const idleArmy = army.filter(u => (!u.order || u.order.type === 'move') && (!this.attackGroup || !this.attackGroup.ids.has(u.id)));
    const threshold = Math.min(50, Math.round((5 + this.wave * 3 + this.diff * 2) * this.pers.attackMul));
    const launch = (units, target) => {
      for (const u of units) issue(u, {type: 'attackmove', x: target.x + rnd(-40, 40), y: target.y + rnd(-40, 40)});
      this.attackGroup = {ids: new Set(units.map(u => u.id)), hp0: units.reduce((a, u) => a + u.hp, 0), n0: units.length, t0: G.time};
      this.wave++; this.nextAttack = G.time + this.waveGap;
      if (G.players.some(p => p.human && !allied(p.id, this.owner))) log(`Se avistan fuerzas de ${this.pl.name} en marcha`, 'warn');
    };
    if (G.time >= this.nextAttack && idleArmy.length >= threshold) { const t = this.pickTarget(); if (t) launch(idleArmy, t); }
    else if (G.time >= this.nextAttack + 60 && idleArmy.length >= Math.max(4, threshold * 0.6)) { const t = this.pickTarget(); if (t) launch(idleArmy, t); }
    // los ociosos lejos de casa vuelven; los nuevos se reúnen frente al centro
    const dir = this.enemyDir();
    for (const u of idleArmy) {
      if (!u.order && distToEntity(u.x, u.y, tc) > TILE * 20 && !nearestEnemy(u, TILE * 10)) issue(u, {type: 'move', x: tc.x + dir.x * TILE * 6 + rnd(-60, 60), y: tc.y + dir.y * TILE * 6 + rnd(-60, 60)});
      else if (!u.order && distToEntity(u.x, u.y, tc) < TILE * 3) issue(u, {type: 'move', x: tc.x + dir.x * TILE * 6 + rnd(-50, 50), y: tc.y + dir.y * TILE * 6 + rnd(-50, 50)});
    }
  }
  recall() { const tc = this.tc || this.mine[0]; if (!tc) return; for (const u of this.army) if (this.attackGroup && this.attackGroup.ids.has(u.id)) issue(u, {type: 'move', x: tc.x + rnd(-80, 80), y: tc.y + rnd(-80, 80)}); this.attackGroup = null; }
  pickTarget() {
    const tc = this.tc || this.mine[0];
    const enemyB = G.buildings.filter(b => !allied(b.owner, this.owner) && !b.def.wall && P(b.owner).alive);
    if (!enemyB.length) { const eu = G.units.filter(u => !allied(u.owner, this.owner)); return eu.length ? eu[0] : null; }
    const wonder = enemyB.find(b => b.def.wonder); if (wonder) return wonder;
    const weight = b => distToEntity(tc.x, tc.y, b) * (b.type === 'centro' ? 1.3 : b.def.atk ? 1.6 : b.def.drop || b.def.farm ? 0.8 : 1);
    return enemyB.sort((a, c) => weight(a) - weight(c))[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * Math.min(3, enemyB.length))];
  }
}
