import { FP_ONE, FP_SHIFT, isqrt } from '../../core/fixed';
import { GatherState, MoveState, ResourceKind, UnitClass } from '../../ecs/components';
import { World, NULL_ENTITY, entityIndex, type Entity } from '../../ecs/world';
import { BUILDINGS, UNITS, type UnitId } from '../../game/data';
import type { Simulation } from '../sim';
import { orderMove } from './movement';

/**
 * Economia: recoleccion, deposito, construccion y entrenamiento.
 *
 * Ritmo de recoleccion: 1 unidad de recurso cada `GATHER_TICKS`. Con carga de
 * 10 y 15 Hz, un aldeano tarda unos 10 s en llenarse mas el viaje. El numero
 * exacto es provisional: no se afina hasta que Cuarte 1094 se juegue entero.
 */

const GATHER_TICKS = 15;
const BUILD_POINTS_PER_TICK = 3;
const DROP_RANGE = FP_ONE * 2;

export function gatherSystem(sim: Simulation): void {
  const C = sim.C;
  const w = sim.world;
  const { idx, count } = sim.collect(sim.mGatherer);

  for (let k = 0; k < count; k++) {
    const i = idx[k];
    if (C.unitClass[i] !== UnitClass.Villager) continue;
    const state = C.gatherState[i];
    if (state === GatherState.None) continue;

    if (state === GatherState.ToNode || state === GatherState.Gathering) {
      const node = C.gatherTarget[i] as Entity;
      if (!w.isAlive(node)) {
        // Yacimiento agotado: buscar otro del mismo tipo cerca antes de
        // quedarse quieto. Un aldeano ocioso es un aldeano perdido.
        const next = findNearestNode(sim, i, C.carryKind[i]);
        if (next === NULL_ENTITY) {
          C.gatherState[i] = C.carryAmount[i] > 0 ? GatherState.ToDrop : GatherState.None;
          if (C.gatherState[i] === GatherState.None) sim.emit({ t: 'aldeanoOcioso', entity: w.entityAt(i) });
          continue;
        }
        C.gatherTarget[i] = next;
        orderMove(sim, i, C.tx[entityIndex(next)], C.ty[entityIndex(next)]);
        C.gatherState[i] = GatherState.ToNode;
        continue;
      }
      const nj = entityIndex(node);
      const dx = C.tx[nj] - C.tx[i];
      const dy = C.ty[nj] - C.ty[i];
      const d = isqrt(dx * dx + dy * dy);
      // Holgura de una casilla: el destino de la orden es el centro de la
      // casilla libre mas cercana al yacimiento, que ya esta a una casilla
      // larga del centro del mismo.
      if (d > C.radius[nj] + C.radius[i] + FP_ONE) {
        if (C.moveState[i] !== MoveState.Moving) orderMove(sim, i, C.tx[nj], C.ty[nj]);
        C.gatherState[i] = GatherState.ToNode;
        continue;
      }
      C.gatherState[i] = GatherState.Gathering;
      C.moveState[i] = MoveState.Arrived;
      C.carryKind[i] = C.nodeKind[nj];
      if (++C.gatherTimer[i] >= GATHER_TICKS) {
        C.gatherTimer[i] = 0;
        const take = Math.min(1, C.nodeAmount[nj]);
        C.nodeAmount[nj] -= take;
        C.carryAmount[i] += take;
        if (C.nodeAmount[nj] <= 0) sim.destroyEntity(node);
        if (C.carryAmount[i] >= C.carryCap[i]) {
          C.gatherState[i] = GatherState.ToDrop;
          C.dropSite[i] = findDropSite(sim, i);
        }
      }
      continue;
    }

    if (state === GatherState.ToDrop) {
      let site = C.dropSite[i] as Entity;
      if (!w.isAlive(site)) {
        site = findDropSite(sim, i);
        C.dropSite[i] = site;
      }
      if (site === NULL_ENTITY) {
        C.gatherState[i] = GatherState.None;
        continue;
      }
      const sj = entityIndex(site);
      const dx = C.tx[sj] - C.tx[i];
      const dy = C.ty[sj] - C.ty[i];
      const d = isqrt(dx * dx + dy * dy);
      if (d > C.radius[sj] + DROP_RANGE) {
        if (C.moveState[i] !== MoveState.Moving) orderMove(sim, i, C.tx[sj], C.ty[sj]);
        continue;
      }
      sim.addResource(C.player[i], C.carryKind[i] as ResourceKind, C.carryAmount[i]);
      sim.emit({ t: 'deposito', player: C.player[i], kind: C.carryKind[i], amount: C.carryAmount[i] });
      C.carryAmount[i] = 0;
      const node = C.gatherTarget[i] as Entity;
      if (w.isAlive(node)) {
        orderMove(sim, i, C.tx[entityIndex(node)], C.ty[entityIndex(node)]);
        C.gatherState[i] = GatherState.ToNode;
      } else {
        const next = findNearestNode(sim, i, C.carryKind[i]);
        if (next !== NULL_ENTITY) {
          C.gatherTarget[i] = next;
          orderMove(sim, i, C.tx[entityIndex(next)], C.ty[entityIndex(next)]);
          C.gatherState[i] = GatherState.ToNode;
        } else {
          C.gatherState[i] = GatherState.None;
        }
      }
    }
  }
}

export function findDropSite(sim: Simulation, i: number): Entity {
  const C = sim.C;
  const w = sim.world;
  const me = C.player[i];
  let best = NULL_ENTITY as Entity;
  let bestD = Infinity;
  w.each(sim.mBuilding, (b) => {
    if (C.player[b] !== me) return;
    if (C.isDropSite[b] === 0) return;
    if (C.buildProgress[b] < C.buildTotal[b]) return;
    const dx = C.tx[b] - C.tx[i];
    const dy = C.ty[b] - C.ty[i];
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = w.entityAt(b);
    }
  });
  return best;
}

export function findNearestNode(sim: Simulation, i: number, kind: number): Entity {
  const C = sim.C;
  const w = sim.world;
  let best = NULL_ENTITY as Entity;
  let bestD = Infinity;
  w.each(sim.mNode, (n) => {
    if (C.nodeKind[n] !== kind) return;
    const dx = C.tx[n] - C.tx[i];
    const dy = C.ty[n] - C.ty[i];
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = w.entityAt(n);
    }
  });
  return best;
}

/** Obras en curso: los aldeanos asignados aportan puntos por tick. */
export function buildSystem(sim: Simulation): void {
  const C = sim.C;
  const w = sim.world;
  for (const [site, crew] of sim.builders) {
    if (!w.isAlive(site)) {
      sim.builders.delete(site);
      continue;
    }
    const sj = entityIndex(site);
    if (C.buildProgress[sj] >= C.buildTotal[sj]) {
      sim.builders.delete(site);
      continue;
    }
    let working = 0;
    for (const u of crew) {
      if (!w.isAlive(u)) {
        crew.delete(u);
        continue;
      }
      const ui = entityIndex(u);
      const dx = C.tx[sj] - C.tx[ui];
      const dy = C.ty[sj] - C.ty[ui];
      const d = isqrt(dx * dx + dy * dy);
      if (d <= C.radius[sj] + C.radius[ui] + FP_ONE + (FP_ONE >> 1)) {
        C.moveState[ui] = MoveState.Arrived;
        working++;
      } else if (C.moveState[ui] !== MoveState.Moving) {
        orderMove(sim, ui, C.tx[sj], C.ty[sj]);
      }
    }
    if (working === 0) continue;
    // Rendimiento decreciente: el segundo aldeano suma menos que el primero.
    const gain = BUILD_POINTS_PER_TICK * (working === 1 ? 1 : 1 + Math.floor(Math.sqrt(working - 1) * 10) / 10);
    C.buildProgress[sj] = Math.min(C.buildTotal[sj], C.buildProgress[sj] + Math.max(1, Math.round(gain)));
    const def = BUILDINGS[C.typeId[sj]];
    const ratio = C.buildProgress[sj] / C.buildTotal[sj];
    C.hp[sj] = Math.max(1, Math.round(def.hp * (0.25 + 0.75 * ratio)));
    if (C.buildProgress[sj] >= C.buildTotal[sj]) {
      C.hp[sj] = def.hp;
      sim.players[C.player[sj]].popCap += def.popProvided;
      sim.emit({ t: 'obraTerminada', entity: site, player: C.player[sj], building: C.typeId[sj] });
      for (const u of crew) {
        const ui = entityIndex(u);
        C.gatherState[ui] = GatherState.None;
      }
      sim.builders.delete(site);
    }
  }
}

/** Colas de entrenamiento. */
export function trainSystem(sim: Simulation): void {
  const C = sim.C;
  const w = sim.world;
  for (const [b, queue] of sim.trainQueues) {
    if (!w.isAlive(b) || queue.length === 0) {
      if (!w.isAlive(b)) sim.trainQueues.delete(b);
      continue;
    }
    const bi = entityIndex(b);
    if (C.buildProgress[bi] < C.buildTotal[bi]) continue;
    const unitId = queue[0];
    const def = UNITS[unitId];
    const prog = (sim.trainProgress.get(b) ?? 0) + 1;
    if (prog < def.trainTicks) {
      sim.trainProgress.set(b, prog);
      continue;
    }
    const p = sim.players[C.player[bi]];
    if (p.pop + def.pop > Math.min(p.popMax, p.popCap)) {
      sim.emit({ t: 'sinPoblacion', player: p.id });
      continue; // la cola espera; no se pierde el progreso
    }
    sim.trainProgress.set(b, 0);
    queue.shift();
    const spot = spawnPoint(sim, bi);
    const e = sim.spawnUnit(p.id, unitId, spot.x, spot.y);
    sim.emit({ t: 'unidadCreada', entity: e, player: p.id, unit: unitId });
  }
}

function spawnPoint(sim: Simulation, bi: number): { x: number; y: number } {
  const C = sim.C;
  const half = (Math.max(C.tileW[bi], C.tileH[bi]) * FP_ONE) >> 1;
  // Salida por el lado sur, que en isometrico es el que da al frente.
  const x = C.tx[bi];
  const y = C.ty[bi] + half + (FP_ONE >> 1);
  const tx = x >> FP_SHIFT;
  const ty = y >> FP_SHIFT;
  if (sim.terrain.walkable(tx, ty)) return { x, y };
  for (let r = 1; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (sim.terrain.walkable(tx + dx, ty + dy)) {
          return { x: ((tx + dx) << FP_SHIFT) + (FP_ONE >> 1), y: ((ty + dy) << FP_SHIFT) + (FP_ONE >> 1) };
        }
      }
    }
  }
  return { x, y };
}

/** Cuenta unidades de un jugador por clase; lo usan la IA y las victorias. */
export function countUnits(sim: Simulation, player: number, cls?: UnitClass): number {
  const C = sim.C;
  let n = 0;
  const mask = World.maskOf(C.transform, C.owner, C.kind, C.health);
  sim.world.each(mask, (i) => {
    if (C.player[i] !== player) return;
    if (sim.world.has(sim.world.entityAt(i), C.building)) return;
    if (cls !== undefined && C.unitClass[i] !== cls) return;
    n++;
  });
  return n;
}

export function enqueueTrain(sim: Simulation, building: Entity, unit: UnitId, player: number): boolean {
  const C = sim.C;
  if (!sim.world.isAlive(building)) return false;
  const bi = entityIndex(building);
  if (C.player[bi] !== player) return false;
  const bdef = BUILDINGS[C.typeId[bi]];
  if (!bdef.trains.includes(unit)) return false;
  const q = sim.trainQueues.get(building) ?? [];
  if (q.length >= 10) return false;
  const cost = UNITS[unit].cost;
  if (!sim.canAfford(player, cost)) {
    sim.emit({ t: 'sinRecursos', player, unit });
    return false;
  }
  sim.pay(player, cost);
  q.push(unit);
  sim.trainQueues.set(building, q);
  if (!sim.trainProgress.has(building)) sim.trainProgress.set(building, 0);
  return true;
}
