import { describe, expect, it } from 'vitest';
import { Benchmark } from '../src/game/benchmark';
import { InlinePathService } from '../src/path/service';
import { stepSimulation } from '../src/sim/step';
import { hashState } from './helpers';

/**
 * Presupuesto de simulacion, medido sin render.
 *
 * A 15 Hz cada tick dispone de 66,6 ms, pero el render tiene que caber en el
 * mismo hilo: el objetivo real es que la simulacion se coma menos de 10 ms de
 * media con 500 unidades. Los umbrales de este fichero son generosos a
 * proposito porque la maquina de integracion no es la del jugador; lo que
 * vigilan es la regresion de un orden de magnitud, no el ultimo milisegundo.
 *
 * El criterio de aceptacion completo (500 unidades a 60 fps con render) se
 * comprueba en el navegador: `npm run dev` y abrir `?modo=banco&n=500`.
 */

function medir(units: number, ticks: number, combat: boolean): { media: number; peor: number; sim: ReturnType<typeof crear> } {
  const bench = crear(units, combat);
  // Calentamiento: el primer tick paga la construccion de los campos.
  for (let i = 0; i < 20; i++) {
    bench.update();
    stepSimulation(bench.sim, bench.queue.drain());
  }
  let total = 0;
  let peor = 0;
  for (let i = 0; i < ticks; i++) {
    bench.update();
    const t0 = performance.now();
    stepSimulation(bench.sim, bench.queue.drain());
    const dt = performance.now() - t0;
    total += dt;
    if (dt > peor) peor = dt;
    bench.sim.drainEvents();
  }
  return { media: total / ticks, peor, sim: bench };
}

function crear(units: number, combat: boolean): Benchmark {
  const bench = new Benchmark({ units, mapSize: 128, combat, orderEvery: 60, obstacles: true });
  bench.sim.attachPath(new InlinePathService(bench.sim.terrain.width, bench.sim.terrain.height, bench.sim.terrain.cost));
  return bench;
}

describe('presupuesto de la simulacion', () => {
  it('500 unidades moviendose: menos de 20 ms de media por tick', () => {
    const r = medir(500, 200, false);
    console.log(`  500 unidades, solo movimiento -> media ${r.media.toFixed(2)} ms, peor ${r.peor.toFixed(2)} ms`);
    expect(r.media).toBeLessThan(20);
  }, 60_000);

  it('500 unidades en combate: menos de 25 ms de media por tick', () => {
    const r = medir(500, 200, true);
    console.log(`  500 unidades, con combate -> media ${r.media.toFixed(2)} ms, peor ${r.peor.toFixed(2)} ms`);
    expect(r.media).toBeLessThan(25);
  }, 60_000);

  it('escala de forma razonable de 200 a 800 unidades', () => {
    const a = medir(200, 120, false);
    const b = medir(800, 120, false);
    console.log(`  200 -> ${a.media.toFixed(2)} ms · 800 -> ${b.media.toFixed(2)} ms`);
    // Cuadruplicar las unidades no debe multiplicar por mas de ocho el coste:
    // si lo hace, hay algo cuadratico escondido.
    expect(b.media).toBeLessThan(Math.max(1, a.media) * 8);
  }, 90_000);

  it('el banco es reproducible: mismo estado tras los mismos ticks', () => {
    const uno = crear(120, true);
    const dos = crear(120, true);
    for (let i = 0; i < 150; i++) {
      uno.update();
      stepSimulation(uno.sim, uno.queue.drain());
      uno.sim.drainEvents();
      dos.update();
      stepSimulation(dos.sim, dos.queue.drain());
      dos.sim.drainEvents();
    }
    expect(hashState(uno.sim)).toBe(hashState(dos.sim));
  }, 60_000);
});
