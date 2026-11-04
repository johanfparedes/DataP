/* ==========================================================================
   DataP · componentes de interfaz compartidos
   Fechas, etiquetas, avisos (toasts), diálogos (tarea, proyecto, confirmar),
   formato simple de notas y la paleta de comandos (Ctrl/⌘ + K).
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;
  var S = DataP.store;

  /* ------------------------------------------------------------------------
     Fechas
     ------------------------------------------------------------------------ */
  var dtShort = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
  var dtLong = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });

  function parseDay(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function daysFromToday(s) {
    var d = parseDay(s);
    if (!d) return null;
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }

  function dueInfo(due, done) {
    var n = daysFromToday(due);
    if (n == null) return null;
    var label = n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n === -1 ? 'Ayer' : dtShort.format(parseDay(due)).replace('.', '');
    var state = done ? 'done' : n < 0 ? 'overdue' : n === 0 ? 'today' : n <= 7 ? 'soon' : 'later';
    if (state === 'overdue') label = 'Atrasada · ' + label;
    return { label: label, state: state, days: n };
  }

  function relTime(iso) {
    var t = Date.parse(iso);
    if (!t) return '';
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'hace un momento';
    var m = Math.round(s / 60);
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.round(h / 24);
    if (d === 1) return 'ayer';
    if (d < 7) return 'hace ' + d + ' días';
    return dtShort.format(new Date(t)).replace('.', '');
  }

  function longDate(date) {
    var s = dtLong.format(date || new Date());
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ------------------------------------------------------------------------
     Etiquetas
     ------------------------------------------------------------------------ */
  function label(list, id) {
    var f = list.filter(function (x) { return x.id === id; })[0];
    return f ? f.label : '';
  }

  function projectTag(p, opts) {
    if (!p) return '';
    var asLink = opts && opts.link;
    var inner = '<span class="pdot"></span><span class="ptag-name">' + esc(p.name) + '</span>';
    return asLink
      ? '<a class="ptag pc-' + p.color + '" href="#/proyectos/' + esc(p.id) + '">' + inner + '</a>'
      : '<span class="ptag pc-' + p.color + '">' + inner + '</span>';
  }

  function priorityBadge(pr) {
    var lvl = pr === 'alta' ? 3 : pr === 'media' ? 2 : 1;
    var bars = '';
    for (var i = 0; i < 3; i++) {
      bars += '<rect x="' + (1 + i * 5) + '" y="' + (10 - (i + 1) * 3) + '" width="3.2" height="' + ((i + 1) * 3) + '" rx="1" class="' + (i < lvl ? 'on' : 'off') + '"/>';
    }
    return '<span class="prio prio-' + esc(pr) + '" title="Prioridad ' + esc(label(S.PRIORITIES, pr).toLowerCase()) + '">' +
      '<svg viewBox="0 0 16 11" aria-hidden="true">' + bars + '</svg>' + esc(label(S.PRIORITIES, pr)) + '</span>';
  }

  function dueBadge(due, done) {
    var d = dueInfo(due, done);
    if (!d) return '';
    var ico = d.state === 'overdue' ? 'alert' : 'calendar';
    return '<span class="due due-' + d.state + '">' + icon(ico) + esc(d.label) + '</span>';
  }

  function statusBadge(st) {
    return '<span class="pstatus ps-' + esc(st) + '">' + esc(label(S.PROJECT_STATUSES, st)) + '</span>';
  }

  function progressBar(pct, labelText) {
    return '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(labelText || 'Progreso') + '"><span style="width:' + pct + '%"></span></div>';
  }

  /* ------------------------------------------------------------------------
     Formato simple de notas (seguro: se escapa antes de dar formato)
     ------------------------------------------------------------------------ */
  function inline(s) {
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }

  function markdown(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var list = null;
    var para = [];
    function flushPara() {
      if (para.length) { out.push('<p>' + inline(para.join('<br>')) + '</p>'); para = []; }
    }
    function openList(tag) {
      if (list !== tag) { closeList(); out.push('<' + tag + '>'); list = tag; }
    }
    function closeList() {
      if (list) { out.push('</' + list + '>'); list = null; }
    }
    lines.forEach(function (raw) {
      if (/^\s*$/.test(raw)) { flushPara(); closeList(); return; }
      var line = esc(raw);
      var m;
      if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
        flushPara(); closeList();
        var lv = m[1].length + 2;
        out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>');
      } else if ((m = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line))) {
        flushPara(); openList('ul');
        var done = m[1] !== ' ';
        out.push('<li class="md-check' + (done ? ' is-done' : '') + '"><span class="md-box" aria-hidden="true">' + (done ? icon('check') : '') +
          '</span><span class="visually-hidden">' + (done ? 'Hecho: ' : 'Pendiente: ') + '</span><span>' + inline(m[2]) + '</span></li>');
      } else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) {
        flushPara(); openList('ul');
        out.push('<li>' + inline(m[1]) + '</li>');
      } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
        flushPara(); openList('ol');
        out.push('<li>' + inline(m[1]) + '</li>');
      } else if ((m = /^&gt;\s?(.*)$/.exec(line))) {
        flushPara(); closeList();
        out.push('<blockquote>' + inline(m[1]) + '</blockquote>');
      } else {
        closeList();
        para.push(line);
      }
    });
    flushPara();
    closeList();
    return out.join('');
  }

  /** Texto plano para extractos (sin marcas de formato). */
  function plain(text) {
    return String(text || '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*#{1,3}\s+/gm, '')
      .replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/[*`>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ------------------------------------------------------------------------
     Avisos (toasts)
     ------------------------------------------------------------------------ */
  function toastHost() {
    var host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      host.className = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, opts) {
    opts = opts || {};
    var host = toastHost();
    var el = document.createElement('div');
    el.className = 'toast';
    var text = document.createElement('span');
    text.textContent = message;
    el.appendChild(text);
    var timer;
    function close() {
      clearTimeout(timer);
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 160);
    }
    if (opts.action) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = opts.action.label;
      btn.addEventListener('click', function () { close(); opts.action.run(); });
      el.appendChild(btn);
    }
    host.appendChild(el);
    timer = setTimeout(close, opts.timeout || (opts.action ? 6000 : 3200));
    return close;
  }

  /* ------------------------------------------------------------------------
     Diálogos
     ------------------------------------------------------------------------ */
  /**
   * Abre un diálogo modal con un formulario.
   * actions: [{value, label, kind:'primary'|'danger'|'ghost', align:'start'}]
   * onAction(value, form) → devuelve false para mantenerlo abierto.
   */
  function dialog(opts) {
    var dlg = document.createElement('dialog');
    dlg.className = 'dlg' + (opts.size ? ' dlg-' + opts.size : '');
    dlg.setAttribute('aria-labelledby', 'dlg-title');
    var start = (opts.actions || []).filter(function (a) { return a.align === 'start'; });
    var end = (opts.actions || []).filter(function (a) { return a.align !== 'start'; });
    function btns(list) {
      return list.map(function (a) {
        var cls = a.kind === 'primary' ? 'btn btn-primary' : a.kind === 'danger' ? 'btn btn-danger' : 'btn';
        return '<button class="' + cls + '" value="' + esc(a.value) + '"' + (a.value === 'cancel' ? ' formnovalidate' : '') + '>' + (a.icon ? icon(a.icon) : '') + esc(a.label) + '</button>';
      }).join('');
    }
    dlg.innerHTML =
      '<form method="dialog" class="dlg-form" novalidate>' +
        '<header class="dlg-head"><h2 id="dlg-title">' + esc(opts.title) + '</h2>' +
          '<button type="button" class="icon-btn dlg-close" aria-label="Cerrar">' + icon('close') + '</button></header>' +
        '<div class="dlg-body">' + (opts.body || '') + '</div>' +
        '<footer class="dlg-foot"><div class="dlg-foot-start">' + btns(start) + '</div><div class="dlg-foot-end">' + btns(end) + '</div></footer>' +
      '</form>';
    document.body.appendChild(dlg);
    var form = dlg.querySelector('form');

    dlg.querySelector('.dlg-close').addEventListener('click', function () { dlg.close('cancel'); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close('cancel'); });
    form.addEventListener('submit', function (e) {
      var value = e.submitter ? e.submitter.value : 'save';
      if (value === 'cancel') return;
      if (value === 'save' && !form.checkValidity()) {
        e.preventDefault();
        var bad = form.querySelector(':invalid');
        if (bad) { bad.focus(); bad.classList.add('is-invalid'); }
        return;
      }
      if (opts.onAction && opts.onAction(value, form) === false) e.preventDefault();
    });
    dlg.addEventListener('close', function () {
      if (opts.onClose) opts.onClose(dlg.returnValue);
      setTimeout(function () { dlg.remove(); }, 0);
    });
    dlg.showModal();
    var first = form.querySelector('[autofocus]') || form.querySelector('input, textarea, select');
    if (first) first.focus();
    return dlg;
  }

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var ok = false;
      dialog({
        title: opts.title,
        size: 'sm',
        body: '<p class="dlg-text">' + esc(opts.message) + '</p>',
        actions: [
          { value: 'cancel', label: 'Cancelar' },
          { value: 'ok', label: opts.confirmLabel || 'Aceptar', kind: opts.danger ? 'danger' : 'primary' },
        ],
        onAction: function (v) { ok = v === 'ok'; },
        onClose: function () { resolve(ok); },
      });
    });
  }

  function options(list, selected) {
    return list.map(function (o) {
      return '<option value="' + esc(o.id) + '"' + (String(o.id) === String(selected) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
  }

  function projectOptions(selected, emptyLabel) {
    return '<option value="">' + esc(emptyLabel || 'Sin proyecto') + '</option>' +
      S.projects().map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
  }

  function taskDialog(taskId, defaults) {
    var t = taskId ? S.task(taskId) : null;
    var d = Object.assign({ title: '', description: '', status: 'todo', priority: 'media', due: '', projectId: '' }, defaults || {}, t || {});
    var actions = [];
    if (t) actions.push({ value: 'delete', label: 'Eliminar', kind: 'ghost', align: 'start', icon: 'trash' });
    actions.push({ value: 'cancel', label: 'Cancelar' });
    actions.push({ value: 'save', label: t ? 'Guardar' : 'Crear tarea', kind: 'primary' });

    dialog({
      title: t ? 'Editar tarea' : 'Nueva tarea',
      body:
        '<label class="fld"><span class="fld-label">Título</span><input class="input" name="title" required maxlength="200" autocomplete="off" value="' + esc(d.title) + '" autofocus></label>' +
        '<label class="fld"><span class="fld-label">Descripción <span class="fld-opt">opcional</span></span><textarea class="input" name="description" rows="3">' + esc(d.description) + '</textarea></label>' +
        '<div class="fld-row">' +
          '<label class="fld"><span class="fld-label">Estado</span><select class="input" name="status">' + options(S.TASK_STATUSES, d.status) + '</select></label>' +
          '<label class="fld"><span class="fld-label">Prioridad</span><select class="input" name="priority">' + options(S.PRIORITIES, d.priority) + '</select></label>' +
        '</div>' +
        '<div class="fld-row">' +
          '<label class="fld"><span class="fld-label">Fecha límite <span class="fld-opt">opcional</span></span><input class="input" type="date" name="due" value="' + esc(d.due) + '"></label>' +
          '<label class="fld"><span class="fld-label">Proyecto</span><select class="input" name="projectId">' + projectOptions(d.projectId) + '</select></label>' +
        '</div>',
      actions: actions,
      onAction: function (value, form) {
        if (value === 'delete') {
          var r = S.removeTask(t.id);
          toast('Tarea eliminada', { action: { label: 'Deshacer', run: r.undo } });
          return;
        }
        var data = {
          title: form.title.value.trim(),
          description: form.description.value.trim(),
          status: form.status.value,
          priority: form.priority.value,
          due: form.due.value,
          projectId: form.projectId.value,
        };
        if (!data.title) { form.title.focus(); return false; }
        if (t) {
          S.updateTask(t.id, data);
          toast('Tarea guardada');
        } else {
          S.addTask(data);
          toast('Tarea creada', { action: { label: 'Ver tablero', run: function () { DataP.navigate('tareas'); } } });
        }
      },
    });
  }

  function projectDialog(projectId) {
    var p = projectId ? S.project(projectId) : null;
    var d = Object.assign({ name: '', description: '', status: 'activo', color: 0 }, p || {});
    if (!d.color) {
      var used = S.projects().map(function (x) { return x.color; });
      d.color = (S.COLORS.filter(function (c) { return used.indexOf(c.id) < 0; })[0] || S.COLORS[0]).id;
    }
    var swatches = S.COLORS.map(function (c) {
      return '<label class="swatch pc-' + c.id + '"><input type="radio" name="color" value="' + c.id + '"' + (c.id === d.color ? ' checked' : '') + ' aria-label="' + esc(c.label) + '"><span></span></label>';
    }).join('');
    var actions = [];
    if (p) actions.push({ value: 'delete', label: 'Eliminar', kind: 'ghost', align: 'start', icon: 'trash' });
    actions.push({ value: 'cancel', label: 'Cancelar' });
    actions.push({ value: 'save', label: p ? 'Guardar' : 'Crear proyecto', kind: 'primary' });

    dialog({
      title: p ? 'Editar proyecto' : 'Nuevo proyecto',
      body:
        '<label class="fld"><span class="fld-label">Nombre</span><input class="input" name="name" required maxlength="120" autocomplete="off" value="' + esc(d.name) + '" autofocus></label>' +
        '<label class="fld"><span class="fld-label">Descripción <span class="fld-opt">opcional</span></span><textarea class="input" name="description" rows="3">' + esc(d.description) + '</textarea></label>' +
        '<label class="fld"><span class="fld-label">Estado</span><select class="input" name="status">' + options(S.PROJECT_STATUSES, d.status) + '</select></label>' +
        '<fieldset class="fld"><legend class="fld-label">Color</legend><div class="swatches">' + swatches + '</div></fieldset>',
      actions: actions,
      onAction: function (value, form) {
        if (value === 'delete') {
          confirmDialog({
            title: 'Eliminar proyecto',
            message: 'Se eliminará “' + p.name + '”. Sus tareas y notas se conservan, sin proyecto.',
            confirmLabel: 'Eliminar', danger: true,
          }).then(function (ok) {
            if (!ok) return;
            var r = S.removeProject(p.id);
            DataP.navigate('proyectos');
            toast('Proyecto eliminado', { action: { label: 'Deshacer', run: r.undo } });
          });
          return;
        }
        var data = {
          name: form.name.value.trim(),
          description: form.description.value.trim(),
          status: form.status.value,
          color: +((form.querySelector('input[name="color"]:checked') || {}).value || d.color),
        };
        if (!data.name) { form.name.focus(); return false; }
        if (p) {
          S.updateProject(p.id, data);
          toast('Proyecto guardado');
        } else {
          var created = S.addProject(data);
          DataP.navigate('proyectos', created.id);
          toast('Proyecto creado');
        }
      },
    });
  }

  function newNote(defaults) {
    var n = S.addNote(Object.assign({ title: '', body: '' }, defaults || {}));
    DataP.navigate('notas', n.id);
    return n;
  }

  function exportBackup() {
    var d = new Date();
    var name = 'datap-respaldo-' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + '.json';
    U.downloadText(name, S.exportJSON(), 'application/json');
    toast('Respaldo descargado');
  }

  /* ------------------------------------------------------------------------
     Paleta de comandos (Ctrl/⌘ + K)
     ------------------------------------------------------------------------ */
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function paletteItems() {
    var items = [];
    var goto = function (id, sub) { return function () { DataP.navigate(id, sub); }; };
    // Acciones
    items.push({ group: 'Acciones', icon: 'plus', title: 'Nueva tarea', keys: 'crear agregar tarea pendiente', run: function () { taskDialog(null); } });
    items.push({ group: 'Acciones', icon: 'note', title: 'Nueva nota', keys: 'crear agregar nota apunte', run: function () { newNote(); } });
    items.push({ group: 'Acciones', icon: 'folder', title: 'Nuevo proyecto', keys: 'crear agregar proyecto', run: function () { projectDialog(null); } });
    items.push({ group: 'Acciones', icon: 'moon', title: 'Cambiar tema claro/oscuro', keys: 'tema oscuro claro modo apariencia', run: function () { DataP.toggleTheme(); } });
    items.push({ group: 'Acciones', icon: 'download', title: 'Exportar respaldo', keys: 'respaldo backup exportar json descargar', run: exportBackup });
    // Páginas
    DataP.getModules().forEach(function (m) {
      if (m.palette === false) return;
      items.push({ group: 'Ir a', icon: m.icon || 'grid', title: m.navLabel || m.title, sub: m.summary || '', keys: (m.keywords || ''), run: goto(m.id) });
    });
    [['correlacion', 'Matriz de correlación'], ['varianza', 'Varianza explicada'], ['cargas', 'Cargas factoriales'], ['segmentacion', 'Mapa de segmentación'], ['conclusiones', 'Interpretación ejecutiva']].forEach(function (s) {
      items.push({ group: 'Ir a', icon: 'scatter', title: s[1], sub: 'Reporte PCA', keys: 'reporte pca ' + s[0], run: goto('analisis-pca', s[0]) });
    });
    // Contenido
    S.projects().forEach(function (p) {
      items.push({ group: 'Proyectos', icon: 'folder', dot: p.color, title: p.name, sub: label(S.PROJECT_STATUSES, p.status), keys: p.description, run: goto('proyectos', p.id) });
    });
    S.tasks().forEach(function (t) {
      var p = S.project(t.projectId);
      items.push({ group: 'Tareas', icon: t.status === 'done' ? 'check-circle' : 'circle', title: t.title, sub: label(S.TASK_STATUSES, t.status) + (p ? ' · ' + p.name : ''), keys: t.description, done: t.status === 'done', run: function () { taskDialog(t.id); } });
    });
    S.notes().forEach(function (n) {
      items.push({ group: 'Notas', icon: 'note', title: n.title || 'Nota sin título', sub: plain(n.body).slice(0, 80), keys: n.body, run: goto('notas', n.id) });
    });
    return items;
  }

  var paletteOpen = false;

  function openPalette() {
    if (paletteOpen) return;
    paletteOpen = true;
    var all = paletteItems();
    var dlg = document.createElement('dialog');
    dlg.className = 'dlg palette';
    dlg.setAttribute('aria-label', 'Buscar');
    dlg.innerHTML =
      '<div class="pal-search">' + icon('search') +
        '<input class="pal-input" type="text" placeholder="Busca o escribe para crear…" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" autocomplete="off" spellcheck="false">' +
        '<kbd class="kbd">Esc</kbd></div>' +
      '<ul class="pal-list" id="pal-list" role="listbox" aria-label="Resultados"></ul>' +
      '<div class="pal-foot"><span><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> moverse</span><span><kbd class="kbd">Enter</kbd> abrir</span></div>';
    document.body.appendChild(dlg);
    var input = dlg.querySelector('.pal-input');
    var listEl = dlg.querySelector('.pal-list');
    var shown = [];
    var active = 0;

    function filter(q) {
      var nq = norm(q).trim();
      if (!nq) {
        return all.filter(function (it) { return it.group === 'Acciones' || it.group === 'Ir a' && !/^Reporte/.test(it.sub || ''); })
          .concat(all.filter(function (it) { return it.group === 'Tareas' && !it.done; }).slice(0, 4));
      }
      var words = nq.split(/\s+/);
      var scored = [];
      all.forEach(function (it) {
        var title = norm(it.title);
        var hay = title + ' ' + norm(it.sub) + ' ' + norm(it.keys);
        if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
        var score = title.indexOf(nq) === 0 ? 3 : title.indexOf(nq) >= 0 ? 2 : 1;
        if (it.done) score -= 0.5;
        scored.push({ it: it, score: score });
      });
      scored.sort(function (a, b) { return b.score - a.score; });
      // Agrupa por tipo, respetando el orden del mejor resultado de cada grupo.
      var groups = [];
      var byGroup = {};
      scored.slice(0, 24).forEach(function (s) {
        if (!byGroup[s.it.group]) { byGroup[s.it.group] = []; groups.push(s.it.group); }
        byGroup[s.it.group].push(s.it);
      });
      var res = [];
      groups.forEach(function (g) { res = res.concat(byGroup[g]); });
      // Captura rápida: crear con el texto escrito.
      res.push({ group: 'Crear', icon: 'plus', title: 'Crear tarea: «' + q.trim() + '»', run: function () {
        S.addTask({ title: q.trim() });
        toast('Tarea creada', { action: { label: 'Ver tablero', run: function () { DataP.navigate('tareas'); } } });
      } });
      res.push({ group: 'Crear', icon: 'note', title: 'Crear nota: «' + q.trim() + '»', run: function () { newNote({ title: q.trim() }); } });
      return res;
    }

    function render() {
      var html = '';
      var lastGroup = null;
      shown.forEach(function (it, i) {
        if (it.group !== lastGroup) {
          html += '<li class="pal-group" role="presentation">' + esc(it.group) + '</li>';
          lastGroup = it.group;
        }
        var lead = it.dot ? '<span class="pal-ico ptag pc-' + it.dot + '"><span class="pdot"></span></span>' : '<span class="pal-ico">' + icon(it.icon) + '</span>';
        html += '<li class="pal-item' + (i === active ? ' is-active' : '') + (it.done ? ' is-done' : '') + '" role="option" id="pal-opt-' + i + '" data-i="' + i + '" aria-selected="' + (i === active) + '">' +
          lead + '<span class="pal-text"><span class="pal-title">' + esc(it.title) + '</span>' + (it.sub ? '<span class="pal-sub">' + esc(it.sub) + '</span>' : '') + '</span></li>';
      });
      if (!shown.length) html = '<li class="pal-empty">Sin resultados</li>';
      listEl.innerHTML = html;
      input.setAttribute('aria-activedescendant', shown.length ? 'pal-opt-' + active : '');
      var act = listEl.querySelector('.is-active');
      if (act) act.scrollIntoView({ block: 'nearest' });
    }

    function update() {
      shown = filter(input.value);
      active = 0;
      render();
    }

    function runActive(i) {
      var it = shown[i == null ? active : i];
      if (!it) return;
      dlg.close();
      setTimeout(it.run, 0);
    }

    input.addEventListener('input', update);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); runActive(); }
    });
    listEl.addEventListener('click', function (e) {
      var li = e.target.closest('[data-i]');
      if (li) runActive(+li.getAttribute('data-i'));
    });
    listEl.addEventListener('mousemove', function (e) {
      var li = e.target.closest('[data-i]');
      if (li && +li.getAttribute('data-i') !== active) { active = +li.getAttribute('data-i'); render(); }
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { paletteOpen = false; setTimeout(function () { dlg.remove(); }, 0); });

    dlg.showModal();
    update();
    input.focus();
  }

  /* ------------------------------------------------------------------------
     Filas de tarea reutilizables (Panel, Proyectos)
     ------------------------------------------------------------------------ */
  function taskRow(t, opts) {
    opts = opts || {};
    var done = t.status === 'done';
    var p = opts.showProject !== false ? S.project(t.projectId) : null;
    var meta = [
      p ? projectTag(p) : '',
      t.status === 'doing' ? '<span class="pstatus ps-activo">En curso</span>' : '',
      dueBadge(t.due, done),
      !done ? priorityBadge(t.priority) : '',
    ].filter(Boolean).join('');
    return '<li class="task-row' + (done ? ' is-done' : '') + '" data-id="' + esc(t.id) + '">' +
      '<button type="button" class="tcheck" data-toggle aria-label="' + (done ? 'Marcar como pendiente: ' : 'Completar: ') + esc(t.title) + '" aria-pressed="' + done + '">' + icon('check') + '</button>' +
      '<div class="task-main"><button type="button" class="task-title" data-open>' + esc(t.title) + '</button>' +
      (meta ? '<div class="task-meta">' + meta + '</div>' : '') + '</div></li>';
  }

  /** Completa o reabre una tarea y avisa con opción de deshacer. */
  function toggleWithToast(id) {
    var before = S.task(id);
    if (!before) return;
    var prev = { status: before.status, order: before.order };
    var t = S.toggleTask(id);
    toast(t.status === 'done' ? 'Tarea completada' : 'Tarea reabierta', {
      action: { label: 'Deshacer', run: function () { S.updateTask(id, prev); } },
    });
  }

  /** Maneja los clics de una lista de filas de tarea (casilla y título). */
  function bindTaskList(root) {
    root.addEventListener('click', function (e) {
      var row = e.target.closest('.task-row[data-id]');
      if (!row || !root.contains(row)) return;
      var id = row.getAttribute('data-id');
      if (e.target.closest('[data-toggle]')) toggleWithToast(id);
      else if (e.target.closest('[data-open]')) taskDialog(id);
    });
  }

  /** Ordena tareas abiertas por urgencia: atrasadas, por fecha, luego prioridad. */
  function byUrgency(a, b) {
    var pr = { alta: 0, media: 1, baja: 2 };
    var da = daysFromToday(a.due);
    var db = daysFromToday(b.due);
    if (a.status !== b.status && (a.status === 'done' || b.status === 'done')) return a.status === 'done' ? 1 : -1;
    if (da != null && db != null && da !== db) return da - db;
    if (da != null && db == null) return -1;
    if (da == null && db != null) return 1;
    if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
    return (a.order || 0) - (b.order || 0);
  }

  DataP.ui = {
    taskRow: taskRow,
    toggleWithToast: toggleWithToast,
    bindTaskList: bindTaskList,
    byUrgency: byUrgency,
    parseDay: parseDay,
    daysFromToday: daysFromToday,
    dueInfo: dueInfo,
    relTime: relTime,
    longDate: longDate,
    label: label,
    projectTag: projectTag,
    priorityBadge: priorityBadge,
    dueBadge: dueBadge,
    statusBadge: statusBadge,
    progressBar: progressBar,
    markdown: markdown,
    plain: plain,
    toast: toast,
    dialog: dialog,
    confirm: confirmDialog,
    taskDialog: taskDialog,
    projectDialog: projectDialog,
    newNote: newNote,
    exportBackup: exportBackup,
    projectOptions: projectOptions,
    options: options,
    openPalette: openPalette,
  };
})();
