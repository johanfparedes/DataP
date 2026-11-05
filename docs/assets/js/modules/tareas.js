/* ==========================================================================
   Módulo: Tareas (tablero Por hacer / En curso / Hecho)
   - Arrastrar y soltar entre columnas (ratón).
   - Teclado: Enter abre la tarea; Alt + ← / → la cambia de columna.
   - Móvil: una columna a la vez y botón para avanzar la tarea.
   Ruta opcional: #/tareas/<idProyecto> filtra por proyecto.
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;

  var filters = { q: '', project: '', priority: '' };
  var mobileCol = 'todo';

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  DataP.registerModule({
    id: 'tareas',
    title: 'Tareas',
    section: 'General',
    icon: 'board',
    order: 10,
    params: true,
    summary: 'Tablero con todas tus tareas: por hacer, en curso y hechas.',
    keywords: 'tablero kanban pendientes to do',
    badge: function () {
      var n = DataP.store.tasks({ open: true }).length;
      return n || null;
    },

    render: function (root, ctx) {
      var S = DataP.store;
      var UI = DataP.ui;
      var statuses = S.TASK_STATUSES;
      if (ctx.sub !== null && ctx.sub !== undefined) filters.project = ctx.sub === 'sin-proyecto' ? '__none' : ctx.sub;

      function matches(t) {
        if (filters.project === '__none' && t.projectId) return false;
        if (filters.project && filters.project !== '__none' && t.projectId !== filters.project) return false;
        if (filters.priority && t.priority !== filters.priority) return false;
        if (filters.q) {
          var hay = norm(t.title + ' ' + t.description);
          if (!norm(filters.q).split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; })) return false;
        }
        return true;
      }

      function card(t) {
        var done = t.status === 'done';
        var p = S.project(t.projectId);
        var next = t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : null;
        var meta = [p ? UI.projectTag(p) : '', UI.dueBadge(t.due, done), t.repeat ? UI.repeatBadge(t.repeat) : '', UI.subtaskBadge(t), !done ? UI.priorityBadge(t.priority) : ''].filter(Boolean).join('');
        return '<article class="tc' + (done ? ' is-done' : '') + '" draggable="true" tabindex="0" data-id="' + esc(t.id) + '" aria-label="' + esc(t.title) + '">' +
          '<button type="button" class="tcheck" data-toggle aria-pressed="' + done + '" aria-label="' + (done ? 'Marcar como pendiente' : 'Completar') + '">' + icon('check') + '</button>' +
          '<div class="tc-main"><span class="tc-title">' + esc(t.title) + '</span>' +
            (t.description ? '<span class="tc-desc">' + esc(t.description) + '</span>' : '') +
            (meta ? '<div class="tc-meta">' + meta + '</div>' : '') + '</div>' +
          (next ? '<button type="button" class="icon-btn tc-advance" data-advance="' + next + '" aria-label="Pasar a ' + esc(UI.label(statuses, next)) + '">' + icon('arrow') + '</button>' : '') +
        '</article>';
      }

      function draw() {
        var active = document.activeElement;
        var focusId = active && root.contains(active) && active.closest('[data-id]') ? active.closest('[data-id]').getAttribute('data-id') : null;
        var focusSel = active && root.contains(active) ? (active.id ? '#' + active.id : null) : null;
        var caret = active && active.id === 'board-q' ? active.selectionStart : null;

        var all = S.tasks();
        var visible = all.filter(matches);
        var openCount = all.filter(function (t) { return t.status !== 'done'; }).length;
        var doneCount = all.length - openCount;
        var anyFilter = filters.q || filters.project || filters.priority;
        var selProject = filters.project;

        var projectOpts = '<option value="">Todos los proyectos</option><option value="__none"' + (selProject === '__none' ? ' selected' : '') + '>Sin proyecto</option>' +
          S.projects().map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === selProject ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
        var prioOpts = '<option value="">Todas las prioridades</option>' + UI.options(S.PRIORITIES, filters.priority);

        var cols = statuses.map(function (st) {
          var list = visible.filter(function (t) { return t.status === st.id; });
          var total = all.filter(function (t) { return t.status === st.id; }).length;
          var countTxt = anyFilter && list.length !== total ? list.length + ' de ' + total : String(total);
          return '<section class="col col-' + st.id + (mobileCol === st.id ? ' is-shown' : '') + '" data-status="' + st.id + '" aria-labelledby="col-h-' + st.id + '">' +
            '<div class="col-head"><span class="col-ico" aria-hidden="true"></span><h2 id="col-h-' + st.id + '" style="font-size:inherit">' + esc(st.label) + '</h2>' +
              '<span class="col-count">' + esc(countTxt) + '</span><span class="grow"></span>' +
              '<button type="button" class="icon-btn" data-add="' + st.id + '" aria-label="Nueva tarea en ' + esc(st.label) + '" title="Nueva tarea">' + icon('plus') + '</button></div>' +
            (st.id === 'todo' ? '<form class="col-quick" data-quick><label class="visually-hidden" for="board-quick">Añadir tarea</label><input class="input" id="board-quick" name="title" placeholder="Añadir tarea y pulsar Enter" autocomplete="off" maxlength="200" data-smart>' + UI.smartHintSlot() + '</form>' : '') +
            '<div class="col-body" data-drop="' + st.id + '">' +
              (list.length ? list.map(card).join('') : '<div class="col-empty">' + (anyFilter ? 'Sin coincidencias' : st.id === 'done' ? 'Arrastra aquí lo terminado' : 'Arrastra tareas aquí') + '</div>') +
            '</div></section>';
        }).join('');

        var seg = statuses.map(function (st) {
          var n = visible.filter(function (t) { return t.status === st.id; }).length;
          return '<button type="button" data-seg="' + st.id + '" aria-pressed="' + (mobileCol === st.id) + '">' + esc(st.label) + ' · ' + n + '</button>';
        }).join('');

        root.innerHTML =
          '<div class="page-top">' +
            '<header class="page-header"><h1>Tareas</h1><p class="lede">' + openCount + (openCount === 1 ? ' pendiente' : ' pendientes') + ' · ' + doneCount + (doneCount === 1 ? ' hecha' : ' hechas') + '</p></header>' +
            '<div class="header-actions"><button type="button" class="btn btn-primary" data-add="todo">' + icon('plus') + 'Nueva tarea</button></div>' +
          '</div>' +
          '<div class="toolbar" role="search">' +
            '<label class="search-field"><span class="visually-hidden">Buscar tareas</span>' + icon('search') + '<input class="input" id="board-q" type="search" placeholder="Buscar tareas" value="' + esc(filters.q) + '" autocomplete="off"></label>' +
            '<label><span class="visually-hidden">Proyecto</span><select class="select" id="board-project">' + projectOpts + '</select></label>' +
            '<label><span class="visually-hidden">Prioridad</span><select class="select" id="board-priority">' + prioOpts + '</select></label>' +
            (anyFilter ? '<button type="button" class="btn btn-ghost btn-sm" data-clear>Quitar filtros</button>' : '') +
          '</div>' +
          '<div class="seg" role="group" aria-label="Columna visible">' + seg + '</div>' +
          '<div class="board">' + cols + '</div>';

        // Restaura el foco tras volver a dibujar.
        if (focusSel && root.querySelector(focusSel)) {
          var el = root.querySelector(focusSel);
          el.focus();
          if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret);
        } else if (focusId) {
          var c = root.querySelector('.tc[data-id="' + focusId + '"]');
          if (c) c.focus();
        }
      }

      /* -------- Eventos -------- */
      root.addEventListener('input', function (e) {
        if (e.target.id === 'board-q') { filters.q = e.target.value; draw(); }
      });
      root.addEventListener('change', function (e) {
        if (e.target.id === 'board-project') { filters.project = e.target.value; draw(); }
        if (e.target.id === 'board-priority') { filters.priority = e.target.value; draw(); }
      });
      root.addEventListener('submit', function (e) {
        var f = e.target.closest('[data-quick]');
        if (!f) return;
        e.preventDefault();
        var title = f.title.value.trim();
        if (!title) return;
        var projectId = filters.project && filters.project !== '__none' ? filters.project : '';
        var data = UI.quickTaskData(title, { status: 'todo', projectId: projectId });
        if (data.repeat && !data.due) data.due = S.dayStr(0);
        S.addTask(data);
      });
      root.addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('[data-clear]')) { filters = { q: '', project: '', priority: '' }; draw(); return; }
        var seg = t.closest('[data-seg]');
        if (seg) { mobileCol = seg.getAttribute('data-seg'); draw(); return; }
        var add = t.closest('[data-add]');
        if (add) {
          var projectId = filters.project && filters.project !== '__none' ? filters.project : '';
          UI.taskDialog(null, { status: add.getAttribute('data-add'), projectId: projectId });
          return;
        }
        var cardEl = t.closest('.tc[data-id]');
        if (!cardEl) return;
        var id = cardEl.getAttribute('data-id');
        if (t.closest('[data-toggle]')) { UI.toggleWithToast(id); return; }
        var adv = t.closest('[data-advance]');
        if (adv) {
          var to = adv.getAttribute('data-advance');
          S.moveTask(id, to, 0);
          UI.toast('Movida a ' + UI.label(statuses, to));
          return;
        }
        UI.taskDialog(id);
      });
      root.addEventListener('keydown', function (e) {
        var cardEl = e.target.closest && e.target.closest('.tc[data-id]');
        if (!cardEl || e.target !== cardEl) return;
        var id = cardEl.getAttribute('data-id');
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); UI.taskDialog(id); return; }
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          var t = S.task(id);
          var idx = statuses.findIndex(function (s) { return s.id === t.status; }) + (e.key === 'ArrowRight' ? 1 : -1);
          if (idx < 0 || idx >= statuses.length) return;
          S.moveTask(id, statuses[idx].id, 0);
          UI.toast('Movida a ' + statuses[idx].label);
        }
      });

      /* -------- Arrastrar y soltar -------- */
      var dragId = null;
      var line = document.createElement('div');
      line.className = 'drop-line';

      function clearDrop() {
        line.remove();
        root.querySelectorAll('.col-body.is-over').forEach(function (b) { b.classList.remove('is-over'); });
      }

      function beforeCard(body, y) {
        var cards = Array.prototype.filter.call(body.querySelectorAll('.tc'), function (c) { return c.getAttribute('data-id') !== dragId; });
        for (var i = 0; i < cards.length; i++) {
          var r = cards[i].getBoundingClientRect();
          if (y < r.top + r.height / 2) return cards[i];
        }
        return null;
      }

      root.addEventListener('dragstart', function (e) {
        var c = e.target.closest && e.target.closest('.tc[data-id]');
        if (!c) return;
        dragId = c.getAttribute('data-id');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* IE */ }
        requestAnimationFrame(function () { c.classList.add('is-dragging'); });
      });
      root.addEventListener('dragover', function (e) {
        var body = e.target.closest && e.target.closest('.col-body[data-drop]');
        if (!body || !dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        root.querySelectorAll('.col-body.is-over').forEach(function (b) { if (b !== body) b.classList.remove('is-over'); });
        body.classList.add('is-over');
        var before = beforeCard(body, e.clientY);
        var empty = body.querySelector('.col-empty');
        if (empty) return;
        if (before) body.insertBefore(line, before);
        else body.appendChild(line);
      });
      root.addEventListener('dragleave', function (e) {
        var body = e.target.closest && e.target.closest('.col-body[data-drop]');
        if (body && !body.contains(e.relatedTarget)) { body.classList.remove('is-over'); line.remove(); }
      });
      root.addEventListener('drop', function (e) {
        var body = e.target.closest && e.target.closest('.col-body[data-drop]');
        if (!body || !dragId) return;
        e.preventDefault();
        var status = body.getAttribute('data-drop');
        var before = beforeCard(body, e.clientY);
        var full = S.tasks({ status: status }).filter(function (t) { return t.id !== dragId; });
        var idx;
        if (before) idx = full.findIndex(function (t) { return t.id === before.getAttribute('data-id'); });
        else {
          var vis = Array.prototype.filter.call(body.querySelectorAll('.tc'), function (c) { return c.getAttribute('data-id') !== dragId; });
          idx = vis.length ? full.findIndex(function (t) { return t.id === vis[vis.length - 1].getAttribute('data-id'); }) + 1 : full.length;
        }
        var prevStatus = S.task(dragId).status;
        var id = dragId;
        dragId = null;
        clearDrop();
        S.moveTask(id, status, idx);
        if (status !== prevStatus) UI.toast('Movida a ' + UI.label(statuses, status));
      });
      root.addEventListener('dragend', function () {
        dragId = null;
        clearDrop();
        root.querySelectorAll('.tc.is-dragging').forEach(function (c) { c.classList.remove('is-dragging'); });
      });

      draw();
      return S.subscribe(draw);
    },
  });
})();
