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

**Fidelidad: especificación de arte, no maqueta.** Los números —alto en
píxeles, área de máscara, ángulos de pose, hex de paleta— son vinculantes. El
acabado no: el nivel de detalle final lo da el modelado, y las figuras del
documento son geometría procedural que marca proporción, silueta y reparto de
color. No hay que replicar el trazo, hay que respetar la lectura.

## Entregado hasta ahora

| Unidad | Bloque | Alto | Zona teñible |
|---|---|---|---|
| Lancero | Hueste del Cid | 60 px | Escudo de cometa + pendón · 152 px² |
| Peón de espada | Hueste del Cid | 60 px | Escudo de cometa · 121 px² |
| Ballestero | Hueste del Cid | 57 px | Perpunte completo · 168 px² |
| Aldeano (4 cargas) | Hueste del Cid | 56 px | Sayo completo · 190 px² |

Faltan el caballero, Rodrigo Díaz y las seis en versión almorávide.

## Restricciones del motor que la ficha asume

- Proyección isométrica 2:1, casilla 64×32 px, cámara ortográfica a 30° de
  elevación.
- Caja de sprite **64×84 px**. La figura mide 56-60 px de la planta al alto de
  la cabeza; el resto lo ocupan las armas por encima y la sombra por debajo.
- Cinco direcciones renderizadas, tres obtenidas volteando en horizontal.
  **Ojo: son S, SO, O, NO y N**, no las que dibuja el documento visual — ver
  el aviso de abajo.
- Cuatro animaciones —quieto, andar, atacar, morir— de quince fotogramas.
- Dos pases por fotograma: base y máscara de color de jugador.
- Ocho colores de jugador, del dorado al índigo.

## Aviso: el documento visual dibuja la rueda de direcciones vieja

Las fichas de `arte/fichas-de-unidad.html` muestran las siluetas en **E, SE, S,
SO y O**, que era el juego de cinco que horneaba el script cuando se
escribieron. Ese juego estaba mal y ya se ha corregido: **ahora se hornean S,
SO, O, NO y N**, y se voltean SE, E y NE.

El motivo del cambio está en el comentario de `DIRECCIONES` en
`engine/tools/blender/hornear_sprites.py`, y en corto es este: voltear en
horizontal cambia una dirección por su reflejo respecto al eje vertical de la
pantalla, y ese reflejo empareja E con O y SE con SO, dejando N y S como sus
propios espejos. Con el juego viejo, dos de los cinco renders eran la misma
imagen que otros dos, y **no se producía ninguna vista de espaldas**: una
unidad que caminara hacia el norte miraba a cámara. `test/atlas.test.ts` lo
comprueba ahora en los dos lados, el script y el motor.

Consecuencia práctica para quien modele: **hacen falta las siluetas de NO y N**,
que el documento no trae —la ficha del lancero sí incluye las dos que faltaban—
y no hacen falta las de E y SE, que salen volteando O y SO.

## Materiales de Blender

El script saca en blanco todo material cuyo nombre empiece por `jugador`
(`orig.name.lower().startswith("jugador")`). Nombres a usar:

| Unidad | Materiales teñibles |
|---|---|
| Lancero | `jugador_escudo`, `jugador_pendon` |
| Peón de espada | `jugador_escudo` |
| Ballestero | `jugador_perpunte` |
| Aldeano | `jugador_sayo` |

**Regla que no se puede saltar: la zona teñible se pinta plana**, sin degradado
ni sombra horneada. El tinte del motor multiplica, así que cualquier
oscurecimiento pintado se dobla; con índigo o granate la zona se vuelve negra.
La sombra de esas piezas la pone la iluminación **fuera** de la máscara: borde,
refuerzo, bloca.

## Especificación por unidad

Ángulos en grados, 0 = vertical hacia arriba, positivo = hacia delante en
pantalla. Las poses son extremos de interpolación, no fotogramas.

### Lancero — 60 px

- Cota de malla de faldón a la rodilla con abertura delantera, sobre perpunte
  de lana. Almófar de malla, capacete cónico con nasal y reborde.
- Escudo de cometa embrazado y **centrado sobre el torso**: el volteo cambia la
  mano, pero no la masa, porque el escudo cae sobre la línea media.
- Lanza **calada** entre 10° y 32° según dirección, nunca vertical: vertical
  añade 25 px sobre la cabeza y rompe la caja. Sobresale 8 px sobre el capacete
  en SE.
- Moharra de hoja de laurel, pendón con farpas, vaina y guarnición de espada en
  la cadera contraria.
- Ataque: **estocada** recta; la moharra sale de la casilla en el impacto.

### Peón de espada — 60 px

- Equipo defensivo idéntico al lancero. La distinción es el arma y la masa
  vertical: en guardia media la espada **no sobresale** de la cabeza.
- Escudo de cometa un 18% más grande que el del lancero, para recuperar parte
  de la máscara que se pierde al no llevar pendón.
- Espada de hoja ancha de un metro escaso, guarnición recta, pomo de nuez,
  tahalí al hombro.
- Ataque: **tajo diagonal**; la hoja cruza la línea del hombro y sale de la
  casilla.
- Andar y morir son los mismos ciclos que el lancero: reutilizables en el rig.
- Punto débil conocido: en E y O el escudo se ve de canto y la unidad se queda
  casi sin zona teñible, sin pendón que lo salve.

### Ballestero — 57 px

- **Sin malla y sin escudo**: perpunte acolchado de bastas verticales como
  armadura única, capacete de reborde ancho **sin nasal**, caperuza de lana,
  calzas a la vista.
- Bajo del perpunte a media pierna, más corto que la cota, para que el paso se
  lea a pesar del arma.
- Ballesta temprana: caja corta, arco de asta, cuerda de cáñamo, nuez de hueso.
  **Sin estribo, sin cranequín, sin torno.** Se tensa a dos manos o con gancho
  de cinturón. Carcaj a la cadera contraria, **tres** virotes asomando.
- Silueta: barra horizontal de 17 px a media altura. Es la unidad más
  reconocible del roster y la que peor distingue la dirección, porque esa barra
  tapa el giro del tronco.
- Reparto de los quince fotogramas de atacar: **6 tensar, 4 apuntar, 5 disparo
  y bajada**. La simulación no exige hoy un fotograma de disparo fijo: el daño
  se aplica al llegar el `reload` a cero (`src/sim/systems/combat.ts`), sin
  proyectil en vuelo. Si eso cambia, hay que fijar el fotograma.
- **Duda abierta de datación.** La ballesta en 1094 es defendible —Ana Comnena
  la describe en 1096, Letrán II la prohíbe en 1139, lo que implica uso
  previo— pero no está documentada en la península en esa fecha. Lo documentado
  para esta hueste es el arco y la honda. La ficha dibuja la ballesta temprana y
  descarta la plena; la alternativa segura es sustituir la unidad por un
  arquero. Ver [`TRATAMIENTO-HISTORICO.md`](TRATAMIENTO-HISTORICO.md).

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
- Máscara en el sayo completo. **Aviso:** el haz de leña y el serón tapan medio
  sayo por la espalda, así que la máscara no es constante en E, O ni en las
  volteadas. Si hace falta color constante, teñir además la caperuza.

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
   en la que más se parecen (para lancero y peón, SE).
4. **Contorno:** un píxel opaco en todo el perímetro, sin píxeles
   semitransparentes.
5. **Caja:** ningún fotograma se sale de 64×84, salvo el paso alto y la carga
   del ataque, que pueden subir un píxel.

## La cuenta de producción, antes de modelar nada

```
4 animaciones × 5 direcciones × 15 fotogramas × 2 pases = 600 imágenes
```

El aldeano suma cuatro variantes de carga. Con los cuatro ciclos completos
serían 2.400 imágenes solo de aldeano; horneando los ciclos completos sin carga
y **solo andar y quieto** con carga —el aldeano no ataca cargado— quedan
600 + 4 × 300 = **1.800**.

Con seis unidades y dos facciones el total pasa de **8.000 imágenes**. Es una
decisión de producción que hay que tomar **antes** de modelar, no después, y
está sin tomar: ver [`DEUDA.md`](DEUDA.md), DEUDA-014.

## Anacronismos heredados del juego de la raíz

`js/cid-art-units.js` (el RTS de la raíz, que no toca este motor) asigna
`shield: 'pavise'` al arbalestero; el pavés es de los siglos XIV y XV. Mismo
problema con `helmet: 'full'` —yelmo de cara entera, siglo XIII— en `campeon` y
`paladin`.

Aquí no hay nada que arreglar: `UnitDef` no tiene campos de escudo ni de yelmo,
así que el motor no ha heredado nada. **La nota existe para que no se hereden
si algún día se portan esos datos.**
