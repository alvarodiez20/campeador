/**
 * A* jerarquico (HPA*) sobre clusteres de 16x16 casillas.
 *
 * El campo de flujo inunda el mapa; en un mapa grande eso es caro y ademas
 * innecesario, porque la ruta pasa por un pasillo estrecho de clusteres. El
 * grafo abstracto se recorre con A* en microsegundos y devuelve ese pasillo,
 * que luego se usa como mascara para acotar el flujo.
 *
 * Simplificacion consciente: los nodos abstractos son clusteres enteros, no
 * portales individuales. Pierde algo de precision en mapas laberinticos, pero
 * el pasillo resultante siempre contiene la ruta optima porque cualquier ruta
 * atraviesa una secuencia de clusteres adyacentes conectados. Ver docs/DEUDA.md.
 */

export const CLUSTER_SIZE = 16;

export class ClusterGraph {
  readonly cx: number;
  readonly cy: number;
  /** Numero de casillas transitables por cluster; 0 = cluster muerto. */
  readonly openCount: Int32Array;
  /** Coste medio de transito por cluster (para la heuristica). */
  readonly avgCost: Uint8Array;
  /** Conectividad entre clusteres vecinos: bit por direccion ortogonal. */
  readonly links: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cx = Math.ceil(width / CLUSTER_SIZE);
    this.cy = Math.ceil(height / CLUSTER_SIZE);
    this.openCount = new Int32Array(this.cx * this.cy);
    this.avgCost = new Uint8Array(this.cx * this.cy);
    this.links = new Uint8Array(this.cx * this.cy);
  }

  clusterOf(tx: number, ty: number): number {
    return ((ty / CLUSTER_SIZE) | 0) * this.cx + ((tx / CLUSTER_SIZE) | 0);
  }

  /** Reconstruye el grafo a partir del mapa de costes. O(w*h). */
  build(cost: Uint8Array): void {
    this.openCount.fill(0);
    this.links.fill(0);
    const sum = new Int32Array(this.cx * this.cy);
    for (let ty = 0; ty < this.height; ty++) {
      for (let tx = 0; tx < this.width; tx++) {
        const c = cost[ty * this.width + tx];
        if (c === 0) continue;
        const cl = this.clusterOf(tx, ty);
        this.openCount[cl]++;
        sum[cl] += c;
      }
    }
    for (let i = 0; i < sum.length; i++) {
      this.avgCost[i] = this.openCount[i] > 0 ? Math.min(255, (sum[i] / this.openCount[i]) | 0) : 255;
    }
    // Enlaces: existe conexion si hay al menos una pareja de casillas
    // transitables a ambos lados de la frontera.
    for (let ty = 0; ty < this.height; ty++) {
      for (let tx = 0; tx < this.width; tx++) {
        const i = ty * this.width + tx;
        if (cost[i] === 0) continue;
        const cl = this.clusterOf(tx, ty);
        if (tx + 1 < this.width && cost[i + 1] > 0) {
          const nb = this.clusterOf(tx + 1, ty);
          if (nb !== cl) {
            this.links[cl] |= 1; // este
            this.links[nb] |= 4; // oeste
          }
        }
        if (ty + 1 < this.height && cost[i + this.width] > 0) {
          const nb = this.clusterOf(tx, ty + 1);
          if (nb !== cl) {
            this.links[cl] |= 2; // sur
            this.links[nb] |= 8; // norte
          }
        }
      }
    }
  }

  neighbors(cl: number, out: Int32Array): number {
    let n = 0;
    const l = this.links[cl];
    const x = cl % this.cx;
    const y = (cl / this.cx) | 0;
    if (l & 1 && x + 1 < this.cx) out[n++] = cl + 1;
    if (l & 4 && x > 0) out[n++] = cl - 1;
    if (l & 2 && y + 1 < this.cy) out[n++] = cl + this.cx;
    if (l & 8 && y > 0) out[n++] = cl - this.cx;
    return n;
  }

  /**
   * A* de cluster a cluster. Devuelve la lista de clusteres del pasillo, o
   * null si no hay conexion (la unidad ni siquiera intentara moverse).
   */
  route(fromCl: number, toCl: number): Int32Array | null {
    const n = this.cx * this.cy;
    if (fromCl < 0 || toCl < 0 || fromCl >= n || toCl >= n) return null;
    if (this.openCount[fromCl] === 0 || this.openCount[toCl] === 0) return null;
    if (fromCl === toCl) return Int32Array.of(fromCl);

    const g = new Int32Array(n).fill(0x7fffffff);
    const came = new Int32Array(n).fill(-1);
    const open: number[] = [fromCl];
    const f = new Int32Array(n).fill(0x7fffffff);
    g[fromCl] = 0;
    f[fromCl] = this.heuristic(fromCl, toCl);
    const nb = new Int32Array(4);
    const closed = new Uint8Array(n);

    while (open.length > 0) {
      // Seleccion lineal del minimo: con <= 1.000 clusteres es mas rapido
      // que mantener un monticulo, y no introduce desempates dependientes
      // del orden de insercion.
      let bestK = 0;
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bestK]]) bestK = k;
      const cur = open[bestK];
      open[bestK] = open[open.length - 1];
      open.pop();
      if (cur === toCl) break;
      if (closed[cur]) continue;
      closed[cur] = 1;

      const cnt = this.neighbors(cur, nb);
      for (let k = 0; k < cnt; k++) {
        const next = nb[k];
        if (closed[next]) continue;
        const step = CLUSTER_SIZE * this.avgCost[next];
        const ng = g[cur] + step;
        if (ng < g[next]) {
          g[next] = ng;
          came[next] = cur;
          f[next] = ng + this.heuristic(next, toCl);
          open.push(next);
        }
      }
    }

    if (came[toCl] === -1 && toCl !== fromCl) return null;
    const path: number[] = [];
    let c = toCl;
    let guard = 0;
    while (c !== -1 && guard++ < n) {
      path.push(c);
      if (c === fromCl) break;
      c = came[c];
    }
    if (path[path.length - 1] !== fromCl) return null;
    path.reverse();
    return Int32Array.from(path);
  }

  private heuristic(a: number, b: number): number {
    const ax = a % this.cx;
    const ay = (a / this.cx) | 0;
    const bx = b % this.cx;
    const by = (b / this.cx) | 0;
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    // Chebyshev * coste minimo por cluster: admisible.
    return Math.max(dx, dy) * CLUSTER_SIZE * 6;
  }

  /**
   * Mascara de casillas del pasillo, dilatada un cluster para que el flujo
   * pueda rodear obstaculos pegados a la frontera.
   */
  corridorMask(route: Int32Array, out: Uint8Array): Uint8Array {
    out.fill(0);
    const mark = (cl: number): void => {
      const clx = (cl % this.cx) * CLUSTER_SIZE;
      const cly = ((cl / this.cx) | 0) * CLUSTER_SIZE;
      const ex = Math.min(this.width, clx + CLUSTER_SIZE);
      const ey = Math.min(this.height, cly + CLUSTER_SIZE);
      for (let ty = cly; ty < ey; ty++) {
        const row = ty * this.width;
        for (let tx = clx; tx < ex; tx++) out[row + tx] = 1;
      }
    };
    const nb = new Int32Array(4);
    for (let i = 0; i < route.length; i++) {
      mark(route[i]);
      const cnt = this.neighbors(route[i], nb);
      for (let k = 0; k < cnt; k++) mark(nb[k]);
    }
    return out;
  }
}
