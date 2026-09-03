'use strict';
// Módulo de datos: reinos, unidades, edificios y tecnologías
// ============================================================ DATOS
const TILE = 32;
const AGES = ['Época de las Aldeas', 'Época de los Condados', 'Época de los Castillos', 'Época de los Reinos'];
const AGE_COST = [null, {food: 500}, {food: 800, gold: 200}, {food: 1000, gold: 800}];
const AGE_TIME = [0, 60, 90, 120];
const AGE_REQ = [0, 2, 3, 4]; // tipos de edificio distintos necesarios
const RES = ['food', 'wood', 'stone', 'gold'];
const RES_ES = {food: 'Comida', wood: 'Madera', stone: 'Piedra', gold: 'Oro'};
const HUMAN = 0;
const PCOLORS = ['#3f8cff', '#e0483f', '#5fbf6a', '#f0c94a'];
const PDARK = ['#1d4f9c', '#8c2721', '#2f7a3a', '#9a7a1a'];
const PNAMES = ['Azul', 'Rojo', 'Verde', 'Amarillo'];
const MAX_POP = 200;
const WONDER_TIME = 420;

// Terreno
const T_GRASS = 0, T_WATER = 1, T_TREE = 2, T_BERRY = 3, T_STONE = 4, T_GOLD = 5, T_FARM = 6, T_SAND = 7, T_DIRT = 8, T_FLOWER = 9, T_SHALLOW = 10;
const RES_OF_TILE = {2: 'wood', 3: 'food', 4: 'stone', 5: 'gold', 6: 'food'};
const TILE_AMOUNT = {2: 120, 3: 150, 4: 350, 5: 400};

// ------------------------------------------------------------ Civilizaciones
const CIVS = {
  castilla: {style: 'cristiano', name: 'Castilla', leader: 'Alfonso VI', title: 'Los caballeros de Burgos', desc: 'Reino de frontera, tierra de castillos y de mesnadas a caballo. La patria del Cid.',
    bonuses: ['La caballería pesada cuesta un 15% menos', 'Los aldeanos recolectan comida un 10% más rápido', 'El Centro urbano dispara +2 flechas', 'Unidad única: Caballero villano (caballería media y rápida)'],
    fx: {unitCost: {cab: 0.85}, gather: {food: 0.1}, tcArrows: 2}, unique: 'caballero_villano'},
  leon: {style: 'cristiano', name: 'León', leader: 'Urraca de Zamora', title: 'El viejo reino', desc: 'Heredero del reino astur. Murallas romanas, fueros antiguos e infantería orgullosa.',
    bonuses: ['Los edificios tienen +25% de vida', 'Piedra y oro se extraen un 20% más rápido', 'Torres, murallas y castillos cuestan un 20% menos', 'Unidad única: Infanzón (infantería pesada)'],
    fx: {bldHp: 0.25, gather: {stone: 0.2, gold: 0.2}, bldCost: {torre: 0.8, castillo: 0.8, muralla: 0.8}}, unique: 'infanzon'},
  aragon: {style: 'cristiano', name: 'Aragón y Navarra', leader: 'Sancho Ramírez', title: 'Los reinos del Pirineo', desc: 'Montañeses, cazadores y guerreros ligeros de los valles pirenaicos.',
    bonuses: ['Los aldeanos cortan madera un 20% más rápido', 'Los arqueros tienen +1 de alcance', 'La Arquería y el Aserradero cuestan la mitad', 'Unidad única: Almogávar (infantería ligera y veloz)'],
    fx: {gather: {wood: 0.2}, rangeBonus: 1, bldCost: {arqueria: 0.5, aserradero: 0.5}}, unique: 'almogavar'},
  zaragoza: {style: 'andalusi', name: 'Taifa de Zaragoza', leader: 'al-Muqtadir', title: 'La corte de los sabios', desc: 'Los Banu Hud gobiernan la taifa más culta del norte: matemáticos, poetas y arqueros.',
    bonuses: ['Las tecnologías cuestan un 20% menos', 'El mercado ofrece mejores precios', 'Empiezas con +100 de oro', 'Unidad única: Arquero de Saraqusta (arquero de élite)'],
    fx: {techDiscount: 0.2, marketRate: 0.5, startRes: {gold: 100}}, unique: 'arquero_saraqusta'},
  sevilla: {style: 'andalusi', name: 'Taifa de Sevilla', leader: 'al-Mu\'tamid', title: 'El jardín de al-Ándalus', desc: 'La taifa más rica y refinada. Oro, huertas y jinetes ligeros.',
    bonuses: ['Las granjas cuestan un 30% menos', 'Las reliquias producen el doble de oro', 'Los monjes convierten más rápido', 'Unidad única: Jinete andalusí (caballería ligera rapidísima)'],
    fx: {farmCost: 0.7, relicGold: 2, convertMul: 0.75}, unique: 'jinete_andalusi'},
  almoravide: {style: 'almoravide', name: 'Almorávides', leader: 'Yusuf ibn Tasufin', title: 'Los guerreros del velo', desc: 'Llegados del Sáhara, sus columnas de infantería avanzan al son de los tambores.',
    bonuses: ['La infantería cuesta un 20% menos', 'La infantería es un 10% más rápida', 'Las unidades se regeneran lentamente', 'Unidad única: Lamtuna (infantería del desierto)'],
    fx: {unitCost: {inf: 0.8}, spd: {inf: 0.1}, regen: 0.3}, unique: 'lamtuna'},
};
const CIV_LIST = Object.keys(CIVS);

// ------------------------------------------------------------ Unidades
// atk: daño, rng: alcance en tiles (0 = cuerpo a cuerpo), cd: s entre golpes, arm: [melee, perforante], bonus: {clase: x}
const UNITS = {
  aldeano:   {name: 'Aldeano', cls: 'ald', hp: 30, atk: 3, rng: 0, cd: 1.2, arm: [0, 0], spd: 68, los: 5, cost: {food: 50}, time: 14, age: 0, key: 'A', desc: 'Recolecta, construye y repara. La base de todo.'},
  milicia:   {name: 'Peón', cls: 'inf', hp: 45, atk: 5, rng: 0, cd: 1.0, arm: [1, 0], spd: 66, los: 5, cost: {food: 60, wood: 20}, time: 16, age: 0, key: 'M', line: 'milicia', desc: 'Infantería de mesnada, barata y disponible desde el principio.'},
  espada:    {name: 'Espadachín', cls: 'inf', hp: 60, atk: 9, rng: 0, cd: 1.0, arm: [1, 1], spd: 66, los: 5, cost: {food: 60, wood: 20}, time: 16, age: 2, key: 'M', line: 'milicia', desc: 'Infantería pesada con loriga y escudo.'},
  campeon:   {name: 'Adalid', cls: 'inf', hp: 80, atk: 13, rng: 0, cd: 1.0, arm: [2, 2], spd: 68, los: 5, cost: {food: 60, wood: 20}, time: 16, age: 3, key: 'M', line: 'milicia', desc: 'La élite de la infantería: jefes de hueste curtidos en la frontera.'},
  lancero:   {name: 'Lancero', cls: 'inf', hp: 50, atk: 4, rng: 0, cd: 1.0, arm: [0, 0], spd: 70, los: 5, cost: {food: 35, wood: 25}, time: 14, age: 1, key: 'L', line: 'lancero', bonus: {cab: 4}, desc: 'Barato y letal contra la caballería.'},
  piquero:   {name: 'Piquero', cls: 'inf', hp: 60, atk: 5, rng: 0, cd: 1.0, arm: [0, 0], spd: 70, los: 5, cost: {food: 35, wood: 25}, time: 14, age: 2, key: 'L', line: 'lancero', bonus: {cab: 5}, desc: 'Lancero mejorado.'},
  alabardero:{name: 'Alabardero', cls: 'inf', hp: 70, atk: 6, rng: 0, cd: 1.0, arm: [0, 0], spd: 70, los: 5, cost: {food: 35, wood: 25}, time: 14, age: 3, key: 'L', line: 'lancero', bonus: {cab: 6}, desc: 'Pesadilla de la caballería pesada.'},
  arquero:   {name: 'Arquero', cls: 'arc', hp: 35, atk: 5, rng: 4.5, cd: 1.3, arm: [0, 0], spd: 66, los: 6.5, cost: {wood: 30, gold: 35}, time: 17, age: 1, key: 'R', line: 'arquero', desc: 'Dispara a distancia. Frágil en cuerpo a cuerpo.'},
  ballestero:{name: 'Ballestero', cls: 'arc', hp: 45, atk: 8, rng: 5, cd: 1.3, arm: [0, 1], spd: 66, los: 7, cost: {wood: 30, gold: 35}, time: 17, age: 2, key: 'R', line: 'arquero', desc: 'Mayor alcance y potencia que el arquero.'},
  arbalestero:{name: 'Arbalestero', cls: 'arc', hp: 50, atk: 11, rng: 5.5, cd: 1.6, arm: [1, 1], spd: 64, los: 7.5, cost: {wood: 30, gold: 35}, time: 17, age: 3, key: 'R', line: 'arquero', bonus: {inf: 1.3}, desc: 'Ballesta pesada de torno: lenta, pero atraviesa cualquier armadura.'},
  explorador:{name: 'Explorador', cls: 'cab', hp: 45, atk: 3, rng: 0, cd: 1.0, arm: [0, 1], spd: 120, los: 8, cost: {food: 60}, time: 14, age: 0, key: 'X', line: 'explorador', desc: 'Rapidísimo. Ideal para explorar el mapa.'},
  jinete:    {name: 'Caballería ligera', cls: 'cab', hp: 70, atk: 7, rng: 0, cd: 1.0, arm: [0, 2], spd: 120, los: 8, cost: {food: 60}, time: 14, age: 2, key: 'X', line: 'explorador', bonus: {mnk: 3, sit: 1.5}, desc: 'Rápida y resistente a las flechas; caza monjes y asedio.'},
  caballero: {name: 'Caballero', cls: 'cab', hp: 100, atk: 10, rng: 0, cd: 1.1, arm: [2, 2], spd: 100, los: 5, cost: {food: 60, gold: 75}, time: 22, age: 2, key: 'K', line: 'caballero', desc: 'Caballería pesada. Rápida y contundente.'},
  paladin:   {name: 'Caballero pesado', cls: 'cab', hp: 150, atk: 14, rng: 0, cd: 1.1, arm: [3, 3], spd: 100, los: 5, cost: {food: 60, gold: 75}, time: 22, age: 3, key: 'K', line: 'caballero', desc: 'Loriga completa, lanza y caballo de guerra: la cima de la caballería.'},
  catapulta: {name: 'Catapulta', cls: 'sit', hp: 60, atk: 35, rng: 5.5, cd: 4.0, arm: [0, 5], spd: 46, los: 6, cost: {wood: 160, gold: 120}, time: 34, age: 2, key: 'T', line: 'catapulta', bonus: {bld: 3}, splash: 1, minRng: 1.5, desc: 'Máquina de asedio. Demoledora contra edificios; daño en área.'},
  trabuco:   {name: 'Trabuquete', cls: 'sit', hp: 90, atk: 70, rng: 7, cd: 6.0, arm: [1, 6], spd: 34, los: 8, cost: {wood: 160, gold: 120}, time: 34, age: 3, key: 'T', line: 'catapulta', bonus: {bld: 4}, splash: 1.5, minRng: 2.5, desc: 'Derriba murallas y castillos desde lejos.'},
  ariete:    {name: 'Ariete', cls: 'sit', hp: 180, atk: 4, rng: 0, cd: 2.5, arm: [-2, 12], spd: 40, los: 3, cost: {wood: 160, gold: 60}, time: 30, age: 2, key: 'I', bonus: {bld: 30}, desc: 'Casi inmune a las flechas. Solo sirve contra edificios.'},
  monje:     {name: 'Monje', cls: 'mnk', hp: 35, atk: 0, rng: 0, cd: 1, arm: [0, 0], spd: 60, los: 8, cost: {gold: 100}, time: 30, age: 2, key: 'O', desc: 'Clérigo o alfaquí: cura aliados, convierte enemigos y recoge reliquias.'},
  // únicas
  caballero_villano:{name: 'Caballero villano', cls: 'cab', hp: 85, atk: 10, rng: 0, cd: 1.0, arm: [1, 2], spd: 118, los: 6, cost: {food: 60, gold: 45}, time: 18, age: 2, key: 'U', unique: 'castilla', bonus: {arc: 1.5}, desc: 'Caballería media de Castilla: labradores con caballo y lanza. Rápida y letal contra arqueros.'},
  infanzon:  {name: 'Infanzón', cls: 'inf', hp: 95, atk: 12, rng: 0, cd: 1.0, arm: [2, 2], spd: 68, los: 5, cost: {food: 70, gold: 40}, time: 18, age: 2, key: 'U', unique: 'leon', desc: 'Hidalgo leonés con loriga y espada. Infantería pesada de primera línea.'},
  almogavar: {name: 'Almogávar', cls: 'inf', hp: 70, atk: 11, rng: 0, cd: 0.9, arm: [0, 1], spd: 86, los: 6, cost: {food: 55, gold: 35}, time: 15, age: 2, key: 'U', unique: 'aragon', bonus: {cab: 2}, desc: 'Infantería ligera de montaña. Rapidísima y temible contra la caballería.'},
  arquero_saraqusta:{name: 'Arquero de Saraqusta', cls: 'arc', hp: 45, atk: 8, rng: 5.5, cd: 1.3, arm: [0, 1], spd: 70, los: 7.5, cost: {wood: 35, gold: 45}, time: 18, age: 2, key: 'U', unique: 'zaragoza', desc: 'Arquero de élite de Zaragoza con arco compuesto.'},
  jinete_andalusi:{name: 'Jinete andalusí', cls: 'cab', hp: 80, atk: 10, rng: 0, cd: 1.0, arm: [1, 2], spd: 135, los: 7, cost: {food: 60, gold: 55}, time: 18, age: 2, key: 'U', unique: 'sevilla', bonus: {sit: 2, mnk: 2}, desc: 'Caballería ligera de al-Ándalus. Nada la alcanza; caza asedio y clérigos.'},
  lamtuna:   {name: 'Lamtuna', cls: 'inf', hp: 85, atk: 12, rng: 0, cd: 1.0, arm: [1, 1], spd: 74, los: 5, cost: {food: 55, gold: 35}, time: 16, age: 2, key: 'U', unique: 'almoravide', bonus: {cab: 1.5}, desc: 'Infantería velada del Sáhara con lanza larga y escudo de cuero.'},
  // héroes (campaña)
  rodrigo:   {name: 'Rodrigo Díaz, el Cid', cls: 'cab', hp: 380, atk: 20, rng: 0, cd: 0.9, arm: [4, 4], spd: 104, los: 8, cost: {}, time: 0, age: 0, hero: true, regen: 1.5, desc: 'El Campeador sobre Babieca, con Tizona en la mano. Se regenera y no puede ser convertido. Si cae, la crónica termina.'},
  alvar:     {name: 'Álvar Fáñez, Minaya', cls: 'cab', hp: 280, atk: 16, rng: 0, cd: 1.0, arm: [3, 3], spd: 102, los: 7, cost: {}, time: 0, age: 0, hero: true, regen: 1.2, desc: 'El brazo derecho del Cid.'},
  jimena:    {name: 'Doña Jimena', cls: 'mnk', hp: 140, atk: 0, rng: 0, cd: 1, arm: [2, 2], spd: 66, los: 8, cost: {}, time: 0, age: 0, hero: true, regen: 1, desc: 'Señora de Valencia. Cura a los suyos y sostiene la ciudad.'},
  sancho:    {name: 'Sancho II de Castilla', cls: 'cab', hp: 300, atk: 17, rng: 0, cd: 1.0, arm: [3, 3], spd: 100, los: 7, cost: {}, time: 0, age: 0, hero: true, regen: 1, desc: 'El rey de Castilla, señor del Cid.'},
  vellido:   {name: 'Vellido Dolfos', cls: 'cab', hp: 160, atk: 12, rng: 0, cd: 1.0, arm: [1, 2], spd: 128, los: 7, cost: {}, time: 0, age: 0, hero: true, desc: 'El traidor de Zamora. Huye hacia las murallas.'},
  berenguer: {name: 'Berenguer Ramón II', cls: 'cab', hp: 320, atk: 18, rng: 0, cd: 1.0, arm: [3, 3], spd: 100, los: 7, cost: {}, time: 0, age: 0, hero: true, regen: 1, desc: 'Conde de Barcelona, «el Fratricida».'},
  abubakr:   {name: 'Abu Bakr ibn Ibrahim', cls: 'cab', hp: 360, atk: 18, rng: 0, cd: 1.0, arm: [4, 4], spd: 100, los: 8, cost: {}, time: 0, age: 0, hero: true, regen: 1.2, desc: 'Sobrino de Yusuf y general de los almorávides en Cuarte.'},
  yusuf:     {name: 'Yusuf ibn Tasufin', cls: 'cab', hp: 420, atk: 20, rng: 0, cd: 1.0, arm: [4, 5], spd: 100, los: 8, cost: {}, time: 0, age: 0, hero: true, regen: 1.5, desc: 'Emir de los almorávides.'},
};
const LINES = {milicia: ['milicia', 'espada', 'campeon'], lancero: ['lancero', 'piquero', 'alabardero'], arquero: ['arquero', 'ballestero', 'arbalestero'], explorador: ['explorador', 'jinete'], caballero: ['caballero', 'paladin'], catapulta: ['catapulta', 'trabuco']};
const CLS_ES = {ald: 'Aldeano', inf: 'Infantería', arc: 'A distancia', cab: 'Caballería', sit: 'Asedio', mnk: 'Monje'};

// ------------------------------------------------------------ Edificios
const BUILDINGS = {
  centro:    {name: 'Centro urbano', w: 3, h: 3, hp: 1800, arm: [3, 5], cost: {wood: 300, stone: 100}, time: 80, age: 0, pop: 5, drop: ['food', 'wood', 'stone', 'gold'], trains: ['aldeano'], techs: ['telar', 'campana'], atk: 6, rng: 6, los: 8, garrison: 15, key: 'N', desc: 'Corazón de tu villa. Entrena aldeanos, almacena recursos y permite avanzar de época. Guarnece hasta 15 unidades.'},
  casa:      {name: 'Casa', w: 2, h: 2, hp: 250, arm: [0, 5], cost: {wood: 30}, time: 20, age: 0, pop: 5, key: 'C', desc: '+5 de población.'},
  molino:    {name: 'Molino', w: 2, h: 2, hp: 400, arm: [0, 5], cost: {wood: 100}, time: 25, age: 0, drop: ['food'], techs: ['cosecha'], key: 'M', desc: 'Almacén de comida. Constrúyelo junto a bayas o granjas.'},
  aserradero:{name: 'Aserradero', w: 2, h: 2, hp: 400, arm: [0, 5], cost: {wood: 100}, time: 25, age: 0, drop: ['wood'], techs: ['hacha'], key: 'S', desc: 'Almacén de madera. Constrúyelo junto al bosque.'},
  mina:      {name: 'Campamento minero', w: 2, h: 2, hp: 400, arm: [0, 5], cost: {wood: 100}, time: 25, age: 0, drop: ['stone', 'gold'], techs: ['pico'], key: 'I', desc: 'Almacén de piedra y oro.'},
  granja:    {name: 'Granja', w: 2, h: 2, hp: 300, arm: [0, 5], cost: {wood: 60}, time: 12, age: 0, farm: true, key: 'G', desc: 'Comida infinita pero lenta. Necesita molino o centro cerca.'},
  cuartel:   {name: 'Cuartel', w: 3, h: 3, hp: 1000, arm: [1, 5], cost: {wood: 175}, time: 40, age: 0, trains: ['milicia', 'lancero'], techs: ['l_espada', 'l_campeon', 'l_piquero', 'l_alabardero'], garrison: 8, key: 'B', desc: 'Entrena infantería.'},
  arqueria:  {name: 'Arquería', w: 3, h: 3, hp: 900, arm: [1, 5], cost: {wood: 175}, time: 40, age: 1, trains: ['arquero'], techs: ['l_ballestero', 'l_arbalestero'], garrison: 8, key: 'A', desc: 'Entrena unidades a distancia.'},
  establo:   {name: 'Establo', w: 3, h: 3, hp: 1000, arm: [1, 5], cost: {wood: 175}, time: 40, age: 1, trains: ['explorador', 'caballero'], techs: ['l_jinete', 'l_paladin'], garrison: 8, key: 'E', desc: 'Entrena caballería.'},
  taller:    {name: 'Taller de asedio', w: 3, h: 3, hp: 1000, arm: [2, 5], cost: {wood: 200, stone: 50}, time: 45, age: 2, trains: ['ariete', 'catapulta'], techs: ['l_trabuco'], key: 'T', desc: 'Construye máquinas de asedio.'},
  herreria:  {name: 'Herrería', w: 2, h: 2, hp: 700, arm: [1, 5], cost: {wood: 150}, time: 35, age: 1, techs: ['forja', 'armadura', 'flechas', 'forja2', 'armadura2', 'flechas2', 'forja3', 'armadura3', 'flechas3'], key: 'H', desc: 'Mejoras de ataque y armadura.'},
  mercado:   {name: 'Mercado', w: 3, h: 3, hp: 800, arm: [1, 5], cost: {wood: 175}, time: 40, age: 1, market: true, techs: ['gremio'], key: 'D', desc: 'Compra y vende recursos. Los precios cambian con cada operación.'},
  monasterio:{name: 'Monasterio', w: 3, h: 3, hp: 900, arm: [1, 5], cost: {wood: 175}, time: 40, age: 2, trains: ['monje'], techs: ['fervor', 'sanacion', 'fe'], relics: true, key: 'O', desc: 'Monasterio o mezquita: entrena clérigos y guarda reliquias, que generan oro.'},
  universidad:{name: 'Escuela de sabios', w: 3, h: 3, hp: 900, arm: [1, 5], cost: {wood: 200, stone: 50}, time: 50, age: 2, techs: ['carretilla', 'balistica', 'mamposteria', 'quimica', 'arquitectura'], key: 'U', desc: 'Mejoras económicas y defensivas.'},
  torre:     {name: 'Torre de vigía', w: 1, h: 1, hp: 550, arm: [1, 8], cost: {wood: 50, stone: 100}, time: 30, age: 1, atk: 7, rng: 6, los: 8, garrison: 5, key: 'V', desc: 'Defensa a distancia. Guarnece 5 unidades: cada arquero o aldeano añade una flecha.'},
  muralla:   {name: 'Muralla', w: 1, h: 1, hp: 900, arm: [4, 12], cost: {stone: 6}, time: 6, age: 1, wall: true, key: 'W', desc: 'Bloquea el paso. Arrastra para levantar tramos largos.'},
  puerta:    {name: 'Puerta', w: 1, h: 1, hp: 1100, arm: [4, 12], cost: {stone: 30}, time: 12, age: 1, gate: true, key: 'P', desc: 'Tramo de muralla que deja pasar a tus aliados. Puede cerrarse.'},
  castillo:  {name: 'Castillo', w: 4, h: 4, hp: 3500, arm: [6, 10], cost: {stone: 650}, time: 120, age: 2, pop: 20, atk: 12, rng: 7.5, los: 10, multi: 4, garrison: 20, trains: ['UNIQUE'], techs: ['conscripcion', 'espionaje'], key: 'K', desc: 'Castillo o alcázar. +20 de población, lluvia de flechas y entrena la unidad única de tu reino.'},
  maravilla: {name: 'Catedral', w: 5, h: 5, hp: 4800, arm: [5, 10], cost: {wood: 1000, stone: 1000, gold: 1000}, time: 300, age: 3, wonder: true, key: 'Y', desc: 'Catedral o gran mezquita. Si sobrevive ' + Math.round(WONDER_TIME / 60) + ' minutos tras terminarse, ganas la partida.'},
};

// ------------------------------------------------------------ Tecnologías
const TECHS = {
  forja:     {name: 'Forja', cost: {food: 150}, time: 30, age: 1, desc: '+1 ataque cuerpo a cuerpo.', fx: {meleeAtk: 1}},
  armadura:  {name: 'Cota de escamas', cost: {food: 100, gold: 50}, time: 30, age: 1, desc: '+1/+1 armadura para infantería y caballería.', fx: {meleeArm: 1}},
  flechas:   {name: 'Flechas emplumadas', cost: {wood: 100, gold: 50}, time: 30, age: 1, desc: '+1 ataque y +0.5 alcance a distancia (también torres).', fx: {rangeAtk: 1, range: 0.5}},
  forja2:    {name: 'Acero templado', cost: {food: 220, gold: 120}, time: 50, age: 2, req: 'forja', desc: '+2 ataque cuerpo a cuerpo.', fx: {meleeAtk: 2}},
  armadura2: {name: 'Cota de placas', cost: {food: 200, gold: 150}, time: 50, age: 2, req: 'armadura', desc: '+2/+2 armadura para infantería y caballería.', fx: {meleeArm: 2}},
  flechas2:  {name: 'Puntas de acero', cost: {wood: 200, gold: 150}, time: 50, age: 2, req: 'flechas', desc: '+2 ataque a distancia y +0.5 alcance.', fx: {rangeAtk: 2, range: 0.5}},
  forja3:    {name: 'Espadas de acero', cost: {food: 350, gold: 250}, time: 70, age: 3, req: 'forja2', desc: '+3 ataque cuerpo a cuerpo.', fx: {meleeAtk: 3}},
  armadura3: {name: 'Armadura completa', cost: {food: 300, gold: 250}, time: 70, age: 3, req: 'armadura2', desc: '+3/+3 armadura para infantería y caballería.', fx: {meleeArm: 3}},
  flechas3:  {name: 'Saetas de acero', cost: {wood: 300, gold: 250}, time: 70, age: 3, req: 'flechas2', desc: '+3 ataque a distancia y +0.5 alcance.', fx: {rangeAtk: 3, range: 0.5}},
  carretilla:{name: 'Carretilla', cost: {food: 175, wood: 50}, time: 45, age: 2, desc: 'Los aldeanos recolectan un 20% más rápido y cargan 3 más.', fx: {gather: 0.2, carry: 3}},
  balistica: {name: 'Balística', cost: {wood: 200, gold: 150}, time: 45, age: 2, desc: 'Torres, castillos y centros disparan un 50% más rápido.', fx: {towerRate: 0.5}},
  mamposteria:{name: 'Mampostería', cost: {wood: 150, stone: 150}, time: 50, age: 2, desc: 'Los edificios tienen un 20% más de vida y +2 armadura.', fx: {bldHp: 0.2, bldArm: 2}},
  quimica:   {name: 'Ingenieros de asedio', cost: {food: 300, gold: 200}, time: 60, age: 3, desc: '+1 ataque a todas las unidades a distancia y +5 al asedio.', fx: {rangeAtk: 1, siegeAtk: 5}},
  arquitectura:{name: 'Arquitectura', cost: {wood: 300, stone: 200}, time: 60, age: 3, req: 'mamposteria', desc: 'Otro +20% de vida y +2 armadura para los edificios.', fx: {bldHp: 0.2, bldArm: 2}},
  cosecha:   {name: 'Rotación de cultivos', cost: {food: 100, wood: 100}, time: 40, age: 1, desc: 'Las granjas producen un 40% más rápido.', fx: {farm: 0.4}},
  hacha:     {name: 'Hacha de doble filo', cost: {food: 100, wood: 50}, time: 35, age: 1, desc: 'La madera se corta un 25% más rápido.', fx: {gatherWood: 0.25}},
  pico:      {name: 'Pico de acero', cost: {food: 100, wood: 75}, time: 35, age: 1, desc: 'Piedra y oro se extraen un 25% más rápido.', fx: {gatherMine: 0.25}},
  telar:     {name: 'Telar', cost: {gold: 50}, time: 25, age: 0, desc: 'Los aldeanos ganan +15 de vida y +1/+1 de armadura.', fx: {villHp: 15, villArm: 1}},
  campana:   {name: 'Atalayas', cost: {food: 75, wood: 50}, time: 30, age: 1, desc: 'Los edificios ven 2 casillas más lejos.', fx: {bldLos: 2}},
  l_espada:  {name: 'Espadachín', cost: {food: 100, gold: 40}, time: 35, age: 2, desc: 'Mejora el Peón a Espadachín (vida 60, ataque 9).', line: 'milicia', level: 1},
  l_campeon: {name: 'Adalid', cost: {food: 300, gold: 100}, time: 60, age: 3, req: 'l_espada', desc: 'Mejora el Espadachín a Adalid (vida 80, ataque 13).', line: 'milicia', level: 2},
  l_piquero: {name: 'Piquero', cost: {food: 150, wood: 50}, time: 35, age: 2, desc: 'Mejora el Lancero a Piquero.', line: 'lancero', level: 1},
  l_alabardero:{name: 'Alabardero', cost: {food: 300, wood: 100}, time: 55, age: 3, req: 'l_piquero', desc: 'Mejora el Piquero a Alabardero.', line: 'lancero', level: 2},
  l_ballestero:{name: 'Ballestero', cost: {food: 125, gold: 75}, time: 35, age: 2, desc: 'Mejora el Arquero a Ballestero.', line: 'arquero', level: 1},
  l_arbalestero:{name: 'Arbalestero', cost: {food: 350, gold: 250}, time: 60, age: 3, req: 'l_ballestero', desc: 'Mejora el Ballestero a Arbalestero.', line: 'arquero', level: 2},
  l_jinete:  {name: 'Caballería ligera', cost: {food: 150}, time: 30, age: 2, desc: 'Mejora el Explorador a Caballería ligera.', line: 'explorador', level: 1},
  l_paladin: {name: 'Caballero pesado', cost: {food: 600, gold: 400}, time: 90, age: 3, desc: 'Mejora el Caballero a Caballero pesado.', line: 'caballero', level: 1},
  l_trabuco: {name: 'Trabuquete', cost: {wood: 400, gold: 300}, time: 70, age: 3, desc: 'Mejora la Catapulta a Trabuquete.', line: 'catapulta', level: 1},
  fervor:    {name: 'Peregrinación', cost: {gold: 120}, time: 35, age: 2, desc: 'Los clérigos se mueven un 25% más rápido.', fx: {monkSpd: 0.25}},
  sanacion:  {name: 'Herbolario', cost: {gold: 150}, time: 40, age: 2, desc: 'Los clérigos curan el doble de rápido.', fx: {heal: 1}},
  fe:        {name: 'Fe', cost: {food: 300, gold: 200}, time: 60, age: 3, desc: 'Tus unidades resisten la conversión (tarda el doble).', fx: {faith: 1}},
  conscripcion:{name: 'Fonsado', cost: {food: 150, gold: 150}, time: 50, age: 3, desc: 'Las unidades militares se entrenan un 30% más rápido.', fx: {trainSpd: 0.3}},
  espionaje: {name: 'Espías', cost: {gold: 250}, time: 30, age: 2, desc: 'Revela la posición de todos los edificios enemigos.', fx: {spy: 1}},
  gremio:    {name: 'Zoco', cost: {food: 200, gold: 100}, time: 40, age: 2, desc: 'Comisión del mercado reducida a la mitad.', fx: {marketRate: 0.5}},
};

// ------------------------------------------------------------ Utilidades
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const costStr = c => Object.entries(c).map(([k, v]) => `${v} ${RES_ES[k].toLowerCase()}`).join(', ');
function fmtTime(s) { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const OPTS = {vol: 0.6, music: 0.35, edge: true, hp: false, flee: true, grid: false};
try { Object.assign(OPTS, JSON.parse(localStorage.getItem('edad-reinos-opts') || '{}')); } catch (e) {}
function saveOpts() { try { localStorage.setItem('edad-reinos-opts', JSON.stringify(OPTS)); } catch (e) {} }
