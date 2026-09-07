import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESPEJO } from '../src/render/atlasLoader';

/**
 * La rueda de direcciones.
 *
 * Se hornean cinco de las ocho direcciones y las otras tres se obtienen
 * volteando en horizontal. Elegir mal esas cinco es el error mas caro de
 * arreglar tarde del pipeline de arte: cambiarlo obliga a rehornear todo.
 *
 * Y estaba mal elegido. La tabla era `{ 5: 3, 6: 2, 7: 1 }` —N como S volteada,
 * NO como SO volteada— y eso no puede funcionar: voltear en horizontal cambia
 * una direccion por su reflejo respecto al eje vertical de la pantalla, que
 * empareja E con O, SE con SO y NE con NO, y deja N y S como sus propios
 * espejos. El reflejo de una vista frontal es otra vista frontal, asi que no
 * habia ninguna vista de espaldas y una unidad que caminaba hacia el norte
 * miraba a camara. Ademas se horneaban E y O, que son la misma imagen.
 *
 * Nada consume todavia `atlasLoader`, asi que no habia sintoma que delatara
 * esto: la unica forma de que no vuelva es esta prueba.
 */

/** 0=E 1=SE 2=S 3=SO 4=O 5=NO 6=N 7=NE, sentido horario en pantalla. */
const OCTANTES = 8;
/**
 * El reflejo de un octante respecto al eje vertical de la pantalla.
 *
 * El octante `o` apunta a `o * 45` grados desde el este, en sentido horario.
 * Voltear en horizontal lleva el angulo `t` a `180 - t`, o sea el octante `o`
 * al `4 - o`. Empareja E con O, SE con SO y NE con NO, y deja S (2) y N (6)
 * en su sitio: son sus propios espejos.
 */
const reflejo = (o: number): number => (4 - o + OCTANTES) % OCTANTES;

describe('rueda de direcciones del atlas', () => {
  it('cada direccion volteada es el reflejo horizontal de la que se hornea', () => {
    for (const [destino, origen] of Object.entries(ESPEJO)) {
      expect(reflejo(Number(destino)), `el octante ${destino} sale de voltear el ${origen}`).toBe(origen);
    }
  });

  it('N y S no se pueden obtener volteando: se hornean', () => {
    // Son sus propios espejos. Declararlos como volteados de otra cosa es
    // exactamente el fallo que tenia la tabla.
    expect(ESPEJO[2]).toBeUndefined();
    expect(ESPEJO[6]).toBeUndefined();
  });

  it('se cubren las ocho direcciones horneando solo cinco', () => {
    const horneadas = new Set<number>();
    for (let o = 0; o < OCTANTES; o++) horneadas.add(ESPEJO[o] ?? o);
    expect(horneadas.size).toBe(5);
    // Y ninguna de las cinco es el reflejo de otra: eso seria hornear dos
    // veces la misma imagen, que es el 40% del coste tirado.
    for (const o of horneadas) expect(horneadas.has(reflejo(o)) && reflejo(o) !== o).toBe(false);
  });

  it('el script de horneado hornea exactamente esas cinco', () => {
    // Las dos tablas viven en lenguajes distintos y tienen que coincidir; si
    // se tocan por separado, el atlas pide fotogramas que nadie ha horneado.
    const py = readFileSync(new URL('../tools/blender/hornear_sprites.py', import.meta.url), 'utf8');
    const bloque = py.slice(py.indexOf('DIRECCIONES = ['), py.indexOf('ESPEJADAS = {'));
    const horneadasPy = new Set([...bloque.matchAll(/,\s*(\d)\)/g)].map((m) => Number(m[1])));
    const horneadasTs = new Set<number>();
    for (let o = 0; o < OCTANTES; o++) horneadasTs.add(ESPEJO[o] ?? o);
    expect([...horneadasPy].sort()).toEqual([...horneadasTs].sort());
  });
});
