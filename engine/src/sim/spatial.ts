import { FP_SHIFT } from '../core/fixed';

/**
 * Particionado espacial: rejilla uniforme reconstruida por tick mediante
 * counting sort. Sin listas enlazadas ni asignaciones: dos arrays y un
 * prefijo de sumas. Con 2.000 entidades reconstruirla cuesta menos que
 * mantenerla incrementalmente, y ademas es determinista (el orden dentro de
 * cada celda solo depende del orden de indices, no del historico).
 */
export class SpatialGrid {
  readonly cellShift: number;
  readonly cellsX: number;
  readonly cellsY: number;
  private readonly starts: Int32Array;
  private readonly counts: Int32Array;
  private items: Int32Array;
  private cursor: Int32Array;
  private n = 0;

  /** @param cellTiles ancho de celda en casillas; potencia de 2. */
  constructor(tilesX: number, tilesY: number, cellTiles = 4, capacity = 4096) {
    const shiftExtra = Math.log2(cellTiles);
    if (!Number.isInteger(shiftExtra)) throw new Error('cellTiles debe ser potencia de 2');
    this.cellShift = FP_SHIFT + shiftExtra;
    this.cellsX = Math.ceil(tilesX / cellTiles) + 1;
    this.cellsY = Math.ceil(tilesY / cellTiles) + 1;
    const cells = this.cellsX * this.cellsY;
    this.starts = new Int32Array(cells + 1);
    this.counts = new Int32Array(cells);
    this.cursor = new Int32Array(cells);
    this.items = new Int32Array(capacity);
  }

  cellOf(x: number, y: number): number {
    let cx = x >> this.cellShift;
    let cy = y >> this.cellShift;
    if (cx < 0) cx = 0;
    else if (cx >= this.cellsX) cx = this.cellsX - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.cellsY) cy = this.cellsY - 1;
    return cy * this.cellsX + cx;
  }

  /**
   * Reconstruye la rejilla. `indices` son indices de entidad y `xs`/`ys` sus
   * posiciones (columnas del ECS).
   */
  rebuild(indices: Int32Array, count: number, xs: Int32Array, ys: Int32Array): void {
    this.counts.fill(0);
    if (this.items.length < count) this.items = new Int32Array(count * 2);
    for (let k = 0; k < count; k++) {
      const i = indices[k];
      this.counts[this.cellOf(xs[i], ys[i])]++;
    }
    let acc = 0;
    for (let c = 0; c < this.counts.length; c++) {
      this.starts[c] = acc;
      this.cursor[c] = acc;
      acc += this.counts[c];
    }
    this.starts[this.counts.length] = acc;
    for (let k = 0; k < count; k++) {
      const i = indices[k];
      const c = this.cellOf(xs[i], ys[i]);
      this.items[this.cursor[c]++] = i;
    }
    this.n = count;
  }

  get size(): number {
    return this.n;
  }

  /**
   * Recorre las entidades cuyo centro cae en el rectangulo de celdas que
   * cubre el radio dado. No filtra por distancia exacta: eso lo hace quien
   * llama, que ya conoce sus radios.
   */
  query(x: number, y: number, radius: number, fn: (index: number) => void): void {
    const cs = 1 << this.cellShift;
    const minCx = Math.max(0, (x - radius) / cs >> 0) | 0;
    const maxCx = Math.min(this.cellsX - 1, ((x + radius) / cs) | 0);
    const minCy = Math.max(0, (y - radius) / cs >> 0) | 0;
    const maxCy = Math.min(this.cellsY - 1, ((y + radius) / cs) | 0);
    for (let cy = minCy; cy <= maxCy; cy++) {
      const row = cy * this.cellsX;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const c = row + cx;
        const end = this.starts[c + 1];
        for (let k = this.starts[c]; k < end; k++) fn(this.items[k]);
      }
    }
  }

  /** Variante sin closure para los bucles calientes (vecinos 3x3). */
  forEachNeighbor(x: number, y: number, out: Int32Array): number {
    const cx = Math.min(this.cellsX - 1, Math.max(0, x >> this.cellShift));
    const cy = Math.min(this.cellsY - 1, Math.max(0, y >> this.cellShift));
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= this.cellsY) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= this.cellsX) continue;
        const c = ny * this.cellsX + nx;
        const end = this.starts[c + 1];
        for (let k = this.starts[c]; k < end && n < out.length; k++) out[n++] = this.items[k];
      }
    }
    return n;
  }
}
