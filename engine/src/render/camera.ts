import { screenToWorldX, screenToWorldY, worldToScreenX, worldToScreenY } from './iso';

/**
 * Camara isometrica: desplazamiento y zoom, con limites al tamano del mapa.
 * No hay rotacion: en 2D isometrico rotar exigiria un juego de sprites por
 * angulo y multiplicaria por cuatro el pipeline de arte.
 */
export class Camera {
  /** Centro de la vista, en casillas. */
  x = 0;
  y = 0;
  zoom = 1;
  minZoom = 0.35;
  maxZoom = 2.2;
  viewW = 800;
  viewH = 600;

  constructor(
    private mapW: number,
    private mapH: number,
  ) {
    this.x = mapW / 2;
    this.y = mapH / 2;
  }

  resize(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  /** Desplaza en pixeles de pantalla. */
  panScreen(dx: number, dy: number): void {
    const wx = screenToWorldX(dx / this.zoom, dy / this.zoom);
    const wy = screenToWorldY(dx / this.zoom, dy / this.zoom);
    this.x += wx;
    this.y += wy;
    this.clamp();
  }

  zoomAt(factor: number, sx: number, sy: number): void {
    const beforeX = this.screenToWorld(sx, sy);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    const afterX = this.screenToWorld(sx, sy);
    this.x += beforeX.x - afterX.x;
    this.y += beforeX.y - afterX.y;
    this.clamp();
  }

  centerOn(wx: number, wy: number): void {
    this.x = wx;
    this.y = wy;
    this.clamp();
  }

  private clamp(): void {
    this.x = Math.max(-8, Math.min(this.mapW + 8, this.x));
    this.y = Math.max(-8, Math.min(this.mapH + 8, this.y));
  }

  /** Origen del contenedor del mundo, en pixeles de pantalla. */
  get offsetX(): number {
    return this.viewW / 2 - worldToScreenX(this.x, this.y) * this.zoom;
  }

  get offsetY(): number {
    return this.viewH / 2 - worldToScreenY(this.x, this.y) * this.zoom;
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: worldToScreenX(wx, wy) * this.zoom + this.offsetX,
      y: worldToScreenY(wx, wy) * this.zoom + this.offsetY,
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const px = (sx - this.offsetX) / this.zoom;
    const py = (sy - this.offsetY) / this.zoom;
    return { x: screenToWorldX(px, py), y: screenToWorldY(px, py) };
  }

  /** Rectangulo de casillas visible, con margen. */
  visibleTiles(margin = 2): { x0: number; y0: number; x1: number; y1: number } {
    const corners = [
      this.screenToWorld(0, 0),
      this.screenToWorld(this.viewW, 0),
      this.screenToWorld(0, this.viewH),
      this.screenToWorld(this.viewW, this.viewH),
    ];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const c of corners) {
      x0 = Math.min(x0, c.x);
      y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x);
      y1 = Math.max(y1, c.y);
    }
    return {
      x0: Math.floor(x0) - margin,
      y0: Math.floor(y0) - margin,
      x1: Math.ceil(x1) + margin,
      y1: Math.ceil(y1) + margin,
    };
  }
}
