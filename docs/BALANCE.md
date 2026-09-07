# Balance

## El triángulo, y nada más

Cinco tipos de unidad. El triángulo clásico y no se toca hasta que Cuarte 1094
se juegue entero de principio a fin:

```
   lancero  ──vence a──▶  caballería
      ▲                        │
      │                     vence a
   vence a                     │
      │                        ▼
   infante  ◀──vence a──   ballestero
```

- **Lancero** vence a **caballería** (bono +26).
- **Caballería** vence a **ballestero** (bono +6, y la alcanza).
- **Infante** vence a **lancero** (bono +4, más armadura).
- **Ballestero** vence a **infante** (bono +12, y dispara a 5 casillas).
- **Aldeano** no vence a nadie: es la economía.

Hay una prueba por arista en `test/sim.test.ts`, y además una que las mide en
inferioridad numérica. Esa segunda es la que importa: ver más abajo.

## Dos de las cuatro aristas no existían

Las pruebas de arista enfrentaban seis contra seis. Eso mide que el contador
exista, no que **pese**, y son cosas distintas: a igualdad de número la partida
ya la decide la economía. La pregunta útil es otra, **cuánta inferioridad
numérica compra elegir bien**, y al medirla —doce contra N en llano, sin
edificios ni terreno— apareció esto:

| Arista | Con los números originales | Ahora |
|---|---|---|
| infante → lancero | gana hasta 12 contra 21 | igual, sin tocar |
| caballería → ballestero | gana hasta 12 contra 30 | igual, sin tocar |
| lancero → caballería | **perdía ya a 12 contra 12** | gana hasta 12 contra 15 |
| ballestero → infante | **perdía 0-7 a 12 contra 12** | gana hasta 12 contra 15 |

No había triángulo: había una jerarquía con la infantería y la caballería
arriba. La arista del ballestero llevaba documentada aquí desde el principio y
era la única de las cuatro sin prueba propia.

Eso explica un resultado que parecía absurdo. La conclusión anterior era que
los bonos eran «demasiado tímidos» y había que subirlos todos; se probó, y
subirlos todos por igual **empeora** las cosas, cuanto más se suben peor. Es
coherente: subir todos los bonos por igual infla sobre todo las dos aristas
que ya mandaban.

Los bonos nuevos no se eligieron a ojo, se barrieron:

| Bono del lancero | +18 | +22 | +26 | +34 |
|---|---|---|---|---|
| Remonta hasta | pierde 12v12 | 12v12 | **12v15** | 12v18 |

| Bono del ballestero | +2 | +8 | +12 | +16 |
|---|---|---|---|---|
| Remonta hasta | pierde 12v12 | 12v12 | **12v15** | 12v18 (satura) |

Se escogen los valores mínimos que hacen la arista real: **+26 y +12**. Pasarse
no sale gratis —con +34 y +16 el duelo controlado contra arqueros se degrada de
forma reproducible— y el barrido dice que por encima de +16 el ballestero ya no
mejora.

## Fórmula de daño

```
daño = max(1, ataque + bono_si_la_clase_coincide − armadura_del_tipo)
```

Dos tipos de daño: cuerpo a cuerpo y perforante. Deliberadamente simple: el
triángulo tiene que ser legible a ojo desde la primera partida. Los números
son propios; lo que se copia de AoE2 es la **forma** de la relación, que es de
dominio público, no una tabla concreta.

## Tabla actual

| Unidad | Vida | Ataque | Bono | Alc. | Recarga | Vel. | Coste |
|---|---|---|---|---|---|---|---|
| Aldeano | 40 | 3 | — | 0 | 30 | 3,2 | 50 C |
| Peón de espada | 60 | 7 | +4 vs lancero | 0 | 15 | 3,4 | 60 C · 20 O |
| Lancero | 55 | 5 | +26 vs caballería | 0 | 15 | 3,3 | 35 C · 25 M |
| Caballero | 110 | 10 | +6 vs arquero | 0 | 18 | 5,4 | 80 C · 60 O |
| Ballestero | 40 | 6 (perf.) | +12 vs infante | 5 | 26 | 3,1 | 30 C · 30 M · 30 O |
| Campeador | 320 | 18 | +8 vs asedio | 0 | 16 | 5,6 | héroe |

Recarga en ticks (la simulación va a 15 Hz), velocidad en casillas por
segundo. Coste: C comida, M madera, O oro, P piedra.

## Por qué el bono del lancero es tan alto

Porque la caballería tiene el doble de vida, casi el doble de velocidad y dos
puntos de armadura. Con un bono modesto, el lancero pierde: se comprobó, y el
test lo cazó. Un contador que no contesta no es un contador.

Y con +18 **seguía sin contestar en cuanto había más de seis por bando**. Doce
lanceros contra doce jinetes acababa 0-1: el bono compensaba justo lo bastante
para empatar el intercambio de daño por segundo, y a partir de ahí decidía la
velocidad de la caballería. El seis contra seis lo tapaba.

## Lo que está sin afinar

Todo lo demás. Ritmo de recolección, tiempos de construcción, coste de las
oleadas de la IA, tarifas de las parias. Los números son razonables y
consistentes, pero afinar el balance antes de que el escenario se juegue
entero es afinar sobre un juego que todavía cambia de forma. Anotado como
DEUDA-010.

## Lo que el banco de partidas NO puede medir

Antes de mirar la tabla de abajo, un aviso que vale para cualquier cambio de
balance que se juzgue con `npm run playtest`.

**El banco tiene 17 puntos de ruido.** Cinco semillas, treinta partidas cada
una, **sin tocar ni una línea de código**:

| Semilla | 4244 | 777 | 31337 | 2024 | 99 |
|---|---|---|---|---|---|
| Victoria del Cid | 57% | 50% | 53% | 60% | 67% |

Eso obliga a dos cosas. La primera: **la banda 55-70% de este documento no se
sostiene**; dos de cinco semillas caen por debajo. La segunda, y más
importante: un cambio que mueva el reparto menos de unos quince puntos es
indistinguible de haber elegido otra semilla. Comparar siempre la misma semilla
contra sí misma, antes y después, y no fiarse de una sola.

El duelo controlado tiene el mismo problema, agravado: con cuarenta semillas
por mano el error típico de la **diferencia** entre las dos manos ronda los
diez puntos. Sin cambiar nada, la diferencia contra «solo jinetes» mide 0, -13
y 0 según la semilla. Un resultado de «+15 puntos a favor de adaptarse» medido
con una semilla no significa nada, y esto no es teórico: pasó, se persiguió, y
al repetirlo con otras dos semillas dio +13 y 0.

Por eso los bonos de arriba se eligieron con el barrido determinista de doce
contra N, que no tiene ruido, y no con el duelo.

## El escenario, medido

Treinta partidas completas con la IA en las tres partes
([`BANCO-DE-PARTIDAS.md`](BANCO-DE-PARTIDAS.md)):

| | |
|---|---|
| Victoria del Cid | 67% |
| Derrota | 33% |
| Sin resolver | 0% |
| Duración mediana | 434 s (7 min) |
| Composición final del Cid | 4,4 infantes · 6,3 lanceros · 3,5 jinetes · 5,5 arqueros |

El reparto de ventajas es el histórico y es el único que funcionó: **número
para el sitiador, fortificación para el sitiado**. Con la hueste almorávide
original el Cid ganaba el 92% sin una sola derrota; reforzándola sin tocar las
torres de Valencia, perdía el 100%.

## Regla de alcance

**Cada unidad nueva multiplica las interacciones que hay que probar.** Con 5
unidades hay 10 emparejamientos; con 8 hay 28. El contenido y el balance son
más trabajo que el código, y ese es el motivo por el que la lista de unidades
no crece todavía.
