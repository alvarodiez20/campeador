import { computeFlowField, DIR_NONE, UNREACHABLE } from './flowfield';
import { ClusterGraph } from './hpa';
import type { FromWorker, RequestMsg } from './protocol';

/**
 * Cache de campos de flujo compartida por la simulacion.
 *
 * Un "campo" se identifica por su meta. Diez unidades enviadas a la misma
 * casilla comparten un unico campo; el contador de referencias decide cuando
 * se puede tirar. El id es un u16 porque vive en una columna del ECS.
 */

export interface Field {
  dir: Uint8Array;
  dist: Uint16Array;
  goal: number;
  ready: boolean;
  reachable: boolean;
  refs: number;
  stamp: number;
}

const MAX_FIELDS = 64;

export abstract class PathService {
  protected fields = new Map<number, Field>();
  protected byGoal = new Map<number, number>();
  protected nextId = 1;
  protected stamp = 0;
  /** Milisegundos del ultimo campo calculado; solo para el HUD. */
  lastMs = 0;
  pending = 0;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  /** Clave de cache: la primera casilla meta basta. */
  request(goals: Int32Array, fromTile: number): number {
    const key = goals[0];
    const existing = this.byGoal.get(key);
    if (existing !== undefined) {
      const f = this.fields.get(existing)!;
      f.refs++;
      f.stamp = ++this.stamp;
      return existing;
    }
    const id = this.allocId();
    const field: Field = {
      dir: new Uint8Array(0),
      dist: new Uint16Array(0),
      goal: key,
      ready: false,
      reachable: true,
      refs: 1,
      stamp: ++this.stamp,
    };
    this.fields.set(id, field);
    this.byGoal.set(key, id);
    this.pending++;
    this.dispatch({ t: 'req', id, goals, fromTile });
    return id;
  }

  release(id: number): void {
    const f = this.fields.get(id);
    if (!f) return;
    if (--f.refs <= 0) this.evictIfNeeded();
  }

  get(id: number): Field | undefined {
    return this.fields.get(id);
  }

  /** Direccion (0..7) o DIR_NONE si el campo no esta listo o no hay ruta. */
  dirAt(id: number, tile: number): number {
    const f = this.fields.get(id);
    if (!f || !f.ready) return DIR_NONE;
    return f.dir[tile];
  }

  distAt(id: number, tile: number): number {
    const f = this.fields.get(id);
    if (!f || !f.ready) return UNREACHABLE;
    return f.dist[tile];
  }

  protected accept(m: { id: number; goal: number; dir: Uint8Array; dist: Uint16Array; reachable: boolean; ms: number }): void {
    const f = this.fields.get(m.id);
    this.lastMs = m.ms;
    if (!f) return;
    f.dir = m.dir;
    f.dist = m.dist;
    f.ready = true;
    f.reachable = m.reachable;
    this.pending = Math.max(0, this.pending - 1);
  }

  /** Invalida todo: el mapa de costes cambio de forma no local. */
  invalidateAll(): void {
    for (const [id, f] of this.fields) {
      if (f.refs <= 0) {
        this.fields.delete(id);
        if (this.byGoal.get(f.goal) === id) this.byGoal.delete(f.goal);
      } else {
        f.ready = false;
        this.pending++;
        this.dispatch({ t: 'req', id, goals: Int32Array.of(f.goal), fromTile: f.goal });
      }
    }
  }

  private allocId(): number {
    let id = this.nextId++;
    if (this.nextId > 65535) this.nextId = 1;
    let guard = 0;
    while (this.fields.has(id) && guard++ < 65535) {
      id = this.nextId++;
      if (this.nextId > 65535) this.nextId = 1;
    }
    return id;
  }

  private evictIfNeeded(): void {
    if (this.fields.size <= MAX_FIELDS) return;
    let worstId = -1;
    let worstStamp = Infinity;
    for (const [id, f] of this.fields) {
      if (f.refs > 0) continue;
      if (f.stamp < worstStamp) {
        worstStamp = f.stamp;
        worstId = id;
      }
    }
    if (worstId >= 0) {
      const f = this.fields.get(worstId)!;
      this.fields.delete(worstId);
      if (this.byGoal.get(f.goal) === worstId) this.byGoal.delete(f.goal);
    }
  }

  abstract patch(cells: Int32Array, values: Uint8Array): void;
  protected abstract dispatch(req: RequestMsg): void;
  abstract dispose(): void;
}

/** Implementacion sobre Web Worker. Es la que usa el juego. */
export class WorkerPathService extends PathService {
  private worker: Worker;

  constructor(width: number, height: number, cost: Uint8Array) {
    super(width, height);
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      if (m.t === 'field') this.accept(m);
    };
    const copy = cost.slice();
    this.worker.postMessage({ t: 'init', width, height, cost: copy }, [copy.buffer]);
  }

  protected dispatch(req: RequestMsg): void {
    this.worker.postMessage(req);
  }

  patch(cells: Int32Array, values: Uint8Array): void {
    this.worker.postMessage({ t: 'patch', cells, values });
  }

  override dispose(): void {
    this.worker.terminate();
  }
}

/**
 * Implementacion sincrona en el mismo hilo. Existe para los tests y para el
 * banco de pruebas headless, no para el juego: bloquear el hilo principal con
 * un flujo de 128x128 es exactamente lo que se quiere evitar.
 */
export class InlinePathService extends PathService {
  private cost: Uint8Array;
  private graph: ClusterGraph;
  private corridor: Uint8Array;
  private graphDirty = true;

  constructor(width: number, height: number, cost: Uint8Array) {
    super(width, height);
    this.cost = cost.slice();
    this.graph = new ClusterGraph(width, height);
    this.corridor = new Uint8Array(width * height);
  }

  protected dispatch(req: RequestMsg): void {
    if (this.graphDirty) {
      this.graph.build(this.cost);
      this.graphDirty = false;
    }
    const t0 = Date.now();
    const goals: number[] = [];
    for (let i = 0; i < req.goals.length; i++) goals.push(req.goals[i]);
    const fromCl = this.graph.clusterOf(req.fromTile % this.width, (req.fromTile / this.width) | 0);
    const goalCl = this.graph.clusterOf(goals[0] % this.width, (goals[0] / this.width) | 0);
    const route = this.graph.route(fromCl, goalCl);
    let mask: Uint8Array | null = null;
    if (route !== null && route.length * 768 < this.width * this.height) {
      mask = this.graph.corridorMask(route, this.corridor);
    }
    let field = computeFlowField(this.cost, this.width, this.height, goals, mask);
    if (mask && field.dist[req.fromTile] === UNREACHABLE) {
      field = computeFlowField(this.cost, this.width, this.height, goals, null);
    }
    this.accept({
      id: req.id,
      goal: goals[0],
      dir: field.dir,
      dist: field.dist,
      reachable: route !== null && field.dist[req.fromTile] !== UNREACHABLE,
      ms: Date.now() - t0,
    });
  }

  patch(cells: Int32Array, values: Uint8Array): void {
    for (let i = 0; i < cells.length; i++) this.cost[cells[i]] = values[i];
    this.graphDirty = true;
  }

  override dispose(): void {
    /* nada que liberar */
  }
}
