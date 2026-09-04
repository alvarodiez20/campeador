# Tratamiento histórico

Esto es un requisito de diseño, no una sensibilidad opcional. Va aquí porque
se aplica al escribir código y datos, no solo al escribir textos.

## El problema, dicho claro

El Cid es material políticamente cargado en España. Fue apropiado por el
franquismo durante décadas como símbolo de una Reconquista entendida como
cruzada nacional. Un juego que trate a los andalusíes como enemigo genérico
—casillas que atacar, sin nombre, sin motivos, sin política propia— reproduce
esa lectura aunque no lo pretenda, envejecerá mal y generará un rechazo
merecido.

Y hay un argumento anterior al ético: **la versión honesta es más divertida de
jugar**. Fronteras porosas, alianzas cruzadas, mercenarios que cambian de
bando, tributos que se cobran y se rompen. Eso es un juego de estrategia. "Dos
bandos que se odian" es un juego de escaramuzas.

## Qué significa en el código

Estas no son intenciones. Son cosas que están implementadas y que hay que
mantener al añadir contenido.

1. **Las taifas son jugadores, no obstáculos.** En el escenario, Albarracín
   tiene centro urbano, aldeanos, economía e IA propia
   (`src/game/scenario.ts`). Recolecta y crece aunque nadie la mire.

2. **Se empieza en tregua con la taifa, no en guerra.** El estado inicial con
   Albarracín es `Tregua`, y hay un test que lo comprueba
   (`test/escenario.test.ts`). Atacarla es una decisión del jugador con
   consecuencias, no el estado por defecto.

3. **La taifa puede rebelarse.** `SimpleAI.manageDiplomacy` rompe la paria
   cuando el tributo la ahoga. No es traición: es lo que hizo al-Mutamid en
   1085, y por la misma razón.

4. **Exprimir a las taifas trae a los almorávides.** El medidor
   `presionAlmoravide` sube con cada pago cobrado. Al llegar al umbral, las
   parias desaparecen y entra un ejército que no negocia. La consecuencia
   histórica está codificada como consecuencia de juego, no como texto.

5. **Nombres propios en cada bloque.** El mismo rol se llama distinto según
   quién lo alista: "Peón de espada" en la mesnada, "Infante andalusí" en la
   taifa, "Peón lamtuní" entre los almorávides (`UnitDef.names` por
   `FactionBloc`). No hay una "unidad mora" genérica.

6. **Nota histórica en el HUD.** El panel de diplomacia explica en una línea
   qué hace ahí cada facción. Si el jugador no ve nunca por qué la taifa está
   en el mapa, el juego acaba tratándola como enemigo genérico por omisión.

7. **La ciudad no cambia de naturaleza al cambiar de dueño.** El texto del
   escenario dice lo que es Valencia en 1094: mayoría musulmana, su qadi, su
   zoco y su huerta, con un señor cristiano al frente. Porque es lo que era.

## El Cid histórico frente al mitificado

El personaje real es mejor material que el legendario:

- Sirvió a Sancho II y después a Alfonso VI, que lo desterró dos veces.
- Entre 1081 y 1086 sirvió a los emires de Zaragoza al-Muqtadir y al-Mutamin,
  mandando ejércitos andalusíes **contra ejércitos cristianos**: en Almenar
  (1082) contra Aragón y Barcelona; en Tébar (1090) volvió a derrotar a
  Berenguer Ramón II.
- Ya en 1063, en Graus, combatió del lado de Zaragoza contra Aragón.
- Acabó gobernando Valencia por cuenta propia, sin ser vasallo de nadie.

Una campaña donde el jugador cambia de bando según quién le paga es más
interesante y más veraz que la del héroe nacional impoluto. La estructura
narrativa ya está escrita: el *Cantar de mio Cid* da destierro → bodas →
afrenta de Corpes.

## Lo que no se hace

- No se usa la palabra "Reconquista" como marco explicativo del periodo.
- No hay bonificaciones ni penalizaciones por religión.
- No hay "unidades genéricas" para un bando y unidades con nombre para otro.
- No se representa el conflicto como guerra de exterminio: en el mapa hay tres
  partes y la tercera cobra tributo de las otras.

## Precisión frente a jugabilidad

Cuando chocan, gana la jugabilidad, pero se anota. Ahora mismo:

- La batalla de Cuarte (octubre de 1094) fue una salida contra un cerco muy
  superior en número; aquí los ejércitos están más igualados para que la
  partida se pueda perder y ganar.
- Las parias reales se pactaban por temporadas y en cantidades enormes, no en
  goteo continuo. El goteo existe porque un RTS necesita renta legible.
- Albarracín está en el mapa por razones de juego. Históricamente pagaba
  parias al Cid, pero no estaba a media legua de Valencia.
