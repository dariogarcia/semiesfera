// Verificación mecánica de un volumen: node tools/check-volume.mjs <id>
// Comprueba que content/stories/<id>/ está completo y listo para publicar:
// campos del frontmatter, archivos presentes, dimensiones legibles,
// marcadores del cuerpo, referencias a lugares/piezas y tamaños de imagen.
// Sin dependencias. Sale con código 1 si hay algún FAIL.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter, imageSize } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
if (!id) {
  console.error('Uso: node tools/check-volume.mjs <id-de-historia>');
  console.error(`   ids disponibles: ${fs.readdirSync(path.join(ROOT, 'content/stories')).join(', ')}`);
  process.exit(1);
}

const dir = path.join(ROOT, 'content/stories', id);
let fails = 0;
let warns = 0;
const ok = (msg) => console.log(`PASS ${msg}`);
const fail = (msg) => { fails++; console.log(`FAIL ${msg}`); };
const warn = (msg) => { warns++; console.log(`AVISO ${msg}`); };

// --- story.md y frontmatter -------------------------------------------------

const mdPath = path.join(dir, 'story.md');
if (!fs.existsSync(mdPath)) { fail(`no existe content/stories/${id}/story.md`); process.exit(1); }
const { data: meta, body } = splitFrontmatter(fs.readFileSync(mdPath, 'utf8'));

for (const field of ['title', 'volume', 'publish', 'summary', 'hook', 'place', 'sequence', 'cover', 'pdf']) {
  if (!meta[field]) fail(`falta el campo obligatorio "${field}"`);
}
if (meta.publish && !/^\d{4}-\d{2}-\d{2}$/.test(meta.publish)) fail(`publish "${meta.publish}" no es una fecha YYYY-MM-DD`);
if (meta.sequence !== undefined && (!Number.isInteger(meta.sequence) || meta.sequence < 1)) fail(`sequence "${meta.sequence}" no es un entero >= 1`);
if (!meta.reveals || !meta.reveals.length) fail('reveals está vacío: la historia debe revelar al menos una pieza del mapa');
const documents = meta.documents || [];
const images = meta.images || [];
if (!documents.length) fail('no hay documentos');

// --- archivos referenciados -------------------------------------------------

const checkImage = (rel, where) => {
  const file = path.join(dir, rel);
  if (!fs.existsSync(file)) { fail(`${where}: no existe ${rel}`); return null; }
  if (rel.endsWith('.svg')) return { svg: true };
  const dims = imageSize(file);
  if (!dims) { fail(`${where}: ${rel} no es un PNG/JPEG/WebP reconocido`); return null; }
  const kb = Math.round(fs.statSync(file).size / 1024);
  if (kb > 700) fail(`${where}: ${rel} pesa ${kb} KB — optimízala antes de publicar`);
  else if (kb > 300) warn(`${where}: ${rel} pesa ${kb} KB — conviene optimizar`);
  return dims;
};

for (const f of [meta.cover, meta.pdf]) {
  if (f && !fs.existsSync(path.join(dir, f))) fail(`no existe ${f}`);
}
const docDims = new Map();
documents.forEach((d, i) => {
  if (!d.label) fail(`documento ${i + 1}: falta label`);
  if (d.year === undefined) fail(`documento ${i + 1} (${d.label}): falta year`);
  if (d.yearEnd !== undefined && d.yearEnd !== null && d.yearEnd < d.year) fail(`documento ${i + 1} (${d.label}): yearEnd < year`);
  if (!d.alt) fail(`documento ${i + 1} (${d.label}): falta alt`);
  const dims = checkImage(d.image, `documento ${i + 1} (${d.label})`);
  if (dims) docDims.set(`d${i + 1}`, dims);
});
const labels = documents.map((d) => d.label).filter(Boolean);
const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
if (dup.length) fail(`labels repetidos: ${[...new Set(dup)].join(', ')}`);
images.forEach((im, i) => {
  if (!im.alt) fail(`imagen i${i + 1}: falta alt`);
  checkImage(im.file, `imagen i${i + 1}`);
});

// --- marcadores del cuerpo --------------------------------------------------

const markers = [...body.matchAll(/\{\{([di])(\d+)\}\}/g)].map((m) => `${m[1]}${m[2]}`);
for (const m of markers) {
  const n = Number(m.slice(1));
  const exists = m[0] === 'd' ? n <= documents.length : n <= images.length;
  if (!exists) fail(`el cuerpo usa {{${m}}} pero no existe esa entrada (hay ${documents.length} documentos y ${images.length} imágenes)`);
}
// tokens LaTeX residuales: el conversor del importer no dejó nada atrás
const RESIDUAL = /\{\d+(?:[.,]\d+)?(?:em|pt)\}|\{center\}|\{>\}|\{gray!|\[\d+pt\]|Todos los derechos reservados/;
if (RESIDUAL.test(body)) fail('el cuerpo tiene tokens LaTeX residuales (¿re-importar con el importer actualizado?)');
const used = new Set(markers);
documents.forEach((_, i) => { if (!used.has(`d${i + 1}`)) warn(`documento ${i + 1} no tiene marcador {{d${i + 1}}}: aparecerá en la lista final "Documentos"`); });

// --- referencias al mundo ---------------------------------------------------

const places = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/places.json'), 'utf8')).places;
const placeIds = new Set(places.map((p) => p.id));
const pieces = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/map-pieces.json'), 'utf8')).pieces;
const pieceIds = new Set(pieces.map((p) => p.id));
for (const r of meta.reveals || []) {
  if (!pieceIds.has(r)) fail(`reveals: la pieza "${r}" no existe en map-pieces.json`);
}
if (meta.place && !placeIds.has(meta.place)) fail(`place: el lugar "${meta.place}" no existe en places.json`);
for (const d of [...documents, ...images]) {
  for (const p of d.places || []) {
    if (!placeIds.has(p)) fail(`"${d.label || d.image}": el lugar "${p}" no existe en places.json`);
  }
}

// --- resumen ----------------------------------------------------------------

const total = documents.length + images.length;
console.log(`\n${id}: ${documents.length} documentos, ${images.length} imágenes, ${warns} avisos, ${fails} fallos`);
process.exit(fails ? 1 : 0);
