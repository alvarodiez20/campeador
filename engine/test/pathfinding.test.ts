import { describe, expect, it } from 'vitest';
import { DIR_DX, DIR_DY, DIR_NONE, UNREACHABLE, computeFlowField } from '../src/path/flowfield';
import { CLUSTER_SIZE, ClusterGraph } from '../src/path/hpa';
import { InlinePathService } from '../src/path/service';

function gridConMuro(w: number, h: number, muroX: number, puertaY: number): Uint8Array {
  const cost = new Uint8Array(w * h).fill(10);
  for (let y = 0; y < h; y++) {
    if (y === puertaY || y === puertaY + 1) continue;
    cost[y * w + muroX] = 0;
  }
  return cost;
}

/** Sigue el campo desde una casilla hasta la meta y devuelve los pasos. */
function seguir(dir: Uint8Array, w: number, h: number, from: number, goal: number, max = 4000): number {
  let cur = from;
  let pasos = 0;
  while (cur !== goal && pasos < max) {
    const d = dir[cur];
    if (d === DIR_NONE) return -1;
    const x = (cur % w) + DIR_DX[d];
    const y = ((cur / w) | 0) + DIR_DY[d];
    if (x < 0 || y < 0 || x >= w || y >= h) return -1;
    cur = y * w + x;
    pasos++;
  }
  return cur === goal ? pasos : -1;
}

describe('campo de flujo', () => {
  it('lleva a la meta en un mapa despejado', () => {
    const w = 32;
    const h = 32;
    const cost = new Uint8Array(w * h).fill(10);
    const goal = 20 * w + 25;
    const f = computeFlowField(cost, w, h, [goal]);
    expect(seguir(f.dir, w, h, 3 * w + 2, goal)).toBeGreaterThan(0);
    expect(f.dist[goal]).toBe(0);
  });

  it('rodea un muro y pasa por la puerta', () => {
    const w = 40;
    const h = 40;
    const cost = gridConMuro(w, h, 20, 30);
    const goal = 20 * w + 35;
    const f = computeFlowField(cost, w, h, [goal]);
    const inicio = 20 * w + 4;
    expect(seguir(f.dir, w, h, inicio, goal)).toBeGreaterThan(0);
    // El rodeo se nota en el coste, no en el numero de pasos: las diagonales
    // mantienen la cuenta de pasos pero cuestan 14 en vez de 10.
    const libre = computeFlowField(new Uint8Array(w * h).fill(10), w, h, [goal]);
    expect(f.dist[inicio]).toBeGreaterThan(libre.dist[inicio]);
  });

  it('marca como inalcanzable lo que esta al otro lado de un muro cerrado', () => {
    const w = 24;
    const h = 24;
    const cost = new Uint8Array(w * h).fill(10);
    for (let y = 0; y < h; y++) cost[y * w + 12] = 0;
    const goal = 12 * w + 20;
    const f = computeFlowField(cost, w, h, [goal]);
    expect(f.dist[12 * w + 3]).toBe(UNREACHABLE);
    expect(f.dir[12 * w + 3]).toBe(DIR_NONE);
  });

  it('no corta esquinas entre dos obstaculos en diagonal', () => {
    const w = 8;
    const h = 8;
    const cost = new Uint8Array(w * h).fill(10);
    // Bloqueo en (4,3) y (3,4): pasar de (3,3) a (4,4) seria colarse.
    cost[3 * w + 4] = 0;
    cost[4 * w + 3] = 0;
    const goal = 4 * w + 4;
    const f = computeFlowField(cost, w, h, [goal]);
    // (3,3) no puede alcanzar la meta cruzando la esquina; solo dando la
    // vuelta, que aqui esta cerrado por los bordes del hueco.
    const d = f.dist[3 * w + 3];
    const directo = 14;
    expect(d === UNREACHABLE || d > directo).toBe(true);
  });

  it('acepta varias casillas meta (un edificio ancho)', () => {
    const w = 24;
    const h = 24;
    const cost = new Uint8Array(w * h).fill(10);
    const goals = [10 * w + 10, 10 * w + 11, 11 * w + 10, 11 * w + 11];
    const f = computeFlowField(cost, w, h, goals);
    for (const g of goals) expect(f.dist[g]).toBe(0);
  });

  it('respeta el coste del terreno: prefiere el camino barato', () => {
    const w = 20;
    const h = 5;
    const cost = new Uint8Array(w * h).fill(22); // marjal
    for (let x = 0; x < w; x++) cost[2 * w + x] = 6; // camino
    const f = computeFlowField(cost, w, h, [2 * w + (w - 1)]);
    // Desde el marjal, el campo empuja hacia la fila del camino.
    const start = 0 * w + 1;
    const d = f.dir[start];
    expect(d).not.toBe(DIR_NONE);
    expect(DIR_DY[d]).toBeGreaterThanOrEqual(0);
  });
});

describe('A* jerarquico', () => {
  it('encuentra un pasillo de clusteres y lo devuelve conectado', () => {
    const w = 64;
    const h = 64;
    const cost = new Uint8Array(w * h).fill(10);
    const g = new ClusterGraph(w, h);
    g.build(cost);
    const from = g.clusterOf(2, 2);
    const to = g.clusterOf(60, 60);
    const route = g.route(from, to);
    expect(route).not.toBeNull();
    expect(route![0]).toBe(from);
    expect(route![route!.length - 1]).toBe(to);
    for (let i = 1; i < route!.length; i++) {
      const a = route![i - 1];
      const b = route![i];
      const dx = Math.abs((a % g.cx) - (b % g.cx));
      const dy = Math.abs(((a / g.cx) | 0) - ((b / g.cx) | 0));
      expect(dx + dy).toBe(1);
    }
  });

  it('devuelve null si no hay conexion', () => {
    const w = 64;
    const h = 64;
    const cost = new Uint8Array(w * h).fill(10);
    for (let y = 0; y < h; y++) cost[y * w + 32] = 0;
    const g = new ClusterGraph(w, h);
    g.build(cost);
    expect(g.route(g.clusterOf(4, 4), g.clusterOf(60, 60))).toBeNull();
  });

  it('la mascara del pasillo cubre todos sus clusteres', () => {
    const w = 64;
    const h = 64;
    const cost = new Uint8Array(w * h).fill(10);
    const g = new ClusterGraph(w, h);
    g.build(cost);
    const route = g.route(g.clusterOf(2, 2), g.clusterOf(60, 30))!;
    const mask = g.corridorMask(route, new Uint8Array(w * h));
    for (let i = 0; i < route.length; i++) {
      const cx = (route[i] % g.cx) * CLUSTER_SIZE;
      const cy = ((route[i] / g.cx) | 0) * CLUSTER_SIZE;
      expect(mask[cy * w + cx]).toBe(1);
    }
  });
});

describe('servicio de rutas', () => {
  it('comparte el campo entre peticiones a la misma meta', () => {
    const w = 32;
    const h = 32;
    const cost = new Uint8Array(w * h).fill(10);
    const svc = new InlinePathService(w, h, cost);
    const a = svc.request(Int32Array.of(10 * w + 10), 0);
    const b = svc.request(Int32Array.of(10 * w + 10), 5);
    expect(a).toBe(b);
    expect(svc.get(a)!.refs).toBe(2);
  });

  it('devuelve direcciones utiles una vez resuelto', () => {
    const w = 32;
    const h = 32;
    const cost = new Uint8Array(w * h).fill(10);
    const svc = new InlinePathService(w, h, cost);
    const goal = 10 * w + 10;
    const id = svc.request(Int32Array.of(goal), 0);
    expect(svc.get(id)!.ready).toBe(true);
    expect(svc.dirAt(id, 0)).not.toBe(DIR_NONE);
    expect(svc.distAt(id, goal)).toBe(0);
  });

  it('un parche de coste cierra el paso', () => {
    const w = 24;
    const h = 24;
    const cost = new Uint8Array(w * h).fill(10);
    const svc = new InlinePathService(w, h, cost);
    const cells: number[] = [];
    for (let y = 0; y < h; y++) cells.push(y * w + 12);
    svc.patch(Int32Array.from(cells), new Uint8Array(cells.length));
    const id = svc.request(Int32Array.of(12 * w + 20), 12 * w + 3);
    expect(svc.get(id)!.reachable).toBe(false);
  });
});
