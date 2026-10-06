// /explorar: mapa y línea de tiempo enlazados, panel de resultados, lector de
// documentos y estado en la URL. Solo se muestra lo desbloqueado al leer.

(function () {
  'use strict';

  var S = window.SEMI;
  var NS = 'http://www.w3.org/2000/svg';

  var TLW = 1000, TLH = 150, PLOT_H = 106, PAD = 42;
  var DOMAIN = { d0: 0, d1: 1 };

  var state = {
    index: null,
    files: [],
    pieces: [],
    places: new Map(),
    docs: [],
    eras: [],
    complete: false,
    sel: { place: null, doc: null },
    range: null,
    preview: null,
    readerDoc: null,
    readerStory: null,
    readerRecs: {},
    lockedNotice: false,
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

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function findDoc(id) {
    for (var i = 0; i < state.docs.length; i++) if (state.docs[i].id === id) return state.docs[i];
    return null;
  }

  function findDocAnywhere(id) {
    var d = findDoc(id);
    if (d) return d;
    var recs = state.readerRecs || {};
    for (var k in recs) {
      var list = recs[k].documents || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    }
    return null;
  }

  function visibleDocs() {
    if (!state.range) return state.docs;
    return state.docs.filter(function (d) {
      var y2 = d.yearEnd != null ? d.yearEnd : d.year;
      return d.year <= state.range.to && y2 >= state.range.from;
    });
  }

  function docsAtPlace(placeId) {
    var place = state.places.get(placeId);
    if (!place) return [];
    return visibleDocs().filter(function (d) {
      if (d.places.indexOf(placeId) >= 0) return true;
      if (place.geometry.type === 'circle') {
        return d.places.some(function (pid) {
          var p = state.places.get(pid);
          return p && p.parent === placeId;
        });
      }
      return false;
    });
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

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
    state.docs.sort(function (a, b) { return a.year - b.year || a.sequence - b.sequence; });
    state.complete = state.pieces.length >= state.index.totalPieces;
  }

  // -- mapa ---------------------------------------------------------------------

  function piecesBbox() {
    if (!state.pieces.length) {
      return { x: 0, y: 0, w: state.index.mapSize.width, h: state.index.mapSize.height };
    }
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    state.pieces.forEach(function (p) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x + p.width); y1 = Math.max(y1, p.y + p.height);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function applyTransform() {
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

  function updateMapScale() {
    var k = view.k;
    placeEls.forEach(function (g) {
      g.querySelectorAll('.place-dot').forEach(function (c) { c.setAttribute('r', 6 / k); });
      g.querySelectorAll('.place-label').forEach(function (t) { t.setAttribute('font-size', 13 / k); t.setAttribute('x', parseFloat(t.getAttribute('x'))); });
      g.querySelectorAll('.region-circle').forEach(function (c) { c.setAttribute('stroke-width', 2 / k); c.setAttribute('stroke-dasharray', (6 / k) + ' ' + (5 / k)); });
      g.querySelectorAll('.region-label').forEach(function (t) { t.setAttribute('font-size', 15 / k); });
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

    state.places.forEach(function (place) {
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
        svgEl('circle', { class: 'place-dot', cx: geom.x, cy: geom.y, r: 6 }, g);
        var t = svgEl('text', { class: 'place-label', x: geom.x + 10, y: geom.y + 4 }, g);
        t.textContent = place.name;
      } else {
        svgEl('circle', { class: 'region-circle', cx: geom.x, cy: geom.y, r: geom.radius }, g);
        var rt = svgEl('text', { class: 'region-label', x: geom.x, y: geom.y - geom.radius - 10, 'text-anchor': 'middle' }, g);
        rt.textContent = place.name;
      }
      placeEls.set(place.id, g);

      g.addEventListener('mouseenter', function () { setPreview({ type: 'place', id: place.id }); });
      g.addEventListener('mouseleave', function () { setPreview(null); });
      g.addEventListener('focus', function () { setPreview({ type: 'place', id: place.id }); });
      g.addEventListener('blur', function () { setPreview(null); });
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
      }
      try { dom.viewport.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
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
        return;
      }
      if (drag && pointers.size === 1) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) mapDragged = true;
        view.tx = drag.tx + dx;
        view.ty = drag.ty + dy;
        applyTransform();
      }
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) drag = null;
    }
    dom.viewport.addEventListener('pointerup', endPointer);
    dom.viewport.addEventListener('pointercancel', endPointer);

    dom.viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = dom.viewport.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });

    dom.viewport.addEventListener('click', function (e) {
      if (mapDragged) return;
      if (e.target.closest('.place-g')) return;
      if (state.sel.place) {
        state.sel.place = null;
        syncUrl();
        updateHighlights();
        renderPanel();
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
    DOMAIN.d0 = min - pad;
    DOMAIN.d1 = max + pad;
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
      svgEl('rect', { class: 'era-band' + (i % 2 ? ' alt' : ''), x: x1, y: 0, width: x2 - x1, height: PLOT_H }, svg);
      var t = svgEl('text', { class: 'era-label', x: x1 + 8, y: 18 }, svg);
      t.textContent = era.name;
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

    // documentos (con agrupación en zonas densas)
    var vis = visibleDocs();
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
        svgEl('circle', { class: 'cluster-circle', cx: cx, cy: 56, r: 14 }, g2);
        var ct = svgEl('text', { class: 'cluster-count', x: cx, y: 60, 'text-anchor': 'middle' }, g2);
        ct.textContent = String(c.docs.length);
        g2.addEventListener('click', function (e) {
          if (tlSuppressClick) return;
          var idx = parseInt(this.getAttribute('data-cluster'), 10);
          zoomToCluster(idx);
        });
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
        class: 'tl-bar', x1: xOf(d.year), x2: xOf(d.yearEnd), y1: 56, y2: 56,
        stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round'
      }, g);
    }
    svgEl('circle', {
      class: 'tl-point', cx: xOf(d.year), cy: 56, r: 6,
      fill: color
    }, g);
    docEls.set(d.id, g);

    g.addEventListener('mouseenter', function () { setPreview({ type: 'docs', ids: [d.id] }); });
    g.addEventListener('mouseleave', function () { setPreview(null); });
    g.addEventListener('focus', function () { setPreview({ type: 'docs', ids: [d.id] }); });
    g.addEventListener('blur', function () { setPreview(null); });
    g.addEventListener('click', function (e) {
      e.stopPropagation();
      if (tlSuppressClick) return;
      pinDoc(d.id);
    });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pinDoc(d.id); }
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
    dom.tlSvg.addEventListener('wheel', function (e) {
      e.preventDefault();
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
      try { dom.tlSvg.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
    });

    dom.tlSvg.addEventListener('pointermove', function (e) {
      if (!tlDrag) return;
      var rect = dom.tlSvg.getBoundingClientRect();
      var scale = rect.width / TLW || 1;
      var x = (e.clientX - rect.left) / scale;

      if (tlDrag.mode === 'pan') {
        var yearsPerUnit = (tlDrag.d1 - tlDrag.d0) / (TLW - 2 * PAD);
        var shift = -(x - tlDrag.x) * yearsPerUnit;
        DOMAIN.d0 = tlDrag.d0 + shift;
        DOMAIN.d1 = tlDrag.d1 + shift;
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
        syncUrl();
        renderTimeline();
        renderPanel();
        updateHighlights();
        updateRangeChip();
      }
    }
    dom.tlSvg.addEventListener('pointerup', endTlDrag);
    dom.tlSvg.addEventListener('pointercancel', endTlDrag);

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
    chip.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = S.fmtSpan(state.range.from, state.range.to);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-close';
    btn.setAttribute('aria-label', 'Quitar el filtro de periodo');
    btn.textContent = '×';
    btn.addEventListener('click', function () {
      state.range = null;
      syncUrl(); renderTimeline(); renderPanel(); updateHighlights(); updateRangeChip();
    });
    chip.appendChild(span);
    chip.appendChild(btn);
  }

  // -- resaltados ------------------------------------------------------------------

  function currentHighlight() {
    var placeIds = new Set();
    var docIds = new Set();
    function addDocs(docs) {
      docs.forEach(function (d) {
        docIds.add(d.id);
        d.places.forEach(function (pid) { placeIds.add(pid); });
      });
    }
    var p = state.preview;
    if (p) {
      if (p.type === 'place') { placeIds.add(p.id); addDocs(docsAtPlace(p.id)); }
      else if (p.type === 'docs') addDocs(p.ids.map(findDoc).filter(Boolean));
    }
    if (state.sel.place) { placeIds.add(state.sel.place); addDocs(docsAtPlace(state.sel.place)); }
    if (state.sel.doc) { var d = findDoc(state.sel.doc); if (d) addDocs([d]); }
    return { placeIds: placeIds, docIds: docIds };
  }

  function updateHighlights() { updateMapHighlight(); updateTimelineHighlight(); }

  function updateMapHighlight() {
    var h = currentHighlight();
    var visibleIds = new Set();
    visibleDocs().forEach(function (d) {
      d.places.forEach(function (pid) { visibleIds.add(pid); });
      d.places.forEach(function (pid) {
        var p = state.places.get(pid);
        while (p && p.parent) { visibleIds.add(p.parent); p = state.places.get(p.parent); }
      });
    });
    placeEls.forEach(function (g, id) {
      g.classList.toggle('lit', h.placeIds.has(id));
      g.classList.toggle('dimmed', !visibleIds.has(id));
    });
  }

  function updateTimelineHighlight() {
    var h = currentHighlight();
    var vis = new Set(visibleDocs().map(function (d) { return d.id; }));
    docEls.forEach(function (g, id) {
      g.classList.toggle('lit', h.docIds.has(id));
      g.classList.toggle('dimmed', !vis.has(id));
    });
  }

  // -- panel ------------------------------------------------------------------------

  function docItemHTML(d) {
    var color = S.storyColor(d.sequence);
    var span = d.yearEnd != null ? S.fmtSpan(d.year, d.yearEnd) : S.fmtYear(d.year);
    return '<li><button type="button" class="doc-item" data-open-doc="' + S.esc(d.id) + '">' +
      '<img src="' + S.u(d.image) + '" alt="' + S.esc(d.alt) + '" loading="lazy">' +
      '<span class="doc-item-info"><span class="doc-item-label">' + S.esc(d.label) + '</span>' +
      '<span class="doc-item-year">' + S.esc(span) + '</span></span>' +
      '<span class="doc-item-story"><span class="color-chip" style="background:' + color + '"></span>' + S.esc(d.storyTitle) + '</span>' +
      '</button></li>';
  }

  function listHTML(docs, title, subtitle) {
    return '<div class="panel-section"><h3>' + S.esc(title) + '</h3>' +
      (subtitle ? '<p class="panel-subtitle">' + S.esc(subtitle) + '</p>' : '') +
      '<ul class="doc-list-panel">' + docs.map(docItemHTML).join('') + '</ul></div>';
  }

  function docCardHTML(d, pinned) {
    var color = S.storyColor(d.sequence);
    var places = d.places.map(function (pid) { var p = state.places.get(pid); return p ? p.name : pid; }).join(', ');
    var span = d.yearEnd != null ? S.fmtSpan(d.year, d.yearEnd) : S.fmtYear(d.year);
    return '<div class="panel-section doc-card">' +
      '<img class="doc-card-img" src="' + S.u(d.image) + '" alt="' + S.esc(d.alt) + '">' +
      '<div class="doc-card-info">' +
      '<h3>' + S.esc(d.label) + '</h3>' +
      '<p>' + S.esc(places) + ' · ' + S.esc(span) + '</p>' +
      '<p class="doc-card-story"><span class="color-chip" style="background:' + color + '"></span>' + S.esc(d.storyTitle) + '</p>' +
      (pinned ? '<button type="button" class="btn" data-open-doc="' + S.esc(d.id) + '">Abrir documento</button>' : '') +
      '</div></div>';
  }

  function renderPanel() {
    var body = dom.panelBody;
    var title = dom.panelTitle;
    var clear = dom.clearBtn;
    var hasSel = state.sel.place || state.sel.doc || state.range;

    clear.hidden = !hasSel;
    clear.textContent = 'Limpiar';

    if (state.lockedNotice) {
      title.textContent = 'Todavía no';
      body.innerHTML = '<div class="panel-notice"><p>Esto pertenece a una historia que aún no has leído.</p>' +
        '<p>Lee las historias en orden para revelarlo.</p></div>';
    } else if (state.sel.doc) {
      var dd = findDoc(state.sel.doc);
      if (dd) {
        title.textContent = dd.label;
        body.innerHTML = docCardHTML(dd, true);
      }
    } else if (state.preview && state.preview.type === 'docs') {
      var d = findDoc(state.preview.ids[0]);
      if (d) {
        title.textContent = d.label;
        body.innerHTML = docCardHTML(d, false);
      }
    } else if (state.sel.place) {
      var pl = state.places.get(state.sel.place);
      var ds = docsAtPlace(state.sel.place);
      title.textContent = pl ? pl.name : 'Lugar';
      var subtitle = ds.length + (ds.length === 1 ? ' documento' : ' documentos');
      if (state.range) subtitle += ' · ' + S.fmtSpan(state.range.from, state.range.to);
      body.innerHTML = listHTML(ds, pl ? pl.name : 'Lugar', subtitle);
    } else if (state.preview && state.preview.type === 'place') {
      var place = state.places.get(state.preview.id);
      var docs = docsAtPlace(state.preview.id);
      title.textContent = place ? place.name : '';
      body.innerHTML = listHTML(docs, place ? place.name : 'Lugar', docs.length + (docs.length === 1 ? ' documento' : ' documentos'));
    } else if (state.range) {
      var inRange = visibleDocs();
      title.textContent = 'Periodo';
      body.innerHTML = listHTML(inRange, S.fmtSpan(state.range.from, state.range.to), inRange.length + (inRange.length === 1 ? ' documento' : ' documentos'));
    }

    var show = state.lockedNotice || hasSel || state.preview;
    dom.panel.hidden = !show;
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
    if (!list.length && state.readerRecs && state.readerRecs[doc.story]) {
      list = (state.readerRecs[doc.story].documents || []).slice();
    }
    return list.sort(function (a, b) { return a.order - b.order; });
  }

  function openReader(docId) {
    var d = findDocAnywhere(docId);
    if (!d) return;
    var revealed = !!findDoc(docId);
    state.readerDoc = docId;
    if (revealed) {
      state.sel.doc = docId;
      state.sel.place = null;
      syncUrl();
      updateHighlights();
    }
    if (!dom.reader) buildReader();
    updateReader();
    if (revealed) { renderPanel(); renderDocsPanel(); }
    dom.reader.hidden = false;
    document.body.classList.add('reader-open');
  }

  function updateReader() {
    var d = findDocAnywhere(state.readerDoc);
    if (!d) return;
    var list = storyDocsOf(d);
    var i = list.findIndex(function (x) { return x.id === d.id; });
    dom.readerImg.src = S.u(d.image);
    dom.readerImg.alt = d.alt;
    dom.readerCaption.innerHTML = 'Parte de <em>' + S.esc(d.storyTitle) + '</em>, documento ' + (i + 1) + ' de ' + list.length;
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
        renderPanel();
        syncUrl();
      }
      updateReader();
    }
  }

  function closeReader() {
    if (dom.reader) dom.reader.hidden = true;
    document.body.classList.remove('reader-open');
  }

  // -- selección -------------------------------------------------------------------------

  function setPreview(p) {
    state.preview = p;
    updateHighlights();
    renderPanel();
  }

  function togglePlacePin(id) {
    if (state.sel.place === id) state.sel.place = null;
    else { state.sel.place = id; state.sel.doc = null; }
    syncUrl();
    updateHighlights();
    renderPanel();
  }

  function pinDoc(id) {
    state.sel.doc = id;
    state.sel.place = null;
    syncUrl();
    updateHighlights();
    renderPanel();
    renderDocsPanel();
  }

  function clearSelection() {
    state.sel.place = null;
    state.sel.doc = null;
    state.range = null;
    state.lockedNotice = false;
    closeReader();
    syncUrl();
    renderTimeline();
    updateHighlights();
    renderPanel();
    renderDocsPanel();
    updateRangeChip();
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
    if (Number.isFinite(from) && Number.isFinite(to) && params.get('from') != null) {
      state.range = { from: Math.min(from, to), to: Math.max(from, to) };
    }
    if (docId != null) {
      if (findDoc(docId)) {
        state.sel.doc = docId;
        openReader(docId);
      } else {
        state.lockedNotice = true;
      }
    }
    if (placeId != null) {
      if (state.places.has(placeId)) state.sel.place = placeId;
      else state.lockedNotice = true;
    }
    updateRangeChip();
  }

  // -- panel de historias ---------------------------------------------------------------

  function storyMeta(id) {
    return S.bySeq().filter(function (s) { return s.id === id; })[0] || null;
  }

  function renderStoriesPanel() {
    var states = S.storyStates();
    var read = S.getRead();
    var html = '';
    S.bySeq().forEach(function (s) {
      var st = states[s.id];
      if (st === 'locked') return; // solo lo desbloqueado: el resto espera su turno
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
    var n = Object.keys(read).filter(function (id) { return storyMeta(id); }).length;
    dom.spCount.textContent = n + ' / ' + S.bySeq().length;
  }

  // -- panel de documentos (lado derecho) ------------------------------------------------

  function renderDocsPanel() {
    if (!dom.dpList) return;
    var html = '';
    state.docs.forEach(function (d) {
      var span = d.yearEnd != null ? S.fmtSpan(d.year, d.yearEnd) : S.fmtYear(d.year);
      html += '<li class="dp-entry' + (state.sel.doc === d.id ? ' active' : '') + '">' +
        '<button type="button" data-open-doc="' + S.esc(d.id) + '" data-doc-ref="' + S.esc(d.id) + '" title="' + S.esc(d.label) + '">' +
        '<span class="dp-year">' + S.esc(span) + '</span>' +
        '<span class="dp-label">' + S.esc(d.label) + '</span>' +
        '<span class="dp-story">' + S.esc(d.storyTitle) + '</span>' +
        '</button></li>';
    });
    dom.dpList.innerHTML = html;
    dom.dpNone.hidden = state.docs.length > 0;
    dom.dpCount.textContent = state.docs.length ? state.docs.length + (state.docs.length === 1 ? ' documento' : ' documentos') : '';
    dom.dpList.querySelectorAll('[data-doc-ref]').forEach(function (b) {
      var docId = b.getAttribute('data-doc-ref');
      b.addEventListener('mouseenter', function () { setPreview({ type: 'docs', ids: [docId] }); });
      b.addEventListener('mouseleave', function () { setPreview(null); });
    });
  }

  // -- visibilidad de los paneles ----------------------------------------------------------

  var PANELS_KEY = 'semiesfera.panels';

  function loadPanels() {
    try {
      var raw = localStorage.getItem(PANELS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (typeof p.stories === 'boolean') state.panels.stories = p.stories;
        if (typeof p.docs === 'boolean') state.panels.docs = p.docs;
      }
    } catch (e) { /* ignora */ }
  }

  function savePanels() {
    try { localStorage.setItem(PANELS_KEY, JSON.stringify(state.panels)); } catch (e) { /* ignora */ }
  }

  function applyPanels() {
    if (!dom.exploreEl) return;
    dom.exploreEl.classList.toggle('stories-hidden', !state.panels.stories);
    dom.exploreEl.classList.toggle('docs-hidden', !state.panels.docs);
    dom.panelTabs.forEach(function (t) {
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

  function revealMessage(rec) {
    return S.plural(rec.pieces.length, 'pieza nueva del mapa', 'piezas nuevas del mapa') + ' · ' +
      S.plural(rec.places.length, 'lugar', 'lugares') + ' · ' +
      S.plural(rec.documents.length, 'documento', 'documentos');
  }

  function docMetaText(d, names) {
    var places = d.places.map(function (pid) { return names[pid] || pid; }).join(', ');
    var span = d.yearEnd != null ? S.fmtSpan(d.year, d.yearEnd) : S.fmtYear(d.year);
    return places + ' · ' + span;
  }

  function storyReaderHTML(rec, isRead) {
    var names = {};
    rec.places.forEach(function (p) { names[p.id] = p.name; });
    var docs = rec.documents.map(function (d) {
      return '<li><button type="button" class="doc-ref" data-open-doc="' + S.esc(d.id) + '" data-doc-ref="' + S.esc(d.id) + '">' +
        '<img src="' + S.u(d.image) + '" alt="' + S.esc(d.alt) + '" loading="lazy">' +
        '<span class="doc-ref-info"><span class="doc-ref-label">' + S.esc(d.label) + '</span>' +
        (isRead ? '<span class="doc-ref-meta">' + S.esc(docMetaText(d, names)) + '</span>' : '') +
        '</span></button></li>';
    }).join('');

    var foot;
    if (!isRead) {
      foot = '<button type="button" class="btn primary" data-mark-read data-id="' + S.esc(rec.id) + '">Marcar como leída</button>';
    } else {
      foot = '<p class="sp-revealed">Has revelado: ' + S.esc(revealMessage(rec)) + '.</p>' +
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
      '<section class="story-sheet-docs">' +
      '<h3>Documentos</h3>' +
      '<p class="docs-hint">' + (isRead ? 'Cada documento enlaza su lugar y su fecha en el mapa y la línea de tiempo.' : 'Los lugares y fechas de los documentos se revelan al marcar la historia como leída.') + '</p>' +
      '<ol class="sheet-doc-list">' + docs + '</ol>' +
      '</section>' +
      '<footer class="story-sheet-foot">' + foot + '</footer>' +
      '</article>';
  }

  function fillStoryReader(rec) {
    var isRead = !!S.getRead()[rec.id];
    dom.storyReader.innerHTML = storyReaderHTML(rec, isRead);
    dom.storyReader.scrollTop = 0;
    var sheet = dom.storyReader.querySelector('[data-story-sheet]');
    if (sheet) sheet.scrollTop = 0;
    dom.storyReader.querySelectorAll('[data-doc-ref]').forEach(function (b) {
      var docId = b.getAttribute('data-doc-ref');
      b.addEventListener('mouseenter', function () { if (findDoc(docId)) setPreview({ type: 'docs', ids: [docId] }); });
      b.addEventListener('mouseleave', function () { setPreview(null); });
    });
  }

  function openStoryReader(id) {
    S.fetchStoryData(id).then(function (rec) {
      state.readerStory = id;
      state.readerRecs = state.readerRecs || {};
      state.readerRecs[id] = rec;
      if (!dom.storyReader) {
        dom.storyReader = document.createElement('div');
        dom.storyReader.className = 'story-reader';
        dom.storyReader.hidden = true;
        document.body.appendChild(dom.storyReader);
      }
      fillStoryReader(rec);
      dom.storyReader.hidden = false;
      document.body.classList.add('story-open');
    }).catch(function (err) {
      S.toast('No se pudo cargar la historia: ' + err.message);
    });
  }

  function closeStoryReader() {
    if (!dom.storyReader) return;
    dom.storyReader.hidden = true;
    document.body.classList.remove('story-open');
    state.readerStory = null;
  }

  // -- marcar como leída --------------------------------------------------------------

  function rebuildState() {
    state.pieces = [];
    state.places = new Map();
    state.docs = [];
    state.eras = [];
    prepareData(state.files);
  }

  function addRecordToState(rec) {
    if (state.files.some(function (f) { return f.id === rec.id; })) return;
    state.files.push(rec);
    rebuildState();
  }

  function refreshWorld() {
    buildMap();
    initDomain();
    renderTimeline();
    fitMap();
    updateHighlights();
    updateHints();
    S.setSeenPieces(state.pieces.map(function (p) { return p.id; }));
  }

  function handleMarkRead(id) {
    var states = S.storyStates();
    if (states[id] === 'read') { S.toast('Ya habías marcado esta historia como leída.'); return; }
    S.markRead(id);
    S.fetchStoryData(id).then(function (rec) {
      addRecordToState(rec);
      refreshWorld();
      renderStoriesPanel();
      renderDocsPanel();
      if (state.readerStory === id) fillStoryReader(rec);
      S.toast('Historia marcada como leída: ' + revealMessage(rec) + '.');
    }).catch(function () {
      renderStoriesPanel();
      renderDocsPanel();
      S.toast('Historia marcada como leída.');
    });
  }

  // -- avisos de estado vacío -----------------------------------------------------------

  function updateHints() {
    dom.mapHint.hidden = state.pieces.length > 0;
    dom.tlEmpty.hidden = state.docs.length > 0;
    dom.tlSvg.style.display = state.docs.length ? '' : 'none';
  }

  // -- arranque ------------------------------------------------------------------------------

  function collectDom() {
    dom.viewport = document.querySelector('[data-map-viewport]');
    dom.world = document.querySelector('[data-map-world]');
    dom.mapHint = document.querySelector('[data-map-hint]');
    dom.tlSvg = document.querySelector('[data-tl-svg]');
    dom.tlEmpty = document.querySelector('[data-tl-empty]');
    dom.rangeChip = document.querySelector('[data-range-chip]');
    dom.panel = document.querySelector('[data-panel]');
    dom.panelBody = document.querySelector('[data-panel-body]');
    dom.panelTitle = document.querySelector('[data-panel-title]');
    dom.clearBtn = document.querySelector('[data-clear]');
    dom.panelClose = document.querySelector('[data-panel-close]');
    dom.spList = document.querySelector('[data-sp-list]');
    dom.spCount = document.querySelector('[data-sp-count]');
    dom.exploreEl = document.querySelector('[data-explore]');
    dom.dpList = document.querySelector('[data-dp-list]');
    dom.dpCount = document.querySelector('[data-dp-count]');
    dom.dpNone = document.querySelector('[data-dp-none]');
    dom.panelTabs = Array.prototype.slice.call(document.querySelectorAll('[data-show-panel]'));
  }

  document.addEventListener('DOMContentLoaded', function () {
    collectDom();
    loadPanels();
    applyPanels();

    dom.clearBtn.addEventListener('click', clearSelection);
    dom.panelClose.addEventListener('click', clearSelection);

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
      var docBtn = e.target.closest('[data-open-doc]');
      if (docBtn) { openReader(docBtn.getAttribute('data-open-doc')); }
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
      return S.loadUnlockedData().then(function (files) {
        state.files = files;
        rebuildState();
        buildMap();
        initMapEvents();
        initDomain();
        initTimelineEvents();
        renderTimeline();
        fitMap();
        applyUrl();
        updateHighlights();
        renderPanel();
        renderStoriesPanel();
        renderDocsPanel();
        updateHints();
        S.setSeenPieces(state.pieces.map(function (p) { return p.id; }));
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
