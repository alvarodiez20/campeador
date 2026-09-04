import { describe, expect, it } from 'vitest';
import { fx } from '../src/core/fixed';
import { UnitClass } from '../src/ecs/components';
import { PERSONALIDADES, SimpleAI } from '../src/game/ai';
import { BuildingId, FactionId, UnitId } from '../src/game/data';
import { fill } from '../src/game/mapgen';
import { CommandQueue } from '../src/sim/commands';
import { Simulation } from '../src/sim/sim';
import { stepSimulation } from '../src/sim/step';
import { Tile } from '../src/sim/terrain';
import { withInlinePath } from './helpers';

/**
 * La IA que se adapta a lo que ve (DEUDA-007).
 *
 * Lo que se prueba aqui es la mecanica —que mira, que recuerda y que
 * desplaza la cuota hacia el contrario— y que **no hace trampas**: lo que
 * esta fuera de la niebla no cuenta. Que adaptarse gane partidas es otra
 * cuestion, medida aparte en `docs/BANCO-DE-PARTIDAS.md`, y la respuesta
 * corta es que en este escenario apenas mueve el marcador.
 */

function mundo(): { sim: Simulation; ia: SimpleAI; correr: (n: number) => void } {
  const sim = new Simulation({
    width: 48,
    height: 48,
    seed: 0xbeef,
    players: [
      { faction: FactionId.HuesteDelCid, team: 1 },
      { faction: FactionId.Almoravides, team: 2 },
    ],
  });
  fill(sim, Tile.Grass);
  withInlinePath(sim);
  const queue = new CommandQueue();
  const ia = new SimpleAI(sim, 0, queue, PERSONALIDADES.equilibrado);
  const correr = (n: number): void => {
    for (let t = 0; t < n; t++) {
      ia.tick();
      stepSimulation(sim, queue.drain());
      sim.drainEvents();
    }
  };
  return { sim, ia, correr };
}

describe('la IA se adapta a lo que ve', () => {
  it('sin ver nada, mantiene la cuota base del triangulo', () => {
    const { ia, correr } = mundo();
    correr(60);
    const c = ia.cuotaEfectiva();
    expect(c[UnitClass.Spear]).toBe(30);
    expect(c[UnitClass.Infantry]).toBe(25);
    expect(c[UnitClass.Archer]).toBe(25);
    expect(c[UnitClass.Cavalry]).toBe(20);
  });

  it('al ver caballeria enemiga, sube la cuota de lanceros', () => {
    const { sim, ia, correr } = mundo();
    // El ojeador es una torre y no una unidad a proposito: un ballestero
    // solo delante de diez jinetes muere antes del segundo ciclo de IA, y
    // entonces la prueba pasaria por no haber visto nada.
    sim.spawnBuilding(0, BuildingId.Torre, 19, 19, true);
    for (let n = 0; n < 10; n++) sim.spawnUnit(1, UnitId.Caballero, fx(21 + (n % 5)), fx(20 + Math.floor(n / 5)));
    correr(200);
    const c = ia.cuotaEfectiva();
    expect(c[UnitClass.Spear]).toBeGreaterThan(30);
    expect(c[UnitClass.Spear]).toBeGreaterThan(c[UnitClass.Infantry]);
    expect(c[UnitClass.Spear]).toBeGreaterThan(c[UnitClass.Archer]);
  });

  it('al ver arqueros enemigos, sube la cuota de caballeria', () => {
    const { sim, ia, correr } = mundo();
    sim.spawnBuilding(0, BuildingId.Torre, 19, 19, true);
    for (let n = 0; n < 10; n++) sim.spawnUnit(1, UnitId.Ballestero, fx(21 + (n % 5)), fx(20 + Math.floor(n / 5)));
    correr(200);
    const c = ia.cuotaEfectiva();
    expect(c[UnitClass.Cavalry]).toBeGreaterThan(20);
  });

  it('no cuenta lo que esta fuera de la niebla: no hace trampas', () => {
    const { sim, ia, correr } = mundo();
    // Ejercito enemigo enorme, pero en la otra punta del mapa y sin nadie
    // propio cerca. Una IA que lea el estado del mundo no es dificil de
    // escribir: es tramposa, y ademas invalida cualquier medicion de balance.
    for (let n = 0; n < 20; n++) sim.spawnUnit(1, UnitId.Caballero, fx(40 + (n % 5)), fx(40 + Math.floor(n / 5)));
    sim.spawnBuilding(0, BuildingId.Torre, 4, 4, true);
    correr(200);
    const c = ia.cuotaEfectiva();
    expect(c[UnitClass.Spear]).toBe(30);
    expect(ia.vistoDelRival()[UnitClass.Cavalry]).toBe(0);
  });

  it('lo visto se olvida cuando el enemigo se va', () => {
    const { sim, ia, correr } = mundo();
    const ojeador = sim.spawnBuilding(0, BuildingId.Torre, 19, 19, true);
    const jinetes = [];
    for (let n = 0; n < 10; n++) jinetes.push(sim.spawnUnit(1, UnitId.Caballero, fx(21 + (n % 5)), fx(20 + Math.floor(n / 5))));
    correr(200);
    expect(ia.cuotaEfectiva()[UnitClass.Spear]).toBeGreaterThan(30);
    for (const e of jinetes) sim.destroyEntity(e);
    correr(600);
    expect(sim.world.isAlive(ojeador)).toBe(true);
    expect(ia.cuotaEfectiva()[UnitClass.Spear]).toBe(30);
  });

  it('la personalidad de cuota fija no se inmuta', () => {
    const sim = new Simulation({
      width: 48,
      height: 48,
      seed: 1,
      players: [{ faction: FactionId.HuesteDelCid, team: 1 }, { faction: FactionId.Almoravides, team: 2 }],
    });
    fill(sim, Tile.Grass);
    withInlinePath(sim);
    const queue = new CommandQueue();
    const ia = new SimpleAI(sim, 0, queue, PERSONALIDADES.cuotaFija);
    sim.spawnBuilding(0, BuildingId.Torre, 19, 19, true);
    for (let n = 0; n < 10; n++) sim.spawnUnit(1, UnitId.Caballero, fx(21 + (n % 5)), fx(20 + Math.floor(n / 5)));
    for (let t = 0; t < 200; t++) {
      ia.tick();
      stepSimulation(sim, queue.drain());
      sim.drainEvents();
    }
    expect(ia.cuotaEfectiva()[UnitClass.Spear]).toBe(30);
  });
});
