/* ==========================================================================
   Módulo: Proyectos
   #/proyectos           lista de proyectos con su avance
   #/proyectos/<id>      página del proyecto: tareas, notas, enlaces y reporte
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function listView(root) {
    var S = DataP.store;
    var UI = DataP.ui;

    function draw() {
      var projects = S.projects();
      var active = projects.filter(function (p) { return p.status === 'activo'; }).length;
      root.innerHTML =
        '<div class="page-top">' +
          '<header class="page-header"><h1>Proyectos</h1><p class="lede">' + plural(projects.length, 'proyecto', 'proyectos') + ' · ' + active + ' en curso. Cada proyecto agrupa sus tareas, notas, enlaces y reportes.</p></header>' +
          '<div class="header-actions"><button type="button" class="btn btn-primary" data-action="new-project">' + icon('plus') + 'Nuevo proyecto</button></div>' +
        '</div>' +
        '<div class="proj-grid">' +
          projects.map(function (p) {
            var pr = S.projectProgress(p.id);
            var nNotes = S.notes({ projectId: p.id }).length;
            return '<a class="card proj-card pc-' + p.color + '" href="#/proyectos/' + encodeURIComponent(p.id) + '">' +
              '<div class="card-head"><span class="card-title">' + esc(p.name) + '</span></div>' +
              UI.statusBadge(p.status) +
              (p.description ? '<p class="card-sub">' + esc(p.description) + '</p>' : '') +
              '<div class="progress-row">' + UI.progressBar(pr.pct, 'Avance de ' + p.name) + '<span>' + pr.pct + '%</span></div>' +
              '<div class="proj-card-foot"><span>' + icon('inbox') + plural(pr.open, 'abierta', 'abiertas') + '</span><span>' + icon('check-circle') + plural(pr.done, 'hecha', 'hechas') + '</span>' +
                '<span>' + icon('note') + plural(nNotes, 'nota', 'notas') + '</span>' + (p.report ? '<span>' + icon('scatter') + 'Reporte</span>' : '') + '</div>' +
            '</a>';
          }).join('') +
          '<button type="button" class="proj-new" data-action="new-project">' + icon('plus') + 'Nuevo proyecto</button>' +
        '</div>';
    }

    draw();
    return S.subscribe(draw);
  }

  function detailView(root, id) {
    var S = DataP.store;
    var UI = DataP.ui;
    var focusQuick = false;

    function draw() {
      var p = S.project(id);
      if (!p) {
        root.innerHTML = '<nav class="crumbs" aria-label="Ruta"><a href="#/proyectos">Proyectos</a></nav>' +
          '<div class="card empty" style="margin-top:16px">' + icon('folder') + 'Este proyecto no existe o fue eliminado.<a class="btn btn-sm" href="#/proyectos">Ver proyectos</a></div>';
        return;
      }
      DataP.setTitle(p.name);
      var pr = S.projectProgress(p.id);
      var tasks = S.tasks({ projectId: p.id });
      var open = tasks.filter(function (t) { return t.status !== 'done'; }).sort(UI.byUrgency);
      var done = tasks.filter(function (t) { return t.status === 'done'; })
        .sort(function (a, b) { return String(b.completedAt).localeCompare(String(a.completedAt)); });
      var notes = S.notes({ projectId: p.id });
      var reportMod = p.report ? DataP.getModules().filter(function (m) { return m.id === p.report; })[0] : null;

      var results = '';
      if (p.report === 'analisis-pca' && DataP.data.pcaClientes) {
        var D = DataP.data.pcaClientes;
        results = '<section class="card" style="margin-top:16px"><div class="card-head"><h2 class="card-title">Resultados clave</h2><a class="link-more" href="#/analisis-pca">Abrir reporte</a></div>' +
          '<div class="grid grid-4" style="margin-top:12px">' +
            '<div class="stat"><span class="stat-label">Variables → componentes</span><span class="stat-value">' + D.variables.length + ' → 2</span></div>' +
            '<div class="stat"><span class="stat-label">Información conservada</span><span class="stat-value">' + U.pct(D.varianza[1].acumulada) + '</span></div>' +
            '<div class="stat"><span class="stat-label">Peso del CP1</span><span class="stat-value">' + U.pct(D.varianza[0].explicada) + '</span></div>' +
            '<div class="stat"><span class="stat-label">Clientes analizados</span><span class="stat-value">' + D.observaciones + '</span></div>' +
          '</div></section>';
      }

      root.innerHTML =
        '<nav class="crumbs" aria-label="Ruta"><a href="#/proyectos">Proyectos</a><span class="sep">›</span><span>' + esc(p.name) + '</span></nav>' +
        '<div class="page-top" style="margin-top:10px">' +
          '<header class="page-header pc-' + p.color + '">' +
            '<h1><span class="title-dot" aria-hidden="true"></span>' + esc(p.name) + '</h1>' +
            (p.description ? '<p class="lede">' + esc(p.description) + '</p>' : '') +
            '<div class="header-meta">' + UI.statusBadge(p.status) + '<span class="chip">Creado ' + esc(UI.relTime(p.createdAt)) + '</span></div>' +
          '</header>' +
          '<div class="header-actions">' +
            (reportMod ? '<a class="btn btn-primary" href="#/' + esc(reportMod.id) + '">' + icon('scatter') + 'Abrir reporte</a>' : '') +
            '<button type="button" class="btn" data-edit>' + icon('edit') + 'Editar</button>' +
          '</div>' +
        '</div>' +
        (p.links && p.links.length ? '<div class="link-chips" style="margin-bottom:20px">' + p.links.map(function (l) {
          return /^https?:\/\//.test(l.url) ? '<a class="link-chip" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + icon('external') + esc(l.label) + '</a>' : '';
        }).join('') + '</div>' : '') +

        '<div class="grid grid-4">' +
          '<div class="card stat pc-' + p.color + '"><span class="stat-label">Avance</span><span class="stat-value">' + pr.pct + '%</span>' + UI.progressBar(pr.pct, 'Avance') + '</div>' +
          '<div class="card stat"><span class="stat-label">Pendientes</span><span class="stat-value">' + pr.open + '</span><span class="stat-note">' + open.filter(function (t) { var d = UI.daysFromToday(t.due); return d != null && d < 0; }).length + ' atrasadas</span></div>' +
          '<div class="card stat"><span class="stat-label">Hechas</span><span class="stat-value">' + pr.done + '</span><span class="stat-note">De ' + pr.total + ' tareas</span></div>' +
          '<div class="card stat"><span class="stat-label">Notas</span><span class="stat-value">' + notes.length + '</span><span class="stat-note">' + (notes[0] ? 'Última ' + esc(UI.relTime(notes[0].updatedAt)) : 'Ninguna todavía') + '</span></div>' +
        '</div>' +
        results +

        '<div class="panel-grid" style="margin-top:16px">' +
          '<section class="card" aria-labelledby="h-ptasks">' +
            '<div class="card-head"><h2 class="card-title" id="h-ptasks">Tareas</h2><a class="link-more" href="#/tareas/' + encodeURIComponent(p.id) + '">Ver en el tablero</a></div>' +
            '<form class="quick-add" data-quick><label class="visually-hidden" for="ptask-quick">Nueva tarea en este proyecto</label>' +
              '<input class="input" id="ptask-quick" name="title" placeholder="Añade una tarea a este proyecto" autocomplete="off" maxlength="200" data-smart>' +
              '<button class="btn" type="submit">' + icon('plus') + '<span class="visually-hidden">Añadir</span></button>' + UI.smartHintSlot() + '</form>' +
            (open.length ? '<ul class="task-list">' + open.map(function (t) { return UI.taskRow(t, { showProject: false }); }).join('') + '</ul>'
              : '<div class="empty">' + icon('check-circle') + 'No hay tareas pendientes.</div>') +
            (done.length ? '<details class="data-details"><summary>Hechas (' + done.length + ')</summary><ul class="task-list" style="margin-top:6px">' +
              done.map(function (t) { return UI.taskRow(t, { showProject: false }); }).join('') + '</ul></details>' : '') +
          '</section>' +
          '<section class="card" aria-labelledby="h-pnotes">' +
            '<div class="card-head"><h2 class="card-title" id="h-pnotes">Notas</h2><button type="button" class="btn btn-ghost btn-sm" data-new-note>' + icon('plus') + 'Nueva nota</button></div>' +
            (notes.length ? '<div class="note-cards" style="grid-template-columns:1fr">' + notes.map(function (n) {
              return '<a class="note-card" href="#/notas/' + encodeURIComponent(n.id) + '"><span class="note-card-title">' + (n.pinned ? icon('pin') : '') + '<span>' + esc(n.title || 'Nota sin título') + '</span></span>' +
                '<span class="note-card-excerpt">' + esc(UI.plain(n.body) || 'Nota vacía') + '</span><span class="note-card-meta"><span>' + esc(UI.relTime(n.updatedAt)) + '</span></span></a>';
            }).join('') + '</div>' : '<div class="empty">' + icon('note') + 'Sin notas en este proyecto.</div>') +
          '</section>' +
        '</div>';

      if (focusQuick) {
        var q = root.querySelector('#ptask-quick');
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
      var data = UI.quickTaskData(title, { projectId: id });
      if (data.repeat && !data.due) data.due = S.dayStr(0);
      S.addTask(data);
      UI.toast(data.projectId !== id && S.project(data.projectId) ? 'Tarea creada en ' + S.project(data.projectId).name : 'Tarea creada');
    });
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-edit]')) UI.projectDialog(id);
      else if (e.target.closest('[data-new-note]')) UI.newNote({ projectId: id });
    });
    UI.bindTaskList(root);

    draw();
    return S.subscribe(draw);
  }

  DataP.registerModule({
    id: 'proyectos',
    title: 'Proyectos',
    nav: false,
    params: true,
    icon: 'folder',
    order: 0,
    summary: 'Todos tus proyectos con su avance, tareas y notas.',
    keywords: 'proyectos lista avance',
    render: function (root, ctx) {
      return ctx.sub ? detailView(root, ctx.sub) : listView(root);
    },
  });
})();
