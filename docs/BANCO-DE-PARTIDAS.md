# Banco de partidas

```bash
cd engine && npm run playtest -- --partidas=30
```

El punto 2 del plan pedía jugar Cuarte 1094 entero varias veces y anotar
dónde se rompe el ritmo. A mano son horas y la memoria es mal testigo: el
banco juega treinta partidas completas en veinte segundos, con las tres partes
llevadas por la IA, y saca una tabla por jugador cada quince segundos de
juego — recursos, población, unidades por clase, edificios por tipo, aldeanos
ociosos, bajas, oleadas y coste por tick.

**Lo que no mide:** si es divertido. Para eso hay que sentarse a jugarlo. Lo
que vigila es que el sistema tenga pulso: que la economía arranque, que las
oleadas lleguen, que el triángulo exista y que la partida se resuelva.

## Lo que encontró la primera tanda

Doce partidas bastaron para sacar siete fallos, ninguno de los cuales daba la
cara: la partida corría sin fallar, solo que mal.

| # | Síntoma medido | Causa |
|---|---|---|
| 1 | 33% de partidas sin resolver a los 20 min; mediana 1021 s | El escenario no tenía forma de acabar |
| 2 | Parias firmadas: **0 de 12** | La IA gestionaba contratos, pero ninguna los pedía nunca |
| 3 | Piedra clavada toda la partida (Cid 150, almorávides 250) | Nadie la recolectaba |
| 4 | Oro del Cid: 250 → 51 y ahí se quedaba | Nadie lo recolectaba |
| 5 | Ejército final: 18 lanceros, 1,3 infantes, **0,1 jinetes** | El lancero es la única unidad sin coste de oro |
| 6 | Almorávides: 29 militares → 2,2; edificios 11,5 → 8 | Perdían el centro urbano y no lo reconstruían |
| 7 | Albarracín congelada, **2.620 avisos** de «sin población» | Un aviso por edificio y por tick |

Los puntos 3, 4, 5 y 7 eran **el mismo bucle**: el reparto de aldeanos se
aplicaba una sola vez, con una cuota fija, y solo a los aldeanos ociosos. Con
ocho aldeanos y una cuota `[5,5,4,2]` nadie llegaba nunca al oro ni a la
piedra, el reparto inicial se congelaba y a los cinco minutos el ejército era
diecisiete lanceros: el triángulo entero colapsado a un vértice por un bucle
que no reasignaba.

## Lo que se arregló

- **Reparto de aldeanos por necesidad.** La cuota de la personalidad se
  multiplica por un factor de escasez, y los sobrantes de un recurso se mudan
  al que falta. Si hay algo que se quiere y no se puede pagar, el recurso que
  lo bloquea pesa por encima de todo.
- **Entrenar por cuota, no por orden de lista.** Antes se recorría
  `[lancero, infante, ballestero, caballero]` y se encolaba el primero
  pagable; como el cuartel siempre puede pagar un lancero, nunca se llegaba a
  las caballerizas. Ahora se elige la clase más alejada de su cuota, y si la
  más necesitada no se puede pagar **se ahorra** en vez de gastar en lo barato.
- **Lista de deseos al construir**, con el centro urbano en cabeza si se ha
  perdido: sin él no hay aldeanos nuevos y el rival se queda de zombi.
- **La IA exige parias**, y manda antes una escuadra a la puerta de la taifa,
  que es como se cobraban: con hueste delante.
- **No reagrupar a quien tiene al enemigo delante.** Este costaba doce oleadas
  por partida sin resultado: la unidad llegaba al campamento, se quedaba sin
  blanco al matar a los defensores y quince ticks después la IA la mandaba a
  casa por estar «dispersa» a cuarenta casillas del punto de reunión.
- **El cerco se levanta por desgaste**, y la partida tiene límite duro. Un
  asedio que no puede sostenerse se levanta, que es como acababan casi todos.
- **Aviso de población estrangulado** a uno cada cinco segundos.

Y un arreglo de raíz que salió de un test propio que se engañaba a sí mismo:
la máscara `mUnit` también casa con los edificios, porque tienen `transform`,
`owner`, `kind` y `health` como cualquier unidad. Cada sitio que quería «las
unidades» repetía el filtro a mano, y bastaba olvidarlo una vez para barrer la
ciudad entera sin enterarse. Ahora hay `Simulation.eachUnit()`.

## Antes y después

| | Antes | Después |
|---|---|---|
| Victoria / derrota / sin resolver | 42% / 25% / **33%** | 67% / 33% / **0%** |
| Duración mediana | 1021 s | 434 s |
| Partidas con parias | 0 de 12 | **30 de 30** |
| Jinetes al final (media) | 0,1 | 3,5 |
| Avisos de «sin población» | 1.585 – 3.321 | 1 |
| Coste medio por tick | 0,07 ms | 0,10 ms |

El reparto 67/33 es con la IA llevando también al Cid. Un jugador humano hace
mejor micro y peor macro, así que el objetivo era dejarlo en la banda 55-70%,
no en el 50% exacto.

## Balance del escenario, tal como se buscó

Dos iteraciones fallidas antes de acertar, las dos medidas:

- Hueste almorávide original → **92% de victoria y ni una derrota**. Eso no es
  un asedio.
- Hueste reforzada sin tocar la defensa → **100% de derrota**. Pasarse fue
  igual de fácil.
- Reparto histórico de ventajas —número para el sitiador, fortificación para
  el sitiado— → 67/33.

## Regresiones que quedan protegidas

Cada hallazgo tiene ahora su prueba en `engine/test/ia.test.ts` y
`engine/test/escenario.test.ts`. Ninguno rompía nada visible, así que sin
prueba volverían en silencio.
