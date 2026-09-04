/**
 * Aritmetica de punto fijo Q20.12.
 *
 * Toda la simulacion usa enteros. Los floats quedan prohibidos dentro de
 * `src/sim` y `src/path`: en cuanto entre multijugador lockstep, cualquier
 * diferencia de redondeo entre navegadores desincroniza la partida. Es mas
 * barato pagar la incomodidad ahora que depurar una desincronizacion despues.
 *
 * Rango util: +-524287 unidades de mundo, resolucion 1/4096.
 */

export const FP_SHIFT = 12;
export const FP_ONE = 1 << FP_SHIFT; // 4096
export const FP_HALF = FP_ONE >> 1;

/** Un entero que representa un numero en Q20.12. Alias documental, no nominal. */
export type Fixed = number;

export function fx(n: number): Fixed {
  return Math.round(n * FP_ONE) | 0;
}

export function toFloat(a: Fixed): number {
  return a / FP_ONE;
}

/** Entero -> fixed, sin pasar por coma flotante. */
export function fromInt(n: number): Fixed {
  return (n << FP_SHIFT) | 0;
}

/** Truncado hacia menos infinito, que es lo que quieren los indices de celda. */
export function floorToInt(a: Fixed): number {
  return a >> FP_SHIFT;
}

export function roundToInt(a: Fixed): number {
  return (a + FP_HALF) >> FP_SHIFT;
}

export function mul(a: Fixed, b: Fixed): Fixed {
  // El producto puede desbordar 32 bits, asi que se hace en coma flotante de
  // 53 bits (exacto para enteros de hasta 2^53) y se trunca al final.
  return Math.trunc((a * b) / FP_ONE) | 0;
}

export function div(a: Fixed, b: Fixed): Fixed {
  if (b === 0) return a >= 0 ? 0x7fffffff : -0x7fffffff;
  return Math.trunc((a * FP_ONE) / b) | 0;
}

export function abs(a: Fixed): Fixed {
  return a < 0 ? -a : a;
}

export function clamp(a: Fixed, lo: Fixed, hi: Fixed): Fixed {
  return a < lo ? lo : a > hi ? hi : a;
}

export function min(a: Fixed, b: Fixed): Fixed {
  return a < b ? a : b;
}

export function max(a: Fixed, b: Fixed): Fixed {
  return a > b ? a : b;
}

/**
 * Raiz cuadrada entera por Newton sobre enteros (sin Math.sqrt, que no
 * garantiza el mismo ultimo bit en todas las plataformas).
 *
 * Importante: aqui no se pueden usar operadores de bits. El cuadrado de una
 * distancia en punto fijo pasa de 2^31 con facilidad (96 casillas al cuadrado
 * ya son 3e11) y `>>` truncaria el valor a 32 bits en silencio. Se usa
 * `Math.trunc`, que es exacto hasta 2^53.
 */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  if (n < 4) return 1;
  let x = n;
  let y = Math.trunc((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.trunc((x + Math.trunc(n / x)) / 2);
  }
  return x;
}

export function sqrt(a: Fixed): Fixed {
  if (a <= 0) return 0;
  // sqrt(a/ONE)*ONE = sqrt(a*ONE)
  return isqrt(a * FP_ONE);
}

/** Longitud exacta del vector, en fixed. */
export function length(dx: Fixed, dy: Fixed): Fixed {
  const d2 = dx * dx + dy * dy; // hasta 2^53, seguro
  return isqrt(d2);
}

/** Distancia al cuadrado en unidades de mundo (float-libre, cabe en 2^53). */
export function dist2(dx: Fixed, dy: Fixed): number {
  return dx * dx + dy * dy;
}

/**
 * Normaliza (dx, dy) a longitud FP_ONE. Devuelve (0,0) si el vector es nulo.
 * Muta el objeto que se le pasa para evitar basura por tick.
 */
export interface Vec2 {
  x: Fixed;
  y: Fixed;
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v.x, v.y);
  if (len === 0) {
    v.x = 0;
    v.y = 0;
    return v;
  }
  v.x = Math.trunc((v.x * FP_ONE) / len) | 0;
  v.y = Math.trunc((v.y * FP_ONE) / len) | 0;
  return v;
}

/** Tabla de senos de 256 entradas, en Q20.12. Se genera con enteros al cargar. */
const SIN_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  SIN_TABLE[i] = Math.round(Math.sin((i / 256) * Math.PI * 2) * FP_ONE);
}

/** angulo en brads (0..255). */
export function sinB(brad: number): Fixed {
  return SIN_TABLE[brad & 255];
}

export function cosB(brad: number): Fixed {
  return SIN_TABLE[(brad + 64) & 255];
}

/**
 * Tabla de arcotangentes: ATAN_TABLE[i] = atan(i/32) en brads (256 por
 * vuelta). Con 33 entradas el error maximo es de un brad, frente a los cuatro
 * de la aproximacion lineal. Se genera una sola vez al cargar el modulo, de
 * modo que en tiempo de simulacion solo hay enteros.
 */
const ATAN_TABLE = new Uint8Array(33);
for (let i = 0; i <= 32; i++) {
  ATAN_TABLE[i] = Math.round((Math.atan(i / 32) / (Math.PI * 2)) * 256);
}

/** Direccion en brads (0..255) a partir de un vector. Determinista. */
export function atan2B(dy: Fixed, dx: Fixed): number {
  if (dx === 0 && dy === 0) return 0;
  const ax = dx < 0 ? -dx : dx;
  const ay = dy < 0 ? -dy : dy;
  let a: number;
  if (ax >= ay) {
    a = ATAN_TABLE[Math.trunc((ay * 32) / ax)];
  } else {
    a = 64 - ATAN_TABLE[Math.trunc((ax * 32) / ay)];
  }
  if (dx < 0) a = 128 - a;
  if (dy < 0) a = 256 - a;
  return a & 255;
}

/** Una de las 8 direcciones isometricas (0 = este, sentido antihorario). */
export function octant(dx: Fixed, dy: Fixed): number {
  return ((atan2B(dy, dx) + 16) >> 5) & 7;
}
