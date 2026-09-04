import { fx } from '../core/fixed';
import type { Rng } from '../core/rng';
import { Stance } from '../ecs/components';
import { entityIndex } from '../ecs/world';
import { FactionId, UnitId } from './data';
import { disc, fill, rect } from './mapgen';
import { CommandQueue } from '../sim/commands';
import { Simulation } from '../sim/sim';
import { Tile } from '../sim/terrain';

/**
 * Banco de pruebas: el criterio de aceptacion tecnico del proyecto.
 *
 *   500 unidades moviendose a la vez, con pathfinding y colision, a 60 fps
 *   estables, dibujadas como cubos de colores.
 *
 * Hasta que esto pase, no se produce ni un solo sprite. El banco no es una
 * demo bonita: es la puerta que decide si el stack elegido aguanta o hay que
 * replantear hacia 3D antes de gastar un mes en arte.
 *
 * Lo que se mide de verdad esta en el HUD: fps, milisegundos de simulacion
 * por tick, milisegundos de render por frame y peticiones de ruta en cola.
 * Un fps alto con 30 ms de tick no es un aprobado, es un acumulador que
 * todavia no ha reventado.
 */

export interface BenchOptions {
  units: number;
  mapSize: number;
  /** Si es true, se enfrentan dos bandos y ademas hay combate. */
  combat: boolean;
  /** Ticks entre reordenes masivas. */
  orderEvery: number;
  obstacles: boolean;
}

export const BENCH_DEFAULTS: BenchOptions = {
  units: 500,
  mapSize: 128,
  combat: false,
  orderEvery: 15 * 8,
  obstacles: true,
};

export class Benchmark {
  readonly sim: Simulation;
  readonly queue = new CommandQueue();
  private next = 30;
  private rng: Rng;

  constructor(readonly opts: BenchOptions = BENCH_DEFAULTS) {
    this.sim = new Simulation({
      width: opts.mapSize,
      height: opts.mapSize,
      seed: 0xbe4c,
      players: [
        { faction: FactionId.HuesteDelCid, team: 1, name: 'Azules' },
        { faction: FactionId.Almoravides, team: opts.combat ? 2 : 1, name: 'Ocres' },
      ],
    });
    this.rng = this.sim.rng;

    fill(this.sim, Tile.Grass);
    rect(this.sim, 0, 0, opts.mapSize, 3, Tile.Rock);
    if (opts.obstacles) {
      // Obstaculos que obligan al pathfinding a trabajar de verdad: sin
      // ellos, medir el flow field no significa nada.
      for (let k = 0; k < 26; k++) {
        const cx = this.rng.range(8, opts.mapSize - 8);
        const cy = this.rng.range(8, opts.mapSize - 8);
        disc(this.sim, cx, cy, this.rng.range(3, 7), Tile.Rock);
      }
      // Un muro con dos puertas, el caso peor del movimiento en grupo.
      const mid = opts.mapSize >> 1;
      for (let y = 4; y < opts.mapSize - 4; y++) {
        if (Math.abs(y - mid) < 3 || Math.abs(y - mid + 30) < 3) continue;
        this.sim.terrain.setTile(mid, y, Tile.Rock);
      }
    }

    const half = Math.floor(opts.units / 2);
    const tipos = [UnitId.Infante, UnitId.Lancero, UnitId.Caballero, UnitId.Ballestero];
    for (let n = 0; n < opts.units; n++) {
      const azul = n < half;
      const player = azul ? 0 : 1;
      const bx = azul ? 12 : opts.mapSize - 12;
      const x = bx + (n % 14) - 7;
      const y = 14 + Math.floor((n % (opts.units / 2)) / 14);
      const e = this.sim.spawnUnit(player, tipos[n % tipos.length], fx(x), fx(Math.min(opts.mapSize - 6, y)));
      if (!opts.combat) {
        // Sin combate: postura de no atacar, para medir solo movimiento.
        this.sim.C.stance[entityIndex(e)] = Stance.StandGround;
      }
    }
    this.sim.players[0].popMax = 1000;
    this.sim.players[1].popMax = 1000;
  }

  /** Da ordenes de movimiento masivas cada cierto tiempo. */
  update(): void {
    if (this.sim.tick < this.next) return;
    this.next = this.sim.tick + this.opts.orderEvery;
    const size = this.opts.mapSize;
    for (const player of [0, 1]) {
      const units: number[] = [];
      const C = this.sim.C;
      this.sim.world.each(this.sim.mUnit, (i) => {
        if (C.player[i] === player) units.push(i);
      });
      if (units.length === 0) continue;
      const tx = this.rng.range(6, size - 6);
      const ty = this.rng.range(6, size - 6);
      this.queue.push({
        t: this.opts.combat ? 'attackMove' : 'move',
        player,
        units: units.map((i) => this.sim.world.entityAt(i)),
        x: fx(tx),
        y: fx(ty),
      });
    }
  }
}

/** Lee la configuracion del banco de la barra de direcciones. */
export function benchOptionsFromUrl(params: URLSearchParams): BenchOptions {
  return {
    units: clampInt(params.get('n'), BENCH_DEFAULTS.units, 10, 4000),
    mapSize: clampInt(params.get('mapa'), BENCH_DEFAULTS.mapSize, 32, 256),
    combat: params.get('combate') === '1',
    orderEvery: clampInt(params.get('ordenes'), BENCH_DEFAULTS.orderEvery, 15, 3000),
    obstacles: params.get('obstaculos') !== '0',
  };
}

function clampInt(v: string | null, def: number, lo: number, hi: number): number {
  const n = v === null ? NaN : parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}
