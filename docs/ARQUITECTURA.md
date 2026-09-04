# Arquitectura

```
                 ┌──────────────────────────────────────────┐
   ratón/teclado │  src/input   ──▶  Command                │
        ─────────▶                     │                    │
                 │                     ▼                    │
                 │              CommandQueue                │
                 │                     │                    │
                 │  ═══════════════════│════════════════════│══ frontera
                 │                     ▼                    │   determinista
                 │   src/sim   stepSimulation(sim, cmds)    │
                 │      │  ECS · punto fijo · RNG propio    │
                 │      │                                   │
                 │      ├──▶ src/path (Web Worker) ─────────┤
                 │      │      flow fields + A* jerárquico  │
                 │      │                                   │
                 │      ▼                                   │
                 │   estado del mundo (solo lectura)        │
                 │      │                                   │
                 │  ════│═══════════════════════════════════│══
                 │      ▼                                   │
                 │  src/render (PixiJS) + src/ui (DOM)      │
                 └──────────────────────────────────────────┘
```

La flecha nunca va al revés. `src/sim` y `src/path` no importan nada de
`src/render` ni de `src/ui`, y esa es la razón de que la mitad de las pruebas
corran en Node sin navegador.

## Mapa de ficheros

```
src/
  core/
    fixed.ts        punto fijo Q20.12, isqrt, atan2 por tabla
    rng.ts          xorshift128 serializable
    loop.ts         tick fijo a 15 Hz + interpolación + estadísticas
  ecs/
    world.ts        entidades, generaciones, columnas de TypedArray
    components.ts   las columnas de la simulación
  sim/
    sim.ts          Simulation: mundo, jugadores, niebla, fábricas
    step.ts         orden de sistemas por tick, ejecución de órdenes
    commands.ts     el único punto de entrada a la simulación
    terrain.ts      rejilla de costes
    spatial.ts      rejilla uniforme por counting sort
    parias.ts       tributos, diplomacia, presión almorávide
    systems/
      movement.ts   seguir el campo de flujo + separación local
      combat.ts     adquisición de blanco, daño, muerte
      economy.ts    recolección, depósito, obras, entrenamiento
  path/
    flowfield.ts    Dijkstra con cubetas (Dial)
    hpa.ts          A* sobre clústeres de 16×16
    worker.ts       el worker: cola con presupuesto de 8 ms
    service.ts      caché de campos con recuento de referencias
    protocol.ts     mensajes hilo principal ↔ worker
  render/
    renderer.ts     capas, orden por profundidad, interpolación
    atlas.ts        atlas de marcadores generado por código
    atlasLoader.ts  carga del atlas real (TexturePacker)
    fog.ts          quad de niebla en modo multiplicativo
    camera.ts       desplazamiento, zoom, culling
    iso.ts          proyección 2:1
  input/input.ts    ratón y teclado → Command
  ui/hud.ts         HUD en DOM
  game/
    data.ts         facciones, unidades, edificios
    scenario.ts     Valencia 1094
    mapgen.ts       brochas de terreno
    ai.ts           IA de escaramuza
    benchmark.ts    banco de pruebas del criterio de aceptación
tools/
  playtest.ts       banco de partidas: juega el escenario y mide el ritmo
  blender/          horneado de sprites isométricos
```

## Las cuatro decisiones que sostienen todo lo demás

1. **Tick fijo a 15 Hz, render a 60.** El render interpola entre el tick
   anterior y el actual. Sin esto, a 15 Hz el movimiento va a tirones aunque
   el contador marque 60 fps.

2. **Punto fijo en toda la simulación.** Ni un `float` en `src/sim` ni en
   `src/path`. Es lo que hace posible el lockstep más adelante, y lo que hace
   que `hashState()` sirva para detectar desincronización hoy.

3. **Nada modifica el mundo si no es una `Command`.** Es la frontera que
   permitirá enviar solo órdenes por la red en vez de estado.

4. **El hilo principal no calcula rutas.** Nunca. El worker mantiene su copia
   de la rejilla de costes y responde con campos de flujo; el hilo principal
   solo lee direcciones de una tabla.

## Coste de un tick, por sistema

Con 500 unidades, medido en `test/rendimiento.test.ts`:

| Sistema | Qué hace | Coste |
|---|---|---|
| `rebuildSpatial` | counting sort de todas las entidades | O(n) |
| `trainSystem` | colas de entrenamiento | despreciable |
| `gatherSystem` | recolección | O(aldeanos) |
| `buildSystem` | obras en curso | O(obras) |
| `combatSystem` | blanco + daño, con vecinos 3×3 | O(n · vecinos) |
| `movementSystem` | campo de flujo + separación | O(n · vecinos) |
| `updateFog` | círculos de visión, 1 de cada 5 ticks | O(n · r²) / 5 |
| `diplomacy.tick` | contratos de parias | O(contratos) |

Total: **1,2-1,6 ms de media**. El presupuesto a 15 Hz es 66 ms, pero el
objetivo real es quedarse por debajo de 8 ms para dejarle el hilo al render.

## Cómo se prueba

```bash
npm test          # 61 pruebas rápidas (2 s): punto fijo, RNG, rutas,
                  # simulación, parias y presupuesto de CPU
npm run test:lento  # 20 pruebas que simulan partidas enteras (18 s)
npm run playtest    # treinta partidas completas y su informe de ritmo
npm run typecheck # TypeScript estricto, sin any implícitos
npm run build     # typecheck + build de producción
```

Lo que vigilan las pruebas, en orden de importancia:

1. **Determinismo.** Dos partidas con la misma semilla y las mismas órdenes
   dan el mismo hash de estado. Es la prueba que protege el multijugador
   futuro.
2. **El triángulo.** Una prueba por arista, seis contra seis.
3. **Que la partida avance sola.** El escenario completo corre 2.500 ticks con
   tres IAs y se comprueba que se recolecta, se construye y se entrena.
4. **Presupuesto de CPU.** Umbrales generosos a propósito: vigilan regresiones
   de un orden de magnitud, no el último milisegundo.
5. **Ritmo de la IA.** Las regresiones de `test/ia.lento.test.ts` salieron del
   banco de partidas: reparto de aldeanos a los cuatro recursos, los cuatro
   vértices del triángulo entrenados, remate del rival deshecho y parias
   exigidas. Ninguna rompía nada visible —la partida corría igual, solo que
   mal—, así que sin prueba volverían en silencio.
6. **Que la IA no haga trampas.** `test/ia-reactiva.lento.test.ts` comprueba
   que solo cuenta enemigos dentro de la niebla descubierta: veinte jinetes en
   la otra punta del mapa no mueven su mezcla militar ni un punto.
