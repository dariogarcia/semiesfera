// Página de historia: aviso de bloqueada, marcar como leída, etiquetas de
// lugar y año, minimapa y mini línea de tiempo tras la lectura.

(function () {
  'use strict';

  var S = window.SEMI;
  var PAGE = window.SEMI_PAGE;

  function el(sel) { return document.querySelector(sel); }
  var svgEl = S.svgEl;

  // -- minimapa -----------------------------------------------------------------

  function buildMinimap(container, dataFiles) {
    var record = null;
    var pieces = [];
    var seenPieces = {};
    dataFiles.forEach(function (d) {
      if (d.id === PAGE.id) record = d;
      d.pieces.forEach(function (p) {
        if (!seenPieces[p.id]) { seenPieces[p.id] = 1; pieces.push(p); }
      });
    });
    if (!record || !pieces.length) return;

    var b = S.piecesBbox(pieces);
    var x0 = b.x - 24, y0 = b.y - 24, x1 = b.x + b.w + 24, y1 = b.y + b.h + 24;

    var W = Math.max(container.clientWidth || 600, 200);
    var k = W / (x1 - x0);
    var H = (y1 - y0) * k;
    container.style.height = Math.round(H) + 'px';
    container.innerHTML = '';

    pieces.forEach(function (p) {
      var img = document.createElement('img');
      img.src = S.u(p.file);
      img.alt = '';
      img.className = 'map-piece';
      if (!S.getSeenPieces().includes(p.id)) img.classList.add('reveal-fade');
      img.style.left = ((p.x - x0) * k) + 'px';
      img.style.top = ((p.y - y0) * k) + 'px';
      img.style.width = (p.width * k) + 'px';
      img.style.height = (p.height * k) + 'px';
      container.appendChild(img);
    });

    var svg = svgEl('svg', {
      viewBox: x0 + ' ' + y0 + ' ' + (x1 - x0) + ' ' + (y1 - y0),
      class: 'minimap-overlay',
      preserveAspectRatio: 'none'
    });
    svg.style.width = '100%';
    svg.style.height = '100%';

    record.places.forEach(function (place) {
      var g = place.geometry;
      if (g.type === 'circle') {
        svgEl('circle', { cx: g.x, cy: g.y, r: g.radius, class: 'region-circle faint' }, svg);
      } else if (g.type === 'poly') {
        var path = svgEl('path', {
          class: 'region-poly faint',
          d: g.contours.map(function (pts) {
            return 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join('L') + 'Z';
          }).join('')
        }, svg);
      }
    });
    var usedIds = {};
    record.documents.forEach(function (d) { d.places.forEach(function (pid) { usedIds[pid] = 1; }); });
    record.places.forEach(function (place) {
      if (!usedIds[place.id]) return;
      var g = place.geometry;
      if (g.type !== 'point') return;
      svgEl('circle', { cx: g.x, cy: g.y, r: 6 / k, class: 'place-dot' }, svg);
      var label = svgEl('text', { x: g.x + 10 / k, y: g.y + 4 / k, 'font-size': 13 / k, class: 'place-label' }, svg);
      label.textContent = place.name;
    });

    container.appendChild(svg);
  }

  // -- mini línea de tiempo -------------------------------------------------------

  function buildMinitimeline(container, record) {
    var from = record.span.from, to = record.span.to;
    var W = Math.max(container.clientWidth || 600, 240);
    var H = 84;
    var pad = 26;
    container.innerHTML = '';
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%' });
    var domain = (to - from) || 1;
    var x = function (y) { return pad + ((y - from) / domain) * (W - 2 * pad); };

    svgEl('line', { class: 'tl-axis', x1: pad, x2: W - pad, y1: 42, y2: 42 }, svg);

    [from, to].forEach(function (y, i) {
      var t = svgEl('text', {
        class: 'tl-tick-label',
        x: i === 0 ? pad : W - pad,
        y: 66,
        'text-anchor': i === 0 ? 'start' : 'end'
      }, svg);
      t.textContent = S.fmtYear(y);
    });

    var color = S.storyColor(record.sequence);
    record.documents.forEach(function (d) {
      var y1 = d.year, y2 = d.yearEnd != null ? d.yearEnd : d.year;
      if (y2 > y1) {
        svgEl('line', {
          x1: x(y1), x2: x(y2), y1: 42, y2: 42,
          stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round'
        }, svg);
      }
      svgEl('circle', {
        cx: x(y1), cy: 42, r: 5.5,
        fill: color, stroke: '#101820', 'stroke-width': 1.5
      }, svg);
    });

    container.appendChild(svg);
  }

  // -- estado de lectura ---------------------------------------------------------

  function applyReadState() {
    var states = S.storyStates();
    var state = states[PAGE.id] || 'locked';
    var content = el('[data-story-content]');
    var notice = el('[data-locked-notice]');
    var rewards = el('[data-rewards]');
    var markBtn = document.querySelector('[data-mark-read]');

    if (state === 'locked') {
      if (content) content.hidden = true;
      if (notice) {
        notice.hidden = false;
        var nextId = S.openStoryId();
        var next = window.SEMI_INDEX.stories.filter(function (s) { return s.id === nextId; })[0];
        var link = notice.querySelector('[data-next-link]');
        if (next && link) {
          link.href = S.u('historias/' + next.id + '/');
          link.textContent = 'Leer ahora: ' + next.title;
        } else if (link) {
          link.hidden = true;
        }
      }
      return;
    }

    if (notice) notice.hidden = true;
    if (content) content.hidden = false;

    if (markBtn) {
      if (state === 'read') {
        markBtn.disabled = true;
        markBtn.textContent = 'Leída';
      } else {
        markBtn.disabled = false;
        markBtn.textContent = 'Marcar como leída';
      }
    }

    if (state === 'read' && rewards) {
      rewards.hidden = false;
      S.loadUnlockedData().then(function (dataFiles) {
        buildMinimap(el('[data-minimap]'), dataFiles);
        buildMinitimeline(el('[data-minitimeline]'), dataFiles.filter(function (d) { return d.id === PAGE.id; })[0]);
      }).catch(function (err) {
        rewards.querySelector('h2').textContent = 'No se pudo cargar el mapa revelado';
      });
    } else if (rewards) {
      rewards.hidden = true;
    }
  }

  // barra de progreso de lectura (solo si la historia es legible)
  var readBar = null;
  function attachReadBar() {
    if (readBar) return;
    var content = el('[data-story-content]');
    var body = content && !content.hidden ? content.querySelector('.story-body') : null;
    if (body) readBar = S.readBar(window, body);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!PAGE) return;
    applyReadState();
    attachReadBar();

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mark-read]');
      if (!btn || btn.disabled) return;
      var id = btn.getAttribute('data-id');
      S.markReadAndNotify(id, function () {
        applyReadState();
        attachReadBar();
      });
    });
  });
})();
