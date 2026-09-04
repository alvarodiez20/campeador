/**
 * Proyeccion isometrica 2:1, la misma relacion que usaba AoE2. Una casilla
 * ocupa 64x32 pixeles a zoom 1.
 *
 * El mundo se mide en casillas (con decimales); la simulacion las guarda en
 * punto fijo y el render las convierte a float una sola vez por frame, al
 * proyectar. Esa es la unica frontera donde se permite pasar a coma flotante.
 */
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

export function worldToScreenX(wx: number, wy: number): number {
  return (wx - wy) * HALF_W;
}

export function worldToScreenY(wx: number, wy: number): number {
  return (wx + wy) * HALF_H;
}

export function screenToWorldX(sx: number, sy: number): number {
  return (sx / HALF_W + sy / HALF_H) / 2;
}

export function screenToWorldY(sx: number, sy: number): number {
  return (sy / HALF_H - sx / HALF_W) / 2;
}

/** Profundidad para el orden de pintado. Mas grande = mas cerca del jugador. */
export function depthOf(wx: number, wy: number): number {
  return wx + wy;
}
