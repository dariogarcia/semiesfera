// Genera los recursos de ejemplo del mundo: piezas del mapa, mapa completo,
// portadas, imágenes de documentos y PDFs. Determinista (mismas semillas,
// mismo resultado). Léelo como plantilla para reemplazarlo por material real.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter, makePdf } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');

const REGION_STYLE = {
  markland: { land: '#3d5a44', land2: '#33503b', coast: '#88b08d' },
  sarn: { land: '#8a7248', land2: '#7c6540', coast: '#c8ab77' },
  northreach: { land: '#54677d', land2: '#4a5c70', coast: '#9fb4c9' },
  'far-east': { land: '#5e4a64', land2: '#524158', coast: '#a68fa9' }
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(str) {
  let h = 1779033703;
  for (const c of String(str)) {
    h = Math.imul(h ^ c.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function blob(cx, cy, r, rng, wobble = 0.22, n = 12, squash = 0.85) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.15;
    const rr = r * (1 - wobble / 2 + rng() * wobble);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
  }
  return d + 'Z';
}

function regionGroup(regionId, place) {
  const rng = mulberry32(seedOf(regionId));
  const { x, y, radius } = place.geometry;
  const c = REGION_STYLE[regionId] || REGION_STYLE.markland;
  const parts = [];
  parts.push(`<path d="${blob(x, y, radius * 0.82, rng, 0.3)}" fill="${c.land}" stroke="${c.coast}" stroke-width="2.5"/>`);
  parts.push(`<path d="${blob(x, y, radius * 0.64, rng, 0.36)}" fill="${c.land2}" opacity="0.6"/>`);
  const nIsl = 2 + Math.floor(rng() * 2);
  for (let k = 0; k < nIsl; k++) {
    const a = rng() * Math.PI * 2;
    const d = radius * (0.9 + rng() * 0.3);
    parts.push(`<path d="${blob(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 7 + rng() * 14, rng, 0.5, 8)}" fill="${c.land}" stroke="${c.coast}" stroke-width="1.5"/>`);
  }
  const nM = 4 + Math.floor(rng() * 4);
  for (let k = 0; k < nM; k++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * radius * 0.5;
    const mx = x + Math.cos(a) * d;
    const my = y + Math.sin(a) * d * 0.8;
    parts.push(`<path d="M ${(mx - 7).toFixed(1)} ${my.toFixed(1)} L ${mx.toFixed(1)} ${(my - 9).toFixed(1)} L ${(mx + 7).toFixed(1)} ${my.toFixed(1)}" fill="none" stroke="${c.coast}" stroke-width="1.4" opacity="0.75"/>`);
  }
  parts.push(`<text x="${x}" y="${y + 5}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="4" fill="${c.coast}" opacity="0.9">${place.name.toUpperCase()}</text>`);
  return `<g data-region="${regionId}">${parts.join('')}</g>`;
}

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w; }
    else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function coverSvg(story, seq) {
  const rng = mulberry32(seedOf(story.id + 'cover'));
  const c = REGION_STYLE[story.reveals[0]?.replace('p-', '')] || REGION_STYLE.markland;
  const W = 300, H = 420;
  const titleLines = wrap(story.title, 16);
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#141f2b"/>`);
  parts.push(`<rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="${c.coast}" stroke-width="1.5" opacity="0.7"/>`);
  parts.push(`<path d="${blob(W / 2, 150, 80, rng, 0.3, 14, 0.9)}" fill="${c.land}" stroke="${c.coast}" stroke-width="2"/>`);
  parts.push(`<path d="${blob(W / 2, 150, 55, rng, 0.36, 12, 0.9)}" fill="${c.land2}" opacity="0.6"/>`);
  let ty = 268;
  for (const line of titleLines) {
    parts.push(`<text x="${W / 2}" y="${ty}" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#e8e0cf">${line}</text>`);
    ty += 28;
  }
  parts.push(`<text x="${W / 2}" y="${ty + 6}" text-anchor="middle" font-family="Georgia, serif" font-size="14" letter-spacing="3" fill="${c.coast}">${story.volume.toUpperCase()}</text>`);
  parts.push(`<text x="26" y="40" font-family="Georgia, serif" font-size="30" fill="${c.coast}" opacity="0.85">${seq}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>\n`;
}

function docSvg(storyId, doc, index) {
  const rng = mulberry32(seedOf(storyId + '#' + index));
  const W = 320, H = 420;
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#d8c8a2"/>`);
  parts.push(`<rect x="8" y="8" width="${W - 16}" height="${H - 16}" fill="none" stroke="#8a7350" stroke-width="1.5"/>`);
  parts.push(`<rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="#8a7350" stroke-width="0.7" opacity="0.7"/>`);
  parts.push(`<text x="24" y="46" font-family="Georgia, serif" font-size="15" letter-spacing="2" fill="#4a3b28">${String(doc.label).toUpperCase()}</text>`);
  parts.push(`<line x1="24" y1="58" x2="${W - 24}" y2="58" stroke="#8a7350" stroke-width="1"/>`);
  let y = 88;
  while (y < H - 60) {
    const gap = rng() < 0.18;
    if (!gap) {
      let x = 24;
      const end = W - 24 - rng() * 60;
      let d = `M ${x} ${y}`;
      while (x < end) {
        const nx = x + 14 + rng() * 22;
        d += ` L ${nx.toFixed(1)} ${(y + (rng() - 0.5) * 3).toFixed(1)}`;
        x = nx;
      }
      parts.push(`<path d="${d}" fill="none" stroke="#5b4a33" stroke-width="1.3" opacity="0.85"/>`);
    }
    y += 24 + (gap ? 8 : 0);
  }
  parts.push(`<circle cx="${W - 52}" cy="${H - 52}" r="17" fill="none" stroke="#8c3b2e" stroke-width="2" opacity="0.8"/>`);
  parts.push(`<circle cx="${W - 52}" cy="${H - 52}" r="12" fill="#8c3b2e" opacity="0.25"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>\n`;
}

function write(rel, content) {
  const dest = path.join(CONTENT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
}

// --- carga del mundo -------------------------------------------------------

const places = JSON.parse(fs.readFileSync(path.join(CONTENT, 'places.json'), 'utf8')).places;
const pieces = JSON.parse(fs.readFileSync(path.join(CONTENT, 'map-pieces.json'), 'utf8')).pieces;
const placeById = new Map(places.map((p) => [p.id, p]));

// mapa: grupo por región (todas, incluidas las no publicadas)
const groupsByRegion = {};
for (const piece of pieces) {
  for (const region of piece.regions || []) {
    if (!groupsByRegion[region] && placeById.has(region)) {
      groupsByRegion[region] = regionGroup(region, placeById.get(region));
    }
  }
}

// piezas
for (const piece of pieces) {
  const inner = (piece.regions || []).map((r) => groupsByRegion[r]).filter(Boolean).join('\n');
  write(
    piece.file,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${piece.width}" height="${piece.height}" viewBox="0 0 ${piece.width} ${piece.height}">\n<g transform="translate(${-piece.x},${-piece.y})">\n${inner}\n</g>\n</svg>\n`
  );
}

// mapa completo (todas las regiones; el build publica solo las publicadas)
write(
  'complete/map.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">\n${Object.values(groupsByRegion).join('\n')}\n</svg>\n`
);

// historias: portadas, documentos y PDFs
const storiesDir = path.join(CONTENT, 'stories');
for (const id of fs.readdirSync(storiesDir).sort()) {
  const dir = path.join(storiesDir, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const { data, body } = splitFrontmatter(fs.readFileSync(path.join(dir, 'story.md'), 'utf8'));
  const story = { id, ...data };
  write(`stories/${id}/cover.svg`, coverSvg(story, story.sequence));
  (story.documents || []).forEach((doc, i) => {
    write(`stories/${id}/docs/${path.basename(doc.image)}`, docSvg(id, doc, i + 1));
  });
  const pdfLines = [
    'Semiesfera — documento de ejemplo',
    '',
    String(story.summary),
    '',
    body.trim().split(/\r?\n/)[0] || ''
  ];
  write(`stories/${id}/story.pdf`, makePdf({ title: story.title, lines: pdfLines }));
}

console.log('Recursos generados en content/ (piezas, mapa completo, portadas, documentos, PDFs).');
