<h1 align="center">⚔️ El Cid — Crónicas de la Reconquista</h1>

<p align="center">
  <b>Estrategia en tiempo real isométrica en la Hispania del siglo XI.</b><br>
  Funda tu villa, recolecta, avanza por cuatro épocas y levanta una hueste.<br>
  Sin instalación, sin cuentas, sin dependencias: se juega en el navegador.
</p>

<p align="center">
  <a href="https://alvarodiez20.github.io/campeador/"><b>▶️ JUGAR AHORA</b></a>
</p>

<p align="center">
  <a href="https://alvarodiez20.github.io/campeador/">
    <img src="assets/captura-partida.png" alt="Una villa castellana en plena Época de los Reinos" width="100%">
  </a>
</p>

---

## 🏰 Qué es esto

Un RTS completo al estilo *Age of Empires*, escrito en **HTML + CSS + JavaScript puro**.
Cero dependencias, cero build, cero assets: **todo el arte —terreno pintado, 19 edificios en seis estilos arquitectónicos, 32 unidades e iconos grabados— se genera por código** al cargar la página, y la música y los efectos se sintetizan con WebAudio.

| | |
|---|---|
| 🛡️ **6 reinos jugables** | Castilla, León, Aragón y Navarra, Taifa de Zaragoza, Taifa de Sevilla y Almorávides, cada uno con bonificaciones, unidad única y **arquitectura propia**: sillería y teja roja en Castilla, granito y pizarra en León, arenisca y tablilla en Aragón, ladrillo y teja vidriada verde en Zaragoza, cal y azulejo en Sevilla, adobe y merlones escalonados entre los almorávides |
| 📜 **Campaña histórica** | Seis misiones sobre la vida de Rodrigo Díaz: Graus (1063), Zamora (1072), el Destierro (1081), Almenar (1082), Valencia (1094) y Cuarte (1094) |
| ⚔️ **Escaramuza** | Contra 1–3 rivales o en 2 contra 2, cuatro dificultades, cinco mapas, tres tipos de inicio |
| 🌾 **Economía** | Cuatro recursos, cuatro épocas, 17 edificios, 20 unidades con líneas de mejora y 30 tecnologías |
| 🧠 **IA con carácter** | Rivales económicos, agresivos, defensivos o equilibrados |
| 🎬 **Todo se mueve** | Los aldeanos alzan y descargan la herramienta al recolectar, construir y reparar; la infantería tira el tajo, la caballería lleva la lanza calada, los caballos trotan. Saltan astillas, esquirlas y chispas, y la cámara acusa el derrumbe de un edificio |
| ✝️ **Detalles de casa** | Guarnición, campana del pueblo, clérigos que curan, convierten y portan reliquias, mercado, catedral, posturas, patrulla, vigilancia y puertas |

## 🎮 Cómo se juega

| Tecla | Acción |
|---|---|
| **Clic izq.** | Seleccionar · arrastrar para selección múltiple · doble clic selecciona todos los del mismo tipo |
| **Clic der.** | Mover, recolectar, construir, atacar, reparar, guarnecer, curar o convertir, según el objetivo |
| **Shift** | Añadir a la selección · encolar órdenes · entrenar de 5 en 5 · colocar varios edificios |
| **A · S · Supr** | Atacar-mover · detener · eliminar unidad |
| **Z · X** | Patrullar · vigilar (seguir y proteger) |
| **G · V** | Guarnecer · desalojar |
| **Q · W · E** | Postura agresiva · defensiva · no moverse |
| **H · . · Ctrl+A** | Centro urbano · aldeano ocioso · seleccionar todo el ejército |
| **Ctrl+1..9 / 1..9** | Crear / seleccionar grupo de control (dos veces: centrar) |
| **Ctrl+B · Espacio** | Campana del pueblo · ir al último aviso |
| **P · F · M · F1 · Esc** | Pausa · velocidad · silencio · ayuda · menú |

La partida guardada, el progreso de campaña y las opciones viven en el `localStorage` de tu navegador.

## 🖼️ Galería

<p align="center">
  <img src="assets/captura-menu.png" alt="Menú principal" width="49%">
  <img src="assets/captura-campana.png" alt="Campaña: la vida del Cid" width="49%">
</p>

## 🧭 Estructura del proyecto

```
index.html        página y marcado de la interfaz
css/style.css     interfaz (paneles de madera y piedra, menús)
js/cid-art.js     núcleo del arte pintado: terreno, naturaleza, iconos, estilos por reino
js/cid-art-buildings.js  los 19 edificios en los seis estilos arquitectónicos
js/cid-art-units.js      las 32 unidades, de frente y de perfil
js/data.js        reinos, unidades, edificios, tecnologías, épocas
js/map.js         generación de mapas (5 tipos), A* y niebla de guerra
js/entities.js    jugadores, órdenes, combate, guarnición, mercado, catedral, clérigos
js/ai.js          IA con personalidades
js/sprites.js     puente con el arte: poses de animación, caché, obras, marco de los paneles
fonts/            Cinzel y Crimson Pro autoalojadas (subconjunto latino, woff2)
js/render.js      render isométrico 2:1 por trozos, orden de profundidad, minimapa
js/ui.js          selección, órdenes, panel de mandos, atajos, HUD
js/audio.js       efectos y música sintetizados con WebAudio
js/campaign.js    las seis misiones, con objetivos, guion e historia
js/main.js        bucle principal, menús, guardado/carga, estadísticas
```

## ⚙️ Detalles técnicos

- **Se dibuja a la resolución real del monitor** (`devicePixelRatio`), con **resolución adaptativa**: si la máquina no sostiene 50 fps baja la escala sola, y la recupera cuando hay margen.
- **Sin fotogramas pregenerados**: al generador de figuras se le pasa una pose —piernas, vaivén del tronco, giro y avance del brazo armado— y pinta ese instante. Se cachean diez poses por unidad y lado, y se **precalientan con presupuesto por fotograma** para que el primer golpe no dé un tirón.
- El oeste es el este **espejado al dibujar**, no otro lienzo guardado: quitarlo bajó el render de 7,7 ms a 0,9 ms.
- Los paneles llevan un **marco de piedra nine-slice** generado por código: las esquinas no se estiran.
- Tipografías **autoalojadas**: ni terceros ni viaje extra bloqueando el render.

## 💻 Ejecutarlo en local

```bash
git clone https://github.com/alvarodiez20/campeador.git
cd campeador
python3 -m http.server 8000
# abre http://localhost:8000
```

Basta con un servidor estático cualquiera; no hay nada que compilar.

## 🚀 Despliegue

Cada `push` publica el sitio automáticamente mediante GitHub Actions
([`.github/workflows/pages.yml`](.github/workflows/pages.yml)) en
👉 **<https://alvarodiez20.github.io/campeador/>**

---

<p align="center">
  <i>«El que en buen hora ciñó espada.»</i><br>
  <sub>Cantar de mio Cid</sub>
</p>
