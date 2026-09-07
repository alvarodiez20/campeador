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
  **Medido y no disparado:** en un MacBook Air M4 el peor render es de 5,98 ms
  con 500 unidades en combate y de 4,16 ms con 2.000, con WebGL vía ANGLE
  sobre Metal (ver [`PLAN.md`](PLAN.md)). No hay motivo para tocarlo todavía.
- **Arreglo:** quitar la preferencia. Todo lo que se dibuja son sprites y un
  quad texturizado; no hay shaders propios que portar (ver DEUDA-002, que
  habría que resolver con programas GLSL **y** WGSL).

### ~~DEUDA-007~~ · La IA reacciona a la composición del rival — **pagada**

`SimpleAI` ya no entrena una cuota fija: observa qué clases enemigas tiene a
la vista, lo recuerda con olvido de unos siete segundos y desplaza la mezcla
hacia el contrario del triángulo. Solo cuenta lo que está dentro de la niebla
descubierta: no lee el estado del mundo.

**Lo medido, que es lo interesante:** adaptarse **no cambia el desenlace de
forma medible** (tres puntos en 120 partidas contra un rival 85% caballería,
dentro del ruido), y no por estar apagada — se activa en el 42% de los ciclos.
Ver [`BANCO-DE-PARTIDAS.md`](BANCO-DE-PARTIDAS.md).

Eso mueve el problema de sitio: no es la IA, es que la composición pesa poco
frente a las torres, la economía y el número. Sigue en DEUDA-010.

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

Las estadísticas de `src/game/data.ts` cumplen el triángulo y ahora lo cumplen
también **en inferioridad numérica**, que es lo que hace que la composición
pese (ver [`BALANCE.md`](BALANCE.md)). Lo que sigue sin afinar son los ritmos
finos: tiempos de recolección, de construcción y de recarga están puestos a
ojo y ninguno se ha barrido buscando el mejor valor.

**Lo que se creía y era falso.** La entrada anterior decía que «los bonos del
triángulo son demasiado tímidos» y que había que subirlos. Se midió: subirlos
todos por igual **empeora**, de forma monótona (bonos ×2, ×3, ×4 y una bajada
de vida del 23%, todos peor que el punto de partida). La causa real era otra y
está corregida: dos de las cuatro aristas no existían.

- **Disparador:** cuando el escenario se juegue con personas y el ritmo de una
  fase concreta se note largo o corto. Los ritmos finos no se barren a ciegas.
- **Aviso para quien lo intente:** el banco tiene 17 puntos de ruido de semilla
  (ver DEUDA-013). Medir un ritmo con una sola semilla no vale.

### DEUDA-012 · La IA para el cuartel esperando comida

`SimpleAI.trainStuff` elige la clase más alejada de su cuota y, si no puede
pagarla, **ahorra en vez de gastar en lo barato**. La regla se escribió para
que el oro llegara a juntarse y la caballería existiera, y para eso funciona.

El problema es que se aplica a todos los recursos por igual. Instrumentando el
banco: de 603 ciclos de IA por partida en los que el Cid quiere entrenar, **429
(el 71%) acaban ahorrando sin encolar nada**, y **el 93% de esas esperas son
por comida**, no por oro. La comida vuelve sola cada pocos segundos; el oro hay
que ir a buscarlo. Se está pagando el precio de la regla sin cobrar su
beneficio: el cuartel pasa parado siete minutos de cada diez.

- **Coste hoy:** un 13% menos de ritmo de producción, y más en la personalidad
  que se adapta (429 ciclos parados frente a 310 la de cuota fija), porque al
  desplazar la cuota hacia una clase concreta se queda esperándola.
- **Lo que ya se probó y no vale.** Un tope de ciclos ahorrando (`AHORRO_MAX`)
  rompe la prueba `cubre los cuatro vertices del triangulo`: sin espera por oro
  no hay jinetes, que es exactamente el fallo que la regla evitaba. Afinarlo
  para que el tope solo aplique a la comida **tampoco** la salva, y además el
  reparto de victorias se fue al 50%. Está medido y revertido; no repetirlo sin
  atacar antes de dónde sale el oro.
- **Disparador:** cuando la IA tenga que sostener un ejército mayor, o cuando
  se quiera que adaptarse rente (hoy no renta, y esta es la razón).
- **Arreglo:** probablemente no está en `trainStuff` sino en el reparto de
  aldeanos: si el oro llegara con regularidad, la espera no haría falta.

### DEUDA-013 · El banco de partidas tiene 17 puntos de ruido

Cinco semillas de treinta partidas, sin tocar una línea de código, dan un
reparto de victorias de 57%, 50%, 53%, 60% y 67%. El duelo controlado es peor:
con cuarenta semillas por mano, el error típico de la diferencia entre las dos
manos ronda los diez puntos, y sin cambiar nada esa diferencia mide 0, -13 y 0
según la semilla.

- **Coste hoy:** alto y silencioso. Cualquier conclusión de balance sacada de
  una sola ejecución puede ser ruido, y ya ha pasado: un «+15 puntos a favor de
  adaptarse» que al repetirlo con otras semillas dio +13 y 0.
- **Paliativo que ya se usa:** comparar siempre la misma semilla contra sí
  misma, y calibrar lo que se pueda con el barrido determinista de doce contra
  N (`test/sim.test.ts`), que no tiene ruido.
- **Disparador:** cuando haya que decidir un cambio de balance cuyo efecto
  esperado sea menor de quince puntos.
- **Arreglo:** más semillas por ejecución y un estadístico de diferencia
  pareada con su intervalo, en vez de dos porcentajes sueltos; el banco ya
  empareja semillas entre manos, así que la información está, solo falta
  resumirla bien.

### DEUDA-014 · El volumen de arte está sin decidir

La cuenta de [`ARTE.md`](ARTE.md), ya con las fichas reales en la mano: 600
imágenes por unidad y facción, 1.800 el aldeano por sus cuatro cargas, y **más
de 8.000 en total** para seis unidades y dos facciones.

- **Coste hoy:** ninguno. El pipeline está montado y probado, y el criterio de
  aceptación de rendimiento pasó con margen (ver [`PLAN.md`](PLAN.md)), así que
  nada obliga a decidir hoy.
- **Riesgo:** decidirlo tarde. El propio script avisa de que a ese volumen
  conviene replantear hacia 3D con `InstancedMesh`, y esa vuelta atrás es
  barata ahora y carísima con treinta modelos hechos.
- **Disparador:** antes de modelar la segunda unidad. La primera se hace
  entera de principio a fin justamente para tener el dato real de cuánto cuesta
  una; con ese dato la decisión deja de ser una estimación.
- **Arreglo:** o recortar el alcance —menos fotogramas, menos cargas de
  aldeano, una sola facción con la otra resuelta por máscara— o cambiar de
  técnica. La simulación no cambiaría ni una línea: `src/render/` es lo único
  que habría que tirar (ADR-001).

