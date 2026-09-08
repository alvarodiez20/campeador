import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FactionBloc, UNITS } from '../src/game/data';

/**
 * La paleta de las fichas de unidad frente al roster del motor.
 *
 * `tools/blender/paleta.json` es lo que consume el pipeline de horneado, y los
 * fotogramas que produce se llaman `unidad/<clave>/...`, donde `<clave>` es la
 * de `UnitDef.key`. Si la paleta usa otras claves, el atlas pide fotogramas que
 * nadie ha horneado y no se entera nadie hasta que haya arte.
 *
 * No es un riesgo hipotetico: las fichas se titulan por el nombre de la unidad
 * en la mesnada -"Peon de espada", "Rodrigo Diaz", "Ballestero"- y la entrega
 * de diseno llegaba con esos titulos como claves. Dos de los tres no son
 * claves del motor, y el tercero es ademas una decision ya revertida: la
 * unidad de tiro es `arquero` y no lleva ballesta desde que se cerro la duda
 * de datacion (ver docs/ARTE.md). Esta prueba es lo que impide que vuelva a
 * entrar por la puerta del arte lo que se cerro por la del codigo.
 */

interface Unidad {
  readonly mascara_px2: number;
  readonly alto_px: number;
  readonly caja: string;
  readonly [k: string]: unknown;
}

interface Bloque {
  readonly nota: string;
  readonly comun?: Record<string, string>;
  readonly unidades: Record<string, Unidad>;
}

interface Paleta {
  readonly comun: Record<string, string>;
  readonly bloques: Record<string, Bloque>;
}

const paleta = JSON.parse(
  readFileSync(new URL('../tools/blender/paleta.json', import.meta.url), 'utf8'),
) as Paleta;

/**
 * Que bloque de faccion consume que hoja de fichas. Un bloque puede no tener
 * arte propio y servirse del de otro -es el caso del Cristiano, que usa el de
 * la mesnada porque la pieza es la misma y lo que cambia es la mascara- pero
 * no puede quedarse sin ninguno en silencio.
 */
const HOJA_POR_BLOQUE: Readonly<Record<FactionBloc, string | null>> = {
  [FactionBloc.Cristiano]: 'mesnada',
  [FactionBloc.Mesnada]: 'mesnada',
  [FactionBloc.Almoravide]: 'almoravide',
  [FactionBloc.Taifa]: null,
};

const HEX = /^#[0-9a-f]{6}$/;

describe('paleta de las fichas de unidad', () => {
  it('cada hoja cubre exactamente las unidades de los bloques que la usan', () => {
    // Una hoja puede servir a mas de un bloque, asi que lo que tiene que
    // cubrir es la union: la mesnada nombra al Campeador y el bloque Cristiano
    // no, pero el arte es el mismo y la ficha existe una sola vez.
    for (const [hoja, bloque] of Object.entries(paleta.bloques)) {
      const blocs = Object.entries(HOJA_POR_BLOQUE)
        .filter(([, h]) => h === hoja)
        .map(([b]) => Number(b) as FactionBloc);
      const esperadas = UNITS.filter((u) => blocs.some((b) => u.names[b] !== undefined))
        .map((u) => u.key)
        .sort();
      expect(Object.keys(bloque.unidades).sort(), `hoja '${hoja}'`).toEqual(esperadas);
    }
  });

  it('no hay ninguna clave de unidad que el motor no conozca', () => {
    const claves = new Set(UNITS.map((u) => u.key));
    for (const [nombre, bloque] of Object.entries(paleta.bloques)) {
      for (const clave of Object.keys(bloque.unidades)) {
        expect(claves.has(clave), `'${clave}' en la hoja '${nombre}' no es un UnitDef.key`).toBe(true);
      }
    }
  });

  it('las hojas declaradas son las que hay en la paleta', () => {
    const declaradas = new Set(Object.values(HOJA_POR_BLOQUE).filter((h): h is string => h !== null));
    expect([...Object.keys(paleta.bloques)].sort()).toEqual([...declaradas].sort());
  });

  it('el unico bloque sin fichas es la taifa', () => {
    // Cuando entren las fichas andalusies hay que tocar HOJA_POR_BLOQUE y esta
    // prueba: es la lista de lo que falta, y esta aqui para que no se olvide.
    const sin = Object.entries(HOJA_POR_BLOQUE)
      .filter(([, hoja]) => hoja === null)
      .map(([bloc]) => Number(bloc));
    expect(sin).toEqual([FactionBloc.Taifa]);
  });

  it('los colores son hex de seis digitos en minusculas, y lo tenible dice PLAYER', () => {
    // El contorno sin antialias y el tinte que multiplica no perdonan un color
    // mal escrito: `ten_*` tiene que ser blanco puro en el pase de mascara, y
    // en la paleta eso se declara con la cadena PLAYER, nunca con un hex.
    const revisa = (obj: Record<string, unknown>, donde: string): void => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v !== 'string') continue;
        if (k.startsWith('ten_')) {
          expect(v, `${donde}.${k}`).toBe('PLAYER');
        } else if (v.startsWith('#')) {
          expect(v, `${donde}.${k}`).toMatch(HEX);
        }
      }
    };
    revisa(paleta.comun, 'comun');
    for (const [nombre, bloque] of Object.entries(paleta.bloques)) {
      if (bloque.comun) revisa(bloque.comun, `${nombre}.comun`);
      for (const [clave, u] of Object.entries(bloque.unidades)) {
        revisa(u as Record<string, unknown>, `${nombre}.${clave}`);
        for (const hex of (u.pelajes_fijos as string[] | undefined) ?? []) {
          expect(hex, `${nombre}.${clave}.pelajes_fijos`).toMatch(HEX);
        }
      }
    }
  });

  it('cada unidad declara mascara, alto y caja, y la caja es una de las dos', () => {
    // Solo hay dos cajas: la de infanteria y la de caballeria, que ocupa dos
    // casillas de ancho. Una tercera obligaria a tocar el horneado y el orden
    // de profundidad, asi que no se cuela por descuido.
    for (const [nombre, bloque] of Object.entries(paleta.bloques)) {
      for (const [clave, u] of Object.entries(bloque.unidades)) {
        expect(u.mascara_px2, `${nombre}.${clave}.mascara_px2`).toBeGreaterThan(0);
        expect(u.alto_px, `${nombre}.${clave}.alto_px`).toBeGreaterThan(0);
        expect(['64x84', '96x104'], `${nombre}.${clave}.caja`).toContain(u.caja);
      }
    }
  });
});
