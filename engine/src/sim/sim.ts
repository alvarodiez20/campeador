import { FP_ONE, FP_SHIFT, fx, type Fixed } from '../core/fixed';
import { Rng } from '../core/rng';
import {
  Components,
  GatherState,
  MoveState,
  ResourceKind,
  RESOURCE_COUNT,
  Stance,
  UnitClass,
} from '../ecs/components';
import { World, type Entity, NULL_ENTITY, entityIndex } from '../ecs/world';
import {
  BUILDINGS,
  FactionBloc,
  FactionId,
  UNITS,
  buildingDef,
  faction,
  speedPerTick,
  type BuildingId,
  type UnitId,
} from '../game/data';
import { PathService } from '../path/service';
import { Diplomacy, type DiplomacyHost } from './parias';
import { SpatialGrid } from './spatial';
import { Terrain } from './terrain';

export const HZ = 15;
export const TICK_MS = 1000 / HZ;

export interface PlayerState {
  readonly id: number;
  readonly faction: FactionId;
  readonly bloc: FactionBloc;
  team: number;
  readonly color: number;
  readonly resources: Int32Array;
  pop: number;
  popCap: number;
  popMax: number;
  defeated: boolean;
  /** Solo para la IA y el HUD: no afecta a la simulacion. */
  name: string;
}

export interface SimEvent {
  t: string;
  [k: string]: unknown;
}

export interface SimOptions {
  width: number;
  height: number;
  seed?: number;
  players: Array<{ faction: FactionId; team: number; name?: string }>;
}

/** Periodo de pago de parias: 45 s de juego. */
export const PARIAS_PERIOD_TICKS = HZ * 45;

export class Simulation implements DiplomacyHost {
  readonly world: World;
  readonly C: Components;
  readonly terrain: Terrain;
  readonly grid: SpatialGrid;
  readonly rng: Rng;
  readonly players: PlayerState[] = [];
  readonly diplomacy: Diplomacy;
  path!: PathService;
  tick = 0;
  readonly events: SimEvent[] = [];

  /** Mascaras precalculadas de consulta. */
  readonly mUnit: number;
  readonly mMover: number;
  readonly mCombat: number;
  readonly mBody: number;
  readonly mGatherer: number;
  readonly mNode: number;
  readonly mBuilding: number;

  /** Colas de entrenamiento por edificio. Fuera del ECS: no es codigo caliente. */
  readonly trainQueues = new Map<Entity, UnitId[]>();
  readonly trainProgress = new Map<Entity, number>();
  /** Constructores asignados a cada obra. */
  readonly builders = new Map<Entity, Set<Entity>>();

  /** Visibilidad por jugador: 0 desconocido, 1 explorado, 2 visible. */
  readonly fog: Uint8Array[] = [];
  private fogTick = 0;

  private scratchIdx: Int32Array;
  private pendingCost: number[] = [];
  private pendingCostVal: number[] = [];

  /** Se llama al final de cada tick; el escenario decide la victoria. */
  onCheckVictory: ((sim: Simulation) => void) | null = null;

  constructor(opts: SimOptions) {
    this.world = new World(4096);
    this.C = new Components(this.world);
    this.terrain = new Terrain(opts.width, opts.height);
    this.grid = new SpatialGrid(opts.width, opts.height, 4, 4096);
    this.rng = new Rng(opts.seed ?? 0xc1d0);
    this.scratchIdx = new Int32Array(4096);

    opts.players.forEach((p, i) => {
      const def = faction(p.faction);
      this.players.push({
        id: i,
        faction: p.faction,
        bloc: def.bloc,
        team: p.team,
        color: def.color,
        resources: Int32Array.from([200, 200, 100, 100]),
        pop: 0,
        popCap: 0,
        popMax: 75,
        defeated: false,
        name: p.name ?? def.name,
      });
      this.fog.push(new Uint8Array(opts.width * opts.height));
    });

    this.diplomacy = new Diplomacy(this);

    const C = this.C;
    this.mBody = World.maskOf(C.transform, C.owner);
    this.mUnit = World.maskOf(C.transform, C.owner, C.kind, C.health);
    this.mMover = World.maskOf(C.transform, C.motion);
    this.mCombat = World.maskOf(C.transform, C.combat, C.owner, C.health);
    this.mGatherer = World.maskOf(C.transform, C.gather, C.owner);
    this.mNode = World.maskOf(C.transform, C.node);
    this.mBuilding = World.maskOf(C.transform, C.building, C.owner, C.health);
  }

  attachPath(p: PathService): void {
    this.path = p;
  }

  // ---- DiplomacyHost -----------------------------------------------------
  get playerCount(): number {
    return this.players.length;
  }
  blocOf(player: number): FactionBloc {
    return this.players[player].bloc;
  }
  teamOf(player: number): number {
    return this.players[player].team;
  }
  resourceOf(player: number, kind: ResourceKind): number {
    return this.players[player].resources[kind];
  }
  addResource(player: number, kind: ResourceKind, amount: number): void {
    const p = this.players[player];
    p.resources[kind] = Math.max(0, p.resources[kind] + amount);
  }
  isDefeated(player: number): boolean {
    return this.players[player].defeated;
  }

  // ---- consultas ---------------------------------------------------------

  /** true si `a` puede atacar a `b`. Los aliados y las treguas no se pegan. */
  enemies(a: number, b: number): boolean {
    if (a === b) return false;
    if (this.players[a].team === this.players[b].team && this.players[a].team !== 0) return false;
    return this.diplomacy.hostile(a, b);
  }

  emit(e: SimEvent): void {
    this.events.push(e);
  }

  drainEvents(): SimEvent[] {
    const diplo = this.diplomacy.drainEvents();
    for (const d of diplo) this.events.push(d as unknown as SimEvent);
    if (this.events.length === 0) return [];
    return this.events.splice(0, this.events.length);
  }

  // ---- fabricas ----------------------------------------------------------

  spawnUnit(player: number, unitId: UnitId, x: Fixed, y: Fixed): Entity {
    const def = UNITS[unitId];
    const w = this.world;
    const C = this.C;
    const e = w.create();
    const i = w.add(e, C.transform);
    C.tx[i] = x;
    C.ty[i] = y;
    C.facing[i] = 0;
    C.radius[i] = fx(def.radius);

    w.add(e, C.motion);
    C.speed[i] = speedPerTick(def.speed, HZ);
    C.moveState[i] = MoveState.Idle;
    C.flowId[i] = 0;

    w.add(e, C.health);
    C.hp[i] = def.hp;
    C.maxHp[i] = def.hp;
    C.armorMelee[i] = def.armorMelee;
    C.armorPierce[i] = def.armorPierce;

    w.add(e, C.combat);
    C.attack[i] = def.attack;
    C.damageKind[i] = def.damageKind;
    C.bonusVs[i] = def.bonusVs;
    C.bonusAmount[i] = def.bonusAmount;
    C.range[i] = fx(def.range) + fx(def.radius);
    C.reload[i] = def.reload;
    C.cooldown[i] = 0;
    C.target[i] = NULL_ENTITY;
    C.stance[i] = def.cls === UnitClass.Villager ? Stance.Defensive : Stance.Aggressive;
    C.aggro[i] = fx(def.cls === UnitClass.Villager ? 3 : 7);

    w.add(e, C.owner);
    C.player[i] = player;
    w.add(e, C.kind);
    C.unitClass[i] = def.cls;
    C.typeId[i] = unitId;

    w.add(e, C.vision);
    C.visionRadius[i] = fx(def.vision);
    w.add(e, C.selectable);
    C.selectFlag[i] = 0;

    if (def.cls === UnitClass.Villager) {
      w.add(e, C.gather);
      C.carryCap[i] = 10;
      C.gatherState[i] = GatherState.None;
      C.gatherTarget[i] = NULL_ENTITY;
      C.dropSite[i] = NULL_ENTITY;
    }

    this.players[player].pop += def.pop;
    return e;
  }

  spawnBuilding(player: number, buildingId: BuildingId, tx: number, ty: number, complete: boolean): Entity {
    const def = buildingDef(buildingId);
    const w = this.world;
    const C = this.C;
    const e = w.create();
    const i = w.add(e, C.transform);
    C.tx[i] = ((tx << FP_SHIFT) + ((def.tileW * FP_ONE) >> 1)) | 0;
    C.ty[i] = ((ty << FP_SHIFT) + ((def.tileH * FP_ONE) >> 1)) | 0;
    C.radius[i] = (Math.max(def.tileW, def.tileH) * FP_ONE) >> 1;

    w.add(e, C.health);
    C.maxHp[i] = def.hp;
    C.hp[i] = complete ? def.hp : Math.max(1, (def.hp / 4) | 0);

    w.add(e, C.owner);
    C.player[i] = player;
    w.add(e, C.kind);
    C.unitClass[i] = UnitClass.Siege;
    C.typeId[i] = buildingId;

    w.add(e, C.building);
    C.buildTotal[i] = def.buildPoints;
    C.buildProgress[i] = complete ? def.buildPoints : 0;
    C.tileW[i] = def.tileW;
    C.tileH[i] = def.tileH;
    C.isDropSite[i] = def.isDropSite ? 1 : 0;

    w.add(e, C.vision);
    C.visionRadius[i] = fx(def.vision);
    w.add(e, C.selectable);

    for (let y = ty; y < ty + def.tileH; y++) {
      for (let x = tx; x < tx + def.tileW; x++) {
        this.terrain.block(x, y);
        this.pendingCost.push(this.terrain.idx(x, y));
        this.pendingCostVal.push(0);
      }
    }
    if (complete) this.players[player].popCap += def.popProvided;
    return e;
  }

  spawnNode(kind: ResourceKind, tx: number, ty: number, amount: number, blocks: boolean): Entity {
    const w = this.world;
    const C = this.C;
    const e = w.create();
    const i = w.add(e, C.transform);
    C.tx[i] = (tx << FP_SHIFT) + (FP_ONE >> 1);
    C.ty[i] = (ty << FP_SHIFT) + (FP_ONE >> 1);
    C.radius[i] = FP_ONE >> 1;
    w.add(e, C.node);
    C.nodeKind[i] = kind;
    C.nodeAmount[i] = amount;
    if (blocks) {
      this.terrain.block(tx, ty);
      this.pendingCost.push(this.terrain.idx(tx, ty));
      this.pendingCostVal.push(0);
    }
    return e;
  }

  destroyEntity(e: Entity): void {
    const w = this.world;
    const C = this.C;
    if (!w.isAlive(e)) return;
    const i = entityIndex(e);
    if (w.has(e, C.building)) {
      const tx = (C.tx[i] - ((C.tileW[i] * FP_ONE) >> 1)) >> FP_SHIFT;
      const ty = (C.ty[i] - ((C.tileH[i] * FP_ONE) >> 1)) >> FP_SHIFT;
      for (let y = ty; y < ty + C.tileH[i]; y++) {
        for (let x = tx; x < tx + C.tileW[i]; x++) {
          this.terrain.unblock(x, y);
          this.pendingCost.push(this.terrain.idx(x, y));
          this.pendingCostVal.push(this.terrain.cost[this.terrain.idx(x, y)]);
        }
      }
      const def = BUILDINGS[C.typeId[i]];
      if (C.buildProgress[i] >= C.buildTotal[i]) this.players[C.player[i]].popCap -= def.popProvided;
      this.trainQueues.delete(e);
      this.trainProgress.delete(e);
      this.builders.delete(e);
    } else if (w.has(e, C.kind) && w.has(e, C.owner)) {
      const def = UNITS[C.typeId[i]];
      if (def) this.players[C.player[i]].pop -= def.pop;
    }
    if (w.has(e, C.motion) && C.flowId[i] !== 0 && this.path) {
      this.path.release(C.flowId[i]);
      C.flowId[i] = 0;
    }
    w.destroy(e);
  }

  /** Empuja los cambios de coste al worker. Se llama una vez por tick. */
  flushCostPatches(): void {
    if (this.pendingCost.length === 0 || !this.path) return;
    const cells = Int32Array.from(this.pendingCost);
    const values = Uint8Array.from(this.pendingCostVal);
    this.pendingCost.length = 0;
    this.pendingCostVal.length = 0;
    this.path.patch(cells, values);
    this.path.invalidateAll();
  }

  // ---- utilidades espaciales --------------------------------------------

  /**
   * Recorre solo las unidades: la mascara `mUnit` tambien casa con los
   * edificios, que tienen transform, owner, kind y health como cualquier
   * unidad. Cada sitio que queria "las unidades" repetia el filtro a mano y
   * bastaba olvidarlo una vez para barrer la ciudad entera sin enterarse.
   */
  eachUnit(fn: (index: number) => void): void {
    this.world.eachExcept(this.mUnit, 1 << this.C.building.bit, fn);
  }

  /** Rellena `scratchIdx` con los indices vivos que cumplen la mascara. */
  collect(mask: number): { idx: Int32Array; count: number } {
    if (this.scratchIdx.length < this.world.highWater) this.scratchIdx = new Int32Array(this.world.highWater * 2);
    const idx = this.scratchIdx;
    let n = 0;
    this.world.each(mask, (i) => {
      idx[n++] = i;
    });
    return { idx, count: n };
  }

  /** Poblacion util para la UI. */
  popOf(player: number): { pop: number; cap: number } {
    const p = this.players[player];
    return { pop: p.pop, cap: Math.min(p.popMax, p.popCap) };
  }

  canAfford(player: number, cost: Readonly<Record<number, number>>): boolean {
    const r = this.players[player].resources;
    for (let k = 0; k < RESOURCE_COUNT; k++) if (r[k] < (cost[k] ?? 0)) return false;
    return true;
  }

  pay(player: number, cost: Readonly<Record<number, number>>): void {
    const r = this.players[player].resources;
    for (let k = 0; k < RESOURCE_COUNT; k++) r[k] -= cost[k] ?? 0;
  }

  refund(player: number, cost: Readonly<Record<number, number>>): void {
    const r = this.players[player].resources;
    for (let k = 0; k < RESOURCE_COUNT; k++) r[k] += cost[k] ?? 0;
  }

  // ---- niebla de guerra --------------------------------------------------

  updateFog(): void {
    // Se refresca una vez cada 5 ticks: a 15 Hz son 3 veces por segundo, que
    // es de sobra para lo que el ojo distingue y ahorra el 80% del coste.
    if (this.fogTick++ % 5 !== 0) return;
    const { width, height } = this.terrain;
    const C = this.C;
    for (const f of this.fog) {
      for (let i = 0; i < f.length; i++) if (f[i] === 2) f[i] = 1;
    }
    const mask = World.maskOf(C.transform, C.owner, C.vision);
    this.world.each(mask, (i) => {
      const p = C.player[i];
      const fogp = this.fog[p];
      const r = C.visionRadius[i] >> FP_SHIFT;
      const cx = C.tx[i] >> FP_SHIFT;
      const cy = C.ty[i] >> FP_SHIFT;
      const r2 = r * r;
      const y0 = Math.max(0, cy - r);
      const y1 = Math.min(height - 1, cy + r);
      const x0 = Math.max(0, cx - r);
      const x1 = Math.min(width - 1, cx + r);
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        const row = y * width;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          if (dx * dx + dy * dy <= r2) fogp[row + x] = 2;
        }
      }
    });
  }

  visibleTo(player: number, tx: number, ty: number): number {
    if (!this.terrain.inBounds(tx, ty)) return 0;
    return this.fog[player][ty * this.terrain.width + tx];
  }
}
