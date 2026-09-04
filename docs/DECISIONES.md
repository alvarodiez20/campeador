# Decisiones de arquitectura

Registro corto de las decisiones que cuesta revertir. Cada una dice qué se
decidió, por qué, y qué habría que hacer para deshacerla. Lo que no está aquí
es reversible y no merece un documento.

---

## ADR-001 — 2D isométrico con PixiJS v8, no 3D

**Decidido.** El render es 2D isométrico 2:1 sobre PixiJS v8 (WebGL, con
WebGPU disponible en el motor pero no seleccionado todavía; ver DEUDA-006).

**Por qué.** Es el camino con menos incógnitas para llegar a algo jugable:
batching automático, sin pipeline de materiales, sin LOD, sin sombras. El
coste está en el arte, no en el código, y el arte se puede posponer.

**Cuándo replantear.** Si el pipeline de sprites resulta inasumible: la
cuenta es 1 unidad × 4 animaciones × 5 direcciones × 15 frames × 2 pases =
**600 imágenes**, y con 5 unidades por facción y 2 facciones son **6.000**.
Si ese volumen no cabe en el presupuesto, se cambia a Three.js con
`InstancedMesh` y VAT. La simulación no cambiaría ni una línea: `src/render/`
es la única carpeta que habría que tirar.

**Descartado explícitamente:** Unity WebGL (tiempos de carga inaceptables en
navegador) y el export web de Godot 4 (frágil por los encabezados COOP/COEP
que exige su threading).

---

## ADR-002 — Simulación separada del render, con tick fijo a 15 Hz

**Decidido.** La simulación corre a 15 pasos por segundo con acumulador; el
render va a la frecuencia del monitor e interpola entre el tick anterior y el
actual. `src/sim` y `src/path` no importan nada de `src/render`.

**Por qué.** El motor gráfico no va a ser el cuello de botella; la simulación
sí. Y sin esta separación, ni el determinismo ni el multijugador ni las
pruebas headless son posibles: la mitad de los tests de este repositorio
corren en Node sin navegador precisamente porque la simulación no sabe que
existe una pantalla.

**Política de acumulador.** Si el navegador se congela se descartan los ticks
atrasados por encima de 5 en vez de intentar recuperarlos. En un RTS es
preferible perder medio segundo a entrar en una espiral de muerte.

---

## ADR-003 — Aritmética de punto fijo Q20.12 en toda la simulación

**Decidido.** Ni un `float` dentro de `src/sim` y `src/path`. Posiciones,
velocidades y distancias son enteros en Q20.12 (`src/core/fixed.ts`). La
aleatoriedad va por un xorshift128 propio; `Math.random` está prohibido.

**Por qué.** El multijugador previsto es lockstep determinista al estilo del
AoE original: por la red solo viajan las órdenes, nunca el estado. Con floats,
dos navegadores divergen y la partida se desincroniza sin remedio. Meter punto
fijo después de tener 5.000 líneas de simulación es rehacerla entera; meterlo
el primer día cuesta un fichero.

**Coste asumido.** El código es más incómodo de leer y hay que acordarse de no
usar `Math.sqrt` ni `>>` sobre valores que pasen de 2^31. Ese último detalle
ya causó un fallo real, cazado por `test/fixed.test.ts`.

---

## ADR-004 — Sin soporte táctil: escritorio, ratón y teclado

**Decidido, y decidido ahora a propósito.** El vertical slice es de
escritorio. No hay controles táctiles ni se van a añadir "más adelante".

**Por qué se decide ya.** Porque no es un añadido posterior. En táctil no hay
clic derecho ni hover, la selección por arrastre choca con el desplazamiento
del mapa, y el dedo tapa justo lo que se está señalando. Un esquema táctil
serio implica órdenes contextuales por menú radial, selección por doble toque
y una interfaz con objetivos mucho más grandes. Eso no es portar controles: es
rediseñar la interacción.

**Lo único que se hace por si se reabre.** Ningún sistema del juego habla con
el ratón. Todo lo que ocurre en `src/input/input.ts` acaba siendo una
`Command` en la cola. Un esquema táctil tendría que reimplementar ese fichero
y ninguno más.

---

## ADR-005 — Pathfinding en Web Worker: flow fields + A* jerárquico

**Decidido.** El hilo principal no calcula ni una ruta. El worker
(`src/path/worker.ts`) mantiene la rejilla de costes y responde con campos de
flujo. El A* jerárquico sobre clústeres de 16×16 acota la inundación a un
pasillo. La evitación local (separación tipo boids) sí va en la simulación,
porque depende del estado del tick.

**Por qué.** Mover 200 unidades al mismo sitio con 200 A* individuales es
calcular 200 veces la misma respuesta. Un campo de flujo se calcula una vez y
lo leen todas. Y hacerlo en el hilo principal congela el render justo cuando
el jugador acaba de dar una orden, que es el peor momento posible.

**Medido.** 500 unidades con obstáculos: **1,6 ms de media por tick** de
simulación completa (`test/rendimiento.test.ts`), campos de flujo de 128×128
en menos de 1 ms.

---

## ADR-006 — ECS propio en vez de una biblioteca

**Decidido.** ECS mínimo escrito a mano: columnas de `TypedArray` indexadas
por índice de entidad, máscara de componentes de 32 bits, handles de 32 bits
con 20 de índice y 12 de generación.

**Por qué.** Lo que se necesita cabe en 200 líneas y evita una dependencia con
su propio modelo de consultas, su propio serializador y sus propias sorpresas
de rendimiento. La generación en el handle no es un lujo: sin ella, una orden
de atacar sobrevive a la muerte de su objetivo y acaba atacando a la unidad
que reutiliza su hueco. Es el bug clásico de los RTS.

**Límite conocido.** No hay arquetipos: iterar recorre todos los índices vivos
comprobando la máscara. Con 2.000 entidades sobra; con 20.000 habría que
cambiarlo. Anotado en DEUDA-001.

---

## ADR-007 — El escenario es Valencia 1094 (Cuarte), no una campaña

**Decidido.** Un mapa, tres partes, cinco tipos de unidad, una condición de
victoria.

**Por qué.** Está acotado en tiempo y espacio, tiene tensión propia sin
necesitar árbol tecnológico, y el desenlace histórico —romper el cerco con una
salida, no aguantar tras los muros— tiene exactamente la forma de una misión
de RTS. Y mete a una taifa tributaria en el mapa, que es lo que hace jugable
la mecánica de parias en vez de dejarla en una pantalla de menú.
