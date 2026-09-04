import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { FP_SHIFT, toFloat } from '../core/fixed';
import { World } from '../ecs/world';
import { BUILDINGS, UNITS } from '../game/data';
import type { Simulation } from '../sim/sim';
import { Tile } from '../sim/terrain';
import { buildPlaceholderAtlas, type Atlas } from './atlas';
import { Camera } from './camera';
import { FogOfWar } from './fog';
import { TILE_H, TILE_W, worldToScreenX, worldToScreenY } from './iso';

/**
 * Render. No contiene ni una sola regla de juego: recibe la simulacion, la
 * lee y la pinta. Si algun dia hay que cambiar PixiJS por otra cosa, esto es
 * lo unico que se tira.
 *
 * Interpolacion: la simulacion va a 15 Hz y la pantalla a 60. Cada tick se
 * guarda la posicion anterior y el frame dibuja entre la anterior y la actual
 * segun el `alpha` que da el bucle. Sin esto, a 15 Hz el movimiento se ve a
 * tirones aunque el contador marque 60 fps.
 */

const TERRAIN_FRAME: Record<number, string> = {
  [Tile.Grass]: 'terreno/hierba',
  [Tile.Dirt]: 'terreno/tierra',
  [Tile.Water]: 'terreno/agua',
  [Tile.Rock]: 'terreno/roca',
  [Tile.Road]: 'terreno/camino',
  [Tile.Field]: 'terreno/huerta',
  [Tile.Marsh]: 'terreno/marjal',
};

const RESOURCE_FRAME = ['recurso/comida', 'recurso/madera', 'recurso/oro', 'recurso/piedra'];

export interface RenderStats {
  drawnEntities: number;
  drawnTiles: number;
}

export class GameRenderer {
  readonly app = new Application();
  readonly camera: Camera;
  atlas!: Atlas;
  readonly stats: RenderStats = { drawnEntities: 0, drawnTiles: 0 };

  private worldLayer = new Container();
  private terrainLayer = new Container();
  private entityLayer = new Container();
  private overlay = new Graphics();
  private fog: FogOfWar;
  private labelLayer = new Container();

  private terrainPool: Sprite[] = [];
  private entityPool: Sprite[] = [];
  private lastTerrainKey = '';

  /** Posiciones del tick anterior, por indice de entidad. */
  private prevX = new Float32Array(4096);
  private prevY = new Float32Array(4096);
  private hasPrev = new Uint8Array(4096);

  /** Entidades ordenadas por profundidad, reutilizado cada frame. */
  private order: number[] = [];
  private depth = new Float64Array(4096);

  selection = new Set<number>();
  /** Vista previa de construccion: [tx, ty, w, h, valido] o null. */
  buildPreview: { tx: number; ty: number; w: number; h: number; ok: boolean } | null = null;
  dragRect: { x0: number; y0: number; x1: number; y1: number } | null = null;
  localPlayer = 0;
  showFog = true;

  constructor(
    private readonly sim: Simulation,
    readonly host: HTMLElement,
  ) {
    this.camera = new Camera(sim.terrain.width, sim.terrain.height);
    this.fog = new FogOfWar(sim.terrain.width, sim.terrain.height);
  }

  async init(): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      background: 0x11161c,
      antialias: false,
      preference: 'webgl',
      powerPreference: 'high-performance',
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    this.host.appendChild(this.app.canvas);
    this.atlas = buildPlaceholderAtlas();

    this.worldLayer.addChild(this.terrainLayer);
    this.worldLayer.addChild(this.entityLayer);
    this.fog.attachTo(this.worldLayer);
    this.worldLayer.addChild(this.overlay);
    this.worldLayer.addChild(this.labelLayer);
    this.app.stage.addChild(this.worldLayer);

    this.app.ticker.autoStart = false;
    this.app.ticker.stop();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.camera.resize(this.app.renderer.width / this.app.renderer.resolution, this.app.renderer.height / this.app.renderer.resolution);
    this.lastTerrainKey = '';
  }

  /** Guarda las posiciones actuales como "anteriores". Se llama antes del tick. */
  snapshot(): void {
    const C = this.sim.C;
    const n = this.sim.world.highWater;
    if (this.prevX.length < n) {
      const px = new Float32Array(n * 2);
      px.set(this.prevX);
      this.prevX = px;
      const py = new Float32Array(n * 2);
      py.set(this.prevY);
      this.prevY = py;
      const hp = new Uint8Array(n * 2);
      hp.set(this.hasPrev);
      this.hasPrev = hp;
      this.depth = new Float64Array(n * 2);
    }
    const alive = this.sim.world.alive;
    for (let i = 1; i < n; i++) {
      if (alive[i] === 1) {
        this.prevX[i] = C.tx[i];
        this.prevY[i] = C.ty[i];
        this.hasPrev[i] = 1;
      } else {
        this.hasPrev[i] = 0;
      }
    }
  }

  draw(alpha: number): void {
    const cam = this.camera;
    this.worldLayer.position.set(cam.offsetX, cam.offsetY);
    this.worldLayer.scale.set(cam.zoom);
    this.drawTerrain();
    this.drawEntities(alpha);
    this.drawOverlay(alpha);
    if (this.showFog) {
      this.fog.update(this.sim.fog[this.localPlayer]);
      this.fog.upload();
    }
    this.fog.setVisible(this.showFog);
    this.app.renderer.render(this.app.stage);
  }

  private drawTerrain(): void {
    const cam = this.camera;
    const v = cam.visibleTiles(2);
    const key = `${v.x0},${v.y0},${v.x1},${v.y1}`;
    if (key === this.lastTerrainKey) return;
    this.lastTerrainKey = key;

    const t = this.sim.terrain;
    let used = 0;
    for (let ty = Math.max(0, v.y0); ty <= Math.min(t.height - 1, v.y1); ty++) {
      for (let tx = Math.max(0, v.x0); tx <= Math.min(t.width - 1, v.x1); tx++) {
        let s = this.terrainPool[used];
        if (!s) {
          s = new Sprite();
          this.terrainPool[used] = s;
          this.terrainLayer.addChild(s);
        }
        s.texture = this.atlas.frame(TERRAIN_FRAME[t.tiles[ty * t.width + tx]] ?? 'terreno/hierba');
        s.visible = true;
        s.position.set(worldToScreenX(tx + 0.5, ty + 0.5), worldToScreenY(tx + 0.5, ty + 0.5));
        used++;
      }
    }
    for (let i = used; i < this.terrainPool.length; i++) this.terrainPool[i].visible = false;
    this.stats.drawnTiles = used;
  }

  private drawEntities(alpha: number): void {
    const sim = this.sim;
    const C = sim.C;
    const w = sim.world;
    const cam = this.camera;
    const v = cam.visibleTiles(6);
    const fogOf = sim.fog[this.localPlayer];
    const tw = sim.terrain.width;

    this.order.length = 0;
    const mask = World.maskOf(C.transform);
    w.each(mask, (i) => {
      const wx = toFloat(C.tx[i]);
      const wy = toFloat(C.ty[i]);
      if (wx < v.x0 || wx > v.x1 || wy < v.y0 || wy > v.y1) return;
      if (this.showFog) {
        const tx = C.tx[i] >> FP_SHIFT;
        const ty = C.ty[i] >> FP_SHIFT;
        const fv = fogOf[ty * tw + tx];
        const isBuilding = w.has(w.entityAt(i), C.building);
        const isNode = w.has(w.entityAt(i), C.node);
        // Los edificios y los recursos ya vistos siguen dibujandose en la
        // zona explorada; las unidades solo si estan a la vista ahora.
        if (fv === 0) return;
        if (fv === 1 && !isBuilding && !isNode) return;
      }
      this.order.push(i);
      this.depth[i] = toFloat(C.tx[i]) + toFloat(C.ty[i]);
    });
    this.order.sort((a, b) => this.depth[a] - this.depth[b]);

    let used = 0;
    const take = (): Sprite => {
      let s = this.entityPool[used];
      if (!s) {
        s = new Sprite();
        this.entityPool[used] = s;
        this.entityLayer.addChild(s);
      }
      s.visible = true;
      used++;
      return s;
    };

    for (const i of this.order) {
      const e = w.entityAt(i);
      const isBuilding = w.has(e, C.building);
      const isNode = w.has(e, C.node);
      let wx = toFloat(C.tx[i]);
      let wy = toFloat(C.ty[i]);
      if (!isBuilding && !isNode && this.hasPrev[i] === 1) {
        wx = toFloat(this.prevX[i] + (C.tx[i] - this.prevX[i]) * alpha);
        wy = toFloat(this.prevY[i] + (C.ty[i] - this.prevY[i]) * alpha);
      }
      const sx = worldToScreenX(wx, wy);
      const sy = worldToScreenY(wx, wy);

      if (isNode) {
        const s = take();
        s.texture = this.atlas.frame(RESOURCE_FRAME[C.nodeKind[i]] ?? RESOURCE_FRAME[0]);
        s.tint = 0xffffff;
        s.alpha = 1;
        s.position.set(sx, sy);
        continue;
      }

      const key = isBuilding ? BUILDINGS[C.typeId[i]].key : UNITS[C.typeId[i]].key;
      const prefix = isBuilding ? 'edificio' : 'unidad';
      const base = take();
      base.texture = this.atlas.frame(`${prefix}/${key}/base`);
      base.tint = 0xffffff;
      base.position.set(sx, sy);
      // Obra en curso: se transparenta segun el progreso.
      const building = isBuilding && C.buildProgress[i] < C.buildTotal[i];
      base.alpha = building ? 0.35 + 0.5 * (C.buildProgress[i] / Math.max(1, C.buildTotal[i])) : 1;

      const maskSprite = take();
      maskSprite.texture = this.atlas.frame(`${prefix}/${key}/mask`);
      maskSprite.tint = sim.players[C.player[i]]?.color ?? 0xffffff;
      maskSprite.position.set(sx, sy);
      maskSprite.alpha = base.alpha;
    }

    for (let i = used; i < this.entityPool.length; i++) this.entityPool[i].visible = false;
    this.stats.drawnEntities = this.order.length;
  }

  private drawOverlay(alpha: number): void {
    const g = this.overlay;
    const sim = this.sim;
    const C = sim.C;
    const w = sim.world;
    g.clear();

    // Anillos de seleccion y barras de vida.
    for (const i of this.selection) {
      if (w.alive[i] !== 1) continue;
      let wx = toFloat(C.tx[i]);
      let wy = toFloat(C.ty[i]);
      if (this.hasPrev[i] === 1 && !w.has(w.entityAt(i), C.building)) {
        wx = toFloat(this.prevX[i] + (C.tx[i] - this.prevX[i]) * alpha);
        wy = toFloat(this.prevY[i] + (C.ty[i] - this.prevY[i]) * alpha);
      }
      const sx = worldToScreenX(wx, wy);
      const sy = worldToScreenY(wx, wy);
      const r = Math.max(10, toFloat(C.radius[i]) * TILE_W * 0.55);
      g.ellipse(sx, sy, r, r * (TILE_H / TILE_W));
      g.stroke({ color: 0x7ce07c, width: 2, alpha: 0.9 });
    }

    // Barras de vida de todo lo danado y visible.
    const mask = World.maskOf(C.transform, C.health, C.owner);
    w.each(mask, (i) => {
      if (C.hp[i] >= C.maxHp[i] && !this.selection.has(i)) return;
      const wx = toFloat(C.tx[i]);
      const wy = toFloat(C.ty[i]);
      const v = this.camera.visibleTiles(4);
      if (wx < v.x0 || wx > v.x1 || wy < v.y0 || wy > v.y1) return;
      if (this.showFog && sim.fog[this.localPlayer][(C.ty[i] >> FP_SHIFT) * sim.terrain.width + (C.tx[i] >> FP_SHIFT)] === 0) return;
      const sx = worldToScreenX(wx, wy);
      const sy = worldToScreenY(wx, wy);
      const isB = w.has(w.entityAt(i), C.building);
      const bw = isB ? 40 : 22;
      const off = isB ? 54 : 30;
      const ratio = Math.max(0, C.hp[i] / C.maxHp[i]);
      g.rect(sx - bw / 2, sy - off, bw, 4);
      g.fill({ color: 0x1a1a1a, alpha: 0.8 });
      g.rect(sx - bw / 2, sy - off, bw * ratio, 4);
      g.fill({ color: ratio > 0.5 ? 0x5fd35f : ratio > 0.25 ? 0xd8c34a : 0xd35f5f });
    });

    // Vista previa de construccion.
    if (this.buildPreview) {
      const p = this.buildPreview;
      const col = p.ok ? 0x7ce07c : 0xe07c7c;
      for (let ty = p.ty; ty < p.ty + p.h; ty++) {
        for (let tx = p.tx; tx < p.tx + p.w; tx++) {
          const cx = worldToScreenX(tx + 0.5, ty + 0.5);
          const cy = worldToScreenY(tx + 0.5, ty + 0.5);
          g.moveTo(cx, cy - TILE_H / 2);
          g.lineTo(cx + TILE_W / 2, cy);
          g.lineTo(cx, cy + TILE_H / 2);
          g.lineTo(cx - TILE_W / 2, cy);
          g.closePath();
          g.fill({ color: col, alpha: 0.25 });
        }
      }
    }
  }

  /** Rectangulo de seleccion, en coordenadas de pantalla. */
  drawDragRect(g: Graphics): void {
    g.clear();
    if (!this.dragRect) return;
    const r = this.dragRect;
    g.rect(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0));
    g.fill({ color: 0x7ce07c, alpha: 0.12 });
    g.stroke({ color: 0x7ce07c, width: 1.5 });
  }

  /** Etiqueta flotante efimera (dano, avisos). */
  floatingText(text: string, wx: number, wy: number, color = 0xffffff): void {
    const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: 13, fill: color } });
    t.anchor.set(0.5, 1);
    t.position.set(worldToScreenX(wx, wy), worldToScreenY(wx, wy) - 34);
    this.labelLayer.addChild(t);
    let life = 40;
    const tick = (): void => {
      if (--life <= 0) {
        t.destroy();
        this.app.ticker.remove(tick);
        return;
      }
      t.y -= 0.6;
      t.alpha = life / 40;
    };
    this.app.ticker.add(tick);
    this.app.ticker.start();
  }
}
