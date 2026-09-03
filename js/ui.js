// ============================================================ INTERFAZ: panel, órdenes y entrada
function log(msg, cls = 'info') {
  const el = $('#log'); if (!el) return; const d = document.createElement('div'); d.className = cls; d.textContent = msg; el.appendChild(d);
  while (el.children.length > 7) el.removeChild(el.firstChild);
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, cls === 'story' ? 14000 : 7000);
}
let hintT = null;
function hint(msg) { const h = $('#hint'); h.textContent = msg; h.style.display = msg ? 'block' : 'none'; clearTimeout(hintT); if (msg) hintT = setTimeout(() => h.style.display = 'none', 4000); }

function entityAt(wx, wy) {
  // prueba en espacio de pantalla: unidades por su silueta, edificios por su planta o su volumen
  const z = UI.cam.z; const sp = worldToScreen(wx, wy);
  let best = null, bd = 1e9;
  for (const u of G.units) { if (!allied(u.owner, HUMAN) && !G.map.visible[G.map.idx(u.tx, u.ty)]) continue; const s = worldToScreen(u.x, u.y); const tall = u.def.cls === 'cab' ? 40 : u.def.cls === 'sit' ? 26 : 32; if (Math.abs(sp.x - s.x) < 12 * z && sp.y < s.y + 5 * z && sp.y > s.y - tall * z) { const d = Math.hypot(sp.x - s.x, sp.y - (s.y - tall * z / 2)); if (d < bd) { bd = d; best = u; } } }
  if (best) return best;
  const tx = clamp(Math.floor(wx / TILE), 0, G.map.w - 1), ty = clamp(Math.floor(wy / TILE), 0, G.map.h - 1);
  const b0 = G.byId[G.map.bld[G.map.idx(tx, ty)]];
  if (b0 && (allied(b0.owner, HUMAN) || isBuildingExplored(b0))) return b0;
  // volumen: edificios cuya caja de pantalla contiene el punto (el más cercano al frente primero)
  const cands = G.buildings.filter(b => (allied(b.owner, HUMAN) || isBuildingExplored(b)) && !b.def.farm).sort((a, b) => (b.tx + b.w + b.ty + b.h) - (a.tx + a.w + a.ty + a.h));
  for (const b of cands) { const s = worldToScreen(b.tx * TILE, b.ty * TILE); const left = worldToScreen(b.tx * TILE, (b.ty + b.h) * TILE).x, right = worldToScreen((b.tx + b.w) * TILE, b.ty * TILE).x; const bottom = worldToScreen((b.tx + b.w) * TILE, (b.ty + b.h) * TILE).y; const top = s.y - BLD_HT[b.type] * z; if (sp.x >= left && sp.x <= right && sp.y >= top && sp.y <= bottom) return b; }
  return null;
}
function relicAt(wx, wy) { const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE); const i = G.map.relics.findIndex(r => !r.carrier && !r.holder && r.x === tx && r.y === ty && G.map.explored[G.map.idx(tx, ty)]); return i; }
function select(list, add = false) {
  if (!add) UI.selected = [];
  for (const e of list) if (!UI.selected.includes(e)) UI.selected.push(e);
  if (UI.selected.some(e => e.kind === 'unit' && e.owner === HUMAN)) UI.selected = UI.selected.filter(e => e.kind === 'unit' && e.owner === HUMAN);
  else if (UI.selected.length > 1) UI.selected = [UI.selected[0]];
  UI.placing = null; UI.mode = null; UI.lastSel = '';
  if (UI.selected.length) sfx('click');
  refreshPanel();
}
const iconCost = c => `<div class="cost">${Object.entries(c).map(([k, v]) => `<span class="${k[0]}"><i></i>${v}</span>`).join('')}</div>`;
function portrait(u, size = 26) { const c = document.createElement('canvas'); c.width = c.height = size; const cc = c.getContext('2d'); const sp = unitSprite(u, civOf(u.owner).style, 0, 'idle', 0); const sc = size / 40; cc.drawImage(sp.c, size / 2 - 32 * sc, size - 76 * sc + 2, 64 * sc, 80 * sc); return c; }
function refreshPanel() {
  const S = UI.selected, info = $('#selinfo'), cm = $('#cmds');
  const pl = P(HUMAN);
  const key = S.map(e => e.id + (e.kind === 'bld' ? ':' + e.built + ':' + e.garrison.length + ':' + e.closed : ':' + e.stance)).join(',') + '|' + pl.age + '|' + UI.placing?.type + '|' + UI.mode + '|' + [...pl.techs].join('') + '|' + Object.values(pl.lines).join('');
  if (S.length === 0) {
    const v = G.units.filter(u => u.owner === HUMAN && u.def.cls === 'ald'), a = G.units.filter(u => u.owner === HUMAN && u.def.cls !== 'ald');
    info.innerHTML = `<h3>${CIVS[pl.civ].name}</h3><div class="stat">Aldeanos: <b>${v.length}</b> · Ejército: <b>${a.length}</b> · Ociosos: <b>${v.filter(u => !u.order).length}</b><br>Puntuación: <b>${score(HUMAN)}</b>${G.mission ? '' : ' · Rivales vivos: <b>' + G.players.filter(p => p.alive && !allied(p.id, HUMAN)).length + '</b>'}<br><span style="font-size:11px">${CIVS[pl.civ].bonuses.slice(0, 2).join(' · ')}</span></div>`;
    cm.innerHTML = ''; UI.lastSel = key; return;
  }
  if (key !== UI.lastSel) { UI.lastSel = key; buildCommands(); }
  if (S.length === 1) {
    const e = S[0];
    if (e.kind === 'unit') {
      const o = e.order; const st = !o ? 'Ocioso' : {move: 'Moviéndose', attack: 'Atacando', attackmove: 'Atacar-mover', gather: 'Recolectando ' + (RES_ES[o.res] || '').toLowerCase(), return: 'Entregando', build: 'Construyendo', repair: 'Reparando', patrol: 'Patrullando', guard: 'Vigilando', garrison: 'Guarneciéndose', heal: 'Curando', convert: 'Convirtiendo', pickrelic: 'A por la reliquia', deposit: 'Llevando reliquia'}[o.type];
      info.innerHTML = `<h3><span class="port"></span>${e.def.name}${e.owner !== HUMAN ? ` <small style="color:${allied(e.owner, HUMAN) ? '#b6f0bb' : '#ffb4ae'}">${P(e.owner).name}</small>` : ''}</h3>
      <div class="hpbar"><div style="width:${e.hp / e.maxHp * 100}%"></div></div>
      <div class="stat">Vida <b>${Math.ceil(e.hp)}/${e.maxHp}</b>${e.def.atk ? ` · Ataque <b>${unitAtk(e)}</b>` : ''} · Armadura <b>${unitArm(e, false)}/${unitArm(e, true)}</b>${e.def.rng ? ` · Alcance <b>${unitRange(e)}</b>` : ''}<br>${e.owner === HUMAN ? `Estado: <b>${st}</b>${e.carry && e.carry.amt ? ` · Carga: <b>${e.carry.amt} ${RES_ES[e.carry.type].toLowerCase()}</b>` : ''}${e.relic ? ' · <b>lleva una reliquia</b>' : ''}${e.def.cls === 'mnk' && e.cd > 0 ? ` · Fe: <b>${Math.ceil(e.cd)}s</b>` : ''}<br><span style="font-size:11px">${e.def.desc}</span>` : e.def.desc}</div>`;
      info.querySelector('.port').replaceWith(portrait(e, 26));
    } else {
      const b = e; let q = '';
      if (b.owner === HUMAN && b.queue.length) q = `<div class="queue">${b.queue.map((it, i) => `<div class="q" data-i="${i}" title="Cancelar">${it.kind === 'unit' ? UNITS[lineUnit(HUMAN, it.id)].name.slice(0, 5) : it.kind === 'tech' ? TECHS[it.id].name.slice(0, 5) : 'Edad'}<div class="pr" style="width:${i === 0 ? b.progress / it.t * 100 : 0}%"></div></div>`).join('')}</div>`;
      let g = '';
      if (b.garrison.length && allied(b.owner, HUMAN)) g = `<div class="multi">${b.garrison.map(u => `<div class="u" title="${u.def.name}">${u.def.name[0]}</div>`).join('')}</div>`;
      const blocked = b.owner === HUMAN && b.queue.length && b.queue[0].kind === 'unit' && popCount(HUMAN) - b.queue.filter(x => x.kind === 'unit').length >= popCap(HUMAN);
      info.innerHTML = `<h3><span class="port"></span>${b.def.name}${b.owner !== HUMAN ? ` <small style="color:${allied(b.owner, HUMAN) ? '#b6f0bb' : '#ffb4ae'}">${P(b.owner).name}</small>` : ''}</h3>
      <div class="hpbar"><div style="width:${b.hp / b.maxHp * 100}%;${b.built < 1 ? 'background:#d9a441' : ''}"></div></div>
      <div class="stat">${b.built < 1 ? `En construcción <b>${Math.floor(b.built * 100)}%</b> · ` : ''}Vida <b>${Math.ceil(b.hp)}/${b.maxHp}</b>${b.def.atk ? ` · Ataque <b>${b.def.atk}</b>` : ''}${b.def.pop ? ` · Población <b>+${b.def.pop}</b>` : ''}${b.def.garrison ? ` · Guarnición <b>${b.garrison.length}/${b.def.garrison}</b>` : ''}${b.relics ? ` · Reliquias <b>${b.relics}</b> (+${b.relics * 30} oro/min)` : ''}${b.def.wonder && b.wonderT !== null && b.built >= 1 ? ` · <b style="color:var(--accent)">Victoria en ${fmtTime(b.wonderT)}</b>` : ''}<br>${blocked ? '<span style="color:#ffb4ae">Bloqueado: construye casas</span>' : b.def.desc}</div>${q}${g}`;
      info.querySelector('.port').replaceWith(iconCanvas('bld', b.type, b.owner, 30));
      info.querySelectorAll('.q').forEach(el => el.onclick = () => { dequeue(b, +el.dataset.i); refreshPanel(); });
    }
  } else {
    const counts = {}; for (const u of S) counts[u.def.name] = (counts[u.def.name] || 0) + 1;
    info.innerHTML = `<h3>${S.length} unidades</h3><div class="stat">${Object.entries(counts).map(([n, c]) => `${c}× ${n}`).join(' · ')}</div><div class="multi"></div>`;
    const mu = info.querySelector('.multi');
    for (const u of S.slice(0, 48)) { const d = document.createElement('div'); d.className = 'u' + (u.hp < u.maxHp * 0.4 ? ' hurt' : ''); d.title = u.def.name; d.appendChild(portrait(u, 24)); d.onclick = ev => { if (ev.shiftKey) { UI.selected = UI.selected.filter(x => x !== u); UI.lastSel = ''; refreshPanel(); } else select([u]); }; mu.appendChild(d); }
  }
}
function cmdBtn(label, key, cost, opts = {}) {
  const d = document.createElement('div'); d.className = 'cmd' + (opts.dis ? ' dis' : '') + (opts.red ? ' red' : '') + (opts.on ? ' on' : '') + (opts.gold ? ' gold' : '');
  d.innerHTML = `${key ? `<span class="k">${key}</span>` : ''}<div class="ic"></div><div class="lb">${label}</div>${cost ? iconCost(cost) : ''}`;
  if (opts.icon) { const ic = iconCanvas(opts.icon[0], opts.icon[1], opts.icon[2] ?? HUMAN, 40); d.querySelector('.ic').appendChild(ic); } else d.querySelector('.ic').remove();
  d.title = label;
  d.onmouseenter = () => { if (opts.tip) { const t = $('#tip'); t.innerHTML = opts.tip; t.style.display = 'block'; } };
  d.onmouseleave = () => $('#tip').style.display = 'none';
  d.onclick = e => { if (!opts.dis && opts.fn) { sfx('click'); opts.fn(e); } };
  return d;
}
function unitTip(t, owner) { const d = UNITS[t]; const c = unitCost(owner, t); return `<b>${d.name}</b> — ${d.desc}<br>Vida ${unitMaxHp(owner, t)} · Ataque ${d.atk} · Armadura ${d.arm[0]}/${d.arm[1]}${d.rng ? ` · Alcance ${d.rng}` : ''} · ${d.time}s${d.bonus ? '<br>Bonificación contra: ' + Object.entries(d.bonus).map(([k, v]) => (k === 'bld' ? 'edificios' : CLS_ES[k].toLowerCase()) + ' ×' + v).join(', ') : ''}<br><small>Shift+clic: encolar 5</small>`; }
function buildCommands() {
  const S = UI.selected, cm = $('#cmds'); cm.innerHTML = '';
  if (!S.length || S[0].owner !== HUMAN) return;
  const pl = P(HUMAN), age = pl.age;
  if (S[0].kind === 'unit') {
    const hasV = S.some(u => u.def.cls === 'ald'), hasM = S.some(u => u.def.cls !== 'ald' && u.def.cls !== 'mnk'), hasMonk = S.some(u => u.def.cls === 'mnk');
    if (hasV && !UI.mode) {
      for (const [type, def] of Object.entries(BUILDINGS)) {
        if (type === 'maravilla' && G.mission && G.mission.noWonder) continue;
        const locked = def.age > age; const cost = bldCost(HUMAN, type);
        cm.appendChild(cmdBtn(def.name, def.key, cost, {icon: ['bld', type], dis: locked, gold: type === 'maravilla', tip: `<b>${def.name}</b> — ${def.desc}${locked ? `<br><i>Requiere ${AGES[def.age]}</i>` : ''}<br>Vida ${def.hp} · Tiempo: ${def.time}s`, fn: () => startPlacing(type)}));
      }
    }
    if (hasM || hasMonk) {
      cm.appendChild(cmdBtn('Atacar-mover', 'A', null, {icon: ['cmd', 'attack'], tip: '<b>Atacar-mover</b> — Avanzar atacando a todo enemigo que se cruce.', fn: () => { UI.mode = 'attackmove'; hint('Haz clic en el destino'); refreshPanel(); }}));
      cm.appendChild(cmdBtn('Patrullar', 'Z', null, {icon: ['cmd', 'patrol'], tip: '<b>Patrullar</b> — Ir y volver entre la posición actual y el destino, atacando a los enemigos que aparezcan.', fn: () => { UI.mode = 'patrol'; hint('Haz clic en el punto de patrulla'); }}));
      cm.appendChild(cmdBtn('Vigilar', 'X', null, {icon: ['cmd', 'guard'], tip: '<b>Vigilar</b> — Seguir y proteger a una unidad o edificio.', fn: () => { UI.mode = 'guard'; hint('Haz clic en lo que quieres proteger'); }}));
      const st = S[0].stance;
      cm.appendChild(cmdBtn('Agresivo', 'Q', null, {icon: ['cmd', 'agg'], on: st === 0, tip: '<b>Postura agresiva</b> — Persigue a cualquier enemigo a la vista.', fn: () => { for (const u of S) u.stance = 0; UI.lastSel = ''; }}));
      cm.appendChild(cmdBtn('Defensivo', 'W', null, {icon: ['cmd', 'def'], on: st === 1, tip: '<b>Postura defensiva</b> — Responde a los ataques cercanos pero no se aleja de su posición.', fn: () => { for (const u of S) u.stance = 1; UI.lastSel = ''; }}));
      cm.appendChild(cmdBtn('No moverse', 'E', null, {icon: ['cmd', 'hold'], on: st === 2, tip: '<b>No moverse</b> — Solo ataca lo que tenga a su alcance. Ideal para arqueros tras una muralla.', fn: () => { for (const u of S) u.stance = 2; UI.lastSel = ''; }}));
    }
    if (hasMonk) { cm.appendChild(cmdBtn('Curar', null, null, {icon: ['cmd', 'heal'], tip: '<b>Curar</b> — Elige una unidad aliada herida. Los monjes ociosos curan solos a quien tengan cerca.', fn: () => { UI.mode = 'heal'; hint('Haz clic en la unidad a curar'); }})); cm.appendChild(cmdBtn('Convertir', null, null, {icon: ['cmd', 'convert'], tip: '<b>Convertir</b> — Elige una unidad enemiga. Tarda unos segundos y después el monje necesita 30 s de descanso.', fn: () => { UI.mode = 'convert'; hint('Haz clic en la unidad enemiga'); }})); }
    cm.appendChild(cmdBtn('Detener', 'S', null, {icon: ['cmd', 'stop'], tip: 'Cancela las órdenes actuales.', fn: () => { for (const u of S) { u.order = null; u.queue = []; u.path = []; } }}));
    cm.appendChild(cmdBtn('Guarnecer', 'G', null, {icon: ['cmd', 'garrison'], tip: '<b>Guarnecer</b> — Entrar en un centro, castillo, torre o edificio militar. Dentro, las unidades se curan y arqueros y aldeanos añaden flechas.', fn: () => { UI.mode = 'garrison'; hint('Haz clic en el edificio'); }}));
    if (hasV) cm.appendChild(cmdBtn('Reparar', 'R', null, {icon: ['cmd', 'repair'], tip: 'Elige un edificio dañado para repararlo (cuesta una fracción de su precio).', fn: () => { UI.mode = 'repair'; hint('Haz clic en el edificio a reparar'); }}));
    cm.appendChild(cmdBtn('Eliminar', 'Supr', null, {icon: ['cmd', 'kill'], red: true, tip: 'Elimina las unidades seleccionadas.', fn: () => { for (const u of S) killEntity(u, null); select([]); }}));
  } else {
    const b = S[0];
    if (b.built < 1) { cm.appendChild(cmdBtn('Cancelar obra', null, null, {icon: ['cmd', 'cancel'], red: true, tip: 'Derriba la construcción y recupera el 75% del coste.', fn: () => { const c = bldCost(HUMAN, b.type); for (const k in c) pl.res[k] += c[k] * 0.75; removeEntity(b, true); select([]); }})); return; }
    if (b.def.trains) for (const t of trainsOf(b)) { const d = UNITS[t]; const locked = d.age > age; cm.appendChild(cmdBtn(d.name, d.key, unitCost(HUMAN, t), {icon: ['unit', t], dis: locked, tip: unitTip(t, HUMAN) + (locked ? `<br><i>Requiere ${AGES[d.age]}</i>` : ''), fn: e => { const n = e.shiftKey ? 5 : 1; for (let i = 0; i < n; i++) if (!enqueue(b, {kind: 'unit', id: t}, HUMAN)) break; refreshPanel(); }})); }
    if (b.def.techs) for (const t of b.def.techs) {
      const d = TECHS[t]; if (pl.techs.has(t)) continue;
      if (d.line && (pl.lines[d.line] || 0) >= d.level) continue;
      if (d.req && !pl.techs.has(d.req) && TECHS[d.req].age <= age && !d.line) { /* mostrar bloqueada */ }
      const locked = d.age > age || (d.req && !pl.techs.has(d.req));
      if (locked && d.req && !pl.techs.has(d.req) && d.line) continue; // no saturar con mejoras de línea lejanas
      cm.appendChild(cmdBtn(d.line ? 'Mejorar: ' + d.name : d.name, null, techCost(HUMAN, t), {icon: d.line ? ['unit', LINES[d.line][d.level]] : ['tech', d.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()], dis: locked, tip: `<b>${d.name}</b> — ${d.desc}${locked ? `<br><i>Requiere ${d.age > age ? AGES[d.age] : TECHS[d.req].name}</i>` : ''}<br>${d.time}s`, fn: () => { enqueue(b, {kind: 'tech', id: t}, HUMAN); refreshPanel(); }}));
    }
    if (b.type === 'centro' && age < 3) {
      const na = age + 1; const reqB = AGE_REQ[na]; const nb = new Set(G.buildings.filter(x => x.owner === HUMAN && x.built >= 1 && !x.def.wall && !x.def.gate && !x.def.farm && x.type !== 'casa').map(x => x.type)).size; const ok = nb >= reqB;
      cm.appendChild(cmdBtn('Avanzar: ' + AGES[na], null, AGE_COST[na], {icon: ['cmd', 'age'], dis: !ok, gold: true, tip: `<b>${AGES[na]}</b> — Desbloquea nuevos edificios, unidades y tecnologías.<br>Requiere ${reqB} tipos de edificio distintos (sin contar casas, granjas ni murallas). Tienes ${nb}.<br>${AGE_TIME[na]}s`, fn: () => { enqueue(b, {kind: 'age', id: na}, HUMAN); refreshPanel(); }}));
    }
    if (b.def.market) {
      for (const k of ['food', 'wood', 'stone']) {
        cm.appendChild(cmdBtn(`Comprar ${RES_ES[k].toLowerCase()}`, null, {gold: marketPrice(HUMAN, k, true)}, {icon: ['cmd', 'buy'], tip: `<b>Comprar 100 de ${RES_ES[k].toLowerCase()}</b> por ${marketPrice(HUMAN, k, true)} de oro. El precio sube con cada compra.<br><small>Shift+clic: ×5</small>`, fn: e => { for (let i = 0; i < (e.shiftKey ? 5 : 1); i++) if (!marketTrade(HUMAN, k, true)) break; UI.lastSel = ''; }}));
        cm.appendChild(cmdBtn(`Vender ${RES_ES[k].toLowerCase()}`, null, {[k]: 100}, {icon: ['cmd', 'sell'], tip: `<b>Vender 100 de ${RES_ES[k].toLowerCase()}</b> por ${marketPrice(HUMAN, k, false)} de oro. El precio baja con cada venta.<br><small>Shift+clic: ×5</small>`, fn: e => { for (let i = 0; i < (e.shiftKey ? 5 : 1); i++) if (!marketTrade(HUMAN, k, false)) break; UI.lastSel = ''; }}));
      }
    }
    if (b.def.trains) cm.appendChild(cmdBtn('Punto de reunión', null, null, {icon: ['cmd', 'rally'], tip: 'Haz clic en el mapa: las unidades nuevas irán allí (a recolectar si es un recurso, a guarnecerse si es un edificio, a atacar si es un enemigo).', fn: () => { UI.mode = 'rally'; hint('Haz clic en el punto de reunión'); }}));
    if (b.garrison.length) cm.appendChild(cmdBtn('Desalojar', 'V', null, {icon: ['cmd', 'ungarrison'], tip: 'Saca a todas las unidades guarnecidas.', fn: () => { ungarrison(b); refreshPanel(); }}));
    if (b.def.gate) cm.appendChild(cmdBtn(b.closed ? 'Abrir puerta' : 'Cerrar puerta', null, null, {icon: ['cmd', 'gate'], on: b.closed, tip: 'Una puerta cerrada no deja pasar a nadie, ni siquiera a tus unidades.', fn: () => { b.closed = !b.closed; UI.lastSel = ''; }}));
    cm.appendChild(cmdBtn('Derribar', null, null, {icon: ['cmd', 'delete'], red: true, tip: 'Destruye el edificio.', fn: () => { removeEntity(b, true); select([]); }}));
  }
}
function startPlacing(type) {
  const def = BUILDINGS[type];
  if (def.age > P(HUMAN).age) { hint('Requiere ' + AGES[def.age]); return; }
  if (type === 'maravilla' && G.buildings.some(b => b.owner === HUMAN && b.def.wonder)) { hint('Solo puedes tener una Maravilla'); return; }
  const cost = bldCost(HUMAN, type);
  if (!canAfford(HUMAN, cost)) { log('Faltan recursos: ' + missingRes(HUMAN, cost).join(', '), 'warn'); return; }
  UI.placing = {type}; UI.mode = null; UI.wallDrag = null;
  hint(def.wall ? 'Clic y arrastra para trazar la muralla · Esc para cancelar' : 'Clic para colocar · Shift para colocar varios · Esc para cancelar');
}
function placeBuilding(shift) {
  const P_ = UI.placing, def = BUILDINGS[P_.type]; const cost = bldCost(HUMAN, P_.type);
  const tiles = placementTiles();
  const vills = UI.selected.filter(u => u.kind === 'unit' && u.def.cls === 'ald');
  let placed = 0, first = null;
  for (const t of tiles) {
    if (!G.map.canPlace(t.x, t.y, def.w, def.h, HUMAN)) continue;
    if (!canAfford(HUMAN, cost)) { log('Faltan recursos: ' + missingRes(HUMAN, cost).join(', '), 'warn'); break; }
    pay(HUMAN, cost);
    const b = addBuilding(HUMAN, P_.type, t.x, t.y, false);
    placed++;
    vills.forEach((v, i) => { const prev = v.order; const q = first !== null || shift || i > 0 && def.wall; issue(v, {type: 'build', tid: b.id}, q); if (!q && prev && (prev.type === 'gather' || prev.type === 'return')) v.queue.push(prev.type === 'return' ? (v.queue[0] || prev) : prev); });
    if (first === null) first = b;
  }
  if (!placed) { hint('No se puede construir ahí'); return; }
  sfx('place');
  UI.wallDrag = null;
  if (!shift && !def.wall) UI.placing = null; else if (!canAfford(HUMAN, cost)) UI.placing = null;
  refreshPanel();
}
function contextOrder(wx, wy, shift) {
  const S = UI.selected; if (!S.length || S[0].owner !== HUMAN) return;
  const m = G.map; const tx = clamp(Math.floor(wx / TILE), 0, m.w - 1), ty = clamp(Math.floor(wy / TILE), 0, m.h - 1);
  const e = entityAt(wx, wy); const t = m.terrain[m.idx(tx, ty)]; const ri = relicAt(wx, wy);
  if (S[0].kind === 'bld') {
    const b = S[0]; if (!b.def.trains) return;
    if (e && e !== b) b.rally = {tid: e.id, x: e.x, y: e.y}; else if (RES_OF_TILE[t]) b.rally = {res: RES_OF_TILE[t], tx, ty, x: (tx + .5) * TILE, y: (ty + .5) * TILE}; else b.rally = {x: wx, y: wy};
    G.fx.push({t: 'ping', x: b.rally.x, y: b.rally.y, life: 0.8}); return;
  }
  let order = null;
  if (e && !allied(e.owner, HUMAN)) order = {type: 'attack', tid: e.id};
  else if (e && e.kind === 'bld') {
    if (e.built < 1 && e.owner === HUMAN) order = {type: 'build', tid: e.id};
    else if (e.def.farm && e.owner === HUMAN) order = {type: 'gather', tx: e.tx, ty: e.ty};
    else if (e.def.relics && e.owner === HUMAN && S.some(u => u.relic)) order = {type: 'deposit', tid: e.id};
    else if (garrisonCap(e) && S.some(u => canGarrison(u, e))) order = {type: 'garrison', tid: e.id};
    else if (e.hp < e.maxHp && e.owner === HUMAN) order = {type: 'repair', tid: e.id};
    else order = {type: 'move', x: wx, y: wy};
  }
  else if (e && e.kind === 'unit') { if (S.some(u => u.def.cls === 'mnk') && e.hp < e.maxHp) order = {type: 'heal', tid: e.id}; else order = {type: 'guard', tid: e.id}; }
  else if (ri >= 0 && S.some(u => u.def.cls === 'mnk')) order = {type: 'pickrelic', ri};
  else if (RES_OF_TILE[t] && m.amount[m.idx(tx, ty)] > 0) order = {type: 'gather', tx, ty};
  else order = {type: 'move', x: wx, y: wy};
  let k = 0; const n = S.length, cols = Math.ceil(Math.sqrt(n));
  for (const u of S) {
    let o = {...order};
    if (u.def.cls !== 'ald' && (o.type === 'gather' || o.type === 'build' || o.type === 'repair')) o = {type: 'move', x: wx, y: wy};
    if (o.type === 'attack' && (u.def.cls === 'ald' && e.kind === 'unit' && e.def.cls !== 'ald' || u.def.cls === 'mnk')) o = u.def.cls === 'mnk' && e.kind === 'unit' ? {type: 'convert', tid: e.id} : {type: 'move', x: wx, y: wy};
    if (o.type === 'heal' && u.def.cls !== 'mnk') o = {type: 'guard', tid: e.id};
    if (o.type === 'pickrelic' && u.def.cls !== 'mnk') o = {type: 'move', x: wx, y: wy};
    if (o.type === 'deposit' && !u.relic) o = {type: 'move', x: wx, y: wy};
    if (o.type === 'garrison' && !canGarrison(u, e)) o = {type: 'move', x: wx, y: wy};
    if (o.type === 'move' && n > 1) { o.x = wx + ((k % cols) - (cols - 1) / 2) * 24; o.y = wy + (Math.floor(k / cols) - (Math.ceil(n / cols) - 1) / 2) * 24; k++; }
    issue(u, o, shift);
  }
  sfx(order.type === 'attack' ? 'order2' : 'order');
  G.fx.push({t: 'ping', x: wx, y: wy, life: 0.6});
}
function modeOrder(wx, wy, shift) {
  const S = UI.selected, e = entityAt(wx, wy), mode = UI.mode;
  if (mode === 'attackmove') { for (const u of S) if (u.def.cls !== 'ald') issue(u, {type: 'attackmove', x: wx, y: wy}, shift); }
  else if (mode === 'patrol') { for (const u of S) issue(u, {type: 'patrol', x: wx, y: wy, px: u.x, py: u.y}, shift); }
  else if (mode === 'guard') { if (e) for (const u of S) issue(u, {type: 'guard', tid: e.id}, shift); }
  else if (mode === 'repair') { if (e && e.kind === 'bld' && allied(e.owner, HUMAN)) for (const u of S) if (u.def.cls === 'ald') issue(u, {type: e.built < 1 ? 'build' : 'repair', tid: e.id}, shift); }
  else if (mode === 'garrison') { if (e && e.kind === 'bld') for (const u of S) if (canGarrison(u, e)) issue(u, {type: 'garrison', tid: e.id}, shift); }
  else if (mode === 'heal') { if (e && e.kind === 'unit' && allied(e.owner, HUMAN)) for (const u of S) if (u.def.cls === 'mnk') issue(u, {type: 'heal', tid: e.id}, shift); }
  else if (mode === 'convert') { if (e && e.kind === 'unit' && !allied(e.owner, HUMAN)) for (const u of S) if (u.def.cls === 'mnk') issue(u, {type: 'convert', tid: e.id}, shift); }
  else if (mode === 'rally') { contextOrder(wx, wy, false); }
  UI.mode = null; hint(''); sfx('order'); G.fx.push({t: 'ping', x: wx, y: wy, life: 0.6}); refreshPanel();
}
function selectIdleVillager() {
  const idle = G.units.filter(u => u.owner === HUMAN && u.def.cls === 'ald' && !u.order);
  if (!idle.length) { hint('No hay aldeanos ociosos'); return; }
  UI.idleIdx = ((UI.idleIdx || 0) + 1) % idle.length; const u = idle[UI.idleIdx];
  select([u]); centerOn(u.x, u.y);
}

// ------------------------------------------------------------ entrada
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousedown', e => {
  if (!G || G.over) return;
  const M = UI.mouse; M.down = true; M.btn = e.button; M.sx = e.clientX; M.sy = e.clientY; M.drag = false;
  if (e.button === 0 && UI.placing && BUILDINGS[UI.placing.type].wall) { const w = screenToWorld(e.clientX, e.clientY); const def = BUILDINGS[UI.placing.type]; UI.wallDrag = {x: Math.floor(w.x / TILE - def.w / 2 + .5), y: Math.floor(w.y / TILE - def.h / 2 + .5)}; }
  if (e.button === 1) { M.pan = {x: UI.cam.x, y: UI.cam.y}; e.preventDefault(); }
});
cv.addEventListener('mousemove', e => {
  const M = UI.mouse; M.x = e.clientX; M.y = e.clientY; M.in = true;
  if (M.down && !M.drag && Math.hypot(M.x - M.sx, M.y - M.sy) > 5) M.drag = true;
  if (M.down && M.btn === 1 && M.pan) { UI.cam.x = M.pan.x - (M.x - M.sx) / UI.cam.z; UI.cam.y = M.pan.y - (M.y - M.sy) / UI.cam.z; clampCam(); }
  if (G && !G.over) { const w = screenToWorld(M.x, M.y); UI.hover = M.y > TOP_H && M.y < cv.height - PANEL_H ? entityAt(w.x, w.y) : null; }
});
cv.addEventListener('mouseleave', () => { UI.mouse.in = false; });
addEventListener('mouseup', e => {
  const M = UI.mouse; if (!M.down) return; M.down = false;
  if (!G || G.over) return;
  if (M.btn === 1) { M.pan = null; return; }
  if (e.clientY < TOP_H || e.clientY > cv.height - PANEL_H) { M.drag = false; return; }
  const w = screenToWorld(e.clientX, e.clientY);
  if (M.btn === 2) { if (UI.placing || UI.mode) { UI.placing = null; UI.mode = null; UI.wallDrag = null; hint(''); refreshPanel(); return; } contextOrder(w.x, w.y, e.shiftKey); return; }
  if (UI.placing) { placeBuilding(e.shiftKey); return; }
  if (UI.mode) { modeOrder(w.x, w.y, e.shiftKey); return; }
  if (M.drag) {
    const ax = Math.min(M.sx, M.x), ay = Math.min(M.sy, M.y), bx = Math.max(M.sx, M.x), by = Math.max(M.sy, M.y);
    const list = G.units.filter(u => { if (u.owner !== HUMAN) return false; const s = worldToScreen(u.x, u.y); return s.x >= ax && s.x <= bx && s.y - 16 * UI.cam.z >= ay - 16 * UI.cam.z && s.y <= by + 4 && s.y - 20 * UI.cam.z <= by; });
    if (list.length) select(list, e.shiftKey); else if (!e.shiftKey) select([]);
    M.drag = false; return;
  }
  const t = entityAt(w.x, w.y);
  const now = performance.now();
  if (t && now - UI.lastClick < 350 && UI.lastClickId === t.id && t.kind === 'unit' && t.owner === HUMAN) {
    select(G.units.filter(u => u.owner === HUMAN && u.type === t.type && inView(u.x, u.y, 0)), e.shiftKey);
  } else if (t) { if (e.shiftKey && UI.selected.includes(t)) { UI.selected = UI.selected.filter(x => x !== t); UI.lastSel = ''; refreshPanel(); } else select([t], e.shiftKey); }
  else if (!e.shiftKey) select([]);
  UI.lastClick = now; UI.lastClickId = t ? t.id : -1;
});
cv.addEventListener('wheel', e => { if (!G) return; const w0 = screenToWorld(e.clientX, e.clientY); UI.cam.z = clamp(UI.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.6, 2.2); const w1 = screenToWorld(e.clientX, e.clientY); const i0 = isoOf(w0.x, w0.y), i1 = isoOf(w1.x, w1.y); UI.cam.x += i0.x - i1.x; UI.cam.y += i0.y - i1.y; clampCam(); e.preventDefault(); }, {passive: false});
function mmTo(e) { const r = mm.getBoundingClientRect(); const w = mmToWorld((e.clientX - r.left) / r.width * mm.width, (e.clientY - r.top) / r.height * mm.height); return {x: clamp(w.x, 0, G.map.w * TILE), y: clamp(w.y, 0, G.map.h * TILE)}; }
mm.addEventListener('mousedown', e => { if (!G) return; const p = mmTo(e); if (e.button === 2) { if (UI.mode) modeOrder(p.x, p.y, e.shiftKey); else contextOrder(p.x, p.y, e.shiftKey); } else { centerOn(p.x, p.y); UI.mmDown = true; } });
mm.addEventListener('mousemove', e => { if (UI.mmDown) { const p = mmTo(e); centerOn(p.x, p.y); } });
addEventListener('mouseup', () => UI.mmDown = false);
mm.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  if (!G || e.target.tagName === 'INPUT') return;
  const k = e.key; UI.keys[k.toLowerCase()] = true;
  if (k === 'F1') { e.preventDefault(); showOverlay('optOv', true); return; }
  if (k === 'Escape') { if (anyOverlay()) { if (!G.paused || $('#pauseOv').classList.contains('show')) { closeOverlays(); if (G.paused) togglePause(); } else closeOverlays(); } else if (UI.placing || UI.mode) { UI.placing = null; UI.mode = null; UI.wallDrag = null; hint(''); refreshPanel(); } else if (UI.selected.length) select([]); else togglePause(); return; }
  if (G.over || anyOverlay()) return;
  if (k === 'p' || k === 'P') { togglePause(); return; }
  if (k === 'f' || k === 'F') { cycleSpeed(); return; }
  if (k === 'm' || k === 'M') { if (!UI.selected.length) { toggleMute(); return; } }
  if (k === 'h' || k === 'H') { if (!UI.selected.some(s => s.kind === 'unit' && s.def.cls === 'ald')) { goHome(); return; } }
  if (k === '.') { selectIdleVillager(); return; }
  if (k === ' ') { const ev = G.events[G.events.length - 1]; if (ev) centerOn(ev.x, ev.y); e.preventDefault(); return; }
  if (k === 'Delete') { for (const u of UI.selected) if (u.kind === 'unit' && u.owner === HUMAN) killEntity(u, null); select([]); return; }
  if ((e.ctrlKey || e.metaKey) && (k === 'b' || k === 'B')) { townBell(HUMAN); e.preventDefault(); return; }
  if (/^[1-9]$/.test(k)) {
    if (e.ctrlKey || e.metaKey) { G.groups[k] = UI.selected.filter(u => u.kind === 'unit' && u.owner === HUMAN).map(u => u.id); hint('Grupo ' + k + ' creado'); e.preventDefault(); }
    else { const g = (G.groups[k] || []).map(id => G.byId[id]).filter(x => x && !x.inside); if (g.length) { select(g); if (UI.lastGroupKey === k && performance.now() - UI.lastGroupT < 400) centerOn(g[0].x, g[0].y); UI.lastGroupKey = k; UI.lastGroupT = performance.now(); } }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (k === 'a' || k === 'A')) { select(G.units.filter(u => u.owner === HUMAN && u.def.cls !== 'ald' && u.def.cls !== 'mnk')); e.preventDefault(); return; }
  const S = UI.selected; if (!S.length || S[0].owner !== HUMAN) return;
  const K = k.toUpperCase();
  if (S[0].kind === 'unit') {
    const hasV = S.some(u => u.def.cls === 'ald'), hasM = S.some(u => u.def.cls !== 'ald');
    if (K === 'S') { for (const u of S) { u.order = null; u.queue = []; u.path = []; } return; }
    if (K === 'G') { UI.mode = 'garrison'; hint('Haz clic en el edificio'); return; }
    if (hasM && K === 'A') { UI.mode = 'attackmove'; hint('Haz clic en el destino'); return; }
    if (hasM && K === 'Z') { UI.mode = 'patrol'; hint('Haz clic en el punto de patrulla'); return; }
    if (hasM && K === 'X') { UI.mode = 'guard'; hint('Haz clic en lo que quieres proteger'); return; }
    if (hasM && (K === 'Q' || K === 'W' || K === 'E') && !hasV) { const st = {Q: 0, W: 1, E: 2}[K]; for (const u of S) u.stance = st; UI.lastSel = ''; hint(['Postura agresiva', 'Postura defensiva', 'No moverse'][st]); return; }
    if (hasV && K === 'R') { UI.mode = 'repair'; hint('Haz clic en el edificio a reparar'); return; }
    if (hasV) { const t = Object.keys(BUILDINGS).find(t => BUILDINGS[t].key === K); if (t) startPlacing(t); }
  } else {
    const b = S[0];
    if (K === 'V' && b.garrison.length) { ungarrison(b); refreshPanel(); return; }
    if (b.def.trains) { const t = trainsOf(b).find(t => UNITS[t].key === K); if (t && UNITS[t].age <= P(HUMAN).age) { const n = e.shiftKey ? 5 : 1; for (let i = 0; i < n; i++) if (!enqueue(b, {kind: 'unit', id: t}, HUMAN)) break; refreshPanel(); } }
  }
});
addEventListener('keyup', e => { UI.keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { UI.keys = {}; });
function goHome() { const tc = G.buildings.find(b => b.owner === HUMAN && b.type === 'centro'); if (tc) { centerOn(tc.x, tc.y); select([tc]); } }
function updateCamera(dt) {
  const spd = 800 / UI.cam.z * dt; const K = UI.keys; const M = UI.mouse;
  let dx = 0, dy = 0;
  if (K['arrowleft']) dx -= 1; if (K['arrowright']) dx += 1; if (K['arrowup']) dy -= 1; if (K['arrowdown']) dy += 1;
  if (OPTS.edge && M.in && document.hasFocus() && !M.down && !anyOverlay()) { const E = 14; if (M.x < E) dx -= 1; if (M.x > cv.width - E) dx += 1; if (M.y < TOP_H + E && M.y > TOP_H) dy -= 1; if (M.y > cv.height - PANEL_H - E && M.y < cv.height - PANEL_H) dy += 1; }
  if (dx || dy) { UI.cam.x += dx * spd; UI.cam.y += dy * spd * 0.6; clampCam(); }
}
// ------------------------------------------------------------ HUD
function updateHud() {
  const pl = P(HUMAN), r = pl.res;
  $('#rFood').textContent = Math.floor(r.food); $('#rWood').textContent = Math.floor(r.wood); $('#rStone').textContent = Math.floor(r.stone); $('#rGold').textContent = Math.floor(r.gold);
  const w = {food: 0, wood: 0, stone: 0, gold: 0};
  for (const u of G.units) if (u.owner === HUMAN && u.order && (u.order.type === 'gather' || u.order.type === 'return')) { const k = u.order.res || (u.carry && u.carry.type); if (k) w[k]++; }
  $('#wFood').textContent = w.food ? '(' + w.food + ')' : ''; $('#wWood').textContent = w.wood ? '(' + w.wood + ')' : ''; $('#wStone').textContent = w.stone ? '(' + w.stone + ')' : ''; $('#wGold').textContent = w.gold ? '(' + w.gold + ')' : '';
  const pc = popCount(HUMAN), cap = popCap(HUMAN);
  const pop = $('#pop'); pop.textContent = pc + ' / ' + cap; pop.className = pc >= cap ? 'full' : '';
  $('#age').textContent = AGES[pl.age]; $('#civTag').textContent = CIVS[pl.civ].name;
  $('#clock').textContent = fmtTime(G.time);
  $('#btnSpeed').textContent = G.speed + '×';
  $('#btnPause').classList.toggle('on', G.paused);
  $('#btnBell').classList.toggle('on', pl.bell);
  $('#btnIdle').classList.toggle('on', G.units.some(u => u.owner === HUMAN && u.def.cls === 'ald' && !u.order && u.idleT > 2));
  // jugadores
  $('#players').innerHTML = G.players.map(p => `<div class="${p.alive ? '' : 'dead'}"><i style="background:${p.color}"></i>${p.name}${p.id !== HUMAN ? ` · ${CIVS[p.civ].name}` : ''}${allied(p.id, HUMAN) && p.id !== HUMAN ? ' (aliado)' : ''} · ${AGES[p.age].replace('Época de ', '').replace('las ', '').replace('los ', '')}</div>`).join('');
  // maravilla
  const wb = $('#wonderBar'); const wonders = G.buildings.filter(b => b.def.wonder && b.built >= 1 && b.wonderT !== null);
  if (wonders.length) { wb.style.display = 'block'; wb.textContent = wonders.map(b => `Maravilla de ${P(b.owner).name}: ${fmtTime(b.wonderT)}`).join(' · '); } else wb.style.display = 'none';
  if (G.mission) renderObjectives();
  refreshPanel();
}
