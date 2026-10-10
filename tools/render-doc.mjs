// Re-renderiza documentos sueltos de una historia ya importada, sin
// regenerar story.md ni el resto de la carpeta. Lee el fuente LaTeX
// (content/sources/<id>.md), extrae el doc-box N y lo compila con
// \documentclass{standalone} (borde 8pt, ancho de texto 494.5pt), el mismo
// pipeline que produjo los PNG actuales.
//
// Uso:
//   node tools/render-doc.mjs <story-id> --list
//   node tools/render-doc.mjs <story-id> --doc 5
//   node tools/render-doc.mjs <story-id> --doc 5 --adjustwidth strip
//   node tools/render-doc.mjs <story-id> --all [--adjustwidth keep|small|strip]
//
// --adjustwidth controla los \begin{adjustwidth}{..}{..} del fuente:
//   keep   los deja tal cual (por defecto)
//   small  los reduce a 0.5cm/0.5cm
//   strip  los quita (documentos cuyo ajuste dejaba márgenes desiguales)
//
// Requiere xelatex + pdftoppm; python3 con PIL solo si el doc ocupa varias
// páginas. Escribe content/stories/<id>/docs/dN.png (y actualiza story.md
// si la entrada apuntaba al marcador dN.svg). Los intermedios van a
// renders/<id>/ (gitignored).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  splitSource, extractScalar, extractHeaderIncludes, extractFirstMacro,
  splitDocBoxes, parseDocmeta, plainText, cleanForRender,
  substituteFonts, renderDocStandalone
} from './docbox.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXTWIDTH = '494.5pt'; // ancho del texto de los documentos (~848px a 120dpi)

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') out.list = true;
    else if (a === '--all') out.all = true;
    else if (a === '--doc') {
      out.doc = parseInt(argv[++i], 10);
      if (!Number.isInteger(out.doc) || out.doc < 1) throw new Error('--doc espera un número (ej. --doc 5)');
    } else if (a === '--adjustwidth') {
      out.adjustwidth = argv[++i];
      if (!['keep', 'small', 'strip'].includes(out.adjustwidth)) throw new Error('--adjustwidth espera keep, small o strip');
    } else if (!a.startsWith('--')) out._.push(a);
    else throw new Error(`Opción desconocida: ${a}`);
  }
  return out;
}

function storyPaths(id) {
  const src = path.join(ROOT, 'content', 'sources', `${id}.md`);
  const storyDir = path.join(ROOT, 'content', 'stories', id);
  if (!fs.existsSync(src)) {
    const known = fs.existsSync(path.join(ROOT, 'content', 'sources'))
      ? fs.readdirSync(path.join(ROOT, 'content', 'sources')).map((f) => f.replace(/\.md$/, '')).join(', ')
      : '(sin fuentes)';
    throw new Error(`No existe content/sources/${id}.md (historias con fuente: ${known})`);
  }
  return { src, storyDir, docsDir: path.join(storyDir, 'docs'), storyMd: path.join(storyDir, 'story.md') };
}

function docBoxes(id, srcPath) {
  const src = splitSource(fs.readFileSync(srcPath, 'utf8'));
  src.headerIncludes = extractHeaderIncludes(src.fmLines);
  const boxes = splitDocBoxes(src.body).filter((s) => s.type === 'doc');
  if (!boxes.length) throw new Error('La fuente no contiene doc-boxes (::: {.doc-box})');
  return { src, boxes };
}

function boxInfo(content) {
  const meta = extractFirstMacro(content, 'docmeta');
  const fields = meta ? parseDocmeta(meta.content) : {};
  return { fuente: plainText(fields.fuente) || '?', year: fields.ano || fields.año || '?' };
}

function standalonePreamble(src) {
  const mainfont = extractScalar(src.fmLines, 'mainfont') || 'Latin Modern Roman';
  return [
    '\\documentclass[12pt,border=8pt,varwidth=true]{standalone}',
    ...src.headerIncludes.map(substituteFonts),
    mainfont ? `\\setmainfont{${mainfont}}` : ''
  ].filter(Boolean).join('\n');
}

// apunta la entrada de story.md al PNG recién renderizado si usaba el SVG marcador
function pointStoryMdAtPng(storyMd, n) {
  if (!fs.existsSync(storyMd)) return false;
  const before = fs.readFileSync(storyMd, 'utf8');
  const after = before.replace(`docs/d${n}.svg`, `docs/d${n}.png`);
  if (after !== before) fs.writeFileSync(storyMd, after);
  return after !== before;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args._.length) throw new Error('Falta el id de la historia (ej. vol11-la-leyenda-del-primer-interlande)');
  const id = args._[0];
  const paths = storyPaths(id);
  const { src, boxes } = docBoxes(id, paths.src);
  const { storyMd, docsDir } = paths;

  if (args.list || (!args.doc && !args.all)) {
    console.log(`Documentos de ${id} (content/sources/${id}.md):`);
    boxes.forEach((box, i) => {
      const info = boxInfo(box.content);
      const png = fs.existsSync(path.join(docsDir, `d${i + 1}.png`))
        ? `d${i + 1}.png`
        : fs.existsSync(path.join(docsDir, `d${i + 1}.svg`)) ? `d${i + 1}.svg (marcador)` : 'sin render';
      console.log(`  d${i + 1}: ${info.fuente}  [${info.year}]  -> ${png}`);
    });
    console.log(`\nPara re-renderizar: node tools/render-doc.mjs ${id} --doc N`);
    return;
  }

  if (!fs.existsSync(storyMd)) {
    console.log('Aviso: no existe story.md; ¿está la historia importada? Se renderiza igualmente.');
  } else if (!args.all && !fs.readFileSync(storyMd, 'utf8').includes(`docs/d${args.doc}`)) {
    console.log(`Aviso: story.md no referencia docs/d${args.doc}; revisa los metadatos del documento.`);
  }

  const preamble = standalonePreamble(src);
  const renderDir = path.join(ROOT, 'renders', id);
  fs.mkdirSync(renderDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });

  const targets = args.all ? boxes.map((_, i) => i + 1) : [args.doc];
  for (const n of targets) {
    if (n > boxes.length) throw new Error(`Solo hay ${boxes.length} doc-boxes (d1–d${boxes.length})`);
    const latex = `${preamble}\n\\setlength{\\textwidth}{${TEXTWIDTH}}\n\n\\begin{document}\n${cleanForRender(boxes[n - 1].content, { adjustwidth: args.adjustwidth || 'keep' })}\n\\end{document}\n`;
    try {
      const pages = renderDocStandalone(n, latex, renderDir, path.join(docsDir, `d${n}.png`));
      const fixed = pointStoryMdAtPng(storyMd, n);
      console.log(`d${n}: render OK (${pages} página${pages > 1 ? 's unidas' : ''}) -> content/stories/${id}/docs/d${n}.png${fixed ? ' (story.md actualizado: svg -> png)' : ''}`);
    } catch (e) {
      const log = fs.existsSync(path.join(renderDir, `d${n}.log`)) ? fs.readFileSync(path.join(renderDir, `d${n}.log`), 'utf8') : '';
      const errLine = log.split('\n').find((l) => l.startsWith('!')) || e.message.split('\n')[0];
      throw new Error(`d${n}: ${errLine}`);
    }
  }
  console.log('\nSiguiente paso: npm test');
}

try {
  main();
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
