// Núcleo compartido: progreso en el navegador, estados de las historias,
// datos de carga perezosa y avisos.

(function () {
  'use strict';

  var BASE = window.SEMI_BASE || '';
  var KEY = 'semiesfera.progress';
  var SEEN_KEY = 'semiesfera.seenPieces';
  var NS = 'http://www.w3.org/2000/svg';

  function u(rel) { return BASE + rel; }

  // -- utilidades -------------------------------------------------------------

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* modo privado */ }
  }

  // -- progreso -------------------------------------------------------------

  function loadProgress() {
    var raw = storageGet(KEY, null);
    return raw && typeof raw === 'object' && raw.read && typeof raw.read === 'object' ? raw : { read: {} };
  }

  function saveProgress(p) {
    storageSet(KEY, p);
  }

  function getRead() { return loadProgress().read; }

  function markRead(id) {
    var p = loadProgress();
    if (!p.read[id]) {
      p.read[id] = new Date().toISOString();
      saveProgress(p);
    }
    return p.read[id];
  }

  function resetProgress() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(SEEN_KEY);
    } catch (e) { /* nada */ }
  }

  // -- estados de las historias ----------------------------------------------

  function index() { return window.SEMI_INDEX || { stories: [] }; }

  function bySeq() {
    return index().stories.slice().sort(function (a, b) { return a.sequence - b.sequence; });
  }

  // 'read' | 'open' | 'locked'
  function storyStates() {
    var read = getRead();
    var list = bySeq();
    var states = {};
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (read[s.id]) { states[s.id] = 'read'; continue; }
      var prev = list[i - 1];
      states[s.id] = (!prev || read[prev.id]) ? 'open' : 'locked';
    }
    return states;
  }

  function openStoryId() {
    var list = bySeq();
    var read = getRead();
    for (var i = 0; i < list.length; i++) {
      var prev = list[i - 1];
      if (!read[list[i].id] && (!prev || read[prev.id])) return list[i].id;
    }
    return null;
  }

  // -- utilidades -------------------------------------------------------------

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var PALETTE = ['#e2946b', '#79b6a9', '#dfc17e', '#a48ec9', '#7fa6c9', '#c9836f', '#93c47d', '#c9c19a'];

  function storyColor(sequence) { return PALETTE[(sequence - 1) % PALETTE.length]; }

  function fmtYear(y) {
    if (y < 0) return '−' + Math.abs(y) + ' GC';
    return y + ' GC';
  }

  function fmtSpan(from, to) {
    return from === to ? fmtYear(from) : fmtYear(from) + ' – ' + fmtYear(to);
  }

  function plural(n, one, many) { return n === 1 ? ('1 ' + one) : (n + ' ' + many); }

  function revealMessage(rec) {
    return plural(rec.pieces.length, 'pieza nueva del mapa', 'piezas nuevas del mapa') + ' · ' +
      plural(rec.places.length, 'lugar', 'lugares') + ' · ' +
      plural(rec.documents.length, 'documento', 'documentos');
  }

  // -- datos (carga perezosa) --------------------------------------------------

  var dataCache = {};

  function fetchJSON(url) {
    // cache-bust: la versión cambia solo cuando cambian los datos
    if (window.SEMI_V && url.indexOf('?') < 0) url += '?v=' + window.SEMI_V;
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('No se pudo cargar ' + url + ' (' + r.status + ')');
      return r.json();
    });
  }

  function fetchIndexData() {
    if (!dataCache.__index) dataCache.__index = fetchJSON(u('data/index.json'));
    return dataCache.__index;
  }

  function fetchStoryData(id) {
    if (!dataCache[id]) dataCache[id] = fetchJSON(u('data/' + id + '.json'));
    return dataCache[id];
  }

  function loadUnlockedData() {
    var read = getRead();
    var ids = index().stories.filter(function (s) { return read[s.id]; }).map(function (s) { return s.id; });
    return Promise.all(ids.map(fetchStoryData)).then(function (list) {
      return list.filter(Boolean);
    });
  }

  // -- avisos -------------------------------------------------------------------

  var toastTimer = null;

  function toast(msg) {
    var el = document.querySelector('[data-toast]');
    if (!el) {
      el = document.createElement('div');
      el.setAttribute('data-toast', '');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.hidden = true; }, 300);
    }, 4200);
  }

  // -- reinicio de progreso (delegado, funciona en cualquier página) ----------

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-reset-progress]');
    if (!btn) return;
    if (confirm('¿Reiniciar tu progreso en este navegador? Se olvidarán todas las historias marcadas como leídas.')) {
      resetProgress();
      location.reload();
    }
  });

  // telón de fondo de la portada: solo las piezas reveladas por las historias
  // que el lector ha marcado como leídas (sin progreso, sin mapa)
  function initLandingBackdrop() {
    var holder = document.querySelector('[data-landing-map]');
    if (!holder) return;
    fetchIndexData().then(function (rec) {
      var read = getRead();
      var ids = ((rec && rec.stories) || []).filter(function (s) { return read[s.id]; }).map(function (s) { return s.id; });
      return ids.length ? Promise.all(ids.map(fetchStoryData)) : null;
    }).then(function (files) {
      if (!files) return;
      var svg = holder.querySelector('svg');
      if (!svg) return;
      var html = '';
      var seen = {};
      files.forEach(function (f) {
        (f.pieces || []).forEach(function (p) {
          if (seen[p.id]) return;
          seen[p.id] = 1;
          html += '<image href="' + u(p.file) + '" x="' + p.x + '" y="' + p.y + '" width="' + p.width + '" height="' + p.height + '"/>';
        });
      });
      svg.innerHTML = html;
    }).catch(function () { /* sin datos: sin mapa */ });
  }

  initLandingProgress();
  initLandingBackdrop();

  // -- piezas vistas (para el fundido de revelado) ------------------------------------

  function getSeenPieces() {
    var v = storageGet(SEEN_KEY, []);
    return Array.isArray(v) ? v : [];
  }

  function setSeenPieces(ids) {
    storageSet(SEEN_KEY, ids);
  }

  // línea de progreso en la portada (métrica: historias leídas / publicadas)
  function initLandingProgress() {
    var el = document.querySelector('[data-landing-progress]');
    if (!el) return;
    var idx = window.SEMI_INDEX ? Promise.resolve(index()) : fetchIndexData();
    idx.then(function (rec) {
      var stories = ((rec && rec.stories) || (window.SEMI_INDEX ? index().stories : [])) || [];
      var read = getRead();
      var total = stories.length;
      var n = 0;
      stories.forEach(function (s) { if (read[s.id]) n++; });
      if (!total || !n) return;
      var pct = Math.round((n / total) * 100);
      el.innerHTML = '<span class="mini-bar"><i style="width:' + pct + '%"></i></span>' +
        '<span>' + (n >= total
          ? 'Has leído todo lo publicado hasta ahora — ' + n + (n === 1 ? ' historia' : ' historias')
          : 'Has leído el ' + pct + '% de lo publicado — ' + n + ' de ' + total + ' historias') + '</span>';
      el.hidden = false;
    }).catch(function () { /* sin datos, sin línea */ });
  }

  // -- barra de progreso de lectura -----------------------------------------------

  // línea fina arriba del viewport que avanza con el scroll del documento;
  // scrollEl puede ser window (página) o un elemento con overflow propio
  function readBar(scrollEl, targetEl, parentEl) {
    var bar = document.createElement('div');
    bar.className = 'read-bar';
    bar.setAttribute('aria-hidden', 'true');
    var fill = document.createElement('i');
    bar.appendChild(fill);
    (parentEl || document.body).appendChild(bar);

    function update() {
      var total, done;
      if (scrollEl === window) {
        var r = targetEl.getBoundingClientRect();
        total = r.height - window.innerHeight;
        done = -r.top;
      } else {
        total = scrollEl.scrollHeight - scrollEl.clientHeight;
        done = scrollEl.scrollTop;
      }
      var pct = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
      fill.style.width = (pct * 100) + '%';
    }

    scrollEl.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return { el: bar, update: update };
  }

  // caja que rodea un conjunto de piezas del mapa
  function piecesBbox(pieces) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pieces.forEach(function (p) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x + p.width); y1 = Math.max(y1, p.y + p.height);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // -- marcar como leída (con aviso) ---------------------------------------------------

  function markReadAndNotify(id, onDone) {
    markRead(id);
    fetchStoryData(id).then(function (rec) {
      if (onDone) onDone(rec);
      toast('Historia marcada como leída: ' + revealMessage(rec) + '.');
    }).catch(function () {
      if (onDone) onDone(null);
      toast('Historia marcada como leída.');
    });
  }

  window.SEMI = {
    u: u,
    getRead: getRead,
    markRead: markRead,
    storyStates: storyStates,
    openStoryId: openStoryId,
    bySeq: bySeq,
    esc: esc,
    svgEl: svgEl,
    storageGet: storageGet,
    storageSet: storageSet,
    storyColor: storyColor,
    fmtYear: fmtYear,
    fmtSpan: fmtSpan,
    revealMessage: revealMessage,
    piecesBbox: piecesBbox,
    fetchIndexData: fetchIndexData,
    fetchStoryData: fetchStoryData,
    loadUnlockedData: loadUnlockedData,
    markReadAndNotify: markReadAndNotify,
    toast: toast,
    getSeenPieces: getSeenPieces,
    setSeenPieces: setSeenPieces,
    readBar: readBar
  };
})();
