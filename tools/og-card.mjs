// Tarjeta og (1200×630) de cada historia: el mismo lenguaje visual que las
// portadas — fondo azul noche, montañas en el color del volumen, serif —
// pero apaisado para los enlaces compartidos. Se renderiza a PNG con
// inkscape y se commitea en content/stories/<id>/og.png; el build la sirve
// en stories/<id>/og.png y la referencia en og:image/twitter:image.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { paletteColor } from './lib.mjs';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

// DejaVu Serif es la serif disponible en el sistema para el render con
// inkscape; Georgia como primer fallback si algún día se renderiza en
// navegador.
const SERIF = 'DejaVu Serif, Georgia, serif';

export function ogCardSvg({ title, volume, sequence }) {
  const color = paletteColor(sequence);
  const titleLines = wrapText(title.toUpperCase(), 24);
  const volLines = wrapText(volume.toUpperCase(), 48);
  const titleStart = 196 - ((titleLines.length - 1) * 62) / 2;
  const volStart = 548 - ((volLines.length - 1) * 26) / 2;
  const texts = (lines, x, y, attrs, lineH) =>
    lines.map((l, i) => `<text x="${x}" y="${y + i * lineH}" ${attrs}>${esc(l)}</text>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#141f2b"/>
<rect x="28" y="28" width="1144" height="574" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.55"/>
<text x="600" y="96" text-anchor="middle" font-family="${SERIF}" font-size="17" letter-spacing="6" fill="#e8e0cf" opacity="0.75">LA SEMIESFERA</text>
<path d="M 320 470 L 463 330 L 546 415 L 629 310 L 712 450 L 795 385 L 880 470 Z" fill="${color}" stroke="${color}" stroke-width="2" opacity="0.85"/>
<path d="M 320 470 L 880 470 L 880 486 L 320 486 Z" fill="${color}" opacity="0.35"/>
${texts(titleLines, 600, titleStart, `text-anchor="middle" font-family="${SERIF}" font-size="52" fill="#e8e0cf"`, 62)}
${texts(volLines, 600, volStart, `text-anchor="middle" font-family="${SERIF}" font-size="19" letter-spacing="3" fill="${color}"`, 26)}
<text x="88" y="150" font-family="${SERIF}" font-size="100" fill="${color}" opacity="0.85">${sequence}</text>
</svg>
`;
}

// Renderiza la tarjeta a PNG (inkscape) en <dir>/og.png. Devuelve true si
// se generó; false si inkscape no está (el build caerá a la og-image del
// sitio y el import puede continuar).
export function writeOgPng(dir, meta) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-card-'));
  const svgFile = path.join(tmp, 'og.svg');
  fs.writeFileSync(svgFile, ogCardSvg(meta));
  try {
    execFileSync('inkscape', [svgFile, '--export-type=png', '--export-filename=' + path.join(dir, 'og.png')], { stdio: ['ignore', 'pipe', 'pipe'] });
    return fs.existsSync(path.join(dir, 'og.png'));
  } catch {
    return false;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
