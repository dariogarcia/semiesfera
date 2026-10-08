# Semiesfera

Un mundo que se dibuja al leerlo. **Semiesfera** es un sitio estático de
historias con dos formas de entrar en el mismo contenido:

- **Por historia:** en orden. Solo una historia está abierta a la vez: leerla
  (marcarla como leída) abre la siguiente.
- **Por espacio o tiempo:** el mapa y la línea de tiempo se exploran libremente,
  pero solo muestran lo que el lector ya ha desbloqueado leyendo.

No hay cuentas ni nombres: el progreso se recuerda **por navegador** (local
storage), sin servidor ni sincronización — esto se explica en la portada. El
mapa empieza vacío y se va revelando por piezas a medida que se leen las
historias.

## Cómo funciona

| Ruta | Propósito |
|---|---|
| `/` | Portada: qué es el sitio, cómo funciona, y el botón **Entrar** |
| `/explorar` | La aplicación: mapa de fondo, línea de tiempo abajo, panel de historias a la izquierda, panel de documentos a la derecha y el lector de historias superpuesto |
| `/explorar?place=…&from=…&to=…&doc=…` | La misma vista con una selección fija (enlace compartible) |
| `/historias/<id>` | Página estática de la historia (para enlaces compartidos): intro, PDF, documentos, botón **Marcar como leída** |

`/explorar` muestra en el panel solo las historias ya desbloqueadas (las leídas
y la abierta); el resto aparece al marcar la anterior como leída. El lector de
historias se abre sobre el mapa: cuerpo en markdown, documentos enlazados con
el mapa y la línea de tiempo, y el botón **Marcar como leída** al pie.

El panel de documentos (derecha) lista, en orden cronológico, los documentos
de las historias ya leídas: crece a medida que se lee. Al pasar el cursor por
un lugar del mapa o un punto de la línea de tiempo, las entradas
correspondientes se resaltan y se centran en el panel.

Las páginas de historia son HTML estático puro (indexables, RSS, sin scripts).
Solo el progreso y `/explorar` necesitan JavaScript.

### Reglas de desbloqueo (resumen)

- Una historia está **abierta** si es la primera o si la anterior está leída;
  las demás no aparecen en el panel de historias hasta su turno.
- Una historia se considera leída únicamente al pulsar **Marcar como leída**.
- Al marcar una historia se desbloquean sus documentos, etiquetas de lugar y
  fecha, puntos en el mapa y en la línea de tiempo, y las piezas del mapa que
  revela.
- El filtro es deliberadamente **blando**: todo lo publicado es público; el
  desbloqueo es una guía de ritmo, no una capa de seguridad.

## Estructura

```
content/            el mundo, editado a mano
  places.json       lugares (puntos, círculos o polígonos, en píxeles del mapa)
  map-pieces.json   piezas del mapa (recortes con posición y tamaño)
  eras.yaml         eras con nombre para la línea de tiempo
  complete/         mapa completo como único archivo
  pieces/           imágenes de las piezas (PNG enmascarados por lande)
  stories/<id>/     story.md (frontmatter + cuerpo), cover.svg, story.pdf, docs/
assets/             CSS y JS del cliente (se copian al construir)
tools/              importador de historias, generador del mapa, servidor dev, smoke test
build.mjs           generador del sitio (Node, sin dependencias)
public/             salida del build (ignorada por git)
```

## Desarrollo

```sh
npm run build    # construye public/
npm run serve    # sirve public/ en http://localhost:8178
npm test         # build + smoke test
```

Requiere Node >= 18. Sin dependencias npm.

## Flujo de autoría

Guía detallada paso a paso (incluido cómo preparar mapas desde un JPG grande
y cómo convertir los doc-boxes de Pandoc/LaTeX en documentos web):
[docs/anadir-historias.md](docs/anadir-historias.md). Resumen:
1. Si el mundo cambió en el generador, regenera el mapa con
   `node tools/build-map.mjs` (piezas por lande, regiones `poly`, mapa
   completo) y recoloca los lugares `point`. Para mundos dibujados a mano,
   recorta las piezas y lístalas en `map-pieces.json`.
2. Añade los lugares nuevos a `places.json` y, si hace falta, una era a
   `eras.yaml`.
3. Importa la historia desde tu Markdown de Pandoc con
   `node tools/import-story.mjs content/sources/mi-historia.md --id mi-historia …`
   (genera `story.md`, `story.pdf`, `cover.svg` y los `docs/dN.png`; ajusta a
   mano lo que quieras después), o créala a mano.
4. Pon la fecha `publish` y haz push. Un workflow diario reconstruye y libera
   la historia en su fecha. Las comprobaciones del build frenan los errores
   antes de publicar.

### Comprobaciones del build

El build falla con un mensaje claro si:

- algún id de lugar o pieza usado por una historia no existe;
- los números de `sequence` no son únicos, consecutivos desde 1;
- **algún lugar que usa una historia no está dentro de una pieza que esa misma
  historia revela** (los puntos nunca flotan sobre espacio sin mapa);
- falta algún campo obligatorio o hay años incoherentes (`yearEnd < year`).

### Reglas de publicación

- El build solo incluye las historias cuya fecha `publish` ha pasado, y solo
  las piezas del mapa que esas historias revelan. Lo no publicado nunca llega
  al navegador.
- El repo se mantiene privado y los PDFs, imágenes y piezas no publicados se
  mantienen fuera de `public/`.

## Despliegue

El workflow `.github/workflows/deploy.yml` construye el sitio en cada push y
una vez al día (para liberar historias en su fecha) y lo publica en GitHub
Pages. En repos privados Pages requiere un plan de pago; mientras tanto,
`npm run build && npm run serve` sirve el sitio completo en local.

## Créditos

- Código: MIT (ver `LICENSE`).
- Contenido del mundo (`content/`): material de ejemplo placeholder, reemplazar
  por el material real.
