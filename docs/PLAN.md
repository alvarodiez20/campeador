# Plan de trabajo y estado

El orden es el del brief. Nada de lo de abajo se adelanta a lo de arriba.

| # | Hito | Estado |
|---|---|---|
| 1 | Esqueleto ECS + tick fijo + render de cubos | **hecho** |
| 2 | Pathfinding en worker; validar 500 unidades a 60 fps | **hecho** (ver abajo) |
| 3 | Recolección de recursos y construcción, con marcadores | **hecho** |
| 4 | Combate y el triángulo de unidades | **hecho** |
| 5 | Niebla de guerra | **hecho** (con DEUDA-002) |
| 6 | Escenario de Valencia 1094 jugable de principio a fin | **hecho y medido** |
| 7 | Pipeline de arte definitivo | herramientas listas, arte sin hacer |
| 8 | Parias y diplomacia | **hecho** |
| 9 | Multijugador | no empezado (DEUDA-008) |

## Sobre el hito 2: el criterio de aceptación

> 500 unidades moviéndose simultáneamente, con pathfinding y colisión, a 60 fps
> estables, renderizadas como cubos de colores. **No se produce ni un solo
> sprite bonito hasta que esto funcione.**

**Lo medido, sin adornos.**

La parte que depende de nuestro código está comprobada y sobra sitio:

| Escenario | Media por tick | Peor tick |
|---|---|---|
| 500 unidades, solo movimiento | 1,57 ms | 18,2 ms |
| 500 unidades, con combate | 1,24 ms | 3,80 ms |
| 200 → 800 unidades | 0,47 → 2,17 ms | escala sublineal |

(`npm test`, en el contenedor de desarrollo. El peor tick de 18 ms es un campo
de flujo completo tras una orden masiva; en el juego eso ocurre en el worker,
no en el hilo principal.)

En el navegador, con 500 unidades: simulación **2,3 ms** por tick, render
**4,8 ms** por frame. Suman 7 ms, lo que deja margen de sobra sobre los 16,6 ms
que exigen 60 fps.

**Lo que no se ha podido medir aquí:** los 60 fps de verdad. El entorno de
desarrollo solo tiene rasterización por software (SwiftShader), que da 12 fps
midiendo la GPU emulada, no nuestro código. **El criterio queda pendiente de
una comprobación en hardware real**, y se hace así:

```bash
npm run dev
# abrir http://localhost:5173/?modo=banco&n=500
```

El panel dice `CRITERIO CUMPLIDO` o `NO CUMPLE` por sí solo, con el mínimo de
fps y el peor tick registrados. Parámetros: `n` unidades, `mapa` tamaño,
`combate=1`, `obstaculos=0`.

## Alcance del vertical slice

Un mapa · tres partes (mesnada del Cid, almorávides, taifa de Albarracín) ·
cinco tipos de unidad · seis edificios · una condición de victoria clara.

Lo que **no** hay, a propósito: árbol tecnológico, épocas, más facciones
jugables, formaciones, sonido, campaña. Cada uno multiplica lo que hay que
probar.

## Lo siguiente, en orden

1. **Comprobar el criterio de aceptación en hardware real** (arriba). Sigue
   siendo lo único que bloquea el pipeline de arte.
2. ~~Jugar Cuarte 1094 entero varias veces y anotar dónde se rompe el
   ritmo.~~ **Hecho.** Ver [`BANCO-DE-PARTIDAS.md`](BANCO-DE-PARTIDAS.md):
   treinta partidas por tanda, siete fallos de ritmo encontrados y corregidos,
   todos con prueba de regresión. El escenario se resuelve ahora en el 100% de
   las partidas, con reparto 67/33 y mediana de 7 minutos.
3. Pipeline de arte (hito 7), en cuanto pase el punto 1. Las herramientas
   están en `engine/tools/blender/` y el cargador de atlas real en
   `src/render/atlasLoader.ts`; falta el arte.
4. IA que reaccione a la composición del rival (DEUDA-007). La mezcla militar
   ya cubre los cuatro vértices, pero sigue siendo fija: no mira lo que trae
   el rival.
5. Multijugador lockstep, si todo lo anterior funciona.

## Cómo se comprueba que el escenario sigue teniendo pulso

```bash
cd engine
npm test                      # 75 pruebas, incluidas las regresiones de ritmo
npm run playtest -- --partidas=30   # treinta partidas completas y su informe
```

## Legal

"Age of Empires", su logotipo y su interfaz son propiedad de Microsoft.
Inspiración sí, clonado no: nombres, interfaz, arte y tablas de números son
propios. Hay que revisar la licencia de cada asset que se descargue, incluidos
los "gratis". Candidatos para marcadores: Kenney.nl (CC0, con sets
isométricos), Quaternius, itch.io.
