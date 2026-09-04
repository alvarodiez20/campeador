import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('rng determinista', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('semillas distintas divergen', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let iguales = 0;
    for (let i = 0; i < 200; i++) if (a.next() === b.next()) iguales++;
    expect(iguales).toBeLessThan(5);
  });

  it('serializa y restaura el estado', () => {
    const a = new Rng(99);
    for (let i = 0; i < 50; i++) a.next();
    const estado = a.serialize();
    const esperado = [a.next(), a.next(), a.next()];
    const b = new Rng(0);
    b.restore(estado);
    expect([b.next(), b.next(), b.next()]).toEqual(esperado);
  });

  it('int(n) se mantiene en rango', () => {
    const r = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.int(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it('range respeta los extremos', () => {
    const r = new Rng(8);
    for (let i = 0; i < 500; i++) {
      const v = r.range(-3, 3);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(3);
    }
  });
});
