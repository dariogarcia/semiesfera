// Construye los recursos del mapa del sitio desde las exportaciones del
// generador de mundos: celdas GeoJSON + render PNG. Sin dependencias.
//
//   node tools/build-map.mjs [--geojson ruta] [--png ruta]
//                            [--calib sx,sy,ox,oy] [--margin px]
//
// Entradas (por defecto, las de input/map_files/ del repositorio):
//   - GeoJSON de celdas (polígonos Voronoi con propiedades culture/type)
//   - PNG del mapa renderizado (RGBA)
// Salidas en content/:
//   - pieces/p-lande-<c>.png  una pieza por zona de cultura (recorte + máscara)
//   - complete/map.png        recorte del hemisferio descrito
//   - places.json             landes (polígonos) + puntos de historias existentes
//   - map-pieces.json         lienzo, piezas y mapa completo
//
// La calibración (geocoordenadas → píxeles del PNG) se ajustó una vez con ICP
// sobre los lagos; si el generador exporta a otra resolución se reescala
// automáticamente. Con --calib se puede afinar a mano.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');

// -- argumentos -----------------------------------------------------------------

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
}

const GEOJSON = argValue('--geojson', null) || findInput('.geojson', 'Granland Cells');
const PNG = argValue('--png', null) || findInput('.png', 'interlande_map');
const CALIB = (argValue('--calib', '6.016,5.838,956.8,547.7')).split(',').map(Number);
const MARGIN = Number(argValue('--margin', '28'));
const MIN_COMPONENT = 120;

function findInput(ext, hint) {
  const dir = path.join(REPO, 'input', 'map_files');
  if (!fs.existsSync(dir)) fail(`no existe ${dir}; usa --${ext === '.geojson' ? 'geojson' : 'png'}`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort();
  if (!files.length) fail(`no hay archivos ${ext} en ${dir}`);
  const hinted = files.find((f) => f.startsWith(hint));
  return path.join(dir, hinted || files[files.length - 1]);
}

function fail(msg) {
  console.error(`build-map: ${msg}`);
  process.exit(1);
}

// -- PNG mínimo (RGBA/RGB de 8 bits, sin entrelazado) -----------------------------

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) fail('no es un PNG');
  let pos = 8;
  let width, height, colorType, interlace;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      const depth = data[8]; colorType = data[9]; interlace = data[12];
      if (depth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
        fail(`PNG no soportado (depth=${depth}, color=${colorType}, interlace=${interlace}); reexporta como RGBA de 8 bits`);
      }
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    prev = cur;
  }
  return { width, height, bpp, data: out };
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// -- datos -------------------------------------------------------------------------

console.log(`geojson: ${path.basename(GEOJSON)}`);
console.log(`png:     ${path.basename(PNG)}`);
const png = decodePNG(fs.readFileSync(PNG));
if (png.bpp !== 4) fail('el PNG de origen debe tener canal alfa (RGBA)');
const { width: W, height: H, data: SRC } = png;

// calibración: se definió para 1920x1083; se reescala si cambia la resolución
const REF_W = 1920, REF_H = 1083;
let [SX, SY, OX, OY] = CALIB;
if (W !== REF_W || H !== REF_H) {
  SX *= W / REF_W; SY *= H / REF_H; OX *= W / REF_W; OY *= H / REF_H;
  console.log(`(resolución distinta a ${REF_W}x${REF_H}: calibración reescalada)`);
}
const gx = (x) => SX * x + OX;
const gy = (y) => OY - SY * y; // norte arriba

const gj = JSON.parse(fs.readFileSync(GEOJSON, 'utf8'));
const cells = gj.features.map((f) => ({
  ring: f.geometry.coordinates[0],
  culture: f.properties.culture,
  type: f.properties.type
}));
console.log(`celdas: ${cells.length}  lienzo de origen: ${W}x${H}`);

// -- recorte del lienzo (hemisferio descrito) --------------------------------------

let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
for (const c of cells) {
  if (c.culture === 0 && c.type !== 'lake') continue;
  for (const p of c.ring) {
    const px = gx(p[0]), py = gy(p[1]);
    if (px < x0) x0 = px; if (px > x1) x1 = px;
    if (py < y0) y0 = py; if (py > y1) y1 = py;
  }
}
x0 = Math.max(0, Math.floor(x0 - MARGIN)); y0 = Math.max(0, Math.floor(y0 - MARGIN));
x1 = Math.min(W - 1, Math.ceil(x1 + MARGIN)); y1 = Math.min(H - 1, Math.ceil(y1 + MARGIN));
const CW = x1 - x0 + 1, CH = y1 - y0 + 1;
console.log(`lienzo del sitio: ${CW}x${CH} (recorte ${x0},${y0})`);

// -- máscaras por lande -------------------------------------------------------------

function fillPolygon(mask, mw, mh, ring, scale, ox, oy) {
  const pts = [];
  for (const p of ring) {
    const px = Math.round((gx(p[0]) - ox) * scale);
    const py = Math.round((gy(p[1]) - oy) * scale);
    if (px >= -1 && px <= mw && py >= -1 && py <= mh) pts.push([px, py]);
  }
  if (pts.length < 3) return;
  let ymin = Infinity, ymax = -Infinity;
  for (const p of pts) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
  ymin = Math.max(0, ymin); ymax = Math.min(mh - 1, ymax);
  for (let y = ymin; y <= ymax; y++) {
    const nodes = [];
    let j = pts.length - 1;
    for (let i = 0; i < pts.length; i++) {
      if ((pts[i][1] > y) !== (pts[j][1] > y)) {
        nodes.push(pts[i][0] + (y - pts[i][1]) / (pts[j][1] - pts[i][1]) * (pts[j][0] - pts[i][0]));
      }
      j = i;
    }
    nodes.sort((a, b) => a - b);
    for (let k = 0; k + 1 < nodes.length; k += 2) {
      const a = Math.max(0, Math.ceil(nodes[k]));
      const b = Math.min(mw - 1, Math.floor(nodes[k + 1]));
      for (let x = a; x <= b; x++) mask[y * mw + x] = 1;
    }
  }
}

// componentes conexos + contorno Moore de cada uno
function components(mask, mw, mh) {
  const seen = new Uint8Array(mw * mh);
  const comps = [];
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const start = y * mw + x;
      if (!mask[start] || seen[start]) continue;
      const stack = [start];
      seen[start] = 1;
      const px = [];
      while (stack.length) {
        const i = stack.pop();
        px.push(i);
        const cx = i % mw, cy = (i / mw) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue;
          const ni = ny * mw + nx;
          if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
        }
      }
      comps.push(px);
    }
  }
  return comps.sort((a, b) => b.length - a.length);
}

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

function traceContour(mask, mw, mh, sx, sy) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < mw && y < mh) ? mask[y * mw + x] : 0;
  if (!at(sx, sy)) return null;
  let dir = 6; // llegamos por arriba
  let cx = sx, cy = sy;
  const contour = [[cx, cy]];
  for (let step = 0; step < 200000; step++) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (dir + k) & 7;
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (at(nx, ny)) {
        if (nx === sx && ny === sy && contour.length > 2) return contour;
        cx = nx; cy = ny; dir = (d + 4) & 7;
        contour.push([cx, cy]);
        found = true;
        break;
      }
    }
    if (!found) return contour;
  }
  return contour;
}

function rdp(points, eps) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = points[a][0], ay = points[a][1], bx = points[b][0], by = points[b][1];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let maxD = -1, maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (points[i][0] - ax) - dx * (points[i][1] - ay)) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > eps) {
      keep[maxI] = 1;
      stack.push([a, maxI], [maxI, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// -- piezas y landes -----------------------------------------------------------------

const byCulture = new Map();
for (const c of cells) {
  if (c.culture === 0 || c.culture == null) continue;
  if (!byCulture.has(c.culture)) byCulture.set(c.culture, []);
  byCulture.get(c.culture).push(c);
}

const piecesDir = path.join(ROOT, 'content', 'pieces');
fs.mkdirSync(piecesDir, { recursive: true });
for (const old of fs.readdirSync(piecesDir)) {
  if (old.startsWith('p-')) fs.rmSync(path.join(piecesDir, old));
}

const places = [];
const pieces = [];
const SS = 2; // sobremuestreo de la máscara para suavizar bordes

for (const [culture, list] of [...byCulture.entries()].sort((a, b) => a[0] - b[0])) {
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const c of list) {
    for (const p of c.ring) {
      const px = gx(p[0]), py = gy(p[1]);
      if (px < bx0) bx0 = px; if (px > bx1) bx1 = px;
      if (py < by0) by0 = py; if (py > by1) by1 = py;
    }
  }
  const pad = 2;
  bx0 = Math.max(x0, Math.floor(bx0) - pad); by0 = Math.max(y0, Math.floor(by0) - pad);
  bx1 = Math.min(x1, Math.ceil(bx1) + pad); by1 = Math.min(y1, Math.ceil(by1) + pad);
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;

  const maskHi = new Uint8Array(bw * SS * bh * SS);
  for (const c of list) fillPolygon(maskHi, bw * SS, bh * SS, c.ring, SS, bx0, by0);
  const mask = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      let n = 0;
      for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) n += maskHi[(y * SS + dy) * bw * SS + x * SS + dx];
      mask[y * bw + x] = n ? 1 : 0;
    }
  }

  const rgba = Buffer.alloc(bw * bh * 4);
  let alphaSum = 0, alphaCount = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      let n = 0;
      for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) n += maskHi[(y * SS + dy) * bw * SS + x * SS + dx];
      const alpha = Math.round(n * 255 / (SS * SS));
      const di = (y * bw + x) * 4;
      const si = ((by0 + y) * W + bx0 + x) * 4;
      rgba[di] = SRC[si]; rgba[di + 1] = SRC[si + 1]; rgba[di + 2] = SRC[si + 2];
      rgba[di + 3] = alpha;
      if (alpha) { alphaSum += alpha; alphaCount++; }
    }
  }

  const id = `lande-${culture}`;
  const file = `pieces/p-${id}.png`;
  fs.writeFileSync(path.join(ROOT, 'content', file), encodePNG(bw, bh, rgba));

  // contornos por componente conexo (para el área de interacción)
  const comps = components(mask, bw, bh).filter((c) => c.length >= MIN_COMPONENT);
  const contours = [];
  let areaSum = 0, cxSum = 0, cySum = 0;
  for (const comp of comps) {
    let top = comp[0];
    for (const i of comp) if ((i % bw) < (top % bw) || i < top) top = Math.min(i, top);
    const contour = traceContour(mask, bw, bh, top % bw, (top / bw) | 0);
    if (!contour || contour.length < 8) continue;
    const simplified = rdp(contour, 1.5);
    if (simplified.length < 3) continue;
    contours.push(simplified.map(([x, y]) => [Math.round((x + bx0 - x0) * 10) / 10, Math.round((y + by0 - y0) * 10) / 10]));
    for (const i of comp) { cxSum += i % bw; cySum += (i / bw) | 0; }
    areaSum += comp.length;
  }
  if (!contours.length) { console.warn(`  (lande ${culture}: sin contornos, se omite)`); continue; }

  const labelX = Math.round((cxSum / areaSum + bx0 - x0) * 10) / 10;
  const labelY = Math.round((cySum / areaSum + by0 - y0) * 10) / 10;
  places.push({
    id,
    name: `Lande ${culture}`,
    geometry: { type: 'poly', contours, cx: labelX, cy: labelY }
  });
  pieces.push({
    id: `p-${id}`,
    file,
    x: Math.round(bx0 - x0),
    y: Math.round(by0 - y0),
    width: bw,
    height: bh,
    regions: [id]
  });
  console.log(`  ${id}: pieza ${bw}x${bh} en (${bx0 - x0},${by0 - y0}), ${contours.length} contorno(s), ${contours.reduce((n, c) => n + c.length, 0)} vértices`);
}

// -- mapa completo -------------------------------------------------------------------

const completeDir = path.join(ROOT, 'content', 'complete');
fs.mkdirSync(completeDir, { recursive: true });
const completeRgba = Buffer.alloc(CW * CH * 4);
for (let y = 0; y < CH; y++) {
  SRC.copy(completeRgba, y * CW * 4, ((y0 + y) * W + x0) * 4, ((y0 + y) * W + x1 + 1) * 4);
}
fs.writeFileSync(path.join(completeDir, 'map.png'), encodePNG(CW, CH, completeRgba));
for (const old of fs.readdirSync(completeDir)) {
  if (old !== 'map.png') fs.rmSync(path.join(completeDir, old));
}

// -- places.json / map-pieces.json ----------------------------------------------------

// se conservan los lugares puntuales existentes (ciudades de las historias);
// el usuario los recoloca a mano dentro de su lande
const placesFile = path.join(ROOT, 'content', 'places.json');
let pointPlaces = [];
if (fs.existsSync(placesFile)) {
  const prev = JSON.parse(fs.readFileSync(placesFile, 'utf8'));
  pointPlaces = (prev.places || []).filter((p) => p.geometry && p.geometry.type === 'point');
  for (const p of pointPlaces) {
    if (p.parent && !places.some((l) => l.id === p.parent)) {
      console.warn(`  aviso: el lugar "${p.id}" tenía parent "${p.parent}", que ya no existe`);
    }
  }
}
fs.writeFileSync(placesFile, JSON.stringify({ places: [...places, ...pointPlaces] }, null, 2) + '\n');

fs.writeFileSync(path.join(ROOT, 'content', 'map-pieces.json'), JSON.stringify({
  size: { width: CW, height: CH },
  pieces,
  complete: { file: 'complete/map.png', width: CW, height: CH }
}, null, 2) + '\n');

console.log(`listo: ${pieces.length} landes, ${pointPlaces.length} lugares puntuales conservados`);
console.log('recuerda: cada historia debe revelar sus piezas (reveals) y sus lugares deben caer dentro');
