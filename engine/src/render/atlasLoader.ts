import { Assets, Spritesheet, Texture } from 'pixi.js';
import type { Atlas } from './atlas';

/**
 * Carga de un atlas real, empaquetado con TexturePacker o free-tex-packer en
 * formato "pixi.js" (JSON hash).
 *
 * Existe ahora, con el juego todavia usando cubos, para que sustituir los
 * marcadores por arte sea cambiar una linea en el arranque del render y nada
 * mas. Los nombres de fotograma que produce `tools/blender/hornear_sprites.py`
 * son los mismos que genera el atlas de marcadores:
 *
 *     unidad/<clave>/<octante>/<animacion>/<frame>/base
 *     unidad/<clave>/<octante>/<animacion>/<frame>/mask
 *     edificio/<clave>/base
 *     edificio/<clave>/mask
 *     terreno/<clave>
 *
 * Los octantes 0, 1 y 7 (E, SE, NE) NO estan en el atlas: se obtienen
 * volteando en horizontal los octantes 4, 3 y 5 (O, SO, NO). `frameConVolteo`
 * devuelve la textura y si hay que poner `scale.x = -1`.
 *
 * Octantes: 0=E 1=SE 2=S 3=SO 4=O 5=NO 6=N 7=NE, sentido horario en pantalla.
 *
 * La tabla era `{ 5: 3, 6: 2, 7: 1 }` y estaba mal. Voltear en horizontal
 * cambia una direccion por su reflejo respecto al eje vertical de la pantalla,
 * y ese reflejo empareja E con O, SE con SO y NE con NO, dejando N y S como
 * sus propios espejos. Declarar N como S volteada no da una vista de espaldas:
 * el reflejo de una vista frontal es otra vista frontal, asi que una unidad
 * que caminara hacia el norte miraba a camara. Y de paso se horneaban E y O,
 * que son la misma imagen.
 *
 * Tiene que coincidir con ESPEJADAS de `tools/blender/hornear_sprites.py`, que
 * es quien decide que cinco direcciones se hornean.
 */

export const ESPEJO: Readonly<Record<number, number>> = { 0: 4, 1: 3, 7: 5 };

export async function loadAtlas(url: string): Promise<Atlas> {
  const sheet = (await Assets.load(url)) as Spritesheet;
  const cache = new Map<string, Texture>();
  return {
    source: sheet.textureSource,
    names: Object.keys(sheet.textures),
    frame(name: string): Texture {
      const hit = cache.get(name);
      if (hit) return hit;
      const tex = sheet.textures[name];
      if (!tex) throw new Error(`fotograma desconocido en el atlas: ${name}`);
      cache.set(name, tex);
      return tex;
    },
  };
}

/**
 * Fotograma de una unidad con volteo para las tres direcciones que no se
 * hornean. Devuelve `flip: true` cuando el sprite hay que espejarlo.
 */
export function frameConVolteo(
  atlas: Atlas,
  clave: string,
  octante: number,
  animacion: string,
  frame: number,
  capa: 'base' | 'mask',
): { texture: Texture; flip: boolean } {
  const espejo = ESPEJO[octante];
  const real = espejo ?? octante;
  const f = String(frame).padStart(2, '0');
  return {
    texture: atlas.frame(`unidad/${clave}/${real}/${animacion}/${f}/${capa}`),
    flip: espejo !== undefined,
  };
}
