import { FP_ONE, fx } from '../core/fixed';
import { GatherState, MoveState, ResourceKind, UnitClass } from '../ecs/components';
import { NULL_ENTITY, entityIndex } from '../ecs/world';
import type { CommandQueue } from '../sim/commands';
import type { Simulation } from '../sim/sim';
import { canPlace, presionMilitar } from '../sim/step';
import { findNearestNode } from '../sim/systems/economy';
import { BUILDINGS, BuildingId, FactionBloc, UNITS, UnitId } from './data';
import { DiploStance } from '../sim/parias';

/**
 * IA de escaramuza. No pretende jugar bien: pretende dar un oponente que
 * recolecte, construya y ataque en oleadas para poder probar el escenario de
 * principio a fin. Es lo que el vertical slice necesita y ni una linea mas.
 *
 * Corre una vez cada `PERIOD` ticks, no cada tick: la IA es la clase de
 * sistema que se come el presupuesto de CPU sin que nadie lo note hasta que
 * es tarde.
 */

const PERIOD = 15;

/**
 * Mezcla militar objetivo, en porcentaje. Cubre los cuatro vertices para que
 * el triangulo exista de verdad en la partida. Todavia no reacciona a lo que
 * trae el rival: eso es el punto 4 del plan y la DEUDA-007.
 */
const MEZCLA: ReadonlyArray<{ u: UnitId; cls: UnitClass; cuota: number }> = [
  { u: UnitId.Lancero, cls: UnitClass.Spear, cuota: 30 },
  { u: UnitId.Infante, cls: UnitClass.Infantry, cuota: 25 },
  { u: UnitId.Ballestero, cls: UnitClass.Archer, cuota: 25 },
  { u: UnitId.Caballero, cls: UnitClass.Cavalry, cuota: 20 },
];

export interface AiPersonality {
  /** Aldeanos objetivo antes de volcarse en el ejercito. */
  villagers: number;
  /** Tropas antes de lanzar la primera oleada. */
  waveSize: number;
  /** Cada cuantos ticks intenta una oleada. */
  waveEvery: number;
  /** Reparto de aldeanos por recurso (comida, madera, oro, piedra). */
  gatherMix: [number, number, number, number];
  name: string;
}

export const PERSONALIDADES: Record<string, AiPersonality> = {
  agresivo: { villagers: 14, waveSize: 7, waveEvery: 15 * 55, gatherMix: [4, 4, 3, 1], name: 'agresivo' },
  equilibrado: { villagers: 16, waveSize: 12, waveEvery: 15 * 100, gatherMix: [5, 5, 4, 2], name: 'equilibrado' },
  economico: { villagers: 22, waveSize: 16, waveEvery: 15 * 140, gatherMix: [7, 7, 5, 3], name: 'economico' },
};

export class SimpleAI {
  private nextWave = 15 * 60;
  private counter = 0;
  private rally = { x: 0, y: 0 };
  /** Antirrebote de la diplomacia: no exigir tributo cada quince ticks. */
  private proximaGestion = 15 * 40;

  constructor(
    private readonly sim: Simulation,
    private readonly player: number,
    private readonly queue: CommandQueue,
    private readonly p: AiPersonality = PERSONALIDADES.equilibrado,
  ) {}

  tick(): void {
    if (this.sim.players[this.player].defeated) return;
    if (this.counter++ % PERIOD !== 0) return;
    this.manageEconomy();
    this.trainStuff();
    this.buildStuff();
    this.manageArmy();
    this.manageDiplomacy();
  }

  private myBuildings(type?: BuildingId): number[] {
    const C = this.sim.C;
    const out: number[] = [];
    this.sim.world.each(this.sim.mBuilding, (i) => {
      if (C.player[i] !== this.player) return;
      if (C.buildProgress[i] < C.buildTotal[i]) return;
      if (type !== undefined && C.typeId[i] !== type) return;
      out.push(i);
    });
    return out;
  }

  private myUnits(cls?: UnitClass): number[] {
    const sim = this.sim;
    const C = sim.C;
    const out: number[] = [];
    sim.eachUnit((i) => {
      if (C.player[i] !== this.player) return;
      if (cls !== undefined && C.unitClass[i] !== cls) return;
      out.push(i);
    });
    return out;
  }

  /**
   * Reparto de aldeanos por necesidad, no por cuota fija.
   *
   * La primera version repartia una vez, con una cuota de la personalidad, y
   * solo tocaba a los aldeanos ociosos. El banco de partidas enseno lo que
   * pasaba: con ocho aldeanos y una cuota [5,5,4,2] nadie llegaba nunca al
   * oro ni a la piedra, el reparto inicial se congelaba para siempre, y a los
   * cinco minutos el ejercito era diecisiete lanceros y nada mas, porque el
   * lancero es la unica unidad que no cuesta oro. El triangulo entero
   * colapsado a un vertice por un bucle que no reasignaba.
   *
   * Ahora el reparto se recalcula: la cuota de la personalidad se multiplica
   * por un factor de escasez, y los aldeanos sobrantes de un recurso se
   * mandan al que falta. La histeresis (`MARGEN`) evita que oscilen entre dos
   * yacimientos sin llegar a picar en ninguno.
   */
  private manageEconomy(): void {
    const C = this.sim.C;
    const sim = this.sim;
    const villagers = this.myUnits(UnitClass.Villager);
    if (villagers.length === 0) return;

    const pesos = this.pesosPorEscasez();
    const suma = pesos[0] + pesos[1] + pesos[2] + pesos[3];
    if (suma <= 0) return;

    // Reparto actual.
    const actual = [0, 0, 0, 0];
    const ociosos: number[] = [];
    const porRecurso: number[][] = [[], [], [], []];
    for (const i of villagers) {
      if (C.gatherState[i] === GatherState.None) {
        if (C.moveState[i] === MoveState.Moving) continue; // va a una obra
        ociosos.push(i);
        continue;
      }
      const k = C.carryKind[i];
      actual[k]++;
      porRecurso[k].push(i);
    }

    const total = villagers.length;
    const objetivo = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) objetivo[k] = Math.floor((total * pesos[k]) / suma);
    // El redondeo hacia abajo deja restos; van al recurso mas necesitado.
    let resto = total - (objetivo[0] + objetivo[1] + objetivo[2] + objetivo[3]);
    while (resto-- > 0) {
      let mejor = 0;
      for (let k = 1; k < 4; k++) if (pesos[k] > pesos[mejor]) mejor = k;
      objetivo[mejor]++;
      pesos[mejor] = Math.max(0, pesos[mejor] - 1);
    }

    // Sobrantes: de los recursos con exceso salen los candidatos a mudarse.
    const MARGEN = 1;
    const mudables: number[] = [...ociosos];
    for (let k = 0; k < 4; k++) {
      let sobra = actual[k] - objetivo[k] - MARGEN;
      for (let n = 0; n < porRecurso[k].length && sobra > 0; n++, sobra--) {
        mudables.push(porRecurso[k][n]);
        actual[k]--;
      }
    }
    if (mudables.length === 0) return;

    let cursor = 0;
    for (let k = 0; k < 4 && cursor < mudables.length; k++) {
      while (actual[k] < objetivo[k] && cursor < mudables.length) {
        const i = mudables[cursor++];
        const node = findNearestNode(sim, i, k);
        if (node === NULL_ENTITY) break; // ese recurso se agoto en el mapa
        this.queue.push({ t: 'gather', player: this.player, units: [sim.world.entityAt(i)], node });
        actual[k]++;
      }
    }
    // Lo que quede sin destino, a comida: un aldeano parado es el peor error
    // economico de un RTS.
    for (; cursor < mudables.length; cursor++) {
      const i = mudables[cursor];
      if (C.gatherState[i] !== GatherState.None) continue;
      const node = findNearestNode(sim, i, ResourceKind.Food);
      if (node === NULL_ENTITY) break;
      this.queue.push({ t: 'gather', player: this.player, units: [sim.world.entityAt(i)], node });
    }
  }

  /**
   * Cuota de la personalidad corregida por lo que falta ahora mismo. Un
   * recurso escaso pesa el triple; uno acumulado, la mitad. Y si hay algo
   * concreto que se quiere construir o entrenar y no se puede pagar, el
   * recurso que lo bloquea pesa por encima de todo lo demas.
   */
  private pesosPorEscasez(): number[] {
    const r = this.sim.players[this.player].resources;
    const base = [...this.p.gatherMix];
    const ESCASO = [120, 120, 90, 80];
    const SOBRA = [700, 700, 600, 400];
    for (let k = 0; k < 4; k++) {
      if (r[k] < ESCASO[k]) base[k] *= 3;
      else if (r[k] > SOBRA[k]) base[k] = Math.max(1, Math.floor(base[k] / 2));
    }
    for (const coste of this.bloqueos()) {
      for (let k = 0; k < 4; k++) if ((coste[k] ?? 0) > r[k]) base[k] += 6;
    }
    return base;
  }

  /** Costes de lo que la IA quiere y no puede pagar todavia. */
  private bloqueos(): Array<Readonly<Record<number, number>>> {
    const out: Array<Readonly<Record<number, number>>> = [];
    const pop = this.sim.popOf(this.player);
    if (pop.cap - pop.pop <= 3 && pop.cap < this.sim.players[this.player].popMax) {
      out.push(BUILDINGS[BuildingId.Casa].cost);
    }
    if (this.myBuildings(BuildingId.Cuartel).length === 0) out.push(BUILDINGS[BuildingId.Cuartel].cost);
    if (this.myBuildings(BuildingId.Caballerizas).length === 0) out.push(BUILDINGS[BuildingId.Caballerizas].cost);
    // La mezcla militar objetivo: si falta oro para jinetes e infantes, que se
    // note en el reparto en vez de acabar con un ejercito de solo lanceros.
    for (const u of [UnitId.Caballero, UnitId.Infante, UnitId.Ballestero]) out.push(UNITS[u].cost);
    return out;
  }

  /**
   * Que entrenar. Se elige por la clase mas alejada de su cuota, no por el
   * orden de una lista.
   *
   * La primera version recorria [cuartel: lancero, infante, ballestero;
   * caballerizas: caballero] y encolaba la primera que pudiese pagar. Como el
   * cuartel siempre puede pagar un lancero, nunca se llegaba a las
   * caballerizas: el banco de partidas daba 0,1 jinetes de media al final. Un
   * triangulo con un vertice sin construir no es un triangulo.
   */
  private trainStuff(): void {
    const sim = this.sim;
    const p = sim.players[this.player];
    const pop = sim.popOf(this.player);
    if (pop.pop >= pop.cap) return;

    const villagers = this.myUnits(UnitClass.Villager).length;
    const centros = this.myBuildings(BuildingId.CentroUrbano);
    if (villagers < this.p.villagers && centros.length > 0) {
      const b = sim.world.entityAt(centros[0]);
      if ((sim.trainQueues.get(b)?.length ?? 0) < 3 && sim.canAfford(this.player, UNITS[UnitId.Aldeano].cost)) {
        this.queue.push({ t: 'train', player: this.player, building: b, unit: UnitId.Aldeano });
        return;
      }
    }

    // Reparto actual del ejercito por clase.
    const tengo = new Map<UnitClass, number>();
    let militares = 0;
    for (const i of this.myUnits()) {
      const c = sim.C.unitClass[i] as UnitClass;
      if (c === UnitClass.Villager) continue;
      tengo.set(c, (tengo.get(c) ?? 0) + 1);
      militares++;
    }

    // Deficit respecto a la cuota. Con el ejercito vacio, todos empatan a
    // cero y decide el orden de MEZCLA, que es estable y por tanto
    // determinista.
    const candidatos = MEZCLA.map((m) => ({
      ...m,
      deficit: (militares * m.cuota) / 100 - (tengo.get(m.cls) ?? 0),
    })).sort((a, b) => b.deficit - a.deficit);

    for (const c of candidatos) {
      if (!sim.canAfford(this.player, UNITS[c.u].cost)) {
        // Ahorrar en vez de gastar en lo barato. El jinete cuesta 80 de
        // comida y 60 de oro; si al no poder pagarlo se encola un lancero, el
        // oro nunca llega a juntarse y la caballeria no existe. El banco daba
        // 0,7 jinetes de media con las cuadras ya construidas.
        if (c.deficit >= 1) return;
        continue;
      }
      // Guarda de economia: no vaciar la despensa por tropa mientras la
      // recoleccion esta a medio montar. Con el objetivo entero (y no con una
      // fraccion) una taifa pequena no entrenaba un solo soldado en toda la
      // partida, porque nunca llegaba a sus veintidos aldeanos.
      if (p.resources[ResourceKind.Food] < 120 && villagers < this.p.villagers * 0.6) continue;
      const edificios = this.myBuildings().filter((b) => BUILDINGS[sim.C.typeId[b]].trains.includes(c.u));
      for (const b of edificios) {
        const e = sim.world.entityAt(b);
        if ((sim.trainQueues.get(e)?.length ?? 0) >= 2) continue;
        this.queue.push({ t: 'train', player: this.player, building: e, unit: c.u });
        return;
      }
    }
  }

  /**
   * Que construir. Lista de deseos en orden, y se levanta el primero que se
   * pueda pagar y no este ya en curso.
   *
   * La version anterior elegia un unico deseo y si no podia pagarlo se
   * quedaba parada ese ciclo. Resultado en el banco: las caballerizas se
   * levantaban en cuatro de cada cinco partidas y tarde, porque el bloqueo de
   * poblacion nunca daba paso.
   */
  private buildStuff(): void {
    const sim = this.sim;
    const pop = sim.popOf(this.player);
    const centros = this.myBuildings(BuildingId.CentroUrbano);

    const deseos: BuildingId[] = [];
    // Sin centro urbano no hay aldeanos nuevos: reconstruirlo es lo primero.
    // Sin esto, quien descabeza a la IA se queda con un rival zombi que ya no
    // vuelve a la partida; el banco lo veia como campamentos a 0,5 de media.
    if (centros.length === 0) deseos.push(BuildingId.CentroUrbano);
    if (pop.cap - pop.pop <= 4 && pop.cap < sim.players[this.player].popMax) deseos.push(BuildingId.Casa);
    if (this.myBuildings(BuildingId.Cuartel).length === 0) deseos.push(BuildingId.Cuartel);
    if (this.myBuildings(BuildingId.Caballerizas).length === 0) deseos.push(BuildingId.Caballerizas);
    if (deseos.length === 0) return;

    // Punto de referencia: el centro urbano, o el primer edificio que quede.
    let ancla = centros[0];
    if (ancla === undefined) {
      const todos = this.myBuildings();
      if (todos.length === 0) return;
      ancla = todos[0];
    }
    const cx = Math.round(sim.C.tx[ancla] / FP_ONE);
    const cy = Math.round(sim.C.ty[ancla] / FP_ONE);

    for (const quiere of deseos) {
      const def = BUILDINGS[quiere];
      if (!sim.canAfford(this.player, def.cost)) continue;
      const tope = quiere === BuildingId.Casa ? 2 : 1;
      let enCurso = 0;
      for (const site of sim.builders.keys()) {
        if (sim.world.isAlive(site) && sim.C.typeId[entityIndex(site)] === quiere) enCurso++;
      }
      if (enCurso >= tope) continue;
      if (this.intentarObra(quiere, cx, cy)) return;
    }
  }

  /** Busca hueco en anillos alrededor del ancla y encola la obra. */
  private intentarObra(quiere: BuildingId, cx: number, cy: number): boolean {
    const sim = this.sim;
    const def = BUILDINGS[quiere];
    for (let r = 3; r < 16; r++) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const tx = cx + Math.round(Math.cos(ang) * r);
        const ty = cy + Math.round(Math.sin(ang) * r);
        if (!canPlace(sim, tx, ty, def.tileW, def.tileH)) continue;
        const libres = this.myUnits(UnitClass.Villager)
          .filter((i) => sim.C.gatherState[i] !== GatherState.None)
          .slice(0, 2);
        if (libres.length === 0) return false;
        this.queue.push({
          t: 'build',
          player: this.player,
          units: libres.map((i) => sim.world.entityAt(i)),
          building: quiere,
          tx,
          ty,
        });
        return true;
      }
    }
    return false;
  }

  private manageArmy(): void {
    const sim = this.sim;
    const army = this.myUnits().filter((i) => sim.C.unitClass[i] !== UnitClass.Villager);
    if (army.length === 0) return;

    // Si la atricion no deja juntar nunca la oleada completa, se ataca con lo
    // que haya. Sin esto la partida entra en punto muerto: la IA pierde una
    // unidad por minuto, nunca llega a las doce que se ha propuesto y se pasa
    // el resto del tiempo reagrupando. En el banco eran una de cada cinco
    // partidas sin resolver a los veinte minutos.
    const impaciente = sim.tick > this.nextWave + this.p.waveEvery && army.length >= 5;
    if (!impaciente && (sim.tick < this.nextWave || army.length < this.p.waveSize)) {
      // Reagrupar cerca del centro mientras se junta la oleada.
      const centros = this.myBuildings(BuildingId.CentroUrbano);
      if (centros.length === 0) return;
      const c = centros[0];
      this.rally = { x: sim.C.tx[c] / FP_ONE, y: sim.C.ty[c] / FP_ONE + 4 };
      // Nunca reagrupar a quien tiene al enemigo delante.
      //
      // Esta linea costo doce oleadas por partida sin resultado. La unidad
      // llegaba al campamento enemigo, se quedaba sin blanco al matar a los
      // defensores y, quince ticks despues, la IA la mandaba a casa por estar
      // "dispersa" a cuarenta casillas del punto de reunion. Volvia, salia
      // otra vez, y asi veinte minutos: en el banco eran una de cada cinco
      // partidas sin resolver, con el rival deshecho y todos sus edificios en
      // pie.
      const objetivos = this.edificiosEnemigos();
      const dispersos = army.filter((i) => {
        const dx = sim.C.tx[i] / FP_ONE - this.rally.x;
        const dy = sim.C.ty[i] / FP_ONE - this.rally.y;
        if (dx * dx + dy * dy <= 14 * 14) return false;
        if (sim.C.moveState[i] === MoveState.Moving) return false;
        if (sim.C.target[i] !== 0xffffffff) return false;
        return !this.cercaDe(objetivos, i, 12);
      });
      if (dispersos.length > 0) {
        this.queue.push({
          t: 'move',
          player: this.player,
          units: dispersos.map((i) => sim.world.entityAt(i)),
          x: fx(this.rally.x),
          y: fx(this.rally.y),
        });
      }
      return;
    }

    const objetivo = this.pickTarget();
    if (!objetivo) return;
    this.nextWave = sim.tick + this.p.waveEvery;
    this.queue.push({
      t: 'attackMove',
      player: this.player,
      units: army.map((i) => sim.world.entityAt(i)),
      x: objetivo.x,
      y: objetivo.y,
    });
    sim.emit({ t: 'oleada', player: this.player, tamano: army.length });
  }

  /**
   * Objetivo de la oleada: el centro urbano enemigo, y solo si no hay
   * ninguno, el edificio mas cercano.
   *
   * Con "siempre el mas cercano", una de cada cinco partidas se quedaba sin
   * resolver a los veinte minutos: el rival ya deshecho pero con siete casas
   * en pie que nadie remataba. Con "siempre el centro urbano" fue peor, mas
   * de la mitad: la oleada se estrella una y otra vez contra el edificio de
   * 1800 puntos de vida y mejor defendido, en vez de comerse lo que tiene
   * delante. La regla que funciona depende de la fase: mientras el rival
   * tenga ejercito, lo mas cercano; cuando ya no lo tiene, a rematar.
   */
  private pickTarget(): { x: number; y: number } | null {
    const sim = this.sim;
    const C = sim.C;
    const centros = this.myBuildings(BuildingId.CentroUrbano);
    const ox = centros.length > 0 ? C.tx[centros[0]] : 0;
    const oy = centros.length > 0 ? C.ty[centros[0]] : 0;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    let bestPrioridad = -1;
    const remate = this.enemigoDeshecho();
    sim.world.each(sim.mBuilding, (i) => {
      if (!sim.enemies(this.player, C.player[i])) return;
      const prioridad = remate && C.typeId[i] === BuildingId.CentroUrbano ? 1 : 0;
      const dx = C.tx[i] - ox;
      const dy = C.ty[i] - oy;
      const d = dx * dx + dy * dy;
      if (prioridad > bestPrioridad || (prioridad === bestPrioridad && d < bestD)) {
        bestPrioridad = prioridad;
        bestD = d;
        best = { x: C.tx[i], y: C.ty[i] };
      }
    });
    return best;
  }

  /** Posiciones de los edificios enemigos, en casillas. */
  private edificiosEnemigos(): Array<{ x: number; y: number }> {
    const sim = this.sim;
    const C = sim.C;
    const out: Array<{ x: number; y: number }> = [];
    sim.world.each(sim.mBuilding, (i) => {
      if (!sim.enemies(this.player, C.player[i])) return;
      out.push({ x: C.tx[i] / FP_ONE, y: C.ty[i] / FP_ONE });
    });
    return out;
  }

  private cercaDe(puntos: Array<{ x: number; y: number }>, i: number, casillas: number): boolean {
    const C = this.sim.C;
    const x = C.tx[i] / FP_ONE;
    const y = C.ty[i] / FP_ONE;
    const r2 = casillas * casillas;
    for (const p of puntos) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  }

  /** true si a ningun enemigo le quedan tropas con las que defenderse. */
  private enemigoDeshecho(): boolean {
    const sim = this.sim;
    const C = sim.C;
    let militares = 0;
    sim.eachUnit((i) => {
      if (!sim.enemies(this.player, C.player[i])) return;
      if (C.unitClass[i] !== UnitClass.Villager) militares++;
    });
    return militares < 4;
  }

  /**
   * Diplomacia de la IA: cobrar parias y dejar de pagarlas.
   *
   * En el primer banco de partidas se firmaron parias en 0 de 12: la IA solo
   * gestionaba contratos existentes y ninguna los iniciaba nunca, asi que la
   * mecanica central del juego no aparecia en una partida normal. Ahora quien
   * puede cobrar manda una escuadra a la puerta de la taifa —que es como se
   * cobraba de verdad, con hueste delante— y despues exige el tributo.
   */
  private manageDiplomacy(): void {
    const sim = this.sim;
    const d = sim.diplomacy;

    // Pagador: una taifa exprimida acaba rompiendo la paria. No por traicion,
    // sino porque no puede pagarla y prefiere arriesgarse. Es lo que hizo
    // al-Mutamid en 1085.
    for (const c of d.contractsOf(this.player)) {
      if (c.payer !== this.player) continue;
      const oro = sim.resourceOf(this.player, ResourceKind.Gold);
      if (oro < c.rate && c.missed >= 2) {
        this.queue.push({ t: 'breakParias', player: this.player, other: c.receiver });
        sim.emit({ t: 'taifaSeRebela', player: this.player, contra: c.receiver });
      }
    }

    // Cobrador: solo quien no es taifa puede exigir tributo.
    if (sim.blocOf(this.player) === FactionBloc.Taifa) return;
    if (d.almoravidesLlegaron) return;
    if (sim.tick < this.proximaGestion) return;

    for (const otro of sim.players) {
      if (otro.id === this.player || otro.defeated) continue;
      if (sim.blocOf(otro.id) !== FactionBloc.Taifa) continue;
      if (d.contractBetween(otro.id, this.player)) continue;

      const presion = presionMilitar(sim, this.player, otro.id);
      if (presion >= 25 || d.stance(this.player, otro.id) !== DiploStance.Guerra) {
        this.proximaGestion = sim.tick + 15 * 30;
        this.queue.push({ t: 'demandParias', player: this.player, from: otro.id });
        return;
      }
      this.presionarTaifa(otro.id);
      return;
    }
  }

  /**
   * Manda una escuadra a la puerta de la taifa para tener con que exigir.
   * Se lleva como mucho un tercio del ejercito: el resto sigue defendiendo,
   * porque quedarse sin tropa en casa por cobrar tributo es exactamente el
   * error que costo Sagrajas.
   */
  private presionarTaifa(taifa: number): void {
    const sim = this.sim;
    const C = sim.C;
    const army = this.myUnits().filter((i) => C.unitClass[i] !== UnitClass.Villager);
    if (army.length < 6) return;
    const escuadra = army.slice(0, Math.max(3, Math.floor(army.length / 3)));

    let destino: { x: number; y: number } | null = null;
    sim.world.each(sim.mBuilding, (b) => {
      if (C.player[b] !== taifa) return;
      if (destino === null) destino = { x: C.tx[b], y: C.ty[b] };
    });
    if (destino === null) return;

    this.proximaGestion = sim.tick + 15 * 45;
    this.queue.push({
      t: 'move',
      player: this.player,
      units: escuadra.map((i) => sim.world.entityAt(i)),
      x: (destino as { x: number; y: number }).x,
      y: (destino as { x: number; y: number }).y + FP_ONE * 8,
    });
  }
}
