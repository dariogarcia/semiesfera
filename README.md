# Semiesfera

Un mundo que se dibuja al leerlo. **Semiesfera** es un sitio estático de
historias con dos formas de entrar en el mismo contenido:

- **Por historia:** el catálogo en orden. Solo una historia está abierta a la
  vez: leerla (marcarla como leída) abre la siguiente.
- **Por espacio o tiempo:** el mapa y la línea de tiempo se exploran libremente,
  pero solo muestran lo que el lector ya ha desbloqueado leyendo.

No hay cuentas ni nombres: el progreso se recuerda **por navegador** (local
storage), sin servidor ni sincronización. El mapa empieza vacío y se va
revelando por piezas a medida que se leen las historias.

## Cómo funciona

| Ruta | Propósito |
|---|---|
| `/` | El catálogo: una lista ordenada de historias (leídas, abierta o bloqueadas) |
| `/historias/<id>` | Página de la historia: intro, PDF, documentos, botón **Marcar como leída**, y tras leerla el mapa revelado con sus puntos y una mini línea de tiempo |
| `/explorar` | Mapa y línea de tiempo completos, con panel de resultados, mostrando solo lo desbloqueado |
| `/explorar?place=…&from=…&to=…&doc=…` | La misma vista con una selección fija (enlace compartible) |

Las páginas de historia son HTML estático puro (indexables, RSS, sin scripts).
Solo el progreso, `/explorar` y las mini-vistas necesitan JavaScript.

### Reglas de desbloqueo (resumen)

- Una historia está **abierta** si es la primera o si la anterior está leída;
  **bloqueada** en otro caso. Las entradas bloqueadas muestran solo el título.
- Una historia se considera leída únicamente al pulsar **Marcar como leída**.
  El botón también existe en las entradas bloqueadas, para saltar adelante (con
  confirmación).
- Al marcar una historia se desbloquean sus documentos, etiquetas de lugar y
  fecha, puntos en el mapa y en la línea de tiempo, y las piezas del mapa que
  revela.
- El filtro es deliberadamente **blando**: todo lo publicado es público; el
  desbloqueo es una guía de ritmo, no una capa de seguridad.

## Estructura

```
content/            el mundo, editado a mano
  places.json       lugares (puntos o círculos, en píxeles del mapa completo)
  map-pieces.json   piezas del mapa (recortes con posición y tamaño)
  eras.yaml         eras con nombre para la línea de tiempo
  complete/         (opcional) mapa completo como único archivo
  pieces/           imágenes de las piezas (SVG recortados)
  stories/<id>/     story.md (frontmatter + cuerpo), cover.svg, story.pdf, docs/
assets/             CSS y JS del cliente (se copian al construir)
tools/              generador de recursos de ejemplo, servidor dev, smoke test
build.mjs           generador del sitio (Node, sin dependencias)
public/             salida del build (ignorada por git)
```

## Desarrollo

```sh
npm run assets   # regenera las imágenes y PDFs de ejemplo (opcional)
npm run build    # construye public/
npm run serve    # sirve public/ en http://localhost:8178
npm test         # build + smoke test
```

Requiere Node >= 18. Sin dependencias npm.

## Flujo de autoría

1. Recorta las piezas nuevas del mapa y lístalas en `map-pieces.json`. Coloca
   el mapa completo en `content/complete/` si existe.
2. Añade los lugares nuevos a `places.json` y, si hace falta, una era a
   `eras.yaml`.
3. Crea la carpeta de la historia con sus imágenes y `story.md`, con su
   `sequence` (el siguiente número libre) y sus `reveals`.
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
