// Editor visual de lugares — http://localhost:8179
// Arrastra los puntos sobre el mapa y pulsa Guardar: escribe content/places.json.
// Herramienta de desarrollo; no forma parte del sitio construido.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8179);

const PAGE = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Semiesfera — editor de lugares</title>
<style>
  body { margin: 0; background: #101820; color: #e8e3d5; font-family: system-ui, sans-serif; }
  header { padding: 10px 16px; display: flex; gap: 16px; align-items: center; }
  header b { letter-spacing: 2px; }
  button { background: #e29468; border: 0; color: #101820; font-weight: 600;
    padding: 8px 18px; border-radius: 6px; cursor: pointer; }
  button[disabled] { opacity: 0.4; cursor: default; }
  #status { opacity: 0.7; font-size: 14px; }
  #wrap { position: relative; margin: 0 16px 24px; }
  #wrap img { display: block; width: 100%; }
  #overlay { position: absolute; inset: 0; touch-action: none; }
  .dot { fill: #e29468; stroke: #101820; stroke-width: 1.5; cursor: grab; }
  .dot:active { cursor: grabbing; }
  .lbl { fill: #fff; font-family: system-ui, sans-serif; font-size: 26px;
    paint-order: stroke; stroke: rgba(10,20,29,.85); stroke-width: 4px; pointer-events: none; }
  .poly { fill: rgba(226,148,107,.05); stroke: rgba(232,227,213,.5); stroke-dasharray: 8 6; }
  .plbl { fill: rgba(232,227,213,.6); font-size: 30px; letter-spacing: 4px;
    text-anchor: middle; cursor: grab; paint-order: stroke; stroke: rgba(10,20,29,.85); stroke-width: 4px; }
</style>
</head>
<body>
<header>
  <b>Editor de lugares</b>
  <button id="save" disabled>Guardar</button>
  <span id="status">cargando…</span>
</header>
<div id="wrap">
  <img id="map">
  <svg id="overlay"></svg>
</div>
<script>
const NS = 'http://www.w3.org/2000/svg';
let places = null, size = null, dirty = false;
const svg = document.getElementById('overlay');

function markDirty() {
  dirty = true;
  document.getElementById('save').disabled = false;
  document.getElementById('status').textContent = 'cambios sin guardar';
}

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  (parent || svg).appendChild(n);
  return n;
}

function drag(node, onMove) {
  let target = null, pt = null;
  const svgPt = (e) => {
    const r = svg.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * size.width,
      y: (e.clientY - r.top) / r.height * size.height
    };
  };
  node.addEventListener('pointerdown', (e) => {
    target = e.currentTarget;
    pt = svgPt(e);
    target.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  node.addEventListener('pointermove', (e) => {
    if (!target || e.currentTarget !== target) return;
    pt = svgPt(e);
    onMove(pt.x, pt.y);
  });
  node.addEventListener('pointerup', () => { target = null; markDirty(); });
}

function render() {
  svg.setAttribute('viewBox', '0 0 ' + size.width + ' ' + size.height);
  svg.innerHTML = '';
  for (const p of places) {
    const g = el('g', {});
    if (p.geometry.type === 'poly') {
      const d = p.geometry.contours.map((c) =>
        'M' + c.map((q) => q[0] + ' ' + q[1]).join('L') + 'Z').join('');
      el('path', { class: 'poly', d }, g);
      const t = el('text', { class: 'plbl', x: p.geometry.cx, y: p.geometry.cy }, g);
      t.textContent = p.name;
      drag(t, (x, y) => {
        t.setAttribute('x', x); t.setAttribute('y', y);
        p.geometry.cx = Math.round(x * 10) / 10;
        p.geometry.cy = Math.round(y * 10) / 10;
      });
    } else {
      const c = el('circle', { class: 'dot', cx: p.geometry.x, cy: p.geometry.y, r: 14 }, g);
      const t = el('text', { class: 'lbl', x: p.geometry.x + 20, y: p.geometry.y + 9 }, g);
      t.textContent = p.name;
      drag(c, (x, y) => {
        c.setAttribute('cx', x); c.setAttribute('cy', y);
        t.setAttribute('x', x + 20); t.setAttribute('y', y + 9);
        p.geometry.x = Math.round(x * 10) / 10;
        p.geometry.y = Math.round(y * 10) / 10;
      });
    }
  }
}

fetch('/data').then((r) => r.json()).then((meta) => {
  places = meta.places;
  size = meta.size;
  document.getElementById('map').src = '/' + meta.completeFile;
  render();
  document.getElementById('status').textContent = 'arrastra los puntos; Guardar escribe places.json';
});

document.getElementById('save').addEventListener('click', async () => {
  const btn = document.getElementById('save');
  btn.disabled = true;
  const r = await fetch('/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ places })
  });
  document.getElementById('status').textContent =
    r.ok ? 'guardado en content/places.json — recuerda npm run build' : 'error al guardar';
  if (r.ok) dirty = false;
});
window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE);
    } else if (req.method === 'GET' && url.pathname === '/data') {
      const places = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'places.json'), 'utf8'));
      const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'map-pieces.json'), 'utf8'));
      json(200, { places: places.places, size: meta.size, completeFile: meta.complete.file });
    } else if (req.method === 'POST' && url.pathname === '/save') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const places = JSON.parse(body).places;
          if (!Array.isArray(places)) throw new Error('places no es una lista');
          fs.writeFileSync(path.join(ROOT, 'content', 'places.json'),
            JSON.stringify({ places }, null, 2) + '\n');
          console.log(`guardado: ${places.length} lugares`);
          json(200, { ok: true });
        } catch (e) {
          json(400, { error: String(e) });
        }
      });
    } else {
      const file = path.normalize(path.join(ROOT, 'content', url.pathname));
      if (!file.startsWith(path.join(ROOT, 'content')) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end('404'); return;
      }
      res.writeHead(200, { 'content-type': 'image/png' });
      fs.createReadStream(file).pipe(res);
    }
  } catch (e) {
    res.writeHead(500); res.end('500');
  }
});

server.listen(PORT, () => {
  console.log(`Editor de lugares en http://localhost:${PORT}`);
  console.log('arrastra los puntos, pulsa Guardar y después npm run build');
});
