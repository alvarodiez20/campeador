// ============================================================ CAMPAÑA: La vida del Cid (1063–1094)
function spawnGroup(owner, types, x, y, order) {
  const out = [];
  for (const t of types) { const u = spawnUnit(owner, t, {x, y, tx: Math.floor(x / TILE), ty: Math.floor(y / TILE), w: 1, h: 1}, UNITS[t].hero); if (order) issue(u, typeof order === 'function' ? order(u) : {...order}); out.push(u); }
  return out;
}
function edgePoint(towards) {
  const m = G.map; const cx = m.w * TILE / 2, cy = m.h * TILE / 2; const dx = cx - towards.x, dy = cy - towards.y; const d = Math.hypot(dx, dy) || 1;
  let x = towards.x + dx / d * (m.w * TILE * 0.9), y = towards.y + dy / d * (m.h * TILE * 0.9);
  x = clamp(x, TILE * 3, (m.w - 3) * TILE); y = clamp(y, TILE * 3, (m.h - 3) * TILE);
  return {x, y};
}
function humanTC() { return G.buildings.find(b => b.owner === HUMAN && b.type === 'centro') || G.buildings.find(b => b.owner === HUMAN) || hero('rodrigo') || G.units.find(u => u.owner === HUMAN); }
function tcOf(p) { return G.buildings.find(b => b.owner === p && b.type === 'centro') || G.buildings.find(b => b.owner === p); }
function hero(type) { return G.units.find(u => u.type === type) || G.buildings.flatMap(b => b.garrison).find(u => u.type === type); }
function story(msg) { log(msg, 'story'); }
function towersOf(p) { return G.buildings.filter(b => b.owner === p && b.type === 'torre').length; }

const MISSIONS = [
  {
    id: 'graus', title: 'I · Graus, 1063', subtitle: 'El joven Rodrigo, alférez del infante Sancho, socorre a Zaragoza',
    brief: `Primavera de 1063. Ramiro I de Aragón ha puesto sitio a Graus, plaza de la taifa de Zaragoza, y al-Muqtadir pide ayuda a su protector cristiano, Fernando I de León y Castilla. El rey envía al infante Sancho con la hueste castellana; entre sus caballeros cabalga un joven de Vivar llamado Rodrigo Díaz.\n\nEstablece tu campamento junto al de los zaragozanos, tus aliados. Levanta una economía, prepara un cuartel y alcanza la Época de los Condados. Los aragoneses no tardarán en lanzarse contra ti: rechaza su ataque y luego arrasa su campamento.`,
    history: `Tras la caída del califato de Córdoba (1031), al-Ándalus se fragmentó en reinos de taifas que pagaban parias —tributos en oro— a los reinos cristianos a cambio de protección. La guerra del siglo XI no era todavía una cruzada: cristianos y musulmanes se aliaban y combatían según conviniera. En Graus, el rey Ramiro I de Aragón murió en la batalla, y la Historia Roderici, biografía latina del Cid, sitúa allí a Rodrigo, criado en la corte junto al infante Sancho, con unos dieciocho años.`,
    setup: {mapType: 'praderas', size: 64, players: [
      {human: true, civ: 'castilla', name: 'Hueste de Castilla', team: 0, extra: [{u: 'rodrigo', hero: true}]},
      {civ: 'aragon', name: 'Ramiro I de Aragón', diff: 0, personality: 'agresivo', team: 1, passive: 780},
      {civ: 'zaragoza', name: 'al-Muqtadir de Zaragoza', diff: 1, personality: 'economico', team: 0}]},
    objectives: [
      {id: 'v8', text: 'Entrena hasta tener 8 aldeanos', check: () => G.units.filter(u => u.owner === HUMAN && u.def.cls === 'ald').length >= 8},
      {id: 'cuartel', text: 'Construye un Cuartel y una Casa', check: () => G.buildings.some(b => b.owner === HUMAN && b.type === 'cuartel' && b.built >= 1) && G.buildings.some(b => b.owner === HUMAN && b.type === 'casa' && b.built >= 1)},
      {id: 'feudal', text: 'Alcanza la Época de los Condados', check: () => P(HUMAN).age >= 1},
      {id: 'raid', text: 'Rechaza la acometida aragonesa', check: () => G.flags.raidSpawned && !G.units.some(u => u.raid), after: 'feudal'},
      {id: 'destroy', text: 'Arrasa el campamento de Ramiro I', check: () => !P(1).alive, after: 'raid'},
      {id: 'rodrigo', text: 'Rodrigo debe sobrevivir', check: () => false, fail: () => !!G.flags.dead_rodrigo, permanent: true},
    ],
    triggers: [
      {at: 2, action: () => story('Infante Sancho: «Rodrigo, cuida de este campamento como si fuera Vivar. Los de Zaragoza pagan en oro, y el oro se defiende.»')},
      {at: 30, action: () => story('Consejo: selecciona el Centro urbano y pulsa A para entrenar aldeanos. Envíalos a las bayas y al bosque con el botón derecho.')},
      {at: 120, action: () => story('Consejo: cada casa da 5 de población. Constrúyelas antes de quedarte sin sitio, y un molino junto a las bayas ahorra viajes.')},
      {when: () => G.flags.done_cuartel, action: () => story('Rodrigo: «Con un cuartel en pie ya somos hueste, no caravana. Que Ramiro venga cuando quiera.»')},
      {when: () => G.flags.done_feudal, action: () => { const tc = humanTC(); const p = edgePoint(tc); spawnGroup(1, ['milicia', 'milicia', 'milicia', 'milicia', 'arquero', 'arquero'], p.x, p.y, u => ({type: 'attackmove', x: tc.x, y: tc.y})).forEach(u => u.raid = true); G.flags.raidSpawned = true; story('¡Los vigías avistan aragoneses en marcha hacia el campamento! Prepara la defensa.'); alertPlayer(HUMAN, p.x, p.y, '¡Acometida aragonesa!'); }},
      {when: () => G.flags.done_raid, action: () => { story('Rodrigo: «Han huido monte arriba. Sabemos dónde acampan: ahora nos toca a nosotros.»'); for (const b of G.buildings) if (b.owner === 1) G.map.reveal(b.x / TILE, b.y / TILE, 4); }},
    ],
    outro: 'Graus no cae y Ramiro I muere en el campo. Al-Muqtadir seguirá pagando parias a Castilla, y el infante Sancho no olvidará al joven de Vivar que cabalgó a su lado. Dos años después, muerto Fernando I, Sancho será rey de Castilla y Rodrigo, su alférez.',
  },
  {
    id: 'zamora', title: 'II · Zamora, 1072', subtitle: 'El cerco de Zamora y la muerte del rey Sancho',
    brief: `Otoño de 1072. Sancho II ha vencido a sus hermanos Alfonso y García y ha reunido de nuevo el reino de su padre. Solo Zamora, fiel a la infanta Urraca, resiste tras sus murallas romanas. El rey acampa ante la ciudad con Rodrigo, su alférez, al mando de la hueste.\n\nRompe las defensas: derriba tres torres de Zamora para abrir brecha. Te hará falta asedio del Taller. Cuando la ciudad tiemble, ocurrirá algo que cambiará la historia de Castilla: mantén cerca a Rodrigo y a sus jinetes más rápidos.`,
    history: `A la muerte de Fernando I (1065) el reino se repartió: Castilla para Sancho, León para Alfonso, Galicia para García, y Zamora y Toro para las infantas Urraca y Elvira. Sancho II, con Rodrigo como alférez, derrotó a sus hermanos en Llantada (1068) y Golpejera (1072). Durante el cerco de Zamora, el 7 de octubre de 1072, el noble zamorano Vellido Dolfos salió de la ciudad fingiendo pasarse a los castellanos y mató al rey. La leyenda cuenta que Rodrigo lo persiguió hasta la puerta de la muralla, pero Vellido escapó. Alfonso VI volvió de su exilio en Toledo y reunió los tres reinos. La Jura de Santa Gadea, en la que Rodrigo habría obligado a Alfonso a jurar su inocencia, es una leyenda posterior; lo cierto es que el Cid siguió en la corte y en 1074 se casó con Jimena Díaz, pariente del rey.`,
    setup: {mapType: 'praderas', size: 72, start: 1, players: [
      {human: true, civ: 'castilla', name: 'Sancho II y Rodrigo', team: 0, age: 2, res: {food: 1200, wood: 1400, stone: 500, gold: 900}, villagers: 8, extra: [{u: 'rodrigo', hero: true}, {u: 'sancho', hero: true}, {u: 'caballero', n: 6}, {u: 'arquero', n: 6}, {u: 'milicia', n: 4}]},
      {civ: 'leon', name: 'Urraca de Zamora', diff: 1, personality: 'defensivo', team: 1, age: 2, resMul: 1.5, fortress: true, extra: [{b: 'castillo', dx: 3, dy: 4}, {u: 'infanzon', n: 4}, {u: 'arquero', n: 6}]}]},
    objectives: [
      {id: 'towers', text: 'Derriba tres torres de Zamora', check: () => G.flags.towers0 !== undefined && towersOf(1) <= G.flags.towers0 - 3, progress: () => G.flags.towers0 !== undefined ? Math.max(0, towersOf(1) - (G.flags.towers0 - 3)) + ' torres restantes' : ''},
      {id: 'vellido', text: 'Atrapa a Vellido Dolfos antes de que cruce las murallas (opcional)', check: () => !!G.flags.dead_vellido, after: 'towers', optional: true},
      {id: 'castle', text: 'Toma Zamora: destruye su castillo', check: () => G.flags.zamoraSpawned && !G.buildings.some(b => b.owner === 1 && b.type === 'castillo'), after: 'towers'},
      {id: 'rodrigo', text: 'Rodrigo debe sobrevivir', check: () => false, fail: () => !!G.flags.dead_rodrigo, permanent: true},
    ],
    triggers: [
      {at: 1, action: () => { G.flags.towers0 = towersOf(1); G.flags.zamoraSpawned = true; const sa = hero('sancho'), htc = humanTC(); if (sa && htc && htc.kind === 'bld') issue(sa, {type: 'guard', tid: htc.id}); const c = G.buildings.find(b => b.owner === 1 && b.type === 'castillo'); if (c) G.map.reveal(c.x / TILE, c.y / TILE, 6); story('Sancho II: «Zamora la bien cercada. Alférez, quiero esas torres en el suelo antes del invierno.»'); }},
      {at: 25, action: () => story('Consejo: construye un Taller de asedio (T) y catapultas. Los arietes son casi inmunes a las flechas de las torres.')},
      {when: () => G.flags.done_towers, action: () => { story('Un caballero zamorano, Vellido Dolfos, se presenta en el campamento: dice que abandona a Urraca y que conoce un postigo para entrar en la ciudad. El rey quiere verlo en persona...'); G.flags.vellidoT = G.time; }},
      {when: () => G.flags.vellidoT && G.time > G.flags.vellidoT + 25, action: () => { const s = hero('sancho'); const c = G.buildings.find(b => b.owner === 1 && b.type === 'castillo'); const pos = s ? {x: s.x, y: s.y} : humanTC(); if (s) { G.fx.push({t: 'death', x: s.x, y: s.y, c: '#f0c94a', life: 1}); killEntity(s, null); } const v = spawnGroup(1, ['vellido'], pos.x, pos.y, c ? {type: 'move', x: c.x, y: c.y} : null)[0]; v.def = {...UNITS.vellido}; G.flags.vellidoId = v.id; alertPlayer(HUMAN, pos.x, pos.y, '¡El rey ha sido asesinado!'); story('¡Traición! Vellido Dolfos ha atravesado al rey con un venablo y huye a caballo hacia las puertas de Zamora. ¡Rodrigo, tras él!'); sfx('horn'); }},
      {when: () => G.flags.vellidoId && G.byId[G.flags.vellidoId] && (() => { const v = G.byId[G.flags.vellidoId]; const c = G.buildings.find(b => b.owner === 1 && b.type === 'castillo'); return c && distToEntity(v.x, v.y, c) < TILE * 2.5; })(), action: () => { const v = G.byId[G.flags.vellidoId]; if (v) removeEntity(v, true); story('Vellido Dolfos se ha refugiado tras las murallas. Los castellanos, sin rey, juran vengarlo: Zamora debe caer.'); G.flags.vellidoEscaped = true; }},
      {when: () => G.flags.dead_vellido, action: () => story('Vellido Dolfos ha muerto bajo la espada de Rodrigo. La crónica dirá que escapó; esta vez, no.')},
    ],
    outro: 'Zamora abre sus puertas, pero ya no hay rey castellano que la reciba. Alfonso VI regresa de Toledo, hereda León y Castilla y confirma a Rodrigo en la corte. En 1074 el de Vivar se casa con doña Jimena, pariente del rey. La paz durará siete años.',
  },
  {
    id: 'destierro', title: 'III · El destierro, 1081', subtitle: 'Con trescientos caballeros, camino de Zaragoza',
    brief: `Verano de 1081. Alfonso VI ha desterrado a Rodrigo Díaz por una incursión no autorizada contra la taifa de Toledo, protegida del rey. Con su mesnada y sin más hacienda que sus armas, el Cid abandona Castilla hacia el este. Ni Barcelona ni Aragón lo quieren; Zaragoza sí.\n\nNo tienes ciudad ni aldeanos: solo tu hueste. Cruza el mapa con Rodrigo vivo hasta llegar a las puertas de Zaragoza, en la esquina opuesta. Los jinetes de Sancho Ramírez de Aragón te siguen los pasos. Si te falta botín, el castillo de Castejón está mal guardado…`,
    history: `En 1079 Rodrigo fue a Sevilla a cobrar las parias de al-Mu'tamid y, en Cabra, derrotó a las tropas granadinas que acompañaban al conde castellano García Ordóñez, al que hizo prisionero. Aquello le ganó enemigos en la corte. En 1081, tras una cabalgada por tierras de Toledo, el rey lo desterró. El Cantar de mio Cid, compuesto hacia 1200, empieza precisamente aquí, con el héroe llorando al dejar Vivar: «De los sos ojos tan fuertemientre llorando…». En el poema, la mesnada toma por sorpresa Castejón y Alcocer para pagar a sus hombres. Tras ofrecerse sin éxito al conde de Barcelona, Rodrigo entró al servicio de al-Muqtadir de Zaragoza y, a su muerte, de su hijo al-Mu'tamin.`,
    setup: {mapType: 'rios', size: 76, start: 1, players: [
      {human: true, civ: 'castilla', name: 'Mesnada del Cid', team: 0, noBase: true, age: 2, res: {food: 0, wood: 0, stone: 0, gold: 0}, extra: [{u: 'rodrigo', hero: true}, {u: 'alvar', hero: true}, {u: 'caballero', n: 10}, {u: 'milicia', n: 6}, {u: 'arquero', n: 5}, {u: 'monje', n: 1}]},
      {civ: 'zaragoza', name: 'al-Mu\'tamin de Zaragoza', diff: 1, personality: 'defensivo', team: 0, age: 2, resMul: 1.5, passive: 99999},
      {civ: 'aragon', name: 'Sancho Ramírez de Aragón', diff: 2, personality: 'agresivo', team: 1, age: 2, resMul: 1.5, noBase: true},
      {civ: 'leon', name: 'Alcaide de Castejón', diff: 0, personality: 'defensivo', team: 2, age: 1, villagers: 4, scout: false, disabled: true, extra: [{b: 'torre', dx: -3, dy: 4}, {b: 'torre', dx: 5, dy: -2}, {u: 'milicia', n: 5}, {u: 'arquero', n: 3}]}]},
    objectives: [
      {id: 'arrive', text: 'Lleva a Rodrigo hasta el Centro urbano de Zaragoza', check: () => { const r = hero('rodrigo'), z = tcOf(1); return !!(r && z && distToEntity(r.x, r.y, z) < TILE * 5); }},
      {id: 'castejon', text: 'Saquea Castejón: destruye su Centro urbano (opcional, da botín)', check: () => !!G.flags.castejon, optional: true},
      {id: 'rodrigo', text: 'Rodrigo debe sobrevivir', check: () => false, fail: () => !!G.flags.dead_rodrigo, permanent: true},
    ],
    triggers: [
      {at: 1, action: () => { const z = tcOf(1); if (z) G.map.reveal(z.x / TILE, z.y / TILE, 7); const c = tcOf(3); if (c) { G.map.reveal(c.x / TILE, c.y / TILE, 6); G.flags.castejonId = c.id; } story('Rodrigo: «Aquí no dejamos nada. Álvar, cuenta los hombres: los que lleguen a Zaragoza serán mi nueva Castilla.»'); }},
      {at: 20, action: () => story('Consejo: sin Centro urbano no puedes entrenar. Cuida a cada hombre; el clérigo cura a los heridos si lo mantienes detrás. Rodrigo se regenera solo.')},
      {every: 130, from: 90, until: 9999, action: n => { const r = hero('rodrigo'); if (!r) return; const s = G.map.starts[0]; const p = {x: (s.x + 2) * TILE + rnd(-80, 80), y: (s.y + 2) * TILE + rnd(-80, 80)}; const types = ['caballero', 'caballero', 'explorador']; for (let k = 0; k < Math.min(5, n); k++) types.push(k % 2 ? 'almogavar' : 'caballero'); spawnGroup(2, types, p.x, p.y, {type: 'attackmove', x: r.x, y: r.y}); alertPlayer(HUMAN, p.x, p.y, 'Jinetes aragoneses en tu rastro'); }},
      {when: () => G.flags.castejonId && !G.byId[G.flags.castejonId], action: () => { G.flags.castejon = true; P(HUMAN).res.gold += 600; P(HUMAN).res.food += 600; story('¡Castejón saqueado! El botín se reparte entre la mesnada: +600 de oro y +600 de comida. «¡Aún no somos pobres!»'); sfx('coin'); }},
      {at: 400, action: () => story('Álvar Fáñez: «Señor, el Ebro no queda lejos. Los de Zaragoza tienen fama de pagar bien a quien sabe pelear.»')},
    ],
    outro: 'Al-Mu\'tamin recibe al Cid en Zaragoza con honores y sueldo. Durante cinco años, el caballero cristiano desterrado será el capitán más temido de la taifa. Allí le darán el nombre con que pasará a la historia: sidi, «mi señor». El Cid.',
  },
  {
    id: 'almenar', title: 'IV · Almenar, 1082', subtitle: 'Al servicio de Zaragoza contra Lérida y Barcelona',
    brief: `Al-Mu'tamin de Zaragoza está en guerra con su hermano al-Mundir, señor de Lérida, Tortosa y Denia, que ha comprado la ayuda del rey de Aragón y del conde Berenguer Ramón II de Barcelona. La coalición asedia Almenar. Tu señor te envía con la mesnada y las tropas zaragozanas a romper el cerco.\n\nLucha junto a tu aliado zaragozano. Elimina a la taifa de Lérida y captura al conde de Barcelona: cuando caiga en combate se considerará prisionero. Usa el mercado, investiga en la herrería y no dejes que las oleadas enemigas te pillen sin ejército.`,
    history: `Almenar (1082) fue la primera gran victoria del Cid como capitán independiente: derrotó a la coalición de al-Mundir de Lérida, Sancho Ramírez de Aragón y Berenguer Ramón II de Barcelona, y capturó al conde, al que liberó poco después. En 1090, en el pinar de Tévar, volvería a vencer y a apresar a Berenguer Ramón —llamado «el Fratricida» por la muerte de su hermano gemelo— a cambio de un rescate enorme. Aquellos años en el valle del Ebro forjaron su fama y su fortuna. Mientras tanto, en 1085, Alfonso VI tomaba Toledo, la vieja capital visigoda, y las taifas, aterradas, llamaban en su auxilio a los almorávides del norte de África.`,
    setup: {mapType: 'rios', size: 88, start: 1, players: [
      {human: true, civ: 'castilla', name: 'Mesnada del Cid', team: 0, age: 2, extra: [{u: 'rodrigo', hero: true}, {u: 'alvar', hero: true}, {u: 'caballero', n: 4}]},
      {civ: 'zaragoza', name: 'al-Mu\'tamin de Zaragoza', diff: 2, personality: 'economico', team: 0, age: 2},
      {civ: 'aragon', name: 'Berenguer Ramón II de Barcelona', diff: 2, personality: 'agresivo', team: 1, age: 2, resMul: 1.3, extra: [{u: 'berenguer', hero: true}, {u: 'caballero', n: 4}]},
      {civ: 'sevilla', name: 'al-Mundir de Lérida', diff: 2, personality: 'defensivo', team: 1, age: 2, resMul: 1.3, extra: [{b: 'torre', dx: -3, dy: 4}, {u: 'arquero', n: 6}]}]},
    objectives: [
      {id: 'lerida', text: 'Elimina a la taifa de Lérida', check: () => !P(3).alive},
      {id: 'conde', text: 'Captura al conde Berenguer Ramón II (derrótalo en combate)', check: () => !!G.flags.dead_berenguer},
      {id: 'zaragoza', text: 'Zaragoza debe sobrevivir', check: () => false, fail: () => !P(1).alive, permanent: true},
      {id: 'rodrigo', text: 'Rodrigo debe sobrevivir', check: () => false, fail: () => !!G.flags.dead_rodrigo, permanent: true},
    ],
    triggers: [
      {at: 2, action: () => { const b = hero('berenguer'); const tc = tcOf(2); if (b && tc) issue(b, {type: 'guard', tid: tc.id}); story('al-Mu\'tamin: «Mi hermano cree que el oro de Barcelona vale más que tu espada, Campeador. Demuéstrale que no.»'); }},
      {at: 40, action: () => story('Consejo: tus aliados comparten la visión contigo. Coordina los ataques con las oleadas zaragozanas y guarda asedio para las torres de Lérida.')},
      {when: () => G.flags.dead_berenguer, action: () => { story('El conde de Barcelona cae de su caballo y se rinde. Rodrigo lo trata con cortesía… y le fija un rescate de rey.'); P(HUMAN).res.gold += 1000; sfx('coin'); }},
      {when: () => !P(3).alive, action: () => story('Lérida se somete. Al-Mundir huye a Tortosa.')},
    ],
    outro: 'Almenar es una victoria completa. Berenguer Ramón II queda prisionero y es liberado tras jurar no volver contra Zaragoza (un juramento que romperá en Tévar, 1090, donde el Cid lo capturará de nuevo). Pero en 1086 llega la noticia que cambia el siglo: los almorávides han cruzado el Estrecho y han aplastado a Alfonso VI en Sagrajas.',
  },
  {
    id: 'valencia', title: 'V · Valencia, 1094', subtitle: 'El cerco de Valencia',
    brief: `Junio de 1094. Desde hace casi dos años el Cid mantiene cerco sobre Valencia, la ciudad más rica del Levante, donde el cadí Ibn Yahhaf gobierna desde que asesinó al rey al-Qadir. Las huertas están arrasadas, el hambre aprieta y una columna almorávide se acerca desde el sur para socorrer la ciudad.\n\nToma Valencia antes de que lleguen los almorávides: destruye el alcázar (castillo) y el Centro urbano de Ibn Yahhaf. Tienes treinta y cinco minutos. A partir del minuto veinte una columna almorávide hostigará tu campamento: prepárate para defenderlo mientras asedias.`,
    history: `Tras la derrota de Sagrajas (1086), Alfonso VI perdonó al Cid, pero un desencuentro en Aledo (1089) provocó un segundo destierro. Desde entonces Rodrigo actuó por cuenta propia en el Levante, cobrando parias a Valencia, Albarracín y Alpuente. Cuando en 1092 el cadí Ibn Yahhaf, con apoyo almorávide, asesinó al rey al-Qadir, el Cid puso cerco a la ciudad. El asedio duró casi veinte meses y el hambre llegó a extremos terribles. Valencia se rindió el 15 de junio de 1094 y Rodrigo se convirtió en su señor, con Jimena a su lado y el obispo francés Jerónimo de Périgord al frente de la nueva diócesis. Ibn Yahhaf fue ejecutado al año siguiente.`,
    setup: {mapType: 'praderas', size: 80, start: 1, players: [
      {human: true, civ: 'castilla', name: 'Hueste del Cid', team: 0, age: 2, res: {food: 1500, wood: 1500, stone: 700, gold: 1200}, villagers: 10, extra: [{u: 'rodrigo', hero: true}, {u: 'jimena', hero: true}, {u: 'alvar', hero: true}, {u: 'caballero_villano', n: 4}, {u: 'arquero', n: 4}]},
      {civ: 'sevilla', name: 'Ibn Yahhaf, cadí de Valencia', diff: 2, personality: 'defensivo', team: 1, age: 2, resMul: 1.6, fortress: true, extra: [{b: 'castillo', dx: 3, dy: 4}, {u: 'jinete_andalusi', n: 4}, {u: 'arquero', n: 6}]},
      {civ: 'almoravide', name: 'Columna almorávide', diff: 2, personality: 'agresivo', team: 1, noBase: true}]},
    objectives: [
      {id: 'alcazar', text: 'Destruye el alcázar de Valencia', check: () => G.flags.valenciaSpawned && !G.buildings.some(b => b.owner === 1 && b.type === 'castillo')},
      {id: 'tc', text: 'Destruye el Centro urbano de Ibn Yahhaf', check: () => G.flags.valenciaSpawned && !G.buildings.some(b => b.owner === 1 && b.type === 'centro')},
      {id: 'time', text: 'Antes de que el grueso almorávide llegue (35:00)', check: () => false, fail: () => G.time >= 2100, progress: () => fmtTime(Math.max(0, 2100 - G.time)) + ' restantes', permanent: true},
      {id: 'rodrigo', text: 'Rodrigo debe sobrevivir', check: () => false, fail: () => !!G.flags.dead_rodrigo, permanent: true},
    ],
    triggers: [
      {at: 1, action: () => { G.flags.valenciaSpawned = true; const c = G.buildings.find(b => b.owner === 1 && b.type === 'castillo'); if (c) G.map.reveal(c.x / TILE, c.y / TILE, 7); story('Rodrigo: «Veinte meses de cerco. Hoy se acaba: o entramos en Valencia o Valencia nos entierra.»'); }},
      {at: 30, action: () => story('Consejo: trabuquetes y arietes contra las murallas; caballería villana contra los arqueros. Jimena cura a los heridos si la mantienes cerca del frente.')},
      {every: 150, from: 1200, until: 9999, action: n => { const tc = humanTC(); if (!tc) return; const p = edgePoint(tc); const types = ['lamtuna', 'lamtuna', 'lamtuna', 'arquero', 'arquero']; for (let k = 0; k < Math.min(6, n * 2); k++) types.push(k % 3 ? 'lamtuna' : 'caballero'); spawnGroup(2, types, p.x, p.y, {type: 'attackmove', x: tc.x, y: tc.y}); alertPlayer(HUMAN, p.x, p.y, 'Tambores almorávides: columna a la vista'); }},
      {at: 1180, action: () => story('Se oyen tambores al sur. Una columna almorávide viene a romper el cerco: defiende el campamento sin aflojar el asedio.')},
      {at: 1800, action: () => story('Álvar Fáñez: «Señor, el grueso de Yusuf está a menos de cinco leguas. Es ahora o nunca.»')},
    ],
    outro: 'El 15 de junio de 1094 Valencia se rinde. Rodrigo entra en la ciudad como señor: no en nombre de Alfonso, ni de Zaragoza, sino en el suyo propio. Jimena y sus hijas se instalan en el alcázar y la mezquita mayor se convierte en catedral. Pero al sur, Yusuf ibn Tasufin ya reúne el ejército que debe recuperarla.',
  },
  {
    id: 'cuarte', title: 'VI · Cuarte, 1094', subtitle: 'Los almorávides ante Valencia',
    brief: `Octubre de 1094. Abu Bakr ibn Ibrahim, sobrino del emir Yusuf, ha plantado su campamento en Cuarte, a la vista de las murallas de Valencia, con el mayor ejército almorávide visto en el Levante. Dentro de la ciudad, el Cid tiene a Jimena, a Álvar Fáñez, a sus mesnadas y a una población que no sabe si el nuevo señor sabrá defenderla.\n\nResiste veinte minutos de asaltos: repara murallas, guarnece torres, usa el castillo. Cuando los almorávides se confíen, sal con todo y arrasa su campamento. Es la última crónica.`,
    history: `Yusuf ibn Tasufin envió a su sobrino Abu Bakr a recuperar Valencia. En octubre de 1094, en Cuarte (Quart de Poblet), el Cid rompió el cerco con una salida por sorpresa, atacando el campamento por dos lados, y puso en fuga a los almorávides: fue la primera victoria cristiana en campo abierto sobre el imperio norteafricano. En 1097 venció de nuevo en Bairén junto a Pedro I de Aragón. Rodrigo Díaz murió en Valencia el 10 de julio de 1099, probablemente de enfermedad. Jimena defendió la ciudad hasta 1102, cuando Alfonso VI la evacuó y la incendió antes de entregarla a los almorávides. El cuerpo del Cid fue llevado al monasterio de San Pedro de Cardeña y hoy descansa, junto a Jimena, en la catedral de Burgos.`,
    setup: {mapType: 'fortaleza', size: 76, start: 2, players: [
      {human: true, civ: 'castilla', name: 'Valencia del Cid', team: 0, age: 3, res: {food: 2500, wood: 2500, stone: 1200, gold: 2000}, villagers: 12, extra: [{b: 'castillo', dx: 3, dy: 4}, {u: 'rodrigo', hero: true}, {u: 'jimena', hero: true}, {u: 'alvar', hero: true}, {u: 'caballero_villano', n: 6}, {u: 'arquero', n: 10}, {u: 'milicia', n: 6}]},
      {civ: 'almoravide', name: 'Abu Bakr ibn Ibrahim', diff: 2, personality: 'agresivo', team: 1, age: 3, resMul: 1.6, noWalls: true, extra: [{u: 'abubakr', hero: true}, {u: 'lamtuna', n: 8}]}]},
    objectives: [
      {id: 'survive', text: 'Resiste los asaltos hasta el minuto 20', check: () => G.time >= 1200, progress: () => fmtTime(Math.max(0, 1200 - G.time)) + ' restantes'},
      {id: 'camp', text: 'Sal de la ciudad y arrasa el campamento almorávide (su Centro urbano)', check: () => G.flags.cuarteSpawned && !G.buildings.some(b => b.owner === 1 && b.type === 'centro'), after: 'survive'},
      {id: 'castle', text: 'El castillo de Valencia debe resistir', check: () => false, fail: () => !G.buildings.some(b => b.owner === HUMAN && b.type === 'castillo'), permanent: true},
      {id: 'rodrigo', text: 'Rodrigo debe sobrevivir', check: () => false, fail: () => !!G.flags.dead_rodrigo, permanent: true},
    ],
    triggers: [
      {at: 1, action: () => { G.flags.cuarteSpawned = true; P(1).ai.firstAttack = 120; P(1).ai.nextAttack = 120; P(1).ai.waveGap = 90; const y = hero('abubakr'); const tc = tcOf(1); if (y && tc) issue(y, {type: 'guard', tid: tc.id}); story('Rodrigo: «Miradlos bien. Son muchos, y traen tambores. Pero no saben lo que es esta ciudad cuando la defienden los que la conquistaron.»'); }},
      {at: 25, action: () => story('Consejo: guarnece arqueros en las torres y el castillo (G). Cierra las puertas. Repara con los aldeanos entre asalto y asalto.')},
      {every: 150, from: 90, until: 1150, action: n => { const tc = humanTC(); const e = tcOf(1); if (!tc || !e) return; const types = ['lamtuna', 'lamtuna', 'lamtuna', 'ballestero', 'ballestero']; for (let k = 0; k < Math.min(8, n + 1); k++) types.push(k % 3 === 0 ? 'caballero' : k % 3 === 1 ? 'lamtuna' : 'ballestero'); if (n >= 3) types.push('ariete', 'ariete'); if (n >= 6) types.push('catapulta'); spawnGroup(1, types, e.x, e.y, {type: 'attackmove', x: tc.x, y: tc.y}); alertPlayer(HUMAN, e.x, e.y, 'Tambores: asalto almorávide'); }},
      {at: 600, action: () => story('Jimena: «Las mujeres de Valencia miran desde las torres, Rodrigo. Que vean cómo se gana el pan en esta tierra.»')},
      {at: 1200, action: () => { story('Los almorávides se han confiado: sus columnas están dispersas. Rodrigo: «¡Álvar, por la puerta del norte con los jinetes! ¡Yo salgo por la del sur! ¡Santiago y a ellos!»'); sfx('fanfare'); const g = spawnGroup(HUMAN, ['caballero', 'caballero', 'caballero', 'caballero', 'caballero', 'caballero'], humanTC().x, humanTC().y); }},
    ],
    outro: 'El campamento de Cuarte arde y los almorávides huyen hacia el sur dejando un botín inmenso. Es la primera vez que un ejército cristiano vence a los almorávides en campo abierto.\n\nRodrigo Díaz gobernó Valencia cinco años más. Murió el 10 de julio de 1099. Jimena sostuvo la ciudad hasta 1102; Alfonso VI la evacuó, la incendió y se llevó el cuerpo del Cid a Cardeña. Valencia no volvería a ser cristiana hasta 1238, con Jaime I. Zaragoza cayó en 1118, Sevilla en 1248, Granada en 1492. Ocho siglos de guerras, parias, alianzas y matrimonios entre cristianos y musulmanes forjaron los reinos que serían España. Y en el centro de esa memoria, un caballero de Vivar desterrado dos veces por su rey, que conquistó una ciudad para sí mismo, y del que un juglar escribió: «¡Dios, qué buen vasallo, si hubiese buen señor!».',
  },
];
function campaignProgress() { try { return JSON.parse(localStorage.getItem('cid-campaign') || '{"unlocked":1,"done":[]}'); } catch (e) { return {unlocked: 1, done: []}; } }
function saveCampaignProgress(p) { try { localStorage.setItem('cid-campaign', JSON.stringify(p)); } catch (e) {} }
function setupMission(mi) {
  const m = MISSIONS[mi];
  G.mission = {index: mi, def: m, done: {}, failed: false, triggered: new Set(), everyCount: {}, noWonder: !!m.setup.noWonder};
  m.setup.players.forEach((pd, i) => { const pl = P(i); if (pl.ai) { if (pd.passive) pl.ai.passiveUntil = pd.passive; if (pd.disabled) pl.ai.disabled = true; } });
  const tc = humanTC(); if (tc) G.map.reveal(tc.x / TILE, tc.y / TILE, 12);
}
function objectiveActive(o) { if (!o.after) return true; return !!G.mission.done[o.after]; }
function updateMission(dt) {
  const M = G.mission, def = M.def;
  for (const o of def.objectives) {
    if (M.done[o.id] || !objectiveActive(o)) continue;
    if (o.fail && o.fail()) { M.failed = o.id; endGame(false, `Objetivo fallido: ${o.text}.`); return; }
    if (!o.permanent && o.check()) { M.done[o.id] = true; G.flags['done_' + o.id] = true; log('Objetivo cumplido: ' + o.text, 'good'); sfx('fanfare2'); }
  }
  for (const t of def.triggers) {
    const key = def.triggers.indexOf(t);
    if (t.every) { const n = M.everyCount[key] || 0; const next = t.from + n * t.every; if (G.time >= next && G.time <= t.until) { M.everyCount[key] = n + 1; t.action(n + 1); } continue; }
    if (M.triggered.has(key)) continue;
    if ((t.at !== undefined && G.time >= t.at) || (t.when && t.when())) { M.triggered.add(key); t.action(); }
  }
  const allDone = def.objectives.filter(o => !o.permanent && !o.optional).every(o => M.done[o.id]);
  if (allDone) { const prog = campaignProgress(); if (!prog.done.includes(M.index)) prog.done.push(M.index); prog.unlocked = Math.max(prog.unlocked, M.index + 2); saveCampaignProgress(prog); endGame(true, def.outro); return; }
  if (!P(HUMAN).alive) endGame(false, 'La hueste ha sido aniquilada. La crónica termina aquí.');
}
function renderObjectives() {
  const M = G.mission; const el = $('#objectives'); el.style.display = 'block';
  if (UI.objCollapsed) { $('#objList').innerHTML = ''; $('#objToggle').textContent = '+'; return; }
  $('#objToggle').textContent = '–';
  const html = M.def.objectives.filter(o => objectiveActive(o) || M.done[o.id]).map(o => { const done = M.done[o.id]; const p = o.progress && !done ? ` <span style="color:var(--accent)">${o.progress()}</span>` : ''; return `<div class="ob ${done ? 'done' : ''}"><i>${done ? '✔' : o.permanent ? '⚑' : o.optional ? '◇' : '◆'}</i><span>${o.text}${p}</span></div>`; }).join('');
  if ($('#objList').innerHTML !== html) $('#objList').innerHTML = html;
}
