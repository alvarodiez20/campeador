# Deuda técnica

Lista de lo que se ha hecho a sabiendas de que no es lo correcto a largo
plazo, con el motivo y lo que costaría arreglarlo. La regla del proyecto es
documentar la deuda en lugar de evitarla; esto es el registro.

Cada entrada tiene un **disparador**: la señal concreta que dice que ha
llegado el momento de pagarla. Sin disparador, una lista de deuda es una lista
de deseos.

---

### DEUDA-001 · ECS sin arquetipos

`World.each` recorre todos los índices vivos comprobando una máscara de bits.
Es O(entidades totales) por consulta, no O(entidades que cumplen).

- **Coste hoy:** ninguno medible. Con 2.000 entidades y ~8 consultas por tick
  son unos 16.000 tests de máscara, por debajo del ruido.
- **Disparador:** más de 5.000 entidades vivas, o `tickMs` por encima de 8 ms
  con el perfil dominado por iteración.
- **Arreglo:** listas densas por componente, o arquetipos con movimiento de
  memoria al añadir o quitar componentes.

### DEUDA-002 · Niebla de guerra sin shader propio

La niebla es una textura de baja resolución (un texel por casilla) compuesta
por la GPU con un quad en modo multiplicativo y filtrado bilineal. La rampa de
tres bandas (desconocido / explorado / visible) se calcula en CPU al rellenar
el buffer, no en un fragment shader.

- **Coste hoy:** el degradado es el que da el filtrado bilineal, sin control
  fino. No hay revelado progresivo ni tramado en el borde.
- **Disparador:** cuando el borde de la niebla se vea mal en el arte
  definitivo, o cuando se quiera revelado con transición temporal.
- **Arreglo:** `Shader.from({ gl, gpu })` sobre el mismo quad de
  `src/render/fog.ts`. El quad, la textura y la frecuencia de subida ya están;
  es un cambio local a ese fichero.

### DEUDA-003 · A* jerárquico con clústeres como nodos, no portales

El grafo abstracto usa clústeres enteros de 16×16 como nodos, en lugar de
portales individuales en las fronteras.

- **Coste hoy:** el pasillo que devuelve es más ancho de lo necesario en mapas
  laberínticos, así que el campo de flujo explora de más. Nunca da rutas
  incorrectas: el pasillo siempre contiene la óptima.
- **Disparador:** mapas con pasillos estrechos y muchos callejones sin salida,
  o `lastMs` de campo de flujo por encima de 5 ms.
- **Arreglo:** nodos = portales (parejas de casillas en la frontera), con
  coste intra-clúster precalculado por BFS.

### DEUDA-004 · Evitación local por separación, no RVO

`movementSystem` empuja unidades solapadas con una separación tipo boids en
vez de calcular velocidades recíprocas (RVO/ORCA).

- **Coste hoy:** dos grupos que se cruzan de frente se empujan en lugar de
  esquivarse; el resultado se ve algo "borreguil".
- **Disparador:** cuando el movimiento en formación sea parte de la propuesta
  de juego, o cuando los cruces de ejércitos se vean mal en pruebas con
  jugadores reales.
- **Arreglo:** sustituir el bloque de separación de `movementSystem`. Está
  aislado a propósito: entra y sale sin tocar nada más.

### DEUDA-005 · Sin formaciones ni dispersión de metas

Una orden de mover a 100 unidades manda a las 100 a la misma casilla. Llegan y
se empujan hasta que la detección de atasco las da por llegadas.

- **Coste hoy:** funciona (85+ de 100 unidades acaban a menos de 9 casillas de
  la meta, comprobado en `test/sim.test.ts`), pero la llegada no es elegante.
- **Beneficio de dejarlo así:** todas comparten un único campo de flujo, que
  es lo que hace barato el movimiento en grupo.
- **Disparador:** cuando se implementen formaciones de verdad.
- **Arreglo:** repartir metas en anillos alrededor del punto pedido,
  manteniendo un solo campo de flujo y desplazando solo el último tramo.

### DEUDA-006 · WebGL forzado, WebGPU sin probar

`Application.init` usa `preference: 'webgl'`.

- **Motivo:** WebGL da el comportamiento más predecible hoy, y el criterio de
  aceptación se mide sobre una sola ruta.
- **Disparador:** cuando el render pase de 8 ms por frame en hardware real.
- **Arreglo:** quitar la preferencia. Todo lo que se dibuja son sprites y un
  quad texturizado; no hay shaders propios que portar (ver DEUDA-002, que
  habría que resolver con programas GLSL **y** WGSL).

### DEUDA-007 · La IA no reacciona a la composición del rival

`SimpleAI` entrena por cuota fija (30% lancero, 25% infante, 25% arquero, 20%
jinete). Cubre los cuatro vértices del triángulo, pero no mira lo que tiene
delante: si el jugador va todo caballería, la IA no saca más lanceros.

- **Coste hoy:** el oponente es previsible. Ya no es *inofensivo* —el banco de
  partidas da 33% de derrotas—, pero es leíble.
- **Disparador:** al pasar a afinar el balance en serio. Una IA que no
  reacciona invalida cualquier medición de balance.
- **Arreglo:** contar clases enemigas vistas y desviar la cuota hacia su
  contador. El sitio es `trainStuff`, que ya ordena por déficit: basta con que
  la cuota deje de ser constante.

### DEUDA-011 · La taifa de Albarracín apenas crece

En el banco de partidas Albarracín termina con dos o tres lanceros y dos
casas, partida tras partida. Recolecta y paga sus parias, que es su papel en
el escenario, pero no se desarrolla.

- **Coste hoy:** bajo. Está en el mapa para ser la parte tributaria, no un
  tercer contendiente, y esa función la cumple en el 100% de las partidas.
- **Riesgo:** si el jugador decide romper la paria y atacarla, encuentra un
  rival de cartón. La mecánica de parias pierde la mitad de su tensión si
  traicionar no cuesta nada.
- **Disparador:** cuando romper la paria sea una jugada que el diseño quiera
  premiar o castigar de verdad.
- **Arreglo:** revisar la guarda de economía de `trainStuff` para una base
  pequeña, y darle un objetivo de aldeanos acorde a su mapa.

### DEUDA-008 · Sin multijugador, pero con la puerta abierta

No hay red. Lo que sí hay es todo lo que el lockstep necesita: punto fijo,
RNG serializable, órdenes como único punto de entrada a la simulación, y un
hash de estado (`test/helpers.ts`) que detecta desincronización.

- **Disparador:** el resto del vertical slice terminado. Es el último punto de
  la lista de trabajo, y con razón.
- **Arreglo:** cola de órdenes con retardo de N ticks, WebSocket (o Colyseus
  para quitarse el boilerplate), y comparación periódica del hash de estado.

### DEUDA-009 · Sin sonido

No hay ni efectos ni música.

- **Disparador:** después del pipeline de arte. Antes no aporta información
  que el jugador necesite para jugar.

### DEUDA-010 · Números de balance provisionales

Las estadísticas de `src/game/data.ts` cumplen el triángulo (comprobado en
`test/sim.test.ts`) y el escenario está medido (67/33 en treinta partidas,
ver [`BANCO-DE-PARTIDAS.md`](BANCO-DE-PARTIDAS.md)). Lo que sigue sin afinar
son los ritmos finos: tiempos de recolección, de construcción y de recarga
están puestos a ojo y ninguno se ha barrido buscando el mejor valor.

- **Disparador:** después de resolver DEUDA-007. Afinar números contra una IA
  que no reacciona es afinar contra un maniquí.
