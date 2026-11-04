/* ==========================================================================
   Módulo: Notas
   Lista + editor con guardado automático y vista previa con formato simple.
   Ruta: #/notas o #/notas/<idNota>
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;

  var listFilter = { q: '', project: '' };
  var modeFor = { id: null, mode: null };

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  DataP.registerModule({
    id: 'notas',
    title: 'Notas',
    section: 'General',
    icon: 'note',
    order: 20,
    params: true,
    summary: 'Apuntes con formato simple, vinculados a tus proyectos.',
    keywords: 'apuntes ideas documentos',
    badge: function () { return DataP.store.notes().length || null; },

    render: function (root, ctx) {
      var S = DataP.store;
      var UI = DataP.ui;
      var wide = window.matchMedia('(min-width: 761px)').matches;
      var currentId = ctx.sub && S.note(ctx.sub) ? ctx.sub : null;
      if (!currentId && !ctx.sub && wide) {
        var first = S.notes()[0];
        if (first) currentId = first.id;
      }
      var missing = ctx.sub && !S.note(ctx.sub);
      var saveTimer = null;
      var selfEdit = false;

      function visibleNotes() {
        return S.notes().filter(function (n) {
          if (listFilter.project === '__none' && n.projectId) return false;
          if (listFilter.project && listFilter.project !== '__none' && n.projectId !== listFilter.project) return false;
          if (listFilter.q) {
            var hay = norm(n.title + ' ' + n.body);
            return norm(listFilter.q).split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
          }
          return true;
        });
      }

      function listHtml() {
        var list = visibleNotes();
        if (!list.length) {
          return '<li class="empty">' + icon('note') + (S.notes().length ? 'Sin coincidencias.' : 'Aún no hay notas.') + '</li>';
        }
        return list.map(function (n) {
          var p = S.project(n.projectId);
          return '<li><a class="note-item" href="#/notas/' + encodeURIComponent(n.id) + '"' + (n.id === currentId ? ' aria-current="true"' : '') + '>' +
            '<span class="note-item-title"><span>' + esc(n.title || 'Nota sin título') + '</span>' + (n.pinned ? icon('pin') : '') + '</span>' +
            '<span class="note-item-excerpt">' + esc(UI.plain(n.body) || 'Nota vacía') + '</span>' +
            '<span class="note-item-meta">' + (p ? UI.projectTag(p) : '') + '<span>' + esc(UI.relTime(n.updatedAt)) + '</span></span>' +
          '</a></li>';
        }).join('');
      }

      function words(text) {
        var m = String(text || '').trim().match(/\S+/g);
        return m ? m.length : 0;
      }

      function editorHtml() {
        if (missing) {
          return '<div class="note-empty"><div class="empty">' + icon('alert') + 'Esta nota ya no existe.<a class="btn btn-sm" href="#/notas">Volver a las notas</a></div></div>';
        }
        var n = currentId ? S.note(currentId) : null;
        if (!n) {
          return '<div class="note-empty"><div class="empty">' + icon('note') + 'Elige una nota o crea una nueva.' +
            '<button type="button" class="btn btn-primary btn-sm" data-new>' + icon('plus') + 'Nueva nota</button></div></div>';
        }
        if (modeFor.id !== n.id) modeFor = { id: n.id, mode: n.body.trim() ? 'preview' : 'edit' };
        var preview = modeFor.mode === 'preview';
        return '<div class="note-toolbar">' +
            '<a class="icon-btn back-btn" href="#/notas" aria-label="Volver a la lista">' + icon('back') + '</a>' +
            '<label><span class="visually-hidden">Proyecto de la nota</span><select class="select" id="note-project">' + UI.projectOptions(n.projectId) + '</select></label>' +
            '<div class="seg-inline" role="group" aria-label="Modo"><button type="button" data-mode="edit" aria-pressed="' + !preview + '">Escribir</button>' +
              '<button type="button" data-mode="preview" aria-pressed="' + preview + '">Vista previa</button></div>' +
            '<span class="grow"></span>' +
            '<button type="button" class="icon-btn" data-pin aria-pressed="' + !!n.pinned + '" aria-label="' + (n.pinned ? 'Desfijar nota' : 'Fijar nota arriba') + '" title="' + (n.pinned ? 'Desfijar' : 'Fijar arriba') + '">' + icon('pin') + '</button>' +
            '<button type="button" class="icon-btn" data-delete aria-label="Eliminar nota" title="Eliminar">' + icon('trash') + '</button>' +
          '</div>' +
          '<div class="note-content">' +
            '<label class="visually-hidden" for="note-title">Título</label>' +
            '<input class="note-title-input" id="note-title" value="' + esc(n.title) + '" placeholder="Título" maxlength="160" autocomplete="off">' +
            (preview
              ? '<div class="md" id="note-preview" title="Haz clic para editar">' + (UI.markdown(n.body) || '<p style="color:var(--muted)">Nota vacía. Pulsa “Escribir” para empezar.</p>') + '</div>'
              : '<label class="visually-hidden" for="note-body">Contenido</label><textarea class="note-body" id="note-body" placeholder="Escribe aquí… Usa ## para títulos, - para listas, **negrita** y - [ ] para pendientes.">' + esc(n.body) + '</textarea>') +
          '</div>' +
          '<div class="note-foot"><span id="note-saved">Guardado · ' + esc(UI.relTime(n.updatedAt)) + '</span><span id="note-words">' + words(n.body) + ' palabras</span></div>';
      }

      function draw() {
        // Conserva el foco y la posición del cursor al volver a dibujar.
        var act = document.activeElement;
        var keepId = act && root.contains(act) && /^(notes-q|note-title|note-body)$/.test(act.id) ? act.id : null;
        var selStart = keepId ? act.selectionStart : null;
        var selEnd = keepId ? act.selectionEnd : null;
        var projectOpts = '<option value="">Todos los proyectos</option><option value="__none"' + (listFilter.project === '__none' ? ' selected' : '') + '>Sin proyecto</option>' +
          S.projects().map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === listFilter.project ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
        root.innerHTML =
          '<div class="page-top"><header class="page-header"><h1>Notas</h1><p class="lede">' + S.notes().length + (S.notes().length === 1 ? ' nota' : ' notas') + ' · se guardan solas mientras escribes.</p></header>' +
          '<div class="header-actions"><button type="button" class="btn btn-primary" data-new>' + icon('plus') + 'Nueva nota</button></div></div>' +
          '<div class="notes-layout' + (currentId || missing ? ' has-note' : '') + '">' +
            '<aside class="notes-side" aria-label="Lista de notas">' +
              '<div class="notes-side-head">' +
                '<label class="search-field"><span class="visually-hidden">Buscar notas</span>' + icon('search') + '<input class="input" id="notes-q" type="search" placeholder="Buscar notas" value="' + esc(listFilter.q) + '" autocomplete="off"></label>' +
                '<label><span class="visually-hidden">Filtrar por proyecto</span><select class="select" id="notes-project" style="width:100%">' + projectOpts + '</select></label>' +
              '</div>' +
              '<ul class="notes-list" id="notes-list">' + listHtml() + '</ul>' +
            '</aside>' +
            '<section class="note-editor" id="note-editor" aria-label="Editor de nota">' + editorHtml() + '</section>' +
          '</div>';
        autoGrow();
        if (keepId) {
          var el = root.querySelector('#' + keepId);
          if (el) {
            el.focus();
            try { if (selStart != null) el.setSelectionRange(selStart, selEnd); } catch (e) { /* tipo sin selección */ }
          }
        }
      }

      function autoGrow() {
        var ta = root.querySelector('#note-body');
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.max(340, ta.scrollHeight + 2) + 'px';
      }

      function scheduleSave() {
        var saved = root.querySelector('#note-saved');
        if (saved) saved.textContent = 'Guardando…';
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flush, 350);
      }

      function flush() {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (!currentId || !S.note(currentId)) return;
        var titleEl = root.querySelector('#note-title');
        var bodyEl = root.querySelector('#note-body');
        var patch = {};
        if (titleEl) patch.title = titleEl.value;
        if (bodyEl) patch.body = bodyEl.value;
        var n = S.note(currentId);
        if (patch.title === n.title && (patch.body == null || patch.body === n.body)) {
          var s0 = root.querySelector('#note-saved');
          if (s0) s0.textContent = 'Guardado · ' + UI.relTime(n.updatedAt);
          return;
        }
        selfEdit = true;
        S.updateNote(currentId, patch);
        selfEdit = false;
      }

      function onStore(change) {
        if (selfEdit && change.kind === 'note' && change.id === currentId) {
          // Cambio propio mientras se escribe: actualizar solo la lista y el pie.
          var listEl = root.querySelector('#notes-list');
          if (listEl) listEl.innerHTML = listHtml();
          var saved = root.querySelector('#note-saved');
          if (saved) saved.textContent = 'Guardado · hace un momento';
          var w = root.querySelector('#note-words');
          var b = root.querySelector('#note-body');
          if (w && b) w.textContent = words(b.value) + ' palabras';
          return;
        }
        // Antes de redibujar, guarda lo que se esté escribiendo para no perderlo.
        if (saveTimer) flush();
        if (currentId && !S.note(currentId)) { currentId = null; }
        draw();
      }

      root.addEventListener('input', function (e) {
        if (e.target.id === 'notes-q') { listFilter.q = e.target.value; var l = root.querySelector('#notes-list'); l.innerHTML = listHtml(); return; }
        if (e.target.id === 'note-title' || e.target.id === 'note-body') {
          if (e.target.id === 'note-body') autoGrow();
          scheduleSave();
        }
      });
      root.addEventListener('change', function (e) {
        if (e.target.id === 'notes-project') { listFilter.project = e.target.value; root.querySelector('#notes-list').innerHTML = listHtml(); }
        if (e.target.id === 'note-project' && currentId) { flush(); S.updateNote(currentId, { projectId: e.target.value }); }
      });
      root.addEventListener('keydown', function (e) {
        if (e.target.id === 'note-title' && e.key === 'Enter') {
          e.preventDefault();
          if (modeFor.mode === 'preview') { modeFor.mode = 'edit'; flush(); draw(); }
          var b = root.querySelector('#note-body');
          if (b) b.focus();
        }
      });
      root.addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('[data-new]')) {
          var projectId = listFilter.project && listFilter.project !== '__none' ? listFilter.project : '';
          flush();
          // Se muestra la nota nueva al instante (sin esperar al cambio de ruta) para
          // que lo que se escriba vaya siempre a la nota correcta.
          var n = S.addNote({ projectId: projectId });
          currentId = n.id;
          missing = false;
          modeFor = { id: n.id, mode: 'edit' };
          draw();
          DataP.setSub(n.id);
          var ti = root.querySelector('#note-title');
          if (ti) ti.focus();
          return;
        }
        var m = t.closest('[data-mode]');
        if (m) {
          flush();
          modeFor.mode = m.getAttribute('data-mode');
          draw();
          var target = root.querySelector(modeFor.mode === 'edit' ? '#note-body' : '[data-mode="preview"]');
          if (target) target.focus();
          return;
        }
        if (t.closest('#note-preview') && !t.closest('a')) {
          modeFor.mode = 'edit';
          draw();
          var ta = root.querySelector('#note-body');
          if (ta) ta.focus();
          return;
        }
        if (t.closest('[data-pin]') && currentId) {
          flush();
          var note = S.note(currentId);
          S.updateNote(currentId, { pinned: !note.pinned });
          return;
        }
        if (t.closest('[data-delete]') && currentId) {
          flush();
          var removedId = currentId;
          var r = S.removeNote(removedId);
          currentId = null;
          DataP.navigate('notas');
          UI.toast('Nota eliminada', { action: { label: 'Deshacer', run: function () { r.undo(); DataP.navigate('notas', removedId); } } });
        }
      });

      draw();
      var unsub = S.subscribe(onStore);
      return function () {
        flush();
        unsub();
      };
    },
  });
})();
