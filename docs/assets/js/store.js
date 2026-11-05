/* ==========================================================================
   DataP · espacio de trabajo (proyectos, tareas y notas)
   - Se guarda en el navegador (localStorage). Si no está disponible
     (modo privado estricto), funciona en memoria y lo avisa.
   - Se sincroniza entre pestañas abiertas.
   - Exportar / importar JSON para respaldos o para pasar a otro equipo.
   Contiene: proyectos, tareas (con subtareas y repetición), notas, hábitos
   y sesiones de enfoque.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'datap-workspace-v1';
  var VERSION = 2;
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
  var REPEATS = [
    { id: '', label: 'No se repite' },
    { id: 'daily', label: 'Cada día' },
    { id: 'weekdays', label: 'Días laborables' },
    { id: 'weekly', label: 'Cada semana' },
    { id: 'monthly', label: 'Cada mes' },
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
  function toDayStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDayStr(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function addDays(s, n) {
    var d = parseDayStr(s) || new Date();
    d.setDate(d.getDate() + n);
    return toDayStr(d);
  }

  /** Siguiente fecha de una tarea que se repite (siempre posterior a hoy). */
  function nextDue(due, repeat) {
    var today = dayStr(0);
    var base = due || today;
    function step(s) {
      var d = parseDayStr(s);
      if (repeat === 'daily') d.setDate(d.getDate() + 1);
      else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
      else if (repeat === 'monthly') {
        var day = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + 1);
        var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, last));
      } else if (repeat === 'weekdays') {
        do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
      }
      return toDayStr(d);
    }
    var next = step(base);
    var guard = 0;
    while (next <= today && guard++ < 1000) next = step(next);
    return next;
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

    var habits = [
      { id: uid('h_'), name: 'Revisar el panel y elegir 3 prioridades', days: [1, 2, 3, 4, 5], color: 1, log: {}, createdAt: t, updatedAt: t },
      { id: uid('h_'), name: 'Leer 20 minutos', days: [0, 1, 2, 3, 4, 5, 6], color: 3, log: {}, createdAt: t, updatedAt: t },
      { id: uid('h_'), name: 'Moverme 30 minutos', days: [0, 1, 2, 3, 4, 5, 6], color: 2, log: {}, createdAt: t, updatedAt: t },
    ];

    return { version: VERSION, createdAt: t, updatedAt: t, projects: projects, tasks: tasks, notes: notes, habits: habits, focus: [] };
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
      habits: Array.isArray(s.habits) ? s.habits : [],
      focus: Array.isArray(s.focus) ? s.focus : [],
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

  function cleanSubtasks(list) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && String(x.title || '').trim(); }).map(function (x) {
      return { id: x.id || uid('s_'), title: String(x.title).trim(), done: !!x.done };
    });
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
      subtasks: cleanSubtasks(data.subtasks),
      repeat: data.repeat || '',
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
    Object.keys(patch).forEach(function (k) { if (k !== 'id') item[k] = k === 'subtasks' ? cleanSubtasks(patch[k]) : patch[k]; });
    var spawned = null;
    if (patch.status && patch.status !== prevStatus) {
      item.completedAt = patch.status === 'done' ? nowIso() : null;
      // Al cambiar de columna sin posición explícita, la tarea queda arriba.
      if (patch.order == null) item.order = edgeOrder(patch.status, true);
      // Tarea que se repite: al terminarla se crea la siguiente.
      if (patch.status === 'done' && item.repeat && !(item.nextId && task(item.nextId))) {
        spawned = {
          id: uid('t_'), title: item.title, description: item.description, status: 'todo', priority: item.priority,
          due: nextDue(item.due, item.repeat), projectId: item.projectId, repeat: item.repeat,
          subtasks: (item.subtasks || []).map(function (st) { return { id: uid('s_'), title: st.title, done: false }; }),
          order: edgeOrder('todo', true), createdAt: nowIso(), updatedAt: nowIso(), completedAt: null,
        };
        state.tasks.push(spawned);
        item.nextId = spawned.id;
      }
      // Si se reabre, se quita la repetición creada (si aún no se empezó).
      if (prevStatus === 'done' && patch.status !== 'done' && item.nextId) {
        var nx = task(item.nextId);
        if (nx && nx.status === 'todo') state.tasks.splice(state.tasks.indexOf(nx), 1);
        item.nextId = null;
      }
    }
    item.updatedAt = nowIso();
    commit({ kind: 'task', id: id, action: 'update', spawned: spawned ? spawned.id : null });
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
     Hábitos
     days: días de la semana en que toca (0 = domingo … 6 = sábado)
     log:  { 'AAAA-MM-DD': true } días cumplidos
     ------------------------------------------------------------------------ */
  function habits() { return state.habits.filter(function (h) { return !h.archived; }); }
  function habit(id) { return state.habits.filter(function (h) { return h.id === id; })[0] || null; }

  function addHabit(data) {
    var t = nowIso();
    var used = state.habits.map(function (h) { return h.color; });
    var h = {
      id: uid('h_'),
      name: String(data.name || '').trim() || 'Hábito',
      days: Array.isArray(data.days) && data.days.length ? data.days.slice().sort() : [0, 1, 2, 3, 4, 5, 6],
      color: data.color || (COLORS.filter(function (c) { return used.indexOf(c.id) < 0; })[0] || COLORS[state.habits.length % COLORS.length]).id,
      log: {},
      createdAt: t, updatedAt: t,
    };
    state.habits.push(h);
    commit({ kind: 'habit', id: h.id, action: 'add' });
    return h;
  }

  function updateHabit(id, patch) {
    var h = habit(id);
    if (!h) return null;
    Object.keys(patch).forEach(function (k) { if (k !== 'id' && k !== 'log') h[k] = patch[k]; });
    h.updatedAt = nowIso();
    commit({ kind: 'habit', id: id, action: 'update' });
    return h;
  }

  function removeHabit(id) {
    var idx = state.habits.findIndex(function (h) { return h.id === id; });
    if (idx < 0) return null;
    var removed = state.habits.splice(idx, 1)[0];
    commit({ kind: 'habit', id: id, action: 'remove' });
    return {
      item: removed,
      undo: function () {
        state.habits.splice(Math.min(idx, state.habits.length), 0, removed);
        commit({ kind: 'habit', id: id, action: 'add' });
      },
    };
  }

  /** Marca o desmarca un día (por defecto, hoy). Devuelve el nuevo estado. */
  function toggleHabit(id, day) {
    var h = habit(id);
    if (!h) return null;
    day = day || dayStr(0);
    if (h.log[day]) delete h.log[day];
    else h.log[day] = true;
    h.updatedAt = nowIso();
    commit({ kind: 'habit', id: id, action: 'check' });
    return !!h.log[day];
  }

  function habitDue(h, s) {
    var d = parseDayStr(s);
    return !!d && h.days.indexOf(d.getDay()) >= 0;
  }

  /** Racha actual, mejor racha y cumplimiento de los últimos 30 días. */
  function habitStats(id) {
    var h = habit(id);
    if (!h) return null;
    var today = dayStr(0);
    var created = String(h.createdAt || '').slice(0, 10);
    var keys = Object.keys(h.log).filter(function (k) { return h.log[k]; }).sort();
    var start = keys[0] && keys[0] < created ? keys[0] : created || today;

    // Racha actual: hacia atrás desde hoy (hoy sin marcar todavía no la rompe).
    var streak = 0;
    var d = today;
    if (!h.log[d]) d = addDays(d, -1);
    var guard = 0;
    while (d >= start && guard++ < 3660) {
      if (habitDue(h, d)) {
        if (h.log[d]) streak++;
        else break;
      }
      d = addDays(d, -1);
    }

    // Mejor racha.
    var best = 0;
    var run = 0;
    d = start;
    guard = 0;
    while (d <= today && guard++ < 3660) {
      if (habitDue(h, d)) {
        if (h.log[d]) { run++; best = Math.max(best, run); }
        else if (d !== today) run = 0;
      }
      d = addDays(d, 1);
    }

    // Últimos 30 días (desde que existe el hábito).
    var due = 0;
    var done = 0;
    for (var i = 0; i < 30; i++) {
      var s = addDays(today, -i);
      if (s < start) break;
      if (!habitDue(h, s)) continue;
      if (s === today && !h.log[s]) continue;
      due++;
      if (h.log[s]) done++;
    }
    return { streak: streak, best: best, rate: due ? Math.round((done / due) * 100) : null, doneToday: !!h.log[today], dueToday: habitDue(h, today) };
  }

  /* ------------------------------------------------------------------------
     Sesiones de enfoque
     ------------------------------------------------------------------------ */
  function addFocus(data) {
    var f = {
      id: uid('f_'),
      taskId: data.taskId || '',
      minutes: Math.max(1, Math.round(data.minutes || 0)),
      startedAt: data.startedAt || nowIso(),
      endedAt: data.endedAt || nowIso(),
    };
    state.focus.push(f);
    commit({ kind: 'focus', id: f.id, action: 'add' });
    return f;
  }

  function focusSessions(filter) {
    filter = filter || {};
    return state.focus.filter(function (f) {
      if (filter.taskId && f.taskId !== filter.taskId) return false;
      if (filter.since && String(f.endedAt) < filter.since) return false;
      return true;
    }).sort(function (a, b) { return String(b.endedAt).localeCompare(String(a.endedAt)); });
  }

  /** Minutos de enfoque por día local (AAAA-MM-DD → minutos). */
  function focusByDay() {
    var out = {};
    state.focus.forEach(function (f) {
      var k = toDayStr(new Date(f.endedAt));
      out[k] = (out[k] || 0) + f.minutes;
    });
    return out;
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
    if (!data || (!data.projects.length && !data.tasks.length && !data.notes.length && !data.habits.length)) {
      throw new Error('El archivo no contiene proyectos, tareas ni notas de DataP.');
    }
    var ok = function (x) { return x && typeof x.id === 'string'; };
    if (!data.projects.every(ok) || !data.tasks.every(ok) || !data.notes.every(ok) || !data.habits.every(ok)) {
      throw new Error('El archivo tiene elementos sin identificador; no parece un respaldo de DataP.');
    }
    state = data;
    commit({ kind: 'all' });
    data.habits.forEach(function (h) {
      if (!h.log || typeof h.log !== 'object') h.log = {};
      if (!Array.isArray(h.days) || !h.days.length) h.days = [0, 1, 2, 3, 4, 5, 6];
    });
    return { projects: data.projects.length, tasks: data.tasks.length, notes: data.notes.length, habits: data.habits.length };
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
    REPEATS: REPEATS,
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
    habits: habits,
    habit: habit,
    addHabit: addHabit,
    updateHabit: updateHabit,
    removeHabit: removeHabit,
    toggleHabit: toggleHabit,
    habitStats: habitStats,
    habitDue: habitDue,
    addFocus: addFocus,
    focusSessions: focusSessions,
    focusByDay: focusByDay,
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset,
    today: function () { return dayStr(0); },
    dayStr: dayStr,
    addDays: addDays,
    toDayStr: toDayStr,
    nextDue: nextDue,
  };
})();
