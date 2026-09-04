/// <reference lib="webworker" />
import { computeFlowField, UNREACHABLE } from './flowfield';
import { ClusterGraph } from './hpa';
import type { FieldMsg, FromWorker, ToWorker } from './protocol';

/**
 * Worker de rutas. El hilo principal nunca calcula un camino.
 *
 * Cola de trabajo con presupuesto: por cada mensaje se atienden peticiones
 * hasta agotar `BUDGET_MS`; el resto espera al siguiente turno. Asi una
 * rafaga de 20 ordenes simultaneas no bloquea el worker medio segundo.
 */

let width = 0;
let height = 0;
let cost: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
let graph: ClusterGraph | null = null;
let corridor = new Uint8Array(0);
let graphDirty = true;

const queue: Array<{ id: number; goals: Int32Array; fromTile: number }> = [];
const cancelled = new Set<number>();
const BUDGET_MS = 8;
let draining = false;

const post = (m: FromWorker, transfer: Transferable[] = []): void => {
  (self as unknown as Worker).postMessage(m, transfer);
};

function ensureGraph(): ClusterGraph {
  if (!graph) graph = new ClusterGraph(width, height);
  if (graphDirty) {
    graph.build(cost);
    graphDirty = false;
  }
  return graph;
}

function serve(job: { id: number; goals: Int32Array; fromTile: number }): void {
  const t0 = performance.now();
  const g = ensureGraph();
  const goals: number[] = [];
  for (let i = 0; i < job.goals.length; i++) goals.push(job.goals[i]);

  let mask: Uint8Array | null = null;
  let reachable = true;
  const fromCl = g.clusterOf(job.fromTile % width, (job.fromTile / width) | 0);
  const goalCl = g.clusterOf(goals[0] % width, (goals[0] / width) | 0);
  const route = g.route(fromCl, goalCl);
  if (route === null) {
    reachable = false;
  } else if (route.length * 16 * 16 * 3 < width * height) {
    // Solo vale la pena acotar si el pasillo es bastante menor que el mapa.
    if (corridor.length !== width * height) corridor = new Uint8Array(width * height);
    mask = g.corridorMask(route, corridor);
  }

  const field = computeFlowField(cost, width, height, goals, mask);
  if (reachable && field.dist[job.fromTile] === UNREACHABLE && mask) {
    // El pasillo se quedo corto (obstaculo nuevo). Reintento sin mascara:
    // mejor gastar un flujo completo que dejar a la unidad plantada.
    const full = computeFlowField(cost, width, height, goals, null);
    reply(job.id, goals[0], full.dir, full.dist, full.dist[job.fromTile] !== UNREACHABLE, performance.now() - t0);
    return;
  }
  reply(job.id, goals[0], field.dir, field.dist, reachable && field.dist[job.fromTile] !== UNREACHABLE, performance.now() - t0);
}

function reply(id: number, goal: number, dir: Uint8Array, dist: Uint16Array, reachable: boolean, ms: number): void {
  const msg: FieldMsg = { t: 'field', id, goal, dir, dist, reachable, ms };
  post(msg, [dir.buffer, dist.buffer]);
}

function drain(): void {
  if (draining) return;
  draining = true;
  const t0 = performance.now();
  while (queue.length > 0 && performance.now() - t0 < BUDGET_MS) {
    const job = queue.shift()!;
    if (cancelled.has(job.id)) {
      cancelled.delete(job.id);
      continue;
    }
    serve(job);
  }
  draining = false;
  if (queue.length > 0) setTimeout(drain, 0);
}

self.onmessage = (ev: MessageEvent<ToWorker>): void => {
  const m = ev.data;
  switch (m.t) {
    case 'init':
      width = m.width;
      height = m.height;
      cost = m.cost;
      graph = null;
      graphDirty = true;
      corridor = new Uint8Array(width * height);
      post({ t: 'ready' });
      break;
    case 'patch':
      for (let i = 0; i < m.cells.length; i++) cost[m.cells[i]] = m.values[i];
      graphDirty = true;
      break;
    case 'req':
      queue.push({ id: m.id, goals: m.goals, fromTile: m.fromTile });
      drain();
      break;
    case 'cancel':
      cancelled.add(m.id);
      break;
  }
};
