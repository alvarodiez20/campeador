/**
 * Generador determinista xorshift128. Toda la aleatoriedad de la simulacion
 * pasa por aqui; `Math.random` esta prohibido dentro de `src/sim`.
 * El estado es serializable, que es lo que permite reproducir una partida
 * a partir de la semilla y la lista de ordenes.
 */
export class Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed = 0x1d1e11a5) {
    // Difusion inicial (splitmix32) para que semillas contiguas no se parezcan.
    let x = seed >>> 0;
    const next = (): number => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
      return (z ^ (z >>> 15)) >>> 0;
    };
    this.s0 = next();
    this.s1 = next();
    this.s2 = next();
    this.s3 = next();
  }

  /** Entero sin signo de 32 bits. */
  next(): number {
    let t = this.s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = (this.s3 << 11) | (this.s3 >>> 21);
    t = (Math.imul(this.s1, 5) << 7) | (Math.imul(this.s1, 5) >>> 25);
    return (Math.imul(t, 9) >>> 0);
  }

  /** Entero en [0, n). */
  int(n: number): number {
    if (n <= 0) return 0;
    return this.next() % n;
  }

  /** Entero en [lo, hi] inclusive. */
  range(lo: number, hi: number): number {
    if (hi <= lo) return lo;
    return lo + this.int(hi - lo + 1);
  }

  /** true con probabilidad num/den. */
  chance(num: number, den: number): boolean {
    return this.int(den) < num;
  }

  serialize(): [number, number, number, number] {
    return [this.s0, this.s1, this.s2, this.s3];
  }

  restore(state: readonly [number, number, number, number]): void {
    this.s0 = state[0];
    this.s1 = state[1];
    this.s2 = state[2];
    this.s3 = state[3];
  }
}
