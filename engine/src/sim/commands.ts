import type { Entity } from '../ecs/world';
import type { Stance } from '../ecs/components';
import type { BuildingId, UnitId } from '../game/data';

/**
 * Ordenes. Es lo unico que entra en la simulacion desde fuera.
 *
 * Esta frontera no es estetica: en lockstep determinista lo unico que viaja
 * por la red son estas estructuras, nunca el estado. Si algun dia una parte
 * del juego modifica el mundo sin pasar por aqui, el multijugador esta
 * muerto antes de empezar.
 */
export type Command =
  | { t: 'move'; player: number; units: Entity[]; x: number; y: number }
  | { t: 'attackMove'; player: number; units: Entity[]; x: number; y: number }
  | { t: 'attack'; player: number; units: Entity[]; target: Entity }
  | { t: 'stop'; player: number; units: Entity[] }
  | { t: 'stance'; player: number; units: Entity[]; stance: Stance }
  | { t: 'gather'; player: number; units: Entity[]; node: Entity }
  | { t: 'build'; player: number; units: Entity[]; building: BuildingId; tx: number; ty: number }
  | { t: 'repair'; player: number; units: Entity[]; target: Entity }
  | { t: 'train'; player: number; building: Entity; unit: UnitId }
  | { t: 'cancelTrain'; player: number; building: Entity }
  | { t: 'demandParias'; player: number; from: number }
  | { t: 'breakParias'; player: number; other: number }
  | { t: 'offerTruce'; player: number; other: number }
  | { t: 'declareWar'; player: number; other: number };

export class CommandQueue {
  private pending: Command[] = [];

  push(c: Command): void {
    this.pending.push(c);
  }

  /** Devuelve y vacia. El orden de insercion es el orden de ejecucion. */
  drain(): Command[] {
    if (this.pending.length === 0) return EMPTY;
    const out = this.pending;
    this.pending = [];
    return out;
  }

  get size(): number {
    return this.pending.length;
  }
}

const EMPTY: Command[] = [];
