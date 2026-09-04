import { FP_ONE, FP_SHIFT } from '../core/fixed';
import { GatherState, MoveState, Stance } from '../ecs/components';
import { NULL_ENTITY, entityIndex, type Entity } from '../ecs/world';
import { BUILDINGS, UNITS } from '../game/data';
import type { Command } from './commands';
import { combatSystem } from './systems/combat';
import { buildSystem, enqueueTrain, gatherSystem, trainSystem } from './systems/economy';
import { arrive, movementSystem, orderMove } from './systems/movement';
import { PARIAS_PERIOD_TICKS, type Simulation } from './sim';

/**
 * Orden de ejecucion de un tick. El orden importa y no es negociable sin
 * pensarlo: la rejilla espacial se reconstruye antes de que nadie consulte
 * vecinos, y el combate elige blanco antes de que el movimiento los aleje.
 */
export function stepSimulation(sim: Simulation, commands: readonly Command[]): void {
  sim.tick++;

  for (const c of commands) executeCommand(sim, c);

  rebuildSpatial(sim);
  trainSystem(sim);
  gatherSystem(sim);
  buildSystem(sim);
  combatSystem(sim);
  movementSystem(sim);
  sim.updateFog();
  sim.diplomacy.tick(sim.tick);
  sim.flushCostPatches();
  if (sim.onCheckVictory) sim.onCheckVictory(sim);
}

export function rebuildSpatial(sim: Simulation): void {
  const { idx, count } = sim.collect(sim.mBody);
  sim.grid.rebuild(idx, count, sim.C.tx, sim.C.ty);
}

export function executeCommand(sim: Simulation, c: Command): void {
  const C = sim.C;
  const w = sim.world;
  switch (c.t) {
    case 'move':
    case 'attackMove': {
      const target = { x: c.x, y: c.y };
      for (const e of c.units) {
        if (!ownedBy(sim, e, c.player)) continue;
        const i = entityIndex(e);
        C.target[i] = NULL_ENTITY;
        if (w.has(e, C.gather)) C.gatherState[i] = GatherState.None;
        if (c.t === 'attackMove') C.stance[i] = Stance.Aggressive;
        orderMove(sim, i, target.x, target.y);
      }
      break;
    }
    case 'attack': {
      if (!w.isAlive(c.target)) break;
      for (const e of c.units) {
        if (!ownedBy(sim, e, c.player)) continue;
        const i = entityIndex(e);
        if (!w.has(e, C.combat)) continue;
        C.target[i] = c.target;
        if (w.has(e, C.gather)) C.gatherState[i] = GatherState.None;
        const tj = entityIndex(c.target);
        orderMove(sim, i, C.tx[tj], C.ty[tj]);
      }
      break;
    }
    case 'stop': {
      for (const e of c.units) {
        if (!ownedBy(sim, e, c.player)) continue;
        const i = entityIndex(e);
        C.target[i] = NULL_ENTITY;
        if (w.has(e, C.gather)) C.gatherState[i] = GatherState.None;
        arrive(sim, i);
        C.moveState[i] = MoveState.Idle;
      }
      break;
    }
    case 'stance': {
      for (const e of c.units) {
        if (!ownedBy(sim, e, c.player)) continue;
        C.stance[entityIndex(e)] = c.stance;
      }
      break;
    }
    case 'gather': {
      if (!w.isAlive(c.node)) break;
      const nj = entityIndex(c.node);
      for (const e of c.units) {
        if (!ownedBy(sim, e, c.player)) continue;
        if (!w.has(e, C.gather)) continue;
        const i = entityIndex(e);
        C.gatherTarget[i] = c.node;
        C.carryKind[i] = C.nodeKind[nj];
        C.gatherState[i] = GatherState.ToNode;
        C.target[i] = NULL_ENTITY;
        orderMove(sim, i, C.tx[nj], C.ty[nj]);
      }
      break;
    }
    case 'build': {
      const def = BUILDINGS[c.building];
      if (!canPlace(sim, c.tx, c.ty, def.tileW, def.tileH)) {
        sim.emit({ t: 'sitioOcupado', player: c.player });
        break;
      }
      if (!sim.canAfford(c.player, def.cost)) {
        sim.emit({ t: 'sinRecursos', player: c.player, building: c.building });
        break;
      }
      sim.pay(c.player, def.cost);
      const site = sim.spawnBuilding(c.player, c.building, c.tx, c.ty, false);
      const crew = new Set<Entity>();
      for (const e of c.units) {
        if (!ownedBy(sim, e, c.player)) continue;
        if (!w.has(e, C.gather)) continue;
        const i = entityIndex(e);
        C.gatherState[i] = GatherState.None;
        C.target[i] = NULL_ENTITY;
        crew.add(e);
        orderMove(sim, i, ((c.tx << FP_SHIFT) + ((def.tileW * FP_ONE) >> 1)) | 0, ((c.ty << FP_SHIFT) + ((def.tileH * FP_ONE) >> 1)) | 0);
      }
      sim.builders.set(site, crew);
      sim.emit({ t: 'obraIniciada', entity: site, player: c.player, building: c.building });
      break;
    }
    case 'repair': {
      if (!w.isAlive(c.target)) break;
      const crew = sim.builders.get(c.target) ?? new Set<Entity>();
      for (const e of c.units) {
        if (!ownedBy(sim, e, c.player)) continue;
        crew.add(e);
      }
      sim.builders.set(c.target, crew);
      break;
    }
    case 'train': {
      enqueueTrain(sim, c.building, c.unit, c.player);
      break;
    }
    case 'cancelTrain': {
      const q = sim.trainQueues.get(c.building);
      if (!q || q.length === 0) break;
      const bi = entityIndex(c.building);
      if (C.player[bi] !== c.player) break;
      const unit = q.pop()!;
      sim.refund(c.player, UNITS[unit].cost);
      break;
    }
    case 'demandParias': {
      const presion = presionMilitar(sim, c.player, c.from);
      sim.diplomacy.demandar(c.player, c.from, presion, sim.tick, PARIAS_PERIOD_TICKS);
      break;
    }
    case 'breakParias': {
      sim.diplomacy.romper(c.player, c.other, sim.tick);
      break;
    }
    case 'offerTruce': {
      sim.diplomacy.tregua(c.player, c.other);
      break;
    }
    case 'declareWar': {
      sim.diplomacy.declararGuerra(c.player, c.other);
      break;
    }
  }
}

function ownedBy(sim: Simulation, e: Entity, player: number): boolean {
  const w = sim.world;
  if (!w.isAlive(e)) return false;
  if (!w.has(e, sim.C.owner)) return false;
  return sim.C.player[entityIndex(e)] === player;
}

export function canPlace(sim: Simulation, tx: number, ty: number, tw: number, th: number): boolean {
  for (let y = ty; y < ty + th; y++) {
    for (let x = tx; x < tx + tw; x++) {
      if (!sim.terrain.walkable(x, y)) return false;
    }
  }
  return true;
}

/**
 * Presion militar de `receiver` sobre `payer`: proporcion de tropas del
 * primero que estan cerca de los edificios del segundo. Es lo que convierte
 * la paria en una mecanica de juego y no en un boton: para cobrar tributo hay
 * que tener hueste delante de la ciudad, como la tenia Alfonso VI.
 */
export function presionMilitar(sim: Simulation, receiver: number, payer: number): number {
  const C = sim.C;
  const w = sim.world;
  const centros: number[] = [];
  w.each(sim.mBuilding, (b) => {
    if (C.player[b] === payer) centros.push(b);
  });
  if (centros.length === 0) return 100;
  let cerca = 0;
  const RADIO = FP_ONE * 20;
  sim.eachUnit((i) => {
    if (C.player[i] !== receiver) return;
    if (C.unitClass[i] === 0) return; // aldeanos no amenazan a nadie
    for (const b of centros) {
      const dx = C.tx[b] - C.tx[i];
      const dy = C.ty[b] - C.ty[i];
      if (dx * dx + dy * dy <= RADIO * RADIO) {
        cerca++;
        break;
      }
    }
  });
  return Math.min(100, cerca * 6);
}
