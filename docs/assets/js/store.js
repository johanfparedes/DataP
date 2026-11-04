/* ==========================================================================
   DataP · espacio de trabajo (proyectos, tareas y notas)
   - Se guarda en el navegador (localStorage). Si no está disponible
     (modo privado estricto), funciona en memoria y lo avisa.
   - Se sincroniza entre pestañas abiertas.
   - Exportar / importar JSON para respaldos o para pasar a otro equipo.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'datap-workspace-v1';
  var VERSION = 1;
  var listeners = [];
  var state = null;
  var persistent = true;

  var TASK_STATUSES = [
    { id: 'todo', label: 'Por hacer' },
    { id: 'doing', label: 'En curso' },
    { id: 'done', label: 'Hecho' },
  ];
  var PRIORITIES = [
    { id: 'alta', label: 'Alta' },
    { id: 'media', label: 'Media' },
    { id: 'baja', label: 'Baja' },
  ];
  var PROJECT_STATUSES = [
    { id: 'idea', label: 'Idea' },
    { id: 'activo', label: 'En curso' },
    { id: 'pausado', label: 'En pausa' },
    { id: 'completado', label: 'Completado' },
  ];
  var COLORS = [
    { id: 1, label: 'Azul' }, { id: 2, label: 'Naranja' }, { id: 3, label: 'Aguamarina' }, { id: 4, label: 'Amarillo' },
    { id: 5, label: 'Rosa' }, { id: 6, label: 'Verde' }, { id: 7, label: 'Violeta' }, { id: 8, label: 'Rojo' },
  ];

  /* ------------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------------ */
  function uid(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function nowIso() { return new Date().toISOString(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayStr(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function isoDaysAgo(days) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ------------------------------------------------------------------------
     Datos iniciales: lo que ya existe en este repositorio
     ------------------------------------------------------------------------ */
  function seed() {
    var t = nowIso();
    var repo = (DataP.config && DataP.config.repoUrl) || '';
    var colab = (DataP.config && DataP.config.colabBase) || '';
    var nb = 'notebooks/analisis_pca_clientes.ipynb';

    var projects = [
      {
        id: 'pca-clientes',
        name: 'Segmentación de clientes con PCA',
        description: 'Análisis de componentes principales sobre 50 clientes para identificar perfiles de compra y decidir a quién priorizar.',
        status: 'completado',
        color: 1,
        report: 'analisis-pca',
        links: [
          { label: 'Abrir en Colab', url: colab + nb },
          { label: 'Notebook en GitHub', url: repo + '/blob/main/' + nb },
        ],
        createdAt: isoDaysAgo(2), updatedAt: t,
      },
      {
        id: 'datap',
        name: 'DataP · Super app de organización',
        description: 'Esta web: un solo lugar para organizar proyectos, tareas, notas y análisis de datos.',
        status: 'activo',
        color: 2,
        report: null,
        links: [{ label: 'Repositorio', url: repo }],
        createdAt: isoDaysAgo(1), updatedAt: t,
      },
    ];

    var order = 0;
    function task(projectId, title, description, status, priority, due, completedDaysAgo) {
      order += 1;
      return {
        id: uid('t_'), title: title, description: description || '', status: status, priority: priority,
        due: due, projectId: projectId, order: order,
        createdAt: isoDaysAgo(2), updatedAt: t,
        completedAt: status === 'done' ? isoDaysAgo(completedDaysAgo || 0) : null,
      };
    }

    var tasks = [
      task('pca-clientes', 'Corregir el porcentaje de CP2 en el notebook',
        'La interpretación dice que CP2 explica el 13.5%, pero la tabla calculada en la celda 5 da 3.59%.', 'todo', 'alta', dayStr(2)),
      task('pca-clientes', 'Revisar la interpretación de CP2',
        'La mayor carga de CP2 es Monto promedio (0.60), seguida de Visitas web (0.41). El texto lo describe como antigüedad y productos diferentes.', 'todo', 'media', dayStr(5)),
      task('pca-clientes', 'Guardar Data.xlsx en data/ si los datos no son sensibles',
        'Así el análisis se puede repetir sin buscar el archivo original.', 'todo', 'baja', ''),
      task('datap', 'Unir la rama de trabajo a main',
        'Abre un pull request de la rama ccr-b7b609a5-576aui en GitHub y únelo.', 'doing', 'alta', dayStr(1)),
      task('datap', 'Publicar la web con GitHub Pages',
        'Settings › Pages › Deploy from a branch › rama main › carpeta /docs.', 'todo', 'media', dayStr(3)),
      task('datap', 'Elegir el próximo módulo de la super app',
        'Anota las ideas en una nota y decide cuál construir primero.', 'todo', 'media', ''),
      task('datap', 'Ordenar el repositorio en notebooks/, data/ y docs/', '', 'done', 'media', '', 1),
      task('pca-clientes', 'Publicar el reporte del análisis en la web', '', 'done', 'media', '', 1),
    ];

    var notes = [
      {
        id: uid('n_'), projectId: 'pca-clientes', pinned: true,
        title: 'Hallazgos clave del PCA',
        body: '## Resumen\n- 8 variables → 2 componentes con el **99.0%** de la varianza.\n' +
          '- **CP1 (95.4%)** separa el perfil premium (edad, ingreso, monto promedio, antigüedad) del perfil digital (frecuencia, productos, promociones, visitas web).\n' +
          '- CP2 explica solo el 3.6%.\n\n## Decisiones\n- Premium: atención personalizada y programa VIP según el ticket.\n' +
          '- Digital: mejorar la web, cupones y venta cruzada.\n\n## Pendiente\n- [ ] Corregir el 13.5% del notebook\n- [x] Publicar el reporte',
        createdAt: isoDaysAgo(1), updatedAt: isoDaysAgo(1),
      },
      {
        id: uid('n_'), projectId: '', pinned: false,
        title: 'Cómo usar DataP',
        body: '- Pulsa **Ctrl + K** (⌘ + K en Mac) para buscar o crear cualquier cosa.\n' +
          '- Arrastra las tareas entre columnas en el tablero, o márcalas como hechas con la casilla.\n' +
          '- Todo se guarda **en este navegador**. Haz un respaldo en Ajustes › Exportar.\n' +
          '- Las notas aceptan formato simple: `## título`, `- lista`, `**negrita**`, `- [ ] pendiente` y enlaces `[texto](https://…)`.',
        createdAt: isoDaysAgo(0), updatedAt: t,
      },
    ];

    return { version: VERSION, createdAt: t, updatedAt: t, projects: projects, tasks: tasks, notes: notes };
  }

  function normalize(s) {
    if (!s || typeof s !== 'object') return null;
    return {
      version: VERSION,
      createdAt: s.createdAt || nowIso(),
      updatedAt: s.updatedAt || nowIso(),
      projects: Array.isArray(s.projects) ? s.projects : [],
      tasks: Array.isArray(s.tasks) ? s.tasks : [],
      notes: Array.isArray(s.notes) ? s.notes : [],
    };
  }

  /* ------------------------------------------------------------------------
     Persistencia
     ------------------------------------------------------------------------ */
  function load() {
    var raw = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch (e) {
      persistent = false;
    }
    if (raw) {
      try { state = normalize(JSON.parse(raw)); } catch (e) { state = null; }
    }
    if (!state) {
      state = seed();
      save();
    }
  }

  function save() {
    state.updatedAt = nowIso();
    if (!persistent) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      persistent = false;
    }
  }

  function emit(change) {
    listeners.slice().forEach(function (fn) {
      try { fn(change || {}); } catch (e) { console.error(e); }
    });
  }

  function commit(change) {
    save();
    emit(change);
  }

  // Cambios hechos en otra pestaña.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue) return;
    try {
      state = normalize(JSON.parse(e.newValue));
      emit({ kind: 'all', external: true });
    } catch (err) { /* ignorar */ }
  });

  /* ------------------------------------------------------------------------
     Consultas
     ------------------------------------------------------------------------ */
  function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }

  function projects() { return state.projects.slice(); }
  function project(id) { return state.projects.filter(function (p) { return p.id === id; })[0] || null; }
  function tasks(filter) {
    filter = filter || {};
    return state.tasks.filter(function (t) {
      if (filter.projectId != null && t.projectId !== filter.projectId) return false;
      if (filter.status && t.status !== filter.status) return false;
      if (filter.open && t.status === 'done') return false;
      return true;
    }).sort(byOrder);
  }
  function task(id) { return state.tasks.filter(function (t) { return t.id === id; })[0] || null; }
  function notes(filter) {
    filter = filter || {};
    return state.notes.filter(function (n) {
      return filter.projectId == null || n.projectId === filter.projectId;
    }).sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
  }
  function note(id) { return state.notes.filter(function (n) { return n.id === id; })[0] || null; }

  function projectProgress(id) {
    var list = state.tasks.filter(function (t) { return t.projectId === id; });
    var done = list.filter(function (t) { return t.status === 'done'; }).length;
    return { total: list.length, done: done, open: list.length - done, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  /* ------------------------------------------------------------------------
     Proyectos
     ------------------------------------------------------------------------ */
  function slug(name) {
    var s = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'proyecto';
    var base = s;
    var i = 2;
    while (project(s)) s = base + '-' + i++;
    return s;
  }

  function addProject(data) {
    var t = nowIso();
    var used = state.projects.map(function (p) { return p.color; });
    var color = data.color || (COLORS.filter(function (c) { return used.indexOf(c.id) < 0; })[0] || COLORS[state.projects.length % COLORS.length]).id;
    var p = {
      id: slug(data.name || 'proyecto'),
      name: String(data.name || 'Proyecto sin nombre').trim(),
      description: String(data.description || '').trim(),
      status: data.status || 'activo',
      color: color,
      report: data.report || null,
      links: data.links || [],
      createdAt: t, updatedAt: t,
    };
    state.projects.push(p);
    commit({ kind: 'project', id: p.id, action: 'add' });
    return p;
  }

  function updateProject(id, patch) {
    var p = project(id);
    if (!p) return null;
    Object.keys(patch).forEach(function (k) { if (k !== 'id') p[k] = patch[k]; });
    p.updatedAt = nowIso();
    commit({ kind: 'project', id: id, action: 'update' });
    return p;
  }

  /** Elimina el proyecto. Sus tareas y notas quedan sin proyecto (no se borran). */
  function removeProject(id) {
    var idx = state.projects.findIndex(function (p) { return p.id === id; });
    if (idx < 0) return null;
    var removed = state.projects.splice(idx, 1)[0];
    var affectedTasks = [];
    var affectedNotes = [];
    state.tasks.forEach(function (t) { if (t.projectId === id) { affectedTasks.push(t.id); t.projectId = ''; } });
    state.notes.forEach(function (n) { if (n.projectId === id) { affectedNotes.push(n.id); n.projectId = ''; } });
    commit({ kind: 'project', id: id, action: 'remove' });
    return {
      undo: function () {
        state.projects.splice(Math.min(idx, state.projects.length), 0, removed);
        state.tasks.forEach(function (t) { if (affectedTasks.indexOf(t.id) >= 0) t.projectId = id; });
        state.notes.forEach(function (n) { if (affectedNotes.indexOf(n.id) >= 0) n.projectId = id; });
        commit({ kind: 'project', id: id, action: 'add' });
      },
    };
  }

  /* ------------------------------------------------------------------------
     Tareas
     ------------------------------------------------------------------------ */
  function edgeOrder(status, top) {
    var list = tasks({ status: status });
    if (!list.length) return 1;
    return top ? list[0].order - 1 : list[list.length - 1].order + 1;
  }

  function addTask(data) {
    var t = nowIso();
    var status = data.status || 'todo';
    var item = {
      id: uid('t_'),
      title: String(data.title || '').trim() || 'Tarea sin título',
      description: String(data.description || '').trim(),
      status: status,
      priority: data.priority || 'media',
      due: data.due || '',
      projectId: data.projectId || '',
      order: edgeOrder(status, status !== 'done'),
      createdAt: t, updatedAt: t,
      completedAt: status === 'done' ? t : null,
    };
    state.tasks.push(item);
    commit({ kind: 'task', id: item.id, action: 'add' });
    return item;
  }

  function updateTask(id, patch) {
    var item = task(id);
    if (!item) return null;
    var prevStatus = item.status;
    Object.keys(patch).forEach(function (k) { if (k !== 'id') item[k] = patch[k]; });
    if (patch.status && patch.status !== prevStatus) {
      item.completedAt = patch.status === 'done' ? nowIso() : null;
      // Al cambiar de columna sin posición explícita, la tarea queda arriba.
      if (patch.order == null) item.order = edgeOrder(patch.status, true);
    }
    item.updatedAt = nowIso();
    commit({ kind: 'task', id: id, action: 'update' });
    return item;
  }

  function toggleTask(id) {
    var item = task(id);
    if (!item) return null;
    return updateTask(id, { status: item.status === 'done' ? 'todo' : 'done' });
  }

  /** Mueve una tarea a una columna y posición concretas (para arrastrar y soltar). */
  function moveTask(id, status, index) {
    var item = task(id);
    if (!item) return null;
    var list = tasks({ status: status }).filter(function (t) { return t.id !== id; });
    var i = Math.max(0, Math.min(index == null ? list.length : index, list.length));
    var before = list[i - 1];
    var after = list[i];
    var order;
    if (before && after) order = (before.order + after.order) / 2;
    else if (before) order = before.order + 1;
    else if (after) order = after.order - 1;
    else order = 1;
    var patch = { order: order };
    if (status !== item.status) patch.status = status;
    return updateTask(id, patch);
  }

  function removeTask(id) {
    var idx = state.tasks.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return null;
    var removed = state.tasks.splice(idx, 1)[0];
    commit({ kind: 'task', id: id, action: 'remove' });
    return {
      item: removed,
      undo: function () {
        state.tasks.splice(Math.min(idx, state.tasks.length), 0, removed);
        commit({ kind: 'task', id: id, action: 'add' });
      },
    };
  }

  /* ------------------------------------------------------------------------
     Notas
     ------------------------------------------------------------------------ */
  function addNote(data) {
    var t = nowIso();
    var n = {
      id: uid('n_'),
      title: String(data.title || '').trim(),
      body: String(data.body || ''),
      projectId: data.projectId || '',
      pinned: !!data.pinned,
      createdAt: t, updatedAt: t,
    };
    state.notes.push(n);
    commit({ kind: 'note', id: n.id, action: 'add' });
    return n;
  }

  function updateNote(id, patch) {
    var n = note(id);
    if (!n) return null;
    Object.keys(patch).forEach(function (k) { if (k !== 'id') n[k] = patch[k]; });
    n.updatedAt = nowIso();
    commit({ kind: 'note', id: id, action: 'update' });
    return n;
  }

  function removeNote(id) {
    var idx = state.notes.findIndex(function (n) { return n.id === id; });
    if (idx < 0) return null;
    var removed = state.notes.splice(idx, 1)[0];
    commit({ kind: 'note', id: id, action: 'remove' });
    return {
      item: removed,
      undo: function () {
        state.notes.splice(Math.min(idx, state.notes.length), 0, removed);
        commit({ kind: 'note', id: id, action: 'add' });
      },
    };
  }

  /* ------------------------------------------------------------------------
     Respaldo
     ------------------------------------------------------------------------ */
  function exportJSON() {
    return JSON.stringify({ app: 'DataP', exportedAt: nowIso(), data: state }, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    var data = normalize(parsed && parsed.data ? parsed.data : parsed);
    if (!data || (!data.projects.length && !data.tasks.length && !data.notes.length)) {
      throw new Error('El archivo no contiene proyectos, tareas ni notas de DataP.');
    }
    var ok = function (x) { return x && typeof x.id === 'string'; };
    if (!data.projects.every(ok) || !data.tasks.every(ok) || !data.notes.every(ok)) {
      throw new Error('El archivo tiene elementos sin identificador; no parece un respaldo de DataP.');
    }
    state = data;
    commit({ kind: 'all' });
    return { projects: data.projects.length, tasks: data.tasks.length, notes: data.notes.length };
  }

  function reset() {
    state = seed();
    commit({ kind: 'all' });
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  load();

  DataP.store = {
    TASK_STATUSES: TASK_STATUSES,
    PRIORITIES: PRIORITIES,
    PROJECT_STATUSES: PROJECT_STATUSES,
    COLORS: COLORS,
    isPersistent: function () { return persistent; },
    subscribe: subscribe,
    snapshot: function () { return clone(state); },
    projects: projects,
    project: project,
    projectProgress: projectProgress,
    addProject: addProject,
    updateProject: updateProject,
    removeProject: removeProject,
    tasks: tasks,
    task: task,
    addTask: addTask,
    updateTask: updateTask,
    toggleTask: toggleTask,
    moveTask: moveTask,
    removeTask: removeTask,
    notes: notes,
    note: note,
    addNote: addNote,
    updateNote: updateNote,
    removeNote: removeNote,
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset,
    today: function () { return dayStr(0); },
    dayStr: dayStr,
  };
})();
