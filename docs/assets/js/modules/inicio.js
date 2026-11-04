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
    summary: 'Resumen del día: tareas próximas, proyectos y notas recientes.',
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
        var active = projects.filter(function (p) { return p.status === 'activo'; });
        var projectsWithOpen = {};
        open.forEach(function (t) { if (t.projectId) projectsWithOpen[t.projectId] = true; });

        var lede = open.length
          ? 'Tienes ' + plural(open.length, 'tarea pendiente', 'tareas pendientes') +
            (overdue.length ? ', ' + plural(overdue.length, 'atrasada', 'atrasadas') : '') +
            (week.length ? (overdue.length ? ' y ' : ', ') + week.length + ' para esta semana' : '') + '.'
          : 'No tienes tareas pendientes. Buen momento para planear lo siguiente.';

        var upcoming = open.slice().sort(UI.byUrgency).slice(0, 7);
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
            kpi('folder', 'Proyectos en curso', String(active.length), 'De ' + plural(projects.length, 'proyecto', 'proyectos')) +
          '</div>' +

          '<div class="panel-grid" style="margin-top:16px">' +
            '<section class="card" aria-labelledby="h-upcoming">' +
              '<div class="card-head"><h2 class="card-title" id="h-upcoming">Próximas tareas</h2><a class="link-more" href="#/tareas">Ver tablero</a></div>' +
              '<form class="quick-add" data-quick><label class="visually-hidden" for="quick-task">Nueva tarea</label>' +
                '<input class="input" id="quick-task" name="title" placeholder="Añade una tarea y pulsa Enter" autocomplete="off" maxlength="200">' +
                '<button class="btn" type="submit">' + icon('plus') + '<span class="visually-hidden">Añadir</span></button></form>' +
              (upcoming.length
                ? '<ul class="task-list" data-tasks>' + upcoming.map(function (t) { return UI.taskRow(t); }).join('') + '</ul>'
                : '<div class="empty">' + icon('check-circle') + 'Todo al día.</div>') +
            '</section>' +

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
        DataP.store.addTask({ title: title });
        UI.toast('Tarea creada');
      });
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var a = b.getAttribute('data-act');
        if (a === 'new-task') UI.taskDialog(null);
        else if (a === 'new-note') UI.newNote();
      });
      UI.bindTaskList(root);

      draw();
      return S.subscribe(draw);
    },
  });
})();
