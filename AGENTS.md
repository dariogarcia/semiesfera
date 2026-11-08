# AGENTS.md — protocolo de mantenimiento para agentes LLM

Instrucciones operativas para añadir o actualizar un volumen de *la
Semiesfera*. Diseñado para ejecutarse mecánicamente: comandos exactos,
puertas de verificación y puntos donde **parar y preguntar al humano**.
Documentación humana completa (el porqué de todo): `docs/anadir-historias.md`.

## Reglas duras

| Regla | Motivo |
| --- | --- |
| Cero dependencias: nunca `npm install` | El repo no tiene package-lock ni node_modules |
| `content/sources/*.md` es verbatim del autor: copiar, nunca editar | Es la fuente del PDF compilado a mano |
| Nunca recompilar ni retocar `story.pdf` a mano | Solo el importer (xelatex) o el `--pdf` del autor |
| Nunca inventar contenido: textos, fechas, coordenadas, `summary` | Decisión del humano → preguntar |
| `npm test` verde antes de cada commit; commit por unidad terminada | Reversibilidad |
| No tocar nada fuera de este repo (p. ej. `input/`, `_Sources/`) | Material del autor |

## Mapa rápido del repo

| Ruta | Qué es | ¿Se toca? |
| --- | --- | --- |
| `content/sources/<id>.md` | Original Pandoc/LaTeX del autor | Solo copiar verbatim |
| `content/stories/<id>/` | Historia web: `story.md`, `docs/dN.png`, `imgs/`, `cover.svg`, `story.pdf` | Sí |
| `content/places.json` | Lugares del mundo (polígonos/puntos) | Sí, con datos del humano |
| `content/map-pieces.json` + `content/pieces/` | Piezas del mapa y sus recortes | Sí, con datos del humano |
| `content/eras.yaml` | Eras de la línea de tiempo | Rara vez |
| `build.mjs`, `assets/`, `tools/` | Generador y runtime | Solo si falla algo |
| `public/` | Salida del build | Nunca a mano (se regenera) |

## Comandos de referencia

```sh
npm test                          # build + smoke (valida TODO el sitio)
node tools/check-volume.mjs <id>  # verificación mecánica de un volumen
npm run serve                     # servir public/ en http://localhost:8178
node tools/render-doc.mjs <id> --doc N   # re-renderizar un documento suelto
node tools/build-map.mjs          # solo si cambió el generador del mundo
```

---

## Tarea A — añadir un volumen nuevo

### Paso 0: recolectar datos (PREGUNTAR al humano)

Antes de tocar nada, consigue esta tabla. Si falta un dato, pide — no lo
inventes.

| Dato | Ejemplo | Origen |
| --- | --- | --- |
| `id` slug | `vol12-el-nombre` | Humano |
| Título del volumen | `Historias con historia — Volumen 12` | Humano |
| `sequence` | `2` | **Calculado**: máximo existente + 1 (verifica en `content/stories/*/story.md`) |
| `publish` (YYYY-MM-DD) | `2026-12-01` | Humano (puede ser futura: no se publica hasta su fecha) |
| `summary` (una frase, sin spoilers) | — | Humano |
| Piezas que revela (`reveals`) | `p-lande-15` | Humano |
| Lugar de cada doc-box (`place-map`) | `1=deishe,2=taaku` | Humano o `\docmeta` de la fuente |
| Ruta de la fuente | `content/sources/vol12.md` | Humano |
| PDF ya compilado (opcional) | ruta al PDF del autor | Humano; si existe, pasar `--pdf` |

### Paso 1: preparar el mundo (solo si hay lugares/piezas nuevos)

Para cada lugar nuevo que use la historia:

1. ¿Existe en `content/places.json`? Si no: **PARAR** — pedir al humano el
   id, nombre y geometría (punto con coordenadas del mapa, 1920×638).
2. Comprobar la regla de oro: **todo lugar debe caer dentro de una pieza
   que la propia historia revela** (el build falla si no). Si un lugar nuevo
   necesita una pieza nueva: pedir al humano la pieza (recorte en
   `content/pieces/` + entrada en `map-pieces.json`).
3. ¿Los años de la historia caen fuera de las eras existentes? Añadir era a
   `eras.yaml` (rango en años GC, negativos = antes de la gran conexión).

### Paso 2: importar

```sh
cp <fuente-del-autor> content/sources/<id>.md   # verbatim, sin retocar
node tools/import-story.mjs content/sources/<id>.md \
  --id <id> \
  --volume "<título del volumen>" \
  --sequence <N> \
  --publish <YYYY-MM-DD> \
  --summary "<frase de gancho>" \
  --reveals <pieza> \
  --place-map 1=<lugar>,2=<lugar>,... \
  --img-place <lugar-por-defecto-de-imagenes> \
  --img-year <año-por-defecto-de-imagenes>
# si el autor ya compiló su PDF: añadir --pdf <ruta-al-pdf>
```

Salida esperada: `Importada <id> (N documentos, M imágenes, ...)`.
Si un doc-box no encuentra lugar: error `falta lugar (--place-map N=...)`
→ volver al paso 0 con el humano.

### Paso 3: optimizar imágenes (Pillow, sin tocar `_Sources/`)

Regla por tipo:

| Tipo de imagen | Qué hacer |
| --- | --- |
| Escaneos de documentos (`docs/dN.png`) | Cuantizar a paleta 256: `im.quantize(256)` → PNG |
| Piezas del mapa (PNG) | Ídem (paleta 256) |
| Ilustraciones / arte fotográfico | WebP `quality=88` Y cambiar el `file:` de `story.md` a `.webp`, borrar el original del repo |
| JPEG ya comprimidos | Nada |

```py
from PIL import Image
im = Image.open("content/stories/<id>/docs/d1.png")
im.quantize(256).save("content/stories/<id>/docs/d1.png")
# arte:
im = Image.open("orig.png"); im.save("destino.webp", "WEBP", quality=88)
```

Umbral: ninguna imagen del volumen debe pasar de ~300 KB (`check-volume`
avisa a partir de 300 y falla a partir de 700).

### Paso 4: revisar `story.md` (git diff)

Comprobrar en el diff, sin cambiar contenido creativo:

- `label` distintos entre documentos de la misma historia;
- `alt` descriptivo en todos los documentos e imágenes;
- `year`/`yearEnd` coherentes con los `\docmeta` de la fuente;
- `summary` sin spoilers;
- `places` de cada documento dentro de las piezas reveladas.

Si algo de fondo está mal (texto, lugar, año), corregir **en la fuente del
autor** y re-importar; no maquillar el `story.md`.

### Paso 5: verificar

```sh
node tools/check-volume.mjs <id>   # debe salir "0 fallos"
npm test                           # debe salir "Smoke test: todo correcto."
```

Ambos en verde → paso 6. Si fallan, ver catálogo de errores abajo.

Opcional (verificación visual con navegador headless): `npm run serve` y
cargar `http://localhost:8178/historias/<id>/` — todas las imágenes deben
cargar tras hacer scroll (son lazy).

### Paso 6: commit

```sh
git add -A && git commit -m "historia: añade <id> (<título>)"
```

Si `publish` es futura, el commit es seguro: el build excluye lo no
publicado y su contenido nunca llega a `public/`.

---

## Tarea B — actualizar un volumen existente

1. `git status` limpio (sin cambios a medias) — el diff es tu herramienta.
2. Leer los metadatos actuales de `content/stories/<id>/story.md`
   (`sequence`, `publish`, `reveals`, `summary`, …): se conservan.
3. Copiar la fuente actualizada a `content/sources/<id>.md` (verbatim).
4. Re-importar con **los mismos valores** de `sequence` y `publish` (paso 2
   de la tarea A). El importer regenera `story.md`, `docs/*.png` e imágenes.
5. `git diff content/stories/<id>/` y restaurar los retoques manuales que
   el re-import haya pisado (típicamente: `file:` `.webp` del paso 3 — el
   importer copia los originales de nuevo).
6. Re-optimizar solo las imágenes nuevas o cambiadas (paso 3).
7. Verificar (paso 5) y commit: `git commit -m "historia: actualiza <id>"`.

---

## Catálogo de errores → solución

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| build: `el lugar X no existe` | `places.json` sin ese id | Paso 1 con el humano |
| build: `el lugar X está fuera de las piezas que esta historia revela` | Punto fuera de toda pieza revelada | Mover el punto o revelar pieza (humano) |
| build: `sequence` no consecutivos | Número repetido/hueco | Recalcular máximo+1 |
| build: `no existe la imagen X` | `file:` mal referenciado | Arreglar ruta en `story.md` |
| build: año fuera de eras | Rango nuevo | Añadir era en `eras.yaml` |
| check-volume: imagen > 700 KB | Sin optimizar | Paso 3 |
| check-volume: `{{dN}}` sin entrada | Cuerpo con marcador huérfano | Revisar diff del cuerpo |
| importer: `falta lugar (--place-map N=...)` | Doc-box sin lugar | `--place-map N=<lugar>` |
| importer: render xelatex falla | LaTeX del doc-box | Mirar `renders/*.log`; corregir en la fuente del autor |

## Cuándo parar y preguntar

- Cualquier dato del paso 0 que falte.
- Colocación de lugares nuevos (coordenadas) o piezas nuevas.
- Cambios de texto, títulos, fechas o `summary`.
- Imágenes cuya optimización con pérdida pueda notarse (bandas de color):
  cuantizar y **ofrecer al humano** la comparación + revert fácil
  (`git checkout -- <archivo>`).
