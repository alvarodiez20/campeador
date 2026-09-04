import { describe, expect, it } from 'vitest';
import { ResourceKind, UnitClass } from '../src/ecs/components';
import { PERSONALIDADES, SimpleAI } from '../src/game/ai';
import { BuildingId } from '../src/game/data';
import { createValencia1094, PLAYER_ALBARRACIN, PLAYER_ALMORAVIDES, PLAYER_CID } from '../src/game/scenario';
import { InlinePathService } from '../src/path/service';
import { CommandQueue } from '../src/sim/commands';
import { stepSimulation } from '../src/sim/step';
import { countUnits } from '../src/sim/systems/economy';
import { hashState } from './helpers';

function montar(seed = 0x1094) {
  const sc = createValencia1094(seed);
  sc.sim.attachPath(new InlinePathService(sc.sim.terrain.width, sc.sim.terrain.height, sc.sim.terrain.cost));
  const queue = new CommandQueue();
  const ias = [
    new SimpleAI(sc.sim, PLAYER_CID, queue, PERSONALIDADES.equilibrado),
    new SimpleAI(sc.sim, PLAYER_ALMORAVIDES, queue, PERSONALIDADES.agresivo),
    new SimpleAI(sc.sim, PLAYER_ALBARRACIN, queue, PERSONALIDADES.economico),
  ];
  const correr = (ticks: number): void => {
    for (let t = 0; t < ticks; t++) {
      for (const ia of ias) ia.tick();
      stepSimulation(sc.sim, queue.drain());
      sc.handleEvents(sc.sim.drainEvents());
    }
  };
  return { sc, correr, queue };
}

describe('escenario de Valencia 1094', () => {
  it('arranca con las tres partes en su sitio', () => {
    const { sc } = montar();
    expect(sc.sim.players).toHaveLength(3);
    expect(countUnits(sc.sim, PLAYER_CID)).toBeGreaterThan(15);
    expect(countUnits(sc.sim, PLAYER_ALMORAVIDES)).toBeGreaterThan(10);
    expect(sc.outcome).toBe('jugando');
    // Con Albarracin se empieza en tregua, no en guerra: la taifa no es un
    // enemigo generico, es una pieza del sistema de parias.
    expect(sc.sim.enemies(PLAYER_CID, PLAYER_ALBARRACIN)).toBe(false);
    expect(sc.sim.enemies(PLAYER_CID, PLAYER_ALMORAVIDES)).toBe(true);
  });

  it('la partida avanza sola: se recolecta, se construye y se entrena', () => {
    const { sc, correr } = montar();
    const aldeanosAntes = countUnits(sc.sim, PLAYER_ALMORAVIDES, UnitClass.Villager);
    const maderaAntes = sc.sim.players[PLAYER_ALMORAVIDES].resources[ResourceKind.Wood];
    correr(2500);
    expect(countUnits(sc.sim, PLAYER_ALMORAVIDES, UnitClass.Villager)).toBeGreaterThan(aldeanosAntes);
    // Se ha movido economia: o se ha gastado madera construyendo, o se ha
    // acumulado recolectando. Lo que no puede es quedarse igual.
    expect(sc.sim.players[PLAYER_ALMORAVIDES].resources[ResourceKind.Wood]).not.toBe(maderaAntes);
    let obras = 0;
    sc.sim.world.each(sc.sim.mBuilding, (i) => {
      if (sc.sim.C.player[i] === PLAYER_ALMORAVIDES) obras++;
    });
    expect(obras).toBeGreaterThanOrEqual(9);
  }, 120_000);

  it('hay combate: alguien pierde unidades', () => {
    const { sc, correr } = montar();
    const antes = countUnits(sc.sim, PLAYER_CID) + countUnits(sc.sim, PLAYER_ALMORAVIDES);
    correr(3000);
    const despues = countUnits(sc.sim, PLAYER_CID) + countUnits(sc.sim, PLAYER_ALMORAVIDES);
    // Con las dos IAs mandando oleadas, en tres minutos y medio de juego
    // tiene que haber habido bajas o crecimiento; el escenario no se congela.
    expect(despues).not.toBe(antes);
  }, 120_000);

  it('cumple el objetivo de resistir si la partida sigue viva a los ocho minutos', () => {
    const { sc, correr } = montar();
    correr(15 * 60 * 8 + 20);
    // Tres salidas posibles: la partida sigue (y entonces se ha resistido),
    // ya se gano antes derribando la tienda del emir, o ya se perdio.
    if (sc.outcome === 'jugando') expect(sc.objectives[0].done).toBe(true);
    else expect(['victoria', 'derrota']).toContain(sc.outcome);
  }, 240_000);

  it('la partida siempre acaba: ninguna llega al limite sin desenlace', () => {
    // El limite del escenario son 22 minutos; se corre hasta 24 para
    // comprobar que cierra solo. Antes de esta regla, una de cada seis
    // partidas se quedaba en tablas con los dos bandos desangrados.
    for (const semilla of [0x1094, 0x2094, 0x3094]) {
      const { sc, correr } = montar(semilla);
      correr(15 * 60 * 24);
      expect(sc.outcome).not.toBe('jugando');
    }
  }, 240_000);

  it('si el cerco se queda sin fuerza, se levanta y se gana', () => {
    const { sc, correr } = montar();
    // Se barre el campamento —tropas, aldeanos y los edificios que sacan
    // tropa— y se adelanta el reloj a la ventana de desgaste. Hacen falta las
    // tres cosas: con aldeanos vivos la IA se rehace en menos de un minuto, y
    // con el cuartel en pie tambien. Que se rehaga es lo correcto; por eso el
    // desgaste solo cuenta cuando de verdad no queda con que.
    // La tienda del emir se deja en pie a proposito: si cayera, la victoria
    // seria por el objetivo 2 y esto no estaria probando el desgaste.
    const sim = sc.sim;
    const bajas: number[] = [];
    sim.eachUnit((i) => {
      if (sim.C.player[i] === PLAYER_ALMORAVIDES) bajas.push(i);
    });
    sim.world.each(sim.mBuilding, (i) => {
      if (sim.C.player[i] !== PLAYER_ALMORAVIDES) return;
      const tipo = sim.C.typeId[i];
      if (tipo === BuildingId.Cuartel || tipo === BuildingId.Caballerizas) bajas.push(i);
    });
    for (const i of bajas) sim.destroyEntity(sim.world.entityAt(i));
    sim.tick = 15 * 60 * 15;
    correr(15 * 62)
    expect(sc.outcome).toBe('victoria');
    expect(sc.objectives[1].done).toBe(true);
  }, 240_000);

  it('perder el alcazar es la derrota', () => {
    const { sc, correr } = montar();
    let alcazar = -1;
    sc.sim.world.each(sc.sim.mBuilding, (i) => {
      if (sc.sim.C.player[i] === PLAYER_CID && sc.sim.C.tileW[i] === 4) alcazar = i;
    });
    expect(alcazar).toBeGreaterThan(0);
    sc.sim.destroyEntity(sc.sim.world.entityAt(alcazar));
    correr(2);
    expect(sc.outcome).toBe('derrota');
  });

  it('exigir parias a Albarracin funciona cuando hay tropas delante', () => {
    const { sc, correr, queue } = montar();
    // Se manda la caballeria a Albarracin y se exige el tributo.
    const jinetes: number[] = [];
    sc.sim.eachUnit((i) => {
      if (sc.sim.C.player[i] === PLAYER_CID && sc.sim.C.unitClass[i] === UnitClass.Cavalry) jinetes.push(i);
    });
    expect(jinetes.length).toBeGreaterThan(0);
    queue.push({
      t: 'move',
      player: PLAYER_CID,
      units: jinetes.map((i) => sc.sim.world.entityAt(i)),
      x: 76 * 4096,
      y: 24 * 4096,
    });
    correr(700);
    queue.push({ t: 'demandParias', player: PLAYER_CID, from: PLAYER_ALBARRACIN });
    correr(5);
    const contrato = sc.sim.diplomacy.contractBetween(PLAYER_ALBARRACIN, PLAYER_CID);
    expect(contrato).toBeDefined();
    expect(contrato!.rate).toBeGreaterThan(0);
    expect(sc.objectives[2].done).toBe(true);
  }, 120_000);

  it('es reproducible con la misma semilla', () => {
    const jugar = (): number => {
      const { sc, correr } = montar(777);
      correr(900);
      return hashState(sc.sim);
    };
    expect(jugar()).toBe(jugar());
  }, 120_000);
});
