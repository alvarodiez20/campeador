import { describe, expect, it } from 'vitest';
import { ResourceKind } from '../src/ecs/components';
import { FactionBloc } from '../src/game/data';
import { Diplomacy, DiploStance, LLAMADA_UMBRAL, type DiplomacyHost } from '../src/sim/parias';

/** Anfitrion de mentira: la diplomacia no necesita el mundo entero. */
class Banco implements DiplomacyHost {
  readonly recursos: number[][];
  constructor(
    private readonly blocs: FactionBloc[],
    oro: number[],
  ) {
    this.recursos = blocs.map((_, i) => [0, 0, oro[i] ?? 0, 0]);
  }
  get playerCount(): number {
    return this.blocs.length;
  }
  blocOf(p: number): FactionBloc {
    return this.blocs[p];
  }
  teamOf(p: number): number {
    return p + 1;
  }
  resourceOf(p: number, k: ResourceKind): number {
    return this.recursos[p][k];
  }
  addResource(p: number, k: ResourceKind, a: number): void {
    this.recursos[p][k] = Math.max(0, this.recursos[p][k] + a);
  }
  isDefeated(): boolean {
    return false;
  }
}

const CRISTIANO = 0;
const TAIFA = 1;

function montar(oroTaifa = 10000): { d: Diplomacy; h: Banco } {
  const h = new Banco([FactionBloc.Cristiano, FactionBloc.Taifa], [0, oroTaifa]);
  return { d: new Diplomacy(h), h };
}

describe('parias', () => {
  it('solo una taifa paga, y solo con presion militar creible', () => {
    const { d } = montar();
    expect(d.demandar(CRISTIANO, TAIFA, 5, 0, 10)).toBe(false); // sin presion
    expect(d.demandar(CRISTIANO, TAIFA, 60, 0, 10)).toBe(true);
    expect(d.contractBetween(TAIFA, CRISTIANO)).toBeDefined();
  });

  it('una taifa no cobra parias a un reino cristiano', () => {
    const { d } = montar();
    expect(d.demandar(TAIFA, CRISTIANO, 90, 0, 10)).toBe(false);
  });

  it('firmar una paria establece tregua', () => {
    const { d } = montar();
    d.demandar(CRISTIANO, TAIFA, 60, 0, 10);
    expect(d.stance(CRISTIANO, TAIFA)).toBe(DiploStance.Tregua);
    expect(d.hostile(CRISTIANO, TAIFA)).toBe(false);
  });

  it('el tributo pasa de la taifa al cobrador cada periodo', () => {
    const { d, h } = montar(1000);
    d.demandar(CRISTIANO, TAIFA, 60, 0, 5);
    const tarifa = d.contractBetween(TAIFA, CRISTIANO)!.rate;
    for (let t = 0; t < 5; t++) d.tick(t);
    expect(h.resourceOf(CRISTIANO, ResourceKind.Gold)).toBe(tarifa);
    expect(h.resourceOf(TAIFA, ResourceKind.Gold)).toBe(1000 - tarifa);
  });

  it('la tarifa sube con la presion militar', () => {
    const { d } = montar();
    const baja = d.tarifa(CRISTIANO, TAIFA, 10);
    const alta = d.tarifa(CRISTIANO, TAIFA, 90);
    expect(alta).toBeGreaterThan(baja);
  });

  it('el pagador puede rebelarse cuando quiera, y vuelve la guerra', () => {
    const { d } = montar();
    d.demandar(CRISTIANO, TAIFA, 60, 0, 5);
    expect(d.romper(TAIFA, CRISTIANO, 10)).toBe(true);
    expect(d.stance(CRISTIANO, TAIFA)).toBe(DiploStance.Guerra);
    expect(d.contractBetween(TAIFA, CRISTIANO)).toBeUndefined();
  });

  it('romperla desde el que cobra cuesta mucho mas credito', () => {
    const a = montar();
    a.d.demandar(CRISTIANO, TAIFA, 60, 0, 5);
    const creditoAntes = a.d.credito[CRISTIANO];
    a.d.romper(CRISTIANO, TAIFA, 10);
    const perdidaCobrador = creditoAntes - a.d.credito[CRISTIANO];

    const b = montar();
    b.d.demandar(CRISTIANO, TAIFA, 60, 0, 5);
    const antesPagador = b.d.credito[TAIFA];
    b.d.romper(TAIFA, CRISTIANO, 10);
    const perdidaPagador = antesPagador - b.d.credito[TAIFA];

    expect(perdidaCobrador).toBeGreaterThan(perdidaPagador);
  });

  it('tres impagos rompen la paria sola', () => {
    const { d } = montar(0); // taifa arruinada
    d.demandar(CRISTIANO, TAIFA, 60, 0, 2);
    for (let t = 0; t < 10; t++) d.tick(t);
    expect(d.contractBetween(TAIFA, CRISTIANO)).toBeUndefined();
    expect(d.stance(CRISTIANO, TAIFA)).toBe(DiploStance.Guerra);
  });

  it('exprimir a las taifas acaba trayendo a los almoravides', () => {
    const { d } = montar(1_000_000);
    d.demandar(CRISTIANO, TAIFA, 100, 0, 1);
    let t = 0;
    while (!d.almoravidesLlegaron && t < 20000) d.tick(t++);
    expect(d.almoravidesLlegaron).toBe(true);
    expect(d.presionAlmoravide).toBeGreaterThanOrEqual(LLAMADA_UMBRAL);
    // Y con ellos aqui, el sistema de parias deja de existir.
    expect(d.contractBetween(TAIFA, CRISTIANO)).toBeUndefined();
    expect(d.demandar(CRISTIANO, TAIFA, 100, t, 10)).toBe(false);
  });

  it('sin tributo la presion baja despacio', () => {
    const { d } = montar();
    d.presionAlmoravide = 100;
    for (let t = 0; t < 50; t++) d.tick(t);
    expect(d.presionAlmoravide).toBe(50);
  });

  it('declarar la guerra a quien te paga rompe el contrato', () => {
    const { d } = montar();
    d.demandar(CRISTIANO, TAIFA, 60, 0, 5);
    d.declararGuerra(CRISTIANO, TAIFA);
    expect(d.contractBetween(TAIFA, CRISTIANO)).toBeUndefined();
    expect(d.stance(CRISTIANO, TAIFA)).toBe(DiploStance.Guerra);
  });

  it('la renta y el tributo se contabilizan por jugador', () => {
    const { d } = montar();
    d.demandar(CRISTIANO, TAIFA, 60, 0, 5);
    const tarifa = d.contractBetween(TAIFA, CRISTIANO)!.rate;
    expect(d.incomeOf(CRISTIANO)).toBe(tarifa);
    expect(d.tributeOf(TAIFA)).toBe(tarifa);
    expect(d.incomeOf(TAIFA)).toBe(0);
  });

  it('emite eventos para que la interfaz pueda contarlo', () => {
    const { d } = montar(1000);
    d.demandar(CRISTIANO, TAIFA, 60, 0, 2);
    for (let t = 0; t < 3; t++) d.tick(t);
    const ev = d.drainEvents().map((e) => e.t);
    expect(ev).toContain('pariaFirmada');
    expect(ev).toContain('pariaPagada');
    expect(d.drainEvents()).toHaveLength(0);
  });
});
