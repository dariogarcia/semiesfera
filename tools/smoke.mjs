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
const indexHtml = read('index.html');
ok(indexHtml.includes('explorar/'), 'la portada enlaza a explorar/');
ok(indexHtml.includes('entra en la semiesfera'), 'la portada tiene el botón de entrada');
ok(indexHtml.includes('historias con historias'), 'la portada tiene el título "historias con historias"');
ok((indexHtml.match(/<a\s/g) || []).length === 1, 'el botón central es el único enlace de la portada');
ok(!indexHtml.includes('<a class="story-card"'), 'las tarjetas son informativas, sin enlace');
ok(indexHtml.includes('<details class="landing-legal"><summary>acerca de</summary>'), 'la portada esconde los créditos tras «acerca de»');
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
const TOKEN_RESIDUAL = /\{\d+(?:[.,]\d+)?(?:em|pt)\}|\{center\}|\{>\}|\{gray!|\[\d+pt\]/;
for (const s of index.stories) {
  ok(exists(`historias/${s.id}/index.html`), `página de ${s.id}`);
  ok(exists(`data/${s.id}.json`), `datos de ${s.id}`);
  ok(typeof s.hook === 'string' && s.hook.trim().length > 0, `${s.id} tiene gancho para la tarjeta`);
  ok(typeof s.place === 'string' && s.place.trim().length > 0, `${s.id} tiene lugar para la tarjeta`);
  ok(Number.isInteger(s.minutes) && s.minutes >= 1, `${s.id} tiene tiempo de lectura`);
  ok(indexHtml.includes(`data-story-card="${s.id}"`), `tarjeta de ${s.id} en la portada`);
  const data = JSON.parse(read(`data/${s.id}.json`));
  ok(data.documents.length > 0, `${s.id} tiene documentos`);
  ok(typeof data.bodyHtml === 'string' && data.bodyHtml.length > 0, `${s.id} tiene el cuerpo en HTML`);
  for (const d of data.documents) {
    ok(exists(d.image), `imagen de documento ${d.id}`);
  }
  const storyHtml = read(`historias/${s.id}/index.html`);
  ok(storyHtml.includes(s.title), `la página de ${s.id} tiene el título`);
  ok(!TOKEN_RESIDUAL.test(storyHtml), `${s.id}: sin tokens LaTeX residuales en el cuerpo`);
  ok(storyHtml.includes('class="story-fin"'), `${s.id}: cierre tipográfico del FIN`);
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

// el mapa completo existe y no incluye piezas no publicadas
{
  const completeFile = piecesMeta.complete.file;
  ok(exists(completeFile), `existe el mapa completo (${completeFile})`);
  const allPublished = piecesMeta.pieces.every((p) => revealed.has(p.id));
  if (!allPublished) {
    const complete = read(completeFile);
    for (const p of piecesMeta.pieces) {
      if (revealed.has(p.id)) continue;
      if (p.file.endsWith('.png')) {
        const b64 = fs.readFileSync(path.join(CONTENT, p.file)).toString('base64');
        ok(!complete.includes(b64), `el mapa completo no incluye la pieza no publicada ${p.id}`);
      } else {
        ok(!complete.includes(`data-region="${p.regions[0]}"`), `el mapa completo no incluye la pieza no publicada ${p.id}`);
      }
    }
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
    .filter((h) => !h.startsWith('http') && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('data:'))
    .map((h) => h.split('?')[0]);
  for (const ref of refs) {
    const target = path.resolve(PUBLIC, path.dirname(path.join(PUBLIC, file)), ref);
    let okPath = fs.existsSync(target) && fs.statSync(target).isFile();
    if (!okPath && fs.existsSync(target) && fs.statSync(target).isDirectory()) okPath = fs.existsSync(path.join(target, 'index.html'));
    ok(okPath, `enlace válido en ${file}: ${ref}`);
  }
}
checkLinks('index.html');
checkLinks('explorar/index.html');
checkLinks('404.html');
for (const s of index.stories) checkLinks(`historias/${s.id}/index.html`);

console.log('');
if (failures) {
  console.error(`Smoke test: ${failures} comprobaciones fallidas.`);
  process.exit(1);
}
console.log('Smoke test: todo correcto.');
