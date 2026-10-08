# Actualizar el mapa del mundo

Cómo regenerar el mapa del sitio cuando cambia el mundo en el generador, y
cómo mantener la información relacionada (landes, lugares, historias) en
coherencia. Para añadir historias sin tocar el mapa, usa
[anadir-historias.md](anadir-historias.md).

## 1. De qué está hecho el mapa

| Archivo                          | Qué es                                            | Quién lo escribe             |
| -------------------------------- | ------------------------------------------------- | ---------------------------- |
| `input/map_files/*.geojson`      | Celdas del generador (culturas, alturas, lagos)   | El generador (fuera del repo)|
| `input/map_files/interlande_map.png` | Render del mapa completo (1920×1083)          | El generador (fuera del repo)|
| `content/map-pieces.json`        | Lienzo, piezas y mapa completo                    | `tools/build-map.mjs`        |
| `content/pieces/p-lande-<c>.png` | Pieza enmascarada de cada lande                   | `tools/build-map.mjs`        |
| `content/complete/map.png`       | Mapa completo (se muestra al revelar todo)        | `tools/build-map.mjs`        |
| `content/places.json`            | Landes `poly` + lugares `point` de las historias  | Script (landes) + tú (puntos)|

Las exportaciones del generador viven en `input/map_files/` (directorio fuera
de este repo, solo lectura). El script las lee de ahí; nunca se commitean.

## 2. Cuándo actualizar

- El generador regeneró el mundo (nuevas culturas, montañas, lagos).
- Cambió la resolución del render PNG.
- Quieres renombrar landes o reasignar qué historia revela qué lande.
- Ajustar la calibración (el mapa no cuadra con las geocoordenadas).

## 3. Proceso, paso a paso

### 3.1 Coloca las exportaciones nuevas

```sh
input/map_files/Granland Cells <fecha>.geojson   # celdas con culture, height, type…
input/map_files/interlande_map.png               # render del mundo
```

Requisitos del PNG: 8 bits por canal, RGB o RGBA, **sin entrelazar** (el
decodificador del script no soporta interlacing ni 16 bits). El GeoJSON debe
tener las propiedades `culture` y las celdas de tipo `lake` (anclas de
calibración).

### 3.2 Regenera

```sh
node tools/build-map.mjs
```

Qué hace (en orden):

1. **Calibra** geocoordenadas → píxeles del render. Escala por defecto
   anclada en los lagos; se reescala sola si la resolución del PNG cambia.
2. **Recorta** el lienzo a la banda descrita: celdas con cultura o lago,
   más un margen (28 px por defecto).
3. **Una pieza por lande** = zona de cultura del generador: máscara
   2× sobremuestreada → PNG con alfa a resolución 1:1 del render.
4. **Contornos** de cada lande (trazado Moore + simplificación
   Douglas-Peucker, 1.5 px) → geometría `poly` en `places.json`.
5. **Conserva** los lugares `point` existentes y sus `parent` (si el parent
   sigue existiendo; si no, avisa) y los **nombres editados** de los landes
   (mismo id → mismo nombre).
6. **Lagos**: cada región de lago se asigna al lande vecino mayoritario (los
   lagos no tienen cultura propia), para que aparezcan azules en la pieza
   revelada en vez de transparentes. Los que no tocan ningún lande solo
   salen en el mapa completo.

Opciones:

| Opción            | Por defecto                    | Para qué                        |
| ----------------- | ------------------------------ | ------------------------------- |
| `--geojson ruta`  | `input/map_files/*.geojson` (más reciente) | Usar un export concreto |
| `--png ruta`      | `input/map_files/interlande_map.png` | Usar otro render           |
| `--calib sx,sy,ox,oy` | `6.016,5.838,956.8,547.7`  | Ajustar la calibración a mano   |
| `--margin px`     | `28`                           | Margen del recorte del lienzo   |

Lee la salida del script: lista cada lande con su pieza (tamaño, posición,
contornos, vértices) y avisa de lugares huérfanos (`parent` que ya no existe).

### 3.3 Comprueba los ids de lande

El id de cada lande es `lande-<n>` donde `<n>` es el **número de cultura del
generador**. Si el generador renumeró las culturas:

- Los ids cambian (`lande-17` puede ser otra tierra) y las piezas antiguas se
  borran (`p-*` huérfanos se limpian solos).
- Hay que actualizar en cada `story.md`: `reveals` (piezas que desbloquea) y
  los `places` de sus documentos.
- Y en `places.json`, el `parent` de los lugares puntuales.

El build falla con mensaje claro si una historia revela una pieza que no
existe o si un lugar queda fuera de las piezas reveladas por su historia.

### 3.4 Recoloca los lugares puntuales

El script conserva los `point` (ciudades de las historias) pero no sabe si
siguen cayendo dentro de su lande. Edita a mano `content/places.json`:

```json
{ "id": "taaku", "name": "Taaku", "parent": "lande-17",
  "geometry": { "type": "point", "x": 706.5, "y": 258.2 } }
```

- `x`/`y` son píxeles del lienzo (mismo sistema que las piezas).
- `parent` debe ser el lande que la contiene: al apuntar el lande se
  iluminan los documentos de todos sus hijos.
- Truco: para elegir coordenadas dentro de un lande irregular, usa el
  centroide (`cx`/`cy` de su geometría `poly`) y muévete desde ahí.

### 3.5 Nombra los landes

Los landes nacen con nombre provisional «Lande 14»…«Lande 21». Para darles
su nombre real basta editar `name` en `content/places.json`: **el script
conserva los nombres entre regeneraciones** (mismo id de lande → mismo
nombre). No cambies el `id` (ni el archivo de la pieza): el id viene del
número de cultura del generador y es lo que enlaza pieza, contorno y
`reveals` de las historias.

Si aun así renombraras un id, toca todos estos sitios:

| Dónde                          | Qué cambia                                  |
| ------------------------------ | ------------------------------------------- |
| `content/places.json`          | `id` (lande-17 → lande-ixam), `parent` de puntos |
| `content/pieces/p-lande-17.png`| Renombrar el archivo                        |
| `content/map-pieces.json`      | `id` de la pieza y `file`                   |
| `story.md` de cada historia    | `reveals`, `places` de docs, `parent` de puntos |

(Y una regeneración futura volvería a crear el lande con su id del
generador; tendrías que fusionar los duplicados a mano.)

### 3.6 Valida

```sh
npm test    # build + smoke test
```

Qué comprueba solo:

- Geometrías válidas (`point`/`circle`/`poly` con contornos bien formados).
- Cada lugar dentro de las piezas reveladas por su historia (puntos: dentro
  del rectángulo; `poly`: todos los vértices dentro).
- `totalPieces` = todas las piezas existentes (nunca las ya reveladas): leer
  una sola historia no puede marcar el mundo como «completo».
- Piezas no reveladas ausentes de `public/` y del mapa completo parcial.

### 3.7 Verifica en el navegador

```sh
npm run serve    # http://localhost:8178
```

| Pantalla    | Comprobación                                                      |
| ----------- | ----------------------------------------------------------------- |
| Explorar (sin leer nada) | Mapa vacío con la pista, sin piezas ni lugares      |
| Explorar (historia leída) | Piezas reveladas con fundido; landes interactivos (hover ilumina, clic fija `?place=`); puntos de la historia visibles; documentos del panel y línea de tiempo |
| Historia    | Minimapa con las piezas reveladas y los lugares                   |
| Explorar (todo leído) | Mapa completo, sin trazos de región                            |

## 4. Calibración: cómo funciona y cuándo tocarla

- El render PNG y las geocoordenadas no comparten origen ni escala; el
  script usa una **afín fija** (`px = 6.016·lon + 956.8`,
  `py = 547.7 − 5.838·lat`, norte arriba) medida una vez alineando los
  lagos del GeoJSON con las manchas verde-azuladas del render (ICP sobre
  cúmulos, residuo medio ~4 px a 1920×1083).
- Si la resolución del PNG cambia, el script reescala automáticamente.
- Solo toca `--calib` si el render nuevo usa otra proyección u origen:
  solapa las culturas sobre el PNG y comprueba que los lagos caen en las
  manchas verde-azuladas antes de confiar en el resultado.
- La calibración afecta a la posición de piezas y contornos, pero **no** a
  la máscara visible (que sale directamente del PNG): un pequeño desajuste
  se nota en que el trazado del lande no sigue exactamente el borde pintado.

## 5. Detalles del pipeline (referencia)

- **Piezas 1:1**: la pieza es un recorte exacto del render fuente (sin
  remuestrear), con alfa por celda de cultura. Piezas adyacentes teselan
  sin huecos: comparten los mismos polígonos de celdas.
- **Contornos**: un polígono por componente conexo ≥ 120 px (agujeros
  ignorados); los enclaves pequeños salen en la imagen de la pieza pero no
  son clicables.
- **Lienzo**: banda descrita del mundo (hemisferio sur en el mapa actual);
  las bandas pálidas polares del render quedan fuera salvo que el propio
  lande se desvanezca en ellas (el lande del sur se dibuja hasta el borde).
- **Mundo real**: mapa aplanado de un cilindro (envuelve en x); sin masas
  de agua grandes, solo lagos; montañas masivas separando las tierras. El
  generador es la fuente de verdad.
