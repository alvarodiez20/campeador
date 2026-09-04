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

- **Lancero** vence a **caballería** (bono +18).
- **Caballería** vence a **ballestero** (bono +6, y la alcanza).
- **Infante** vence a **lancero** (bono +4, más armadura).
- **Ballestero** vence a **infante** (bono +2, y dispara a 5 casillas).
- **Aldeano** no vence a nadie: es la economía.

Hay una prueba por arista en `test/sim.test.ts` que enfrenta seis contra seis
y comprueba quién queda en pie. Si alguien toca los números, el test lo dice.

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
| Lancero | 55 | 5 | +18 vs caballería | 0 | 15 | 3,3 | 35 C · 25 M |
| Caballero | 110 | 10 | +6 vs arquero | 0 | 18 | 5,4 | 80 C · 60 O |
| Ballestero | 40 | 6 (perf.) | +2 vs infante | 5 | 26 | 3,1 | 30 C · 30 M · 30 O |
| Campeador | 320 | 18 | +8 vs asedio | 0 | 16 | 5,6 | héroe |

Recarga en ticks (la simulación va a 15 Hz), velocidad en casillas por
segundo. Coste: C comida, M madera, O oro, P piedra.

## Por qué el bono del lancero es tan alto

Porque la caballería tiene el doble de vida, casi el doble de velocidad y dos
puntos de armadura. Con un bono modesto, el lancero pierde: se comprobó, y el
test lo cazó. Un contador que no contesta no es un contador.

## Lo que está sin afinar

Todo lo demás. Ritmo de recolección, tiempos de construcción, coste de las
oleadas de la IA, tarifas de las parias. Los números son razonables y
consistentes, pero afinar el balance antes de que el escenario se juegue
entero es afinar sobre un juego que todavía cambia de forma. Anotado como
DEUDA-010.

## Regla de alcance

**Cada unidad nueva multiplica las interacciones que hay que probar.** Con 5
unidades hay 10 emparejamientos; con 8 hay 28. El contenido y el balance son
más trabajo que el código, y ese es el motivo por el que la lista de unidades
no crece todavía.
