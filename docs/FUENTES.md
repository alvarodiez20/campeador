# Fuentes

## Primarias

- ***Historia Roderici*** (anónima, c. 1110-1125). Contemporánea, en latín, la
  fuente primaria sobre Rodrigo Díaz. Escueta y sin florituras: es la que da la
  cronología del destierro, los años al servicio de Zaragoza y la toma de
  Valencia. Es también la que deja claro que combatió contra cristianos por
  cuenta de un emir musulmán.

- **Ibn Alqama**, *al-Bayan al-wadih*. Perdida, conservada en citas de
  cronistas posteriores. Punto de vista valenciano y andalusí sobre el asedio y
  el gobierno de la ciudad. Imprescindible como contrapeso: sin ella, todo el
  relato es el de un solo bando.

- ***Cantar de mio Cid*** (c. 1200). No es fuente histórica sino literaria,
  pero da la estructura narrativa hecha: destierro → bodas → afrenta de
  Corpes. Se usa para la forma de la campaña, no para los hechos.

## Secundarias

- **Ramón Menéndez Pidal**, *La España del Cid* (1929). Exhaustivo hasta el
  detalle y todavía insustituible por el volumen de material que reúne.
  Romántico y nacionalista en la interpretación: hay que leerlo por los datos
  y desconfiar del marco.

- **Richard Fletcher**, *El Cid* (*The Quest for the Cid*, 1989). Mucho más
  frío y probablemente más cercano a la realidad. Es el contrapeso deliberado
  a Menéndez Pidal: desmonta la construcción del mito y sitúa a Rodrigo como
  lo que era, un señor de la guerra de frontera. Cuando los dos discrepan,
  este pesa más.

- **Gonzalo Martínez Díez**, *El Cid histórico* (1999). Revisión documental
  posterior, útil para fechas y para el sistema de parias.

- **Hugh Kennedy**, *Muslim Spain and Portugal* (1996). Para el lado andalusí:
  cómo funcionaban las taifas, por qué el sistema de parias las desangró y qué
  cálculo hicieron al llamar a los almorávides.

## Sobre el periodo y las parias

El sistema de parias es el eje económico del juego, así que conviene tenerlo
claro: eran tributos que los reinos cristianos cobraban a las taifas a cambio
de protección o de no atacarlas. Entre 1050 y 1080 fueron la principal fuente
de oro de Castilla y León, muy por encima de cualquier botín. La caída de
Toledo en 1085 rompió el equilibrio; al-Mutamid de Sevilla llamó a los
almorávides en 1086, y con ellos el sistema entero desapareció.

De ahí sale el bucle de tensión que implementa `src/sim/parias.ts`. La frase
atribuida a al-Mutamid —preferir ser camellero en África antes que porquero en
Castilla— resume la decisión mejor que cualquier explicación.

## Misiones candidatas para la campaña

Con fecha y con lo que aporta cada una:

| Misión | Año | Por qué está |
|---|---|---|
| Graus | 1063 | Rodrigo con Castilla y Zaragoza **contra** Aragón. Rompe el marco de "cristianos contra musulmanes" en la primera misión. |
| Golpejera | 1072 | Guerra entre hermanos. Sancho II contra Alfonso VI: la política castellana antes del destierro. |
| Almenar | 1082 | Al servicio del emir de Zaragoza, derrota a Aragón y Barcelona. |
| Cabra | 1079 | El choque con García Ordóñez que precipita el segundo destierro. |
| Sagrajas | 1086 | La derrota de Alfonso VI ante los almorávides. Rodrigo no estuvo: se juega desde fuera, y eso es parte del argumento. |
| Toma de Valencia | 1094 | Un asedio largo contra una ciudad, no una batalla. |
| **Cuarte** | **1094** | **El vertical slice.** Cerco almorávide roto con una salida. |
| Bairén | 1097 | Aliado con Pedro I de Aragón contra los almorávides. Las alianzas vuelven a cruzarse. |
