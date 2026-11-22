# Cómo añadir una historia (y su mapa)

Guía paso a paso para meter material nuevo en Semiesfera: una historia escrita
en Markdown (Pandoc + LaTeX, como las de *Historias con historia*) y los mapas,
que parten de un JPG grande.

## 0. Cómo funciona el pipeline

Tu material de origen es un Markdown de Pandoc con LaTeX (preámbulo con
`tcolorbox`, `docmeta`, etc.) que compilas a PDF con Xelatex. De ese archivo
salen **dos cosas distintas**:

| Destino        | Qué usa                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| `story.pdf`    | El documento completo: narración, doc-boxes, figuras, timelinefooters, todo. |
| `story.md`     | Solo la narración (cuerpo) + metadatos: qué documentos hay, dónde y cuándo.  |

La web no parsea tu LaTeX. Cada `::: {.doc-box}` del original se convierte en
**una entrada de `documents`** en el frontmatter de `story.md`, con una imagen
propia (el documento renderizado) y sus datos de lugar y fecha. El lector que
quiera el documento «de verdad» descarga el PDF.

```
historia.md (Pandoc/LaTeX)
├── xelatex ──────────────► story.pdf
├── cada doc-box ─────────► docs/d1.svg, d2.svg… (imágenes para la web)
└── narración + metadatos ► story.md (frontmatter + cuerpo)
```

## 1. Forma rápida: `tools/import-story.mjs`

El importer automatiza todo el proceso manual de las secciones siguientes:
parsea tu Markdown de Pandoc, compila cada doc-box con tu propio preámbulo y
escribe `story.md`, `story.pdf`, `cover.svg`, `og.png` (tarjeta 1200×630
para los enlaces compartidos) y los `docs/dN.png`.

```sh
# 1. Copia tu original (verbatim) a content/sources/
cp mi-historia.md content/sources/mi-historia.md

# 2. Prepara el mundo (sección 2 abajo) y lanza:
node tools/import-story.mjs content/sources/mi-historia.md \
  --id mi-historia \
  --volume "Historias con historia — Volumen 12" \
  --sequence 2 \
  --publish 2026-11-01 \
  --reveals p-taaku \
  --place-map 1=deishe,2=taaku,3=taaku \
  --summary "Una o dos frases de resumen, sin spoilers." \
  --hook "El gancho de una línea para la tarjeta de la portada." \
  --story-place taaku

# 3. Revisa el resultado y ajusta a mano lo que quieras:
git diff content/stories/mi-historia/story.md
```

Qué hace solo:

- Extrae frontmatter (título, volumen, `header-includes`), doc-boxes y
  `\docmeta` de cada uno (Tipo → `label`, Año → `year`/`yearEnd`, Fuente → `alt`).
- Convierte la narrativa a Markdown reducido: `\dline{>}{…}` (y
  `\dline{Nombre}{…}`) → cita de diálogo (`> — …`, una línea por réplica;
  la raya marca cada hablante, como el `>:` en negrita del PDF);
  el bloque final `{\centering \textbf{FIN}}` y su pie de copyright →
  `**FIN**` (la web pinta el © en su propio pie de página, así que el
  bloque de cierre de la fuente nunca llega al cuerpo).
- Renderiza cada doc-box en una página larga (21×100 cm) con xelatex,
  la recorta y apila en `docs/dN.png` (los `.tex`/`.log` quedan en
  `renders/`, que está en `.gitignore`).
- Compila `story.pdf` completo (A4, con portada de título).
- Genera `cover.svg` de marcador (sustitúyelo por tu portada si quieres).

Banderas útiles:

| Banderas                | Para qué                                                     |
| ----------------------- | ------------------------------------------------------------ |
| `--force`               | Regenerar encima de una importación anterior                  |
| `--label 9=Transcripción`| Corregir el label/auto-alt del documento 9                    |
| `--place-map 5=kalts-een`| Decidir en qué lugar vive cada documento (n=place-id; `none` = sin lugar) |
| `--publish 2026-11-01`  | Fecha de publicación                                          |
| `--hook "…"`            | Gancho de una línea para la tarjeta de la portada             |
| `--story-place taaku`   | Lugar donde sucede la historia (tarjeta de la portada)        |
| `--no-render`           | Solo `story.md` + marcadores SVG (rápido, para iterar texto)  |
| `--pdf mi.pdf`          | Usar un PDF ya compilado en vez de compilar                   |
| `--img-place lande-14`  | Lugar provisional de las imágenes de la narrativa             |
| `--img-year 480`        | Año provisional de las imágenes (por defecto, el del doc 1)   |

Notas: `--sequence` debe ser el siguiente entero libre (único, sin huecos).
Fuentes Type1 `.pfb` (p. ej. URW Gothic) se sustituyen por su clon OpenType
al renderizar: `xdvipdfmx` falla de forma intermitente incrustándolas.
Si algo sale raro, el camino manual de las secciones 3–4 siempre está disponible.

## 1bis. Recetario rápido

Las tres tareas habituales, sin leer el resto de la guía:

**Importar una historia nueva** (fuente Pandoc/LaTeX → carpeta completa):

```sh
cp mi-historia.md content/sources/mi-historia.md
node tools/import-story.mjs content/sources/mi-historia.md \
  --id mi-historia --volume "…Volumen 12" --sequence 2 \
  --publish 2026-11-01 --reveals p-ejemplo \
  --place-map 1=deishe,2=taaku,3=taaku \
  --img-place taaku --img-year 480 \
  --summary "Una o dos frases de resumen, sin spoilers." \
  --hook "El gancho de una línea de la tarjeta." --story-place taaku
# revisa y ajusta metadatos: labels, alt, places/año de las imágenes
git diff content/stories/mi-historia/story.md
npm test
```

**Corregir un documento ya importado** (edita el doc-box en
`content/sources/<id>.md` y re-renderiza solo ese):

```sh
node tools/render-doc.mjs <story-id> --doc 5            # o --all
npm test
```

**Ajustar metadatos de un documento o imagen** (lugar, año, etiqueta…):
edita `content/stories/<id>/story.md` — campos en §3.4bis y §3.6 — y
`npm test`. No hace falta re-renderizar nada.

## 2. Antes de empezar: el mundo

Una historia nueva puede necesitar cambios en los archivos del mundo. Revísalos
primero porque `story.md` los referencia:

### `content/places.json` — lugares

```json
{ "id": "taaku", "name": "Taaku", "geometry": { "type": "circle", "x": 390, "y": 340, "radius": 120 } },
{ "id": "deishe", "name": "Deishe", "parent": "taaku", "geometry": { "type": "point", "x": 400, "y": 300 } }
```

- `id`: slug en minúsculas (`a-z0-9-`), único.
- `geometry.type`: `point` (un punto: ciudades, enclaves), `circle` (región
  circular) o `poly` (región irregular: landes). Las coordenadas `x`/`y` (o los
  contornos de `poly`) son **píxeles del lienzo del mapa completo**.
- `parent`: opcional. Un punto dentro de una región debe declararla como
  padre: al pasar el cursor por la región se iluminan los documentos de todos
  sus hijos.

Las regiones `poly` las genera `tools/build-map.mjs` (ver abajo); a mano solo
se colocan los `point`, con su `parent` apuntando al lande correspondiente.

### `content/map-pieces.json` — piezas del mapa

Cada pieza es un recorte del mapa que una historia «revela» al marcarse como
leída (ver sección 4 para crearlas desde un JPG):

```json
{ "id": "p-taaku", "file": "pieces/p-taaku.svg", "x": 250, "y": 200,
  "width": 320, "height": 280, "regions": ["taaku"] }
```

- `x`/`y`/`width`/`height`: posición y tamaño del recorte **en el lienzo
  completo**.
- `regions`: solo lo usa el generador de recursos de ejemplo; el build lo
  ignora.
- `size` (arriba del todo) es el tamaño del lienzo; `complete` apunta al mapa
  completo que se muestra cuando el lector ha revelado todas las piezas.

### Regenerar el mundo desde el generador: `tools/build-map.mjs`

El mapa actual viene de las exportaciones del generador de mundos (celdas
GeoJSON + render PNG) que viven en `input/map_files/` (fuera del repo). El
script las convierte en los recursos del sitio:

```sh
node tools/build-map.mjs
```

Qué hace:

- Calibra geocoordenadas → píxeles del render (lagos como anclas; se reescala
  solo si la resolución del PNG cambia).
- Recorta el lienzo al hemisferio descrito (las zonas con cultura).
- Una pieza PNG enmascarada por **lande** (= zona de cultura del generador):
  `content/pieces/p-lande-<c>.png`.
- `places.json` con las landes como regiones `poly` y `complete/map.png`.
- **Conserva** los lugares `point` existentes (ciudades de las historias);
  recolócalos a mano dentro de su lande y ponles su `parent`.

Después de regenerar, revisa que cada `story.md` revele piezas existentes
(`reveals`) y que sus lugares caigan dentro (el build lo valida). Si el
generador renumerara las culturas, los ids `lande-<c>` cambian y hay que
actualizar `reveals`, `places` y `parent`.

Guía completa del proceso (renombrar landes, calibración, verificación en
navegador): [actualizar-mapa.md](actualizar-mapa.md).

### `content/eras.yaml` — eras de la línea de tiempo

```yaml
eras:
  - name: Antes del túnel
    from: -200
    to: -10
```

Los años de los documentos (tu `Año: 480 GC` → `480`) caen en eras; si tu
historia abre un periodo nuevo, añádelo aquí. Es cosmético: si un documento no
cae en ninguna era, simplemente no muestra etiqueta de era.

## 3. Añadir la historia, paso a paso

### 3.1 Crea la carpeta

```
content/stories/vol11-la-leyenda-del-primer-interlande/
```

El nombre de la carpeta es el **id** de la historia: slug en minúsculas
(`^[a-z0-9][a-z0-9-]*$`). Por convención lleva el volumen.

> Ojo: **todo lo que haya en la carpeta se publica** tal cual (menos
> `story.md`). No dejes ahí borradores con spoilers.

### 3.2 Compila el PDF

```sh
pandoc historia.md -o content/stories/vol11-…/story.pdf
```

(con tu configuración habitual: `--pdf-engine=xelatex` está ya en el
`pandoc_args` del YAML). El PDF es lo que la web ofrece en «Descargar PDF».

### 3.3 Portada

Crea `cover.svg` (o `cover.png`/`cover.jpg`): retrato, ~300×420. Es una imagen
normal (`<img>`), cualquier formato vale.

### 3.4 De cada doc-box a un documento de la web

Recorre tu original y localiza los bloques `::: {.doc-box}`. **Cada bloque es
un documento** en `story.md`. Los datos salen de tu propio `\docmeta`:

| Tu LaTeX                                           | Frontmatter de story.md                          |
| -------------------------------------------------- | ------------------------------------------------ |
| `\textbf{Tipo:} Audioguía para visitantes`         | `label: Audioguía` (nombre corto, en los paneles)|
| `\textbf{Año:} 480 GC`                             | `year: 480`                                       |
| `\textbf{Año:} -7 a -1 GC`                         | `year: -7` + `yearEnd: -1` (rango en el tiempo)   |
| `\textbf{Fuente:} Museo Xunei Thun de Arte, Taaku` | base para `alt` (texto alternativo)               |
| (decisión editorial)                               | `places:` en qué lugares del mapa vive el doc     |

- `label`: corto y **distinto entre los documentos de la misma historia**
  (aparece en el panel de documentos y en la línea de tiempo).
- `places`: lista de ids de `places.json`. Un documento puede vivir en
  varios lugares; si no está asociado a ningún lugar, lista vacía (`[]`) —
  no se dibuja en el mapa. En el importer: `--place-map N=none`.
- `alt`: una frase que describa el documento (accesibilidad).

**Posición en el texto**: cada documento se muestra donde estaba su doc-box
en el original. El importador deja un marcador `{{dN}}` en el cuerpo de
`story.md` (d1, d2… en orden de aparición) y el build lo sustituye por la
figura del documento. Al escribir `story.md` a mano, coloca los marcadores
donde toque; un documento sin marcador cae en la lista «Documentos» al
final de la página.

### 3.4bis Imágenes de la narrativa

Las figuras (`\begin{figure}`, `wrapfigure`, `\includegraphics` suelto) del
texto también viajan a la web: el importador deja un marcador `{{iN}}` en su
sitio, copia el archivo a `content/stories/<id>/imgs/` y escribe un bloque
`images:` en `story.md`:

```yaml
images:
  - file: imgs/moneda.jpeg     # dentro del directorio de la historia
    alt: Oblato de Taaku del siglo 3.   # sale de \caption si lo hay
    width: 55                  # % del ancho de columna (del \includegraphics)
    places:                    # metadatos: edita aquí lugar y año
      - lande-14
    year: 480
```

Campos por imagen:

| Campo    | Obligatorio | Notas                                                            |
| -------- | ----------- | ---------------------------------------------------------------- |
| `file`   | sí          | Archivo dentro de la carpeta de la historia (se publica tal cual) |
| `alt`    | sí          | Texto alternativo (accesibilidad); del `\caption` si lo había    |
| `label`  | opcional    | Nombre corto para el panel de documentos (por defecto `Imagen N`) |
| `caption`| opcional    | Pie bajo la imagen en la página de la historia                   |
| `width`  | opcional    | % del ancho de columna; sin él, ancho natural                    |
| `places` | sí          | ids de `places.json` (mismas reglas que los documentos)          |
| `year`   | sí          | Entero; `yearEnd` opcional para rangos                           |

Las imágenes son documentos visuales de pleno derecho: aparecen en el texto
en su posición, en el panel de documentos, en la línea de tiempo y en el
lector, y se filtran por lugar y año como cualquier documento. El importador
les pone un `places`/`year` provisional (`--img-place`, `--img-year`); la
decisión fina se hace editando `story.md` a mano y recompilando con
`node build.mjs`.

Los archivos fuente se buscan en `input/imgs/` (y `input/map_files/` para
mapas): el importador resuelve las rutas `../../_Sources/...` del original.
Guarda allí solo las imágenes usadas en la historia.

### 3.5 Renderiza (o re-renderiza) la imagen de cada documento

Cada documento necesita una imagen (`docs/d1.png`…). Con el fuente en
`content/sources/<id>.md`, todo está automatizado:

```sh
# lista los doc-boxes del fuente con su Fuente/Año y qué PNG hay generado
node tools/render-doc.mjs <story-id> --list

# re-renderiza un documento suelto (sin tocar story.md ni el PDF)
node tools/render-doc.mjs <story-id> --doc 5

# re-renderiza todos
node tools/render-doc.mjs <story-id> --all
```

Qué hace: extrae el doc-box N del fuente, lo compila con
`\documentclass{standalone}` usando tu propio preámbulo (`header-includes`),
borde de 8pt y ancho de texto 494.5pt (~848px a 120dpi), y escribe
`content/stories/<id>/docs/dN.png`. Si el PDF ocupa varias páginas, se unen
verticalmente. Si `story.md` apuntaba al marcador `dN.svg`, se actualiza a
`dN.png`. Los intermedios (`.tex`, `.log`) quedan en `renders/<id>/`
(gitignored).

`--adjustwidth` controla los `\begin{adjustwidth}{..}{..}` del fuente, que en
un render suelto pueden dejar márgenes desiguales:

| Valor    | Efecto                                             |
| -------- | -------------------------------------------------- |
| `keep`   | Tal cual (por defecto)                              |
| `small`  | Reducidos a 0.5cm/0.5cm                             |
| `strip`  | Eliminados (p. ej. cartas y diarios van mejor así)  |

Notas:

- Necesitas las fuentes del preámbulo instaladas (GFS Didot, PT Mono, etc.).
- El render no es bit a bit reproducible entre ejecuciones (antialiasing de
  xdvipdfmx); mismo tamaño, píxeles ligeramente distintos. Normal.
- Ajustes de_layout_ puntuales (p. ej. listas más compactas en el Manual de
  Kalts'een) se editan en el doc-box del fuente y se re-renderizan.
- La historia completa (los 12 a la vez) también se puede re-renderizar con
  `node tools/import-story.mjs content/sources/<id>.md --id <id> --force …`,
  pero rehace `story.md` entero: para retoques usa `render-doc.mjs`.

### 3.6 Escribe `story.md`

Frontmatter + cuerpo. Ejemplo con el material de «El primer interlande»:

```yaml
---
title: La leyenda del primer interlande
volume: Historias con historia — Volumen 11
publish: 2026-11-01
cover: cover.svg
pdf: story.pdf
summary: "La historia más famosa de la semiesfera: Xunei Thun, el primer interlande, desde el museo que lo convirtió en mito."
hook: "Poder, riquezas, minas y aventuras: la historia más famosa de la semiesfera."
place: taaku
sequence: 7   # el siguiente entero libre: único y sin huecos entre TODAS las historias
reveals:
  - p-taaku
  - p-kalts
documents:
  - image: docs/d1.svg
    alt: Audioguía del Museo Xunei Thun de Arte, sala 5, Taaku
    label: Audioguía
    places: [taaku]
    year: 480
  - image: docs/d2.svg
    alt: Examen de ciudadanía de Taaku, preguntas 6 y 7
    label: Examen
    places: [taaku]
    year: 460
  - image: docs/d3.svg
    alt: Manifiesto Noviembre Rosa, panfleto de distribución pública
    label: Manifiesto
    places: [taaku]
    year: 390
  - image: docs/d4.svg
    alt: Bando del Administrador Real de Deishe, Xunei Thun
    label: Bando
    places: [deishe]
    year: -11
  - image: docs/d5.svg
    alt: Ficha de la Denenita, enciclopedia de rocas y minerales
    label: Enciclopedia
    places: [taaku]
    year: 878
  - image: docs/d6.svg
    alt: Edicto real de deposición de Xunei Thun
    label: Edicto
    places: [deishe]
    year: -8
  - image: docs/d7.svg
    alt: Manual de gestión de la mina-celda de Kalts'een con anexo de bajas
    label: Manual
    places: [kalts-een]
    year: -37
  - image: docs/d8.svg
    alt: Cartas de Xunei Thun desde Kalts'een a Ran Lihashi
    label: Cartas
    places: [kalts-een]
    year: -7
    yearEnd: -1
  - image: docs/d9.svg
    alt: Acta del consejo minero de Kalts'een, sesión extraordinaria
    label: Acta
    places: [kalts-een]
    year: 0
  - image: docs/d10.svg
    alt: Carta de Xunei Thun al Rey de Taaku anunciando el túnel
    label: Carta al Rey
    places: [kalts-een]
    year: 0
  - image: docs/d11.svg
    alt: Diario de Shteek, notario penal de Kalts'een
    label: Diario
    places: [kalts-een]
    year: 0
---

¡Alegría! Por fin ha llegado el día. Hoy toca revisar la historia más famosa
de la semiesfera: la del intrépido explorador de Taaku, primero en pisar dos
landes. Nada más y nada menos que el primer interlande...

El cuerpo sigue aquí, en Markdown sencillo (ver 2.7).
```

Referencia completa de campos:

| Campo        | Obligatorio | Notas                                                          |
| ------------ | ----------- | -------------------------------------------------------------- |
| `title`      | sí          |                                                                |
| `volume`     | sí          | Ej. «Volumen VI» o «Historias con historia — Volumen 11»       |
| `summary`    | sí          | Una o dos frases; va al panel de historias                     |
| `hook`       | sí          | Gancho de una línea, sin spoilers; tarjeta de la portada       |
| `place`      | sí          | Id de `places.json`: lugar donde sucede la historia (tarjeta)  |
| `publish`    | sí          | `YYYY-MM-DD`. La historia no aparece hasta ese día             |
| `sequence`   | sí          | Entero, **único y consecutivo desde 1 entre TODAS las historias** (incluidas las no publicadas) |
| `cover`      | sí          | Archivo existente en la carpeta                                |
| `pdf`        | sí          | Archivo existente en la carpeta                                |
| `reveals`    | sí          | Lista de ids de pieza que se revelan al marcarla leída         |
| `documents`  | sí          | Lista no vacía; campos por documento en 2.4                    |

El tiempo de lectura de la tarjeta («N min») no es un campo: lo calcula el
build contando las palabras del cuerpo (200 por minuto, mínimo 1).

### 3.7 El cuerpo: Markdown sencillo

El cuerpo de `story.md` es **solo la narración entre documentos**. El
renderizado soporta únicamente:

- Títulos `#` a `####`
- `**negrita**`, `*cursiva*`, `[enlaces](url)`
- Listas con `-`

No soporta imágenes, notas al pie, tablas ni LaTeX. Los doc-boxes, figuras y
`\timelinefooter` del original se quedan en el PDF; en la web los documentos
son las entradas de `documents` y las figuras ilustrativas simplemente no
aparecen.

### 3.8 `reveals`, `sequence` y `publish`

- `reveals`: qué piezas del mapa desbloquea la historia. Regla dura del build:
  **todo lugar que usen sus documentos (y los ancestros de esos lugares) debe
  quedar dentro de una de las piezas que la historia revela.** Los puntos,
  dentro del rectángulo; los círculos, completamente dentro.
- `sequence`: el siguiente entero libre (si ya hay 6 historias, la nueva es
  `7`). Debe ser único y sin huecos entre todas, publicadas o no.
- `publish`: fecha en que se hace pública. Para probar una fecha futura en
  local: `SEMIESFERA_TODAY=2026-12-01 npm run build` (simula «hoy»).

## 4. Mapas desde un JPG grande

El mapa del mundo es un lienzo de **1200×800 unidades** (configurable en
`map-pieces.json` → `size`, pero si lo cambias hay que rehacer las coordenadas
de todos los lugares). Las piezas se muestran con `<img>`, así que **pueden ser
JPG directamente** — el SVG no es obligatorio.

### 4.1 Prepara el JPG

Recorta/escala el mapa a proporción 3:2 y decide a qué resolución trabajas.
Consejo: exporta a **2× (2400×1600)** — el mapa tiene zoom, y así se ve nítido.
Todas las coordenadas de piezas y lugares siguen siendo del lienzo 1200×800;
el tamaño de archivo es lo único que cambia.

```sh
magick mapa_original.jpg -resize 2400x1600 mapa.jpg
```

### 4.2 Decide las piezas

Cada pieza = un recorte rectangular que se revela con una historia. Sobre el
mapa (en un visor de imágenes, con la regla) anota para cada pieza su
rectángulo en coordenadas del lienzo 1200×800: `x, y, ancho, alto`.

Ejemplo: el lande de Taaku ocupa la esquina superior izquierda del mundo, de
(250, 180) a (570, 460).

### 4.3 Recorta cada pieza

Las coordenadas del recorte son píxeles del JPG (multiplica por el factor de
escala; con 2× es `×2`):

```sh
magick mapa.jpg -crop 640x560+500+360 +repage p-taaku.jpg   # 320x280 en (250,180) ×2
mv p-taaku.jpg content/pieces/p-taaku.jpg
```

(es `-crop ANCHOxALTO+X+Y`; el `+repage` borra el desplazamiento del recorte)

### 4.4 Opción A (recomendada): piezas JPG + mapa completo JPG

1. Copia los recortes a `content/pieces/p-<region>.jpg`.
2. Edita `content/map-pieces.json`:

   ```json
   {
     "size": { "width": 1200, "height": 800 },
     "pieces": [
       { "id": "p-taaku", "file": "pieces/p-taaku.jpg", "x": 250, "y": 180, "width": 320, "height": 280 }
     ],
     "complete": { "file": "complete/map.jpg", "width": 1200, "height": 800 }
   }
   ```

3. Pon el mapa entero (el `mapa.jpg` escalado a 1200×800 o al 2×) en
   `content/complete/map.jpg` y apunta `complete.file` a él.

   > Importante: si existe el `complete` autoral se usa tal cual; si no, el
   > build intenta **componer** el mapa completo incrustando el contenido SVG
   > de cada pieza, lo que no funciona con JPG. Con piezas JPG, el
   > `complete/map.jpg` es obligatorio.

### 4.5 Opción B: piezas SVG autocontenidas

Si prefieres SVG (por ejemplo para añadir etiquetas vectoriales encima):

```sh
B64=$(base64 -w0 p-taaku.jpg)
cat > content/pieces/p-taaku.svg <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="280" viewBox="0 0 320 280">
  <image width="320" height="280" href="data:image/jpeg;base64,$B64"/>
</svg>
EOF
```

El `base64` es necesario porque **el build solo copia el archivo `.svg`** (una
referencia externa a `p-taaku.jpg` quedaría rota en `public/`). Con SVG
autocontenidas, el mapa completo puede dejar que el build lo componga solo.

### 4.6 Añade los lugares

En `places.json`, dentro del rectángulo de la pieza que revelará la historia:

- Regiones (`circle`) que correspondan a landes/reinos del mapa: el círculo
  debe quedar **completo dentro** de la pieza.
- Puntos (`point`) para ciudades/enclaves, con `"parent"` apuntando a su
  región.

Y en `story.md`, la pieza en `reveals` y los lugares en los `places` de los
documentos.

## 5. Qué valida el build

`npm test` falla con mensajes concretos si algo no cuadra. Lo que comprueba:

| Regla                                                                                    |
| ---------------------------------------------------------------------------------------- |
| `places.json`: ids únicos, geometría `point`/`circle` válida, `parent` existente          |
| `map-pieces.json`: ids únicos, archivos existentes, x/y/width/height numéricos            |
| `eras.yaml`: `name`, `from < to` numéricos                                                |
| Historias: id slug, `title`/`volume`/`summary`/`hook`, `place` conocido, `publish` YYYY-MM-DD, `sequence` entero |
| `cover` y `pdf` existen en la carpeta                                                     |
| `reveals` solo con piezas conocidas; `documents` no vacío                                 |
| Por documento: `image` existe, `alt` y `label` no vacíos, `places` conocidos, `year` entero, `yearEnd >= year` |
| `sequence` único y consecutivo desde 1                                                    |
| Cada lugar usado por una historia (con ancestros) dentro de una pieza que esa historia revela |

## 6. Verificar en local

```sh
npm test          # build + smoke
npm run serve     # http://localhost:8178
```

Comprueba en el navegador:

1. `http://localhost:8178/` — la historia nueva aparece en orden.
2. `http://localhost:8178/historias/<id>/` — portada, resumen, PDF descarga,
   cuerpo, documentos con sus imágenes.
3. `http://localhost:8178/explorar/` — marca la historia como leída y verifica:
   la pieza del mapa aparece, los puntos se iluminan, los documentos entran al
   panel derecho y a la línea de tiempo con su año.
4. Prueba el hover: documento ↔ lugar ↔ región.

Para probar una `publish` futura: `SEMIESFERA_TODAY=2026-12-24 npm test`.

## 7. Publicar

```sh
git add content/ docs/
git commit -m "Historia: <título>"
git push
```

El push dispara GitHub Actions, que corre el build + smoke y despliega. Si el
build falla en CI, falla por las reglas de la sección 5: el mensaje dice exactamente qué archivo y qué campo.

## 8. Checklist

- [ ] Carpeta `content/stories/<id>/` con id slug
- [ ] `story.pdf` compilado desde tu Pandoc original
- [ ] `cover.svg`/`.png` (retrato)
- [ ] Un `docs/dN.*` por cada doc-box, renderizado con tu preámbulo
- [ ] `story.md`: frontmatter completo + cuerpo en Markdown sencillo
- [ ] `label` distintos entre documentos de la misma historia
- [ ] Años/`yearEnd` sacados de los `\docmeta`
- [ ] Piezas nuevas en `content/pieces/` + `map-pieces.json`
- [ ] Mapa completo en `content/complete/` (obligatorio con piezas JPG)
- [ ] Lugares nuevos en `places.json`, dentro de las piezas que revela la historia
- [ ] `eras.yaml` cubre los años nuevos (opcional)
- [ ] `sequence` = siguiente entero sin huecos; `publish` con la fecha buena
- [ ] `npm test` verde + repaso visual con `npm run serve`
