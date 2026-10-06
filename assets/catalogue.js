// Catálogo: estados (leída / abierta / bloqueada), marcar como leída y saltar adelante.

(function () {
  'use strict';

  var S = window.SEMI;

  function refresh() {
    var states = S.storyStates();
    var list = document.querySelector('[data-story-list]');
    if (!list) return;
    list.querySelectorAll('.story-entry').forEach(function (li) {
      var id = li.getAttribute('data-id');
      var state = states[id] || 'locked';
      li.classList.remove('read', 'open', 'locked');
      li.classList.add(state);
      var mark = li.querySelector('[data-mark-read]');
      var link = li.querySelector('[data-read-link]');
      if (mark) {
        if (state === 'read') {
          mark.disabled = true;
          mark.textContent = 'Leída';
        } else {
          mark.disabled = false;
          mark.textContent = 'Marcar como leída';
        }
      }
      if (link) {
        if (state === 'open') link.textContent = 'Leer ahora';
        else link.textContent = 'Leer';
        link.classList.toggle('primary', state === 'open');
      }
    });
    var counter = document.querySelector('[data-counter]');
    if (counter) {
      var total = (window.SEMI_INDEX.stories || []).length;
      var n = S.readCount();
      counter.textContent = n + ' de ' + total + ' historias leíd' + (n === 1 ? 'a' : 'as');
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
    refresh();

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mark-read]');
      if (!btn) return;
      var li = btn.closest('.story-entry');
      var id = btn.getAttribute('data-id');
      var states = S.storyStates();
      var state = li ? (states[id] || 'locked') : 'open';

      var doMark = function () {
        S.markRead(id);
        S.fetchStoryData(id).then(function (data) {
          S.toast('Historia marcada como leída: ' + revealMessage(data) + '.');
        }).catch(function () {
          S.toast('Historia marcada como leída.');
        });
        refresh();
      };

      if (state === 'locked') {
        if (confirm('Esta historia aún está bloqueada. Marcarla como leída desbloqueará sus lugares y fechas, y puede revelar detalles del mundo. ¿Continuar?')) {
          doMark();
        }
      } else if (state === 'open') {
        doMark();
      } else {
        S.toast('Ya habías marcado esta historia como leída.');
      }
    });
  });
})();
