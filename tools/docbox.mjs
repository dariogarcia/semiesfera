// Maquinaria compartida para renderizar documentos LaTeX (doc-boxes):
// parsing del fuente Pandoc, limpieza y render xelatex -> PNG.
// La usan tools/import-story.mjs (importación completa) y
// tools/render-doc.mjs (re-render de un documento suelto).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Frontmatter Pandoc (subconjunto: escalares, bloques | y header-includes)
// ---------------------------------------------------------------------------

export function splitSource(text) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('La fuente no empieza con frontmatter (--- ... ---)');
  return { fmLines: m[1].split(/\r?\n/), body: m[2] };
}

export function extractBlockScalar(fmLines, key) {
  const start = fmLines.findIndex((l) => new RegExp(`^${key}:\\s*\\|\\s*$`).test(l));
  if (start === -1) return null;
  const raw = [];
  for (let i = start + 1; i < fmLines.length; i++) {
    const l = fmLines[i];
    if (/^[A-Za-z_-][A-Za-z0-9_-]*:/.test(l)) break;
    raw.push(l);
  }
  while (raw.length && !raw[0].trim()) raw.shift();
  while (raw.length && !raw.at(-1).trim()) raw.pop();
  if (!raw.length) return null;
  const ws = raw[0].match(/^\s*/)[0];
  return raw.map((l) => (l.startsWith(ws) ? l.slice(ws.length) : l.replace(/^\s/, ''))).join('\n');
}

export function extractScalar(fmLines, key) {
  const line = fmLines.find((l) => new RegExp(`^${key}:\\s*.+$`).test(l));
  if (!line) return null;
  const v = line.replace(new RegExp(`^${key}:\\s*`), '').trim();
  return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v;
}

export function extractHeaderIncludes(fmLines) {
  const start = fmLines.findIndex((l) => /^header-includes:\s*$/.test(l));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < fmLines.length; i++) {
    const l = fmLines[i];
    if (/^[A-Za-z_-][A-Za-z0-9_-]*:/.test(l)) break;
    const item = l.match(/^ *- (.*)$/);
    if (item) {
      if (item[1].trim() !== '|') out.push(item[1]);
      continue;
    }
    if (/^ *-\s*$/.test(l)) continue;
    out.push(l.replace(/^ {2}/, ''));
  }
  return out.filter((l) => l.trim() !== '');
}

// ---------------------------------------------------------------------------
// LaTeX: emparejado de llaves y macros
// ---------------------------------------------------------------------------

export function braceContent(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { content: text.slice(openIdx + 1, i), end: i };
    }
  }
  return null;
}

export function replaceMacro(text, name, fn) {
  let out = text;
  for (let guard = 0; guard < 200; guard++) {
    const re = new RegExp(`\\\\${name}\\s*\\{`);
    const m = re.exec(out);
    if (!m) return out;
    const b = braceContent(out, m.index + m[0].length - 1);
    if (!b) return out;
    out = out.slice(0, m.index) + fn(b.content) + out.slice(b.end + 1);
  }
  return out;
}

export const removeMacro = (text, name) => replaceMacro(text, name, () => '');

export function extractFirstMacro(text, name) {
  const re = new RegExp(`\\\\${name}\\s*\\{`);
  const m = re.exec(text);
  if (!m) return null;
  const b = braceContent(text, m.index + m[0].length - 1);
  return b ? { start: m.index, end: b.end + 1, content: b.content } : null;
}

// ---------------------------------------------------------------------------
// Split del cuerpo: narrativa + doc-boxes
// ---------------------------------------------------------------------------

export function splitDocBoxes(body) {
  const segs = [];
  let cur = [];
  let inDoc = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^:::\s*\{\.doc-box\}\s*$/.test(line)) {
      if (cur.join('\n').trim()) segs.push({ type: 'narrative', content: cur.join('\n') });
      cur = [];
      inDoc = true;
      continue;
    }
    if (inDoc && /^:::\s*$/.test(line)) {
      segs.push({ type: 'doc', content: cur.join('\n') });
      cur = [];
      inDoc = false;
      continue;
    }
    cur.push(line);
  }
  if (cur.join('\n').trim()) segs.push({ type: 'narrative', content: cur.join('\n') });
  return segs;
}

// ---------------------------------------------------------------------------
// docmeta y texto plano
// ---------------------------------------------------------------------------

export function parseDocmeta(content) {
  const fields = {};
  for (const raw of content.split(/\\\\/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const m = line.match(/^\\(?:textbf|textit|textsc|textrm)\s*\{\s*(Fuente|Tipo|A[ñn]o|Contexto)\s*:\s*\}\s*(.*)$/i);
    if (m) fields[m[1].toLowerCase().replace('ñ', 'n')] = m[2].trim();
  }
  return fields;
}

export function parseYears(s) {
  if (!s) return null;
  const m = String(s).replace(/\s+/g, ' ').match(/^(-?\d+)\s*(?:a\s+(-?\d+))?\s*GC\b/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), yearEnd: m[2] ? parseInt(m[2], 10) : null };
}

export function plainText(s) {
  return String(s || '')
    .replace(/\\\\/g, ' ')
    .replace(/\\textbf\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\textit\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\emph\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\texttt\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\([%&_#\$])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Limpieza para render
// ---------------------------------------------------------------------------

// stripAdjustwidth: quita los \begin{adjustwidth}{..}{..}/\end{adjustwidth}
// (sangrías pensadas para la maquetación del PDF completo; en un render
// suelto suelen dejar márgenes desiguales). adjustwidth: 'small' los reduce
// a 0.5cm/0.5cm en vez de quitarlos.
export function cleanForRender(text, { keepPages = false, adjustwidth = 'keep' } = {}) {
  let t = text;
  t = t.replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, '');
  t = t.replace(/\\begin\{wrapfigure\}[\s\S]*?\\end\{wrapfigure\}/g, '');
  t = removeMacro(t, 'timelinefooter');
  if (!keepPages) t = t.replace(/\\(?:clearpage|newpage)\b/g, '');
  if (adjustwidth === 'strip') {
    t = t.replace(/\\begin\{adjustwidth\}\{[^}]*\}\{[^}]*\}\s*\n?/g, '');
    t = t.replace(/\\end\{adjustwidth\}\s*\n?/g, '');
  } else if (adjustwidth === 'small') {
    t = t.replace(/\\begin\{adjustwidth\}\{[^}]*\}\{[^}]*\}/g, '\\begin{adjustwidth}{0.5cm}{0.5cm}');
  }
  return t.trim();
}

// ---------------------------------------------------------------------------
// Render: xelatex -> pdftoppm -> (opcional) recorte/unión con PIL
// ---------------------------------------------------------------------------

export const CROP_SCRIPT = `
import sys, re, glob
from PIL import Image, ImageChops
files = [f for f in glob.glob(sys.argv[1]) if re.search(r'-\\d+\\.png$', f)]
files.sort(key=lambda f: int(re.search(r'-(\\d+)\\.png$', f).group(1)))
imgs = [Image.open(f).convert('RGB') for f in files]
cropped = []
for im in imgs:
    bg = Image.new('RGB', im.size, (255, 255, 255))
    diff = ImageChops.difference(im, bg).convert('L')
    bbox = diff.point(lambda p: 255 if p > 10 else 0).getbbox()
    if bbox:
        pad = 14
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad))
        cropped.append(im.crop(bbox))
    else:
        cropped.append(im)
gap = 24
w = max(c.width for c in cropped)
h = sum(c.height for c in cropped) + gap * (len(cropped) - 1)
canvas = Image.new('RGB', (w, h), (255, 255, 255))
y = 0
for c in cropped:
    canvas.paste(c, ((w - c.width) // 2, y))
    y += c.height + gap
canvas.save(sys.argv[2])
`;

// xdvipdfmx falla de forma intermitente al incrustar fuentes Type1 (.pfb):
// sustituirlas por equivalentes OpenType (solo en el render, no en el contenido)
export const FONT_SUBS = [
  [/URW Gothic Demi/g, 'TeX Gyre Adventor'],
  [/URW Gothic/g, 'TeX Gyre Adventor']
];

export const substituteFonts = (line) => FONT_SUBS.reduce((t, [re, sub]) => t.replace(re, sub), line);

// El preámbulo puede \input{} estilos del autor (p. ej.
// _Sources/latex/historias-estilos.tex) con fuentes que xdvipdfmx no sabe
// incrustar en algunos PDF (URW Gothic combinada con otras rompe el
// subsetting: «Parsing charstring failed»). Para no tocar el original,
// cada \input que resuelva a un archivo se copia al directorio de render
// con las sustituciones de FONT_SUBS aplicadas y se re-apunta el \input.
// Solo se toca el archivo si la sustitución cambia algo.
export function materializeInputs(latex, renderDir) {
  return latex.replace(/\\input\{([^}]+)\}/g, (m, rel) => {
    const srcFile = path.resolve(renderDir, rel);
    if (!fs.existsSync(srcFile) || !fs.statSync(srcFile).isFile()) return m;
    const original = fs.readFileSync(srcFile, 'utf8');
    const sub = substituteFonts(original);
    if (sub === original) return m;
    const outName = `_sub_${path.basename(rel)}`;
    fs.writeFileSync(path.join(renderDir, outName), sub);
    return `\\input{${outName}}`;
  });
}

export function buildPreamble(fm, { longPage }) {
  const fontsize = extractScalar(fm.fmLines, 'fontsize') || '12pt';
  const mainfont = extractScalar(fm.fmLines, 'mainfont') || 'Latin Modern Roman';
  const geometry = longPage
    ? 'paperwidth=21cm,paperheight=100cm,left=0.7in,right=0.7in,top=0.9in,bottom=0.9in'
    : `a4paper,${extractScalar(fm.fmLines, 'geometry') || 'left=0.7in,right=0.7in,top=1in,bottom=1.2in'}`;
  return [
    `\\documentclass[${fontsize}]{article}`,
    ...fm.headerIncludes.map(substituteFonts),
    mainfont ? `\\setmainfont{${mainfont}}` : '',
    `\\usepackage[${geometry}]{geometry}`,
    '\\pagestyle{empty}'
  ].filter(Boolean).join('\n');
}

export function runRender(cmd, args, opts) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString();
}

export function looksValidPdf(p) {
  try {
    const buf = fs.readFileSync(p);
    return buf.length > 1000 && buf.subarray(Math.max(0, buf.length - 2048)).toString('latin1').includes('%%EOF');
  } catch {
    return false;
  }
}

// xdvipdfmx puede fallar de forma intermitente dejando un PDF truncado
// («Parsing charstring failed»); se reintenta y se valida el resultado.
export function runXelatex(texFile, cwd) {
  const pdfFile = texFile.replace(/\.tex$/, '.pdf');
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      runRender('xelatex', ['-interaction=nonstopmode', '-halt-on-error', texFile], { cwd });
      if (looksValidPdf(path.join(cwd, pdfFile))) return null;
      lastErr = new Error('PDF truncado');
    } catch (e) {
      lastErr = e;
    }
  }
  return lastErr;
}

// render dentro de un article de página larga (pipeline de import-story):
// xelatex -> pdftoppm 120dpi -> recorte y unión de páginas con PIL
export function renderDocPng(n, latex, renderDir, docsDir) {
  const texFile = `d${n}.tex`;
  fs.writeFileSync(path.join(renderDir, texFile), materializeInputs(latex, renderDir));
  try {
    const err = runXelatex(texFile, renderDir);
    if (err) throw err;
    runRender('pdftoppm', ['-png', '-r', '120', `d${n}.pdf`, `d${n}`], { cwd: renderDir });
    const pages = fs.readdirSync(renderDir).filter((f) => new RegExp(`^d${n}-\\d+\\.png$`).test(f));
    if (!pages.length) throw new Error('pdftoppm no generó páginas');
    const outPng = path.join(docsDir, `d${n}.png`);
    try {
      runRender('python3', ['-c', CROP_SCRIPT, path.join(renderDir, `d${n}-*.png`), outPng], {});
    } catch {
      fs.copyFileSync(path.join(renderDir, pages[0]), outPng);
    }
    return 'render';
  } catch (e) {
    const log = fs.existsSync(path.join(renderDir, `d${n}.log`))
      ? fs.readFileSync(path.join(renderDir, `d${n}.log`), 'utf8')
      : '';
    const errLine = log.split('\n').find((l) => l.startsWith('!')) || e.message.split('\n')[0];
    return { error: errLine };
  }
}

// render suelto con \documentclass{standalone} (pipeline de render-doc):
// borde de 8pt, ancho del texto de 494.5pt (≈ 6.87in, el ancho final del
// documento es ~848px a 120dpi). Si el PDF tiene varias páginas se unen con
// PIL; si tiene una, se usa tal cual (el borde lo pone standalone).
export function renderDocStandalone(n, latex, renderDir, outPng) {
  const texFile = `d${n}.tex`;
  fs.writeFileSync(path.join(renderDir, texFile), materializeInputs(latex, renderDir));
  const err = runXelatex(texFile, renderDir);
  if (err) throw err;
  runRender('pdftoppm', ['-png', '-r', '120', `d${n}.pdf`, `d${n}`], { cwd: renderDir });
  const pages = fs.readdirSync(renderDir).filter((f) => new RegExp(`^d${n}-\\d+\\.png$`).test(f)).sort();
  if (!pages.length) throw new Error('pdftoppm no generó páginas');
  if (pages.length === 1) {
    fs.copyFileSync(path.join(renderDir, pages[0]), outPng);
  } else {
    runRender('python3', ['-c', CROP_SCRIPT, path.join(renderDir, `d${n}-*.png`), outPng], {});
  }
  return pages.length;
}
