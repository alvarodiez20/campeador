# Plan de trabajo y estado

El orden es el del brief. Nada de lo de abajo se adelanta a lo de arriba.

| # | Hito | Estado |
|---|---|---|
| 1 | Esqueleto ECS + tick fijo + render de cubos | **hecho** |
| 2 | Pathfinding en worker; validar 500 unidades a 60 fps | **hecho y validado en hardware real** |
| 3 | Recolección de recursos y construcción, con marcadores | **hecho** |
| 4 | Combate y el triángulo de unidades | **hecho** |
| 5 | Niebla de guerra | **hecho** (con DEUDA-002) |
| 6 | Escenario de Valencia 1094 jugable de principio a fin | **hecho y medido** |
| 7 | Pipeline de arte definitivo | **desbloqueado**; herramientas listas, arte sin hacer |
| 8 | Parias y diplomacia | **hecho** |
| 9 | Multijugador | no empezado (DEUDA-008) |

## Sobre el hito 2: el criterio de aceptación

> 500 unidades moviéndose simultáneamente, con pathfinding y colisión, a 60 fps
> estables, renderizadas como cubos de colores. **No se produce ni un solo
> sprite bonito hasta que esto funcione.**

**Cumplido.** Lo medido, sin adornos.

La parte que depende de nuestro código está comprobada y sobra sitio:

| Escenario | Media por tick | Peor tick |
|---|---|---|
| 500 unidades, solo movimiento | 1,57 ms | 18,2 ms |
| 500 unidades, con combate | 1,24 ms | 3,80 ms |
| 200 → 800 unidades | 0,47 → 2,17 ms | escala sublineal |

(`npm test`, en el contenedor de desarrollo. El peor tick de 18 ms es un campo
de flujo completo tras una orden masiva; en el juego eso ocurre en el worker,
no en el hilo principal.)

En el navegador del contenedor, con 500 unidades: simulación **2,3 ms** por
tick, render **4,8 ms** por frame. Suman 7 ms, lo que dejaba margen sobre los
16,6 ms que exigen 60 fps — pero con la GPU emulada, así que la cifra solo
servía para descartar que el cuello fuera nuestro código.

**Los 60 fps, medidos en hardware real.** El 7 de septiembre de 2026, en
un MacBook Air M4 (10 núcleos, GPU de 8 núcleos, 16 GB), Chrome 152 sobre macOS
26.3, monitor de 144 Hz, con `npm run dev` y el panel del banco dictaminando
solo. Cada tanda son 50 segundos de ejecución continua con la ventana en
primer plano, descartando los 60 primeros fotogramas.

| Escenario | fps mínimo | Peor tick de sim | Peor render | Veredicto |
|---|---|---|---|---|
| `?modo=banco&n=500` | **137** | 1,27 ms | 3,44 ms | `CRITERIO CUMPLIDO` |
| `&n=500&combate=1` | **134** | 1,37 ms | 5,98 ms | `CRITERIO CUMPLIDO` |
| `&n=500&obstaculos=0` | **139** | 1,38 ms | 3,59 ms | `CRITERIO CUMPLIDO` |
| `&n=1000` | **138** | 2,70 ms | 2,89 ms | `CRITERIO CUMPLIDO` |
| `&n=2000` | **137** | 4,56 ms | 4,16 ms | `CRITERIO CUMPLIDO` |

Ni un tick perdido en ninguna tanda. La comparación que importa es contra el
presupuesto de 16,6 ms por fotograma: con 500 unidades, simulación y render
juntos ocupan **menos de 5 ms**, y el mínimo de 137 fps está a más del doble
del umbral de 58 que exige el criterio.

**El margen es lo que decide la fase siguiente.** Con 2.000 unidades —cuatro
veces el criterio— la cosa sigue a 137 fps: el techo no está donde íbamos a
buscarlo. El cuello, cuando aparezca, será la simulación (4,56 ms de peor tick
con 2.000 entidades frente a 4,16 ms de render), no el dibujado. Eso deja
ADR-001 en pie sin discusión y **desbloquea el pipeline de arte**: no hay
motivo para replantear hacia Three.js.

Dos cosas que conviene saber para repetir la medida:

- **La pestaña tiene que estar visible y en primer plano.** Chrome congela
  `requestAnimationFrame` en pestañas ocultas u ocluidas por otra ventana: la
  primera lectura de esta sesión dio 8 fps y tick 10 en diez segundos, y no
  era el motor sino el navegador durmiendo. Si el panel da fps ridículos, mira
  eso antes que el código.
- **Hay que dejarlo correr.** El veredicto no sale hasta los 120 fotogramas, y
  las órdenes masivas —lo que de verdad estresa el pathfinding— llegan cada
  8 segundos.

## Alcance del vertical slice

Un mapa · tres partes (mesnada del Cid, almorávides, taifa de Albarracín) ·
cinco tipos de unidad · seis edificios · una condición de victoria clara.

Lo que **no** hay, a propósito: árbol tecnológico, épocas, más facciones
jugables, formaciones, sonido, campaña. Cada uno multiplica lo que hay que
probar.

## Lo siguiente, en orden

1. ~~Comprobar el criterio de aceptación en hardware real.~~ **Hecho, y
   cumple con margen** (tabla arriba). Ya no bloquea nada.
2. ~~Jugar Cuarte 1094 entero varias veces y anotar dónde se rompe el
   ritmo.~~ **Hecho.** Ver [`BANCO-DE-PARTIDAS.md`](BANCO-DE-PARTIDAS.md):
   treinta partidas por tanda, siete fallos de ritmo encontrados y corregidos,
   todos con prueba de regresión. El escenario se resuelve ahora en el 100% de
   las partidas, con reparto 67/33 y mediana de 7 minutos.
3. Pipeline de arte (hito 7), ya desbloqueado. Las herramientas
   están en `engine/tools/blender/` y el cargador de atlas real en
   `src/render/atlasLoader.ts`; falta el arte.
4. ~~IA que reaccione a la composición del rival (DEUDA-007).~~ **Hecha y
   medida.** Observa lo que ve —respetando la niebla—, recuerda con olvido y
   desplaza la mezcla hacia el contrario del triángulo. El hallazgo es que
   **no cambia el desenlace**: la composición pesa poco frente a las torres,
   la economía y el número. Eso pasa la pelota al balance (DEUDA-010): los
   bonos del triángulo son demasiado tímidos.
5. Multijugador lockstep, si todo lo anterior funciona.

## Cómo se comprueba que el escenario sigue teniendo pulso

```bash
cd engine
npm test              # 61 pruebas rápidas (2 s)
npm run test:lento    # 20 pruebas que simulan partidas enteras
npm run playtest -- --partidas=30            # informe de ritmo
npm run playtest -- --duelo=25 --rival=soloJinetes   # ¿sirve adaptarse?
```

## Legal

"Age of Empires", su logotipo y su interfaz son propiedad de Microsoft.
Inspiración sí, clonado no: nombres, interfaz, arte y tablas de números son
propios. Hay que revisar la licencia de cada asset que se descargue, incluidos
los "gratis". Candidatos para marcadores: Kenney.nl (CC0, con sets
isométricos), Quaternius, itch.io.
