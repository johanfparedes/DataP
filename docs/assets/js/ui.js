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
     Captura inteligente: entiende fecha, prioridad, proyecto y repetición
     escritos en el título. Ej.: "Llamar a Ana el viernes !alta #datap"
     ------------------------------------------------------------------------ */
  var WEEKDAY_RE = ['domingo', 'lunes', 'martes', 'mi[eé]rcoles', 'jueves', 'viernes', 's[aá]bado'];
  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MONTH_RE = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\\.?';
  var NUM_WORDS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15 };
  var END = '(?=$|[\\s.,;:!?])';
  var START = '(^|\\s)';

  function dayOf(d) { return S.toDayStr(d); }
  function todayDate() { var t = new Date(); t.setHours(0, 0, 0, 0); return t; }
  function nextWeekday(wd, allowToday) {
    var d = todayDate();
    var diff = (wd - d.getDay() + 7) % 7;
    if (diff === 0 && !allowToday) diff = 7;
    d.setDate(d.getDate() + diff);
    return dayOf(d);
  }
  function monthIndex(word) {
    var w = norm(word).replace('.', '').slice(0, 3);
    if (w === 'set') w = 'sep';
    return MONTHS.indexOf(w);
  }
  function validDate(y, m, d) {
    var dt = new Date(y, m, d);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d ? dt : null;
  }
  /** Fecha sin año: este año, o el siguiente si ya pasó. */
  function upcoming(m, d) {
    var t = todayDate();
    var dt = validDate(t.getFullYear(), m, d);
    if (dt && dt < t) dt = validDate(t.getFullYear() + 1, m, d);
    return dt ? dayOf(dt) : null;
  }

  function parseQuick(text) {
    var src = String(text || '');
    var out = { title: src.trim(), due: '', priority: '', projectId: '', repeat: '', found: [] };
    var work = src;

    function take(re, fn) {
      var m = re.exec(work);
      if (!m) return false;
      var res = fn(m);
      if (res === false) return false;
      work = work.slice(0, m.index) + (m[1] && /\s/.test(m[1]) ? ' ' : '') + work.slice(m.index + m[0].length);
      return true;
    }

    // Repetición
    var wdAlt = WEEKDAY_RE.join('|');
    take(new RegExp(START + '(cada|todos los)\\s+(' + wdAlt + ')' + END, 'i'), function (m) {
      var wd = WEEKDAY_RE.findIndex(function (r) { return new RegExp('^' + r + '$', 'i').test(m[3]); });
      out.repeat = 'weekly';
      out.due = nextWeekday(wd, true);
    }) ||
    take(new RegExp(START + '((de\\s+)?lunes\\s+a\\s+viernes|entre\\s+semana|(los\\s+)?d[ií]as\\s+(laborables|h[aá]biles))' + END, 'i'), function () { out.repeat = 'weekdays'; }) ||
    take(new RegExp(START + '(cada\\s+d[ií]a|todos\\s+los\\s+d[ií]as|a\\s+diario|diariamente)' + END, 'i'), function () { out.repeat = 'daily'; }) ||
    take(new RegExp(START + '(cada\\s+semana|todas\\s+las\\s+semanas|semanalmente)' + END, 'i'), function () { out.repeat = 'weekly'; }) ||
    take(new RegExp(START + '(cada\\s+mes|todos\\s+los\\s+meses|mensualmente)' + END, 'i'), function () { out.repeat = 'monthly'; });

    // Fecha
    var pre = '((?:para|antes\\s+del?|hasta\\s+el|el|este|esta|la)\\s+)?';
    if (!out.due) {
      take(new RegExp(START + pre + 'pasado\\s+ma[nñ]ana' + END, 'i'), function () { out.due = S.dayStr(2); }) ||
      take(new RegExp(START + '((?:para|desde)\\s+)?(hoy|esta\\s+noche|esta\\s+tarde)' + END, 'i'), function () { out.due = S.dayStr(0); }) ||
      take(new RegExp(START + '((?:para|desde)\\s+)?ma[nñ]ana' + END, 'i'), function (m) {
        // "por la mañana" / "de la mañana" no es una fecha.
        if (/(la|por|de)\s*$/i.test(work.slice(0, m.index + m[1].length))) return false;
        out.due = S.dayStr(1);
      }) ||
      take(new RegExp(START + '((?:para|en|dentro\\s+de)\\s+)?(?:la\\s+)?(pr[oó]xima\\s+semana|semana\\s+que\\s+viene)' + END, 'i'), function () { out.due = nextWeekday(1, false); }) ||
      take(new RegExp(START + pre + '(?:este\\s+)?fin\\s+de\\s+semana' + END, 'i'), function () {
        var wd = todayDate().getDay();
        out.due = wd === 0 ? S.dayStr(0) : nextWeekday(6, true);
      }) ||
      take(new RegExp(START + '(?:en|dentro\\s+de)\\s+(\\d{1,3}|' + Object.keys(NUM_WORDS).join('|') + ')\\s+(d[ií]as?|semanas?|mes(?:es)?)' + END, 'i'), function (m) {
        var n = /^\d+$/.test(m[2]) ? +m[2] : NUM_WORDS[m[2].toLowerCase()];
        var unit = norm(m[3]);
        if (unit.indexOf('semana') === 0) out.due = S.dayStr(n * 7);
        else if (unit.indexOf('mes') === 0) {
          var d = todayDate(); d.setMonth(d.getMonth() + n); out.due = dayOf(d);
        } else out.due = S.dayStr(n);
      }) ||
      take(new RegExp(START + pre + '(?:(?:el|la)\\s+)?(pr[oó]xim[oa]\\s+)?(' + wdAlt + ')' + END, 'i'), function (m) {
        var wd = WEEKDAY_RE.findIndex(function (r) { return new RegExp('^' + r + '$', 'i').test(m[4]); });
        out.due = nextWeekday(wd, false);
      }) ||
      take(new RegExp(START + pre + '(\\d{1,2})([/.-])(\\d{1,2})(?:\\4(\\d{2}|\\d{4}))?' + END, 'i'), function (m) {
        // "1.5" o "1-5" solo cuentan como fecha con "el"/"para" delante (p. ej. versiones o rangos).
        if (m[4] !== '/' && !m[2]) return false;
        var d = +m[3], mo = +m[5] - 1;
        if (m[6]) {
          var y = +m[6]; if (y < 100) y += 2000;
          var dt = validDate(y, mo, d);
          if (!dt) return false;
          out.due = dayOf(dt);
        } else {
          var u = upcoming(mo, d);
          if (!u) return false;
          out.due = u;
        }
      }) ||
      take(new RegExp(START + pre + '(\\d{1,2})\\s+(?:de\\s+)?' + MONTH_RE + '(?:\\s+(?:de\\s+)?(\\d{4}))?' + END, 'i'), function (m) {
        var mo = monthIndex(m[4]);
        if (mo < 0) return false;
        if (m[5]) {
          var dt = validDate(+m[5], mo, +m[3]);
          if (!dt) return false;
          out.due = dayOf(dt);
        } else {
          var u = upcoming(mo, +m[3]);
          if (!u) return false;
          out.due = u;
        }
      }) ||
      take(new RegExp(START + '((?:para\\s+)?el\\s+(?:d[ií]a\\s+)?|(?:para\\s+)?d[ií]a\\s+)(\\d{1,2})' + END, 'i'), function (m) {
        var d = +m[3];
        if (d < 1 || d > 31) return false;
        var t = todayDate();
        var dt = validDate(t.getFullYear(), t.getMonth(), d);
        var guard = 0;
        var y = t.getFullYear(), mo = t.getMonth();
        while ((!dt || dt < t) && guard++ < 12) {
          mo++; if (mo > 11) { mo = 0; y++; }
          dt = validDate(y, mo, d);
        }
        if (!dt) return false;
        out.due = dayOf(dt);
      });
    }

    // Prioridad
    take(new RegExp(START + '(!{3}|!(?:alta|a|1|urgente))' + END, 'i'), function () { out.priority = 'alta'; }) ||
    take(new RegExp(START + '(!{2}|!(?:media|m|2))' + END, 'i'), function () { out.priority = 'media'; }) ||
    take(new RegExp(START + '(!(?:baja|b|3))' + END, 'i'), function () { out.priority = 'baja'; });

    // Proyecto: #id o #parte-del-nombre
    take(/(^|\s)#([^\s#]+)(?=$|\s)/, function (m) {
      var q = norm(m[2]).replace(/[-_]+/g, ' ').trim();
      if (!q) return false;
      var list = S.projects();
      var hit = list.filter(function (p) { return norm(p.id) === norm(m[2]); })[0] ||
        list.filter(function (p) { return norm(p.name).indexOf(q) === 0; })[0] ||
        list.filter(function (p) { return norm(p.name).indexOf(q) >= 0; })[0];
      if (!hit) return false;
      out.projectId = hit.id;
    });

    var title = work.replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim().replace(/^[,;:\-–]+\s*|\s*[,;:\-–]+$/g, '');
    if (title) {
      // Si la frase empezaba con mayúscula, el título también.
      var first = src.trim().charAt(0);
      if (first && first === first.toUpperCase() && first !== first.toLowerCase()) title = title.charAt(0).toUpperCase() + title.slice(1);
      out.title = title;
    }
    if (out.due) out.found.push('due');
    if (out.priority) out.found.push('priority');
    if (out.projectId) out.found.push('project');
    if (out.repeat) out.found.push('repeat');
    return out;
  }

  var dtWeekday = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' });
  function dayLabel(s) {
    var n = daysFromToday(s);
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Mañana';
    var t = dtWeekday.format(parseDay(s)).replace(/\./g, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /** Chips con lo que entendió la captura inteligente. */
  function smartHint(parsed) {
    if (!parsed || !parsed.found.length) return '';
    var chips = [];
    if (parsed.due) chips.push('<span class="sh-chip">' + icon('calendar') + esc(dayLabel(parsed.due)) + '</span>');
    if (parsed.repeat) chips.push('<span class="sh-chip">' + icon('repeat') + esc(label(S.REPEATS, parsed.repeat)) + '</span>');
    if (parsed.priority) chips.push(priorityBadge(parsed.priority));
    if (parsed.projectId) chips.push(projectTag(S.project(parsed.projectId)));
    return '<span class="sh-label">Se guardará:</span>' + chips.join('');
  }

  /** Une lo escrito con los valores por defecto del contexto (proyecto, fecha…). */
  function quickTaskData(text, defaults) {
    var p = parseQuick(text);
    var d = Object.assign({}, defaults || {});
    d.title = p.title;
    if (p.due) d.due = p.due;
    if (p.priority) d.priority = p.priority;
    if (p.projectId) d.projectId = p.projectId;
    if (p.repeat) d.repeat = p.repeat;
    return d;
  }

  // Vista previa en vivo en cualquier campo con data-smart.
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.hasAttribute || !el.hasAttribute('data-smart')) return;
    var host = el.closest('form') || el.parentNode;
    var hint = host && host.querySelector('.smart-hint');
    if (!hint) return;
    var html = el.value.trim() ? smartHint(parseQuick(el.value)) : '';
    hint.innerHTML = html;
    hint.hidden = !html;
  });

  function smartHintSlot() {
    return '<div class="smart-hint" aria-live="polite" hidden></div>';
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

  function repeatBadge(r) {
    return '<span class="meta-chip" title="Se repite: ' + esc(label(S.REPEATS, r).toLowerCase()) + '">' + icon('repeat') + '<span class="visually-hidden">Se repite: </span>' + esc(label(S.REPEATS, r)) + '</span>';
  }

  function subtaskBadge(t) {
    var list = t.subtasks || [];
    if (!list.length) return '';
    var n = list.filter(function (x) { return x.done; }).length;
    return '<span class="meta-chip' + (n === list.length ? ' is-complete' : '') + '" title="Subtareas hechas">' + icon('list-check') + n + '/' + list.length + '</span>';
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
    // Enter en un campo envía con la acción principal (nunca con "Eliminar",
    // que es el primer botón del formulario).
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
      var el = e.target;
      if (el.tagName !== 'INPUT' || /^(button|submit|reset|file)$/.test(el.type)) return;
      e.preventDefault();
      var primary = form.querySelector('.dlg-foot .btn-primary, .dlg-foot .btn-danger');
      if (primary) form.requestSubmit(primary);
    });
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

  function subtaskItem(st) {
    return '<li class="st-item" data-st="' + esc(st.id || '') + '">' +
      '<input type="checkbox" class="st-check" aria-label="Hecha"' + (st.done ? ' checked' : '') + '>' +
      '<input class="st-title" value="' + esc(st.title) + '" aria-label="Subtarea" maxlength="200" data-st-enter>' +
      '<button type="button" class="icon-btn st-del" data-st-del aria-label="Quitar subtarea">' + icon('close') + '</button></li>';
  }

  function fmtMinutes(min) {
    if (!min) return '0 min';
    var h = Math.floor(min / 60);
    var m = min % 60;
    return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min';
  }

  function taskDialog(taskId, defaults) {
    var t = taskId ? S.task(taskId) : null;
    var d = Object.assign({ title: '', description: '', status: 'todo', priority: 'media', due: '', projectId: '', repeat: '', subtasks: [] }, defaults || {}, t || {});
    var actions = [];
    if (t) actions.push({ value: 'delete', label: 'Eliminar', kind: 'ghost', align: 'start', icon: 'trash' });
    if (t && t.status !== 'done' && DataP.focus) actions.push({ value: 'focus', label: 'Enfocarme', align: 'start', icon: 'timer' });
    actions.push({ value: 'cancel', label: 'Cancelar' });
    actions.push({ value: 'save', label: t ? 'Guardar' : 'Crear tarea', kind: 'primary' });
    var focusMin = t ? S.focusSessions({ taskId: t.id }).reduce(function (a, f) { return a + f.minutes; }, 0) : 0;

    var dlg = dialog({
      title: t ? 'Editar tarea' : 'Nueva tarea',
      body:
        '<label class="fld"><span class="fld-label">Título</span><input class="input" name="title" required maxlength="200" autocomplete="off" value="' + esc(d.title) + '" autofocus' + (t ? '' : ' data-smart placeholder="Ej.: Enviar informe el viernes !alta #proyecto"') + '>' + (t ? '' : smartHintSlot()) + '</label>' +
        '<label class="fld"><span class="fld-label">Descripción <span class="fld-opt">opcional</span></span><textarea class="input" name="description" rows="3">' + esc(d.description) + '</textarea></label>' +
        '<fieldset class="fld"><legend class="fld-label">Subtareas <span class="fld-opt">opcional</span></legend>' +
          '<ul class="st-list" data-st-list>' + (d.subtasks || []).map(subtaskItem).join('') + '</ul>' +
          '<div class="st-add">' + icon('plus') + '<input class="st-new" data-st-new placeholder="Añadir subtarea y pulsar Enter" maxlength="200" aria-label="Nueva subtarea"></div>' +
        '</fieldset>' +
        '<div class="fld-row">' +
          '<label class="fld"><span class="fld-label">Estado</span><select class="input" name="status">' + options(S.TASK_STATUSES, d.status) + '</select></label>' +
          '<label class="fld"><span class="fld-label">Prioridad</span><select class="input" name="priority">' + options(S.PRIORITIES, d.priority) + '</select></label>' +
        '</div>' +
        '<div class="fld-row">' +
          '<label class="fld"><span class="fld-label">Fecha límite <span class="fld-opt">opcional</span></span><input class="input" type="date" name="due" value="' + esc(d.due) + '"></label>' +
          '<label class="fld"><span class="fld-label">Repetir</span><select class="input" name="repeat">' + options(S.REPEATS, d.repeat || '') + '</select></label>' +
        '</div>' +
        '<label class="fld"><span class="fld-label">Proyecto</span><select class="input" name="projectId">' + projectOptions(d.projectId) + '</select></label>' +
        (t && focusMin ? '<p class="fld-note">' + icon('timer') + 'Tiempo de enfoque en esta tarea: <strong>' + esc(fmtMinutes(focusMin)) + '</strong></p>' : ''),
      actions: actions,
      onAction: function (value, form) {
        if (value === 'delete') {
          var r = S.removeTask(t.id);
          toast('Tarea eliminada', { action: { label: 'Deshacer', run: r.undo } });
          return;
        }
        if (value === 'focus') {
          DataP.focus.start({ taskId: t.id });
          DataP.navigate('enfoque');
          return;
        }
        var subtasks = Array.prototype.map.call(form.querySelectorAll('.st-item'), function (li) {
          return { id: li.getAttribute('data-st') || undefined, title: li.querySelector('.st-title').value, done: li.querySelector('.st-check').checked };
        });
        var pending = form.querySelector('[data-st-new]').value.trim();
        if (pending) subtasks.push({ title: pending, done: false });
        var data = {
          title: form.title.value.trim(),
          description: form.description.value.trim(),
          status: form.status.value,
          priority: form.priority.value,
          due: form.due.value,
          repeat: form.repeat.value,
          projectId: form.projectId.value,
          subtasks: subtasks,
        };
        if (!data.title) { form.title.focus(); return false; }
        if (t) {
          S.updateTask(t.id, data);
          toast('Tarea guardada');
        } else {
          // Captura inteligente en el título: solo rellena lo que no se cambió a mano.
          var parsed = parseQuick(data.title);
          if (parsed.found.length) {
            data.title = parsed.title;
            if (parsed.due && !data.due) data.due = parsed.due;
            if (parsed.priority && data.priority === (d.priority || 'media')) data.priority = parsed.priority;
            if (parsed.projectId && !data.projectId) data.projectId = parsed.projectId;
            if (parsed.repeat && !data.repeat) data.repeat = parsed.repeat;
          }
          if (data.repeat && !data.due) data.due = S.dayStr(0);
          S.addTask(data);
          toast('Tarea creada', { action: { label: 'Ver tablero', run: function () { DataP.navigate('tareas'); } } });
        }
      },
    });

    // Subtareas: Enter añade, la cruz quita.
    var list = dlg.querySelector('[data-st-list]');
    var add = dlg.querySelector('[data-st-new]');
    dlg.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      if (e.target === add) {
        e.preventDefault();
        var v = add.value.trim();
        if (!v) return;
        list.insertAdjacentHTML('beforeend', subtaskItem({ title: v, done: false }));
        add.value = '';
      } else if (e.target.hasAttribute && e.target.hasAttribute('data-st-enter')) {
        e.preventDefault();
        add.focus();
      }
    }, true);
    dlg.addEventListener('click', function (e) {
      var del = e.target.closest('[data-st-del]');
      if (del) { del.closest('.st-item').remove(); add.focus(); }
    });
    return dlg;
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
    if (DataP.focus) {
      items.push({ group: 'Acciones', icon: 'timer', title: DataP.focus.state().running ? 'Ver el temporizador de enfoque' : 'Iniciar enfoque (25 min)', keys: 'pomodoro temporizador concentrar enfoque foco', run: function () {
        if (!DataP.focus.state().running) DataP.focus.start({});
        DataP.navigate('enfoque');
      } });
    }
    items.push({ group: 'Acciones', icon: 'flame', title: 'Nuevo hábito', keys: 'crear agregar habito rutina', run: function () { DataP.navigate('habitos'); setTimeout(function () { if (DataP.ui.habitDialog) DataP.ui.habitDialog(null); }, 0); } });
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
    S.habits().forEach(function (h) {
      var st = S.habitStats(h.id);
      items.push({ group: 'Hábitos', icon: st.doneToday ? 'check-circle' : 'flame', title: (st.doneToday ? 'Desmarcar hoy: ' : 'Marcar hoy: ') + h.name, sub: st.streak ? 'Racha de ' + st.streak + (st.streak === 1 ? ' día' : ' días') : 'Hábito', keys: 'habito marcar cumplir', run: function () {
        var on = S.toggleHabit(h.id);
        toast(on ? 'Hábito cumplido hoy' : 'Hábito desmarcado');
      } });
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
      var qd = quickTaskData(q.trim());
      var qp = parseQuick(q.trim());
      var subBits = [];
      if (qd.due) subBits.push(dayLabel(qd.due));
      if (qd.repeat) subBits.push(label(S.REPEATS, qd.repeat));
      if (qd.priority) subBits.push('Prioridad ' + label(S.PRIORITIES, qd.priority).toLowerCase());
      if (qd.projectId && S.project(qd.projectId)) subBits.push(S.project(qd.projectId).name);
      res.push({ group: 'Crear', icon: 'plus', title: 'Crear tarea: «' + (qp.found.length ? qd.title : q.trim()) + '»', sub: subBits.join(' · '), run: function () {
        if (qd.repeat && !qd.due) qd.due = S.dayStr(0);
        S.addTask(qd);
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
      t.repeat ? repeatBadge(t.repeat) : '',
      subtaskBadge(t),
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
    parseQuick: parseQuick,
    quickTaskData: quickTaskData,
    smartHint: smartHint,
    smartHintSlot: smartHintSlot,
    dayLabel: dayLabel,
    fmtMinutes: fmtMinutes,
    repeatBadge: repeatBadge,
    subtaskBadge: subtaskBadge,
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
