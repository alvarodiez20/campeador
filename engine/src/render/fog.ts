import { BufferImageSource, Container, Geometry, Mesh, Shader, Texture } from 'pixi.js';
import { worldToScreenX, worldToScreenY } from './iso';

/**
 * Niebla de guerra.
 *
 * La visibilidad vive en una textura de baja resolucion: un texel por casilla
 * (128x128 = 16 KB), no un texel por pixel. Se sube a la GPU tres veces por
 * segundo, no sesenta, porque la simulacion solo la recalcula cada cinco
 * ticks: la niebla es lo mas caro de un RTS si se hace por pixel y por frame,
 * y no hace falta.
 *
 * La composicion la hace la GPU: un unico quad con los cuatro vertices en las
 * esquinas proyectadas del mapa, en modo multiplicativo y con filtrado
 * bilineal, que es lo que da el degradado suave entre lo visible y lo
 * explorado sin coste extra.
 *
 * Deuda anotada (docs/DEUDA.md): el siguiente paso es un fragment shader
 * propio para el revelado progresivo y el tramado del borde. Con el quad y la
 * textura ya montados, es un cambio local.
 */

const COLOR_DESCONOCIDO = 0x00;
const COLOR_EXPLORADO = 0x6a;
const COLOR_VISIBLE = 0xff;

export class FogOfWar {
  private buffer: Uint8Array;
  private source: BufferImageSource;
  readonly texture: Texture;
  readonly mesh: Mesh<Geometry, Shader>;
  private dirty = true;
  enabled = true;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.buffer = new Uint8Array(width * height * 4);
    this.buffer.fill(0);
    for (let i = 3; i < this.buffer.length; i += 4) this.buffer[i] = 255;
    this.source = new BufferImageSource({
      resource: this.buffer,
      width,
      height,
      format: 'rgba8unorm',
      scaleMode: 'linear',
      alphaMode: 'premultiply-alpha-on-upload',
    });
    this.texture = new Texture({ source: this.source });

    // Quad con las esquinas del mapa proyectadas. El UV se estira sobre el
    // rombo isometrico completo.
    const c = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ];
    const positions = new Float32Array(8);
    for (let i = 0; i < 4; i++) {
      positions[i * 2] = worldToScreenX(c[i][0], c[i][1]);
      positions[i * 2 + 1] = worldToScreenY(c[i][0], c[i][1]);
    }
    const geometry = new Geometry({
      attributes: {
        aPosition: positions,
        aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      },
      indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    this.mesh = new Mesh({ geometry, texture: this.texture });
    this.mesh.blendMode = 'multiply';
  }

  /** Vuelca la visibilidad de un jugador al buffer. */
  update(visibility: Uint8Array): void {
    const buf = this.buffer;
    for (let i = 0, o = 0; i < visibility.length; i++, o += 4) {
      const v = visibility[i];
      const c = v === 2 ? COLOR_VISIBLE : v === 1 ? COLOR_EXPLORADO : COLOR_DESCONOCIDO;
      buf[o] = c;
      buf[o + 1] = c;
      buf[o + 2] = c;
    }
    this.dirty = true;
  }

  /** Sube a la GPU. Se llama como mucho una vez por frame. */
  upload(): void {
    if (!this.dirty) return;
    this.source.update();
    this.dirty = false;
  }

  attachTo(parent: Container): void {
    parent.addChild(this.mesh);
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v && this.enabled;
  }
}
