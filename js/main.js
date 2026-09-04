// ============================================================ BUCLE PRINCIPAL, MENÚS, GUARDADO
const SAVE_KEY = "cid-save-v3";
let lastT = 0, acc = 0, hudT = 0, running = false;
function frame(t) {
  if (!running) return;
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.1, (t - lastT) / 1000 || 0); lastT = t;
  updateCamera(dtReal);
  if (!G.paused && !G.over) {
    acc += dtReal * G.speed;
    const step = 1 / 30; let n = 0;
    while (acc >= step && n++ < 6) { simulate(step); acc -= step; }
    if (acc > step * 6) acc = 0;
  }
  render();
  hudT -= dtReal; if (hudT <= 0) { hudT = 0.2; updateHud(); }
}
function showOverlay(id, keepPause) { $('#' + id).classList.add('show'); }
function closeOverlays() { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show')); }
function anyOverlay() { return !!document.querySelector('.overlay.show'); }
function togglePause() {
  if (!G || G.over) return;
  G.paused = !G.paused;
  if (G.paused) { $('#pauseInfo').textContent = `${fmtTime(G.time)} · ${AGES[P(HUMAN).age]} · ${CIVS[P(HUMAN).civ].name} · Aldeanos ${G.units.filter(u => u.owner === HUMAN && u.def.cls === 'ald').length} · Ejército ${G.units.filter(u => u.owner === HUMAN && u.def.cls !== 'ald').length} · Puntuación ${score(HUMAN)}`; showOverlay('pauseOv'); }
  else closeOverlays();
}
function cycleSpeed() { G.speed = G.speed === 1 ? 1.5 : G.speed === 1.5 ? 2 : G.speed === 2 ? 3 : 1; hint('Velocidad ' + G.speed + '×'); }
function endGame(win, text) {
  if (G.over) return;
  G.over = true; recordHistory();
  const s = P(HUMAN).stats;
  $('#endTitle').textContent = win ? '¡Victoria!' : 'Derrota';
  $('#endTitle').style.color = win ? 'var(--accent)' : 'var(--red)';
  $('#endText').textContent = text || (win ? 'Los reinos rivales han caído.' : 'Tu ciudad ha caído.');
  const rows = [['Duración', fmtTime(G.time)], ['Época alcanzada', AGES[P(HUMAN).age]], ['Puntuación', score(HUMAN)], ['Unidades entrenadas', s.trained], ['Enemigos abatidos', s.killed], ['Bajas propias', s.lost], ['Edificios arrasados', s.razed], ['Recursos recolectados', Math.floor(s.gathered)], ['Conversiones', s.converted], ['Tecnologías', P(HUMAN).techs.size]];
  $('#endStats').innerHTML = rows.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
  drawEndChart();
  $('#endLegend').innerHTML = G.players.map(p => `<span><i style="background:${p.color}"></i>${p.name} (${CIVS[p.civ].name})</span>`).join('');
  const nextBtn = $('#btnNextMission'); nextBtn.classList.toggle('hidden', !(win && G.mission && G.mission.index < MISSIONS.length - 1));
  showOverlay('endOv');
  sfx(win ? 'victory' : 'defeat');
  try { const rec = JSON.parse(localStorage.getItem('edad-reinos-record') || '{"wins":0,"games":0,"best":0}'); rec.games++; if (win) rec.wins++; rec.best = Math.max(rec.best, score(HUMAN)); localStorage.setItem('edad-reinos-record', JSON.stringify(rec)); localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
function drawEndChart() {
  const c = $('#endChart'); c.width = c.clientWidth || 760; const x = c.getContext('2d'); const W = c.width, H = c.height;
  x.fillStyle = '#0d1216'; x.fillRect(0, 0, W, H);
  const h = G.history; if (h.length < 2) return;
  const maxS = Math.max(1, ...h.map(r => Math.max(...r.s))), maxT = h[h.length - 1].t;
  x.strokeStyle = '#3a4854'; x.lineWidth = 1; for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(40, H - 20 - (H - 30) * k / 4); x.lineTo(W - 10, H - 20 - (H - 30) * k / 4); x.stroke(); }
  x.fillStyle = '#9aa7b1'; x.font = '10px system-ui'; x.fillText(String(maxS), 4, 14); x.fillText('0', 4, H - 22); x.fillText('Puntuación a lo largo de la partida', 44, H - 6); x.fillText(fmtTime(maxT), W - 40, H - 6);
  G.players.forEach((p, i) => { x.strokeStyle = p.color; x.lineWidth = 2; x.beginPath(); h.forEach((r, k) => { const px = 40 + (r.t / maxT) * (W - 50), py = H - 20 - (r.s[i] / maxS) * (H - 30); k ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); });
}

// ------------------------------------------------------------ guardar / cargar
function serialize() {
  const stripU = u => { const o = {...u}; delete o.def; o.path = []; return o; };
  const stripB = b => { const o = {...b}; delete o.def; o.garrison = b.garrison.map(stripU); return o; };
  const m = G.map;
  return JSON.stringify({
    v: 2, opts: G.opts, time: G.time, speed: G.speed, nextId: G.nextId, groups: G.groups, history: G.history, flags: G.flags, revealAll: !!G.revealAll,
    players: G.players.map(p => ({...p, techs: [...p.techs], ai: p.ai ? {wave: p.ai.wave, nextAttack: p.ai.nextAttack, farmCount: p.ai.farmCount, towerT: p.ai.towerT, passiveUntil: p.ai.passiveUntil, expandT: p.ai.expandT, pers: p.ai.pers.name, firstAttack: p.ai.firstAttack, waveGap: p.ai.waveGap} : null})),
    map: {w: m.w, type: m.type, terrain: Array.from(m.terrain), amount: Array.from(m.amount), explored: Array.from(m.explored), variant: Array.from(m.variant), starts: m.starts, relics: m.relics, seed: m.seed},
    units: G.units.map(stripU), buildings: G.buildings.map(stripB),
    mission: G.mission ? {index: G.mission.index, done: G.mission.done, failed: G.mission.failed, triggered: [...G.mission.triggered], everyCount: G.mission.everyCount} : null,
    cam: UI.cam,
  });
}
function deserialize(json) {
  const d = JSON.parse(json);
  G = {opts: d.opts, map: null, units: [], buildings: [], byId: {}, nextId: d.nextId, time: d.time, speed: d.speed || 1, paused: false, over: false, players: [], lastAttackAlert: -99, projectiles: [], fx: [], groups: d.groups || {}, events: [], history: d.history || [], wonder: null, mission: null, flags: d.flags || {}, msgs: [], sim: 0, revealAll: d.revealAll};
  const m = Object.create(GameMap.prototype);
  m.w = m.h = d.map.w; m.type = d.map.type; m.nPlayers = d.players.length; m.seed = d.map.seed; m.rng = mulberry(m.seed);
  m.terrain = Uint8Array.from(d.map.terrain); m.amount = Uint16Array.from(d.map.amount); m.explored = Uint8Array.from(d.map.explored); m.variant = Uint8Array.from(d.map.variant); m.visible = new Uint8Array(m.w * m.h); m.bld = new Int32Array(m.w * m.h).fill(-1); m.starts = d.map.starts; m.relics = d.map.relics; m.dirty = true;
  G.map = m;
  for (const p of d.players) { const pl = {...p, techs: new Set(p.techs), ai: null}; G.players.push(pl); }
  for (const b of d.buildings) { b.def = BUILDINGS[b.type]; b.garrison = b.garrison.map(u => { u.def = UNITS[u.type]; u.path = []; return u; }); G.buildings.push(b); G.byId[b.id] = b; m.setBuildingTiles(b, b.id); for (const u of b.garrison) G.byId[u.id] = u; }
  for (const u of d.units) { u.def = UNITS[u.type]; u.path = []; u.repathT = 0; G.units.push(u); G.byId[u.id] = u; }
  d.players.forEach((p, i) => { if (p.ai) { const ai = new AI(i, p.diff, p.ai.pers); Object.assign(ai, {wave: p.ai.wave, nextAttack: p.ai.nextAttack, farmCount: p.ai.farmCount, towerT: p.ai.towerT, passiveUntil: p.ai.passiveUntil, expandT: p.ai.expandT, firstAttack: p.ai.firstAttack, waveGap: p.ai.waveGap}); G.players[i].ai = ai; } });
  if (d.mission) { const mi = d.mission; G.mission = {index: mi.index, def: MISSIONS[mi.index], done: mi.done, failed: mi.failed, triggered: new Set(mi.triggered), everyCount: mi.everyCount, noWonder: !!MISSIONS[mi.index].setup.noWonder}; }
  UI.cam = d.cam || UI.cam;
  return G;
}
function saveGame() { if (!G || G.over) return; try { localStorage.setItem(SAVE_KEY, serialize()); log('Partida guardada', 'good'); sfx('chime'); } catch (e) { log('No se pudo guardar', 'warn'); } }

// ------------------------------------------------------------ inicio de partida
function startGame(loaded) {
  UI.selected = []; UI.placing = null; UI.mode = null; UI.chunks.clear(); UI.fogCanvas = null; UI.fogStamp = null; UI.mmBase = null; UI.mmT = 0; UI.lastSel = ''; UI.objCollapsed = false;
  closeOverlays(); $('#log').innerHTML = ''; $('#objectives').style.display = 'none';
  recomputeFog();
  const tc = G.buildings.find(b => b.owner === HUMAN && b.type === 'centro') || G.buildings.find(b => b.owner === HUMAN);
  if (tc && !loaded) { UI.cam.z = 1.25; centerOn(tc.x, tc.y); select([tc]); }
  clampCam();
  if (!loaded && !G.mission) { log(`Juegas con ${CIVS[P(HUMAN).civ].name}: ${CIVS[P(HUMAN).civ].bonuses[0].toLowerCase()}.`, 'info'); log('Selecciona el Centro urbano y entrena aldeanos (A). Comida y madera primero.', 'info'); }
  running = true; lastT = performance.now(); acc = 0;
  requestAnimationFrame(frame);
}
function pickOpt(sel) { const o = document.querySelector(sel + ' .opt.on'); return o ? o.dataset.v : null; }
document.querySelectorAll('.opts:not(#optToggles)').forEach(g => g.querySelectorAll('.opt').forEach(o => o.onclick = () => { if (!o.dataset.v) return; g.querySelectorAll('.opt').forEach(x => x.classList.remove('on')); o.classList.add('on'); sfx('click'); }));
// civilizaciones
const civBox = $('#civOpts');
CIV_LIST.forEach((id, i) => { const c = CIVS[id]; const d = document.createElement('div'); d.className = 'opt' + (i === 0 ? ' on' : ''); d.dataset.v = id; d.innerHTML = `<b>${c.name}</b><small>${c.title}</small><small style="margin-top:4px;color:#b9c4cc">${c.bonuses[0]}</small>`; d.onclick = () => { civBox.querySelectorAll('.opt').forEach(x => x.classList.remove('on')); d.classList.add('on'); sfx('click'); }; civBox.appendChild(d); });
function skirmishOpts() {
  const civ = pickOpt('#civOpts'), riv = pickOpt('#rivOpts'), diff = +pickOpt('#diffOpts'), mapType = pickOpt('#mapOpts'), size = +pickOpt('#sizeOpts'), start = +pickOpt('#startOpts');
  const others = CIV_LIST.filter(c => c !== civ).sort(() => Math.random() - 0.5);
  const players = [{human: true, civ, team: 0, name: 'Tú'}];
  const nm = c => CIVS[c].leader + ' (' + CIVS[c].name + ')';
  if (riv === '2v2') { players.push({civ: others[0], team: 0, diff, name: nm(others[0])}); players.push({civ: others[1], team: 1, diff, name: nm(others[1])}); players.push({civ: others[2], team: 1, diff, name: nm(others[2])}); }
  else for (let i = 0; i < +riv; i++) players.push({civ: others[i], team: i + 1, diff, name: nm(others[i])});
  return {players, mapType, size, start};
}
$('#mSkirmish').onclick = () => { closeOverlays(); showOverlay('skirmOv'); };
$('#btnBackSkirm').onclick = () => { closeOverlays(); showMain(); };
$('#btnStartSkirm').onclick = () => { running = false; newGame(skirmishOpts()); startGame(false); };
$('#mCampaign').onclick = () => { closeOverlays(); renderMissionList(); showOverlay('campOv'); };
$('#btnBackCamp').onclick = () => { closeOverlays(); showMain(); };
$('#btnResetCamp').onclick = () => { if (confirm('¿Borrar el progreso de la campaña?')) { saveCampaignProgress({unlocked: 1, done: []}); renderMissionList(); } };
function renderMissionList() {
  const prog = campaignProgress(); const el = $('#missionList'); el.innerHTML = '';
  MISSIONS.forEach((m, i) => { const locked = i >= prog.unlocked; const d = document.createElement('div'); d.className = 'mission' + (locked ? ' locked' : ''); d.innerHTML = `<div class="n" data-n="${i + 1}"></div><div><b>${m.title}</b><small>${m.subtitle}</small></div>${prog.done.includes(i) ? '<span class="done">✔ Completada</span>' : locked ? '<span class="done" style="color:var(--muted)">Bloqueada</span>' : ''}`; if (!locked) d.onclick = () => showBriefing(i); el.appendChild(d); });
}
let briefIndex = 0;
function showBriefing(i) { briefIndex = i; const m = MISSIONS[i]; $('#briefTitle').textContent = m.title; $('#briefText').textContent = m.brief; $('#briefHistory').textContent = m.history || ''; $('#briefObj').innerHTML = m.objectives.map(o => `<li>${o.text}</li>`).join(''); closeOverlays(); showOverlay('briefOv'); }
$('#btnBackBrief').onclick = () => { closeOverlays(); renderMissionList(); showOverlay('campOv'); };
$('#btnStartMission').onclick = () => startMission(briefIndex);
function startMission(i) { running = false; const m = MISSIONS[i]; const players = m.setup.players.map(p => ({...p})); newGame({players, mapType: m.setup.mapType, size: m.setup.size, start: m.setup.start || 0, mission: i, seed: m.setup.seed}); startGame(false); log(m.title, 'story'); }
$('#btnNextMission').onclick = () => { if (G.mission && G.mission.index < MISSIONS.length - 1) showBriefing(G.mission.index + 1); };
$('#mContinue').onclick = () => { try { const s = localStorage.getItem(SAVE_KEY); if (!s) return; running = false; deserialize(s); startGame(true); log('Partida cargada', 'good'); } catch (e) { console.error(e); log('La partida guardada no es válida', 'warn'); } };
$('#mOptions').onclick = () => { closeOverlays(); showOverlay('optOv'); };
$('#btnBackOpt').onclick = () => { closeOverlays(); if (!G || G.over || !running) showMain(); else if (G.paused) showOverlay('pauseOv'); };
$('#btnOpt2').onclick = () => { closeOverlays(); showOverlay('optOv'); };
$('#mCodex').onclick = () => { closeOverlays(); renderCodex(); showOverlay('codexOv'); };
$('#btnBackCodex').onclick = () => { closeOverlays(); showMain(); };
$('#btnResume').onclick = () => togglePause();
$('#btnPause').onclick = () => togglePause();
$('#btnSpeed').onclick = () => cycleSpeed();
$('#btnBell').onclick = () => townBell(HUMAN);
$('#btnSave2').onclick = () => { saveGame(); togglePause(); };
$('#btnMenu').onclick = () => { if (!G.paused) togglePause(); };
$('#btnQuit').onclick = () => { if (!confirm('¿Abandonar la partida? Se guardará automáticamente para continuar después.')) return; try { localStorage.setItem(SAVE_KEY, serialize()); } catch (e) {} running = false; G.over = true; closeOverlays(); showMain(); };
$('#btnAgain').onclick = () => { running = false; closeOverlays(); showMain(); };
$('#btnIdle').onclick = () => selectIdleVillager();
$('#btnHome').onclick = () => goHome();
$('#btnArmy').onclick = () => { const a = G.units.filter(u => u.owner === HUMAN && u.def.cls !== 'ald' && u.def.cls !== 'mnk'); if (a.length) { select(a); centerOn(a[0].x, a[0].y); } else hint('No tienes ejército'); };
$('#objectives h4').onclick = () => { UI.objCollapsed = !UI.objCollapsed; renderObjectives(); };
// opciones
$('#optVol').value = Math.round(OPTS.vol * 100); $('#optMusic').value = Math.round(OPTS.music * 100); $('#optVolV').textContent = Math.round(OPTS.vol * 100) + '%'; $('#optMusicV').textContent = Math.round(OPTS.music * 100) + '%';
$('#optVol').oninput = e => { OPTS.vol = e.target.value / 100; $('#optVolV').textContent = e.target.value + '%'; applyVolume(); saveOpts(); };
$('#optMusic').oninput = e => { OPTS.music = e.target.value / 100; $('#optMusicV').textContent = e.target.value + '%'; applyVolume(); saveOpts(); };
document.querySelectorAll('#optOv .opt[data-k]').forEach(o => { o.classList.toggle('on', !!OPTS[o.dataset.k]); o.onclick = () => { OPTS[o.dataset.k] = !OPTS[o.dataset.k]; o.classList.toggle('on', OPTS[o.dataset.k]); saveOpts(); if (G && G.map) G.map.dirty = true; UI.terrainT = 0; }; });
function showMain() {
  closeOverlays(); showOverlay('mainOv');
  let has = null; try { has = localStorage.getItem(SAVE_KEY); } catch (e) {}
  $('#mContinue').classList.toggle('hidden', !has);
  if (has) { try { const d = JSON.parse(has); $('#mContinueInfo').textContent = `${d.mission !== null && d.mission !== undefined ? MISSIONS[d.mission.index].title : 'Escaramuza'} · ${fmtTime(d.time)} · ${AGES[d.players[0].age]}`; } catch (e) {} }
  try { const rec = JSON.parse(localStorage.getItem('edad-reinos-record') || '{"wins":0,"games":0,"best":0}'); const prog = campaignProgress(); $('#recordLine').textContent = `Partidas: ${rec.games} · Victorias: ${rec.wins} · Mejor puntuación: ${rec.best} · Misiones completadas: ${prog.done.length}/${MISSIONS.length}`; } catch (e) {}
  ctx.fillStyle = '#0f1418'; ctx.fillRect(0, 0, cv.width, cv.height);
}
function renderCodex() {
  const el = $('#codexBody');
  let h = '<h2>Civilizaciones</h2><div class="civcard">' + CIV_LIST.map(id => { const c = CIVS[id]; return `<div class="opt" style="cursor:default"><b>${c.name}</b><small>${c.title}</small><small style="color:#b9c4cc;margin-top:4px">${c.bonuses.join('<br>')}</small></div>`; }).join('') + '</div>';
  h += '<h2>Unidades</h2><div class="keys">' + Object.entries(UNITS).filter(([k, u]) => !u.hero).map(([k, u]) => `<b>${u.name}</b><span>${CLS_ES[u.cls]} · ${AGES[u.age]} · Vida ${u.hp} · Ataque ${u.atk}${u.rng ? ' · Alcance ' + u.rng : ''} · Armadura ${u.arm[0]}/${u.arm[1]} · ${costStr(u.cost) || 'gratis'}${u.unique ? ' · Única de ' + CIVS[u.unique].name : ''}<br><i style="color:#8a97a1">${u.desc}</i></span>`).join('') + '</div>';
  h += '<h2>Edificios</h2><div class="keys">' + Object.entries(BUILDINGS).map(([k, b]) => `<b>${b.name}</b><span>${AGES[b.age]} · ${b.w}×${b.h} · Vida ${b.hp} · ${costStr(b.cost)} · ${b.time}s<br><i style="color:#8a97a1">${b.desc}</i></span>`).join('') + '</div>';
  h += '<h2>Tecnologías</h2><div class="keys">' + Object.entries(TECHS).map(([k, t]) => `<b>${t.name}</b><span>${AGES[t.age]} · ${costStr(t.cost)} · ${t.time}s — ${t.desc}</span>`).join('') + '</div>';
  el.innerHTML = h;
}
showMain();
setInterval(() => { if (running && G && !G.over && !G.paused) { try { localStorage.setItem(SAVE_KEY, serialize()); } catch (e) {} } }, 120000);
