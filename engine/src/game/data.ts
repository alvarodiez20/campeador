import { fx } from '../core/fixed';
import { DamageKind, ResourceKind, UnitClass } from '../ecs/components';

/**
 * Datos de juego del vertical slice.
 *
 * Regla de alcance del brief: cinco tipos de unidad y el triangulo clasico.
 * Nada de arbol tecnologico. Cada unidad nueva multiplica las interacciones
 * que hay que probar, asi que esta lista no crece hasta que Cuarte 1094 se
 * juegue entero de principio a fin.
 */

export const enum FactionId {
  Castilla = 0,
  Leon = 1,
  Aragon = 2,
  Barcelona = 3,
  Zaragoza = 4,
  Valencia = 5,
  Sevilla = 6,
  Toledo = 7,
  Almoravides = 8,
  /** La hueste propia del Cid en Valencia: cristianos y valencianos juntos. */
  HuesteDelCid = 9,
}

export const enum FactionBloc {
  /** Reinos cristianos del norte. */
  Cristiano = 0,
  /** Taifas andalusies. */
  Taifa = 1,
  /** Imperio almoravide, llegado del Magreb en 1086. */
  Almoravide = 2,
  /** Mesnada propia, sin lealtad fija: el Cid desterrado. */
  Mesnada = 3,
}

export interface FactionDef {
  readonly id: FactionId;
  readonly name: string;
  /** Como se llamaba a si misma, cuando procede. */
  readonly endonym?: string;
  readonly bloc: FactionBloc;
  readonly color: number;
  readonly playable: boolean;
  /** Nota historica que se muestra en la seleccion de faccion. */
  readonly note: string;
}

/**
 * El periodo da las facciones hechas. Las notas no son adorno: fijan el
 * tratamiento. Ver docs/TRATAMIENTO-HISTORICO.md.
 */
export const FACTIONS: readonly FactionDef[] = [
  {
    id: FactionId.Castilla,
    name: 'Reino de Castilla',
    bloc: FactionBloc.Cristiano,
    color: 0xd8c48a,
    playable: false,
    note: 'Bajo Alfonso VI, principal cobrador de parias de las taifas. Su poder venia mas del tributo que de la conquista.',
  },
  {
    id: FactionId.Leon,
    name: 'Reino de Leon',
    bloc: FactionBloc.Cristiano,
    color: 0xa8b4d8,
    playable: false,
    note: 'Unido a Castilla desde 1072. La rivalidad entre Sancho II y Alfonso VI es el origen del destierro de Rodrigo.',
  },
  {
    id: FactionId.Aragon,
    name: 'Reino de Aragon',
    bloc: FactionBloc.Cristiano,
    color: 0xd89a4a,
    playable: false,
    note: 'En Graus (1063) Rodrigo combatio contra Aragon del lado de al-Muqtadir de Zaragoza, aliado de Castilla.',
  },
  {
    id: FactionId.Barcelona,
    name: 'Condado de Barcelona',
    bloc: FactionBloc.Cristiano,
    color: 0xc85a5a,
    playable: false,
    note: 'Berenguer Ramon II fue derrotado por el Cid en Tebar (1090) cuando este servia intereses propios y de Zaragoza.',
  },
  {
    id: FactionId.Zaragoza,
    name: 'Taifa de Zaragoza',
    endonym: 'Taifa Saraqusta',
    bloc: FactionBloc.Taifa,
    color: 0x4aa86a,
    playable: false,
    note: 'Rodrigo sirvio a al-Muqtadir y a al-Mutamin durante cinco anos, mandando ejercitos andalusies contra cristianos.',
  },
  {
    id: FactionId.Valencia,
    name: 'Taifa de Valencia',
    endonym: 'Taifa Balansiya',
    bloc: FactionBloc.Taifa,
    color: 0x59b5b0,
    playable: false,
    note: 'Ciudad de mayoria musulmana gobernada por el Cid desde 1094, con su qadi y su administracion andalusi en pie.',
  },
  {
    id: FactionId.Sevilla,
    name: 'Taifa de Sevilla',
    endonym: 'Taifa Ixbiliya',
    bloc: FactionBloc.Taifa,
    color: 0xb98ad8,
    playable: false,
    note: 'Al-Mutamid llamo a los almoravides en 1086. Escogio, dijo, ser camellero en Africa antes que porquero en Castilla.',
  },
  {
    id: FactionId.Toledo,
    name: 'Taifa de Toledo',
    endonym: 'Taifa Tulaytula',
    bloc: FactionBloc.Taifa,
    color: 0x8a8a8a,
    playable: false,
    note: 'Cayo en 1085. Su perdida rompio el sistema de parias y precipito la llegada de los almoravides.',
  },
  {
    id: FactionId.Almoravides,
    name: 'Almoravides',
    endonym: 'al-Murabitun',
    bloc: FactionBloc.Almoravide,
    // Indigo profundo: tiene que distinguirse a simple vista del dorado de la
    // hueste del Cid incluso a zoom minimo. La legibilidad del color de
    // jugador manda sobre cualquier consideracion estetica.
    color: 0x2f4f8f,
    playable: true,
    note: 'Llegados del Magreb en 1086 a peticion de las propias taifas. Cambian el equilibrio: con ellos las parias se acaban.',
  },
  {
    id: FactionId.HuesteDelCid,
    name: 'Hueste del Cid',
    bloc: FactionBloc.Mesnada,
    color: 0xe8b64a,
    playable: true,
    note: 'Mesnada de desterrados: castellanos, aragoneses y valencianos. Cobra soldada de quien pague, cristiano o musulman.',
  },
];

export function faction(id: FactionId): FactionDef {
  const f = FACTIONS.find((x) => x.id === id);
  if (!f) throw new Error(`faccion desconocida: ${id}`);
  return f;
}

// --------------------------------------------------------------------------
// Unidades
// --------------------------------------------------------------------------

export interface UnitDef {
  readonly id: number;
  readonly key: string;
  /** Nombre por faccion: el mismo rol se llama distinto en cada hueste. */
  readonly names: Partial<Record<FactionBloc, string>>;
  readonly cls: UnitClass;
  readonly hp: number;
  readonly attack: number;
  readonly damageKind: DamageKind;
  readonly bonusVs: UnitClass;
  readonly bonusAmount: number;
  readonly armorMelee: number;
  readonly armorPierce: number;
  /** Alcance en casillas. */
  readonly range: number;
  /** Ticks entre ataques (la simulacion va a 15 Hz). */
  readonly reload: number;
  /** Velocidad en casillas por segundo. */
  readonly speed: number;
  readonly radius: number;
  readonly vision: number;
  readonly cost: Readonly<Record<ResourceKind, number>>;
  readonly trainTicks: number;
  readonly pop: number;
}

export const enum UnitId {
  Aldeano = 0,
  Infante = 1,
  Lancero = 2,
  Caballero = 3,
  Ballestero = 4,
  Campeador = 5,
}

/**
 * El triangulo: el lancero gana a la caballeria, la caballeria gana al
 * arquero, el infante gana al lancero. Los numeros salen de una tabla de
 * combate propia, no de AoE2 (ver docs/BALANCE.md); lo que se copia es la
 * *forma* de la relacion, que es de dominio publico.
 */
export const UNITS: readonly UnitDef[] = [
  {
    id: UnitId.Aldeano,
    key: 'aldeano',
    names: {
      [FactionBloc.Cristiano]: 'Aldeano',
      [FactionBloc.Mesnada]: 'Aldeano',
      [FactionBloc.Taifa]: 'Labrador',
      [FactionBloc.Almoravide]: 'Labrador',
    },
    cls: UnitClass.Villager,
    hp: 40,
    attack: 3,
    damageKind: DamageKind.Melee,
    bonusVs: UnitClass.Villager,
    bonusAmount: 0,
    armorMelee: 0,
    armorPierce: 0,
    range: 0,
    reload: 30,
    speed: 3.2,
    radius: 0.28,
    vision: 6,
    cost: { [ResourceKind.Food]: 50, [ResourceKind.Wood]: 0, [ResourceKind.Gold]: 0, [ResourceKind.Stone]: 0 },
    trainTicks: 30,
    pop: 1,
  },
  {
    id: UnitId.Infante,
    key: 'infante',
    names: {
      [FactionBloc.Cristiano]: 'Peon de espada',
      [FactionBloc.Mesnada]: 'Peon de espada',
      [FactionBloc.Taifa]: 'Infante andalusi',
      [FactionBloc.Almoravide]: 'Peon lamtuni',
    },
    cls: UnitClass.Infantry,
    hp: 60,
    attack: 7,
    damageKind: DamageKind.Melee,
    bonusVs: UnitClass.Spear,
    bonusAmount: 4,
    armorMelee: 1,
    armorPierce: 1,
    range: 0,
    reload: 15,
    speed: 3.4,
    radius: 0.3,
    vision: 7,
    cost: { [ResourceKind.Food]: 60, [ResourceKind.Wood]: 0, [ResourceKind.Gold]: 20, [ResourceKind.Stone]: 0 },
    trainTicks: 33,
    pop: 1,
  },
  {
    id: UnitId.Lancero,
    key: 'lancero',
    names: {
      [FactionBloc.Cristiano]: 'Lancero de la mesnada',
      [FactionBloc.Mesnada]: 'Lancero de la mesnada',
      [FactionBloc.Taifa]: 'Lancero andalusi',
      [FactionBloc.Almoravide]: 'Lancero sanhaya',
    },
    cls: UnitClass.Spear,
    hp: 55,
    attack: 5,
    damageKind: DamageKind.Melee,
    bonusVs: UnitClass.Cavalry,
    bonusAmount: 18,
    armorMelee: 0,
    armorPierce: 0,
    range: 0,
    reload: 15,
    speed: 3.3,
    radius: 0.3,
    vision: 7,
    cost: { [ResourceKind.Food]: 35, [ResourceKind.Wood]: 25, [ResourceKind.Gold]: 0, [ResourceKind.Stone]: 0 },
    trainTicks: 26,
    pop: 1,
  },
  {
    id: UnitId.Caballero,
    key: 'caballero',
    names: {
      [FactionBloc.Cristiano]: 'Caballero villano',
      [FactionBloc.Mesnada]: 'Caballero de la mesnada',
      [FactionBloc.Taifa]: 'Jinete andalusi',
      [FactionBloc.Almoravide]: 'Jinete del desierto',
    },
    cls: UnitClass.Cavalry,
    hp: 110,
    attack: 10,
    damageKind: DamageKind.Melee,
    bonusVs: UnitClass.Archer,
    bonusAmount: 6,
    armorMelee: 2,
    armorPierce: 2,
    range: 0,
    reload: 18,
    speed: 5.4,
    radius: 0.36,
    vision: 8,
    cost: { [ResourceKind.Food]: 80, [ResourceKind.Wood]: 0, [ResourceKind.Gold]: 60, [ResourceKind.Stone]: 0 },
    trainTicks: 45,
    pop: 1,
  },
  {
    id: UnitId.Ballestero,
    key: 'ballestero',
    names: {
      [FactionBloc.Cristiano]: 'Ballestero',
      [FactionBloc.Mesnada]: 'Ballestero',
      [FactionBloc.Taifa]: 'Arquero andalusi',
      [FactionBloc.Almoravide]: 'Arquero almoravide',
    },
    cls: UnitClass.Archer,
    hp: 40,
    attack: 6,
    damageKind: DamageKind.Pierce,
    bonusVs: UnitClass.Infantry,
    bonusAmount: 2,
    armorMelee: 0,
    armorPierce: 0,
    range: 5,
    reload: 26,
    speed: 3.1,
    radius: 0.28,
    vision: 9,
    cost: { [ResourceKind.Food]: 30, [ResourceKind.Wood]: 30, [ResourceKind.Gold]: 30, [ResourceKind.Stone]: 0 },
    trainTicks: 36,
    pop: 1,
  },
  {
    id: UnitId.Campeador,
    key: 'campeador',
    names: {
      [FactionBloc.Mesnada]: 'Rodrigo Diaz, el Campeador',
      [FactionBloc.Almoravide]: 'Abu Bakr ibn Ibrahim',
    },
    cls: UnitClass.Hero,
    hp: 320,
    attack: 18,
    damageKind: DamageKind.Melee,
    bonusVs: UnitClass.Siege,
    bonusAmount: 8,
    armorMelee: 4,
    armorPierce: 4,
    range: 0,
    reload: 16,
    speed: 5.6,
    radius: 0.4,
    vision: 11,
    cost: { [ResourceKind.Food]: 0, [ResourceKind.Wood]: 0, [ResourceKind.Gold]: 0, [ResourceKind.Stone]: 0 },
    trainTicks: 0,
    pop: 0,
  },
];

export function unitDef(id: UnitId): UnitDef {
  return UNITS[id];
}

export function unitName(id: UnitId, bloc: FactionBloc): string {
  const d = UNITS[id];
  return d.names[bloc] ?? d.names[FactionBloc.Cristiano] ?? d.key;
}

// --------------------------------------------------------------------------
// Edificios
// --------------------------------------------------------------------------

export interface BuildingDef {
  readonly id: number;
  readonly key: string;
  readonly names: Partial<Record<FactionBloc, string>>;
  readonly tileW: number;
  readonly tileH: number;
  readonly hp: number;
  readonly buildPoints: number;
  readonly vision: number;
  readonly isDropSite: boolean;
  readonly popProvided: number;
  readonly trains: readonly UnitId[];
  readonly cost: Readonly<Record<ResourceKind, number>>;
}

export const enum BuildingId {
  CentroUrbano = 0,
  Casa = 1,
  Almacen = 2,
  Cuartel = 3,
  Caballerizas = 4,
  Torre = 5,
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: BuildingId.CentroUrbano,
    key: 'centro',
    names: {
      [FactionBloc.Cristiano]: 'Centro urbano',
      [FactionBloc.Mesnada]: 'Alcazar',
      [FactionBloc.Taifa]: 'Alcazaba',
      [FactionBloc.Almoravide]: 'Campamento del emir',
    },
    tileW: 4,
    tileH: 4,
    hp: 1800,
    buildPoints: 900,
    vision: 12,
    isDropSite: true,
    popProvided: 5,
    trains: [UnitId.Aldeano],
    cost: { [ResourceKind.Food]: 0, [ResourceKind.Wood]: 275, [ResourceKind.Gold]: 0, [ResourceKind.Stone]: 100 },
  },
  {
    id: BuildingId.Casa,
    key: 'casa',
    names: {
      [FactionBloc.Cristiano]: 'Casa',
      [FactionBloc.Mesnada]: 'Casa',
      [FactionBloc.Taifa]: 'Vivienda',
      [FactionBloc.Almoravide]: 'Tienda',
    },
    tileW: 2,
    tileH: 2,
    hp: 480,
    buildPoints: 180,
    vision: 4,
    isDropSite: false,
    popProvided: 5,
    trains: [],
    cost: { [ResourceKind.Food]: 0, [ResourceKind.Wood]: 25, [ResourceKind.Gold]: 0, [ResourceKind.Stone]: 0 },
  },
  {
    id: BuildingId.Almacen,
    key: 'almacen',
    names: {
      [FactionBloc.Cristiano]: 'Almacen',
      [FactionBloc.Mesnada]: 'Almacen',
      [FactionBloc.Taifa]: 'Alhondiga',
      [FactionBloc.Almoravide]: 'Deposito',
    },
    tileW: 2,
    tileH: 2,
    hp: 600,
    buildPoints: 210,
    vision: 5,
    isDropSite: true,
    popProvided: 0,
    trains: [],
    cost: { [ResourceKind.Food]: 0, [ResourceKind.Wood]: 100, [ResourceKind.Gold]: 0, [ResourceKind.Stone]: 0 },
  },
  {
    id: BuildingId.Cuartel,
    key: 'cuartel',
    names: {
      [FactionBloc.Cristiano]: 'Cuartel',
      [FactionBloc.Mesnada]: 'Cuartel de la mesnada',
      [FactionBloc.Taifa]: 'Cuartel',
      [FactionBloc.Almoravide]: 'Ribat',
    },
    tileW: 3,
    tileH: 3,
    hp: 900,
    buildPoints: 300,
    vision: 6,
    isDropSite: false,
    popProvided: 0,
    trains: [UnitId.Infante, UnitId.Lancero, UnitId.Ballestero],
    cost: { [ResourceKind.Food]: 0, [ResourceKind.Wood]: 175, [ResourceKind.Gold]: 0, [ResourceKind.Stone]: 0 },
  },
  {
    id: BuildingId.Caballerizas,
    key: 'caballerizas',
    names: {
      [FactionBloc.Cristiano]: 'Caballerizas',
      [FactionBloc.Mesnada]: 'Caballerizas',
      [FactionBloc.Taifa]: 'Cuadras',
      [FactionBloc.Almoravide]: 'Cuadras del desierto',
    },
    tileW: 3,
    tileH: 3,
    hp: 900,
    buildPoints: 330,
    vision: 6,
    isDropSite: false,
    popProvided: 0,
    trains: [UnitId.Caballero],
    cost: { [ResourceKind.Food]: 0, [ResourceKind.Wood]: 175, [ResourceKind.Gold]: 0, [ResourceKind.Stone]: 0 },
  },
  {
    id: BuildingId.Torre,
    key: 'torre',
    names: {
      [FactionBloc.Cristiano]: 'Torre albarrana',
      [FactionBloc.Mesnada]: 'Torre albarrana',
      [FactionBloc.Taifa]: 'Burj',
      [FactionBloc.Almoravide]: 'Torre de asedio',
    },
    tileW: 2,
    tileH: 2,
    hp: 1000,
    buildPoints: 240,
    vision: 12,
    isDropSite: false,
    popProvided: 0,
    trains: [],
    cost: { [ResourceKind.Food]: 0, [ResourceKind.Wood]: 0, [ResourceKind.Gold]: 0, [ResourceKind.Stone]: 125 },
  },
];

export function buildingDef(id: BuildingId): BuildingDef {
  return BUILDINGS[id];
}

export function buildingName(id: BuildingId, bloc: FactionBloc): string {
  const d = BUILDINGS[id];
  return d.names[bloc] ?? d.names[FactionBloc.Cristiano] ?? d.key;
}

/** Velocidad en casillas/segundo -> unidades fixed por tick. */
export function speedPerTick(tilesPerSecond: number, hz: number): number {
  return fx(tilesPerSecond / hz);
}

export const RESOURCE_NAMES: Readonly<Record<ResourceKind, string>> = {
  [ResourceKind.Food]: 'Comida',
  [ResourceKind.Wood]: 'Madera',
  [ResourceKind.Gold]: 'Oro',
  [ResourceKind.Stone]: 'Piedra',
};
