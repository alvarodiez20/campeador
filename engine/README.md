# Campeador — motor del vertical slice

RTS isométrico para navegador ambientado en la península ibérica de 1094.
PixiJS v8 · TypeScript estricto · ECS propio · Vite.

Esto **no** es el juego de la raíz del repositorio (aquel es un RTS completo en
JavaScript sin dependencias). Esto es el motor nuevo que pide el brief:
simulación separada del render, punto fijo, pathfinding en worker y un
criterio de aceptación técnico antes de producir arte.

## Arrancar

```bash
npm install
npm run dev
```

- <http://localhost:5173/> — **Cuarte 1094**, la defensa de Valencia.
- <http://localhost:5173/?modo=banco&n=500> — **banco de pruebas**: el criterio
  de aceptación técnico. Parámetros: `n`, `mapa`, `combate=1`, `obstaculos=0`.

```bash
npm test         # 61 pruebas rápidas (2 s): es la red de cada cambio
npm run test:lento   # 20 pruebas que simulan partidas enteras (18 s)
npm run test:todo    # las dos tandas
npm run build    # typecheck + producción

# treinta partidas completas de Cuarte 1094 y su informe de ritmo
npm run playtest -- --partidas=30

# ¿sirve de algo que la IA se adapte? duelo controlado, mismo rival
npm run playtest -- --duelo=25 --rival=soloJinetes
```

Las pruebas van en dos tandas a propósito. Las de escenario y de IA simulan
hasta veinticuatro minutos de juego cada una, y metidas con las demás pasaban
el paso de integración de un minuto a siete y medio. Corren en su propio
trabajo, en paralelo.

## Controles

| | |
|---|---|
| **WASD** / flechas / borde | mover la cámara |
| **Rueda** | zoom |
| **Clic izq.** | seleccionar · arrastrar para selección múltiple · doble clic, todos los del tipo |
| **Clic der.** | orden contextual: mover, recolectar, atacar o reparar |
| **Q · R · E** | postura agresiva · defensiva · no moverse |
| **X** | detener |
| **F · P · +/−** | niebla · pausa · velocidad |
| **Esc** | cancelar construcción / deseleccionar |

Sin soporte táctil, y es una decisión cerrada: ver ADR-004 en
[`../docs/DECISIONES.md`](../docs/DECISIONES.md).

## Qué hay dentro

- **Simulación determinista** a 15 Hz con punto fijo Q20.12 y RNG propio. El
  render va a 60 fps e interpola. Ni un `float` en `src/sim`.
- **Pathfinding en Web Worker**: campos de flujo (Dijkstra con cubetas) más A*
  jerárquico sobre clústeres de 16×16 para acotar la inundación. Evitación
  local por separación.
- **ECS propio** sobre `TypedArray`, con handles de índice + generación.
- **Parias**: tributos entre reinos y taifas, rompibles unilateralmente, con
  un medidor de presión que acaba trayendo a los almorávides. Es el eje
  económico-diplomático, no un extra.
- **Escenario completo**: Cuarte 1094, tres partes, condición de victoria,
  IA de escaramuza.
- **Atlas de marcadores generado por código**, con máscara de color de jugador
  ya montada: una textura sirve para los ocho jugadores.

## Documentación

| | |
|---|---|
| [`ARQUITECTURA.md`](../docs/ARQUITECTURA.md) | mapa de ficheros y coste por sistema |
| [`DECISIONES.md`](../docs/DECISIONES.md) | los siete ADR que cuesta revertir |
| [`DEUDA.md`](../docs/DEUDA.md) | deuda técnica, con disparador para pagarla |
| [`PLAN.md`](../docs/PLAN.md) | estado de los nueve hitos y qué falta medir |
| [`BALANCE.md`](../docs/BALANCE.md) | el triángulo y la tabla de números |
| [`TRATAMIENTO-HISTORICO.md`](../docs/TRATAMIENTO-HISTORICO.md) | requisito de diseño, no sensibilidad opcional |
| [`BANCO-DE-PARTIDAS.md`](../docs/BANCO-DE-PARTIDAS.md) | método y hallazgos de las tandas de partidas |
| [`FUENTES.md`](../docs/FUENTES.md) | bibliografía y misiones candidatas |

## Pipeline de arte

Todavía no se produce arte: es el hito 7 y va después de que el escenario se
juegue entero. Las herramientas ya están:

```bash
# cuántas imágenes saldrían, antes de comprometerse
python3 tools/blender/hornear_sprites.py \
  --salida build/sprites --nombre caballero \
  --animaciones andar,atacar,morir,quieto --frames 15 --solo-cuenta
# -> 4 animaciones x 5 direcciones x 15 frames x 2 pases = 600 imágenes

# horneado real
blender caballero.blend --background \
  --python tools/blender/hornear_sprites.py -- --salida build/sprites ...
```

Solo se hornean **cinco** de las ocho direcciones; las otras tres se obtienen
volteando en horizontal (`src/render/atlasLoader.ts`). El pase de máscara sale
del mismo render: las ranuras de material cuyo nombre empiece por `jugador`
salen en blanco.
