import { FP_SHIFT, isqrt } from '../../core/fixed';
import { DamageKind, MoveState, Stance, UnitClass } from '../../ecs/components';
import { NULL_ENTITY, entityIndex, type Entity } from '../../ecs/world';
import type { Simulation } from '../sim';
import { orderMove } from './movement';

/**
 * Combate y adquisicion de blancos.
 *
 * Formula de dano: (ataque + bono_si_clase_coincide) - armadura_del_tipo,
 * con minimo 1. Es deliberadamente simple: el triangulo tiene que ser legible
 * a ojo desde la primera partida. Los numeros estan en game/data.ts y las
 * relaciones documentadas en docs/BALANCE.md.
 */

const BUF = new Int32Array(256);

export function combatSystem(sim: Simulation): void {
  const C = sim.C;
  const w = sim.world;

  const { idx, count } = sim.collect(sim.mCombat);

  for (let k = 0; k < count; k++) {
    const i = idx[k];
    if (C.cooldown[i] > 0) C.cooldown[i]--;

    let target = C.target[i] as Entity;
    if (target !== NULL_ENTITY && !w.isAlive(target)) {
      target = NULL_ENTITY;
      C.target[i] = NULL_ENTITY;
    }

    // Adquisicion automatica.
    if (target === NULL_ENTITY && C.stance[i] !== Stance.StandGround) {
      target = acquire(sim, i);
      C.target[i] = target;
    } else if (target === NULL_ENTITY && C.stance[i] === Stance.StandGround) {
      target = acquireWithin(sim, i, C.range[i]);
      C.target[i] = target;
    }
    if (target === NULL_ENTITY) continue;

    const j = entityIndex(target);
    const dx = C.tx[j] - C.tx[i];
    const dy = C.ty[j] - C.ty[i];
    const dist = isqrt(dx * dx + dy * dy);
    const reach = C.range[i] + C.radius[j];

    if (dist <= reach) {
      if (C.moveState[i] === MoveState.Moving) {
        C.moveState[i] = MoveState.Arrived;
        if (C.flowId[i] !== 0 && sim.path) {
          sim.path.release(C.flowId[i]);
          C.flowId[i] = 0;
        }
      }
      if (C.cooldown[i] === 0) {
        applyDamage(sim, i, j);
        C.cooldown[i] = C.reload[i];
      }
    } else if (C.stance[i] === Stance.StandGround) {
      C.target[i] = NULL_ENTITY;
    } else {
      // Persecucion: se recalcula la meta solo cuando el blanco se ha movido
      // lo bastante, para no saturar el worker de peticiones.
      const gx = C.goalX[i];
      const gy = C.goalY[i];
      const ox = C.tx[j] - gx;
      const oy = C.ty[j] - gy;
      if (C.moveState[i] !== MoveState.Moving || isqrt(ox * ox + oy * oy) > (1 << FP_SHIFT)) {
        orderMove(sim, i, C.tx[j], C.ty[j]);
      }
    }
  }
}

function acquire(sim: Simulation, i: number): Entity {
  return acquireWithin(sim, i, sim.C.aggro[i]);
}

function acquireWithin(sim: Simulation, i: number, radius: number): Entity {
  const C = sim.C;
  const w = sim.world;
  const me = C.player[i];
  let best = NULL_ENTITY as Entity;
  let bestD = Infinity;
  const n = sim.grid.forEachNeighbor(C.tx[i], C.ty[i], BUF);
  for (let q = 0; q < n; q++) {
    const j = BUF[q];
    if (j === i) continue;
    const e = w.entityAt(j);
    if (!w.has(e, C.owner) || !w.has(e, C.health)) continue;
    if (C.hp[j] <= 0) continue;
    if (!sim.enemies(me, C.player[j])) continue;
    const dx = C.tx[j] - C.tx[i];
    const dy = C.ty[j] - C.ty[i];
    const d2 = dx * dx + dy * dy;
    const r = radius + C.radius[j];
    if (d2 > r * r) continue;
    // Preferencia: unidades militares antes que aldeanos y edificios.
    const priority = C.unitClass[j] === UnitClass.Villager || w.has(e, C.building) ? 1 : 0;
    const score = d2 + priority * 0x1000000;
    if (score < bestD) {
      bestD = score;
      best = e;
    }
  }
  return best;
}

export function applyDamage(sim: Simulation, attacker: number, victim: number): void {
  const C = sim.C;
  let dmg = C.attack[attacker];
  if (C.unitClass[victim] === C.bonusVs[attacker]) dmg += C.bonusAmount[attacker];
  const armor = C.damageKind[attacker] === DamageKind.Pierce ? C.armorPierce[victim] : C.armorMelee[victim];
  dmg = Math.max(1, dmg - armor);
  C.hp[victim] -= dmg;
  sim.emit({ t: 'golpe', x: C.tx[victim], y: C.ty[victim], dmg, victim: sim.world.entityAt(victim) });
  if (C.hp[victim] <= 0) {
    const e = sim.world.entityAt(victim);
    sim.emit({
      t: 'muerte',
      entity: e,
      player: C.player[victim],
      x: C.tx[victim],
      y: C.ty[victim],
      isBuilding: sim.world.has(e, C.building),
    });
    sim.destroyEntity(e);
  }
}
