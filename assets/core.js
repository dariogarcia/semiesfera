// Núcleo compartido: progreso en el navegador, estados de las historias,
// cabecera (contador, menú, aviso de primera visita) y avisos.

(function () {
  'use strict';

  var BASE = window.SEMI_BASE || '';
  var KEY = 'semiesfera.progress';
  var NOTICE_KEY = 'semiesfera.notice';
  var SEEN_KEY = 'semiesfera.seenPieces';

  function u(rel) { return BASE + rel; }

  // -- progreso -------------------------------------------------------------

  function loadProgress() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && typeof raw === 'object' && raw.read && typeof raw.read === 'object') return raw;
    } catch (e) { /* almacenamiento corrupto: se ignora */ }
    return { read: {} };
  }

  function saveProgress(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* modo privado */ }
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

  function readCount() {
    var read = getRead();
    var known = {};
    index().stories.forEach(function (s) { known[s.id] = 1; });
    return Object.keys(read).filter(function (id) { return known[id]; }).length;
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

  // -- datos (carga perezosa) --------------------------------------------------

  var dataCache = {};

  function fetchJSON(url) {
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

  // -- cabecera -------------------------------------------------------------------

  function initHeader() {
    var counter = document.querySelector('[data-counter]');
    if (counter) {
      var total = index().stories.length;
      var n = readCount();
      counter.textContent = n + ' de ' + total + ' historias leíd' + (n === 1 ? 'a' : 'as');
    }

    var menu = document.querySelector('[data-menu]');
    if (menu) {
      var toggle = menu.querySelector('[data-menu-toggle]');
      var dropdown = menu.querySelector('.menu-dropdown');
      toggle.addEventListener('click', function () {
        var open = dropdown.hidden;
        dropdown.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', function (e) {
        if (!menu.contains(e.target)) {
          dropdown.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    var resetBtn = document.querySelector('[data-reset-progress]');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (confirm('¿Reiniciar tu progreso en este navegador? Se olvidarán todas las historias marcadas como leídas.')) {
          resetProgress();
          location.reload();
        }
      });
    }

    var notice = document.querySelector('[data-first-notice]');
    if (notice) {
      var seen = false;
      try { seen = !!localStorage.getItem(NOTICE_KEY); } catch (e) { /* nada */ }
      if (!seen) notice.hidden = false;
      var dismiss = notice.querySelector('[data-notice-dismiss]');
      if (dismiss) dismiss.addEventListener('click', function () {
        notice.hidden = true;
        try { localStorage.setItem(NOTICE_KEY, '1'); } catch (e) { /* nada */ }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initHeader);

  // -- piezas vistas (para el fundido de revelado) ------------------------------------

  function getSeenPieces() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { return []; }
  }

  function setSeenPieces(ids) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch (e) { /* nada */ }
  }

  window.SEMI = {
    u: u,
    getRead: getRead,
    markRead: markRead,
    resetProgress: resetProgress,
    storyStates: storyStates,
    openStoryId: openStoryId,
    bySeq: bySeq,
    readCount: readCount,
    esc: esc,
    storyColor: storyColor,
    fmtYear: fmtYear,
    fmtSpan: fmtSpan,
    plural: plural,
    fetchIndexData: fetchIndexData,
    fetchStoryData: fetchStoryData,
    loadUnlockedData: loadUnlockedData,
    toast: toast,
    getSeenPieces: getSeenPieces,
    setSeenPieces: setSeenPieces
  };
})();
