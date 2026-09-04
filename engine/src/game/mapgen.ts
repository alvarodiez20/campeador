import type { Rng } from '../core/rng';
import { ResourceKind } from '../ecs/components';
import type { Simulation } from '../sim/sim';
import { Tile } from '../sim/terrain';

/**
 * Generacion de terreno. Nada de ruido fractal ni biomas: manchas y un rio.
 * El mapa del slice es uno solo y esta escrito a mano en el escenario; esto
 * son las brochas con las que se pinta.
 */

export function fill(sim: Simulation, t: Tile): void {
  const { width, height } = sim.terrain;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) sim.terrain.setTile(x, y, t);
}

export function rect(sim: Simulation, x0: number, y0: number, w: number, h: number, t: Tile): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) sim.terrain.setTile(x, y, t);
}

export function disc(sim: Simulation, cx: number, cy: number, r: number, t: Tile): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) sim.terrain.setTile(x, y, t);
    }
  }
}

/** Rio serpenteante de oeste a este. Determinista si el Rng lo es. */
export function river(sim: Simulation, rng: Rng, yStart: number, width: number): void {
  let y = yStart;
  for (let x = 0; x < sim.terrain.width; x++) {
    y += rng.range(-1, 1);
    y = Math.max(2, Math.min(sim.terrain.height - 3, y));
    const w = width + rng.range(0, 1);
    for (let d = -w; d <= w; d++) sim.terrain.setTile(x, y + d, Tile.Water);
  }
}

/** Camino recto entre dos puntos (Bresenham). */
export function road(sim: Simulation, x0: number, y0: number, x1: number, y1: number, w = 1): void {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 4096; guard++) {
    for (let oy = -w; oy <= w; oy++) {
      for (let ox = -w; ox <= w; ox++) {
        if (sim.terrain.inBounds(x + ox, y + oy) && sim.terrain.tiles[sim.terrain.idx(x + ox, y + oy)] !== Tile.Water) {
          sim.terrain.setTile(x + ox, y + oy, Tile.Road);
        }
      }
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export interface ClusterSpec {
  kind: ResourceKind;
  cx: number;
  cy: number;
  count: number;
  spread: number;
  amount: number;
  blocks: boolean;
}

export function resourceCluster(sim: Simulation, rng: Rng, s: ClusterSpec): void {
  let placed = 0;
  let guard = 0;
  while (placed < s.count && guard++ < s.count * 40) {
    const tx = s.cx + rng.range(-s.spread, s.spread);
    const ty = s.cy + rng.range(-s.spread, s.spread);
    if (!sim.terrain.walkable(tx, ty)) continue;
    sim.spawnNode(s.kind, tx, ty, s.amount, s.blocks);
    placed++;
  }
}
