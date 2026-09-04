import { FP_ONE, FP_SHIFT, atan2B, fx, isqrt } from '../../core/fixed';
import { MoveState } from '../../ecs/components';
import { DIR_DX, DIR_DY, DIR_NONE } from '../../path/flowfield';
import type { Simulation } from '../sim';

/**
 * Movimiento: seguir el campo de flujo + evitacion local.
 *
 * La direccion global la da el flow field (calculada en el worker). Encima va
 * una capa de separacion tipo boids que resuelve el amontonamiento entre
 * unidades vecinas. Es mas barata que RVO y, para un RTS con radios
 * parecidos, se nota poco la diferencia; si el empuje entre grupos grandes
 * resulta feo, el sitio donde cambiarlo es esta funcion y solo esta.
 *
 * Todo en enteros: ni un float en la ruta de datos.
 */

const NEIGHBOR_BUF = new Int32Array(64);

/** Radio de llegada: a menos de esto de la meta, la unidad se da por llegada. */
const ARRIVE = fx(0.45);
/** Peso de la separacion respecto a la direccion de flujo (sobre 256). */
const SEPARATION_W = 190;

export function movementSystem(sim: Simulation): void {
  const C = sim.C;
  const { terrain, grid, path } = sim;
  const w = terrain.width;
  const { idx, count } = sim.collect(sim.mMover);

  for (let k = 0; k < count; k++) {
    const i = idx[k];
    if (C.moveState[i] !== MoveState.Moving) {
      C.vx[i] = 0;
      C.vy[i] = 0;
      continue;
    }

    const x = C.tx[i];
    const y = C.ty[i];
    const gx = C.goalX[i];
    const gy = C.goalY[i];
    const ddx = gx - x;
    const ddy = gy - y;

    // Llegada.
    if (isqrt(ddx * ddx + ddy * ddy) <= ARRIVE) {
      arrive(sim, i);
      continue;
    }

    // Direccion global.
    let dx = 0;
    let dy = 0;
    const tile = (y >> FP_SHIFT) * w + (x >> FP_SHIFT);
    const fid = C.flowId[i];
    let dir = DIR_NONE;
    if (fid !== 0 && path) dir = path.dirAt(fid, tile);
    if (dir !== DIR_NONE) {
      dx = DIR_DX[dir] * FP_ONE;
      dy = DIR_DY[dir] * FP_ONE;
    } else {
      // Campo aun no listo o meta en la misma casilla: ir en linea recta.
      const len = isqrt(ddx * ddx + ddy * ddy);
      if (len > 0) {
        dx = ((ddx * FP_ONE) / len) | 0;
        dy = ((ddy * FP_ONE) / len) | 0;
      }
    }

    // Si la unidad esta ya en la casilla meta, apunta al punto exacto: el
    // campo de flujo no tiene resolucion por debajo de la casilla.
    if (dir === DIR_NONE || (gx >> FP_SHIFT) === (x >> FP_SHIFT) && (gy >> FP_SHIFT) === (y >> FP_SHIFT)) {
      const len = isqrt(ddx * ddx + ddy * ddy);
      if (len > 0) {
        dx = ((ddx * FP_ONE) / len) | 0;
        dy = ((ddy * FP_ONE) / len) | 0;
      }
    }

    // Separacion local.
    let sx = 0;
    let sy = 0;
    const n = grid.forEachNeighbor(x, y, NEIGHBOR_BUF);
    const ri = C.radius[i];
    let crowd = 0;
    for (let q = 0; q < n; q++) {
      const j = NEIGHBOR_BUF[q];
      if (j === i) continue;
      const ox = x - C.tx[j];
      const oy = y - C.ty[j];
      const minD = ri + C.radius[j];
      const d2 = ox * ox + oy * oy;
      if (d2 === 0) {
        // Superpuestas exactamente: se desempata con el indice, que es
        // determinista, en vez de con ruido aleatorio.
        sx += (i & 1) === 0 ? FP_ONE : -FP_ONE;
        sy += (i & 2) === 0 ? FP_ONE : -FP_ONE;
        crowd++;
        continue;
      }
      if (d2 >= minD * minD) continue;
      const d = isqrt(d2);
      const push = (((minD - d) * FP_ONE) / minD) | 0;
      sx += ((ox * push) / (d === 0 ? 1 : d)) | 0;
      sy += ((oy * push) / (d === 0 ? 1 : d)) | 0;
      crowd++;
    }

    let vx = dx + ((sx * SEPARATION_W) >> 8);
    let vy = dy + ((sy * SEPARATION_W) >> 8);
    const vl = isqrt(vx * vx + vy * vy);
    const sp = C.speed[i];
    if (vl > 0) {
      vx = ((vx * sp) / vl) | 0;
      vy = ((vy * sp) / vl) | 0;
    } else {
      vx = 0;
      vy = 0;
    }

    // Integracion con resolucion por ejes contra el terreno.
    // Si la unidad ya esta dentro de una casilla bloqueada (la han encerrado
    // con un edificio, o ha nacido mal colocada) se la deja salir: encerrarla
    // para siempre es peor que dejarla atravesar un muro un instante.
    const atrapada = !walkableAt(sim, x, y);
    let nx = x + vx;
    let ny = y + vy;
    if (!atrapada) {
      if (!walkableAt(sim, nx, y)) nx = x;
      if (!walkableAt(sim, nx, ny)) ny = y;
    }
    const moved = (nx - x) * (nx - x) + (ny - y) * (ny - y);
    C.tx[i] = nx;
    C.ty[i] = ny;
    C.vx[i] = nx - x;
    C.vy[i] = ny - y;
    if (vx !== 0 || vy !== 0) C.facing[i] = atan2B(vy, vx);

    // Deteccion de atasco: si apenas avanza durante un rato, se da por
    // llegada. Un RTS que deja unidades empujandose eternamente en la puerta
    // de una muralla es peor que uno que las para.
    const minStep = (sp * sp) >> 4;
    if (moved < minStep) {
      if (++C.stuckFor[i] > 25) {
        if (crowd > 0) arrive(sim, i);
        else C.stuckFor[i] = 0;
      }
    } else if (C.stuckFor[i] > 0) {
      C.stuckFor[i]--;
    }
  }
}

function walkableAt(sim: Simulation, x: number, y: number): boolean {
  const tx = x >> FP_SHIFT;
  const ty = y >> FP_SHIFT;
  return sim.terrain.walkable(tx, ty);
}

export function arrive(sim: Simulation, i: number): void {
  const C = sim.C;
  C.moveState[i] = MoveState.Arrived;
  C.vx[i] = 0;
  C.vy[i] = 0;
  C.stuckFor[i] = 0;
  if (C.flowId[i] !== 0 && sim.path) {
    sim.path.release(C.flowId[i]);
    C.flowId[i] = 0;
  }
}

/** Ordena a la entidad `i` moverse a (x, y) en coordenadas fixed. */
export function orderMove(sim: Simulation, i: number, x: number, y: number): void {
  const C = sim.C;
  const { terrain } = sim;
  let tx = x >> FP_SHIFT;
  let ty = y >> FP_SHIFT;
  if (!terrain.walkable(tx, ty)) {
    const near = nearestWalkable(sim, tx, ty);
    if (near < 0) return;
    tx = near % terrain.width;
    ty = (near / terrain.width) | 0;
    x = (tx << FP_SHIFT) + (FP_ONE >> 1);
    y = (ty << FP_SHIFT) + (FP_ONE >> 1);
  }
  if (C.flowId[i] !== 0 && sim.path) sim.path.release(C.flowId[i]);
  C.goalX[i] = x;
  C.goalY[i] = y;
  C.moveState[i] = MoveState.Moving;
  C.stuckFor[i] = 0;
  const goalTile = ty * terrain.width + tx;
  const fromTile = (C.ty[i] >> FP_SHIFT) * terrain.width + (C.tx[i] >> FP_SHIFT);
  C.flowId[i] = sim.path ? sim.path.request(Int32Array.of(goalTile), fromTile) : 0;
}

/**
 * Casilla transitable mas cercana, por anillos crecientes. Dentro de cada
 * anillo se elige la de menor distancia euclidea: si se coge la primera del
 * recorrido sale siempre una esquina en diagonal, un 41% mas lejos, y la
 * unidad se queda a un palmo de su objetivo sin llegar nunca.
 */
export function nearestWalkable(sim: Simulation, tx: number, ty: number): number {
  const { terrain } = sim;
  if (terrain.walkable(tx, ty)) return ty * terrain.width + tx;
  for (let r = 1; r <= 12; r++) {
    let best = -1;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (!terrain.walkable(nx, ny)) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = ny * terrain.width + nx;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}
