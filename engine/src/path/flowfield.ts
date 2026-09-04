/**
 * Campos de flujo (flow fields) sobre la rejilla de costes.
 *
 * Para mover 200 unidades al mismo sitio, calcular 200 rutas A* es tirar el
 * tiempo: la respuesta es la misma para todas. Un campo de flujo resuelve el
 * problema una sola vez y cada unidad solo lee la direccion de su casilla.
 *
 * El algoritmo es Dijkstra con cubetas (Dial): los costes son enteros
 * pequenos (6..22 por casilla), asi que una cola de prioridad por cubetas es
 * mas rapida que un monticulo y ademas es determinista sin desempates raros.
 */

export const DIR_NONE = 255;

/** Las 8 direcciones, en el mismo orden que `octant()` de core/fixed. */
export const DIR_DX = new Int8Array([1, 1, 0, -1, -1, -1, 0, 1]);
export const DIR_DY = new Int8Array([0, 1, 1, 1, 0, -1, -1, -1]);

/** Coste diagonal: sqrt(2) aproximado como 14/10. */
const DIAG_NUM = 14;
const DIAG_DEN = 10;

export const UNREACHABLE = 0xffff;

export interface FlowField {
  readonly width: number;
  readonly height: number;
  /** Direccion a seguir en cada casilla (indice 0..7) o DIR_NONE. */
  readonly dir: Uint8Array;
  /** Coste acumulado hasta la meta; UNREACHABLE si no se llega. */
  readonly dist: Uint16Array;
  readonly goal: number;
}

interface Scratch {
  dist: Uint16Array;
  dir: Uint8Array;
  buckets: Int32Array[];
  size: number;
}

const scratchByKey = new Map<number, Scratch>();

function getScratch(size: number): Scratch {
  let s = scratchByKey.get(size);
  if (!s) {
    s = { dist: new Uint16Array(size), dir: new Uint8Array(size), buckets: [], size };
    scratchByKey.set(size, s);
  }
  return s;
}

/**
 * Calcula el campo de flujo hacia `goals` (indices de casilla).
 *
 * @param mask si se pasa, solo se expanden casillas con mask[i] !== 0. Es la
 *   via por la que el A* jerarquico acota la busqueda a un corredor de
 *   clusteres en vez de inundar el mapa entero.
 */
export function computeFlowField(
  cost: Uint8Array,
  width: number,
  height: number,
  goals: readonly number[],
  mask?: Uint8Array | null,
): FlowField {
  const size = width * height;
  const s = getScratch(size);
  const dist = s.dist;
  const dir = s.dir;
  dist.fill(UNREACHABLE);
  dir.fill(DIR_NONE);

  // Dial: el salto maximo de un arco es 255*14/10 = 357; 512 cubetas sobran.
  const NB = 512;
  let buckets = s.buckets;
  if (buckets.length !== NB) {
    buckets = [];
    for (let i = 0; i < NB; i++) buckets.push(new Int32Array(0));
    s.buckets = buckets;
  }
  const lens = new Int32Array(NB);
  const push = (bucket: number, node: number): void => {
    const b = bucket % NB;
    let arr = buckets[b];
    if (lens[b] >= arr.length) {
      const next = new Int32Array(Math.max(64, arr.length * 2));
      next.set(arr);
      buckets[b] = arr = next;
    }
    arr[lens[b]++] = node;
  };

  let remaining = 0;
  for (const g of goals) {
    if (g < 0 || g >= size) continue;
    if (cost[g] === 0) continue;
    if (dist[g] === 0) continue;
    dist[g] = 0;
    push(0, g);
    remaining++;
  }

  let current = 0;
  const maxDist = UNREACHABLE - 1;
  while (remaining > 0 && current <= maxDist) {
    const b = current % NB;
    if (lens[b] === 0) {
      current++;
      continue;
    }
    const node = buckets[b][--lens[b]];
    remaining--;
    if (dist[node] !== current) continue; // entrada obsoleta

    const nx = node % width;
    const ny = (node / width) | 0;
    for (let k = 0; k < 8; k++) {
      const ax = nx + DIR_DX[k];
      const ay = ny + DIR_DY[k];
      if (ax < 0 || ay < 0 || ax >= width || ay >= height) continue;
      const ni = ay * width + ax;
      const c = cost[ni];
      if (c === 0) continue;
      if (mask && mask[ni] === 0) continue;
      const diagonal = (k & 1) === 1;
      if (diagonal) {
        // No cortar esquinas: ambas ortogonales adyacentes deben estar libres.
        if (cost[ny * width + ax] === 0 || cost[ay * width + nx] === 0) continue;
      }
      const step = diagonal ? ((c * DIAG_NUM) / DIAG_DEN) | 0 : c;
      const nd = current + step;
      if (nd < dist[ni] && nd < maxDist) {
        dist[ni] = nd;
        // La direccion apunta *hacia* la meta, es decir, de vuelta al padre.
        dir[ni] = (k + 4) & 7;
        push(nd, ni);
        remaining++;
      }
    }
  }
  for (let i = 0; i < NB; i++) lens[i] = 0;

  return {
    width,
    height,
    dir: dir.slice(),
    dist: dist.slice(),
    goal: goals.length > 0 ? goals[0] : -1,
  };
}
