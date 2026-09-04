import { describe, expect, it } from 'vitest';
import { GatherState, ResourceKind, UnitClass } from '../src/ecs/components';
import { PERSONALIDADES, SimpleAI } from '../src/game/ai';
import { createValencia1094, PLAYER_ALBARRACIN, PLAYER_ALMORAVIDES, PLAYER_CID } from '../src/game/scenario';
import { InlinePathService } from '../src/path/service';
import { CommandQueue } from '../src/sim/commands';
import { stepSimulation } from '../src/sim/step';

/**
 * Regresiones de la IA salidas del banco de partidas
 * (`npm run playtest`). Cada una de estas pruebas existe porque el banco
 * encontro el fallo primero; sin ellas volverian en silencio, porque ninguna
 * rompe nada visible: la partida sigue corriendo, solo que mal.
 */

function montar(semilla = 0x1094) {
  const sc = createValencia1094(semilla);
  const sim = sc.sim;
  sim.attachPath(new InlinePathService(sim.terrain.width, sim.terrain.height, sim.terrain.cost));
  const queue = new CommandQueue();
  const ias = [
    new SimpleAI(sim, PLAYER_CID, queue, PERSONALIDADES.equilibrado),
    new SimpleAI(sim, PLAYER_ALMORAVIDES, queue, PERSONALIDADES.agresivo),
    new SimpleAI(sim, PLAYER_ALBARRACIN, queue, PERSONALIDADES.economico),
  ];
  const correr = (ticks: number): void => {
    for (let t = 0; t < ticks; t++) {
      for (const ia of ias) ia.tick();
      stepSimulation(sim, queue.drain());
      sc.handleEvents(sim.drainEvents());
    }
  };
  return { sc, sim, correr };
}

describe('economia de la IA', () => {
  it('reparte aldeanos a los cuatro recursos, no solo a los dos primeros', () => {
    // El reparto original era una cuota fija aplicada una sola vez y solo a
    // los aldeanos ociosos: con ocho aldeanos nadie llegaba nunca al oro ni a
    // la piedra, y el reparto inicial se congelaba para el resto de la
    // partida.
    const { sim, correr } = montar();
    correr(2400);
    const porRecurso = [0, 0, 0, 0];
    sim.eachUnit((i) => {
      if (sim.C.player[i] !== PLAYER_CID) return;
      if (sim.C.unitClass[i] !== UnitClass.Villager) return;
      if (sim.C.gatherState[i] === GatherState.None) return;
      porRecurso[sim.C.carryKind[i]]++;
    });
    const tocados = porRecurso.filter((n) => n > 0).length;
    expect(tocados).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it('el oro no se queda congelado en el valor inicial', () => {
    const { sim, correr } = montar();
    const inicial = sim.players[PLAYER_CID].resources[ResourceKind.Gold];
    correr(3000);
    // Sin recoleccion de oro se gastaba hasta el suelo y ahi se quedaba; lo
    // que se comprueba es que el recurso circula, no que suba.
    const ahora = sim.players[PLAYER_CID].resources[ResourceKind.Gold];
    expect(ahora).not.toBe(inicial);
    expect(ahora).toBeGreaterThan(20);
  }, 120_000);
});

describe('ejercito de la IA', () => {
  it('cubre los cuatro vertices del triangulo, no solo el mas barato', () => {
    // Recorriendo una lista fija, el cuartel siempre podia pagar un lancero y
    // nunca se llegaba a las caballerizas: 0,1 jinetes de media al final.
    const { sim, correr } = montar();
    correr(4500);
    const clases = new Set<number>();
    sim.eachUnit((i) => {
      if (sim.C.player[i] !== PLAYER_CID) return;
      if (sim.C.unitClass[i] === UnitClass.Villager) return;
      clases.add(sim.C.unitClass[i]);
    });
    for (const c of [UnitClass.Infantry, UnitClass.Spear, UnitClass.Archer, UnitClass.Cavalry]) {
      expect(clases.has(c)).toBe(true);
    }
  }, 120_000);

  it('remata al rival deshecho en vez de llamar a las tropas de vuelta', () => {
    // El fallo: la unidad llegaba al campamento enemigo, se quedaba sin
    // blanco al matar a los defensores y quince ticks despues la IA la
    // mandaba a casa por estar "dispersa". Doce oleadas por partida sin
    // derribar nada.
    const { sim, correr } = montar(0x5150);
    const militares: number[] = [];
    sim.eachUnit((i) => {
      if (sim.C.player[i] === PLAYER_ALMORAVIDES && sim.C.unitClass[i] !== UnitClass.Villager) militares.push(i);
    });
    for (const i of militares) sim.destroyEntity(sim.world.entityAt(i));

    const contar = (): number => {
      let n = 0;
      sim.world.each(sim.mBuilding, (i) => {
        if (sim.C.player[i] === PLAYER_ALMORAVIDES) n++;
      });
      return n;
    };
    const antes = contar();
    correr(6000);
    expect(contar()).toBeLessThan(antes);
  }, 180_000);
});

describe('diplomacia de la IA', () => {
  it('exige parias a la taifa en vez de ignorarlas', () => {
    // En el primer banco se firmaron parias en 0 de 12 partidas: la IA solo
    // gestionaba contratos existentes y ninguna los iniciaba nunca.
    const { sim, correr } = montar();
    correr(4000);
    const contrato = sim.diplomacy.contractBetween(PLAYER_ALBARRACIN, PLAYER_CID);
    expect(contrato).toBeDefined();
    expect(contrato!.rate).toBeGreaterThan(0);
  }, 120_000);
});
