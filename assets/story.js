// Página de historia: aviso de bloqueada, marcar como leída, etiquetas de
// lugar y año, minimapa y mini línea de tiempo tras la lectura.

(function () {
  'use strict';

  var S = window.SEMI;
  var PAGE = window.SEMI_PAGE;

  function el(sel) { return document.querySelector(sel); }

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

    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pieces.forEach(function (p) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x + p.width); y1 = Math.max(y1, p.y + p.height);
    });
    var pad = 24;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;

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

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', x0 + ' ' + y0 + ' ' + (x1 - x0) + ' ' + (y1 - y0));
    svg.setAttribute('class', 'minimap-overlay');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.width = '100%';
    svg.style.height = '100%';

    record.places.forEach(function (place) {
      var g = place.geometry;
      if (g.type === 'circle') {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', g.x); c.setAttribute('cy', g.y); c.setAttribute('r', g.radius);
        c.setAttribute('class', 'region-circle faint');
        svg.appendChild(c);
      }
    });
    var usedIds = {};
    record.documents.forEach(function (d) { d.places.forEach(function (pid) { usedIds[pid] = 1; }); });
    record.places.forEach(function (place) {
      if (!usedIds[place.id]) return;
      var g = place.geometry;
      if (g.type !== 'point') return;
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', g.x); c.setAttribute('cy', g.y);
      c.setAttribute('r', 6 / k);
      c.setAttribute('class', 'place-dot story-dot');
      svg.appendChild(c);
      var label = document.createElementNS(NS, 'text');
      label.setAttribute('x', g.x + 10 / k); label.setAttribute('y', g.y + 4 / k);
      label.setAttribute('font-size', 13 / k);
      label.setAttribute('class', 'place-label');
      label.textContent = place.name;
      svg.appendChild(label);
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
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', '100%');
    var domain = (to - from) || 1;
    var x = function (y) { return pad + ((y - from) / domain) * (W - 2 * pad); };

    var axis = document.createElementNS(NS, 'line');
    axis.setAttribute('x1', pad); axis.setAttribute('x2', W - pad);
    axis.setAttribute('y1', 42); axis.setAttribute('y2', 42);
    axis.setAttribute('class', 'tl-axis');
    svg.appendChild(axis);

    [from, to].forEach(function (y, i) {
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', i === 0 ? pad : W - pad);
      t.setAttribute('y', 66);
      t.setAttribute('text-anchor', i === 0 ? 'start' : 'end');
      t.setAttribute('class', 'tl-tick-label');
      t.textContent = S.fmtYear(y);
      svg.appendChild(t);
    });

    var color = S.storyColor(record.sequence);
    record.documents.forEach(function (d) {
      var y1 = d.year, y2 = d.yearEnd != null ? d.yearEnd : d.year;
      if (y2 > y1) {
        var bar = document.createElementNS(NS, 'line');
        bar.setAttribute('x1', x(y1)); bar.setAttribute('x2', x(y2));
        bar.setAttribute('y1', 42); bar.setAttribute('y2', 42);
        bar.setAttribute('stroke', color);
        bar.setAttribute('stroke-width', 6);
        bar.setAttribute('stroke-linecap', 'round');
        svg.appendChild(bar);
      }
      var pt = document.createElementNS(NS, 'circle');
      pt.setAttribute('cx', x(y1)); pt.setAttribute('cy', 42);
      pt.setAttribute('r', 5.5);
      pt.setAttribute('fill', color);
      pt.setAttribute('stroke', '#101820');
      pt.setAttribute('stroke-width', 1.5);
      svg.appendChild(pt);
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

    // etiquetas de lugar y año en los documentos
    var names = PAGE.placeNames || {};
    document.querySelectorAll('.doc').forEach(function (li) {
      var docId = li.getAttribute('data-doc-id');
      var doc = PAGE.docs.filter(function (d) { return d.id === docId; })[0];
      var meta = li.querySelector('[data-doc-meta]');
      if (!doc || !meta) return;
      if (state === 'read') {
        var places = doc.places.map(function (pid) { return names[pid] || pid; }).join(', ');
        var span = doc.yearEnd != null ? S.fmtSpan(doc.year, doc.yearEnd) : S.fmtYear(doc.year);
        meta.textContent = places + ' · ' + span;
        meta.hidden = false;
      } else {
        meta.hidden = true;
      }
    });

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
        buildMinimap(el('[data-minimap]') || rewards.querySelector('[data-minimap]'), dataFiles);
        buildMinitimeline(el('[data-minitimeline]') || rewards.querySelector('[data-minitimeline]'), dataFiles.filter(function (d) { return d.id === PAGE.id; })[0]);
      }).catch(function (err) {
        rewards.querySelector('h2').textContent = 'No se pudo cargar el mapa revelado';
      });
    } else if (rewards) {
      rewards.hidden = true;
    }
  }

  function revealMessage(data) {
    var parts = [];
    parts.push(S.plural(data.pieces.length, 'pieza nueva del mapa', 'piezas nuevas del mapa'));
    parts.push(S.plural(data.places.length, 'lugar', 'lugares'));
    parts.push(S.plural(data.documents.length, 'documento', 'documentos'));
    return parts.join(' · ');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!PAGE) return;
    applyReadState();

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mark-read]');
      if (!btn || btn.disabled) return;
      var id = btn.getAttribute('data-id');
      S.markRead(id);
      S.fetchStoryData(id).then(function (data) {
        S.toast('Historia marcada como leída: ' + revealMessage(data) + '.');
      }).catch(function () {
        S.toast('Historia marcada como leída.');
      });
      applyReadState();
    });
  });
})();
