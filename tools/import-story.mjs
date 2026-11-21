// Importa una historia escrita como fuente Pandoc/LaTeX (fenced divs
// {.doc-box} con tcolorbox + \docmeta) y genera su carpeta en
// content/stories/<id>/: story.md, docs/dN.png, cover.svg y story.pdf.
// Requiere xelatex + pdftoppm (render de documentos) y python3 con PIL
// (recorte). Sin ellos, cae en marcadores de posición.
//
// Uso:
//   node tools/import-story.mjs <fuente.md> --id <slug> --volume <texto>
//     [--title "Título"] [--sequence N] [--publish YYYY-MM-DD]
//     [--summary "..."] [--reveals p1,p2] [--place <id>]
//     [--place-map 1=deishe,2=none,10=etaan+kalts-een]   (none = sin lugar asociado)
//     [--label 9=Transcripción] [--pdf <ruta>] [--no-render] [--force]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makePdf } from './lib.mjs';
import {
  splitSource, extractBlockScalar, extractScalar, extractHeaderIncludes,
  braceContent, replaceMacro, removeMacro, extractFirstMacro,
  splitDocBoxes, parseDocmeta, parseYears, plainText, cleanForRender,
  buildPreamble, runXelatex, renderDocPng, materializeInputs
} from './docbox.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');
const RENDERS = path.join(ROOT, 'renders');
const PALETTE = ['#e2946b', '#79b6a9', '#dfc17e', '#a48ec9', '#7fa6c9', '#c9836f', '#93c47d', '#c9c19a'];

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

const VALUE_FLAGS = ['id', 'volume', 'title', 'sequence', 'publish', 'summary', 'reveals', 'place', 'place-map', 'label', 'pdf', 'imgs-dir', 'maps-dir', 'img-place', 'img-year'];
const BOOL_FLAGS = ['no-render', 'force'];

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    if (BOOL_FLAGS.includes(key)) out[key] = true;
    else if (VALUE_FLAGS.includes(key)) {
      if (i + 1 >= argv.length) throw new Error(`La opción --${key} necesita un valor`);
      out[key] = argv[++i];
    } else throw new Error(`Opción desconocida: ${a}`);
  }
  return out;
}

function parsePairs(map, splitter) {
  const out = {};
  if (!map) return out;
  for (const pair of String(map).split(',')) {
    if (!pair.trim()) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) throw new Error(`--${splitter}: se esperaba N=valor, llegó "${pair}"`);
    out[parseInt(pair.slice(0, eq), 10)] = pair.slice(eq + 1).trim();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Imágenes de la narrativa: figuras → marcadores {{iN}}
// ---------------------------------------------------------------------------

// extrae \begin{figure}/wrapfigure y \includegraphics sueltos del texto,
// dejando un marcador {{iN}} en su sitio. Devuelve { text, images }.
function extractNarrativeImages(text, startAt) {
  const images = [];
  let n = startAt;
  const take = (chunk) => {
    const pathM = chunk.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (!pathM || /#/.test(pathM[1])) return '';
    const src = pathM[1].trim();
    const widthM = chunk.match(/width\s*=\s*([\d.]+)\\linewidth/);
    const captionM = chunk.match(/\\caption\*?\s*\{([\s\S]*?)\}\s*(?:\\vspace|\\end|$)/);
    const caption = captionM ? plainText(captionM[1]) : '';
    images.push({ n: ++n, src, width: widthM ? Math.round(parseFloat(widthM[1]) * 100) : null, caption });
    return `{{i${n}}}`;
  };
  let t = text;
  t = t.replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, take);
  t = t.replace(/\\begin\{wrapfigure\}[\s\S]*?\\end\{wrapfigure\}/g, take);
  t = t.replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, (m) => (/#/.test(m) ? m : take(m)));
  return { text: t, images, count: n };
}

const roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n] || String(n);

// ---------------------------------------------------------------------------
// Limpieza de la narrativa (story.md usa un Markdown muy reducido)
// ---------------------------------------------------------------------------

function stripCentering(text) {
  let out = text;
  for (let guard = 0; guard < 50; guard++) {
    const idx = out.indexOf('{\\centering');
    if (idx === -1) return out;
    const b = braceContent(out, idx);
    if (!b) return out;
    out = out.slice(0, idx) + b.content.trim() + out.slice(b.end + 1);
  }
  return out;
}

function cleanNarrative(text) {
  let t = text;
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, '');
  t = t.replace(/\\begin\{wrapfigure\}[\s\S]*?\\end\{wrapfigure\}/g, '');
  t = removeMacro(t, 'timelinefooter');
  t = t.replace(/\\(?:clearpage|newpage|dline|par|noindent)\b/g, '');
  t = stripCentering(t);
  t = replaceMacro(t, 'footnote', (c) => ` (${plainText(c)})`);
  t = replaceMacro(t, 'textbf', (c) => `**${plainText(c)}**`);
  t = replaceMacro(t, 'textit', (c) => `*${plainText(c)}*`);
  t = replaceMacro(t, 'emph', (c) => `*${plainText(c)}*`);
  t = t.replace(/\\\\(\s*\n\s*)?/g, ' ');
  t = t.replace(/\\([%&_#\$])/g, '$1');
  t = t.replace(/\\[a-zA-Z]+\s*/g, '');
  t = t.replace(/[ \t]+$/gm, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
// ---------------------------------------------------------------------------
// Marcadores de posición (SVG)
// ---------------------------------------------------------------------------

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function svgTextLines(lines, x, y, attrs, lineH) {
  return lines.map((l, i) => `<text x="${x}" y="${y + i * lineH}" ${attrs}>${esc(l)}</text>`).join('');
}

function placeholderDocSvg(rec) {
  const fuenteLines = wrapText(rec.fuente, 34);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420">
<rect width="320" height="420" fill="#efe7d3"/>
<rect x="8" y="8" width="304" height="404" fill="none" stroke="#8a7350" stroke-width="1.5"/>
<rect x="14" y="14" width="292" height="392" fill="none" stroke="#8a7350" stroke-width="0.7" opacity="0.7"/>
${svgTextLines(wrapText(rec.label, 18), 26, 60, `font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#3a2f22"`, 26)}
${svgTextLines(fuenteLines, 26, 140, `font-family="Georgia, serif" font-size="13" fill="#6b5c44"`, 18)}
<text x="26" y="380" font-family="Georgia, serif" font-size="13" fill="#8a7350">${esc(rec.yearLabel)}</text>
<text x="294" y="380" text-anchor="end" font-family="Georgia, serif" font-size="10" fill="#8a7350" opacity="0.8">pendiente de render</text>
</svg>
`;
}

function coverSvg(title, volume, sequence) {
  const color = PALETTE[(sequence - 1) % PALETTE.length];
  const titleLines = wrapText(title.toUpperCase(), 18);
  const volLines = wrapText(volume.toUpperCase(), 26);
  const titleStart = 300 - ((titleLines.length - 1) * 24) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
<rect width="300" height="420" fill="#141f2b"/>
<rect x="10" y="10" width="280" height="400" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.7"/>
<path d="M 40 190 L 95 105 L 130 160 L 165 95 L 210 175 L 245 125 L 270 190 Z" fill="${color}" stroke="${color}" stroke-width="1.5" opacity="0.85"/>
<path d="M 40 190 L 270 190 L 270 205 L 40 205 Z" fill="${color}" opacity="0.35"/>
${svgTextLines(titleLines, 150, titleStart, `text-anchor="middle" font-family="Georgia, serif" font-size="21" fill="#e8e0cf"`, 24)}
${svgTextLines(volLines, 150, 345, `text-anchor="middle" font-family="Georgia, serif" font-size="11" letter-spacing="2" fill="${color}"`, 15)}
<text x="26" y="40" font-family="Georgia, serif" font-size="30" fill="${color}" opacity="0.85">${sequence}</text>
</svg>
`;
}

// ---------------------------------------------------------------------------
// story.md
// ---------------------------------------------------------------------------

function yamlScalar(v) {
  const s = String(v);
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s) || /:\s/.test(s) || /\s#/.test(s) || !s.trim()) {
    return JSON.stringify(s);
  }
  return s;
}

function writeStoryMd(story) {
  const docYaml = story.documents.map((d) => `  - image: docs/${d.image}
    alt: ${yamlScalar(d.alt)}
    label: ${yamlScalar(d.label)}
    places:${d.places.length ? `\n${d.places.map((p) => `      - ${p}`).join('\n')}` : ' []'}
    year: ${d.year}${d.yearEnd != null ? `\n    yearEnd: ${d.yearEnd}` : ''}`);
  const fm = `---
title: ${yamlScalar(story.title)}
volume: ${yamlScalar(story.volume)}
publish: ${story.publish}
cover: cover.svg
pdf: story.pdf
summary: ${yamlScalar(story.summary)}
sequence: ${story.sequence}
reveals:
${story.reveals.map((p) => `  - ${p}`).join('\n')}
documents:
${docYaml.join('\n')}
images:
${story.images.map((im) => `  - file: ${im.file}
    alt: ${yamlScalar(im.alt)}${im.caption ? `\n    caption: ${yamlScalar(im.caption)}` : ''}${im.width != null ? `\n    width: ${im.width}` : ''}
    places:${im.places.length ? `\n${im.places.map((p) => `      - ${p}`).join('\n')}` : ' []'}
    year: ${im.year}`).join('\n')}
---

`;
  fs.writeFileSync(path.join(story.dir, 'story.md'), fm + story.body + '\n');
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args._.length) throw new Error('Falta la ruta de la fuente (input/*.md)');
  const srcPath = path.resolve(ROOT, args._[0]);
  if (!fs.existsSync(srcPath)) throw new Error(`No existe ${srcPath}`);
  const src = splitSource(fs.readFileSync(srcPath, 'utf8'));
  src.headerIncludes = extractHeaderIncludes(src.fmLines);

  const segments = splitDocBoxes(src.body);
  const docSegs = segments.filter((s) => s.type === 'doc');
  if (!docSegs.length) throw new Error('La fuente no contiene doc-boxes (::: {.doc-box})');
  // narrativa con marcadores {{dN}} donde estaba cada doc-box y {{iN}} donde
  // estaba cada figura (el build los sustituye por documento/imagen, en su sitio)
  let docN = 0, imgN = 0;
  const parts = [];
  const storyImages = [];
  for (const seg of segments) {
    if (seg.type === 'doc') {
      docN++;
      parts.push(`{{d${docN}}}`);
    } else {
      const ex = extractNarrativeImages(seg.content, imgN);
      imgN = ex.count;
      storyImages.push(...ex.images);
      const t = cleanNarrative(ex.text);
      if (t) parts.push(t);
    }
  }
  const narrative = parts.join('\n\n');

  const titleBlock = extractBlockScalar(src.fmLines, 'title');
  const title = args.title || (titleBlock ? titleBlock.split('\n').find((l) => l.trim() && l.trim() !== '-')?.replace(/\\$/, '').trim() : null) || 'Historia sin título';
  const id = args.id || title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`--id no es un slug válido: "${id}"`);

  // world
  const places = JSON.parse(fs.readFileSync(path.join(CONTENT, 'places.json'), 'utf8')).places;
  const placeIds = new Set(places.map((p) => p.id));
  const pieces = JSON.parse(fs.readFileSync(path.join(CONTENT, 'map-pieces.json'), 'utf8')).pieces;
  const pieceIds = new Set(pieces.map((p) => p.id));
  const reveals = args.reveals ? args.reveals.split(',').map((s) => s.trim()).filter(Boolean) : pieces.map((p) => p.id);
  for (const pid of reveals) if (!pieceIds.has(pid)) throw new Error(`--reveals: pieza desconocida "${pid}"`);

  const placeMap = parsePairs(args['place-map'], 'place-map');
  const labelMap = parsePairs(args.label, 'label');

  // docs
  const seen = {};
  const docs = docSegs.map((seg, i) => {
    const n = i + 1;
    const meta = extractFirstMacro(seg.content, 'docmeta');
    const fields = meta ? parseDocmeta(meta.content) : {};
    const fuente = plainText(fields.fuente) || 'Fuente desconocida';
    const tipo = plainText(fields.tipo);
    const years = parseYears(fields.ano || fields.año);
    if (!years) throw new Error(`Documento ${n}: no pude leer el campo Año (${JSON.stringify(fields.ano || fields.año)})`);
    const base = (labelMap[n] || (tipo || fuente).split(/\s+/)[0]).replace(/[.:,;]+$/, '');
    seen[base] = (seen[base] || 0) + 1;
    const label = seen[base] > 1 ? `${base} ${roman(seen[base])}` : base;
    // lugar del documento: "none" (o "-") = sin lugar asociado (no se dibuja
    // en el mapa); si falta del todo, error — evita mapeos olvidados
    const spec = placeMap[n] ?? (args.place || null);
    let places_ = spec === 'none' || spec === '-' ? [] : spec ? spec.split('+').map((s) => s.trim()) : null;
    if (!places_) throw new Error(`Documento ${n}: falta lugar (--place-map ${n}=... o ${n}=none, o --place)`);
    for (const pid of places_) if (!placeIds.has(pid)) throw new Error(`Documento ${n}: lugar desconocido "${pid}"`);
    const alt0 = `${fuente.replace(/\.+$/, '')}.${tipo ? ` ${tipo.replace(/\.+$/, '')}.` : ''}`;
    const alt = labelMap[n] && tipo ? alt0.replace(tipo.split(/\s+/)[0], labelMap[n]) : alt0;
    return {
      n, label, fuente, tipo, alt, places: places_, ...years,
      yearLabel: fields.ano || fields.año,
      latex: cleanForRender(seg.content)
    };
  });

  // destino
  const storyDir = path.join(CONTENT, 'stories', id);
  if (fs.existsSync(storyDir)) {
    if (!args.force) throw new Error(`Ya existe content/stories/${id} (usa --force para regenerar)`);
    // story.pdf no se borra: puede ser una versión afinada a mano y el import
    // la conserva salvo que se pase --pdf explícito
    for (const f of ['story.md', 'cover.svg']) {
      const p = path.join(storyDir, f);
      if (fs.existsSync(p)) fs.rmSync(p);
    }
    fs.rmSync(path.join(storyDir, 'docs'), { recursive: true, force: true });
    fs.rmSync(path.join(storyDir, 'imgs'), { recursive: true, force: true });
  }
  const docsDir = path.join(storyDir, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  const renderDir = path.join(RENDERS, id);
  fs.mkdirSync(renderDir, { recursive: true });

  const volume = args.volume || 'Historias de Semiesfera';
  const existing = fs.readdirSync(path.join(CONTENT, 'stories')).filter((d) => fs.statSync(path.join(path.join(CONTENT, 'stories'), d)).isDirectory());
  const sequence = args.sequence ? parseInt(args.sequence, 10) : existing.filter((d) => d !== id).length + 1;
  const publish = args.publish || new Date().toISOString().slice(0, 10);
  if (!args.summary) throw new Error('Falta --summary (se usa en la portada y el RSS)');
  const summary = args.summary;

  // documentos
  const preamble = buildPreamble(src, { longPage: true });
  const results = [];
  for (const d of docs) {
    if (args['no-render']) {
      fs.writeFileSync(path.join(docsDir, `d${d.n}.svg`), placeholderDocSvg(d));
      results.push({ n: d.n, label: d.label, year: d.year, out: `docs/d${d.n}.svg`, status: 'marcador' });
      continue;
    }
    const latex = `${preamble}\n\n\\begin{document}\n${d.latex}\n\\end{document}\n`;
    const r = renderDocPng(d.n, latex, renderDir, docsDir);
    if (r === 'render') results.push({ n: d.n, label: d.label, year: d.year, out: `docs/d${d.n}.png`, status: 'render' });
    else {
      fs.writeFileSync(path.join(docsDir, `d${d.n}.svg`), placeholderDocSvg(d));
      results.push({ n: d.n, label: d.label, year: d.year, out: `docs/d${d.n}.svg`, status: `fallback: ${r.error}` });
    }
  }

  // portada
  fs.writeFileSync(path.join(storyDir, 'cover.svg'), coverSvg(title, volume, sequence));

  // pdf
  let pdfStatus = 'generado';
  const pdfOut = path.join(storyDir, 'story.pdf');
  if (args.pdf) {
    fs.copyFileSync(path.resolve(ROOT, args.pdf), pdfOut);
    pdfStatus = `copiado de ${args.pdf}`;
  } else if (fs.existsSync(pdfOut)) {
    // no se recompila un PDF ya presente: puede ser una versión afinada a mano
    // (para reemplazarlo, pasa --pdf ruta/al.pdf o borra el existente)
    pdfStatus = 'conservado (ya existía)';
  } else {
    const pdfPreamble = buildPreamble(src, { longPage: false });
    const body = cleanForRender(src.body, { keepPages: true });
    const titleTex = `{\\centering{\\LARGE\\bfseries ${title}}\\par\\vspace{4pt}{\\small ${volume}}\\par\\vspace{2em}}\n`;
    const tex = `${pdfPreamble}\n\n\\begin{document}\n${titleTex}\n${body}\n\\end{document}\n`;
    fs.writeFileSync(path.join(renderDir, 'story.tex'), materializeInputs(tex, renderDir));
    try {
      const err = runXelatex('story.tex', renderDir);
      if (err) throw err;
      fs.copyFileSync(path.join(renderDir, 'story.pdf'), path.join(storyDir, 'story.pdf'));
    } catch {
      const paras = narrative.split(/\n{2,}/).map((p) => p.replace(/\n/g, ' ').replace(/[*_]/g, '')).filter(Boolean);
      fs.writeFileSync(path.join(storyDir, 'story.pdf'), makePdf({ title, lines: [volume, '', ...paras] }));
      pdfStatus = 'fallback minimal';
    }
  }

  // imágenes de la narrativa: copia al story dir + entradas con metadatos
  // provisionales (lugar y año se deciden editando story.md)
  const imgDirs = [
    path.resolve(ROOT, args['imgs-dir'] || '../../input/imgs'),
    path.resolve(ROOT, args['maps-dir'] || '../../input/map_files')
  ];
  // lugar por defecto de las imágenes: --img-place (admite "none" = sin
  // lugar); si no, el del primer documento; si ese tampoco tiene, []
  const imgPlaceArg = args['img-place'] != null ? args['img-place'] : (docs[0] && docs[0].places[0] != null ? docs[0].places[0] : null);
  const imgPlace = imgPlaceArg === 'none' || imgPlaceArg === '-' ? [] : imgPlaceArg != null ? [imgPlaceArg] : [];
  const imgYear = args['img-year'] != null ? parseInt(args['img-year'], 10) : (docs[0] ? docs[0].year : null);
  const images = storyImages.map((im) => {
    const rel = im.src.replace(/^(\.\.\/)+_Sources\//, '');
    let srcFile = null;
    for (const dir of imgDirs) {
      for (const cand of [path.join(dir, rel), path.join(dir, rel.replace(/^(imgs|Maps)\//, ''))]) {
        if (fs.existsSync(cand)) { srcFile = cand; break; }
      }
      if (srcFile) break;
    }
    if (!srcFile) throw new Error(`Imagen ${im.n}: no encuentro ${rel} (buscado en ${imgDirs.join(', ')})`);
    const outRel = path.join('imgs', rel.replace(/^(imgs|Maps)\//, ''));
    const outFile = path.join(storyDir, outRel);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.copyFileSync(srcFile, outFile);
    return {
      file: outRel.split(path.sep).join('/'),
      alt: im.caption || `Imagen ${im.n} de la historia`,
      caption: im.caption || '',
      width: im.width,
      places: imgPlace,
      year: imgYear
    };
  });

  writeStoryMd({ dir: storyDir, title, volume, publish, summary, sequence, reveals, documents: docs.map((d) => ({ ...d, image: fs.existsSync(path.join(docsDir, `d${d.n}.png`)) ? `d${d.n}.png` : `d${d.n}.svg` })), images, body: narrative });

  console.log(`Importada ${id} (${docs.length} documentos, ${images.length} imágenes, sequence ${sequence}, publish ${publish})`);
  console.log(`  pdf: ${pdfStatus}`);
  for (const r of results) console.log(`  d${r.n}: ${r.status.padEnd(10)} ${r.out}  [${r.label}, ${r.year}]`);
  for (const im of images) console.log(`  ${im.file}  [${im.width ? im.width + '%' : 'ancho natural'}]`);
  console.log('\nSiguientes pasos:');
  console.log('  - revisa content/stories/' + id + '/story.md (labels, alt, summary)');
  console.log('  - npm test');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}
