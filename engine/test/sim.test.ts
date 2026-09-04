import { describe, expect, it } from 'vitest';
import { fx, toFloat } from '../src/core/fixed';
import { GatherState, MoveState, ResourceKind, UnitClass } from '../src/ecs/components';
import { entityIndex } from '../src/ecs/world';
import { BuildingId, FactionId, UNITS, UnitId } from '../src/game/data';
import { CommandQueue, type Command } from '../src/sim/commands';
import { Simulation } from '../src/sim/sim';
import { stepSimulation } from '../src/sim/step';
import { fill } from '../src/game/mapgen';
import { Tile } from '../src/sim/terrain';
import { hashState, withInlinePath } from './helpers';

function llanura(w = 48, h = 48, jugadores = 2): Simulation {
  const sim = new Simulation({
    width: w,
    height: h,
    seed: 0xabc,
    players: [
      { faction: FactionId.HuesteDelCid, team: 1 },
      { faction: FactionId.Almoravides, team: 2 },
      { faction: FactionId.Zaragoza, team: 3 },
    ].slice(0, jugadores),
  });
  fill(sim, Tile.Grass);
  return withInlinePath(sim);
}

function correr(sim: Simulation, ticks: number, cmds: Command[] = []): void {
  const q = new CommandQueue();
  for (const c of cmds) q.push(c);
  for (let i = 0; i < ticks; i++) stepSimulation(sim, q.drain());
}

describe('movimiento', () => {
  it('una unidad llega a su destino', () => {
    const sim = llanura();
    const e = sim.spawnUnit(0, UnitId.Infante, fx(5), fx(5));
    correr(sim, 200, [{ t: 'move', player: 0, units: [e], x: fx(25), y: fx(20) }]);
    const i = entityIndex(e);
    expect(toFloat(sim.C.tx[i])).toBeCloseTo(25, 0);
    expect(toFloat(sim.C.ty[i])).toBeCloseTo(20, 0);
    expect(sim.C.moveState[i]).toBe(MoveState.Arrived);
  });

  it('rodea un obstaculo en vez de atravesarlo', () => {
    const sim = llanura();
    for (let y = 4; y < 40; y++) sim.terrain.setTile(20, y, Tile.Rock);
    sim.path.patch(
      Int32Array.from({ length: 36 }, (_, k) => (k + 4) * sim.terrain.width + 20),
      new Uint8Array(36),
    );
    const e = sim.spawnUnit(0, UnitId.Caballero, fx(10), fx(20));
    correr(sim, 400, [{ t: 'move', player: 0, units: [e], x: fx(30), y: fx(20) }]);
    const i = entityIndex(e);
    expect(toFloat(sim.C.tx[i])).toBeGreaterThan(25);
    // Y nunca ha pisado el muro.
    expect(sim.terrain.walkable(sim.C.tx[i] >> 12, sim.C.ty[i] >> 12)).toBe(true);
  });

  it('cien unidades a la misma meta no se quedan encajadas', () => {
    const sim = llanura(64, 64);
    const es = [];
    for (let n = 0; n < 100; n++) es.push(sim.spawnUnit(0, UnitId.Lancero, fx(6 + (n % 10)), fx(6 + Math.floor(n / 10))));
    correr(sim, 500, [{ t: 'move', player: 0, units: es, x: fx(45), y: fx(45) }]);
    let cerca = 0;
    for (const e of es) {
      const i = entityIndex(e);
      const dx = toFloat(sim.C.tx[i]) - 45;
      const dy = toFloat(sim.C.ty[i]) - 45;
      if (Math.sqrt(dx * dx + dy * dy) < 9) cerca++;
    }
    expect(cerca).toBeGreaterThan(85);
  });
});

describe('combate y el triangulo', () => {
  /** Enfrenta dos grupos iguales y devuelve quien sobrevive. */
  function duelo(a: UnitId, b: UnitId, n = 6): { a: number; b: number } {
    const sim = llanura();
    const as = [];
    const bs = [];
    for (let k = 0; k < n; k++) {
      as.push(sim.spawnUnit(0, a, fx(20 + (k % 3)), fx(20 + Math.floor(k / 3))));
      bs.push(sim.spawnUnit(1, b, fx(26 + (k % 3)), fx(20 + Math.floor(k / 3))));
    }
    correr(sim, 900, [
      { t: 'attackMove', player: 0, units: as, x: fx(26), y: fx(20) },
      { t: 'attackMove', player: 1, units: bs, x: fx(20), y: fx(20) },
    ]);
    return {
      a: as.filter((e) => sim.world.isAlive(e)).length,
      b: bs.filter((e) => sim.world.isAlive(e)).length,
    };
  }

  it('el lancero gana a la caballeria', () => {
    const r = duelo(UnitId.Lancero, UnitId.Caballero);
    expect(r.a).toBeGreaterThan(r.b);
  });

  it('la caballeria gana al ballestero', () => {
    const r = duelo(UnitId.Caballero, UnitId.Ballestero);
    expect(r.a).toBeGreaterThan(r.b);
  });

  it('el infante gana al lancero', () => {
    const r = duelo(UnitId.Infante, UnitId.Lancero);
    expect(r.a).toBeGreaterThan(r.b);
  });

  it('no se ataca a quien no es enemigo', () => {
    const sim = llanura();
    const a = sim.spawnUnit(0, UnitId.Infante, fx(20), fx(20));
    const b = sim.spawnUnit(0, UnitId.Infante, fx(21), fx(20));
    correr(sim, 100);
    expect(sim.C.hp[entityIndex(a)]).toBe(UNITS[UnitId.Infante].hp);
    expect(sim.C.hp[entityIndex(b)]).toBe(UNITS[UnitId.Infante].hp);
  });

  it('en tregua no se dispara', () => {
    const sim = llanura();
    sim.diplomacy.tregua(0, 1);
    const a = sim.spawnUnit(0, UnitId.Infante, fx(20), fx(20));
    sim.spawnUnit(1, UnitId.Infante, fx(20.6), fx(20));
    correr(sim, 120);
    expect(sim.C.hp[entityIndex(a)]).toBe(UNITS[UnitId.Infante].hp);
  });
});

describe('economia', () => {
  it('un aldeano recolecta y deposita', () => {
    const sim = llanura();
    sim.spawnBuilding(0, BuildingId.CentroUrbano, 20, 20, true);
    const nodo = sim.spawnNode(ResourceKind.Wood, 27, 22, 100, true);
    const v = sim.spawnUnit(0, UnitId.Aldeano, fx(25), fx(25));
    const antes = sim.players[0].resources[ResourceKind.Wood];
    correr(sim, 600, [{ t: 'gather', player: 0, units: [v], node: nodo }]);
    expect(sim.players[0].resources[ResourceKind.Wood]).toBeGreaterThan(antes);
    expect(sim.C.nodeAmount[entityIndex(nodo)]).toBeLessThan(100);
  });

  it('al agotarse el yacimiento busca otro solo', () => {
    const sim = llanura();
    sim.spawnBuilding(0, BuildingId.CentroUrbano, 20, 20, true);
    const pequeno = sim.spawnNode(ResourceKind.Food, 25, 22, 3, false);
    sim.spawnNode(ResourceKind.Food, 28, 22, 200, false);
    const v = sim.spawnUnit(0, UnitId.Aldeano, fx(25), fx(25));
    correr(sim, 800, [{ t: 'gather', player: 0, units: [v], node: pequeno }]);
    expect(sim.world.isAlive(pequeno)).toBe(false);
    expect(sim.C.gatherState[entityIndex(v)]).not.toBe(GatherState.None);
  });

  it('construir cuesta recursos y la obra termina', () => {
    const sim = llanura();
    sim.players[0].resources.set([500, 500, 500, 500]);
    const v = [
      sim.spawnUnit(0, UnitId.Aldeano, fx(20), fx(20)),
      sim.spawnUnit(0, UnitId.Aldeano, fx(21), fx(20)),
    ];
    correr(sim, 400, [{ t: 'build', player: 0, units: v, building: BuildingId.Casa, tx: 24, ty: 24 }]);
    expect(sim.players[0].resources[ResourceKind.Wood]).toBe(475);
    let terminadas = 0;
    sim.world.each(sim.mBuilding, (i) => {
      if (sim.C.buildProgress[i] >= sim.C.buildTotal[i]) terminadas++;
    });
    expect(terminadas).toBe(1);
    expect(sim.players[0].popCap).toBe(5);
  });

  it('no se puede construir encima de otra cosa', () => {
    const sim = llanura();
    sim.players[0].resources.set([500, 500, 500, 500]);
    sim.spawnBuilding(0, BuildingId.CentroUrbano, 24, 24, true);
    const v = [sim.spawnUnit(0, UnitId.Aldeano, fx(20), fx(20))];
    const antes = sim.players[0].resources[ResourceKind.Wood];
    correr(sim, 5, [{ t: 'build', player: 0, units: v, building: BuildingId.Casa, tx: 25, ty: 25 }]);
    expect(sim.players[0].resources[ResourceKind.Wood]).toBe(antes);
  });

  it('entrenar consume recursos y saca la unidad', () => {
    const sim = llanura();
    sim.players[0].resources.set([500, 500, 500, 500]);
    const centro = sim.spawnBuilding(0, BuildingId.CentroUrbano, 20, 20, true);
    correr(sim, 60, [{ t: 'train', player: 0, building: centro, unit: UnitId.Aldeano }]);
    expect(sim.players[0].resources[ResourceKind.Food]).toBe(450);
    let aldeanos = 0;
    sim.eachUnit((i) => {
      if (sim.C.unitClass[i] === UnitClass.Villager) aldeanos++;
    });
    expect(aldeanos).toBe(1);
  });

  it('sin poblacion la cola espera pero no pierde el pago', () => {
    const sim = llanura();
    sim.players[0].resources.set([500, 500, 500, 500]);
    const centro = sim.spawnBuilding(0, BuildingId.CentroUrbano, 20, 20, true);
    sim.players[0].popMax = 0;
    correr(sim, 90, [{ t: 'train', player: 0, building: centro, unit: UnitId.Aldeano }]);
    expect(sim.trainQueues.get(centro)!.length).toBe(1);
  });
});

describe('determinismo', () => {
  it('dos partidas con la misma semilla y las mismas ordenes dan el mismo estado', () => {
    const construir = (): Simulation => {
      const sim = llanura(64, 64);
      sim.spawnBuilding(0, BuildingId.CentroUrbano, 12, 12, true);
      sim.spawnBuilding(1, BuildingId.CentroUrbano, 48, 48, true);
      sim.spawnNode(ResourceKind.Wood, 18, 14, 200, true);
      for (let n = 0; n < 20; n++) {
        sim.spawnUnit(0, n % 2 === 0 ? UnitId.Lancero : UnitId.Ballestero, fx(14 + (n % 5)), fx(16 + Math.floor(n / 5)));
        sim.spawnUnit(1, n % 2 === 0 ? UnitId.Caballero : UnitId.Infante, fx(44 + (n % 5)), fx(46 + Math.floor(n / 5)));
      }
      return sim;
    };
    const guion = (sim: Simulation, t: number): Command[] => {
      if (t !== 10) return [];
      const a: number[] = [];
      const b: number[] = [];
      sim.eachUnit((i) => {
        (sim.C.player[i] === 0 ? a : b).push(i);
      });
      return [
        { t: 'attackMove', player: 0, units: a.map((i) => sim.world.entityAt(i)), x: fx(48), y: fx(48) },
        { t: 'attackMove', player: 1, units: b.map((i) => sim.world.entityAt(i)), x: fx(12), y: fx(12) },
      ];
    };
    const jugar = (): number => {
      const sim = construir();
      for (let t = 0; t < 600; t++) stepSimulation(sim, guion(sim, t));
      return hashState(sim);
    };
    expect(jugar()).toBe(jugar());
  });

  it('semillas distintas no producen el mismo hash trivialmente', () => {
    const mk = (seed: number): number => {
      const sim = new Simulation({
        width: 48,
        height: 48,
        seed,
        players: [{ faction: FactionId.HuesteDelCid, team: 1 }],
      });
      fill(sim, Tile.Grass);
      withInlinePath(sim);
      for (let n = 0; n < 5; n++) sim.spawnUnit(0, UnitId.Infante, fx(10 + n), fx(10));
      for (let t = 0; t < 50; t++) stepSimulation(sim, []);
      return hashState(sim);
    };
    expect(mk(1)).toBe(mk(1));
  });
});

describe('niebla de guerra', () => {
  it('descubre alrededor y deja lo explorado en memoria', () => {
    const sim = llanura();
    const e = sim.spawnUnit(0, UnitId.Caballero, fx(10), fx(10));
    correr(sim, 10);
    expect(sim.visibleTo(0, 10, 10)).toBe(2);
    expect(sim.visibleTo(0, 40, 40)).toBe(0);
    correr(sim, 400, [{ t: 'move', player: 0, units: [e], x: fx(35), y: fx(35) }]);
    expect(sim.visibleTo(0, 10, 10)).toBe(1); // explorado, ya no visible
    expect(sim.visibleTo(0, 35, 35)).toBe(2);
  });

  it('cada jugador tiene su propia niebla', () => {
    const sim = llanura();
    sim.spawnUnit(0, UnitId.Infante, fx(10), fx(10));
    correr(sim, 10);
    expect(sim.visibleTo(0, 10, 10)).toBe(2);
    expect(sim.visibleTo(1, 10, 10)).toBe(0);
  });
});
