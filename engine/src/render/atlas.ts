import { Texture, Rectangle, ImageSource } from 'pixi.js';
import { TILE_H, TILE_W } from './iso';

/**
 * Atlas de marcadores generado por codigo.
 *
 * Aqui NO hay arte. Son cubos y rombos de colores, que es exactamente lo que
 * pide el criterio de aceptacion del proyecto: 500 unidades a 60 fps
 * renderizadas como cubos antes de dibujar un solo sprite bonito.
 *
 * Lo que si es definitivo es la *forma* del pipeline, y por eso se monta asi:
 *
 *  1. Todo cabe en un unico canvas -> una unica textura -> un unico draw call
 *     por capa, porque PixiJS agrupa los sprites que comparten fuente.
 *  2. Cada cuerpo tiene dos fotogramas: `base` (gris, sin tenir) y `mask`
 *     (blanco donde va el color del jugador). El sprite de mascara se pinta
 *     encima con tint. Una textura sirve para los ocho jugadores; es la misma
 *     tecnica que se usara con los sprites horneados en Blender.
 *  3. Los nombres de fotograma (`unidad/base`, `unidad/mask`, ...) son los que
 *     luego producira TexturePacker, para que sustituir esto por el atlas
 *     real sea cambiar el cargador y nada mas.
 */

export interface Atlas {
  readonly source: ImageSource;
  frame(name: string): Texture;
  readonly names: readonly string[];
}

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ancla en pixeles desde la esquina superior izquierda del fotograma. */
  ax: number;
  ay: number;
}

const PAD = 2;

export function buildPlaceholderAtlas(): Atlas {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const slots = new Map<string, Slot>();
  let penX = PAD;
  let penY = PAD;
  let rowH = 0;

  const place = (name: string, w: number, h: number, ax: number, ay: number, draw: (g: CanvasRenderingContext2D) => void): void => {
    if (penX + w + PAD > canvas.width) {
      penX = PAD;
      penY += rowH + PAD;
      rowH = 0;
    }
    const slot: Slot = { x: penX, y: penY, w, h, ax, ay };
    slots.set(name, slot);
    ctx.save();
    ctx.translate(penX, penY);
    draw(ctx);
    ctx.restore();
    penX += w + PAD;
    rowH = Math.max(rowH, h);
  };

  // --- casillas de terreno: rombos planos -------------------------------
  const terrainColors: Array<[string, string, string]> = [
    ['terreno/hierba', '#4f6b3a', '#5c7a44'],
    ['terreno/tierra', '#7a6244', '#8a704f'],
    ['terreno/agua', '#2b4d6b', '#33607f'],
    ['terreno/roca', '#5d5d5d', '#6b6b6b'],
    ['terreno/camino', '#8d7f63', '#9c8d70'],
    ['terreno/huerta', '#6a7a35', '#78893d'],
    ['terreno/marjal', '#47563c', '#526245'],
  ].map((c) => c as [string, string, string]);

  for (const [name, dark, light] of terrainColors) {
    place(name, TILE_W, TILE_H, TILE_W / 2, TILE_H / 2, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, TILE_H);
      grad.addColorStop(0, light);
      grad.addColorStop(1, dark);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(TILE_W / 2, 0);
      g.lineTo(TILE_W, TILE_H / 2);
      g.lineTo(TILE_W / 2, TILE_H);
      g.lineTo(0, TILE_H / 2);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.lineWidth = 1;
      g.stroke();
    });
  }

  // --- cuerpos: un cubo isometrico, base y mascara -----------------------
  // El "cubo de colores" del criterio de aceptacion, con volumen suficiente
  // para leer la direccion y la profundidad.
  const cube = (w: number, hTop: number, hBody: number): { size: [number, number]; anchor: [number, number]; draw: (g: CanvasRenderingContext2D, top: string, left: string, right: string) => void } => {
    const h = hTop + hBody;
    return {
      size: [w, h],
      anchor: [w / 2, h],
      draw: (g, top, left, right) => {
        g.beginPath();
        g.moveTo(w / 2, 0);
        g.lineTo(w, hTop / 2);
        g.lineTo(w / 2, hTop);
        g.lineTo(0, hTop / 2);
        g.closePath();
        g.fillStyle = top;
        g.fill();
        g.beginPath();
        g.moveTo(0, hTop / 2);
        g.lineTo(w / 2, hTop);
        g.lineTo(w / 2, h);
        g.lineTo(0, hTop / 2 + hBody);
        g.closePath();
        g.fillStyle = left;
        g.fill();
        g.beginPath();
        g.moveTo(w, hTop / 2);
        g.lineTo(w / 2, hTop);
        g.lineTo(w / 2, h);
        g.lineTo(w, hTop / 2 + hBody);
        g.closePath();
        g.fillStyle = right;
        g.fill();
      },
    };
  };

  const bodies: Array<{ key: string; w: number; top: number; body: number }> = [
    { key: 'aldeano', w: 16, top: 10, body: 14 },
    { key: 'infante', w: 18, top: 11, body: 18 },
    { key: 'lancero', w: 18, top: 11, body: 20 },
    { key: 'caballero', w: 24, top: 14, body: 22 },
    { key: 'ballestero', w: 17, top: 11, body: 17 },
    { key: 'campeador', w: 28, top: 16, body: 28 },
  ];

  for (const b of bodies) {
    const c = cube(b.w, b.top, b.body);
    place(`unidad/${b.key}/base`, c.size[0], c.size[1], c.anchor[0], c.anchor[1], (g) => {
      c.draw(g, '#d8d8d8', '#8f8f8f', '#b4b4b4');
    });
    // La mascara: blanco puro donde va el color del jugador, con el mismo
    // sombreado por caras para que el tenido no quede plano.
    place(`unidad/${b.key}/mask`, c.size[0], c.size[1], c.anchor[0], c.anchor[1], (g) => {
      c.draw(g, '#ffffff', '#9a9a9a', '#c8c8c8');
    });
  }

  // --- edificios ---------------------------------------------------------
  const buildings: Array<{ key: string; tiles: number; h: number }> = [
    { key: 'centro', tiles: 4, h: 74 },
    { key: 'casa', tiles: 2, h: 42 },
    { key: 'almacen', tiles: 2, h: 38 },
    { key: 'cuartel', tiles: 3, h: 56 },
    { key: 'caballerizas', tiles: 3, h: 52 },
    { key: 'torre', tiles: 2, h: 86 },
  ];

  for (const b of buildings) {
    const w = b.tiles * TILE_W;
    const topH = b.tiles * TILE_H;
    const total = topH + b.h;
    const drawShape = (g: CanvasRenderingContext2D, top: string, left: string, right: string): void => {
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w, topH / 2);
      g.lineTo(w / 2, topH);
      g.lineTo(0, topH / 2);
      g.closePath();
      g.fillStyle = top;
      g.fill();
      g.beginPath();
      g.moveTo(0, topH / 2);
      g.lineTo(w / 2, topH);
      g.lineTo(w / 2, total);
      g.lineTo(0, topH / 2 + b.h);
      g.closePath();
      g.fillStyle = left;
      g.fill();
      g.beginPath();
      g.moveTo(w, topH / 2);
      g.lineTo(w / 2, topH);
      g.lineTo(w / 2, total);
      g.lineTo(w, topH / 2 + b.h);
      g.closePath();
      g.fillStyle = right;
      g.fill();
    };
    place(`edificio/${b.key}/base`, w, total, w / 2, total, (g) => drawShape(g, '#cfc7b6', '#7d7669', '#a49c8c'));
    // Mascara de edificio: solo la cubierta y una franja de zocalo llevan el
    // color del jugador. Si se tine el edificio entero, a un vistazo todo es
    // una mancha del mismo color y no se distingue un cuartel de un aldeano.
    // En AoE2 el color de jugador va justo asi: tejado y estandartes.
    place(`edificio/${b.key}/mask`, w, total, w / 2, total, (g) => {
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w, topH / 2);
      g.lineTo(w / 2, topH);
      g.lineTo(0, topH / 2);
      g.closePath();
      g.fillStyle = '#ffffff';
      g.fill();
      g.beginPath();
      g.moveTo(0, topH / 2 + b.h - 10);
      g.lineTo(w / 2, total - 10);
      g.lineTo(w / 2, total);
      g.lineTo(0, topH / 2 + b.h);
      g.closePath();
      g.fillStyle = '#8f8f8f';
      g.fill();
      g.beginPath();
      g.moveTo(w, topH / 2 + b.h - 10);
      g.lineTo(w / 2, total - 10);
      g.lineTo(w / 2, total);
      g.lineTo(w, topH / 2 + b.h);
      g.closePath();
      g.fillStyle = '#bdbdbd';
      g.fill();
    });
  }

  // --- recursos ----------------------------------------------------------
  const resources: Array<[string, string, string]> = [
    ['recurso/comida', '#c8543c', '#e0705a'],
    ['recurso/madera', '#3f6b34', '#54873f'],
    ['recurso/oro', '#c8a02a', '#e6bf46'],
    ['recurso/piedra', '#8a8f96', '#a6acb3'],
  ];
  for (const [name, dark, light] of resources) {
    place(name, 28, 34, 14, 32, (g) => {
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(14, 2);
      g.lineTo(26, 12);
      g.lineTo(14, 32);
      g.lineTo(2, 12);
      g.closePath();
      g.fill();
      g.fillStyle = light;
      g.beginPath();
      g.moveTo(14, 2);
      g.lineTo(26, 12);
      g.lineTo(14, 18);
      g.closePath();
      g.fill();
    });
  }

  // --- pixel blanco, para barras y rectangulos de seleccion --------------
  place('blanco', 4, 4, 0, 0, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 4, 4);
  });

  const source = new ImageSource({ resource: canvas, scaleMode: 'nearest' });
  const cache = new Map<string, Texture>();

  return {
    source,
    names: [...slots.keys()],
    frame(name: string): Texture {
      const hit = cache.get(name);
      if (hit) return hit;
      const s = slots.get(name);
      if (!s) throw new Error(`fotograma desconocido en el atlas: ${name}`);
      const tex = new Texture({
        source,
        frame: new Rectangle(s.x, s.y, s.w, s.h),
        defaultAnchor: { x: s.ax / s.w, y: s.ay / s.h },
      });
      cache.set(name, tex);
      return tex;
    },
  };
}
