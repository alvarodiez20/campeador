import { InlinePathService } from '../src/path/service';
import { Simulation, type SimOptions } from '../src/sim/sim';

/** Hash del estado de la simulacion. Es lo que detecta una desincronizacion. */
export function hashState(sim: Simulation): number {
  const C = sim.C;
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    h ^= v | 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  mix(sim.tick);
  const w = sim.world;
  for (let i = 1; i < w.highWater; i++) {
    if (w.alive[i] !== 1) continue;
    mix(i);
    mix(w.mask[i]);
    mix(C.tx[i]);
    mix(C.ty[i]);
    mix(C.hp[i]);
    mix(C.player[i]);
    mix(C.nodeAmount[i]);
    mix(C.buildProgress[i]);
  }
  for (const p of sim.players) {
    for (let k = 0; k < 4; k++) mix(p.resources[k]);
    mix(p.pop);
    mix(p.popCap);
  }
  mix(sim.diplomacy.presionAlmoravide);
  return h >>> 0;
}

export function withInlinePath(sim: Simulation): Simulation {
  sim.attachPath(new InlinePathService(sim.terrain.width, sim.terrain.height, sim.terrain.cost));
  return sim;
}

export function makeSim(opts: SimOptions): Simulation {
  return withInlinePath(new Simulation(opts));
}
