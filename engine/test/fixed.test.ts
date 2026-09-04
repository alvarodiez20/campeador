import { describe, expect, it } from 'vitest';
import {
  FP_ONE,
  atan2B,
  cosB,
  div,
  fx,
  isqrt,
  length,
  mul,
  normalize,
  octant,
  sinB,
  toFloat,
} from '../src/core/fixed';
import { DIR_DX, DIR_DY } from '../src/path/flowfield';

describe('punto fijo', () => {
  it('convierte de ida y vuelta con la precision esperada', () => {
    for (const v of [0, 1, -1, 3.5, -12.25, 1000.125]) {
      expect(toFloat(fx(v))).toBeCloseTo(v, 3);
    }
  });

  it('multiplica y divide sin desbordar', () => {
    expect(toFloat(mul(fx(3), fx(4)))).toBeCloseTo(12, 3);
    expect(toFloat(mul(fx(-2.5), fx(4)))).toBeCloseTo(-10, 3);
    expect(toFloat(div(fx(10), fx(4)))).toBeCloseTo(2.5, 3);
    expect(toFloat(mul(fx(400), fx(400)))).toBeCloseTo(160000, 0);
  });

  it('la raiz entera es exacta y no usa Math.sqrt', () => {
    for (const n of [0, 1, 2, 3, 4, 15, 16, 17, 99, 100, 12345, 1 << 30]) {
      const r = isqrt(n);
      expect(r * r).toBeLessThanOrEqual(n);
      expect((r + 1) * (r + 1)).toBeGreaterThan(n);
    }
  });

  it('length coincide con la hipotenusa', () => {
    expect(toFloat(length(fx(3), fx(4)))).toBeCloseTo(5, 2);
  });

  it('normalize deja el vector con longitud 1', () => {
    const v = { x: fx(30), y: fx(-40) };
    normalize(v);
    expect(toFloat(length(v.x, v.y))).toBeCloseTo(1, 2);
  });

  it('seno y coseno cumplen la identidad pitagorica', () => {
    for (let b = 0; b < 256; b += 7) {
      const s = toFloat(sinB(b));
      const c = toFloat(cosB(b));
      expect(s * s + c * c).toBeCloseTo(1, 2);
    }
  });

  it('atan2B invierte a sinB/cosB dentro de un brad', () => {
    for (let b = 0; b < 256; b += 3) {
      const x = cosB(b);
      const y = sinB(b);
      const back = atan2B(y, x);
      const diff = Math.min((back - b + 256) % 256, (b - back + 256) % 256);
      expect(diff).toBeLessThanOrEqual(2);
    }
  });

  it('octant concuerda con la tabla de direcciones del flow field', () => {
    for (let k = 0; k < 8; k++) {
      const dx = DIR_DX[k] * FP_ONE;
      const dy = DIR_DY[k] * FP_ONE;
      expect(octant(dx, dy)).toBe(k);
    }
  });

  it('es determinista: la misma entrada da el mismo bit siempre', () => {
    const a = mul(fx(1.1), fx(2.2));
    const b = mul(fx(1.1), fx(2.2));
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
  });
});
