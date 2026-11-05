/* ==========================================================================
   Módulo: Panel (Inicio)
   Resumen del día: tareas próximas, avance de proyectos y notas recientes.
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;

  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function kpi(ico, label, value, note) {
    return '<div class="card kpi"><span class="kpi-ico">' + icon(ico) + '</span><div class="stat">' +
      '<span class="stat-label">' + esc(label) + '</span><span class="stat-value">' + esc(value) + '</span>' +
      '<span class="stat-note">' + esc(note) + '</span></div></div>';
  }

  DataP.registerModule({
    id: 'inicio',
    title: 'Panel',
    navLabel: 'Panel',
    section: 'General',
    icon: 'home',
    order: 0,
    summary: 'Resumen del día: tareas, hábitos, enfoque, proyectos y notas.',
    keywords: 'inicio resumen hoy dashboard',

    render: function (root) {
      var S = DataP.store;
      var UI = DataP.ui;
      var focusQuick = false;

      function draw() {
        var tasks = S.tasks();
        var open = tasks.filter(function (t) { return t.status !== 'done'; });
        var overdue = open.filter(function (t) { var d = UI.daysFromToday(t.due); return d != null && d < 0; });
        var week = open.filter(function (t) { var d = UI.daysFromToday(t.due); return d != null && d >= 0 && d <= 7; });
        var weekAgo = Date.now() - 7 * 86400000;
        var doneWeek = tasks.filter(function (t) { return t.status === 'done' && Date.parse(t.completedAt) >= weekAgo; });
        var projects = S.projects();
        var projectsWithOpen = {};
        open.forEach(function (t) { if (t.projectId) projectsWithOpen[t.projectId] = true; });

        var lede = open.length
          ? 'Tienes ' + plural(open.length, 'tarea pendiente', 'tareas pendientes') +
            (overdue.length ? ', ' + plural(overdue.length, 'atrasada', 'atrasadas') : '') +
            (week.length ? (overdue.length ? ' y ' : ', ') + week.length + ' para esta semana' : '') + '.'
          : 'No tienes tareas pendientes. Buen momento para planear lo siguiente.';

        var upcoming = open.slice().sort(UI.byUrgency).slice(0, 7);
        var todayKey = S.dayStr(0);
        var focusTodayList = S.focusSessions().filter(function (f) { return S.toDayStr(new Date(f.endedAt)) === todayKey; });
        var focusToday = focusTodayList.reduce(function (a, f) { return a + f.minutes; }, 0);
        var focusSessionsToday = focusTodayList.length;
        var habitsToday = S.habits().filter(function (h) { return S.habitDue(h, todayKey); });
        var habitsDone = habitsToday.filter(function (h) { return h.log[todayKey]; }).length;
        var F = DataP.focus;
        var fst = F ? F.state() : null;
        var ftask = fst && fst.taskId ? S.task(fst.taskId) : null;
        var notes = S.notes().slice().sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); }).slice(0, 3);

        root.innerHTML =
          '<div class="page-top">' +
            '<header class="page-header">' +
              '<span class="eyebrow">' + esc(UI.longDate()) + '</span>' +
              '<h1>' + greeting() + '</h1>' +
              '<p class="lede">' + esc(lede) + '</p>' +
            '</header>' +
            '<div class="header-actions">' +
              '<button type="button" class="btn btn-primary" data-act="new-task">' + icon('plus') + 'Nueva tarea</button>' +
              '<button type="button" class="btn" data-act="new-note">' + icon('note') + 'Nueva nota</button>' +
            '</div>' +
          '</div>' +

          '<div class="grid grid-4">' +
            kpi('inbox', 'Pendientes', String(open.length), Object.keys(projectsWithOpen).length ? 'En ' + plural(Object.keys(projectsWithOpen).length, 'proyecto', 'proyectos') : 'Sin proyecto asignado') +
            kpi('calendar', 'Para esta semana', String(week.length), overdue.length ? plural(overdue.length, 'atrasada', 'atrasadas') : 'Ninguna atrasada') +
            kpi('check-circle', 'Hechas en 7 días', String(doneWeek.length), 'De ' + tasks.length + ' en total') +
            kpi('timer', 'Enfoque hoy', UI.fmtMinutes(focusToday), focusSessionsToday ? plural(focusSessionsToday, 'bloque terminado', 'bloques terminados') : 'Empieza un bloque de 25 min') +
          '</div>' +

          '<div class="panel-grid" style="margin-top:16px">' +
            '<section class="card" aria-labelledby="h-upcoming">' +
              '<div class="card-head"><h2 class="card-title" id="h-upcoming">Próximas tareas</h2><a class="link-more" href="#/tareas">Ver tablero</a></div>' +
              '<form class="quick-add" data-quick><label class="visually-hidden" for="quick-task">Nueva tarea</label>' +
                '<input class="input" id="quick-task" name="title" placeholder="Ej.: Llamar a Ana mañana !alta #proyecto" autocomplete="off" maxlength="200" data-smart>' +
                '<button class="btn" type="submit">' + icon('plus') + '<span class="visually-hidden">Añadir</span></button>' + UI.smartHintSlot() + '</form>' +
              (upcoming.length
                ? '<ul class="task-list" data-tasks>' + upcoming.map(function (t) { return UI.taskRow(t); }).join('') + '</ul>'
                : '<div class="empty">' + icon('check-circle') + 'Todo al día.</div>') +
            '</section>' +

            '<div class="panel-side">' +
            '<section class="card" aria-labelledby="h-habits">' +
              '<div class="card-head"><h2 class="card-title" id="h-habits">Hábitos de hoy</h2><a class="link-more" href="#/habitos">' + (habitsToday.length ? habitsDone + ' de ' + habitsToday.length : 'Ver hábitos') + '</a></div>' +
              (habitsToday.length ? '<ul class="habit-today">' + habitsToday.map(function (h) {
                var st = S.habitStats(h.id);
                var done = !!h.log[todayKey];
                return '<li class="pc-' + h.color + '"><button type="button" class="habit-check sm' + (done ? ' is-done' : '') + '" data-habit-today="' + esc(h.id) + '" aria-pressed="' + done + '" aria-label="' + esc((done ? 'Desmarcar: ' : 'Marcar: ') + h.name) + '">' + icon('check') + '</button>' +
                  '<span class="ht-name' + (done ? ' is-done' : '') + '">' + esc(h.name) + '</span>' +
                  (st.streak ? '<span class="ht-streak" title="Racha">' + icon('flame') + st.streak + '</span>' : '') + '</li>';
              }).join('') + '</ul>' : '<div class="empty" style="padding:16px 8px">' + icon('flame') + (S.habits().length ? 'Hoy no toca ningún hábito.' : '<span>Crea tu primer hábito.</span><a class="btn btn-sm" href="#/habitos">Ir a Hábitos</a>') + '</div>') +
            '</section>' +
            (fst ? '<section class="card focus-mini' + (fst.mode !== 'focus' ? ' is-break' : '') + '" aria-labelledby="h-focus">' +
              '<div class="card-head"><h2 class="card-title" id="h-focus">Enfoque</h2><a class="link-more" href="#/enfoque">Abrir</a></div>' +
              '<div class="fm-row"><span class="fm-time" data-panel-clock>' + F.clock(fst.remaining) + '</span>' +
                '<span class="fm-txt"><strong>' + esc(fst.running ? fst.modeLabel + ' en marcha' : fst.paused ? 'En pausa' : 'Listo para empezar') + '</strong><span>' + esc(ftask ? ftask.title : 'Sin tarea concreta') + '</span></span>' +
                '<button type="button" class="btn ' + (fst.running ? '' : 'btn-primary') + ' btn-sm" data-act="focus">' + icon(fst.running ? 'pause' : 'play') + (fst.running ? 'Pausar' : fst.paused ? 'Seguir' : 'Empezar') + '</button></div>' +
            '</section>' : '') +
            '<section class="card" aria-labelledby="h-projects">' +
              '<div class="card-head"><h2 class="card-title" id="h-projects">Proyectos</h2><a class="link-more" href="#/proyectos">Ver todos</a></div>' +
              (projects.length ? '<div>' + projects.map(function (p) {
                var pr = S.projectProgress(p.id);
                return '<a class="proj-row pc-' + p.color + '" href="#/proyectos/' + encodeURIComponent(p.id) + '">' +
                  '<span class="proj-row-top"><span class="proj-row-name"><span class="pdot"></span><span>' + esc(p.name) + '</span></span>' + UI.statusBadge(p.status) + '</span>' +
                  '<span class="progress-row">' + UI.progressBar(pr.pct, 'Avance de ' + p.name) + '<span>' + pr.done + '/' + pr.total + '</span></span>' +
                '</a>';
              }).join('') + '</div>' : '<div class="empty">' + icon('folder') + 'Aún no hay proyectos.</div>') +
              '<button type="button" class="btn btn-ghost btn-sm" data-action="new-project" style="margin-top:8px">' + icon('plus') + 'Nuevo proyecto</button>' +
            '</section>' +
            '</div>' +
          '</div>' +

          '<section class="section" style="margin-top:32px">' +
            '<div class="card-head" style="margin-bottom:12px"><h2>Notas recientes</h2><a class="link-more" href="#/notas">Ver todas</a></div>' +
            (notes.length ? '<div class="note-cards">' + notes.map(function (n) {
              var p = S.project(n.projectId);
              return '<a class="note-card" href="#/notas/' + encodeURIComponent(n.id) + '">' +
                '<span class="note-card-title">' + (n.pinned ? icon('pin') : '') + '<span>' + esc(n.title || 'Nota sin título') + '</span></span>' +
                '<span class="note-card-excerpt">' + esc(UI.plain(n.body) || 'Nota vacía') + '</span>' +
                '<span class="note-card-meta">' + (p ? UI.projectTag(p) : '') + '<span>' + esc(UI.relTime(n.updatedAt)) + '</span></span></a>';
            }).join('') + '</div>' : '<div class="card empty">' + icon('note') + 'Todavía no hay notas.</div>') +
          '</section>' +

          '<section class="section" style="margin-top:32px">' +
            '<div class="section-head"><h2>Herramientas y reportes</h2></div>' +
            '<div class="grid grid-2">' +
              '<a class="card card-link" href="#/laboratorio"><span class="card-icon">' + icon('flask') + '</span><span class="card-title">Laboratorio PCA</span>' +
                '<span class="card-sub">Sube un Excel o CSV y repite el análisis de componentes principales en el navegador.</span></a>' +
              '<a class="card card-link" href="#/analisis-pca"><span class="card-icon">' + icon('scatter') + '</span><span class="card-title">Reporte · Segmentación de clientes</span>' +
                '<span class="card-sub">Correlación, varianza, cargas e interpretación ejecutiva del notebook.</span></a>' +
            '</div>' +
          '</section>';

        if (focusQuick) {
          var q = root.querySelector('#quick-task');
          if (q) q.focus();
          focusQuick = false;
        }
      }

      root.addEventListener('submit', function (e) {
        var f = e.target.closest('[data-quick]');
        if (!f) return;
        e.preventDefault();
        var title = f.title.value.trim();
        if (!title) return;
        focusQuick = true;
        var data = UI.quickTaskData(title);
        if (data.repeat && !data.due) data.due = DataP.store.dayStr(0);
        DataP.store.addTask(data);
        UI.toast(data.due ? 'Tarea creada para ' + UI.dayLabel(data.due).toLowerCase() : 'Tarea creada');
      });
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var a = b.getAttribute('data-act');
        if (a === 'new-task') UI.taskDialog(null);
        else if (a === 'new-note') UI.newNote();
        else if (a === 'focus') {
          var st = DataP.focus.state();
          if (st.running) DataP.focus.pause();
          else if (st.paused) DataP.focus.resume();
          else DataP.focus.start({});
        }
      });
      root.addEventListener('click', function (e) {
        var hb = e.target.closest('[data-habit-today]');
        if (!hb) return;
        var on = S.toggleHabit(hb.getAttribute('data-habit-today'));
        if (on) UI.toast('Hábito cumplido hoy');
      });
      UI.bindTaskList(root);

      draw();
      var offStore = S.subscribe(draw);
      var lastFocusKey = '';
      var offFocus = DataP.focus ? DataP.focus.subscribe(function (st) {
        var key = [st.mode, st.running, st.paused, st.taskId].join('|');
        if (key !== lastFocusKey) { lastFocusKey = key; draw(); return; }
        var c = root.querySelector('[data-panel-clock]');
        if (c) c.textContent = DataP.focus.clock(st.remaining);
      }) : null;
      if (DataP.focus) { var s0 = DataP.focus.state(); lastFocusKey = [s0.mode, s0.running, s0.paused, s0.taskId].join('|'); }
      return function () { offStore(); if (offFocus) offFocus(); };
    },
  });
})();
