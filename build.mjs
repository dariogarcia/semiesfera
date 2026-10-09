// Generador del sitio Semiesfera.
// Node >= 18, sin dependencias. Uso: node build.mjs
// Variables: SEMIESFERA_TODAY (fecha simulada YYYY-MM-DD), SEMIESFERA_URL (URL pública para RSS).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter, renderMarkdown, escapeHtml, parseYaml } from './tools/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const CONTENT = path.join(ROOT, 'content');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'public');

const TODAY = process.env.SEMIESFERA_TODAY || new Date().toISOString().slice(0, 10);
const SITE_URL = (process.env.SEMIESFERA_URL || 'https://dariogarcia.github.io/semiesfera/').replace(/\/?$/, '/');

const problems = [];
const fail = (msg) => problems.push(msg);
const readContent = (rel) => fs.readFileSync(path.join(CONTENT, rel), 'utf8');
const jsonInline = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// ---------------------------------------------------------------------------
// Carga y validación
// ---------------------------------------------------------------------------

const places = JSON.parse(readContent('places.json')).places;
const placeById = new Map();
for (const p of places) {
  if (!p.id || !p.name) fail(`places.json: lugar sin id o nombre (${JSON.stringify(p)})`);
  else if (placeById.has(p.id)) fail(`places.json: id de lugar duplicado "${p.id}"`);
  else if (!p.geometry || !['point', 'circle', 'poly'].includes(p.geometry.type)) fail(`Lugar "${p.id}": la geometría debe ser point, circle o poly`);
  else if (p.geometry.type !== 'poly' && (typeof p.geometry.x !== 'number' || typeof p.geometry.y !== 'number')) fail(`Lugar "${p.id}": faltan x/y`);
  else if (p.geometry.type === 'circle' && !(p.geometry.radius > 0)) fail(`Lugar "${p.id}": radio de círculo no válido`);
  else if (p.geometry.type === 'poly' && !validPoly(p.geometry)) fail(`Lugar "${p.id}": geometría poly no válida (contours con puntos [x,y] y cx/cy)`);
  else placeById.set(p.id, p);
}
for (const p of places) {
  if (p.parent && !placeById.has(p.parent)) fail(`Lugar "${p.id}": parent desconocido "${p.parent}"`);
}

const mapData = JSON.parse(readContent('map-pieces.json'));
const pieceById = new Map();
for (const piece of mapData.pieces) {
  if (!piece.id || !piece.file) fail(`map-pieces.json: pieza sin id o file (${JSON.stringify(piece)})`);
  else if (pieceById.has(piece.id)) fail(`map-pieces.json: id de pieza duplicado "${piece.id}"`);
  else if (![piece.x, piece.y, piece.width, piece.height].every((n) => typeof n === 'number' && n >= 0)) fail(`Pieza "${piece.id}": x/y/width/height deben ser números`);
  else if (!fs.existsSync(path.join(CONTENT, piece.file))) fail(`Pieza "${piece.id}": no existe el archivo ${piece.file}`);
  else pieceById.set(piece.id, piece);
}

function validPoly(geometry) {
  if (!Array.isArray(geometry.contours) || !geometry.contours.length) return false;
  if (typeof geometry.cx !== 'number' || typeof geometry.cy !== 'number') return false;
  return geometry.contours.every((c) =>
    Array.isArray(c) && c.length >= 3 &&
    c.every((pt) => Array.isArray(pt) && pt.length === 2 && pt.every((n) => typeof n === 'number')))
}

const eras = (() => {
  try {
    const data = parseYaml(readContent('eras.yaml'));
    return Array.isArray(data?.eras) ? data.eras : [];
  } catch (e) {
    fail(`eras.yaml: ${e.message}`);
    return [];
  }
})();
for (const era of eras) {
  if (!era.name || typeof era.from !== 'number' || typeof era.to !== 'number' || era.from >= era.to) {
    fail(`eras.yaml: era no válida (${JSON.stringify(era)}): se necesita name, from y to (from < to)`);
  }
}

const storiesDir = path.join(CONTENT, 'stories');
const stories = [];
for (const id of fs.readdirSync(storiesDir).sort()) {
  const dir = path.join(storiesDir, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const file = path.join(dir, 'story.md');
  if (!fs.existsSync(file)) { fail(`stories/${id}: falta story.md`); continue; }
  let parsed;
  try {
    parsed = splitFrontmatter(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`stories/${id}: ${e.message}`);
    continue;
  }
  const s = { id, ...parsed.data, body: parsed.body };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail(`stories/${id}: el id debe ser un slug (minúsculas, números y guiones)`);
  for (const field of ['title', 'volume', 'summary']) {
    if (typeof s[field] !== 'string' || !s[field].trim()) fail(`stories/${id}: falta el campo "${field}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.publish))) fail(`stories/${id}: "publish" debe ser una fecha YYYY-MM-DD`);
  if (!Number.isInteger(s.sequence)) fail(`stories/${id}: "sequence" debe ser un entero`);
  for (const field of ['cover', 'pdf']) {
    if (typeof s[field] !== 'string' || !fs.existsSync(path.join(dir, s[field]))) fail(`stories/${id}: no existe el archivo "${field}" (${s[field]})`);
  }
  if (!Array.isArray(s.reveals)) fail(`stories/${id}: "reveals" debe ser una lista`);
  else for (const pid of s.reveals) if (!pieceById.has(pid)) fail(`stories/${id}: pieza desconocida "${pid}" en reveals`);
  if (!Array.isArray(s.documents) || !s.documents.length) fail(`stories/${id}: "documents" debe ser una lista no vacía`);
  else s.documents.forEach((d, i) => {
    const where = `stories/${id}, documento ${i + 1}`;
    for (const field of ['image', 'alt', 'label']) {
      if (typeof d[field] !== 'string' || !d[field].trim()) fail(`${where}: falta "${field}"`);
    }
    if (typeof d.image === 'string' && !fs.existsSync(path.join(dir, d.image))) fail(`${where}: no existe la imagen ${d.image}`);
    if (!Array.isArray(d.places) || !d.places.length) fail(`${where}: "places" debe ser una lista no vacía`);
    else for (const pid of d.places) if (!placeById.has(pid)) fail(`${where}: lugar desconocido "${pid}"`);
    if (typeof d.year !== 'number' || !Number.isInteger(d.year)) fail(`${where}: "year" debe ser un entero`);
    if (d.yearEnd != null && (typeof d.yearEnd !== 'number' || d.yearEnd < d.year)) fail(`${where}: "yearEnd" debe ser >= year`);
  });
  if (s.images != null) {
    if (!Array.isArray(s.images)) fail(`stories/${id}: "images" debe ser una lista`);
    else s.images.forEach((im, i) => {
      const where = `stories/${id}, imagen ${i + 1}`;
      if (typeof im.file !== 'string' || !fs.existsSync(path.join(dir, im.file))) fail(`${where}: no existe el archivo ${im.file}`);
      if (typeof im.alt !== 'string' || !im.alt.trim()) fail(`${where}: falta "alt"`);
      if (im.caption != null && typeof im.caption !== 'string') fail(`${where}: "caption" debe ser texto`);
      if (im.width != null && (typeof im.width !== 'number' || im.width < 1 || im.width > 100)) fail(`${where}: "width" debe ser un porcentaje 1-100`);
      if (!Array.isArray(im.places) || !im.places.length) fail(`${where}: "places" debe ser una lista no vacía`);
      else for (const pid of im.places) if (!placeById.has(pid)) fail(`${where}: lugar desconocido "${pid}"`);
      if (typeof im.year !== 'number' || !Number.isInteger(im.year)) fail(`${where}: "year" debe ser un entero`);
      if (im.yearEnd != null && (typeof im.yearEnd !== 'number' || im.yearEnd < im.year)) fail(`${where}: "yearEnd" debe ser >= year`);
    });
  }
  stories.push(s);
}

// sequence: único, desde 1, sin huecos
{
  const seqs = stories.map((s) => s.sequence).sort((a, b) => a - b);
  seqs.forEach((q, i) => {
    if (q !== i + 1) {
      fail(`Los números de sequence deben ser únicos y consecutivos desde 1 (el valor ${i + 1} no está; hay ${q}).`);
    }
  });
}

// cada lugar que usa una historia (incluidos sus ancestros) debe estar
// dentro de una pieza que esa misma historia revela
function insidePiece(geometry, piece) {
  if (geometry.type === 'point') {
    return geometry.x >= piece.x && geometry.x <= piece.x + piece.width &&
      geometry.y >= piece.y && geometry.y <= piece.y + piece.height;
  }
  if (geometry.type === 'poly') {
    return geometry.contours.flat().every(([px, py]) =>
      px >= piece.x && px <= piece.x + piece.width &&
      py >= piece.y && py <= piece.y + piece.height);
  }
  return geometry.x - geometry.radius >= piece.x && geometry.x + geometry.radius <= piece.x + piece.width &&
    geometry.y - geometry.radius >= piece.y && geometry.y + geometry.radius <= piece.y + piece.height;
}
for (const s of stories) {
  const used = new Set();
  for (const d of [...s.documents, ...(s.images || [])]) {
    for (const pid of d.places) {
      let cur = placeById.get(pid);
      while (cur) {
        used.add(cur.id);
        cur = cur.parent ? placeById.get(cur.parent) : null;
      }
    }
  }
  const revealed = s.reveals.map((pid) => pieceById.get(pid)).filter(Boolean);
  for (const pid of used) {
    const place = placeById.get(pid);
    if (!revealed.some((piece) => insidePiece(place.geometry, piece))) {
      // no es un error: un documento puede venir de un lugar que esta
      // historia no revela (p. ej. una publicación extranjera); aparecerá
      // sobre territorio atenuado, como adelanto
      console.warn(`avisos: stories/${s.id}: el lugar "${pid}" está fuera de las piezas que esta historia revela (se mostrará atenuado).`);
    }
  }
}

if (problems.length) {
  console.error(`\nEl build falló con ${problems.length} error(es):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Filtro de publicación y derivaciones
// ---------------------------------------------------------------------------

const published = stories
  .filter((s) => String(s.publish) <= TODAY)
  .sort((a, b) => a.sequence - b.sequence);

const publishedPieces = new Map();
for (const s of published) for (const pid of s.reveals) publishedPieces.set(pid, pieceById.get(pid));

function storyRecord(s) {
  const items = [...s.documents, ...(s.images || [])];
  const placeIds = new Set();
  for (const d of items) {
    for (const pid of d.places) {
      let cur = placeById.get(pid);
      while (cur) {
        placeIds.add(cur.id);
        cur = cur.parent ? placeById.get(cur.parent) : null;
      }
    }
  }
  const docs = s.documents.map((d, i) => ({
    id: `${s.id}-${i + 1}`,
    order: i + 1,
    image: `stories/${s.id}/${d.image}`,
    alt: d.alt,
    label: d.label,
    places: d.places,
    year: d.year,
    yearEnd: d.yearEnd ?? null,
    story: s.id,
    storyTitle: s.title,
    sequence: s.sequence
  }));
  // las imágenes de la narrativa son documentos visuales: aparecen en el
  // panel, la línea de tiempo y el lector igual que los documentos
  const imgs = (s.images || []).map((im, i) => ({
    id: `${s.id}-i${i + 1}`,
    order: 0,
    kind: 'image',
    image: `stories/${s.id}/${im.file}`,
    alt: im.alt,
    caption: im.caption ?? null,
    label: `Imagen ${i + 1}`,
    places: im.places,
    year: im.year,
    yearEnd: im.yearEnd ?? null,
    width: im.width ?? null,
    story: s.id,
    storyTitle: s.title,
    sequence: s.sequence
  }));
  // orden de lectura: posición de cada marcador {{dN}}/{{iN}} en el cuerpo;
  // los no referenciados van al final en su orden natural
  const orderMap = new Map();
  let seqN = 0;
  const markerRe = /\{\{([di])(\d+)\}\}/g;
  let mm;
  while ((mm = markerRe.exec(s.body))) {
    if (!orderMap.has(mm[1] + mm[2])) orderMap.set(mm[1] + mm[2], ++seqN);
  }
  docs.forEach((d, i) => { if (!orderMap.has(`d${i + 1}`)) orderMap.set(`d${i + 1}`, ++seqN); });
  imgs.forEach((im, i) => { if (!orderMap.has(`i${i + 1}`)) orderMap.set(`i${i + 1}`, ++seqN); });
  docs.forEach((d, i) => { d.order = orderMap.get(`d${i + 1}`); });
  imgs.forEach((im, i) => { im.order = orderMap.get(`i${i + 1}`); });
  const all = docs.concat(imgs);
  const years = all.flatMap((d) => [d.year, d.yearEnd ?? d.year]);
  // documentos e imágenes en su sitio del texto; el src del <img> lo resuelve
  // el cliente (data-doc-src, relativo a la raíz del sitio)
  const bodyHtml = renderMarkdown(s.body).replace(/<p>\{\{([di])(\d+)\}\}<\/p>/g, (_, t, n) => {
    const d = t === 'd' ? docs[Number(n) - 1] : imgs[Number(n) - 1];
    if (!d) fail(`stories/${s.id}: el cuerpo referencia {{${t}${n}}} pero solo hay ${docs.length} documentos y ${imgs.length} imágenes`);
    const style = d.width ? ` style="max-width:${d.width}%"` : '';
    return `<figure class="doc${t === 'i' ? ' image' : ''}" data-doc-id="${d.id}" data-doc-src="${d.image}"${style}><img alt="${escapeHtml(d.alt)}" loading="lazy"><figcaption><span class="doc-label">${escapeHtml(d.label)}</span><span class="doc-meta" data-doc-meta hidden></span>${d.caption ? `<span class="doc-caption">${escapeHtml(d.caption)}</span>` : ''}</figcaption></figure>`;
  });
  const storyEras = eras.filter((era) =>
    all.some((d) => d.year <= era.to && (d.yearEnd ?? d.year) >= era.from)
  );
  return {
    id: s.id,
    title: s.title,
    volume: s.volume,
    sequence: s.sequence,
    summary: s.summary,
    cover: `stories/${s.id}/${s.cover}`,
    pdf: `stories/${s.id}/${s.pdf}`,
    bodyHtml,
    reveals: s.reveals,
    pieces: s.reveals.map((pid) => {
      const p = pieceById.get(pid);
      return { id: p.id, file: p.file, x: p.x, y: p.y, width: p.width, height: p.height };
    }),
    places: [...placeIds].map((pid) => {
      const p = placeById.get(pid);
      return { id: p.id, name: p.name, parent: p.parent ?? null, geometry: p.geometry };
    }),
    documents: all,
    span: { from: Math.min(...years), to: Math.max(...years) },
    eras: storyEras
  };
}

const records = new Map(published.map((s) => [s.id, storyRecord(s)]));
const indexData = {
  mapSize: mapData.size,
  totalPieces: mapData.pieces.length,
  complete: { file: mapData.complete.file, width: mapData.size.width, height: mapData.size.height },
  stories: published.map((s) => ({
    id: s.id, title: s.title, volume: s.volume, sequence: s.sequence,
    summary: s.summary, cover: `stories/${s.id}/${s.cover}`,
    // lo mínimo de cada documento para validar y abrir enlaces ?doc=
    // de historias abiertas sin cargar antes sus datos
    documents: records.get(s.id).documents.map((d) => ({ id: d.id, story: d.story }))
  }))
};

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

function layout({ prefix, title, desc, main, script = null, inlineIndex = true }) {
  const p = prefix;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="stylesheet" href="${p}assets/site.css">
<link rel="alternate" type="application/rss+xml" title="Semiesfera" href="${p}rss.xml">
<script>document.documentElement.classList.add('js');</script>
<script>window.SEMI_BASE=${jsonInline(p)};${inlineIndex ? `window.SEMI_INDEX=${jsonInline(indexData)};` : ''}</script>
</head>
<body>
${main}
<script src="${p}assets/core.js"></script>
${script ? `<script src="${p}assets/${script}.js"></script>` : ''}
</body>
</html>`;
}

// --- portada ------------------------------------------------------------------

function landingMain() {
  return `<main class="landing">
  <div class="landing-inner">
    <p class="landing-kicker">Semiesfera</p>
    <h1>Un mundo que se revela al leer</h1>
    <p class="landing-lead">Semiesfera es un ciclo de historias sobre un mundo que empieza sin mapa. Cada relato añade una pieza al mapa, lugares a la geografía y fechas a la línea de tiempo. Nada se enseña antes de tiempo: el mundo existe en la medida en que lo has leído.</p>
    <ol class="landing-steps">
      <li>
        <h2>Lee en orden</h2>
        <p>Las historias se abren de una en una. Al principio solo la primera está disponible; el resto espera su turno.</p>
      </li>
      <li>
        <h2>Marca lo leído</h2>
        <p>Cuando terminas una historia la marcas como leída, y el mapa y la línea de tiempo crecen con lo que esa historia revela.</p>
      </li>
      <li>
        <h2>Explora</h2>
        <p>Navega el mapa y el tiempo a tu aire. Cada documento enlaza su lugar y su fecha, y cada lugar recuerda sus documentos.</p>
      </li>
    </ol>
    <p class="landing-cta"><a class="landing-enter" href="explorar/">Entrar</a></p>
    <p class="landing-foot">Tu progreso se guarda en este navegador, sin cuentas ni servidores. <button type="button" class="btn ghost" data-reset-progress>Reiniciar mi progreso</button></p>
  </div>
</main>`;
}

// --- página de historia -----------------------------------------------------

function storyMain(s, rec) {
  const docFigure = (d) => `<figure class="doc${d.kind === 'image' ? ' image' : ''}" data-doc-id="${d.id}"${d.width ? ` style="max-width:${d.width}%"` : ''}>
        <img src="../../${d.image}" alt="${escapeHtml(d.alt)}" loading="lazy">
        <figcaption>
          <span class="doc-label">${escapeHtml(d.label)}</span>
          <span class="doc-meta" data-doc-meta hidden></span>${d.kind === 'image' && d.caption ? `\n          <span class="doc-caption">${escapeHtml(d.caption)}</span>` : ''}
        </figcaption>
      </figure>`;

  // los documentos e imágenes se muestran donde estaban en el texto
  // (marcadores {{dN}}/{{iN}}); los que no tengan marcador quedan en la lista final
  const byId = new Map(rec.documents.map((d) => [d.id, d]));
  const placed = new Set();
  let bodyHtml = renderMarkdown(s.body);
  bodyHtml = bodyHtml.replace(/<p>\{\{([di])(\d+)\}\}<\/p>/g, (_, t, n) => {
    const d = byId.get(t === 'd' ? `${s.id}-${n}` : `${s.id}-i${n}`);
    if (!d) fail(`stories/${s.id}: el cuerpo referencia {{${t}${n}}} pero no existe ese elemento`);
    placed.add(d.id);
    return docFigure(d);
  });
  const leftovers = rec.documents.filter((d) => !placed.has(d.id));
  const docsSection = leftovers.length ? `
    <section class="story-docs">
      <h2>Documentos</h2>
      <ol class="doc-list">
${leftovers.map(docFigure).join('\n')}
      </ol>
    </section>` : '';

  const pageData = {
    id: s.id,
    placeNames: Object.fromEntries(rec.places.map((p) => [p.id, p.name])),
    docs: rec.documents.map((d) => ({
      id: d.id, places: d.places, year: d.year, yearEnd: d.yearEnd
    }))
  };

  return `<main class="wrap story" data-story-id="${s.id}">
  <div class="locked-notice" data-locked-notice hidden>
    <h2>Esta historia llega más tarde</h2>
    <p>Todavía no has leído lo que viene antes. El mundo se revela en orden, una historia cada vez.</p>
    <p><a class="btn" data-next-link href="#">Leer la historia que toca ahora</a></p>
  </div>
  <div class="story-content" data-story-content>
    <header class="story-head">
      <p class="volume">${escapeHtml(s.volume)}</p>
      <h1>${escapeHtml(s.title)}</h1>
      <div class="story-head-grid">
        <img class="cover" src="../../stories/${s.id}/${s.cover}" alt="Portada de ${escapeHtml(s.title)}">
        <div class="story-head-info">
          <p class="summary">${escapeHtml(s.summary)}</p>
          <div class="entry-actions">
            <a class="btn" href="../../stories/${s.id}/${s.pdf}" download>Descargar PDF</a>
            <button class="btn primary" type="button" data-mark-read data-id="${s.id}">Marcar como leída</button>
          </div>
        </div>
      </div>
    </header>
    <div class="story-body markdown">
${bodyHtml}
    </div>${docsSection}
    <section class="story-rewards" data-rewards hidden>
      <h2>Lo que revela esta historia</h2>
      <div class="minimap-frame"><div class="minimap-world" data-minimap></div></div>
      <div class="minitimeline" data-minitimeline aria-label="Mini línea de tiempo de la historia"></div>
      <p class="reward-hint"><a href="../../explorar/">Explorar el mapa completo</a></p>
    </section>
  </div>
</main>
<script>window.SEMI_PAGE=${jsonInline(pageData)};</script>`;
}

// --- explorar ---------------------------------------------------------------

const exploreMain = `<main class="explore" data-explore>
  <section class="map-view" aria-label="Mapa del mundo">
    <div class="map-viewport" data-map-viewport tabindex="0">
      <div class="map-world" data-map-world></div>
    </div>
    <div class="map-hint" data-map-hint hidden>
      <h2>Aún no hay mapa</h2>
      <p>El mundo empieza sin mapa. Lee la primera historia para empezar a dibujarlo.</p>
    </div>
    <div class="map-controls">
      <button class="icon-btn" type="button" data-zoom-in aria-label="Acercar">+</button>
      <button class="icon-btn" type="button" data-zoom-out aria-label="Alejar">−</button>
      <button class="icon-btn" type="button" data-zoom-fit aria-label="Ajustar">⤢</button>
    </div>
  </section>
  <section class="timeline-view" aria-label="Línea de tiempo">
    <div class="tl-head">
      <span class="tl-title">Línea de tiempo</span>
      <span class="tl-range-chip" data-range-chip hidden></span>
    </div>
    <div class="tl-scroll"><svg class="tl-svg" data-tl-svg viewBox="0 0 1000 150" aria-label="Documentos en el tiempo"></svg></div>
    <div class="tl-empty" data-tl-empty hidden>La línea de tiempo se llenará con los documentos de las historias que leas.</div>
    <div class="tl-hint">Arrastra sobre la línea para acotar un periodo · rueda o pellizco para zoom</div>
  </section>
  <aside class="stories-panel" aria-label="Historias">
    <div class="sp-head">
      <h2>Historias</h2>
      <span class="sp-count" data-sp-count></span>
      <button class="icon-btn panel-toggle" type="button" data-toggle-panel="stories" aria-label="Ocultar panel de historias" title="Ocultar">⟨</button>
    </div>
    <div class="sp-body">
      <ol class="sp-list" data-sp-list></ol>
    </div>
    <div class="sp-foot">
      <button type="button" class="btn ghost" data-reset-progress>Reiniciar mi progreso</button>
    </div>
  </aside>
  <aside class="docs-panel" aria-label="Documentos">
    <div class="dp-head">
      <h2>Documentos</h2>
      <span class="dp-count" data-dp-count></span>
      <button class="icon-btn panel-toggle" type="button" data-toggle-panel="docs" aria-label="Ocultar panel de documentos" title="Ocultar">⟩</button>
    </div>
    <div class="dp-filters" data-dp-filters hidden></div>
    <div class="dp-body" data-dp-body>
      <ol class="dp-list" data-dp-list></ol>
      <p class="dp-none" data-dp-none>Los documentos de las historias que marques como leídas aparecerán aquí, en orden cronológico.</p>
    </div>
  </aside>
  <button class="panel-tab left" type="button" data-show-panel="stories" hidden>Historias</button>
  <button class="panel-tab right" type="button" data-show-panel="docs" hidden>Documentos</button>
</main>`;

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

fs.rmSync(OUT, { recursive: true, force: true });
const writeOut = (rel, content) => {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
};
const copyDir = (from, to) => {
  fs.cpSync(from, to, { recursive: true });
};

copyDir(ASSETS, path.join(OUT, 'assets'));

writeOut('index.html', layout({
  prefix: '',
  title: 'Semiesfera — un mundo que se revela al leer',
  desc: 'Un ciclo de historias sobre un mundo que empieza sin mapa y se dibuja al leer. Historias, mapa y línea de tiempo.',
  main: landingMain(),
  script: null,
  inlineIndex: false
}));

writeOut('explorar/index.html', layout({
  prefix: '../',
  title: 'Explorar — Semiesfera',
  desc: 'Mapa y línea de tiempo del mundo de Semiesfera, con lo que has desbloqueado leyendo.',
  main: exploreMain,
  script: 'explore'
}));

for (const s of published) {
  const rec = records.get(s.id);
  writeOut(`historias/${s.id}/index.html`, layout({
    prefix: '../../',
    title: `${s.title} — Semiesfera`,
    desc: s.summary,
    main: storyMain(s, rec),
    script: 'story'
  }));
  for (const f of fs.readdirSync(path.join(CONTENT, 'stories', s.id))) {
    if (f === 'story.md') continue;
    copyDir(path.join(CONTENT, 'stories', s.id, f), path.join(OUT, 'stories', s.id, f));
  }
}

writeOut('data/index.json', JSON.stringify(indexData));
for (const rec of records.values()) writeOut(`data/${rec.id}.json`, JSON.stringify(rec));

for (const piece of publishedPieces.values()) {
  copyDir(path.join(CONTENT, piece.file), path.join(OUT, piece.file));
}

// mapa completo: si existe el editado a mano y todas las piezas están
// publicadas, se usa; si no, se compone solo con las piezas publicadas
const allPublished = mapData.pieces.every((p) => publishedPieces.has(p.id));
const authoredComplete = path.join(CONTENT, mapData.complete.file);
if (allPublished && fs.existsSync(authoredComplete)) {
  copyDir(authoredComplete, path.join(OUT, mapData.complete.file));
} else {
  const toEmbed = (p) => {
    const file = path.join(CONTENT, p.file);
    if (p.file.endsWith('.png')) {
      const b64 = fs.readFileSync(file).toString('base64');
      return `<image x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" href="data:image/png;base64,${b64}"/>`;
    }
    const svg = fs.readFileSync(file, 'utf8');
    const body = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    return `<svg x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" viewBox="0 0 ${p.width} ${p.height}">${body}</svg>`;
  };
  const inner = [...publishedPieces.values()].map(toEmbed).join('\n');
  writeOut(mapData.complete.file,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${mapData.size.width}" height="${mapData.size.height}" viewBox="0 0 ${mapData.size.width} ${mapData.size.height}">\n${inner}\n</svg>\n`);
}

// RSS
const rfc822 = (dateStr) => new Date(`${dateStr}T12:00:00Z`).toUTCString();
writeOut('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Semiesfera</title>
<link>${SITE_URL}</link>
<description>Un mundo que empieza sin mapa y se dibuja al leer.</description>
<language>es</language>
${published.map((s) => `  <item>
    <title>${escapeHtml(s.title)}</title>
    <link>${SITE_URL}historias/${s.id}/</link>
    <guid>${SITE_URL}historias/${s.id}/</guid>
    <pubDate>${rfc822(s.publish)}</pubDate>
    <description>${escapeHtml(s.summary)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`);

console.log(`Build correcto (${TODAY}):`);
console.log(`  historias publicadas: ${published.length} de ${stories.length}`);
console.log(`  piezas del mapa:      ${publishedPieces.size} de ${mapData.pieces.length}`);
console.log(`  salida:               public/`);
