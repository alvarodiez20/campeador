import { FP_ONE, fx } from '../core/fixed';
import { ResourceKind } from '../ecs/components';
import type { Entity } from '../ecs/world';
import { entityIndex } from '../ecs/world';
import { BuildingId, FactionId, UnitId } from './data';
import { disc, fill, rect, resourceCluster, river, road } from './mapgen';
import { Simulation, type SimEvent } from '../sim/sim';
import { Tile } from '../sim/terrain';

/**
 * Escenario: la defensa de Valencia, octubre de 1094 (batalla de Cuarte).
 *
 * Por que este y no otro: esta acotado en el tiempo y en el espacio, tiene
 * tension propia sin necesitar arbol tecnologico y el desenlace historico
 * (una salida por sorpresa contra un sitio muy superior) es exactamente la
 * forma de una mision de RTS.
 *
 * Tratamiento (docs/TRATAMIENTO-HISTORICO.md): quien defiende Valencia no es
 * "los cristianos". Es una ciudad de mayoria musulmana gobernada por un
 * senor cristiano con tropas mixtas, que sigue cobrando parias a taifas
 * vecinas y que teme a los almoravides tanto como el Cid. El jugador manda
 * una hueste mercenaria, no una cruzada.
 */

export interface Objective {
  id: string;
  text: string;
  hint?: string;
  done: boolean;
  failed: boolean;
  optional?: boolean;
}

export interface Scenario {
  readonly sim: Simulation;
  readonly localPlayer: number;
  readonly title: string;
  readonly year: string;
  readonly briefing: readonly string[];
  readonly objectives: Objective[];
  /** 'jugando' | 'victoria' | 'derrota' */
  outcome: 'jugando' | 'victoria' | 'derrota';
  handleEvents(events: readonly SimEvent[]): void;
  /** Entidades destacadas para la camara inicial. */
  readonly focus: { x: number; y: number };
}

const MAP_W = 96;
const MAP_H = 96;

/** Ticks que hay que aguantar antes de poder salir: 8 minutos de juego. */
const TICKS_ASEDIO = 15 * 60 * 8;

export const PLAYER_CID = 0;
export const PLAYER_ALMORAVIDES = 1;
export const PLAYER_ALBARRACIN = 2;

export function createValencia1094(seed = 0x1094): Scenario {
  const sim = new Simulation({
    width: MAP_W,
    height: MAP_H,
    seed,
    players: [
      { faction: FactionId.HuesteDelCid, team: 1, name: 'Hueste del Cid en Valencia' },
      { faction: FactionId.Almoravides, team: 2, name: 'Ejercito almoravide' },
      { faction: FactionId.Zaragoza, team: 3, name: 'Taifa de Albarracin' },
    ],
  });

  const rng = sim.rng;

  // --- terreno -----------------------------------------------------------
  fill(sim, Tile.Dirt);
  // La huerta de Valencia: el regadio andalusi es la razon de que la ciudad
  // valga lo que vale. Aqui es terreno de cultivo, no decorado.
  rect(sim, 18, 30, 60, 40, Tile.Field);
  // El Turia, al norte de la ciudad.
  river(sim, rng, 26, 1);
  // Marjal y albufera al sureste.
  disc(sim, 78, 78, 12, Tile.Marsh);
  disc(sim, 86, 86, 8, Tile.Water);
  // Sierra al oeste, por donde vino el ejercito almoravide desde Cuarte.
  disc(sim, 8, 48, 7, Tile.Rock);
  disc(sim, 12, 66, 5, Tile.Rock);
  disc(sim, 6, 30, 6, Tile.Rock);

  // Casco urbano, con sus calles.
  rect(sim, 52, 44, 22, 20, Tile.Road);
  road(sim, 30, 54, 52, 54, 1); // camino de Cuarte, el que trae al enemigo
  road(sim, 63, 44, 63, 20, 1); // camino del norte, hacia el Turia

  // --- Valencia: el jugador ---------------------------------------------
  const alcazar = sim.spawnBuilding(PLAYER_CID, BuildingId.CentroUrbano, 60, 52, true);
  sim.spawnBuilding(PLAYER_CID, BuildingId.Almacen, 56, 58, true);
  sim.spawnBuilding(PLAYER_CID, BuildingId.Cuartel, 66, 56, true);
  const torreNorte = sim.spawnBuilding(PLAYER_CID, BuildingId.Torre, 58, 46, true);
  const torreOeste = sim.spawnBuilding(PLAYER_CID, BuildingId.Torre, 53, 55, true);
  for (let i = 0; i < 4; i++) sim.spawnBuilding(PLAYER_CID, BuildingId.Casa, 66 + (i % 2) * 3, 48 + Math.floor(i / 2) * 3, true);

  const campeador = sim.spawnUnit(PLAYER_CID, UnitId.Campeador, fx(62), fx(57));
  for (let i = 0; i < 8; i++) sim.spawnUnit(PLAYER_CID, UnitId.Aldeano, fx(57 + (i % 4)), fx(60 + Math.floor(i / 4)));
  for (let i = 0; i < 6; i++) sim.spawnUnit(PLAYER_CID, UnitId.Lancero, fx(55 + (i % 3)), fx(57 + Math.floor(i / 3)));
  for (let i = 0; i < 4; i++) sim.spawnUnit(PLAYER_CID, UnitId.Ballestero, fx(58 + i), fx(48));
  for (let i = 0; i < 4; i++) sim.spawnUnit(PLAYER_CID, UnitId.Caballero, fx(64 + i), fx(60));

  sim.players[PLAYER_CID].resources.set([350, 300, 250, 150]);
  sim.players[PLAYER_CID].popMax = 90;

  // --- campamento almoravide, al oeste, en Cuarte ------------------------
  sim.spawnBuilding(PLAYER_ALMORAVIDES, BuildingId.CentroUrbano, 20, 50, true);
  sim.spawnBuilding(PLAYER_ALMORAVIDES, BuildingId.Cuartel, 25, 46, true);
  sim.spawnBuilding(PLAYER_ALMORAVIDES, BuildingId.Caballerizas, 25, 55, true);
  for (let i = 0; i < 6; i++) sim.spawnBuilding(PLAYER_ALMORAVIDES, BuildingId.Casa, 16 + (i % 3) * 3, 58 + Math.floor(i / 3) * 3, true);
  for (let i = 0; i < 6; i++) sim.spawnUnit(PLAYER_ALMORAVIDES, UnitId.Aldeano, fx(18 + (i % 3)), fx(54 + Math.floor(i / 3)));
  for (let i = 0; i < 8; i++) sim.spawnUnit(PLAYER_ALMORAVIDES, UnitId.Infante, fx(27 + (i % 4)), fx(48 + Math.floor(i / 4)));
  for (let i = 0; i < 4; i++) sim.spawnUnit(PLAYER_ALMORAVIDES, UnitId.Caballero, fx(27 + (i % 4)), fx(53));
  sim.players[PLAYER_ALMORAVIDES].resources.set([600, 600, 400, 250]);
  sim.players[PLAYER_ALMORAVIDES].popMax = 110;

  // --- Albarracin: la taifa que paga parias al Cid ------------------------
  // Historico: Rodrigo cobraba tributo de Albarracin y Alpuente. Es la pieza
  // que mete la mecanica de parias dentro del escenario en vez de dejarla en
  // una pantalla de menu.
  sim.spawnBuilding(PLAYER_ALBARRACIN, BuildingId.CentroUrbano, 74, 20, true);
  sim.spawnBuilding(PLAYER_ALBARRACIN, BuildingId.Casa, 80, 22, true);
  for (let i = 0; i < 4; i++) sim.spawnUnit(PLAYER_ALBARRACIN, UnitId.Aldeano, fx(72 + i), fx(25));
  for (let i = 0; i < 3; i++) sim.spawnUnit(PLAYER_ALBARRACIN, UnitId.Lancero, fx(76 + i), fx(24));
  sim.players[PLAYER_ALBARRACIN].resources.set([300, 200, 900, 100]);

  // Empieza en tregua con el Cid y en guerra con los almoravides.
  sim.diplomacy.tregua(PLAYER_CID, PLAYER_ALBARRACIN);

  // --- recursos ----------------------------------------------------------
  resourceCluster(sim, rng, { kind: ResourceKind.Wood, cx: 70, cy: 70, count: 60, spread: 9, amount: 100, blocks: true });
  resourceCluster(sim, rng, { kind: ResourceKind.Wood, cx: 44, cy: 38, count: 50, spread: 8, amount: 100, blocks: true });
  resourceCluster(sim, rng, { kind: ResourceKind.Wood, cx: 30, cy: 66, count: 40, spread: 7, amount: 100, blocks: true });
  resourceCluster(sim, rng, { kind: ResourceKind.Food, cx: 56, cy: 66, count: 24, spread: 6, amount: 120, blocks: false });
  resourceCluster(sim, rng, { kind: ResourceKind.Food, cx: 24, cy: 60, count: 20, spread: 6, amount: 120, blocks: false });
  resourceCluster(sim, rng, { kind: ResourceKind.Gold, cx: 68, cy: 40, count: 8, spread: 3, amount: 300, blocks: true });
  resourceCluster(sim, rng, { kind: ResourceKind.Gold, cx: 32, cy: 44, count: 8, spread: 3, amount: 300, blocks: true });
  resourceCluster(sim, rng, { kind: ResourceKind.Stone, cx: 50, cy: 70, count: 6, spread: 3, amount: 250, blocks: true });
  resourceCluster(sim, rng, { kind: ResourceKind.Stone, cx: 14, cy: 42, count: 6, spread: 3, amount: 250, blocks: true });

  const objectives: Objective[] = [
    {
      id: 'aguantar',
      text: 'Resistir el asedio ocho minutos sin perder el alcazar',
      hint: 'Los almoravides atacaran en oleadas. Las torres y los lanceros son tu red.',
      done: false,
      failed: false,
    },
    {
      id: 'salida',
      text: 'Destruir el campamento almoravide de Cuarte',
      hint: 'Como en 1094: se gana saliendo, no aguantando.',
      done: false,
      failed: false,
    },
    {
      id: 'parias',
      text: 'Cobrar parias a la taifa de Albarracin',
      hint: 'Manda tropas cerca de Albarracin y exige el tributo. Es oro sin aldeanos.',
      done: false,
      failed: false,
      optional: true,
    },
  ];

  const scenario: Scenario = {
    sim,
    localPlayer: PLAYER_CID,
    title: 'La defensa de Valencia',
    year: 'Cuarte de Poblet, octubre de 1094',
    briefing: [
      'Valencia lleva tres meses en manos de Rodrigo Diaz. La ciudad sigue siendo lo que era: mayoria musulmana, su qadi, su zoco y su huerta.',
      'Desde el Magreb ha cruzado un ejercito almoravide al mando de Abu Bakr ibn Ibrahim. Ha acampado en Cuarte, a una legua al oeste, y espera que la ciudad se le entregue sola.',
      'Aguanta el cerco. Y cuando el enemigo se confie, sal a buscarlo: asi acabo de verdad.',
    ],
    objectives,
    outcome: 'jugando',
    focus: { x: 62, y: 54 },
    handleEvents(events) {
      for (const e of events) {
        if (e.t === 'muerte' && e.entity === alcazar) {
          objectives[0].failed = true;
          scenario.outcome = 'derrota';
        }
        if (e.t === 'pariaFirmada' && (e as unknown as { receiver: number }).receiver === PLAYER_CID) {
          objectives[2].done = true;
        }
      }
    },
  };

  sim.onCheckVictory = (s) => {
    if (scenario.outcome !== 'jugando') return;
    if (!s.world.isAlive(alcazar)) {
      scenario.outcome = 'derrota';
      objectives[0].failed = true;
      return;
    }
    if (!objectives[0].done && s.tick >= TICKS_ASEDIO) {
      objectives[0].done = true;
      s.emit({ t: 'objetivo', id: 'aguantar', texto: 'Valencia ha resistido el cerco.' });
    }
    // El campamento cae cuando no queda ningun edificio almoravide en pie.
    let edificios = 0;
    s.world.each(s.mBuilding, (i) => {
      if (s.C.player[i] === PLAYER_ALMORAVIDES) edificios++;
    });
    if (edificios === 0) {
      objectives[1].done = true;
      s.players[PLAYER_ALMORAVIDES].defeated = true;
      if (objectives[0].done || s.tick > 15 * 60) {
        scenario.outcome = 'victoria';
      }
    }
  };

  // Referencias que la IA y el HUD quieren tener a mano.
  (scenario as unknown as { anchors: Record<string, Entity> }).anchors = {
    alcazar,
    torreNorte,
    torreOeste,
    campeador,
  };

  return scenario;
}

/** Posicion en casillas de una entidad, para la camara. */
export function entityTile(sim: Simulation, e: Entity): { x: number; y: number } {
  const i = entityIndex(e);
  return { x: sim.C.tx[i] / FP_ONE, y: sim.C.ty[i] / FP_ONE };
}
