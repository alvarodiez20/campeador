import { World, type Store } from './world';

/**
 * Columnas de la simulacion. Se exponen como referencias directas a los
 * TypedArray para que los sistemas trabajen sin indirecciones; `refresh()`
 * las rehace cuando el mundo crece.
 */

export const enum UnitClass {
  Villager = 0,
  Infantry = 1,
  Cavalry = 2,
  Spear = 3,
  Archer = 4,
  Siege = 5,
  Hero = 6,
}

export const enum MoveState {
  Idle = 0,
  Moving = 1,
  Arrived = 2,
}

export const enum Stance {
  Aggressive = 0,
  Defensive = 1,
  StandGround = 2,
}

export const enum GatherState {
  None = 0,
  ToNode = 1,
  Gathering = 2,
  ToDrop = 3,
}

export const enum ResourceKind {
  Food = 0,
  Wood = 1,
  Gold = 2,
  Stone = 3,
}
export const RESOURCE_COUNT = 4;

export const enum DamageKind {
  Melee = 0,
  Pierce = 1,
  Siege = 2,
}

export class Components {
  readonly transform: Store;
  readonly motion: Store;
  readonly health: Store;
  readonly combat: Store;
  readonly owner: Store;
  readonly kind: Store;
  readonly gather: Store;
  readonly node: Store;
  readonly building: Store;
  readonly vision: Store;
  readonly selectable: Store;

  // --- columnas cacheadas ---
  tx!: Int32Array;
  ty!: Int32Array;
  facing!: Uint8Array;
  radius!: Int32Array;

  goalX!: Int32Array;
  goalY!: Int32Array;
  vx!: Int32Array;
  vy!: Int32Array;
  speed!: Int32Array;
  moveState!: Uint8Array;
  flowId!: Uint16Array;
  repathIn!: Uint16Array;
  stuckFor!: Uint16Array;

  hp!: Int32Array;
  maxHp!: Int32Array;
  armorMelee!: Int16Array;
  armorPierce!: Int16Array;

  attack!: Int16Array;
  damageKind!: Uint8Array;
  bonusVs!: Uint8Array; // clase contra la que aplica el bono
  bonusAmount!: Int16Array;
  range!: Int32Array;
  reload!: Uint16Array;
  cooldown!: Uint16Array;
  target!: Uint32Array;
  stance!: Uint8Array;
  aggro!: Int32Array;

  player!: Uint8Array;
  unitClass!: Uint8Array;
  typeId!: Uint16Array;

  carryKind!: Uint8Array;
  carryAmount!: Uint16Array;
  carryCap!: Uint16Array;
  gatherState!: Uint8Array;
  gatherTarget!: Uint32Array;
  dropSite!: Uint32Array;
  gatherTimer!: Uint16Array;

  nodeKind!: Uint8Array;
  nodeAmount!: Int32Array;

  buildProgress!: Int32Array;
  buildTotal!: Int32Array;
  tileW!: Uint8Array;
  tileH!: Uint8Array;
  isDropSite!: Uint8Array;

  visionRadius!: Int32Array;
  selectFlag!: Uint8Array;

  constructor(readonly world: World) {
    this.transform = world.register('transform', [
      { name: 'x', kind: 'i32' },
      { name: 'y', kind: 'i32' },
      { name: 'facing', kind: 'u8' },
      { name: 'radius', kind: 'i32' },
    ]);
    this.motion = world.register('motion', [
      { name: 'goalX', kind: 'i32' },
      { name: 'goalY', kind: 'i32' },
      { name: 'vx', kind: 'i32' },
      { name: 'vy', kind: 'i32' },
      { name: 'speed', kind: 'i32' },
      { name: 'state', kind: 'u8' },
      { name: 'flowId', kind: 'u16' },
      { name: 'repathIn', kind: 'u16' },
      { name: 'stuckFor', kind: 'u16' },
    ]);
    this.health = world.register('health', [
      { name: 'hp', kind: 'i32' },
      { name: 'maxHp', kind: 'i32' },
      { name: 'armorMelee', kind: 'i16' },
      { name: 'armorPierce', kind: 'i16' },
    ]);
    this.combat = world.register('combat', [
      { name: 'attack', kind: 'i16' },
      { name: 'damageKind', kind: 'u8' },
      { name: 'bonusVs', kind: 'u8' },
      { name: 'bonusAmount', kind: 'i16' },
      { name: 'range', kind: 'i32' },
      { name: 'reload', kind: 'u16' },
      { name: 'cooldown', kind: 'u16' },
      { name: 'target', kind: 'u32' },
      { name: 'stance', kind: 'u8' },
      { name: 'aggro', kind: 'i32' },
    ]);
    this.owner = world.register('owner', [{ name: 'player', kind: 'u8' }]);
    this.kind = world.register('kind', [
      { name: 'unitClass', kind: 'u8' },
      { name: 'typeId', kind: 'u16' },
    ]);
    this.gather = world.register('gather', [
      { name: 'carryKind', kind: 'u8' },
      { name: 'carryAmount', kind: 'u16' },
      { name: 'carryCap', kind: 'u16' },
      { name: 'state', kind: 'u8' },
      { name: 'target', kind: 'u32' },
      { name: 'dropSite', kind: 'u32' },
      { name: 'timer', kind: 'u16' },
    ]);
    this.node = world.register('node', [
      { name: 'kind', kind: 'u8' },
      { name: 'amount', kind: 'i32' },
    ]);
    this.building = world.register('building', [
      { name: 'progress', kind: 'i32' },
      { name: 'total', kind: 'i32' },
      { name: 'tileW', kind: 'u8' },
      { name: 'tileH', kind: 'u8' },
      { name: 'isDropSite', kind: 'u8' },
    ]);
    this.vision = world.register('vision', [{ name: 'radius', kind: 'i32' }]);
    this.selectable = world.register('selectable', [{ name: 'flag', kind: 'u8' }]);

    this.refresh();
    world.onGrow(() => this.refresh());
  }

  refresh(): void {
    this.tx = this.transform.col('x') as Int32Array;
    this.ty = this.transform.col('y') as Int32Array;
    this.facing = this.transform.col('facing') as Uint8Array;
    this.radius = this.transform.col('radius') as Int32Array;

    this.goalX = this.motion.col('goalX') as Int32Array;
    this.goalY = this.motion.col('goalY') as Int32Array;
    this.vx = this.motion.col('vx') as Int32Array;
    this.vy = this.motion.col('vy') as Int32Array;
    this.speed = this.motion.col('speed') as Int32Array;
    this.moveState = this.motion.col('state') as Uint8Array;
    this.flowId = this.motion.col('flowId') as Uint16Array;
    this.repathIn = this.motion.col('repathIn') as Uint16Array;
    this.stuckFor = this.motion.col('stuckFor') as Uint16Array;

    this.hp = this.health.col('hp') as Int32Array;
    this.maxHp = this.health.col('maxHp') as Int32Array;
    this.armorMelee = this.health.col('armorMelee') as Int16Array;
    this.armorPierce = this.health.col('armorPierce') as Int16Array;

    this.attack = this.combat.col('attack') as Int16Array;
    this.damageKind = this.combat.col('damageKind') as Uint8Array;
    this.bonusVs = this.combat.col('bonusVs') as Uint8Array;
    this.bonusAmount = this.combat.col('bonusAmount') as Int16Array;
    this.range = this.combat.col('range') as Int32Array;
    this.reload = this.combat.col('reload') as Uint16Array;
    this.cooldown = this.combat.col('cooldown') as Uint16Array;
    this.target = this.combat.col('target') as Uint32Array;
    this.stance = this.combat.col('stance') as Uint8Array;
    this.aggro = this.combat.col('aggro') as Int32Array;

    this.player = this.owner.col('player') as Uint8Array;
    this.unitClass = this.kind.col('unitClass') as Uint8Array;
    this.typeId = this.kind.col('typeId') as Uint16Array;

    this.carryKind = this.gather.col('carryKind') as Uint8Array;
    this.carryAmount = this.gather.col('carryAmount') as Uint16Array;
    this.carryCap = this.gather.col('carryCap') as Uint16Array;
    this.gatherState = this.gather.col('state') as Uint8Array;
    this.gatherTarget = this.gather.col('target') as Uint32Array;
    this.dropSite = this.gather.col('dropSite') as Uint32Array;
    this.gatherTimer = this.gather.col('timer') as Uint16Array;

    this.nodeKind = this.node.col('kind') as Uint8Array;
    this.nodeAmount = this.node.col('amount') as Int32Array;

    this.buildProgress = this.building.col('progress') as Int32Array;
    this.buildTotal = this.building.col('total') as Int32Array;
    this.tileW = this.building.col('tileW') as Uint8Array;
    this.tileH = this.building.col('tileH') as Uint8Array;
    this.isDropSite = this.building.col('isDropSite') as Uint8Array;

    this.visionRadius = this.vision.col('radius') as Int32Array;
    this.selectFlag = this.selectable.col('flag') as Uint8Array;
  }
}
