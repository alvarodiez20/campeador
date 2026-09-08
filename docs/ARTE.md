# Arte: fichas de unidad y pipeline

Especificación visual de las unidades, unidad por unidad. **No son sprites
finales ni código de producción**: son las pautas que consume el pipeline de
`engine/tools/blender/hornear_sprites.py`.

El documento visual está en [`arte/fichas-de-unidad.html`](arte/fichas-de-unidad.html).
Se abre en cualquier navegador, sin servidor ni compilación: dibuja cada figura
por código sobre `<canvas>`, a escala real de 60 px y ampliada, con la silueta,
la vista de tres cuartos, el mapa de la máscara de color de jugador y las poses
clave de las cuatro animaciones.

Los valores de color están además en
[`../engine/tools/blender/paleta.json`](../engine/tools/blender/paleta.json),
al lado del script que los va a usar.

La copia del repo se aparta de la entrega original en dos cosas, las dos
menores: las tipografías se cargan de `fonts/`, que ya están en el repo y no
hacía falta duplicarlas, y se han quitado dos copias del recuadro del par
difícil «S contra N» que venían pegadas en las hojas del arquero y del aldeano.
El recuadro habla de un caballo visto de frente y por la grupa, así que se
queda solo donde corresponde, en la del caballero.

**Fidelidad: especificación de arte, no maqueta.** Los números —alto en
píxeles, área de máscara, ángulos de pose, hex de paleta— son vinculantes. El
acabado no: el nivel de detalle final lo da el modelado, y las figuras del
documento son geometría procedural que marca proporción, silueta y reparto de
color. No hay que replicar el trazo, hay que respetar la lectura.

## El roster: doce fichas, dos bloques

| Unidad | Bloque | Alto | Caja | Zona teñible |
|---|---|---|---|---|
| Aldeano (4 cargas) | Mesnada | 56 px | 64×84 | Sayo completo · 275 px² |
| Peón de espada | Mesnada | 60 px | 64×84 | Escudo de cometa · 181 px² |
| Lancero | Mesnada | 60 px | 64×84 | Escudo de cometa + pendón · 209 px² |
| Arquero | Mesnada | 57 px | 64×84 | Perpunte completo · 214 px² |
| Caballero | Mesnada | 66 px · 86 con lanza | 96×104 | Escudo + pendón + telliz · 356 px² |
| Rodrigo Díaz | Mesnada | 66 px · 86 con lanza | 96×104 | Escudo + seña + telliz · 414 px² |
| Aldeano (4 cargas) | Almorávide | 56 px | 64×84 | Sayo · 289 px² |
| Peón lamtuní | Almorávide | 61 px | 64×84 | Túnica + adarga · 345 px² |
| Lancero lamtuní | Almorávide | 70 px | 64×84 | Túnica + adarga · 321 px² |
| Arquero lamtuní | Almorávide | 60 px | 64×84 | Túnica · 172 px² |
| Jinete lamtuní | Almorávide | 66 px · 86 con lanza | 96×104 | Adarga + pendón + telliz · 428 px² |
| Abu Bakr ibn Ibrahim | Almorávide | 66 px · 86 con lanza | 96×104 | Adarga + seña + telliz · 482 px² |

El arte de la mesnada sirve también al bloque **Cristiano**: es la misma pieza
con otra máscara, que es justo el principio del pipeline.

**Falta el bloque de las taifas.** Cinco unidades andalusíes —el Campeador no
tiene nombre en ese bloque, así que no lleva ficha— sin dibujar. Es el único
hueco del roster, y `engine/test/paleta.test.ts` lo declara para que no se
olvide: la prueba falla el día que se rellene sin tocar el mapa de bloques.

## Cómo se miden las áreas de máscara

Contando blanco en el pase de máscara **con muestreo a resolución de unidad**,
es decir, tomando el centro de cada bloque de la ampliación en vez de contar
los píxeles del canvas ampliado. Contar sobre el ampliado infla la cifra
alrededor de un 10% por el antialias.

Los números de esta entrega **sustituyen a los de la anterior**, que se
midieron con otro criterio y no son comparables con estos. Si se vuelve a
medir, mismo criterio o los números dejan de servir para comparar unidades,
que es lo único para lo que existen.

## Restricciones del motor que la ficha asume

- Proyección isométrica 2:1, casilla 64×32 px, cámara ortográfica a 30° de
  elevación.
- **Dos cajas de sprite.** La infantería y el aldeano caben en **64×84 px**;
  la caballería necesita **96×104**, dos casillas de ancho. La figura mide
  56-70 px de la planta al alto de la cabeza; el resto lo ocupan las armas por
  encima y la sombra por debajo.
- Cinco direcciones renderizadas —**S, SO, O, NO y N**—, tres obtenidas
  volteando en horizontal.
- Cuatro animaciones —quieto, andar, atacar, morir— de quince fotogramas.
- Dos pases por fotograma: base y máscara de color de jugador.
- Ocho colores de jugador, del dorado al índigo.

La segunda caja es nueva y tiene dos consecuencias que no son de arte. Una,
`hornear_sprites.py` ya no renderiza cuadrado: toma `--ancho` y `--alto`, y
la escala de la cámara se calcula a partir de la caja para que los píxeles por
unidad de mundo sean los mismos en las dos —si no, el mismo modelo saldría un
24% más grande en la caja grande—. Dos, el orden de dibujo del motor ordena
por casilla y un jinete se sale de la suya: es **DEUDA-015**, y se paga cuando
haya el primer sprite de caballería, no antes.

## La rueda de direcciones: ya no hay discrepancia

Las primeras fichas dibujaron las siluetas en E, SE, S, SO y O, que era el
juego de cinco que horneaba el script cuando se escribieron, y ese juego
estaba mal: voltear en horizontal cambia una dirección por su reflejo respecto
al eje vertical de la pantalla, y ese reflejo empareja E con O y SE con SO,
dejando N y S como sus propios espejos. Dos de los cinco renders eran la misma
imagen que otros dos, y **no se producía ninguna vista de espaldas**: una
unidad que caminara hacia el norte miraba a cámara.

Se corrigió en el script y en el motor —el motivo largo está en el comentario
de `DIRECCIONES` en `engine/tools/blender/hornear_sprites.py`, y
`test/atlas.test.ts` lo comprueba en los dos lados—, y **el documento visual
ya viene redibujado con la rueda corregida**: las doce fichas muestran S, SO,
O, NO y N. Quien modele ya no tiene que traducir nada de esta parte.

## Las claves de unidad no son los títulos de las fichas

Los fotogramas se llaman `unidad/<clave>/<octante>/<animacion>/<frame>/<capa>`,
y esa `<clave>` es la de `UnitDef.key` en `engine/src/game/data.ts`. Las fichas
se titulan con el nombre de la unidad en la mesnada, que no siempre coincide:

| Título de la ficha | Clave |
|---|---|
| Peón de espada · Peón lamtuní | `infante` |
| Rodrigo Díaz · Abu Bakr ibn Ibrahim | `campeador` |
| Ballestero | `arquero` |

`engine/test/paleta.test.ts` comprueba que `paleta.json` usa las claves del
motor y no los títulos. No es celo: la entrega de diseño llegó con los títulos
como claves, y uno de ellos —`ballestero`— era además una decisión ya cerrada
en sentido contrario.

## Materiales de Blender

El script saca en blanco todo material cuyo nombre empiece por `jugador`
(`orig.name.lower().startswith("jugador")`). Nombres a usar:

| Unidad | Mesnada | Almorávide |
|---|---|---|
| Aldeano | `jugador_sayo` | `jugador_sayo` |
| Peón de espada | `jugador_escudo` | `jugador_tunica`, `jugador_adarga` |
| Lancero | `jugador_escudo`, `jugador_pendon` | `jugador_tunica`, `jugador_adarga` |
| Arquero | `jugador_perpunte` | `jugador_tunica` |
| Caballero | `jugador_escudo`, `jugador_pendon`, `jugador_telliz` | `jugador_adarga`, `jugador_pendon`, `jugador_telliz` |
| Héroe | `jugador_escudo`, `jugador_sena`, `jugador_telliz` | `jugador_adarga`, `jugador_sena`, `jugador_telliz` |

La prenda del héroe —la capa de Rodrigo, el burnús de Abu Bakr— **no lleva
prefijo**: es de color fijo, y es la mitad de lo que distingue al héroe.

**Regla que no se puede saltar: la zona teñible se pinta plana**, sin degradado
ni sombra horneada. El tinte del motor multiplica, así que cualquier
oscurecimiento pintado se dobla; con índigo o granate la zona se vuelve negra.
La sombra de esas piezas la pone la iluminación **fuera** de la máscara: borde,
refuerzo, bloca.

## Especificación por unidad · mesnada

Ángulos en grados, 0 = vertical hacia arriba, positivo = hacia delante en
pantalla. Las poses son extremos de interpolación, no fotogramas.

### Lancero — 60 px

- Cota de malla de faldón a la rodilla con abertura delantera, sobre perpunte
  de lana. Almófar de malla, capacete cónico con nasal y reborde.
- Escudo de cometa embrazado y **centrado sobre el torso**: el volteo cambia la
  mano, pero no la masa, porque el escudo cae sobre la línea media.
- Lanza **calada** entre 10° y 32° según dirección, nunca vertical: vertical
  añade 25 px sobre la cabeza y rompe la caja. Sobresale 8 px sobre el
  capacete en SO.
- Moharra de hoja de laurel, pendón con farpas, vaina y guarnición de espada en
  la cadera contraria.
- Ataque: **estocada** recta; la moharra sale de la casilla en el impacto.

### Peón de espada — 60 px

- Equipo defensivo idéntico al lancero. La distinción es el arma y la masa
  vertical: en guardia media la espada **no sobresale** de la cabeza.
- Escudo de cometa un 18% más grande que el del lancero, y aun así **no
  compensa** lo que aportaba la banderola: 181 px² frente a 209, veintiocho
  menos. Es la máscara más pequeña del roster.
- Espada de hoja ancha de un metro escaso, guarnición recta, pomo de nuez,
  tahalí al hombro.
- Ataque: **tajo diagonal**; la hoja cruza la línea del hombro y sale de la
  casilla.
- Andar y morir son los mismos ciclos que el lancero: reutilizables en el rig.
- Punto débil conocido: en E y O el escudo se ve de canto y la unidad se queda
  casi sin zona teñible, sin pendón que lo salve.

### Arquero — 57 px

**Era «ballestero» y llevaba ballesta. Ya no: ver el apartado siguiente.**

- **Sin malla y sin escudo**: perpunte acolchado de bastas verticales como
  armadura única, capacete de reborde ancho **sin nasal**, caperuza de lana,
  calzas a la vista.
- Bajo del perpunte a media pierna, más corto que la cota, para que el paso se
  lea a pesar del arma.
- Arco de guerra sencillo de tejo o de olmo, de la altura del hombro, cuerda de
  cáñamo. Sin arco compuesto y sin recurvado pronunciado. Carcaj a la cadera
  contraria, **tres** flechas asomando.
- Reparto de los quince fotogramas de atacar: **6 armar y tensar, 4 apuntar,
  5 suelta y bajada**. La simulación no exige hoy un fotograma de disparo fijo:
  el daño se aplica al llegar el `reload` a cero
  (`src/sim/systems/combat.ts`), sin proyectil en vuelo. Si eso cambia, hay que
  fijar el fotograma.
- **La silueta es el problema abierto de esta unidad**, y hay que resolverlo en
  el diseño, no en el render. La ballesta daba una barra horizontal de 17 px a
  media altura que no tenía ninguna otra figura del roster; el arco, tensado,
  da una forma vertical que compite con la lanza del lancero. Palancas
  disponibles: el arco en reposo cruzado en diagonal a la espalda, la caperuza
  como remate de cabeza distinto del capacete de lancero y peón, y el carcaj
  como masa a la cadera. Los criterios 1 y 3 de aceptación son los que mandan
  aquí.
- **La máscara de 214 px² está medida sobre la figura con ballesta**, que es la
  que sigue dibujando el documento visual. Con el arco tensado delante del
  cuerpo va a bajar, y hay dato para saber cuánto: el arquero lamtuní, con ese
  mismo gesto, se queda en 172 frente a los 321 y 345 de sus compañeros de
  bloque. Hay que volver a medirla cuando se redibuje.

## Por qué es un arquero y no un ballestero

La ficha original dibujó una ballesta de mano temprana y dejó la duda abierta,
con tres salidas: (a) arquero, (b) ballesta temprana, (c) ballesta plena. Se
elige **(a) arquero**, y por tres motivos, por orden de peso:

**1. Es lo documentado para esta hueste.** La ballesta en 1094 es defendible en
Europa —Ana Comnena la describe en 1096, y que Letrán II la prohíba en 1139
implica uso anterior— pero no está documentada en la península en esa fecha.
Lo que sí lo está para la mesnada es el arco y la honda. La (c) se descarta
sola: la ballesta plena, con estribo y torno, es del siglo XIII.

**2. Una sola pieza de arte tiene que servir a los cuatro bloques.** El
principio del pipeline es que la unidad es la misma pieza con otra máscara y
otro corte de tocado, nunca una unidad genérica para un bando. Tres de los
cuatro nombres ya decían arquero —`Arquero andalusi`, `Arquero almoravide`—, así
que con ballesta la única salida era un segundo modelo o un nombre que miente.
Y un segundo modelo son 600 imágenes más sobre las de DEUDA-014, que es
justo el riesgo vivo del proyecto.

**3. No cuesta nada en balance.** Las estadísticas no se tocan: vida 40, ataque
6 perforante, bono +12 contra infante, alcance 5, recarga 26. La recarga de 1,73
segundos es lenta para un arco, pero es perfectamente defendible como tiro
apuntado, y mantenerla deja intacta la calibración del triángulo que se acaba
de medir. Cambiar los números por una razón de nombre habría sido rehacer el
trabajo sin un motivo de juego.

**Lo que cuesta:** la mejor silueta del roster. Está anotado arriba como el
problema abierto de la unidad, y en
[`TRATAMIENTO-HISTORICO.md`](TRATAMIENTO-HISTORICO.md).

**El documento visual sigue dibujando la ballesta**, y sigue titulando la hoja
«Ballestero». Es la única discrepancia que queda entre la ficha y el repo —la
de la rueda de direcciones ya está cerrada—: quien modele tiene que leer este
apartado, no copiar la figura. La hoja del bloque almorávide, que es
posterior, ya dibuja un arco.

### Aldeano — 56 px, cuatro variantes con carga

- Sayo de lana a media pierna ceñido con cinturón, caperuza con vuelo caído,
  calzas de lino, calzado de cuero. Sin nada metálico salvo el filo de la
  herramienta.
- **Una sola herramienta** —hacha corta— para las cuatro tareas. Una por
  recurso multiplicaría el atlas por cuatro sin ganancia a 60 px.
- La animación de «atacar» es el **golpe de trabajo**, y el motor la reutiliza
  para recolectar, construir y reparar.
- Cargas: `lena` (haz atado en diagonal a la espalda), `piedra` (serón de mimbre
  con bloques), `oro` (saco pequeño al hombro), `comida` (cesto a la cadera con
  gavilla asomando).
- Máscara en el sayo completo, 275 px²: la mayor del roster a pie. **Aviso:**
  el haz de leña y el serón tapan medio sayo por la espalda, así que la máscara
  no es constante en E, O ni en las volteadas. Se decidió **no** teñir además
  la caperuza: a 60 px parece un capirote.

### Caballero — 66 px, 86 con la lanza, caja 96×104

- Caballo y jinete son **un solo cuerpo**: un rig, una silueta. Ancho de mancha
  44 px de perfil y 20 de frente.
- **La caja es de dos casillas de ancho**, y el motor tiene que saberlo para el
  orden de profundidad: el sprite invade la casilla vecina (DEUDA-015).
- Jinete equipado como la infantería pesada. Silla de borrenes altos, estribos,
  brida y **telliz**.
- Tres zonas teñibles: escudo, pendón y telliz, 356 px². El telliz es la única
  visible desde cualquier ángulo, y es lo que resuelve la vista de espaldas.
- **El caballo no se tiñe**: cuatro pelajes fijos por unidad (castaño, alazán,
  tordo, negro).
- Lanza vertical en quieto y trote; **calada bajo el sobaco solo en la carga**.
  En la caja de 104 la punta llega a y=10, con margen; en la de infantería no
  cabía, y esa es la razón de la caja grande.
- Andar = **trote** con fotograma de suspensión. Muerte en dos tiempos:
  encabritado y caída de los dos juntos dentro de la casilla.
- Descartado: barda o gualdrapa (siglo XIII), yelmo cerrado con cimera, pierna
  estirada, galope en el ciclo de andar.
- **Par difícil declarado: S contra N.** Un caballo de frente y un caballo por
  la grupa son casi la misma mancha. Medido píxel a píxel sobre la ficha,
  cambia el 18% (167 de 929 px) con la misma caja envolvente, 28×86. Lo que
  sostiene la diferencia: en S la cabeza cuelga entre las manos y el escudo sale
  a media altura; en N no hay cabeza ni escudo, la grupa es un 34% más ancha
  que el pecho y la cola cae por el centro. **Hay que probarlo en juego antes
  de modelar**; si no basta, acentuar el balanceo de la cola en N y mantener el
  escudo siempre en el mismo lado de pantalla. Lo que no vale es resolverlo con
  sombreado: la silueta es lo que el jugador lee.

### Rodrigo Díaz — 66 px, misma caja y misma altura que el caballero

- **Lo que pedía el brief no se puede cumplir en silueta.** Sin salirse de la
  escala, la mancha solo cambia el 14% en SO y el 12% en O respecto a un
  caballero, con la misma caja envolvente.
- La distinción la sostienen tres cosas que no rompen la escala: **pelaje
  tordo** `#ece6da` —casi blanco: funciona por valor, no por forma—, **seña un
  50% mayor de superficie pero con la misma altura**, y **capa de granate fijo
  `#8a3a2c` fuera de la máscara**.
- Máscara 414 px², un 16% más que el caballero. Mismo rig y mismos ciclos:
  cero animación nueva. La capa se anima por deriva, con retardo respecto al
  tronco.
- Consecuencia útil: el mismo sprite, con escudo y seña teñidos con los colores
  de una taifa, es Rodrigo al servicio del emir de Zaragoza en 1082. Si su
  identidad estuviera en un emblema cristiano, ese escenario no se podría
  representar.
- Descartado: cruz en escudo, capa o seña —es la iconografía con la que el
  franquismo construyó al Cid cruzado, y además es falsa para 1094—, caballo
  más grande, corona, cimera, armadura dorada, aureola o partículas; la barba
  (dos píxeles a esta escala: va en el retrato del panel de mando) y Tizona y
  Colada como objetos identificables.
- Declarado: **Babieca es del *Cantar*** (c. 1200), no de la *Historia
  Roderici*. El caballo claro es una decisión de producción de origen
  legendario. No existe ninguna descripción física contemporánea de Rodrigo
  Díaz, así que la ficha no le da cara.

## Regla de héroe

**Un héroe se reconoce por lo que no se tiñe.** Silueta idéntica a la tropa de
su bloque, y distinción por tres palancas: **valor** (montura clara), **tamaño
de la seña** y una prenda de **color fijo fuera de la máscara**. Nada de escala
aumentada, símbolos religiosos ni efectos. Vale para Rodrigo, vale para Abu
Bakr y vale para el héroe andalusí que no está hecho.

## Bloque almorávide (al-Murabitun)

Misma altura, misma caja, mismos ciclos y el mismo nivel de detalle que la
mesnada. **El bloque no añade ni una animación nueva**: se rehornean las mismas
cuatro acciones con otras cabezas, otros escudos y otras astas.

- **Lancero lamtuní** — lanza larga, adarga redonda, litham, túnica de lana en
  vez de cota. **Límite encontrado al dibujar:** con el asta larga no existe
  ningún ángulo de reposo que meta la punta dentro de 64×84 —si se levanta se
  sale por arriba, si se cala se sale por el lado—, así que el asta queda en
  47 px y el reposo se fuerza a **32° mínimo de calado**. Entra justa, con 1 px
  de margen en S y en N. Y eso cambia el tell: **no es más alto, es más ancho**
  —38 px de ancho de mancha en SO frente a 34 del lancero cristiano—. El asta
  larga, al calarse, no sube: se tumba. La alternativa era caja propia, como la
  caballería, y no la merece.
- **Peón lamtuní** — hoja recta, la misma que el peón cristiano. Es el par más
  parecido del roster, y a propósito: el equipo de choque a pie era el mismo a
  los dos lados de la frontera.
- **Arquero lamtuní** — arco compuesto de asta y tendón, tenso en vertical
  delante del cuerpo, y carcaj a la cadera. Aquí el arma sí está documentada,
  así que esta hoja no arrastra la duda de datación de la ficha del arquero
  cristiano.
- **Aldeano** — el mismo sayo, la misma herramienta y las mismas cuatro cargas;
  cambia el tocado, un paño envuelto en lugar de caperuza. **No lleva litham**:
  el velo es de los hombres de guerra sanhaya, no del que cava.
- **Jinete lamtuní** — caja 96×104 y ciclos del caballero. Adarga, lanza larga
  con pendón y telliz. Sin barda, igual que el cristiano. La diferencia táctica
  va en los datos de unidad, no en el arte.
- **Abu Bakr ibn Ibrahim al-Lamtuni** — mando del ejército que cercó Valencia
  en 1094. Mismo sistema de héroe que Rodrigo: montura clara, seña ampliada y
  burnús de color fijo fuera de la máscara.

Decisiones tomadas y por qué:

- **Litham en lana cruda `#d8d2c4`, no en índigo.** El velo que da nombre al
  bloque se asocia al índigo, y el índigo es uno de los ocho colores de
  jugador. Se pierde el azul y queda anotado.
- **La adarga es la máscara principal:** redonda, se lee igual desde cualquier
  ángulo, así que la zona teñible no se hunde en las vistas de perfil como le
  pasa al escudo de cometa.
- **Sin pendón en la lanza de tropa y sin cota de malla:** la máscara la llevan
  túnica y adarga.

Descartado: cimitarra o sable curvo (tópico y falso: la espada de esta gente en
1094 es recta); media luna, caligrafía o cualquier símbolo religioso; rasgos
faciales diferenciados; turbante enorme, ropa flotante y joyas (orientalismo
del XIX); y los tambores **como accesorio colgado de un peón** —están
documentados y son un rasgo real del bloque, pero van como unidad propia o como
sonido, no como adorno—.

**Resultado medido, y conviene conocerlo antes de balancear el arte:** este
bloque se lee mejor de bando que la mesnada. 321 y 345 px² de máscara en sus
dos unidades de choque a pie, frente a 209 y 181 de sus equivalentes
cristianos, porque visten tela teñida donde el otro bloque lleva malla. El
único que pierde es el arquero, 172 frente a 214, porque el arco cruza el
torso. Si la diferencia molesta, lo honesto es **subir la del bloque
cristiano** —hay margen en el escudo—, no bajar esta.

**Los nombres de la ficha no son los del juego.** La hoja dice «Lancero
lamtuní», «Jinete lamtuní» y «Arquero lamtuní»; `data.ts` dice `Lancero
sanhaya`, `Jinete del desierto` y `Arquero almoravide`, y al aldeano lo llama
`Labrador`. Mandan los de `data.ts`: los nombres de unidad son cosa del punto 5
de [`TRATAMIENTO-HISTORICO.md`](TRATAMIENTO-HISTORICO.md), no de la ficha de
arte. Lo que la ficha fija es la pieza.

**Hueco de fuentes declarado:** no hay iconografía contemporánea almorávide de
figura humana —el arte del periodo es epigráfico, geométrico y arquitectónico—,
así que la forma de la ropa y del velo se reconstruye por descripción escrita
(al-Bakri, Ibn Abi Zar, Kennedy) y por comparación con el Magreb posterior, no
por imagen. Donde el bloque cristiano tiene el Beato de Silos, este tiene
texto. Está dicho para que la diferencia de certeza no se convierta, por
descuido, en diferencia de cuidado.

## Paleta: reglas transversales

- Contorno `#241b12`, un píxel, **sin antialias**: el borde semitransparente
  ensucia la silueta cuando el atlas se muestrea con filtro nearest, y es el
  fallo más común a 60 px.
- Neutros cálidos y poco saturados en todo lo que no se tiñe, para no competir
  con ninguno de los ocho colores de jugador.
- El oro `#c8a24a` coincide con uno de los colores de jugador: solo en formas
  pequeñas y nunca junto a una zona teñible.
- Sombreado y realce de la malla: solo a partir de ×2. A tamaño real es ruido.

## Criterios de aceptación de un sprite horneado

1. **Silueta a 60 px:** en negro sobre fondo claro, las cinco direcciones
   producidas se distinguen entre sí. Si dos se confunden, se corrige el
   diseño, no el render.
2. **Máscara:** con los ocho colores de jugador aplicados, el bando se reconoce
   a 60 px sobre hierba, tierra y piedra. El índigo es el caso límite.
3. **Unidad:** no se confunde con otra del mismo bando a 60 px en la dirección
   en la que más se parecen (para lancero y peón, SO; para la caballería, el
   par S contra N).
4. **Contorno:** un píxel opaco en todo el perímetro, sin píxeles
   semitransparentes.
5. **Caja:** ningún fotograma se sale de la caja de su unidad —64×84 o
   96×104—, salvo el paso alto y la carga del ataque, que pueden subir un
   píxel.

## La cuenta de producción, antes de modelar nada

```
4 animaciones × 5 direcciones × 15 fotogramas × 2 pases = 600 imágenes
```

El aldeano suma cuatro variantes de carga. Con los cuatro ciclos completos
serían 2.400 imágenes solo de aldeano; horneando los ciclos completos sin carga
y **solo andar y quieto** con carga —el aldeano no ataca cargado— quedan
600 + 4 × 300 = **1.800**.

Con seis unidades por bloque y los dos bloques entregados son **9.600
imágenes**; con las fichas andalusíes, 14.400. Y la caballería, que son cuatro
de las doce unidades, pesa 2,4 veces más por imagen por la caja de 96×104. Es
una decisión de producción que hay que tomar **antes** de modelar, no después,
y está sin tomar: ver [`DEUDA.md`](DEUDA.md), DEUDA-014.

## Anacronismos heredados del juego de la raíz

`js/cid-art-units.js` (el RTS de la raíz, que no toca este motor) asigna
`shield: 'pavise'` al arbalestero; el pavés es de los siglos XIV y XV. Mismo
problema con `helmet: 'full'` —yelmo de cara entera, siglo XIII— en `campeon` y
`paladin`.

Aquí no hay nada que arreglar: `UnitDef` no tiene campos de escudo ni de yelmo,
así que el motor no ha heredado nada. **La nota existe para que no se hereden
si algún día se portan esos datos.**

## Fuentes

Las de las fichas, sin duplicar lo que ya está en [`FUENTES.md`](FUENTES.md).

Primarias y visuales: *Historia Roderici* (c. 1110-1125); **Beato de Silos**,
BL Add. MS 11695 (c. 1091-1109), que es la iconografía peninsular más cercana
en fecha y lugar; Tapiz de Bayeux (c. 1077), solo para tipología de equipo, no
peninsular; Ana Comnena, *Alexiada*, para la ballesta; Concilio de Letrán II
(1139), canon 29; calendarios agrícolas románicos peninsulares para el trabajo
del campo. Para el bloque almorávide, al-Bakri, Ibn Abi Zar y Kennedy, por
falta de imagen.

Huecos declarados, para que no se rellenen por inercia: no hay inventario de
armamento peninsular de 1094 con detalle de tintes —los colores de ropa son
plausibles por material y proceso, no documentados pieza a pieza—; no hay
fuente peninsular que ponga una ballesta en manos de un peón en 1094; no hay
iconografía de campesinado andalusí de la huerta valenciana del XI, lo que ya
afecta a la versión almorávide del aldeano y afectará a la andalusí; y Tizona y
Colada no se usan como referencia porque tienen atribución discutida y hoja
posterior.
