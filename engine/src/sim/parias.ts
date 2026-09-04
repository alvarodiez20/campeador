import { FactionBloc } from '../game/data';
import { ResourceKind } from '../ecs/components';

/**
 * Parias y diplomacia.
 *
 * La paria es un tributo que un reino cristiano cobra a una taifa a cambio de
 * proteccion o de no atacarla. Es oro pasivo, se puede romper unilateralmente
 * en cualquier momento y romperlo tiene consecuencias. Ningun Age of Empires
 * tiene esto y la historia lo regala hecho, asi que es el eje del sistema
 * economico-diplomatico del juego, no un anadido.
 *
 * El bucle de tension que se busca:
 *
 *   exprimir parias -> oro facil sin ejercito -> la taifa se ahoga ->
 *   la taifa llama a los almoravides -> las parias se acaban de golpe
 *   y entra en el mapa un ejercito que no negocia.
 *
 * Es lo que paso entre 1085 y 1086. Al jugador que abusa del tributo le
 * ocurre lo mismo que a Alfonso VI, y por la misma razon.
 */

export const enum DiploStance {
  Guerra = 0,
  Tregua = 1,
  Alianza = 2,
}

export interface PariasContract {
  payer: number;
  receiver: number;
  /** Oro por periodo. */
  rate: number;
  /** Ticks entre pagos. */
  periodTicks: number;
  ticksToNext: number;
  totalPaid: number;
  /** Pagos fallidos consecutivos. Al tercero la taifa deja de pagar de hecho. */
  missed: number;
  sinceTick: number;
  active: boolean;
}

export type DiploEvent =
  | { t: 'pariaFirmada'; payer: number; receiver: number; rate: number }
  | { t: 'pariaPagada'; payer: number; receiver: number; amount: number }
  | { t: 'pariaImpagada'; payer: number; receiver: number; missed: number }
  | { t: 'pariaRota'; breaker: number; other: number; byPayer: boolean }
  | { t: 'guerra'; a: number; b: number }
  | { t: 'tregua'; a: number; b: number }
  | { t: 'llamadaAlmoravide'; nivel: number }
  | { t: 'almoravidesDesembarcan' };

export interface DiplomacyHost {
  readonly playerCount: number;
  blocOf(player: number): FactionBloc;
  teamOf(player: number): number;
  resourceOf(player: number, kind: ResourceKind): number;
  addResource(player: number, kind: ResourceKind, amount: number): void;
  isDefeated(player: number): boolean;
}

/** Umbral de la llamada a los almoravides, en puntos de presion. */
export const LLAMADA_UMBRAL = 1000;

export class Diplomacy {
  private stances: Uint8Array;
  readonly contracts: PariasContract[] = [];
  /** Credito diplomatico por jugador (0..100). Quien traiciona, paga mas caro. */
  readonly credito: Int32Array;
  /** Presion acumulada sobre las taifas. Al llegar al umbral, intervencion. */
  presionAlmoravide = 0;
  almoravidesLlegaron = false;
  readonly events: DiploEvent[] = [];

  constructor(private readonly host: DiplomacyHost) {
    const n = host.playerCount;
    this.stances = new Uint8Array(n * n);
    this.credito = new Int32Array(n).fill(60);
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        this.stances[a * n + b] = a === b ? DiploStance.Alianza : DiploStance.Guerra;
      }
    }
  }

  stance(a: number, b: number): DiploStance {
    return this.stances[a * this.host.playerCount + b] as DiploStance;
  }

  private setStance(a: number, b: number, s: DiploStance): void {
    const n = this.host.playerCount;
    this.stances[a * n + b] = s;
    this.stances[b * n + a] = s;
  }

  hostile(a: number, b: number): boolean {
    if (a === b) return false;
    return this.stance(a, b) === DiploStance.Guerra;
  }

  contractBetween(payer: number, receiver: number): PariasContract | undefined {
    return this.contracts.find((c) => c.active && c.payer === payer && c.receiver === receiver);
  }

  contractsOf(player: number): PariasContract[] {
    return this.contracts.filter((c) => c.active && (c.payer === player || c.receiver === player));
  }

  /** Oro por periodo que un jugador cobra en total. */
  incomeOf(player: number): number {
    let sum = 0;
    for (const c of this.contracts) if (c.active && c.receiver === player) sum += c.rate;
    return sum;
  }

  /** Oro por periodo que un jugador paga en total. */
  tributeOf(player: number): number {
    let sum = 0;
    for (const c of this.contracts) if (c.active && c.payer === player) sum += c.rate;
    return sum;
  }

  /**
   * Tarifa que pediria `receiver` a `payer`. Depende de la presion militar
   * que se ejerza sobre la taifa y del credito del que cobra: a un traidor
   * conocido se le paga menos y de peor gana.
   *
   * @param presionMilitar 0..100, la calcula el sistema militar segun tropas
   *   propias en territorio del pagador.
   */
  tarifa(receiver: number, _payer: number, presionMilitar: number): number {
    const base = 20 + Math.floor(presionMilitar * 0.8);
    const ajusteCredito = Math.floor((this.credito[receiver] - 50) / 10);
    return Math.max(10, base + ajusteCredito * 4);
  }

  /**
   * Firma una paria. Devuelve false si no procede: solo una taifa paga, y
   * solo si hay presion suficiente o ya habia tregua.
   */
  demandar(receiver: number, payer: number, presionMilitar: number, tick: number, periodTicks: number): boolean {
    if (receiver === payer) return false;
    if (this.almoravidesLlegaron) return false; // con ellos en la peninsula, se acabo el tributo
    if (this.host.isDefeated(payer) || this.host.isDefeated(receiver)) return false;
    if (this.host.blocOf(payer) !== FactionBloc.Taifa) return false;
    if (this.host.blocOf(receiver) === FactionBloc.Taifa) return false;
    if (this.contractBetween(payer, receiver)) return false;
    // Se necesita o bien amenaza creible, o bien que ya no haya guerra abierta.
    if (presionMilitar < 25 && this.stance(receiver, payer) === DiploStance.Guerra) return false;

    const rate = this.tarifa(receiver, payer, presionMilitar);
    this.contracts.push({
      payer,
      receiver,
      rate,
      periodTicks,
      ticksToNext: periodTicks,
      totalPaid: 0,
      missed: 0,
      sinceTick: tick,
      active: true,
    });
    this.setStance(receiver, payer, DiploStance.Tregua);
    this.events.push({ t: 'pariaFirmada', payer, receiver, rate });
    return true;
  }

  /**
   * Rompe una paria. Cualquiera de las dos partes puede hacerlo cuando
   * quiera; eso es precisamente lo que la hace interesante.
   *
   * - Si la rompe el pagador, se rebela: deja de pagar y vuelve la guerra.
   * - Si la rompe el cobrador, ataca a quien protegia: pierde credito ante
   *   todas las taifas y sube de golpe la presion almoravide.
   */
  romper(breaker: number, other: number, _tick: number): boolean {
    const c = this.contractBetween(breaker, other) ?? this.contractBetween(other, breaker);
    if (!c) return false;
    c.active = false;
    const byPayer = c.payer === breaker;
    this.setStance(c.payer, c.receiver, DiploStance.Guerra);
    if (byPayer) {
      // Rebelarse cuesta credito, pero menos que traicionar a un protegido.
      this.credito[breaker] = Math.max(0, this.credito[breaker] - 8);
    } else {
      this.credito[breaker] = Math.max(0, this.credito[breaker] - 25);
      this.presionAlmoravide += 150;
    }
    this.events.push({ t: 'pariaRota', breaker, other, byPayer });
    this.events.push({ t: 'guerra', a: c.payer, b: c.receiver });
    return true;
  }

  declararGuerra(a: number, b: number): void {
    if (a === b) return;
    const c = this.contractBetween(a, b) ?? this.contractBetween(b, a);
    if (c) {
      this.romper(a, b, 0);
      return;
    }
    if (this.stance(a, b) === DiploStance.Guerra) return;
    this.setStance(a, b, DiploStance.Guerra);
    this.credito[a] = Math.max(0, this.credito[a] - 10);
    this.events.push({ t: 'guerra', a, b });
  }

  tregua(a: number, b: number): void {
    if (a === b) return;
    if (this.stance(a, b) !== DiploStance.Guerra) return;
    this.setStance(a, b, DiploStance.Tregua);
    this.events.push({ t: 'tregua', a, b });
  }

  /** Un tick de diplomacia. Se llama desde la simulacion. */
  tick(_tick: number): void {
    let presionTributo = 0;
    for (const c of this.contracts) {
      if (!c.active) continue;
      presionTributo += c.rate;
      if (--c.ticksToNext > 0) continue;
      c.ticksToNext = c.periodTicks;
      const disponible = this.host.resourceOf(c.payer, ResourceKind.Gold);
      if (disponible >= c.rate) {
        this.host.addResource(c.payer, ResourceKind.Gold, -c.rate);
        this.host.addResource(c.receiver, ResourceKind.Gold, c.rate);
        c.totalPaid += c.rate;
        c.missed = 0;
        this.events.push({ t: 'pariaPagada', payer: c.payer, receiver: c.receiver, amount: c.rate });
        // Exprimir a una taifa la empuja hacia el Magreb.
        this.presionAlmoravide += Math.max(1, Math.floor(c.rate / 8));
      } else {
        c.missed++;
        this.events.push({ t: 'pariaImpagada', payer: c.payer, receiver: c.receiver, missed: c.missed });
        // La taifa arruinada no puede pagar: tres impagos y se rebela sola.
        this.presionAlmoravide += 20;
        if (c.missed >= 3) this.romper(c.payer, c.receiver, 0);
      }
    }
    // Una taifa sin tributo respira: la presion baja despacio.
    if (presionTributo === 0 && this.presionAlmoravide > 0) this.presionAlmoravide--;

    if (!this.almoravidesLlegaron && this.presionAlmoravide >= LLAMADA_UMBRAL) {
      this.almoravidesLlegaron = true;
      for (const c of this.contracts) {
        if (!c.active) continue;
        c.active = false;
        this.setStance(c.payer, c.receiver, DiploStance.Guerra);
      }
      this.events.push({ t: 'almoravidesDesembarcan' });
    } else if (!this.almoravidesLlegaron) {
      const nivel = Math.floor((this.presionAlmoravide * 4) / LLAMADA_UMBRAL);
      if (nivel !== this.ultimoNivel) {
        this.ultimoNivel = nivel;
        if (nivel > 0) this.events.push({ t: 'llamadaAlmoravide', nivel });
      }
    }
  }

  private ultimoNivel = 0;

  drainEvents(): DiploEvent[] {
    if (this.events.length === 0) return [];
    return this.events.splice(0, this.events.length);
  }
}
