/* ==========================================================================
   Módulo: Calendario
   Mes completo con las tareas en su fecha límite.
   - Arrastra una tarea a otro día para reprogramarla (o desde "Sin fecha").
   - Toca un día para ver sus tareas y añadir una con esa fecha.
   Ruta: #/calendario o #/calendario/AAAA-MM
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;

  var WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var dtMonth = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
  var dtDay = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
  var selected = null; // día seleccionado (AAAA-MM-DD), se recuerda entre visitas

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function monthKey(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function parseMonth(s) {
    var m = /^(\d{4})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, 1);
    return isNaN(d) ? null : d;
  }

  DataP.registerModule({
    id: 'calendario',
    title: 'Calendario',
    section: 'General',
    icon: 'calendar',
    order: 15,
    params: true,
    summary: 'Tus tareas por fecha. Arrastra para reprogramar.',
    keywords: 'calendario agenda fechas mes planificar programar',

    render: function (root, ctx) {
      var S = DataP.store;
      var UI = DataP.ui;
      var today = S.dayStr(0);
      var month = parseMonth(ctx.sub) || (selected ? new Date(UI.parseDay(selected).getFullYear(), UI.parseDay(selected).getMonth(), 1) : null) || UI.parseDay(today);
      month = new Date(month.getFullYear(), month.getMonth(), 1);
      if (!selected || selected.slice(0, 7) !== monthKey(month)) selected = monthKey(month) === today.slice(0, 7) ? today : monthKey(month) + '-01';
      var focusQuick = false;

      function tasksByDay() {
        var map = {};
        S.tasks().forEach(function (t) {
          if (!t.due) return;
          (map[t.due] = map[t.due] || []).push(t);
        });
        Object.keys(map).forEach(function (k) { map[k].sort(UI.byUrgency); });
        return map;
      }

      function chip(t) {
        var p = S.project(t.projectId);
        var d = UI.dueInfo(t.due, t.status === 'done');
        return '<button type="button" class="cal-task' + (p ? ' pc-' + p.color : '') + (t.status === 'done' ? ' is-done' : '') + (d && d.state === 'overdue' ? ' is-overdue' : '') + '" draggable="true" data-task="' + esc(t.id) + '" title="' + esc(t.title) + '">' +
          '<span class="cal-task-dot"></span><span class="cal-task-text">' + esc(t.title) + '</span></button>';
      }

      function draw() {
        var map = tasksByDay();
        var first = new Date(month);
        var lead = (first.getDay() + 6) % 7;
        var start = new Date(first);
        start.setDate(1 - lead);
        var daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        var cells = Math.ceil((lead + daysInMonth) / 7) * 7;
        var mk = monthKey(month);
        var monthTasks = S.tasks().filter(function (t) { return t.due && t.due.slice(0, 7) === mk; });
        var openMonth = monthTasks.filter(function (t) { return t.status !== 'done'; }).length;
        var undated = S.tasks({ open: true }).filter(function (t) { return !t.due; }).sort(UI.byUrgency);

        var grid = '';
        for (var i = 0; i < cells; i++) {
          var dt = new Date(start);
          dt.setDate(start.getDate() + i);
          var key = S.toDayStr(dt);
          var list = map[key] || [];
          var inMonth = dt.getMonth() === month.getMonth();
          var max = 3;
          var shown = list.slice(0, max);
          var more = list.length - shown.length;
          var openN = list.filter(function (t) { return t.status !== 'done'; }).length;
          var label = cap(dtDay.format(dt)) + (list.length ? ': ' + list.length + (list.length === 1 ? ' tarea' : ' tareas') : ': sin tareas');
          grid += '<div class="cal-day' + (inMonth ? '' : ' is-out') + (key === today ? ' is-today' : '') + (key === selected ? ' is-selected' : '') + (key < today ? ' is-past' : '') + '" data-day="' + key + '">' +
            '<button type="button" class="cal-num" data-select="' + key + '" aria-label="' + esc(label) + '" aria-pressed="' + (key === selected) + '">' + dt.getDate() + '</button>' +
            (openN ? '<span class="cal-count" aria-hidden="true">' + openN + '</span>' : '') +
            '<div class="cal-tasks">' + shown.map(chip).join('') +
            (more > 0 ? '<button type="button" class="cal-more" data-select="' + key + '">+' + more + ' más</button>' : '') + '</div></div>';
        }

        var selTasks = (map[selected] || []).slice();
        var selDate = UI.parseDay(selected);
        var selTitle = selected === today ? 'Hoy' : cap(dtDay.format(selDate));

        root.innerHTML =
          '<div class="page-top">' +
            '<header class="page-header"><h1>Calendario</h1><p class="lede">' +
              (openMonth ? openMonth + (openMonth === 1 ? ' tarea pendiente' : ' tareas pendientes') + ' este mes' : 'Sin tareas pendientes este mes') +
              (undated.length ? ' · ' + undated.length + ' sin fecha' : '') + '. Arrastra una tarea a otro día para reprogramarla.</p></header>' +
          '</div>' +
          '<div class="cal-layout">' +
            '<section class="card cal-card" aria-label="Mes">' +
              '<div class="cal-head">' +
                '<h2 class="cal-title">' + esc(cap(dtMonth.format(month))) + '</h2>' +
                '<div class="cal-nav">' +
                  '<button type="button" class="btn btn-sm" data-today>Hoy</button>' +
                  '<button type="button" class="icon-btn" data-month="-1" aria-label="Mes anterior">' + icon('chev-left') + '</button>' +
                  '<button type="button" class="icon-btn" data-month="1" aria-label="Mes siguiente">' + icon('chev-right') + '</button>' +
                '</div>' +
              '</div>' +
              '<div class="cal-week" aria-hidden="true">' + WEEKDAYS.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
              '<div class="cal-grid">' + grid + '</div>' +
            '</section>' +
            '<aside class="cal-side">' +
              '<section class="card" aria-labelledby="cal-sel-h">' +
                '<div class="card-head"><h2 class="card-title" id="cal-sel-h">' + esc(selTitle) + '</h2>' +
                  '<span class="chip">' + (selTasks.length ? selTasks.length + (selTasks.length === 1 ? ' tarea' : ' tareas') : 'Libre') + '</span></div>' +
                '<form class="quick-add" data-quick style="margin-top:10px"><label class="visually-hidden" for="cal-quick">Nueva tarea para este día</label>' +
                  '<input class="input" id="cal-quick" name="title" placeholder="Añadir tarea para este día" autocomplete="off" maxlength="200" data-smart>' +
                  '<button class="btn" type="submit">' + icon('plus') + '<span class="visually-hidden">Añadir</span></button>' + UI.smartHintSlot() + '</form>' +
                (selTasks.length ? '<ul class="task-list">' + selTasks.map(function (t) { return UI.taskRow(t); }).join('') + '</ul>'
                  : '<div class="empty" style="padding:18px 8px">' + icon('calendar') + 'Nada programado.</div>') +
              '</section>' +
              '<section class="card" aria-labelledby="cal-undated-h" style="margin-top:16px">' +
                '<div class="card-head"><h2 class="card-title" id="cal-undated-h">Sin fecha</h2><span class="chip">' + undated.length + '</span></div>' +
                '<p class="card-sub" style="margin:4px 0 8px">Arrástralas a un día del calendario.</p>' +
                (undated.length ? '<ul class="task-list cal-undated">' + undated.map(function (t) {
                  return UI.taskRow(t).replace('<li class="task-row', '<li draggable="true" data-task="' + esc(t.id) + '" class="task-row is-draggable');
                }).join('') + '</ul>' : '<div class="empty" style="padding:14px 8px">Todas tus tareas tienen fecha.</div>') +
              '</section>' +
            '</aside>' +
          '</div>';

        if (focusQuick) {
          var q = root.querySelector('#cal-quick');
          if (q) q.focus();
          focusQuick = false;
        }
      }

      function go(delta) {
        month = new Date(month.getFullYear(), month.getMonth() + delta, 1);
        var mk = monthKey(month);
        selected = mk === today.slice(0, 7) ? today : mk + '-01';
        DataP.setSub(mk);
        draw();
      }

      root.addEventListener('click', function (e) {
        var t = e.target;
        var m = t.closest('[data-month]');
        if (m) { go(+m.getAttribute('data-month')); return; }
        if (t.closest('[data-today]')) {
          month = new Date(UI.parseDay(today).getFullYear(), UI.parseDay(today).getMonth(), 1);
          selected = today;
          DataP.setSub(null);
          draw();
          return;
        }
        var chipEl = t.closest('.cal-task[data-task]');
        if (chipEl) { UI.taskDialog(chipEl.getAttribute('data-task')); return; }
        var sel = t.closest('[data-select]');
        var dayEl = t.closest('.cal-day[data-day]');
        if (sel || dayEl) {
          var key = sel ? sel.getAttribute('data-select') : dayEl.getAttribute('data-day');
          var d = UI.parseDay(key);
          selected = key;
          if (monthKey(d) !== monthKey(month)) { month = new Date(d.getFullYear(), d.getMonth(), 1); DataP.setSub(monthKey(month)); }
          draw();
          // En móvil, lleva al detalle del día.
          if (window.matchMedia('(max-width: 900px)').matches) {
            var side = root.querySelector('.cal-side');
            if (side) side.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });

      root.addEventListener('submit', function (e) {
        var f = e.target.closest('[data-quick]');
        if (!f) return;
        e.preventDefault();
        var text = f.title.value.trim();
        if (!text) return;
        var data = UI.quickTaskData(text, { due: selected });
        focusQuick = true;
        S.addTask(data);
        if (data.due !== selected) UI.toast('Tarea creada para ' + UI.dayLabel(data.due).toLowerCase());
        else UI.toast('Tarea creada');
      });
      UI.bindTaskList(root);

      /* -------- Arrastrar para reprogramar -------- */
      var dragId = null;
      root.addEventListener('dragstart', function (e) {
        var el = e.target.closest && e.target.closest('[data-task]');
        if (!el) return;
        dragId = el.getAttribute('data-task');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* IE */ }
        requestAnimationFrame(function () { el.classList.add('is-dragging'); });
      });
      root.addEventListener('dragover', function (e) {
        var day = e.target.closest && e.target.closest('.cal-day[data-day]');
        if (!day || !dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        root.querySelectorAll('.cal-day.is-over').forEach(function (d) { if (d !== day) d.classList.remove('is-over'); });
        day.classList.add('is-over');
      });
      root.addEventListener('dragleave', function (e) {
        var day = e.target.closest && e.target.closest('.cal-day[data-day]');
        if (day && !day.contains(e.relatedTarget)) day.classList.remove('is-over');
      });
      root.addEventListener('drop', function (e) {
        var day = e.target.closest && e.target.closest('.cal-day[data-day]');
        if (!day || !dragId) return;
        e.preventDefault();
        var id = dragId;
        dragId = null;
        var key = day.getAttribute('data-day');
        var t = S.task(id);
        if (!t || t.due === key) { draw(); return; }
        var prev = t.due;
        S.updateTask(id, { due: key });
        UI.toast('Programada para ' + UI.dayLabel(key).toLowerCase(), { action: { label: 'Deshacer', run: function () { S.updateTask(id, { due: prev }); } } });
      });
      root.addEventListener('dragend', function () {
        dragId = null;
        root.querySelectorAll('.is-over, .is-dragging').forEach(function (d) { d.classList.remove('is-over', 'is-dragging'); });
      });

      draw();
      return S.subscribe(draw);
    },
  });
})();
