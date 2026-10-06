// Smoke test: comprueba invariantes del build en public/.
// Se ejecuta tras el build (npm test). Falla con código distinto de 0.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const CONTENT = path.join(ROOT, 'content');

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { failures++; console.error('  ✗ ' + msg); }
};

function read(p) { return fs.readFileSync(path.join(PUBLIC, p), 'utf8'); }
function exists(p) { return fs.existsSync(path.join(PUBLIC, p)); }

console.log('Smoke test de public/\n');

// portada, explorar y páginas
ok(exists('index.html'), 'existe index.html (portada)');
ok(exists('explorar/index.html'), 'existe explorar/index.html');
ok(exists('rss.xml'), 'existe rss.xml');
const indexHtml = read('index.html');
ok(indexHtml.includes('explorar/'), 'la portada enlaza a explorar/');
ok(indexHtml.includes('Entrar'), 'la portada tiene el botón de entrada');
ok(!indexHtml.includes('site-header'), 'la portada no tiene barra superior');

// datos
const index = JSON.parse(read('data/index.json'));
ok(Array.isArray(index.stories) && index.stories.length > 0, 'data/index.json con historias');
ok(typeof index.totalPieces === 'number' && index.totalPieces > 0, 'data/index.json con totalPieces');
const exploreHtml = read('explorar/index.html');
ok(exploreHtml.includes('data-sp-list'), 'explorar tiene el panel de historias');
ok(exploreHtml.includes('data-dp-list'), 'explorar tiene el panel de documentos');
ok(exploreHtml.includes('data-tl-svg'), 'explorar tiene la línea de tiempo');

// historias publicadas: página, datos, recursos
for (const s of index.stories) {
  ok(exists(`historias/${s.id}/index.html`), `página de ${s.id}`);
  ok(exists(`data/${s.id}.json`), `datos de ${s.id}`);
  const data = JSON.parse(read(`data/${s.id}.json`));
  ok(data.documents.length > 0, `${s.id} tiene documentos`);
  ok(typeof data.bodyHtml === 'string' && data.bodyHtml.length > 0, `${s.id} tiene el cuerpo en HTML`);
  for (const d of data.documents) {
    ok(exists(d.image), `imagen de documento ${d.id}`);
  }
  const storyHtml = read(`historias/${s.id}/index.html`);
  ok(storyHtml.includes(s.title), `la página de ${s.id} tiene el título`);
}

// secuencia única y consecutiva
const seqs = index.stories.map((s) => s.sequence).sort((a, b) => a - b);
ok(seqs.every((q, i) => q === i + 1), 'secuencias 1..N sin huecos');

// piezas publicadas presentes; no publicadas, ausentes
const piecesMeta = JSON.parse(fs.readFileSync(path.join(CONTENT, 'map-pieces.json'), 'utf8'));
const revealed = new Set();
for (const s of index.stories) {
  const data = JSON.parse(read(`data/${s.id}.json`));
  data.pieces.forEach((p) => revealed.add(p.id));
}
for (const p of piecesMeta.pieces) {
  if (revealed.has(p.id)) {
    ok(exists(p.file), `pieza publicada ${p.id} copiada`);
  } else {
    ok(!exists(p.file), `pieza no publicada ${p.id} ausente de public/`);
    for (const s of index.stories) {
      ok(!read(`data/${s.id}.json`).includes(p.id), `datos de ${s.id} sin referencias a ${p.id}`);
    }
  }
}

// el mapa completo no incluye regiones no publicadas
const complete = read('complete/map.svg');
for (const p of piecesMeta.pieces) {
  if (revealed.has(p.id)) {
    const pieceSvg = fs.readFileSync(path.join(CONTENT, p.file), 'utf8');
    const regions = [...pieceSvg.matchAll(/data-region="([^"]+)"/g)].map((m) => m[1]);
    regions.forEach((r) => {
      const m = complete.match(new RegExp(`data-region="${r}"`));
      ok(!!m, `el mapa completo incluye la región publicada ${r}`);
    });
  }
}

// historias futuras: nunca en public/
const storyDirs = fs.readdirSync(path.join(CONTENT, 'stories')).filter((d) =>
  fs.statSync(path.join(CONTENT, 'stories', d)).isDirectory()
);
const publishedIds = new Set(index.stories.map((s) => s.id));
for (const id of storyDirs) {
  if (!publishedIds.has(id)) {
    ok(!exists(`historias/${id}`), `historia no publicada ${id} sin página`);
    ok(!exists(`data/${id}.json`), `historia no publicada ${id} sin datos`);
    ok(!exists(`stories/${id}`), `historia no publicada ${id} sin recursos`);
    ok(!indexHtml.includes(id), `la portada no menciona ${id}`);
    ok(!exploreHtml.includes(id), `explorar no menciona ${id}`);
  }
}

// enlaces internos de las páginas generadas
function checkLinks(file) {
  const html = read(file);
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1])
    .filter((h) => !h.startsWith('http') && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('data:'));
  for (const ref of refs) {
    let target = path.join(PUBLIC, path.dirname(file), ref);
    try { target = path.resolve(PUBLIC, path.dirname(path.join(PUBLIC, file)), ref); } catch (e) { /* ruta relativa */ }
    let okPath = fs.existsSync(target) && fs.statSync(target).isFile();
    if (!okPath && fs.existsSync(target) && fs.statSync(target).isDirectory()) okPath = fs.existsSync(path.join(target, 'index.html'));
    ok(okPath, `enlace válido en ${file}: ${ref}`);
  }
}
checkLinks('index.html');
checkLinks('explorar/index.html');
for (const s of index.stories) checkLinks(`historias/${s.id}/index.html`);

console.log('');
if (failures) {
  console.error(`Smoke test: ${failures} comprobaciones fallidas.`);
  process.exit(1);
}
console.log('Smoke test: todo correcto.');
