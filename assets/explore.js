// /explorar: mapa y línea de tiempo enlazados, panel de resultados, lector de
// documentos y estado en la URL. Solo se muestra lo desbloqueado al leer.

(function () {
  'use strict';

  var S = window.SEMI;

  var TLW = 1000, PLOT_H = 106, PAD = 42, TL_MIN = -500, TL_MAX = 1000;
  var DOMAIN = { d0: 0, d1: 1 };

  var state = {
    index: null,
    files: [],
    pieces: [],
    places: new Map(),
    docs: [],
    allDocs: [],
    eras: [],
    complete: false,
    sel: { place: null, doc: null },
    range: null,
    preview: null,
    readerDoc: null,
    readerStory: null,
    readerRecs: {},
    panels: { stories: true, docs: true }
  };

  var dom = {};
  var placeEls = new Map();
  var docEls = new Map();
  var clusters = [];
  var view = { k: 1, tx: 0, ty: 0, minK: 0.05 };
  var mapDragged = false;
  var tlDrag = null;
  var tlSuppressClick = false;

  // -- utilidades ---------------------------------------------------------------

  var svgEl = S.svgEl;

  function findDoc(id) {
    for (var i = 0; i < state.docs.length; i++) if (state.docs[i].id === id) return state.docs[i];
    return null;
  }

  function findDocAnywhere(id) {
    var d = findDoc(id);
    if (d) return d;
    var recs = state.readerRecs;
    for (var k in recs) {
      var list = recs[k].documents || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    }
    return null;
  }

  function docMeta(id) {
    for (var i = 0; i < state.allDocs.length; i++) if (state.allDocs[i].id === id) return state.allDocs[i];
    return null;
  }

  var byYear = function (a, b) { return a.year - b.year || a.sequence - b.sequence; };

  function buildAllDocs(index) {
    state.allDocs = [];
    index.stories.forEach(function (s) {
      (s.documents || []).forEach(function (d) { state.allDocs.push(d); });
    });
    state.allDocs.sort(byYear);
  }

  // ¿solapa el documento (que puede abarcar años) un periodo?
  function inRange(d, range) {
    var y2 = d.yearEnd != null ? d.yearEnd : d.year;
    return d.year <= range.to && y2 >= range.from;
  }

  function visibleDocs() {
    if (!state.range) return state.docs;
    return state.docs.filter(function (d) { return inRange(d, state.range); });
  }

  // filtro activo: lugar seleccionado Y/O periodo — se aplica a la línea de
  // tiempo y al panel de documentos
  function filteredDocs() {
    var list = state.docs;
    if (state.sel.place) {
      var ids = new Set(docsAtPlace(state.sel.place).map(function (d) { return d.id; }));
      list = list.filter(function (d) { return ids.has(d.id); });
    }
    if (state.range) list = list.filter(function (d) { return inRange(d, state.range); });
    return list;
  }

  function filterActive() {
    return !!(state.sel.place || state.range);
  }

  // tras cualquier cambio de filtro (lugar o periodo): URL, línea de tiempo,
  // resaltados, chip del periodo y panel de documentos
  function applyFilterChange(opts) {
    opts = opts || {};
    syncUrl();
    renderTimeline();
    updateHighlights(opts.scroll);
    if (opts.chip) updateRangeChip();
    renderDocsPanel();
  }

  function docsAtPlace(placeId) {
    var place = state.places.get(placeId);
    if (!place) return [];
    return visibleDocs().filter(function (d) {
      if (d.places.indexOf(placeId) >= 0) return true;
      if (place.geometry.type !== 'point') {
        return d.places.some(function (pid) {
          var p = state.places.get(pid);
          return p && p.parent === placeId;
        });
      }
      return false;
    });
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ¿cae la geometría del lugar dentro del rectángulo de la pieza?
  function insidePiece(geometry, piece) {
    if (geometry.type === 'point') {
      return geometry.x >= piece.x && geometry.x <= piece.x + piece.width &&
        geometry.y >= piece.y && geometry.y <= piece.y + piece.height;
    }
    if (geometry.type === 'poly') {
      return geometry.contours.every(function (pts) {
        return pts.every(function (p) {
          return p[0] >= piece.x && p[0] <= piece.x + piece.width &&
            p[1] >= piece.y && p[1] <= piece.y + piece.height;
        });
      });
    }
    return geometry.x - geometry.radius >= piece.x && geometry.x + geometry.radius <= piece.x + piece.width &&
      geometry.y - geometry.radius >= piece.y && geometry.y + geometry.radius <= piece.y + piece.height;
  }

  // -- datos --------------------------------------------------------------------

  function prepareData(files) {
    var pieceSeen = {}, placeSeen = {}, eraSeen = {};
    files.forEach(function (f) {
      f.pieces.forEach(function (p) {
        if (!pieceSeen[p.id]) { pieceSeen[p.id] = 1; state.pieces.push(p); }
      });
      f.places.forEach(function (p) {
        if (!placeSeen[p.id]) { placeSeen[p.id] = 1; state.places.set(p.id, p); }
      });
      (f.eras || []).forEach(function (era) {
        var key = era.name + '|' + era.from + '|' + era.to;
        if (!eraSeen[key]) { eraSeen[key] = 1; state.eras.push(era); }
      });
      state.docs = state.docs.concat(f.documents);
    });
    state.docs.sort(byYear);
    state.complete = state.pieces.length >= state.index.totalPieces;
  }

  // -- tooltip flotante (mapa + línea de tiempo) ---------------------------------

  var tipEl = null;

  function ensureTip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tip';
      tipEl.setAttribute('role', 'tooltip');
      tipEl.hidden = true;
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function placeTip(x, y) {
    var t = ensureTip();
    var w = t.offsetWidth, h = t.offsetHeight;
    if (x + w > window.innerWidth - 8) x = x - w - 28;
    if (y + h > window.innerHeight - 8) y = y - h - 28;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }

  function showTip(html, e) {
    var t = ensureTip();
    t.innerHTML = html;
    t.hidden = false;
    placeTip(e.clientX + 14, e.clientY + 16);
  }

  function showTipNear(el, html) {
    var r = el.getBoundingClientRect();
    showTip(html, { clientX: r.left + r.width / 2, clientY: r.bottom + 2 });
  }

  function moveTip(e) {
    if (!tipEl || tipEl.hidden) return;
    placeTip(e.clientX + 14, e.clientY + 16);
  }

  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }

  function docsSpan(docs) {
    var ys = [];
    docs.forEach(function (d) {
      ys.push(d.year);
      if (d.yearEnd != null) ys.push(d.yearEnd);
    });
    return S.fmtSpan(Math.min.apply(null, ys), Math.max.apply(null, ys));
  }

  function placeTipHtml(place) {
    var docs = docsAtPlace(place.id);
    if (!docs.length) return '<span class="tip-title">' + S.esc(place.name) + '</span>';
    return '<span class="tip-title">' + S.esc(place.name) + '</span>' +
      '<span class="tip-meta">' + docs.length + (docs.length === 1 ? ' documento' : ' documentos') +
      ' · ' + docsSpan(docs) + '</span>';
  }

  function docTipHtml(d) {
    var span = d.yearEnd != null ? S.fmtSpan(d.year, d.yearEnd) : S.fmtYear(d.year);
    return '<span class="tip-title">' + S.esc(d.label) + '</span>' +
      '<span class="tip-meta">' + S.esc(span) + ' · ' + S.esc(d.storyTitle) + '</span>';
  }

  function clusterTipHtml(cl) {
    return '<span class="tip-title">' + cl.docs.length + ' documentos juntos</span>' +
      '<span class="tip-meta">' + docsSpan(cl.docs) + '</span>';
  }

  // -- mapa ---------------------------------------------------------------------

  function piecesBbox(list) {
    var pieces = list || state.pieces;
    if (!pieces.length) {
      return { x: 0, y: 0, w: state.index.mapSize.width, h: state.index.mapSize.height };
    }
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pieces.forEach(function (p) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x + p.width); y1 = Math.max(y1, p.y + p.height);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // la cámara del mapa se anima solo en los movimientos programáticos
  // (vuelo a territorio nuevo); el arrastre y el zoom van a mano alzada
  var viewAnimTimer = null;

  function applyTransform(animate) {
    if (animate) {
      dom.world.classList.add('view-anim');
      clearTimeout(viewAnimTimer);
      viewAnimTimer = setTimeout(function () {
        viewAnimTimer = null;
        dom.world.classList.remove('view-anim');
      }, 800);
    } else if (viewAnimTimer) {
      clearTimeout(viewAnimTimer);
      viewAnimTimer = null;
      dom.world.classList.remove('view-anim');
    }
    dom.world.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.k + ')';
  }

  function fitMap() {
    var b = piecesBbox();
    var vw = dom.viewport.clientWidth || 600;
    var vh = dom.viewport.clientHeight || 400;
    var k = Math.min(vw / b.w, vh / b.h) * 0.92;
    view.k = k;
    view.minK = k * 0.35;
    view.tx = (vw - b.w * k) / 2 - b.x * k;
    view.ty = (vh - b.h * k) / 2 - b.y * k;
    applyTransform();
    updateMapScale();
  }

  function zoomAt(px, py, factor) {
    var k2 = clamp(view.k * factor, view.minK, 12);
    view.tx = px - (px - view.tx) * (k2 / view.k);
    view.ty = py - (py - view.ty) * (k2 / view.k);
    view.k = k2;
    applyTransform();
    updateMapScale();
  }

  // vuelo animado de la cámara hasta encuadrar una caja del mapa
  function flyToBbox(b) {
    var vw = dom.viewport.clientWidth || 600;
    var vh = dom.viewport.clientHeight || 400;
    var k = clamp(Math.min(vw / b.w, vh / b.h) * 0.92, view.minK, 12);
    view.k = k;
    view.tx = (vw - b.w * k) / 2 - b.x * k;
    view.ty = (vh - b.h * k) / 2 - b.y * k;
    applyTransform(true);
    updateMapScale();
  }

  function updateMapScale() {
    var k = view.k;
    // umbral de zoom a partir del cual se muestra la etiqueta de un punto:
    // los lugares con más documentos la conservan antes al alejarse
    var LABEL_MIN_K = [0, 0.55, 0.95];
    placeEls.forEach(function (g) {
      g.querySelectorAll('.place-dot').forEach(function (c) { c.setAttribute('r', 9 / k); });
      g.querySelectorAll('.place-ring').forEach(function (c) { c.setAttribute('r', 14 / k); c.setAttribute('stroke-width', 1.5 / k); });
      g.querySelectorAll('.place-hit').forEach(function (c) { c.setAttribute('r', 16 / k); });
      g.querySelectorAll('.place-label').forEach(function (t) { t.setAttribute('font-size', 13 / k); });
      g.querySelectorAll('.region-circle').forEach(function (c) { c.setAttribute('stroke-width', 2 / k); c.setAttribute('stroke-dasharray', (6 / k) + ' ' + (5 / k)); });
      g.querySelectorAll('.region-poly').forEach(function (c) { c.setAttribute('stroke-width', 2 / k); c.setAttribute('stroke-dasharray', (6 / k) + ' ' + (5 / k)); });
      g.querySelectorAll('.region-label').forEach(function (t) { t.setAttribute('font-size', 15 / k); });
      var tier = g.getAttribute('data-label-tier');
      if (tier != null) g.classList.toggle('hide-label', k < LABEL_MIN_K[+tier]);
    });
  }

  function buildMap() {
    var size = state.index.mapSize;
    dom.world.style.width = size.width + 'px';
    dom.world.style.height = size.height + 'px';
    dom.world.innerHTML = '';
    var seen = S.getSeenPieces();

    if (state.complete) {
      var full = document.createElement('img');
      full.src = S.u(state.index.complete.file);
      full.alt = 'Mapa completo del mundo';
      full.className = 'map-complete';
      if (seen.length < state.pieces.length) full.classList.add('reveal-fade');
      dom.world.appendChild(full);
    } else {
      state.pieces.forEach(function (p) {
        var img = document.createElement('img');
        img.src = S.u(p.file);
        img.alt = '';
        img.className = 'map-piece';
        img.draggable = false;
        img.style.left = p.x + 'px';
        img.style.top = p.y + 'px';
        img.style.width = p.width + 'px';
        img.style.height = p.height + 'px';
        if (seen.indexOf(p.id) < 0) img.classList.add('reveal-fade');
        dom.world.appendChild(img);
      });
    }

    var svg = svgEl('svg', {
      class: 'map-overlay',
      viewBox: '0 0 ' + size.width + ' ' + size.height,
      preserveAspectRatio: 'none'
    });
    dom.world.appendChild(svg);

    // las regiones se dibujan primero: su polígono debe quedar por debajo
    // de los puntos que contiene, o el clic en un punto (p. ej. deishe
    // dentro de lande-14) lo capturaría la región
    var placeList = Array.from(state.places.values());
    placeList.sort(function (a, b) {
      return (a.geometry.type === 'point' ? 1 : 0) - (b.geometry.type === 'point' ? 1 : 0);
    });
    placeList.forEach(function (place) {
      // un lugar solo se dibuja sobre territorio revelado: los landes cuya
      // pieza ninguna historia leída ha revelado quedan ocultos, igual que
      // los que aún no tienen documentos
      var revealed = state.pieces.some(function (p) { return insidePiece(place.geometry, p); });
      if (!revealed) return;
      var count = docsAtPlace(place.id).length;
      if (!count) return;
      var g = svgEl('g', {
        class: 'place-g',
        'data-place': place.id,
        tabindex: '0',
        role: 'button',
        'aria-label': place.name + ': ' + count + (count === 1 ? ' documento' : ' documentos')
      }, svg);
      var geom = place.geometry;
      if (geom.type === 'point') {
        // área de clic generosa: el punto visible + un halo transparente
        svgEl('circle', { class: 'place-hit', cx: geom.x, cy: geom.y, r: 16 }, g);
        // anillo que marca el punto fijado como selección
        svgEl('circle', { class: 'place-ring', cx: geom.x, cy: geom.y, r: 14 }, g);
        svgEl('circle', { class: 'place-dot', cx: geom.x, cy: geom.y, r: 9 }, g);
        var t = svgEl('text', { class: 'place-label', x: geom.x + 13, y: geom.y + 4 }, g);
        t.textContent = place.name;
      } else if (geom.type === 'poly') {
        var d = geom.contours.map(function (pts) {
          return 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join('L') + 'Z';
        }).join('');
        svgEl('path', { class: 'region-poly', d: d }, g);
        var pt = svgEl('text', { class: 'region-label', x: geom.cx, y: geom.cy, 'text-anchor': 'middle' }, g);
        pt.textContent = place.name;
      } else {
        svgEl('circle', { class: 'region-circle', cx: geom.x, cy: geom.y, r: geom.radius }, g);
        var rt = svgEl('text', { class: 'region-label', x: geom.x, y: geom.y - geom.radius - 10, 'text-anchor': 'middle' }, g);
        rt.textContent = place.name;
      }
      placeEls.set(place.id, g);
      if (geom.type === 'point') g.setAttribute('data-label-tier', count >= 3 ? 0 : count === 2 ? 1 : 2);

      g.addEventListener('mouseenter', function (e) { setPreview({ type: 'place', id: place.id }, true); showTip(placeTipHtml(place), e); });
      g.addEventListener('mousemove', moveTip);
      g.addEventListener('mouseleave', function () { setPreview(null); hideTip(); });
      g.addEventListener('focus', function () { setPreview({ type: 'place', id: place.id }, true); showTipNear(g, placeTipHtml(place)); });
      g.addEventListener('blur', function () { setPreview(null); hideTip(); });
      g.addEventListener('click', function (e) {
        e.stopPropagation();
        if (mapDragged) return;
        togglePlacePin(place.id);
      });
    });
  }

  // interacción del mapa: arrastrar, rueda, pellizco
  function initMapEvents() {
    var pointers = new Map();
    var pinch = null;
    var drag = null;

    dom.viewport.addEventListener('pointerdown', function (e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      mapDragged = false;
      if (pointers.size === 1) {
        drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      } else if (pointers.size === 2) {
        drag = null;
        var pts = [...pointers.values()];
        pinch = {
          dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
          k: view.k
        };
        // en el pellizco sí conviene capturar desde el principio
        pointers.forEach(function (_, id) {
          try { dom.viewport.setPointerCapture(id); } catch (err) { /* ignora */ }
        });
      }
      // nota: no se captura el puntero aquí. La captura retargetea el click
      // al viewport y los clics en puntos del mapa dejarían de funcionar;
      // se captura más abajo, cuando el gesto se convierte en arrastre.
    });

    dom.viewport.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2 && pinch) {
        var pts = [...pointers.values()];
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        var rect = dom.viewport.getBoundingClientRect();
        var mx = (pts[0].x + pts[1].x) / 2 - rect.left;
        var my = (pts[0].y + pts[1].y) / 2 - rect.top;
        mapDragged = true;
        view.k = pinch.k;
        zoomAt(mx, my, d / pinch.dist);
        hideTip();
        return;
      }
      if (drag && pointers.size === 1) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) {
          if (!mapDragged) {
            // arrastre real: a partir de aquí sí conviene capturar el puntero
            try { dom.viewport.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
          }
          mapDragged = true;
        }
        view.tx = drag.tx + dx;
        view.ty = drag.ty + dy;
        applyTransform();
        if (mapDragged) hideTip();
      }
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) drag = null;
    }
    dom.viewport.addEventListener('pointerup', endPointer);
    dom.viewport.addEventListener('pointercancel', endPointer);
    // un puntero sin capturar que sale del viewport y se suelta fuera no
    // genera pointerup aquí: limpiarlo evita fingir un pellizco después
    dom.viewport.addEventListener('pointerleave', function (e) {
      if (!pointers.has(e.pointerId)) return;
      var captured = false;
      try { captured = dom.viewport.hasPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
      if (!captured) endPointer(e);
    });

    dom.viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = dom.viewport.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0016));
      hideTip();
    }, { passive: false });

    dom.viewport.addEventListener('click', function (e) {
      if (mapDragged) return;
      if (e.target.closest('.place-g')) return;
      if (state.sel.place) {
        state.sel.place = null;
        applyFilterChange();
      }
    });

    var zoomBtn = function (factor) {
      return function () {
        var vw = dom.viewport.clientWidth, vh = dom.viewport.clientHeight;
        zoomAt(vw / 2, vh / 2, factor);
      };
    };
    document.querySelector('[data-zoom-in]').addEventListener('click', zoomBtn(1.4));
    document.querySelector('[data-zoom-out]').addEventListener('click', zoomBtn(1 / 1.4));
    document.querySelector('[data-zoom-fit]').addEventListener('click', fitMap);
  }

  // -- línea de tiempo -------------------------------------------------------------

  function initDomain() {
    if (!state.docs.length) { DOMAIN.d0 = -20; DOMAIN.d1 = 20; return; }
    var years = [];
    state.docs.forEach(function (d) { years.push(d.year, d.yearEnd != null ? d.yearEnd : d.year); });
    var min = Math.min.apply(null, years);
    var max = Math.max.apply(null, years);
    var pad = Math.max(2, (max - min) * 0.1);
    DOMAIN.d0 = Math.max(min - pad, TL_MIN);
    DOMAIN.d1 = Math.min(max + pad, TL_MAX);
    if (DOMAIN.d1 <= DOMAIN.d0) { DOMAIN.d0 = TL_MIN; DOMAIN.d1 = TL_MAX; }
  }

  function clampDomain() {
    DOMAIN.d0 = Math.max(DOMAIN.d0, TL_MIN);
    DOMAIN.d1 = Math.min(DOMAIN.d1, TL_MAX);
    if (DOMAIN.d1 <= DOMAIN.d0) { DOMAIN.d0 = TL_MIN; DOMAIN.d1 = TL_MAX; }
  }

  function xOf(year) { return PAD + ((year - DOMAIN.d0) / (DOMAIN.d1 - DOMAIN.d0)) * (TLW - 2 * PAD); }
  function yearAt(x) { return DOMAIN.d0 + ((x - PAD) / (TLW - 2 * PAD)) * (DOMAIN.d1 - DOMAIN.d0); }

  function zoomDomain(frac, factor) {
    var span = DOMAIN.d1 - DOMAIN.d0;
    var dataSpan = state.docs.length ? Math.max.apply(null, state.docs.map(function (d) { return d.yearEnd != null ? d.yearEnd : d.year; })) - Math.min.apply(null, state.docs.map(function (d) { return d.year; })) : 10;
    var minSpan = Math.max(2, dataSpan / 60);
    var span2 = clamp(span / factor, minSpan, span * 4);
    var center = DOMAIN.d0 + frac * span;
    DOMAIN.d0 = center - frac * span2;
    DOMAIN.d1 = DOMAIN.d0 + span2;
    clampDomain();
    renderTimeline();
  }

  function tickStep(span) {
    var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
    for (var i = 0; i < steps.length; i++) if (span / steps[i] <= 10) return steps[i];
    return 1000;
  }

  function renderTimeline() {
    docEls = new Map();
    clusters = [];
    var svg = dom.tlSvg;
    svg.innerHTML = '';

    var span = DOMAIN.d1 - DOMAIN.d0;

    // eras con al menos un documento desbloqueado
    state.eras.forEach(function (era, i) {
      if (era.to < DOMAIN.d0 || era.from > DOMAIN.d1) return;
      var x1 = Math.max(PAD, xOf(era.from));
      var x2 = Math.min(TLW - PAD, xOf(era.to));
      if (x2 - x1 < 4) return;
      var eCls = ' e' + Math.min(i, 3);
      svgEl('rect', { class: 'era-band' + eCls, x: x1, y: 0, width: x2 - x1, height: PLOT_H }, svg);
      var t = svgEl('text', { class: 'era-label' + eCls, x: x1 + 8, y: 18 }, svg);
      // si el nombre no cabe en su banda, se parte en dos líneas por el guion
      if (era.name.indexOf(' - ') > 0 && era.name.length * 6.2 > x2 - x1 - 16) {
        var parts = era.name.split(' - ');
        var ts1 = svgEl('tspan', { x: x1 + 8, y: 14 }, t);
        ts1.textContent = parts[0];
        var ts2 = svgEl('tspan', { x: x1 + 8, y: 28 }, t);
        ts2.textContent = parts[1];
      } else {
        t.textContent = era.name;
      }
    });

    // banda de rango seleccionado
    if (state.range) {
      var rx1 = xOf(state.range.from), rx2 = xOf(state.range.to);
      svgEl('rect', { class: 'range-band', x: rx1, y: 0, width: Math.max(2, rx2 - rx1), height: PLOT_H }, svg);
    }

    // eje
    svgEl('line', { class: 'tl-axis', x1: PAD, x2: TLW - PAD, y1: PLOT_H + 22, y2: PLOT_H + 22 }, svg);
    var step = tickStep(span);
    var y0 = Math.ceil(DOMAIN.d0 / step) * step;
    for (var y = y0; y <= DOMAIN.d1; y += step) {
      var x = xOf(y);
      svgEl('line', { class: 'tl-tick' + (y === 0 ? ' zero' : ''), x1: x, x2: x, y1: PLOT_H + 18, y2: PLOT_H + 26 }, svg);
      var tl = svgEl('text', { class: 'tl-tick-label' + (y === 0 ? ' zero' : ''), x: x, y: PLOT_H + 42, 'text-anchor': 'middle' }, svg);
      tl.textContent = S.fmtYear(y);
    }

    // documentos (con agrupación en zonas densas) — solo los del filtro activo
    var vis = filteredDocs();
    var items = vis.map(function (d) {
      return { d: d, x: xOf(d.year) };
    }).sort(function (a, b) { return a.x - b.x; });

    var i = 0;
    while (i < items.length) {
      var group = [items[i]];
      while (i + 1 < items.length && items[i + 1].x - group[0].x < 16) {
        i++;
        group.push(items[i]);
      }
      i++;
      if (group.length > 1) {
        var cx = (group[0].x + group[group.length - 1].x) / 2;
        var c = { x: cx, docs: group.map(function (g) { return g.d; }) };
        clusters.push(c);
        var g2 = svgEl('g', { class: 'tl-cluster', 'data-cluster': clusters.length - 1, role: 'button', tabindex: '0', 'aria-label': c.docs.length + ' documentos juntos' }, svg);
        svgEl('circle', { class: 'cluster-circle', cx: cx, cy: 56, r: 16 }, g2);
        var ct = svgEl('text', { class: 'cluster-count', x: cx, y: 60, 'text-anchor': 'middle' }, g2);
        ct.textContent = String(c.docs.length);
        g2.addEventListener('click', function (e) {
          if (tlSuppressClick) return;
          var idx = parseInt(this.getAttribute('data-cluster'), 10);
          zoomToCluster(idx);
        });
        g2.addEventListener('mouseenter', function (e) {
          var idx = parseInt(this.getAttribute('data-cluster'), 10);
          var cl = clusters[idx];
          if (cl) {
            setPreview({ type: 'docs', ids: cl.docs.map(function (d) { return d.id; }) }, true);
            showTip(clusterTipHtml(cl), e);
          }
        });
        g2.addEventListener('mousemove', moveTip);
        g2.addEventListener('mouseleave', function () { setPreview(null); hideTip(); });
        g2.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            var idx = parseInt(this.getAttribute('data-cluster'), 10);
            zoomToCluster(idx);
          }
        });
      } else {
        group.forEach(drawDocItem);
      }
    }
    updateTimelineHighlight();
    var hasDocs = state.docs.length > 0;
    var empty = !hasDocs || !vis.length;
    dom.tlEmpty.textContent = hasDocs
      ? 'Nada por aquí… todavía. Prueba otro lugar o ensancha el periodo.'
      : 'La línea de tiempo se llenará con los documentos de las historias que leas.';
    dom.tlEmpty.hidden = !empty;
    dom.tlSvg.style.display = hasDocs ? '' : 'none';
  }

  function drawDocItem(item) {
    var d = item.d;
    var color = S.storyColor(d.sequence);
    var g = svgEl('g', {
      class: 'tl-doc',
      'data-doc': d.id,
      role: 'button',
      tabindex: '0',
      'aria-label': d.label + ', ' + S.fmtYear(d.year) + ', ' + d.storyTitle
    }, dom.tlSvg);
    if (d.yearEnd != null && d.yearEnd > d.year) {
      svgEl('line', {
        x1: xOf(d.year), x2: xOf(d.yearEnd), y1: 56, y2: 56,
        stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round'
      }, g);
    }
    svgEl('circle', { class: 'tl-hit', cx: xOf(d.year), cy: 56, r: 14 }, g);
    svgEl('circle', {
      class: 'tl-point', cx: xOf(d.year), cy: 56, r: 8,
      fill: color
    }, g);
    docEls.set(d.id, g);

    g.addEventListener('mouseenter', function (e) { setPreview({ type: 'docs', ids: [d.id] }, true); showTip(docTipHtml(d), e); });
    g.addEventListener('mousemove', moveTip);
    g.addEventListener('mouseleave', function () { setPreview(null); hideTip(); });
    g.addEventListener('focus', function () { setPreview({ type: 'docs', ids: [d.id] }, true); showTipNear(g, docTipHtml(d)); });
    g.addEventListener('blur', function () { setPreview(null); hideTip(); });
    g.addEventListener('click', function (e) {
      e.stopPropagation();
      if (tlSuppressClick) return;
      openReader(d.id);
    });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReader(d.id); }
    });
  }

  function zoomToCluster(idx) {
    var c = clusters[idx];
    if (!c) return;
    var years = c.docs.map(function (d) { return d.year; });
    var yearsEnd = c.docs.map(function (d) { return d.yearEnd != null ? d.yearEnd : d.year; });
    var min = Math.min.apply(null, years), max = Math.max.apply(null, yearsEnd);
    var pad = Math.max(1, (max - min) * 0.8 + 2);
    DOMAIN.d0 = min - pad;
    DOMAIN.d1 = max + pad;
    renderTimeline();
  }

  function initTimelineEvents() {
    // clic en zona vacía de la línea de tiempo: quita el filtro de periodo
    dom.tlSvg.addEventListener('click', function (e) {
      if (tlSuppressClick) return;
      if (e.target.closest('.tl-doc') || e.target.closest('.tl-cluster')) return;
      if (state.range) clearRangeFilter();
    });

    dom.tlSvg.addEventListener('wheel', function (e) {
      e.preventDefault();
      hideTip();
      // desplazamiento horizontal: Mayús+rueda o gesto horizontal del trackpad
      var hUnits = e.shiftKey ? (e.deltaY || e.deltaX) : e.deltaX;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        var span = DOMAIN.d1 - DOMAIN.d0;
        var shift = -hUnits * 0.0016 * span;
        DOMAIN.d0 += shift;
        DOMAIN.d1 += shift;
        clampDomain();
        renderTimeline();
        return;
      }
      var rect = dom.tlSvg.getBoundingClientRect();
      var frac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      zoomDomain(frac, Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });

    dom.tlSvg.addEventListener('pointerdown', function (e) {
      var rect = dom.tlSvg.getBoundingClientRect();
      var scale = rect.width / TLW || 1;
      var x = (e.clientX - rect.left) / scale;
      var y = (e.clientY - rect.top) / scale;
      tlDrag = {
        x: x, y: y,
        mode: y > PLOT_H + 4 || e.pointerType !== 'mouse' ? 'pan' : 'range',
        d0: DOMAIN.d0, d1: DOMAIN.d1,
        band: null
      };
      // sin captura inmediata: retargetea el click al svg y los clics en
      // documentos/clústeres dejarían de funcionar; se captura en el
      // primer movimiento significativo (abajo)
    });

    dom.tlSvg.addEventListener('pointermove', function (e) {
      if (!tlDrag) return;
      var rect = dom.tlSvg.getBoundingClientRect();
      var scale = rect.width / TLW || 1;
      var x = (e.clientX - rect.left) / scale;

      if (Math.abs(x - tlDrag.x) > 4 && !tlDrag.captured) {
        tlDrag.captured = true;
        try { dom.tlSvg.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
      }

      if (tlDrag.mode === 'pan') {
        var yearsPerUnit = (tlDrag.d1 - tlDrag.d0) / (TLW - 2 * PAD);
        var shift = -(x - tlDrag.x) * yearsPerUnit;
        DOMAIN.d0 = tlDrag.d0 + shift;
        DOMAIN.d1 = tlDrag.d1 + shift;
        clampDomain();
        renderTimeline();
        return;
      }

      // selección de rango
      if (!tlDrag.band) {
        tlDrag.band = svgEl('rect', { class: 'range-band preview', x: Math.min(tlDrag.x, x), y: 0, width: 0, height: PLOT_H }, dom.tlSvg);
      }
      var x1 = Math.min(tlDrag.x, x), x2 = Math.max(tlDrag.x, x);
      tlDrag.band.setAttribute('x', x1);
      tlDrag.band.setAttribute('width', Math.max(0, x2 - x1));
      tlDrag.moved = (x2 - x1) > 5;
    });

    function endTlDrag(e) {
      if (!tlDrag) return;
      var drag = tlDrag;
      tlDrag = null;
      if (drag.band) drag.band.remove();
      if (drag.mode === 'range' && drag.moved) {
        tlSuppressClick = true;
        setTimeout(function () { tlSuppressClick = false; }, 50);
        var rect = dom.tlSvg.getBoundingClientRect();
        var scale = rect.width / TLW || 1;
        var x = (e.clientX - rect.left) / scale;
        var ya = yearAt(Math.min(drag.x, x)), yb = yearAt(Math.max(drag.x, x));
        var from = Math.floor(Math.min(ya, yb));
        var to = Math.ceil(Math.max(ya, yb));
        if (to - from < 1) to = from + 1;
        state.range = { from: from, to: to };
        applyFilterChange({ chip: true });
      }
    }
    dom.tlSvg.addEventListener('pointerup', endTlDrag);
    dom.tlSvg.addEventListener('pointercancel', endTlDrag);
    // un puntero sin capturar que sale del svg y se suelta fuera no genera
    // pointerup aquí: cerrar el arrastre evita bandas huérfanas
    dom.tlSvg.addEventListener('pointerleave', function (e) {
      if (!tlDrag) return;
      var captured = false;
      try { captured = dom.tlSvg.hasPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
      if (!captured) endTlDrag(e);
    });

    // doble clic en el fondo: volver al dominio completo
    dom.tlSvg.addEventListener('dblclick', function (e) {
      if (e.target.closest('.tl-doc') || e.target.closest('.tl-cluster')) return;
      initDomain();
      renderTimeline();
    });
  }

  function updateRangeChip() {
    var chip = dom.rangeChip;
    if (!chip) return;
    if (!state.range) { chip.hidden = true; return; }
    chip.hidden = false;
    fillFilterChip(chip, S.fmtSpan(state.range.from, state.range.to), 'Periodo seleccionado', clearRangeFilter);
  }

  // -- resaltados ------------------------------------------------------------------

  function currentHighlight() {
    var placeIds = new Set();
    var docIds = new Set();
    function addDocs(docs, withPlaces) {
      docs.forEach(function (d) {
        docIds.add(d.id);
        if (withPlaces) d.places.forEach(function (pid) { placeIds.add(pid); });
      });
    }
    var p = state.preview;
    if (p) {
      if (p.type === 'place') { placeIds.add(p.id); addDocs(docsAtPlace(p.id), true); }
      else if (p.type === 'docs') addDocs(p.ids.map(findDoc).filter(Boolean), true);
    }
    // al fijar un lugar solo se marca él: los lugares que también aparecen en
    // sus documentos no se iluminan, o parecerían seleccionados también
    if (state.sel.place) { placeIds.add(state.sel.place); addDocs(docsAtPlace(state.sel.place), false); }
    if (state.sel.doc) { var d = findDoc(state.sel.doc); if (d) addDocs([d], true); }
    return { placeIds: placeIds, docIds: docIds };
  }

  function updateHighlights(scroll) {
    updateMapHighlight();
    updateTimelineHighlight();
    updateDocsPanelHighlight(scroll);
  }

  function updateMapHighlight() {
    var h = currentHighlight();
    var visibleIds = new Set();
    filteredDocs().forEach(function (d) {
      d.places.forEach(function (pid) { visibleIds.add(pid); });
      d.places.forEach(function (pid) {
        var p = state.places.get(pid);
        while (p && p.parent) { visibleIds.add(p.parent); p = state.places.get(p.parent); }
      });
    });
    placeEls.forEach(function (g, id) {
      g.classList.toggle('lit', h.placeIds.has(id));
      g.classList.toggle('selected', state.sel.place === id);
      g.classList.toggle('dimmed', !visibleIds.has(id));
    });
  }

  function updateTimelineHighlight() {
    var h = currentHighlight();
    docEls.forEach(function (g, id) {
      g.classList.toggle('lit', h.docIds.has(id));
    });
    clusters.forEach(function (cl, i) {
      var g = dom.tlSvg.querySelector('[data-cluster="' + i + '"]');
      if (g) g.classList.toggle('lit', cl.docs.some(function (d) { return h.docIds.has(d.id); }));
    });
  }

  function updateDocsPanelHighlight(scroll) {
    if (!dom.dpList) return;
    var h = currentHighlight();
    var first = null;
    dom.dpList.querySelectorAll('.dp-entry').forEach(function (li) {
      var id = li.getAttribute('data-dp-doc');
      var lit = h.docIds.has(id);
      li.classList.toggle('lit', lit);
      li.classList.toggle('active', state.sel.doc === id);
      if (lit && !first) first = li;
    });
    if (scroll && first) centerDpEntry(first);
  }

  function centerDpEntry(li) {
    var body = dom.dpBody;
    if (!body) return;
    var br = body.getBoundingClientRect();
    var r = li.getBoundingClientRect();
    body.scrollTop += (r.top - br.top) - (body.clientHeight - r.height) / 2;
  }

  // -- lector --------------------------------------------------------------------------

  function buildReader() {
    var r = document.createElement('div');
    r.className = 'reader';
    r.hidden = true;
    r.innerHTML =
      '<div class="reader-backdrop" data-reader-close></div>' +
      '<figure class="reader-figure">' +
      '<img data-reader-img alt="">' +
      '<figcaption data-reader-caption></figcaption>' +
      '</figure>' +
      '<button type="button" class="reader-close icon-btn" data-reader-close aria-label="Cerrar">✕</button>' +
      '<div class="reader-nav">' +
      '<button type="button" class="btn" data-reader-prev>‹ Anterior</button>' +
      '<button type="button" class="btn" data-reader-next>Siguiente ›</button>' +
      '</div>';
    document.body.appendChild(r);
    dom.reader = r;
    dom.readerImg = r.querySelector('[data-reader-img]');
    dom.readerCaption = r.querySelector('[data-reader-caption]');
    dom.readerPrev = r.querySelector('[data-reader-prev]');
    dom.readerNext = r.querySelector('[data-reader-next]');
    r.querySelectorAll('[data-reader-close]').forEach(function (b) {
      b.addEventListener('click', closeReader);
    });
    dom.readerPrev.addEventListener('click', function () { readerStep(-1); });
    dom.readerNext.addEventListener('click', function () { readerStep(1); });
  }

  function storyDocsOf(doc) {
    var list = state.docs.filter(function (d) { return d.story === doc.story; });
    if (!list.length && state.readerRecs[doc.story]) {
      list = (state.readerRecs[doc.story].documents || []).slice();
    }
    return list.sort(function (a, b) { return a.order - b.order; });
  }

  function openReader(docId) {
    var d = findDocAnywhere(docId);
    if (!d) {
      // documento de una historia abierta cuyos datos aún no se han cargado
      var meta = docMeta(docId);
      if (!meta) return;
      if (S.storyStates()[meta.story] === 'locked') {
        S.toast('Esto pertenece a una historia que aún no has leído.');
        return;
      }
      S.fetchStoryData(meta.story).then(function (rec) {
        state.readerRecs[meta.story] = rec;
        openReader(docId);
      }).catch(function (err) {
        S.toast('No se pudo abrir el documento: ' + err.message);
      });
      return;
    }
    var revealed = !!findDoc(docId);
    state.readerDoc = docId;
    if (revealed) {
      var hadPlace = state.sel.place;
      state.sel.doc = docId;
      state.sel.place = null;
      syncUrl();
      updateHighlights(true);
      if (hadPlace) { renderTimeline(); renderDocsPanel(); }
    }
    if (!dom.reader) buildReader();
    updateReader();
    dom.reader.hidden = false;
    hideTip();
  }

  function updateReader() {
    var d = findDocAnywhere(state.readerDoc);
    if (!d) return;
    var list = storyDocsOf(d);
    var i = list.findIndex(function (x) { return x.id === d.id; });
    dom.readerImg.src = S.u(d.image);
    dom.readerImg.alt = d.alt;
    dom.readerCaption.innerHTML =
      (d.caption ? '<p class="reader-caption-text">' + S.esc(d.caption) + '</p>' : '') +
      '<p class="reader-caption-meta">Parte de <em>' + S.esc(d.storyTitle) + '</em>, ' +
      (d.kind === 'image' ? 'imagen ' : 'documento ') + (i + 1) + ' de ' + list.length + '</p>';
    dom.readerPrev.disabled = i <= 0;
    dom.readerNext.disabled = i >= list.length - 1;
  }

  function readerStep(delta) {
    var d = findDocAnywhere(state.readerDoc);
    if (!d) return;
    var list = storyDocsOf(d);
    var i = list.findIndex(function (x) { return x.id === d.id; });
    var next = list[i + delta];
    if (next) {
      state.readerDoc = next.id;
      if (findDoc(next.id)) {
        state.sel.doc = next.id;
        syncUrl();
        updateHighlights(true);
      }
      updateReader();
    }
  }

  function closeReader() {
    if (dom.reader) dom.reader.hidden = true;
    if (state.sel.doc) {
      state.sel.doc = null;
      syncUrl();
      updateHighlights();
    }
  }

  // -- selección -------------------------------------------------------------------------

  function setPreview(p, scroll) {
    state.preview = p;
    updateHighlights(scroll);
  }

  function togglePlacePin(id) {
    if (state.sel.place === id) state.sel.place = null;
    else { state.sel.place = id; state.sel.doc = null; }
    applyFilterChange({ scroll: true });
  }

  function clearSelection() {
    state.sel.place = null;
    state.sel.doc = null;
    state.range = null;
    closeReader();
    applyFilterChange({ chip: true });
  }

  // -- URL como estado ---------------------------------------------------------------------

  function syncUrl() {
    var params = new URLSearchParams();
    if (state.sel.place) params.set('place', state.sel.place);
    if (state.range) { params.set('from', state.range.from); params.set('to', state.range.to); }
    if (state.sel.doc) params.set('doc', state.sel.doc);
    var q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  }

  function applyUrl() {
    var params = new URLSearchParams(location.search);
    var docId = params.get('doc');
    var placeId = params.get('place');
    var from = parseInt(params.get('from'), 10);
    var to = parseInt(params.get('to'), 10);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      state.range = { from: Math.min(from, to), to: Math.max(from, to) };
    }
    if (docId != null) {
      if (docMeta(docId)) openReader(docId);
      else S.toast('Ese documento no existe o ya no está publicado.');
    }
    if (placeId != null) {
      if (state.places.has(placeId)) state.sel.place = placeId;
      else S.toast('Esto pertenece a una historia que aún no has leído.');
    }
    updateRangeChip();
  }

  // -- panel de historias ---------------------------------------------------------------

  function renderStoriesPanel() {
    var states = S.storyStates();
    var read = S.getRead();
    var html = '';
    var n = 0;
    S.bySeq().forEach(function (s) {
      var st = states[s.id];
      if (st === 'locked') return; // solo lo desbloqueado: el resto espera su turno
      if (read[s.id]) n++;
      if (st === 'open') {
        html += '<li class="sp-entry open" data-id="' + S.esc(s.id) + '">' +
          '<div class="sp-entry-head"><span class="sp-seq">' + s.sequence + '</span>' +
          '<h3 class="sp-title">' + S.esc(s.title) + '</h3></div>' +
          '<p class="sp-volume">' + S.esc(s.volume) + '</p>' +
          '<p class="sp-summary">' + S.esc(s.summary) + '</p>' +
          '<div class="sp-actions">' +
          '<button type="button" class="btn primary" data-open-story="' + S.esc(s.id) + '">Leer ahora</button>' +
          '<button type="button" class="btn ghost" data-mark-read data-id="' + S.esc(s.id) + '">Marcar como leída</button>' +
          '</div></li>';
      } else {
        html += '<li class="sp-entry read" data-id="' + S.esc(s.id) + '">' +
          '<div class="sp-entry-head"><span class="sp-seq">' + s.sequence + '</span>' +
          '<h3 class="sp-title">' + S.esc(s.title) + '</h3>' +
          '<span class="sp-check" title="Leída">✓</span></div>' +
          '<p class="sp-volume">' + S.esc(s.volume) + '</p>' +
          '<div class="sp-actions">' +
          '<button type="button" class="btn small ghost" data-open-story="' + S.esc(s.id) + '">Volver a leer</button>' +
          '</div></li>';
      }
    });
    if (!html) html = '<li class="sp-none">No hay historias disponibles todavía.</li>';
    dom.spList.innerHTML = html;
    var total = S.bySeq().length;
    dom.spCount.textContent = n + ' / ' + total;
    if (dom.spProgress) {
      dom.spProgress.querySelector('.mini-bar i').style.width = total ? (n / total * 100) + '%' : '0%';
      dom.spProgress.title = n + ' de ' + total + ' historias leídas';
      dom.spProgress.hidden = !total;
    }
  }

  // -- panel de documentos (lado derecho) ------------------------------------------------

  // centra la línea de tiempo en un año (hover del panel de documentos);
  // el dominio previo se guarda y se restaura al salir
  var hoverDomain = null;

  function centerTimelineOn(year) {
    if (!dom.tlSvg || !isFinite(year)) return;
    if (!hoverDomain) hoverDomain = { d0: DOMAIN.d0, d1: DOMAIN.d1 };
    var span = DOMAIN.d1 - DOMAIN.d0;
    var d0 = year - span / 2;
    if (d0 < TL_MIN) d0 = TL_MIN;
    if (d0 + span > TL_MAX) d0 = TL_MAX - span;
    DOMAIN.d0 = d0;
    DOMAIN.d1 = d0 + span;
    renderTimeline();
    updateTimelineHighlight();
  }

  function restoreTimelineDomain() {
    if (!hoverDomain || !dom.tlSvg) return;
    DOMAIN.d0 = hoverDomain.d0;
    DOMAIN.d1 = hoverDomain.d1;
    hoverDomain = null;
    renderTimeline();
    updateTimelineHighlight();
  }

  function bindDocHover(scope) {
    scope.querySelectorAll('[data-doc-ref]').forEach(function (b) {
      var docId = b.getAttribute('data-doc-ref');
      b.addEventListener('mouseenter', function () {
        var d = findDoc(docId);
        if (!d) return;
        setPreview({ type: 'docs', ids: [docId] });
        centerTimelineOn(d.yearEnd != null ? (d.year + d.yearEnd) / 2 : d.year);
      });
      b.addEventListener('mouseleave', function () {
        setPreview(null);
        restoreTimelineDomain();
      });
    });
  }

  // rellena un chip de filtro (texto + botón de quitar) en un elemento dado
  function fillFilterChip(chip, text, title, onRemove) {
    chip.title = title;
    chip.innerHTML = '';
    var t = document.createElement('span');
    t.textContent = text;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-close';
    btn.setAttribute('aria-label', 'Quitar el filtro');
    btn.textContent = '×';
    btn.addEventListener('click', onRemove);
    chip.appendChild(t);
    chip.appendChild(btn);
    return chip;
  }

  function makeFilterChip(text, title, onRemove) {
    var chip = document.createElement('span');
    chip.className = 'tl-range-chip';
    return fillFilterChip(chip, text, title, onRemove);
  }

  function clearPlaceFilter() {
    state.sel.place = null;
    applyFilterChange();
  }

  function clearRangeFilter() {
    state.range = null;
    applyFilterChange({ chip: true });
  }

  // -- filtros del panel de documentos ------------------------------------------------------

  function buildPlaceOptions() {
    if (!dom.placeSelect) return;
    var regions = [], points = {};
    state.places.forEach(function (p) {
      // solo lugares descubiertos: dentro de una pieza ya revelada
      var revealed = state.pieces.some(function (piece) {
        return insidePiece(p.geometry, piece);
      });
      if (!revealed) return;
      if (p.geometry.type === 'point') {
        var key = p.parent || '';
        (points[key] = points[key] || []).push(p);
      } else {
        regions.push(p);
      }
    });
    var html = '<option value="">Todos los lugares</option>';
    regions.forEach(function (r) {
      var pts = points[r.id] || [];
      if (!pts.length) {
        html += '<option value="' + S.esc(r.id) + '">' + S.esc(r.name) + '</option>';
        return;
      }
      html += '<optgroup label="' + S.esc(r.name) + '">' +
        '<option value="' + S.esc(r.id) + '">Todo ' + S.esc(r.name) + '</option>';
      pts.forEach(function (p) {
        html += '<option value="' + S.esc(p.id) + '">' + S.esc(p.name) + '</option>';
      });
      html += '</optgroup>';
    });
    // puntos sueltos sin lande padre conocido
    (points[''] || []).forEach(function (p) {
      html += '<option value="' + S.esc(p.id) + '">' + S.esc(p.name) + '</option>';
    });
    dom.placeSelect.innerHTML = html;
    syncFilterControls();
  }

  function setPlaceFilter(id) {
    state.sel.place = id || null;
    if (state.sel.place) state.sel.doc = null;
    applyFilterChange({ scroll: true });
  }

  function applyYearInputs() {
    var rawFrom = dom.yearFrom.value.trim();
    var rawTo = dom.yearTo.value.trim();
    if (rawFrom === '' && rawTo === '') {
      if (state.range) clearRangeFilter();
      return;
    }
    var from = parseInt(rawFrom, 10), to = parseInt(rawTo, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;
    if (from > to) {
      var tmp = from; from = to; to = tmp;
      dom.yearFrom.value = from; dom.yearTo.value = to;
    }
    state.range = { from: from, to: to };
    applyFilterChange({ chip: true });
  }

  // el select y los inputs reflejan el estado, venga del mapa, de la
  // línea de tiempo o de la propia URL
  function syncFilterControls() {
    if (!dom.placeSelect) return;
    dom.placeSelect.value = state.sel.place || '';
    var f = state.range ? String(Math.round(state.range.from)) : '';
    var t = state.range ? String(Math.round(state.range.to)) : '';
    if (document.activeElement !== dom.yearFrom) dom.yearFrom.value = f;
    if (document.activeElement !== dom.yearTo) dom.yearTo.value = t;
  }

  function initFilterEvents() {
    dom.placeSelect.addEventListener('change', function () {
      setPlaceFilter(dom.placeSelect.value || null);
    });
    dom.yearFrom.addEventListener('change', applyYearInputs);
    dom.yearTo.addEventListener('change', applyYearInputs);
  }

  function updateFilterChips() {
    var bar = dom.dpFilters;
    if (!bar) return;
    bar.innerHTML = '';
    if (!filterActive()) { bar.hidden = true; return; }
    if (state.sel.place) {
      var p = state.places.get(state.sel.place);
      var pname = p ? p.name : state.sel.place;
      bar.appendChild(makeFilterChip(pname, 'Lugar seleccionado', clearPlaceFilter));
    }
    if (state.range) {
      bar.appendChild(makeFilterChip(
        S.fmtSpan(state.range.from, state.range.to),
        'Periodo seleccionado',
        clearRangeFilter
      ));
    }
    bar.hidden = false;
  }

  function eraOf(year) {
    for (var i = 0; i < state.eras.length; i++) {
      if (year >= state.eras[i].from && year <= state.eras[i].to) return state.eras[i];
    }
    return null;
  }

  // eras plegadas en el panel de documentos (por nombre, persistidas)
  var ERAS_KEY = 'semiesfera.collapsedEras';
  var collapsedEras = new Set(S.storageGet(ERAS_KEY, []) || []);

  function toggleEra(name, groupEl) {
    if (collapsedEras.has(name)) collapsedEras.delete(name);
    else collapsedEras.add(name);
    S.storageSet(ERAS_KEY, Array.from(collapsedEras));
    var collapsed = collapsedEras.has(name);
    groupEl.classList.toggle('collapsed', collapsed);
    var btn = groupEl.querySelector('.dp-group-head');
    if (btn) btn.setAttribute('aria-expanded', String(!collapsed));
  }

  function renderDocsPanel() {
    if (!dom.dpList) return;
    var list = filteredDocs();
    // la historia solo se muestra en cada fila si hay más de una con documentos
    var storiesSeen = {};
    state.docs.forEach(function (d) { storiesSeen[d.story] = 1; });
    var multiStory = Object.keys(storiesSeen).length > 1;
    // grupos por era: la lista ya va en orden cronológico, así que basta con
    // abrir grupo cuando cambia la era del documento
    var groups = [];
    list.forEach(function (d) {
      var era = eraOf(d.year);
      if (!groups.length || groups[groups.length - 1].era !== era) groups.push({ era: era, docs: [] });
      groups[groups.length - 1].docs.push(d);
    });
    var html = '';
    groups.forEach(function (g) {
      var name = g.era ? g.era.name : 'Sin era';
      var collapsed = collapsedEras.has(name);
      var eIdx = g.era ? state.eras.indexOf(g.era) : -1;
      var eCls = eIdx >= 0 && eIdx < 3 ? ' e' + eIdx : '';
      html += '<li class="dp-group' + (collapsed ? ' collapsed' : '') + '">' +
        '<button type="button" class="dp-group-head' + eCls + '" data-era-toggle="' + S.esc(name) + '" aria-expanded="' + !collapsed + '">' +
        '<span class="dp-group-name">' + S.esc(name) + '</span>' +
        '<span class="dp-group-count">' + g.docs.length + '</span>' +
        '<span class="dp-group-caret" aria-hidden="true"></span>' +
        '</button><ol class="dp-group-list">';
      g.docs.forEach(function (d) {
        var span = d.yearEnd != null ? S.fmtSpan(d.year, d.yearEnd) : S.fmtYear(d.year);
        html += '<li class="dp-entry' + (d.kind === 'image' ? ' dp-image' : '') + '" data-dp-doc="' + S.esc(d.id) + '">' +
          '<button type="button" data-doc-ref="' + S.esc(d.id) + '" title="' + S.esc(d.label + ' — ' + d.storyTitle) + '">' +
          '<span class="dp-year">' + S.esc(span) + '</span>' +
          '<span class="dp-label">' + S.esc(d.label) + '</span>' +
          (multiStory ? '<span class="dp-story">' + S.esc(d.storyTitle) + '</span>' : '') +
          '</button></li>';
      });
      html += '</ol></li>';
    });
    dom.dpList.innerHTML = html;
    if (!state.docs.length) {
      dom.dpNone.textContent = 'Los documentos de las historias que marques como leídas aparecerán aquí, en orden cronológico.';
      dom.dpNone.hidden = false;
    } else if (!list.length) {
      dom.dpNone.textContent = 'Nada por aquí… todavía. Prueba otro lugar o ensancha el periodo.';
      dom.dpNone.hidden = false;
    } else {
      dom.dpNone.hidden = true;
    }
    var n = list.length;
    dom.dpCount.textContent = filterActive()
      ? n + ' de ' + state.docs.length + ' documentos'
      : (n ? n + (n === 1 ? ' documento' : ' documentos') : '');
    updateFilterChips();
    bindDocHover(dom.dpList);
    updateDocsPanelHighlight();
    if (dom.dpControls) dom.dpControls.hidden = !state.docs.length;
    syncFilterControls();
  }

  // -- visibilidad de los paneles ----------------------------------------------------------

  var PANELS_KEY = 'semiesfera.panels';

  function loadPanels() {
    var p = S.storageGet(PANELS_KEY, null);
    if (p && typeof p === 'object') {
      if (typeof p.stories === 'boolean') state.panels.stories = p.stories;
      if (typeof p.docs === 'boolean') state.panels.docs = p.docs;
    }
  }

  function savePanels() {
    S.storageSet(PANELS_KEY, state.panels);
  }

  function applyPanels() {
    if (!dom.exploreEl) return;
    dom.exploreEl.classList.toggle('stories-hidden', !state.panels.stories);
    dom.exploreEl.classList.toggle('docs-hidden', !state.panels.docs);
    document.querySelectorAll('[data-show-panel]').forEach(function (t) {
      var name = t.getAttribute('data-show-panel');
      t.hidden = !!state.panels[name];
    });
  }

  function setPanel(name, visible) {
    state.panels[name] = visible;
    savePanels();
    applyPanels();
  }

  // -- lector de historia ----------------------------------------------------------------

  function storyReaderHTML(rec, isRead) {
    var foot;
    if (!isRead) {
      foot = '<button type="button" class="btn primary" data-mark-read data-id="' + S.esc(rec.id) + '">Marcar como leída</button>';
    } else {
      foot = '<p class="sp-revealed">Has revelado: ' + S.esc(S.revealMessage(rec)) + '.</p>' +
        '<p class="sheet-foot-hint">Cierra el lector y vuelve al mapa para seguir explorando.</p>';
    }

    return '<div class="reader-backdrop" data-story-close></div>' +
      '<article class="story-sheet" data-story-sheet>' +
      '<button type="button" class="icon-btn story-close" data-story-close aria-label="Cerrar">✕</button>' +
      '<header class="story-sheet-head">' +
      '<p class="volume">' + S.esc(rec.volume) + '</p>' +
      '<h2>' + S.esc(rec.title) + '</h2>' +
      '<div class="story-sheet-grid">' +
      '<img class="cover" src="' + S.u(rec.cover) + '" alt="Portada de ' + S.esc(rec.title) + '">' +
      '<div><p class="summary">' + S.esc(rec.summary) + '</p>' +
      '<p class="sheet-links"><a class="btn small" href="' + S.u(rec.pdf) + '" download>Descargar PDF</a>' +
      ' <a class="btn small ghost" href="' + S.u('historias/' + rec.id + '/') + '">Página de la historia</a></p></div>' +
      '</div>' +
      '</header>' +
      '<div class="story-sheet-body markdown">' + rec.bodyHtml + '</div>' +
      '<footer class="story-sheet-foot">' + foot + '</footer>' +
      '</article>';
  }

  function hydrateSheetDocs(rec) {
    dom.storyReader.querySelectorAll('.doc[data-doc-src]').forEach(function (fig) {
      var img = fig.querySelector('img');
      if (img) img.src = S.u(fig.getAttribute('data-doc-src'));
    });
  }

  function fillStoryReader(rec) {
    var isRead = !!S.getRead()[rec.id];
    dom.storyReader.innerHTML = storyReaderHTML(rec, isRead);
    hydrateSheetDocs(rec);
    dom.storyReader.scrollTop = 0;
    var sheet = dom.storyReader.querySelector('[data-story-sheet]');
    if (sheet) sheet.scrollTop = 0;
    bindDocHover(dom.storyReader);
    // la barra de lectura se re-engancha tras reemplazar el contenido
    if (!state.readBar) state.readBar = S.readBar(dom.storyReader, dom.storyReader, dom.storyReader);
    else dom.storyReader.appendChild(state.readBar.el);
    state.readBar.update();
  }

  function openStoryReader(id) {
    S.fetchStoryData(id).then(function (rec) {
      state.readerStory = id;
      state.readerRecs[id] = rec;
      if (!dom.storyReader) {
        dom.storyReader = document.createElement('div');
        dom.storyReader.className = 'story-reader';
        dom.storyReader.hidden = true;
        document.body.appendChild(dom.storyReader);
      }
      fillStoryReader(rec);
      dom.storyReader.hidden = false;
    }).catch(function (err) {
      S.toast('No se pudo cargar la historia: ' + err.message);
    });
  }

  function closeStoryReader() {
    if (!dom.storyReader) return;
    dom.storyReader.hidden = true;
    state.readerStory = null;
  }

  // -- marcar como leída --------------------------------------------------------------

  function rebuildState() {
    state.pieces = [];
    state.places = new Map();
    state.docs = [];
    state.eras = [];
    prepareData(state.files);
    buildPlaceOptions();
  }

  function addRecordToState(rec) {
    if (state.files.some(function (f) { return f.id === rec.id; })) return;
    state.files.push(rec);
    rebuildState();
  }

  function refreshWorld() {
    var seenBefore = S.getSeenPieces();
    buildMap();
    initDomain();
    renderTimeline();
    fitMap();
    // si hay territorio recién revelado (y no es todo el mapa), la cámara
    // vuela hasta él para que la revelación se disfrute
    var fresh = state.pieces.filter(function (p) { return seenBefore.indexOf(p.id) < 0; });
    if (fresh.length && fresh.length < state.pieces.length) flyToBbox(piecesBbox(fresh));
    updateHighlights();
    updateHints();
    S.setSeenPieces(state.pieces.map(function (p) { return p.id; }));
  }

  function handleMarkRead(id) {
    var states = S.storyStates();
    if (states[id] === 'read') { S.toast('Ya habías marcado esta historia como leída.'); return; }
    S.markReadAndNotify(id, function (rec) {
      if (rec) {
        addRecordToState(rec);
        refreshWorld();
        // se cierran los lectores para dejar el mapa a la vista durante
        // la revelación de las piezas nuevas
        if (dom.reader && !dom.reader.hidden) closeReader();
        closeStoryReader();
      }
      renderStoriesPanel();
      renderDocsPanel();
    });
  }

  // -- avisos de estado vacío -----------------------------------------------------------

  function updateHints() {
    dom.mapHint.hidden = state.pieces.length > 0;
  }

  // -- arranque ------------------------------------------------------------------------------

  function collectDom() {
    dom.viewport = document.querySelector('[data-map-viewport]');
    dom.world = document.querySelector('[data-map-world]');
    dom.mapHint = document.querySelector('[data-map-hint]');
    dom.tlSvg = document.querySelector('[data-tl-svg]');
    dom.tlEmpty = document.querySelector('[data-tl-empty]');
    dom.rangeChip = document.querySelector('[data-range-chip]');
    dom.spList = document.querySelector('[data-sp-list]');
    dom.spCount = document.querySelector('[data-sp-count]');
    dom.spProgress = document.querySelector('[data-sp-progress]');
    dom.exploreEl = document.querySelector('[data-explore]');
    dom.dpList = document.querySelector('[data-dp-list]');
    dom.dpBody = document.querySelector('[data-dp-body]');
    dom.dpCount = document.querySelector('[data-dp-count]');
    dom.dpNone = document.querySelector('[data-dp-none]');
    dom.dpFilters = document.querySelector('[data-dp-filters]');
    dom.dpControls = document.querySelector('[data-dp-controls]');
    dom.placeSelect = document.querySelector('[data-place-select]');
    dom.yearFrom = document.querySelector('[data-year-from]');
    dom.yearTo = document.querySelector('[data-year-to]');
  }

  document.addEventListener('DOMContentLoaded', function () {
    collectDom();
    loadPanels();
    applyPanels();
    if (dom.placeSelect && dom.yearFrom && dom.yearTo) initFilterEvents();

    document.addEventListener('click', function (e) {
      var storyBtn = e.target.closest('[data-open-story]');
      if (storyBtn) { openStoryReader(storyBtn.getAttribute('data-open-story')); return; }
      var markBtn = e.target.closest('[data-mark-read]');
      if (markBtn) { handleMarkRead(markBtn.getAttribute('data-id')); return; }
      var closeStory = e.target.closest('[data-story-close]');
      if (closeStory) { closeStoryReader(); return; }
      var hideBtn = e.target.closest('[data-toggle-panel]');
      if (hideBtn) { setPanel(hideBtn.getAttribute('data-toggle-panel'), false); return; }
      var showBtn = e.target.closest('[data-show-panel]');
      if (showBtn) { setPanel(showBtn.getAttribute('data-show-panel'), true); return; }
      var eraBtn = e.target.closest('[data-era-toggle]');
      if (eraBtn) { toggleEra(eraBtn.getAttribute('data-era-toggle'), eraBtn.closest('.dp-group')); return; }
      var docBtn = e.target.closest('[data-doc-ref]');
      if (docBtn) { openReader(docBtn.getAttribute('data-doc-ref')); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (dom.storyReader && !dom.storyReader.hidden) closeStoryReader();
        else if (dom.reader && !dom.reader.hidden) closeReader();
        else clearSelection();
      } else if (dom.reader && !dom.reader.hidden && e.key === 'ArrowLeft') {
        readerStep(-1);
      } else if (dom.reader && !dom.reader.hidden && e.key === 'ArrowRight') {
        readerStep(1);
      }
    });

    S.fetchIndexData().then(function (index) {
      state.index = index;
      buildAllDocs(index);
      return S.loadUnlockedData().then(function (files) {
        state.files = files;
        rebuildState();
        initMapEvents();
        initTimelineEvents();
        refreshWorld();
        applyUrl();
        renderTimeline();
        updateHighlights();
        renderStoriesPanel();
        renderDocsPanel();
      });
    }).catch(function (err) {
      S.toast('No se pudieron cargar los datos: ' + err.message);
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitMap, 150);
    });
  });
})();
