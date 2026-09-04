import { FP_ONE, fx } from '../core/fixed';
import { GatherState, Stance } from '../ecs/components';
import { World, entityIndex, type Entity } from '../ecs/world';
import { BUILDINGS, type BuildingId } from '../game/data';
import type { CommandQueue } from '../sim/commands';
import type { Simulation } from '../sim/sim';
import { canPlace } from '../sim/step';
import type { GameRenderer } from '../render/renderer';

/**
 * Entrada de raton y teclado.
 *
 * DECISION TOMADA Y CERRADA: el slice es de escritorio, raton y teclado. No
 * hay soporte tactil. El brief obliga a decidirlo ahora porque no es un
 * anadido posterior: en tactil no existe el clic derecho ni el hover, la
 * seleccion por arrastre choca con el desplazamiento del mapa y el dedo tapa
 * lo que senala. Anadirlo mas tarde no seria portar controles, seria rehacer
 * el diseno de interaccion entero.
 *
 * Lo unico que se hace por si algun dia se reabre: ningun sistema del juego
 * habla con el raton. Todo lo que ocurre aqui acaba siendo una `Command` en
 * la cola. Un esquema tactil tendria que reimplementar este fichero y ninguno
 * mas. Ver docs/DECISIONES.md, ADR-004.
 */

export type Intent =
  | { t: 'seleccion'; entities: number[] }
  | { t: 'construir'; building: BuildingId }
  | { t: 'cancelar' };

export interface InputHooks {
  onSelectionChanged?: (indices: number[]) => void;
  onBuildModeChanged?: (b: BuildingId | null) => void;
  onToggleFog?: () => void;
  onTogglePause?: () => void;
  onSpeed?: (delta: number) => void;
  onDiplomacyPanel?: () => void;
}

const PAN_SPEED = 900; // pixeles por segundo
const EDGE = 12;

export class InputController {
  private keys = new Set<string>();
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;
  private pointer = { x: 0, y: 0, inside: false };
  buildMode: BuildingId | null = null;
  private lastClick = 0;
  private lastClickIndex = -1;

  constructor(
    private readonly sim: Simulation,
    private readonly renderer: GameRenderer,
    private readonly queue: CommandQueue,
    private readonly player: number,
    private readonly hooks: InputHooks = {},
  ) {}

  attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('pointerleave', () => (this.pointer.inside = false));
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Desplazamiento por teclado y por bordes. Se llama cada frame. */
  update(dtMs: number): void {
    const cam = this.renderer.camera;
    const d = (PAN_SPEED * dtMs) / 1000;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx += d;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx -= d;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy += d;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy -= d;
    if (this.pointer.inside && !this.dragging) {
      if (this.pointer.x < EDGE) dx += d;
      else if (this.pointer.x > cam.viewW - EDGE) dx -= d;
      if (this.pointer.y < EDGE) dy += d;
      else if (this.pointer.y > cam.viewH - EDGE) dy -= d;
    }
    if (dx !== 0 || dy !== 0) cam.panScreen(dx, dy);

    if (this.buildMode !== null) {
      const def = BUILDINGS[this.buildMode];
      const w = cam.screenToWorld(this.pointer.x, this.pointer.y);
      const tx = Math.floor(w.x - def.tileW / 2);
      const ty = Math.floor(w.y - def.tileH / 2);
      this.renderer.buildPreview = {
        tx,
        ty,
        w: def.tileW,
        h: def.tileH,
        ok: canPlace(this.sim, tx, ty, def.tileW, def.tileH) && this.sim.canAfford(this.player, def.cost),
      };
    } else {
      this.renderer.buildPreview = null;
    }
  }

  setBuildMode(b: BuildingId | null): void {
    this.buildMode = b;
    this.hooks.onBuildModeChanged?.(b);
  }

  private localPoint(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = (e.target as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent): void {
    const p = this.localPoint(e);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.inside = true;
    if (e.button === 0) {
      if (this.buildMode !== null) {
        this.placeBuilding();
        if (!e.shiftKey) this.setBuildMode(null);
        return;
      }
      this.dragStart = { ...p };
      this.dragging = true;
      this.renderer.dragRect = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    } else if (e.button === 2) {
      if (this.buildMode !== null) {
        this.setBuildMode(null);
        return;
      }
      this.issueContextual(p, e.shiftKey);
    }
  }

  private onMove(e: PointerEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'CANVAS') {
      const p = this.localPoint(e);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.inside = true;
    } else {
      this.pointer.inside = false;
    }
    if (this.dragging && this.dragStart && this.renderer.dragRect) {
      this.renderer.dragRect.x1 = this.pointer.x;
      this.renderer.dragRect.y1 = this.pointer.y;
    }
  }

  private onUp(e: PointerEvent): void {
    if (e.button !== 0 || !this.dragging || !this.dragStart) return;
    this.dragging = false;
    const r = this.renderer.dragRect;
    this.renderer.dragRect = null;
    if (!r) return;
    const w = Math.abs(r.x1 - r.x0);
    const h = Math.abs(r.y1 - r.y0);
    if (w < 5 && h < 5) this.clickSelect(r.x0, r.y0, e.shiftKey);
    else this.boxSelect(r, e.shiftKey);
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.localPoint(e);
    this.renderer.camera.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    this.keys.add(e.code);
    switch (e.code) {
      case 'Escape':
        this.setBuildMode(null);
        this.setSelection([]);
        break;
      case 'KeyQ':
        this.setStance(Stance.Aggressive);
        break;
      case 'KeyE':
        this.setStance(Stance.StandGround);
        break;
      case 'KeyR':
        this.setStance(Stance.Defensive);
        break;
      case 'KeyX':
        this.queue.push({ t: 'stop', player: this.player, units: this.selectedEntities() });
        break;
      case 'KeyF':
        this.hooks.onToggleFog?.();
        break;
      case 'KeyP':
        this.hooks.onTogglePause?.();
        break;
      case 'KeyG':
        this.hooks.onDiplomacyPanel?.();
        break;
      case 'Equal':
      case 'NumpadAdd':
        this.hooks.onSpeed?.(1);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        this.hooks.onSpeed?.(-1);
        break;
      default:
        break;
    }
  }

  private setStance(s: Stance): void {
    const units = this.selectedEntities();
    if (units.length > 0) this.queue.push({ t: 'stance', player: this.player, units, stance: s });
  }

  selectedEntities(): Entity[] {
    const out: Entity[] = [];
    for (const i of this.renderer.selection) {
      if (this.sim.world.alive[i] === 1) out.push(this.sim.world.entityAt(i));
    }
    return out;
  }

  setSelection(indices: number[]): void {
    this.renderer.selection.clear();
    for (const i of indices) this.renderer.selection.add(i);
    this.hooks.onSelectionChanged?.(indices);
  }

  private clickSelect(sx: number, sy: number, additive: boolean): void {
    const hit = this.pick(sx, sy);
    const now = performance.now();
    if (hit < 0) {
      if (!additive) this.setSelection([]);
      return;
    }
    // Doble clic: todos los del mismo tipo en pantalla.
    if (now - this.lastClick < 320 && hit === this.lastClickIndex) {
      this.selectSameType(hit);
      this.lastClick = 0;
      return;
    }
    this.lastClick = now;
    this.lastClickIndex = hit;
    const cur = additive ? [...this.renderer.selection] : [];
    if (!cur.includes(hit)) cur.push(hit);
    this.setSelection(cur);
  }

  private selectSameType(i: number): void {
    const C = this.sim.C;
    const type = C.typeId[i];
    const isB = this.sim.world.has(this.sim.world.entityAt(i), C.building);
    const v = this.renderer.camera.visibleTiles(2);
    const out: number[] = [];
    this.sim.world.each(World.maskOf(C.transform, C.owner, C.kind), (j) => {
      if (C.player[j] !== this.player || C.typeId[j] !== type) return;
      if (this.sim.world.has(this.sim.world.entityAt(j), C.building) !== isB) return;
      const wx = C.tx[j] / FP_ONE;
      const wy = C.ty[j] / FP_ONE;
      if (wx < v.x0 || wx > v.x1 || wy < v.y0 || wy > v.y1) return;
      out.push(j);
    });
    this.setSelection(out);
  }

  private boxSelect(r: { x0: number; y0: number; x1: number; y1: number }, additive: boolean): void {
    const C = this.sim.C;
    const cam = this.renderer.camera;
    const x0 = Math.min(r.x0, r.x1);
    const x1 = Math.max(r.x0, r.x1);
    const y0 = Math.min(r.y0, r.y1);
    const y1 = Math.max(r.y0, r.y1);
    const out: number[] = additive ? [...this.renderer.selection] : [];
    const own: number[] = [];
    this.sim.world.each(World.maskOf(C.transform, C.owner, C.selectable), (i) => {
      const s = cam.worldToScreen(C.tx[i] / FP_ONE, C.ty[i] / FP_ONE);
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) return;
      if (C.player[i] !== this.player) return;
      if (this.sim.world.has(this.sim.world.entityAt(i), C.building)) return;
      own.push(i);
    });
    for (const i of own) if (!out.includes(i)) out.push(i);
    this.setSelection(out);
  }

  /** Devuelve el indice de entidad bajo el cursor, o -1. */
  private pick(sx: number, sy: number): number {
    const C = this.sim.C;
    const cam = this.renderer.camera;
    let best = -1;
    let bestDepth = -Infinity;
    this.sim.world.each(World.maskOf(C.transform), (i) => {
      const wx = C.tx[i] / FP_ONE;
      const wy = C.ty[i] / FP_ONE;
      const p = cam.worldToScreen(wx, wy);
      const isB = this.sim.world.has(this.sim.world.entityAt(i), C.building);
      const rx = (isB ? 40 : 16) * cam.zoom;
      const ry = (isB ? 44 : 26) * cam.zoom;
      if (sx < p.x - rx || sx > p.x + rx) return;
      if (sy < p.y - ry || sy > p.y + 6 * cam.zoom) return;
      const d = wx + wy;
      if (d > bestDepth) {
        bestDepth = d;
        best = i;
      }
    });
    return best;
  }

  private issueContextual(p: { x: number; y: number }, _shift: boolean): void {
    const units = this.selectedEntities();
    if (units.length === 0) return;
    const C = this.sim.C;
    const w = this.sim.world;
    const hit = this.pick(p.x, p.y);
    if (hit >= 0) {
      const e = w.entityAt(hit);
      if (w.has(e, C.node)) {
        this.queue.push({ t: 'gather', player: this.player, units, node: e });
        return;
      }
      if (w.has(e, C.owner)) {
        const other = C.player[hit];
        if (this.sim.enemies(this.player, other)) {
          this.queue.push({ t: 'attack', player: this.player, units, target: e });
          return;
        }
        if (other === this.player && w.has(e, C.building) && C.buildProgress[hit] < C.buildTotal[hit]) {
          this.queue.push({ t: 'repair', player: this.player, units, target: e });
          return;
        }
      }
    }
    const world = this.renderer.camera.screenToWorld(p.x, p.y);
    this.queue.push({ t: 'move', player: this.player, units, x: fx(world.x), y: fx(world.y) });
  }

  private placeBuilding(): void {
    if (this.buildMode === null) return;
    const prev = this.renderer.buildPreview;
    if (!prev || !prev.ok) return;
    const villagers = this.selectedEntities().filter((e) => {
      const i = entityIndex(e);
      return this.sim.world.has(e, this.sim.C.gather) && this.sim.C.gatherState[i] !== undefined;
    });
    if (villagers.length === 0) return;
    this.queue.push({
      t: 'build',
      player: this.player,
      units: villagers,
      building: this.buildMode,
      tx: prev.tx,
      ty: prev.ty,
    });
    for (const e of villagers) this.sim.C.gatherState[entityIndex(e)] = GatherState.None;
  }
}
