import { FP_ONE, fx } from '../core/fixed';
import { GatherState, MoveState, ResourceKind, UnitClass } from '../ecs/components';
import { World, entityIndex } from '../ecs/world';
import type { CommandQueue } from '../sim/commands';
import type { Simulation } from '../sim/sim';
import { canPlace } from '../sim/step';
import { findNearestNode } from '../sim/systems/economy';
import { BUILDINGS, BuildingId, UNITS, UnitId } from './data';

/**
 * IA de escaramuza. No pretende jugar bien: pretende dar un oponente que
 * recolecte, construya y ataque en oleadas para poder probar el escenario de
 * principio a fin. Es lo que el vertical slice necesita y ni una linea mas.
 *
 * Corre una vez cada `PERIOD` ticks, no cada tick: la IA es la clase de
 * sistema que se come el presupuesto de CPU sin que nadie lo note hasta que
 * es tarde.
 */

const PERIOD = 15;

export interface AiPersonality {
  /** Aldeanos objetivo antes de volcarse en el ejercito. */
  villagers: number;
  /** Tropas antes de lanzar la primera oleada. */
  waveSize: number;
  /** Cada cuantos ticks intenta una oleada. */
  waveEvery: number;
  /** Reparto de aldeanos por recurso (comida, madera, oro, piedra). */
  gatherMix: [number, number, number, number];
  name: string;
}

export const PERSONALIDADES: Record<string, AiPersonality> = {
  agresivo: { villagers: 12, waveSize: 8, waveEvery: 15 * 70, gatherMix: [4, 4, 3, 1], name: 'agresivo' },
  equilibrado: { villagers: 16, waveSize: 12, waveEvery: 15 * 100, gatherMix: [5, 5, 4, 2], name: 'equilibrado' },
  economico: { villagers: 22, waveSize: 16, waveEvery: 15 * 140, gatherMix: [7, 7, 5, 3], name: 'economico' },
};

export class SimpleAI {
  private nextWave = 15 * 60;
  private counter = 0;
  private rally = { x: 0, y: 0 };

  constructor(
    private readonly sim: Simulation,
    private readonly player: number,
    private readonly queue: CommandQueue,
    private readonly p: AiPersonality = PERSONALIDADES.equilibrado,
  ) {}

  tick(): void {
    if (this.sim.players[this.player].defeated) return;
    if (this.counter++ % PERIOD !== 0) return;
    this.assignIdleVillagers();
    this.trainStuff();
    this.buildStuff();
    this.manageArmy();
    this.manageDiplomacy();
  }

  private myBuildings(type?: BuildingId): number[] {
    const C = this.sim.C;
    const out: number[] = [];
    this.sim.world.each(this.sim.mBuilding, (i) => {
      if (C.player[i] !== this.player) return;
      if (C.buildProgress[i] < C.buildTotal[i]) return;
      if (type !== undefined && C.typeId[i] !== type) return;
      out.push(i);
    });
    return out;
  }

  private myUnits(cls?: UnitClass): number[] {
    const C = this.sim.C;
    const w = this.sim.world;
    const out: number[] = [];
    w.each(World.maskOf(C.transform, C.owner, C.kind, C.health), (i) => {
      if (C.player[i] !== this.player) return;
      if (w.has(w.entityAt(i), C.building)) return;
      if (cls !== undefined && C.unitClass[i] !== cls) return;
      out.push(i);
    });
    return out;
  }

  /** Un aldeano parado es el peor error economico de un RTS. */
  private assignIdleVillagers(): void {
    const C = this.sim.C;
    const villagers = this.myUnits(UnitClass.Villager);
    const mix = this.p.gatherMix;
    const total = mix[0] + mix[1] + mix[2] + mix[3];
    let n = 0;
    for (const i of villagers) {
      if (C.gatherState[i] !== GatherState.None) continue;
      if (C.moveState[i] === MoveState.Moving) continue;
      // Reparto por cuota, para no dejar ningun recurso a cero.
      const slot = n++ % total;
      let kind: ResourceKind = ResourceKind.Food;
      let acc = 0;
      for (let k = 0; k < 4; k++) {
        acc += mix[k];
        if (slot < acc) {
          kind = k as ResourceKind;
          break;
        }
      }
      const node = findNearestNode(this.sim, i, kind);
      if (node === 0xffffffff) continue;
      this.queue.push({ t: 'gather', player: this.player, units: [this.sim.world.entityAt(i)], node });
    }
  }

  private trainStuff(): void {
    const sim = this.sim;
    const p = sim.players[this.player];
    const pop = sim.popOf(this.player);
    if (pop.pop >= pop.cap) return;

    const villagers = this.myUnits(UnitClass.Villager).length;
    const centros = this.myBuildings(BuildingId.CentroUrbano);
    if (villagers < this.p.villagers && centros.length > 0) {
      const b = sim.world.entityAt(centros[0]);
      if ((sim.trainQueues.get(b)?.length ?? 0) < 3 && sim.canAfford(this.player, UNITS[UnitId.Aldeano].cost)) {
        this.queue.push({ t: 'train', player: this.player, building: b, unit: UnitId.Aldeano });
        return;
      }
    }

    // Militares: mezcla fija que respeta el triangulo, sin reaccion todavia
    // a lo que trae el rival. Documentado como deuda en docs/DEUDA.md.
    const cuarteles = this.myBuildings(BuildingId.Cuartel);
    const cuadras = this.myBuildings(BuildingId.Caballerizas);
    const opciones: Array<{ b: number; u: UnitId }> = [];
    for (const b of cuarteles) {
      opciones.push({ b, u: UnitId.Lancero });
      opciones.push({ b, u: UnitId.Infante });
      opciones.push({ b, u: UnitId.Ballestero });
    }
    for (const b of cuadras) opciones.push({ b, u: UnitId.Caballero });
    for (const o of opciones) {
      const e = sim.world.entityAt(o.b);
      if ((sim.trainQueues.get(e)?.length ?? 0) >= 2) continue;
      if (!sim.canAfford(this.player, UNITS[o.u].cost)) continue;
      if (p.resources[ResourceKind.Food] < 120 && villagers < this.p.villagers) continue;
      this.queue.push({ t: 'train', player: this.player, building: e, unit: o.u });
      break;
    }
  }

  private buildStuff(): void {
    const sim = this.sim;
    const pop = sim.popOf(this.player);
    const centros = this.myBuildings(BuildingId.CentroUrbano);
    if (centros.length === 0) return;
    const c = centros[0];
    const cx = Math.round(sim.C.tx[c] / FP_ONE);
    const cy = Math.round(sim.C.ty[c] / FP_ONE);

    let quiere: BuildingId | null = null;
    if (pop.cap - pop.pop <= 2 && pop.cap < sim.players[this.player].popMax) quiere = BuildingId.Casa;
    else if (this.myBuildings(BuildingId.Cuartel).length === 0) quiere = BuildingId.Cuartel;
    else if (this.myBuildings(BuildingId.Caballerizas).length === 0) quiere = BuildingId.Caballerizas;
    if (quiere === null) return;

    const def = BUILDINGS[quiere];
    if (!sim.canAfford(this.player, def.cost)) return;
    // Ya hay una obra del mismo tipo empezada: no amontonar.
    for (const site of sim.builders.keys()) {
      if (sim.world.isAlive(site) && sim.C.typeId[entityIndex(site)] === quiere) return;
    }

    for (let r = 3; r < 16; r++) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const tx = cx + Math.round(Math.cos(ang) * r);
        const ty = cy + Math.round(Math.sin(ang) * r);
        if (!canPlace(sim, tx, ty, def.tileW, def.tileH)) continue;
        const libres = this.myUnits(UnitClass.Villager).filter((i) => sim.C.gatherState[i] !== GatherState.None).slice(0, 2);
        if (libres.length === 0) return;
        this.queue.push({
          t: 'build',
          player: this.player,
          units: libres.map((i) => sim.world.entityAt(i)),
          building: quiere,
          tx,
          ty,
        });
        return;
      }
    }
  }

  private manageArmy(): void {
    const sim = this.sim;
    const army = this.myUnits().filter((i) => sim.C.unitClass[i] !== UnitClass.Villager);
    if (army.length === 0) return;

    if (sim.tick < this.nextWave || army.length < this.p.waveSize) {
      // Reagrupar cerca del centro mientras se junta la oleada.
      const centros = this.myBuildings(BuildingId.CentroUrbano);
      if (centros.length === 0) return;
      const c = centros[0];
      this.rally = { x: sim.C.tx[c] / FP_ONE, y: sim.C.ty[c] / FP_ONE + 4 };
      const dispersos = army.filter((i) => {
        const dx = sim.C.tx[i] / FP_ONE - this.rally.x;
        const dy = sim.C.ty[i] / FP_ONE - this.rally.y;
        return dx * dx + dy * dy > 14 * 14 && sim.C.moveState[i] !== MoveState.Moving && sim.C.target[i] === 0xffffffff;
      });
      if (dispersos.length > 0) {
        this.queue.push({
          t: 'move',
          player: this.player,
          units: dispersos.map((i) => sim.world.entityAt(i)),
          x: fx(this.rally.x),
          y: fx(this.rally.y),
        });
      }
      return;
    }

    const objetivo = this.pickTarget();
    if (!objetivo) return;
    this.nextWave = sim.tick + this.p.waveEvery;
    this.queue.push({
      t: 'attackMove',
      player: this.player,
      units: army.map((i) => sim.world.entityAt(i)),
      x: objetivo.x,
      y: objetivo.y,
    });
    sim.emit({ t: 'oleada', player: this.player, tamano: army.length });
  }

  /** Objetivo de la oleada: el centro urbano enemigo mas cercano. */
  private pickTarget(): { x: number; y: number } | null {
    const sim = this.sim;
    const C = sim.C;
    const centros = this.myBuildings(BuildingId.CentroUrbano);
    const ox = centros.length > 0 ? C.tx[centros[0]] : 0;
    const oy = centros.length > 0 ? C.ty[centros[0]] : 0;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    sim.world.each(sim.mBuilding, (i) => {
      if (!sim.enemies(this.player, C.player[i])) return;
      const dx = C.tx[i] - ox;
      const dy = C.ty[i] - oy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = { x: C.tx[i], y: C.ty[i] };
      }
    });
    return best;
  }

  /**
   * Diplomacia de la IA. Una taifa exprimida acaba rompiendo la paria: no por
   * traicion, sino porque no puede pagarla y prefiere arriesgarse. Eso es
   * literalmente lo que hizo al-Mutamid en 1085.
   */
  private manageDiplomacy(): void {
    const sim = this.sim;
    const d = sim.diplomacy;
    for (const c of d.contractsOf(this.player)) {
      if (c.payer !== this.player) continue;
      const oro = sim.resourceOf(this.player, ResourceKind.Gold);
      if (oro < c.rate && c.missed >= 2) {
        this.queue.push({ t: 'breakParias', player: this.player, other: c.receiver });
        sim.emit({ t: 'taifaSeRebela', player: this.player, contra: c.receiver });
      }
    }
  }
}
