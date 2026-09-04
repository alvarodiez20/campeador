/**
 * ECS minimo, orientado a datos (SoA sobre TypedArrays).
 *
 * No es un ECS generico de biblioteca: es el minimo que hace falta para
 * 2.000 entidades con iteracion sin asignaciones. Las decisiones importantes:
 *
 *  - Los componentes son columnas de TypedArray indexadas por el *indice* de
 *    la entidad, no por su id. Iterar es recorrer arrays contiguos.
 *  - Las entidades se identifican por un handle de 32 bits: 20 bits de indice
 *    y 12 bits de generacion. Asi un id de una entidad muerta no vuelve a
 *    apuntar a la que reutiliza su hueco (el bug clasico de los RTS: la
 *    orden de atacar sigue viva y ataca a quien nacio en el mismo slot).
 *  - No hay archetypes ni movimiento de memoria: la pertenencia a un
 *    componente es un bit en una mascara. Con 2.000 entidades sobra.
 *
 * Deuda anotada: si el numero de entidades crece un orden de magnitud, tocara
 * pasar a archetypes o a listas densas por componente. Ver docs/DEUDA.md.
 */

export const INDEX_BITS = 20;
export const INDEX_MASK = (1 << INDEX_BITS) - 1;
export const GEN_MASK = 0xfff;

export type Entity = number;
export const NULL_ENTITY: Entity = 0xffffffff;

export function entityIndex(e: Entity): number {
  return e & INDEX_MASK;
}

export function entityGen(e: Entity): number {
  return (e >>> INDEX_BITS) & GEN_MASK;
}

export function makeEntity(index: number, gen: number): Entity {
  return ((gen & GEN_MASK) << INDEX_BITS) | (index & INDEX_MASK);
}

/** Constructor de columnas. Cada componente registra las suyas. */
export type ColumnKind = 'i32' | 'u32' | 'u16' | 'u8' | 'i16';

export interface ColumnSpec {
  readonly name: string;
  readonly kind: ColumnKind;
  readonly default?: number;
}

function allocColumn(kind: ColumnKind, n: number): Int32Array | Uint32Array | Uint16Array | Uint8Array | Int16Array {
  switch (kind) {
    case 'i32':
      return new Int32Array(n);
    case 'u32':
      return new Uint32Array(n);
    case 'u16':
      return new Uint16Array(n);
    case 'i16':
      return new Int16Array(n);
    case 'u8':
      return new Uint8Array(n);
  }
}

export type ColumnArray = Int32Array | Uint32Array | Uint16Array | Uint8Array | Int16Array;

export class Store {
  readonly bit: number;
  readonly columns = new Map<string, ColumnArray>();
  private readonly specs: readonly ColumnSpec[];

  constructor(readonly name: string, bit: number, specs: readonly ColumnSpec[], capacity: number) {
    this.bit = bit;
    this.specs = specs;
    for (const s of specs) this.columns.set(s.name, allocColumn(s.kind, capacity));
  }

  grow(capacity: number): void {
    for (const s of this.specs) {
      const old = this.columns.get(s.name)!;
      const next = allocColumn(s.kind, capacity);
      next.set(old as never);
      this.columns.set(s.name, next);
    }
  }

  reset(index: number): void {
    for (const s of this.specs) {
      this.columns.get(s.name)![index] = s.default ?? 0;
    }
  }

  col(name: string): ColumnArray {
    const c = this.columns.get(name);
    if (!c) throw new Error(`componente ${this.name}: columna desconocida ${name}`);
    return c;
  }
}

export class World {
  capacity: number;
  /** Mascara de componentes por indice. 0 = hueco libre. */
  mask: Uint32Array;
  gen: Uint16Array;
  alive: Uint8Array;
  private free: number[] = [];
  private nextIndex = 1; // el 0 se reserva para "ninguna entidad"
  private stores = new Map<string, Store>();
  private nextBit = 0;
  private growListeners: Array<() => void> = [];
  liveCount = 0;

  constructor(capacity = 4096) {
    this.capacity = capacity;
    this.mask = new Uint32Array(capacity);
    this.gen = new Uint16Array(capacity);
    this.alive = new Uint8Array(capacity);
  }

  register(name: string, specs: readonly ColumnSpec[]): Store {
    if (this.stores.has(name)) throw new Error(`componente duplicado: ${name}`);
    if (this.nextBit >= 32) throw new Error('mas de 32 componentes: amplia la mascara a 64 bits');
    const store = new Store(name, this.nextBit++, specs, this.capacity);
    this.stores.set(name, store);
    return store;
  }

  private growTo(capacity: number): void {
    const m = new Uint32Array(capacity);
    m.set(this.mask);
    this.mask = m;
    const g = new Uint16Array(capacity);
    g.set(this.gen);
    this.gen = g;
    const a = new Uint8Array(capacity);
    a.set(this.alive);
    this.alive = a;
    for (const s of this.stores.values()) s.grow(capacity);
    this.capacity = capacity;
    // Las columnas son arrays nuevos: quien tenga referencias cacheadas debe
    // rehacerlas. Sin esto, un sistema escribiria en el array viejo.
    for (const fn of this.growListeners) fn();
  }

  /** Se invoca despues de cada realojo de columnas. */
  onGrow(fn: () => void): void {
    this.growListeners.push(fn);
  }

  create(): Entity {
    let index: number;
    if (this.free.length > 0) {
      index = this.free.pop()!;
    } else {
      if (this.nextIndex >= this.capacity) this.growTo(this.capacity * 2);
      index = this.nextIndex++;
    }
    this.alive[index] = 1;
    this.mask[index] = 0;
    this.liveCount++;
    return makeEntity(index, this.gen[index]);
  }

  isAlive(e: Entity): boolean {
    const i = entityIndex(e);
    return i < this.capacity && this.alive[i] === 1 && this.gen[i] === entityGen(e);
  }

  destroy(e: Entity): void {
    if (!this.isAlive(e)) return;
    const i = entityIndex(e);
    this.alive[i] = 0;
    this.mask[i] = 0;
    this.gen[i] = (this.gen[i] + 1) & GEN_MASK;
    this.free.push(i);
    this.liveCount--;
  }

  add(e: Entity, store: Store): number {
    const i = entityIndex(e);
    if (!this.isAlive(e)) return -1;
    if ((this.mask[i] & (1 << store.bit)) === 0) {
      store.reset(i);
      this.mask[i] |= 1 << store.bit;
    }
    return i;
  }

  remove(e: Entity, store: Store): void {
    const i = entityIndex(e);
    if (!this.isAlive(e)) return;
    this.mask[i] &= ~(1 << store.bit);
  }

  has(e: Entity, store: Store): boolean {
    const i = entityIndex(e);
    return this.isAlive(e) && (this.mask[i] & (1 << store.bit)) !== 0;
  }

  /** Mascara combinada, para consultas. */
  static maskOf(...stores: readonly Store[]): number {
    let m = 0;
    for (const s of stores) m |= 1 << s.bit;
    return m;
  }

  /**
   * Recorre los indices vivos que cumplen la mascara. El callback recibe el
   * *indice*, no el id: dentro de un sistema se trabaja con indices para no
   * pagar la indireccion. Cero asignaciones por llamada.
   */
  each(required: number, fn: (index: number) => void): void {
    const { mask, alive, nextIndex } = this;
    for (let i = 1; i < nextIndex; i++) {
      if (alive[i] === 1 && (mask[i] & required) === required) fn(i);
    }
  }

  /** Version que ademas excluye una mascara. */
  eachExcept(required: number, excluded: number, fn: (index: number) => void): void {
    const { mask, alive, nextIndex } = this;
    for (let i = 1; i < nextIndex; i++) {
      if (alive[i] === 1 && (mask[i] & required) === required && (mask[i] & excluded) === 0) fn(i);
    }
  }

  /** Id valido a partir de un indice vivo. */
  entityAt(index: number): Entity {
    return makeEntity(index, this.gen[index]);
  }

  get highWater(): number {
    return this.nextIndex;
  }
}
