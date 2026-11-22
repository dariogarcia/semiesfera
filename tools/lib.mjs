// Herramientas compartidas: YAML (subconjunto), frontmatter, Markdown y PDF.
// Sin dependencias externas.

import fs from 'node:fs';

// Paleta cíclica por número de volumen: portadas y tarjetas og comparten
// el color de cada historia.
export const PALETTE = ['#e2946b', '#79b6a9', '#dfc17e', '#a48ec9', '#7fa6c9', '#c9836f', '#93c47d', '#c9c19a'];
export const paletteColor = (sequence) => PALETTE[(sequence - 1) % PALETTE.length];

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripComment(line) {
  if (line.trimStart().startsWith('#')) return '';
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(s) {
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function scalar(v) {
  v = v.trim();
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v === '[]') return []; // secuencia vacía en línea (p. ej. places: [])
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  if (v === 'true' || v === 'false') return v === 'true';
  if (v === 'null' || v === '~' || v === '') return null;
  return v;
}

// Subconjunto de YAML soportado: mapeos, secuencias, secuencias de mapeos,
// escalares (números, booleanos, cadenas con o sin comillas) y comentarios.
// La indentación de los elementos "- " anidados debe ser consistente (+2).
export function parseYaml(text) {
  const lines = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = stripComment(raw).replace(/\s+$/, '');
    if (!line.trim()) continue;
    lines.push({ indent: line.match(/^ */)[0].length, text: line.trim() });
  }
  if (!lines.length) return null;
  let pos = 0;
  const isSeqItem = (t) => t === '-' || t.startsWith('- ');

  function parseNode(indent) {
    if (pos >= lines.length) return null;
    return isSeqItem(lines[pos].text) ? parseSeq(indent) : parseMap(indent);
  }

  function parseMap(indent) {
    const obj = {};
    while (pos < lines.length && lines[pos].indent === indent && !isSeqItem(lines[pos].text)) {
      const m = lines[pos].text.match(/^("[^"]*"|'[^']*'|[^:]+):\s*(.*)$/);
      if (!m) throw new Error(`YAML: línea no válida: "${lines[pos].text}"`);
      const key = unquote(m[1].trim());
      const value = m[2].trim();
      pos++;
      if (value === '') {
        if (pos < lines.length && lines[pos].indent > indent) obj[key] = parseNode(lines[pos].indent);
        else if (pos < lines.length && lines[pos].indent === indent && isSeqItem(lines[pos].text)) obj[key] = parseSeq(indent);
        else obj[key] = null;
      } else {
        obj[key] = scalar(value);
      }
    }
    return obj;
  }

  function parseSeq(indent) {
    const arr = [];
    while (pos < lines.length && lines[pos].indent === indent && isSeqItem(lines[pos].text)) {
      const item = lines[pos].text.replace(/^-\s*/, '');
      if (item === '') {
        pos++;
        if (pos < lines.length && lines[pos].indent > indent) arr.push(parseNode(lines[pos].indent));
        else arr.push(null);
      } else if (/^[^'"]+:(\s|$)/.test(item)) {
        const subIndent = indent + 2;
        lines[pos] = { indent: subIndent, text: item };
        arr.push(parseMap(subIndent));
      } else {
        arr.push(scalar(item));
        pos++;
      }
    }
    return arr;
  }

  const result = parseNode(lines[0].indent);
  if (pos !== lines.length) throw new Error(`YAML: contenido inesperado cerca de "${lines[pos].text}"`);
  return result;
}

export function splitFrontmatter(text) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('Falta el bloque de frontmatter (--- ... ---)');
  return { data: parseYaml(m[1]), body: m[2] };
}

export function renderMarkdown(md) {
  const inline = (s) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  const out = [];
  const lines = String(md).split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = Math.min(h[1].length + 1, 6);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      // cita de diálogo (viene de \dline en la fuente): cada línea > es
      // una réplica, todas juntas en un solo blockquote
      const quotes = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quotes.push(`<p>${inline(lines[i].replace(/^\s*>\s?/, ''))}</p>`);
        i++;
      }
      out.push(`<blockquote>${quotes.join('')}</blockquote>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim()) { para.push(lines[i]); i++; }
    // cierre canónico de las historias (lo emite el importer desde el
    // bloque FIN de la fuente): **FIN** a solas lleva clase propia
    if (para.length === 1 && para[0].trim() === '**FIN**') {
      out.push('<p class="story-fin"><strong>FIN</strong></p>');
      continue;
    }
    out.push(`<p>${para.map(inline).join(' ')}</p>`);
  }
  return out.join('\n');
}

// Dimensiones de una imagen leyendo solo su cabecera (PNG/JPEG/WebP),
// sin dependencias. Devuelve { width, height } o null si no se reconoce.
export function imageSize(file) {
  const buf = fs.readFileSync(file);
  // PNG: firma de 8 bytes + chunk IHDR
  if (buf.length > 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // WebP: RIFF....WEBP + VP8 (con pérdida) / VP8L (sin pérdida) / VP8X (extendido)
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fourcc = buf.toString('ascii', 12, 16);
    if (fourcc === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (fourcc === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (fourcc === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  // JPEG: recorrer segmentos hasta un SOFn
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7) };
      }
      o += 2 + buf.readUInt16BE(o + 2);
    }
  }
  return null;
}

// PDF mínimo de una página, válido, con offsets de xref correctos.
export function makePdf({ title, lines = [] }) {
  const esc = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  const parts = [`BT /F1 20 Tf 56 780 Td (${esc(title)}) Tj ET`];
  lines.forEach((l, idx) => {
    parts.push(`BT /F1 11 Tf 56 ${748 - idx * 18} Td (${esc(l)}) Tj ET`);
  });
  const stream = parts.join('\n');
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
    `<</Length ${Buffer.byteLength(stream, 'utf8')}>>\nstream\n${stream}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return pdf;
}
