/**
 * Banco de partidas: juega Cuarte 1094 entero, muchas veces, y mide.
 *
 *     npm run playtest -- --partidas=24
 *
 * El punto 2 del plan dice "jugar el escenario entero varias veces y anotar
 * donde se rompe el ritmo". A mano eso son horas y la memoria es mala
 * testigo; asi se juegan cien partidas en un minuto y el que dice donde se
 * rompe es el numero, no la impresion.
 *
 * Lo que NO mide: si es divertido. Las tres partes las lleva la IA, asi que
 * esto vigila el ritmo del sistema —si la economia arranca, si las oleadas
 * llegan, si la partida se resuelve y cuando— no las decisiones de un
 * jugador. Para lo otro hay que sentarse a jugarlo.
 */

import { ResourceKind, UnitClass, GatherState, MoveState } from '../src/ecs/components';
import { PERSONALIDADES, SimpleAI, type AiPersonality } from '../src/game/ai';
import {
  createValencia1094,
  PLAYER_ALBARRACIN,
  PLAYER_ALMORAVIDES,
  PLAYER_CID,
  type Scenario,
} from '../src/game/scenario';
import { InlinePathService } from '../src/path/service';
import { CommandQueue } from '../src/sim/commands';
import { HZ, type Simulation } from '../src/sim/sim';
import { stepSimulation } from '../src/sim/step';

const MUESTREO = HZ * 15; // una muestra cada 15 s de juego
const LIMITE = HZ * 60 * 25; // el escenario cierra solo a los 22; 25 es el margen

interface Muestra {
  segundo: number;
  recursos: number[][];
  pop: Array<{ pop: number; cap: number }>;
  unidades: number[][];
  edificios: number[];
  porTipo: number[][];
  ociosos: number[];
  vivos: number[];
}

interface Partida {
  semilla: number;
  desenlace: string;
  segundos: number;
  muestras: Muestra[];
  primeraOleada: number;
  primeraBaja: number;
  pariasFirmadas: number;
  bajas: number[];
  oleadas: number[];
  ultimaOleada: number[];
  msMedio: number;
  msPeor: number;
  bloqueoPop: number[];
  avisosSinRecursos: number[];
}

function contarOciosos(sim: Simulation, jugador: number): number {
  const C = sim.C;
  let n = 0;
  sim.eachUnit((i) => {
    if (C.player[i] !== jugador) return;
    if (C.unitClass[i] !== UnitClass.Villager) return;
    if (C.gatherState[i] !== GatherState.None) return;
    if (C.moveState[i] === MoveState.Moving) return;
    n++;
  });
  return n;
}

function contarPorClase(sim: Simulation, jugador: number): number[] {
  const C = sim.C;
  const out = [0, 0, 0, 0, 0, 0, 0];
  sim.eachUnit((i) => {
    if (C.player[i] !== jugador) return;
    out[C.unitClass[i]]++;
  });
  return out;
}

function contarEdificios(sim: Simulation, jugador: number): number {
  const C = sim.C;
  let n = 0;
  sim.world.each(sim.mBuilding, (i) => {
    if (C.player[i] === jugador) n++;
  });
  return n;
}

/** Edificios terminados por tipo, para ver si la IA llega a construirlos. */
function contarPorTipo(sim: Simulation, jugador: number): number[] {
  const C = sim.C;
  const out = [0, 0, 0, 0, 0, 0];
  sim.world.each(sim.mBuilding, (i) => {
    if (C.player[i] !== jugador) return;
    if (C.buildProgress[i] < C.buildTotal[i]) return;
    out[C.typeId[i]]++;
  });
  return out;
}

function jugar(semilla: number, personalidades: AiPersonality[]): Partida {
  const sc: Scenario = createValencia1094(semilla);
  const sim = sc.sim;
  sim.attachPath(new InlinePathService(sim.terrain.width, sim.terrain.height, sim.terrain.cost));
  const queue = new CommandQueue();
  const ias = [
    new SimpleAI(sim, PLAYER_CID, queue, personalidades[0]),
    new SimpleAI(sim, PLAYER_ALMORAVIDES, queue, personalidades[1]),
    new SimpleAI(sim, PLAYER_ALBARRACIN, queue, personalidades[2]),
  ];

  const p: Partida = {
    semilla,
    desenlace: 'sin resolver',
    segundos: 0,
    muestras: [],
    primeraOleada: -1,
    primeraBaja: -1,
    pariasFirmadas: 0,
    bajas: [0, 0, 0],
    oleadas: [0, 0, 0],
    ultimaOleada: [-1, -1, -1],
    msMedio: 0,
    msPeor: 0,
    bloqueoPop: [0, 0, 0],
    avisosSinRecursos: [0, 0, 0],
  };

  let totalMs = 0;
  let ticks = 0;
  for (let t = 0; t < LIMITE && sc.outcome === 'jugando'; t++) {
    for (const ia of ias) ia.tick();
    const t0 = performance.now();
    stepSimulation(sim, queue.drain());
    const dt = performance.now() - t0;
    totalMs += dt;
    ticks++;
    if (dt > p.msPeor) p.msPeor = dt;

    const eventos = sim.drainEvents();
    sc.handleEvents(eventos);
    for (const e of eventos) {
      if (e.t === 'oleada') {
        if (p.primeraOleada < 0) p.primeraOleada = Math.round(sim.tick / HZ);
        p.oleadas[e.player as number]++;
        p.ultimaOleada[e.player as number] = Math.round(sim.tick / HZ);
      }
      if (e.t === 'muerte') {
        if (p.primeraBaja < 0 && !e.isBuilding) p.primeraBaja = Math.round(sim.tick / HZ);
        const j = e.player as number;
        if (j >= 0 && j < 3) p.bajas[j]++;
      }
      if (e.t === 'pariaFirmada') p.pariasFirmadas++;
      if (e.t === 'sinPoblacion') p.bloqueoPop[e.player as number]++;
      if (e.t === 'sinRecursos') p.avisosSinRecursos[e.player as number]++;
    }

    if (sim.tick % MUESTREO === 0) {
      p.muestras.push({
        segundo: Math.round(sim.tick / HZ),
        recursos: sim.players.map((pl) => [...pl.resources]),
        pop: sim.players.map((pl) => sim.popOf(pl.id)),
        unidades: [0, 1, 2].map((j) => contarPorClase(sim, j)),
        edificios: [0, 1, 2].map((j) => contarEdificios(sim, j)),
        porTipo: [0, 1, 2].map((j) => contarPorTipo(sim, j)),
        ociosos: [0, 1, 2].map((j) => contarOciosos(sim, j)),
        vivos: [0, 1, 2].map((j) => contarPorClase(sim, j).reduce((a, b) => a + b, 0)),
      });
    }
  }

  p.desenlace = sc.outcome;
  p.segundos = Math.round(sim.tick / HZ);
  p.msMedio = ticks > 0 ? totalMs / ticks : 0;
  return p;
}

// --------------------------------------------------------------------------

function media(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function mediana(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
}

function fmt(n: number, d = 1): string {
  return n.toFixed(d).padStart(6);
}

const NOMBRE = ['Cid', 'Almoravides', 'Albarracin'];
const CLASES = ['aldeano', 'infante', 'jinete', 'lancero', 'arquero', 'asedio', 'heroe'];
const EDIFICIOS = ['centro', 'casa', 'almacen', 'cuartel', 'cuadras', 'torre'];

function informe(partidas: Partida[]): void {
  const n = partidas.length;
  console.log(`\n================ ${n} partidas de Cuarte 1094 ================\n`);

  const desenlaces = new Map<string, number>();
  for (const p of partidas) desenlaces.set(p.desenlace, (desenlaces.get(p.desenlace) ?? 0) + 1);
  console.log('Desenlace');
  for (const [k, v] of [...desenlaces].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(14)} ${String(v).padStart(3)}  (${Math.round((v / n) * 100)}%)`);
  }
  const dur = partidas.map((p) => p.segundos);
  console.log(`\nDuracion  media ${fmt(media(dur), 0)} s · mediana ${fmt(mediana(dur), 0)} s · min ${Math.min(...dur)} · max ${Math.max(...dur)}`);

  const ol = partidas.map((p) => p.primeraOleada).filter((x) => x >= 0);
  const ba = partidas.map((p) => p.primeraBaja).filter((x) => x >= 0);
  console.log(`Primera oleada  ${ol.length}/${n} partidas · mediana ${fmt(mediana(ol), 0)} s`);
  console.log(`Primera baja    ${ba.length}/${n} partidas · mediana ${fmt(mediana(ba), 0)} s`);
  console.log(`Parias firmadas ${partidas.filter((p) => p.pariasFirmadas > 0).length}/${n} partidas`);
  console.log(`Coste del tick  medio ${fmt(media(partidas.map((p) => p.msMedio)), 2)} ms · peor ${fmt(Math.max(...partidas.map((p) => p.msPeor)), 2)} ms`);

  // Serie temporal media, por jugador.
  const maxMuestras = Math.max(...partidas.map((p) => p.muestras.length));
  for (let j = 0; j < 3; j++) {
    console.log(`\n--- ${NOMBRE[j]} ---`);
    console.log('   s   com   mad   oro   pie   pop/cap  ald  mil  edif  ocio');
    for (let m = 0; m < maxMuestras; m++) {
      const ms = partidas.map((p) => p.muestras[m]).filter(Boolean) as Muestra[];
      if (ms.length < Math.max(2, n / 4)) break;
      const r = [0, 1, 2, 3].map((k) => media(ms.map((x) => x.recursos[j][k])));
      const pop = media(ms.map((x) => x.pop[j].pop));
      const cap = media(ms.map((x) => x.pop[j].cap));
      const ald = media(ms.map((x) => x.unidades[j][UnitClass.Villager]));
      const mil = media(ms.map((x) => x.vivos[j] - x.unidades[j][UnitClass.Villager]));
      const ed = media(ms.map((x) => x.edificios[j]));
      const oc = media(ms.map((x) => x.ociosos[j]));
      console.log(
        `${String(ms[0].segundo).padStart(4)} ${fmt(r[0], 0)} ${fmt(r[1], 0)} ${fmt(r[2], 0)} ${fmt(r[3], 0)}  ` +
          `${fmt(pop, 0)}/${fmt(cap, 0)} ${fmt(ald, 1)} ${fmt(mil, 1)} ${fmt(ed, 1)} ${fmt(oc, 1)}`,
      );
    }
  }

  // Composicion final del ejercito, para ver si el triangulo se usa.
  console.log('\n--- composicion militar al final (media) ---');
  for (let j = 0; j < 3; j++) {
    const ult = partidas.map((p) => p.muestras[p.muestras.length - 1]).filter(Boolean) as Muestra[];
    const partes = [UnitClass.Infantry, UnitClass.Spear, UnitClass.Cavalry, UnitClass.Archer]
      .map((c) => `${CLASES[c]} ${fmt(media(ult.map((x) => x.unidades[j][c])), 1)}`)
      .join(' · ');
    console.log(`  ${NOMBRE[j].padEnd(12)} ${partes}`);
  }

  const abiertas = partidas.filter((p) => p.desenlace === 'jugando');
  if (abiertas.length > 0) {
    console.log(`\n--- las ${abiertas.length} partidas sin resolver, al llegar al limite ---`);
    console.log('  semilla   Cid mil/edif   Almo mil/edif   Alba mil/edif   bajas C/A   oleadas Cid (ultima)');
    for (const p of abiertas) {
      const u = p.muestras[p.muestras.length - 1];
      if (!u) continue;
      const mil = (j: number): number => u.vivos[j] - u.unidades[j][UnitClass.Villager];
      console.log(
        `  ${String(p.semilla).padStart(7)}   ${fmt(mil(0), 0)}/${fmt(u.edificios[0], 0)}   ` +
          `${fmt(mil(1), 0)}/${fmt(u.edificios[1], 0)}   ${fmt(mil(2), 0)}/${fmt(u.edificios[2], 0)}   ` +
          `${fmt(p.bajas[0], 0)}/${fmt(p.bajas[1], 0)}   ${fmt(p.oleadas[0], 0)} (${p.ultimaOleada[0]} s)`,
      );
    }
  }

  console.log('\n--- edificios terminados al final (media) ---');
  for (let j = 0; j < 3; j++) {
    const ult = partidas.map((p) => p.muestras[p.muestras.length - 1]).filter(Boolean) as Muestra[];
    const partes = EDIFICIOS.map((nom, k) => `${nom} ${fmt(media(ult.map((x) => x.porTipo[j][k])), 1)}`).join(' · ');
    console.log(`  ${NOMBRE[j].padEnd(12)} ${partes}`);
  }

  console.log('\n--- avisos ---');
  for (let j = 0; j < 3; j++) {
    console.log(
      `  ${NOMBRE[j].padEnd(12)} sin poblacion ${fmt(media(partidas.map((p) => p.bloqueoPop[j])), 0)} · ` +
        `sin recursos ${fmt(media(partidas.map((p) => p.avisosSinRecursos[j])), 0)} · ` +
        `bajas ${fmt(media(partidas.map((p) => p.bajas[j])), 0)}`,
    );
  }
  console.log('');
}

function main(): void {
  const args = process.argv.slice(2);
  const leer = (k: string, def: number): number => {
    const a = args.find((x) => x.startsWith(`--${k}=`));
    return a ? Number(a.slice(k.length + 3)) : def;
  };
  const partidas = leer('partidas', 12);
  const base = leer('semilla', 0x1094);

  const mezclas: AiPersonality[][] = [
    [PERSONALIDADES.equilibrado, PERSONALIDADES.agresivo, PERSONALIDADES.economico],
    [PERSONALIDADES.economico, PERSONALIDADES.agresivo, PERSONALIDADES.economico],
    [PERSONALIDADES.agresivo, PERSONALIDADES.equilibrado, PERSONALIDADES.economico],
  ];

  const t0 = Date.now();
  const out: Partida[] = [];
  for (let i = 0; i < partidas; i++) {
    out.push(jugar(base + i * 7919, mezclas[i % mezclas.length]));
    process.stdout.write(`\r  jugando ${i + 1}/${partidas}...`);
  }
  process.stdout.write('\r                              \r');
  informe(out);
  console.log(`(${partidas} partidas en ${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);
}

main();
