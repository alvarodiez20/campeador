import { FP_SHIFT, type Fixed } from '../core/fixed';

/**
 * Rejilla de terreno. Una casilla mide exactamente FP_ONE unidades de mundo,
 * de modo que pasar de coordenada a casilla es un desplazamiento de bits.
 */

export const enum Tile {
  Grass = 0,
  Dirt = 1,
  Water = 2,
  Rock = 3,
  Road = 4,
  Field = 5,
  Marsh = 6,
}

/** Coste de transito por casilla. 0 = intransitable. */
const TILE_COST: Record<number, number> = {
  [Tile.Grass]: 10,
  [Tile.Dirt]: 10,
  [Tile.Water]: 0,
  [Tile.Rock]: 0,
  [Tile.Road]: 6,
  [Tile.Field]: 12,
  [Tile.Marsh]: 22,
};

export class Terrain {
  readonly tiles: Uint8Array;
  /** Coste efectivo: terreno + ocupacion por edificios. Es lo que ve el worker. */
  readonly cost: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.tiles = new Uint8Array(width * height);
    this.cost = new Uint8Array(width * height);
    this.cost.fill(10);
  }

  idx(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  setTile(tx: number, ty: number, t: Tile): void {
    if (!this.inBounds(tx, ty)) return;
    const i = this.idx(tx, ty);
    this.tiles[i] = t;
    this.cost[i] = TILE_COST[t] ?? 10;
  }

  /** Marca ocupacion (edificios, recursos solidos). 0 = bloqueado. */
  block(tx: number, ty: number): void {
    if (!this.inBounds(tx, ty)) return;
    this.cost[this.idx(tx, ty)] = 0;
  }

  unblock(tx: number, ty: number): void {
    if (!this.inBounds(tx, ty)) return;
    const i = this.idx(tx, ty);
    this.cost[i] = TILE_COST[this.tiles[i]] ?? 10;
  }

  walkable(tx: number, ty: number): boolean {
    return this.inBounds(tx, ty) && this.cost[this.idx(tx, ty)] > 0;
  }

  static tileOf(x: Fixed): number {
    return x >> FP_SHIFT;
  }

  /** Copia del mapa de costes, para enviar al worker sin compartir memoria. */
  snapshotCost(): Uint8Array {
    return this.cost.slice();
  }
}
