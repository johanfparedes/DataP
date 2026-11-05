/* ==========================================================================
   Módulo: Enfoque
   Temporizador por bloques (25 min de trabajo + descansos) unido a una tarea.
   El reloj vive en DataP.focus (focus.js), así que sigue contando aunque
   cambies de página.
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;

  var dtWeekday = new Intl.DateTimeFormat('es', { weekday: 'short' });
  var dtLong = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
  var dtTime = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });
  var FOCUS_OPTIONS = [15, 25, 45, 60];

  function ringSvg(st) {
    var r = 108;
    var c = 2 * Math.PI * r;
    var frac = st.duration ? st.remaining / st.duration : 1;
    return '<svg class="ring" viewBox="0 0 240 240" aria-hidden="true">' +
      '<circle class="ring-track" cx="120" cy="120" r="' + r + '"></circle>' +
      '<circle class="ring-fill" cx="120" cy="120" r="' + r + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - frac)).toFixed(2) + '"></circle>' +
      '</svg>';
  }

  /** Columnas de minutos de los últimos 7 días (una sola serie). */
  function weekChart(el, days) {
    var C = DataP.lib.charts;
    var max = Math.max.apply(null, days.map(function (d) { return d.min; }));
    var top = C.niceDomain(0, Math.max(max, 30), 3)[1];
    var tip = C.makeTip(el);
    C.mount(el, function (W) {
      var H = 168;
      var m = { top: 22, right: 8, bottom: 26, left: 34 };
      var pw = W - m.left - m.right;
      var ph = H - m.top - m.bottom;
      var band = pw / days.length;
      var bw = Math.min(24, band * 0.6);
      var y = function (v) { return m.top + ph - (v / top) * ph; };
      var svg = '<svg width="' + W + '" height="' + H + '" role="img" aria-label="Minutos de enfoque de los últimos 7 días">';
      C.ticks(0, top, 3).forEach(function (t) {
        svg += '<line class="' + (t === 0 ? 'baseline' : 'gridline') + '" x1="' + m.left + '" x2="' + (W - m.right) + '" y1="' + y(t) + '" y2="' + y(t) + '"></line>' +
          '<g class="tick"><text x="' + (m.left - 8) + '" y="' + y(t) + '" dy="0.35em" text-anchor="end">' + t + '</text></g>';
      });
      days.forEach(function (d, i) {
        var cx = m.left + band * i + band / 2;
        var path = C.columnPath(cx - bw / 2, bw, y(0), y(d.min));
        if (path) svg += '<path class="focus-bar' + (d.today ? ' is-today' : '') + '" d="' + path + '"></path>';
        if (d.today && d.min) svg += '<text class="value-label" x="' + cx + '" y="' + (y(d.min) - 6) + '" text-anchor="middle">' + d.min + '</text>';
        svg += '<g class="tick"><text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text></g>';
        svg += '<rect class="hit" x="' + (m.left + band * i) + '" y="' + m.top + '" width="' + band + '" height="' + ph + '" data-i="' + i + '" tabindex="0" aria-label="' + esc(d.long + ': ' + d.min + ' minutos') + '"></rect>';
      });
      svg += '</svg>';
      el.querySelectorAll('svg').forEach(function (s) { s.remove(); });
      el.insertAdjacentHTML('afterbegin', svg);
      function show(i, x, yy) {
        var d = days[i];
        tip.show(x, yy, d.long, [{ value: DataP.ui.fmtMinutes(d.min), label: d.sessions + (d.sessions === 1 ? ' sesión' : ' sesiones') }]);
      }
      el.querySelectorAll('.hit').forEach(function (h) {
        var i = +h.getAttribute('data-i');
        h.addEventListener('pointermove', function (e) { var p = C.localPoint(el, e); show(i, p.x, p.y); });
        h.addEventListener('pointerleave', function () { tip.hide(); });
        h.addEventListener('focus', function () { show(i, m.left + band * i + band / 2, y(days[i].min)); });
        h.addEventListener('blur', function () { tip.hide(); });
      });
    });
  }

  DataP.registerModule({
    id: 'enfoque',
    title: 'Enfoque',
    section: 'General',
    icon: 'timer',
    order: 30,
    summary: 'Temporizador de 25 minutos para concentrarte en una tarea.',
    keywords: 'pomodoro temporizador concentracion foco tiempo',

    render: function (root) {
      var S = DataP.store;
      var UI = DataP.ui;
      var F = DataP.focus;

      function stats() {
        var byDay = S.focusByDay();
        var sessions = S.focusSessions();
        var countByDay = {};
        sessions.forEach(function (f) { var k = S.toDayStr(new Date(f.endedAt)); countByDay[k] = (countByDay[k] || 0) + 1; });
        var days = [];
        for (var i = 6; i >= 0; i--) {
          var k = S.dayStr(-i);
          var dt = UI.parseDay(k);
          var lbl = dtWeekday.format(dt).replace('.', '');
          days.push({ key: k, min: byDay[k] || 0, sessions: countByDay[k] || 0, label: i === 0 ? 'Hoy' : lbl.charAt(0).toUpperCase() + lbl.slice(1), long: i === 0 ? 'Hoy' : dtLong.format(dt), today: i === 0 });
        }
        var week = days.reduce(function (a, d) { return a + d.min; }, 0);
        return { days: days, today: days[6], week: week, sessions: sessions };
      }

      function draw() {
        var st = F.state();
        var openTasks = S.tasks({ open: true }).sort(UI.byUrgency);
        var current = st.taskId ? S.task(st.taskId) : null;
        var info = stats();
        var recent = info.sessions.slice(0, 6);

        var taskOpts = '<option value="">Sin tarea concreta</option>' + openTasks.map(function (t) {
          return '<option value="' + esc(t.id) + '"' + (t.id === st.taskId ? ' selected' : '') + '>' + esc(t.title) + '</option>';
        }).join('') + (current && current.status === 'done' ? '<option value="' + esc(current.id) + '" selected>' + esc(current.title) + ' (hecha)</option>' : '');

        var modes = ['focus', 'short', 'long'].map(function (m) {
          return '<button type="button" data-mode="' + m + '" aria-pressed="' + (st.mode === m) + '">' + esc(F.MODES[m].label) + '</button>';
        }).join('');
        var lengths = FOCUS_OPTIONS.map(function (n) {
          return '<button type="button" class="chip-btn" data-len="' + n + '" aria-pressed="' + (st.settings.focus === n) + '">' + n + ' min</button>';
        }).join('');
        var canNotify = 'Notification' in window;

        root.innerHTML =
          '<div class="page-top">' +
            '<header class="page-header"><h1>Enfoque</h1><p class="lede">Trabaja en bloques de ' + st.settings.focus + ' minutos y descansa entre ellos. Cada bloque terminado queda registrado en su tarea.</p></header>' +
          '</div>' +
          '<div class="focus-layout">' +
            '<section class="card focus-card' + (st.mode !== 'focus' ? ' is-break' : '') + '" aria-label="Temporizador">' +
              '<div class="seg-inline focus-modes" role="group" aria-label="Tipo de bloque">' + modes + '</div>' +
              '<div class="ring-wrap">' + ringSvg(st) +
                '<div class="ring-center"><span class="ring-time" data-ring-time>' + F.clock(st.remaining) + '</span>' +
                '<span class="ring-sub">' + esc(st.running ? (st.mode === 'focus' ? 'Concentrado' : 'Descansando') : st.paused ? 'En pausa' : 'Listo') + ' · bloque ' + st.round + ' de ' + st.rounds + '</span></div>' +
              '</div>' +
              '<div class="focus-controls">' +
                '<button type="button" class="icon-btn focus-side-btn" data-reset aria-label="Reiniciar bloque" title="Reiniciar">' + icon('reset') + '</button>' +
                '<button type="button" class="btn btn-primary focus-main" data-toggle-timer>' + icon(st.running ? 'pause' : 'play') + (st.running ? 'Pausar' : st.paused ? 'Seguir' : 'Empezar') + '</button>' +
                '<button type="button" class="icon-btn focus-side-btn" data-skip aria-label="Terminar bloque ahora" title="Terminar ahora">' + icon('skip') + '</button>' +
              '</div>' +
              '<label class="fld focus-task"><span class="fld-label">¿En qué vas a trabajar?</span><select class="input" id="focus-task">' + taskOpts + '</select></label>' +
              '<div class="focus-lengths" role="group" aria-label="Duración del enfoque"><span class="fld-label">Duración</span>' + lengths + '</div>' +
            '</section>' +
            '<div class="focus-side">' +
              '<div class="focus-stats">' +
                '<div class="card stat"><span class="stat-label">Hoy</span><span class="stat-value">' + esc(UI.fmtMinutes(info.today.min)) + '</span><span class="stat-note">' + info.today.sessions + (info.today.sessions === 1 ? ' bloque' : ' bloques') + '</span></div>' +
                '<div class="card stat"><span class="stat-label">Últimos 7 días</span><span class="stat-value">' + esc(UI.fmtMinutes(info.week)) + '</span><span class="stat-note">' + info.days.filter(function (d) { return d.min; }).length + ' días con enfoque</span></div>' +
              '</div>' +
              '<section class="card" style="margin-top:16px"><div class="card-head"><h2 class="card-title">Minutos por día</h2></div><div class="focus-chart" id="focus-chart"></div>' +
                '<table class="visually-hidden"><caption>Minutos de enfoque por día</caption><tbody>' + info.days.map(function (d) { return '<tr><th>' + esc(d.long) + '</th><td>' + d.min + ' min</td></tr>'; }).join('') + '</tbody></table></section>' +
              '<section class="card" style="margin-top:16px"><div class="card-head"><h2 class="card-title">Bloques recientes</h2></div>' +
                (recent.length ? '<ul class="focus-log">' + recent.map(function (f) {
                  var t = f.taskId ? S.task(f.taskId) : null;
                  var end = new Date(f.endedAt);
                  var k = S.toDayStr(end);
                  var when = k === S.dayStr(0) ? 'Hoy' : k === S.dayStr(-1) ? 'Ayer' : dtLong.format(end);
                  return '<li><span class="fl-min">' + f.minutes + ' min</span><span class="fl-task">' + esc(t ? t.title : 'Sin tarea') + '</span><span class="fl-when">' + esc(when + ', ' + dtTime.format(end)) + '</span></li>';
                }).join('') + '</ul>' : '<div class="empty" style="padding:18px 8px">' + icon('timer') + 'Termina tu primer bloque y aparecerá aquí.</div>') +
              '</section>' +
              (canNotify ? '<div class="settings-row" style="margin-top:8px"><div class="txt"><strong>Avisarme al terminar</strong><span>Notificación del sistema aunque estés en otra pestaña.</span></div>' +
                '<button type="button" class="btn btn-sm" data-notify aria-pressed="' + st.settings.notify + '">' + (st.settings.notify ? 'Activado' : 'Activar') + '</button></div>' : '') +
            '</div>' +
          '</div>';

        weekChart(root.querySelector('#focus-chart'), info.days);
      }

      // Solo se actualiza el reloj cada segundo; la página entera, cuando cambia el estado.
      var lastKey = '';
      function onTick(st) {
        var key = [st.mode, st.running, st.paused, st.taskId, st.round, st.settings.focus, st.settings.notify, st.duration].join('|');
        if (key !== lastKey) { lastKey = key; draw(); return; }
        var time = root.querySelector('[data-ring-time]');
        if (time) time.textContent = F.clock(st.remaining);
        var fill = root.querySelector('.ring-fill');
        if (fill) {
          var c = +fill.getAttribute('stroke-dasharray');
          fill.setAttribute('stroke-dashoffset', (c * (1 - (st.duration ? st.remaining / st.duration : 1))).toFixed(2));
        }
      }

      root.addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('[data-toggle-timer]')) { F.toggle(); return; }
        if (t.closest('[data-reset]')) { F.reset(); return; }
        if (t.closest('[data-skip]')) { F.skip(); return; }
        var m = t.closest('[data-mode]');
        if (m) { F.setMode(m.getAttribute('data-mode')); return; }
        var len = t.closest('[data-len]');
        if (len) { F.setMinutes('focus', +len.getAttribute('data-len')); return; }
        if (t.closest('[data-notify]')) {
          F.setNotify(!F.state().settings.notify).then(function (on) {
            if (!on && 'Notification' in window && Notification.permission === 'denied') UI.toast('El navegador bloqueó las notificaciones para esta web.');
          });
        }
      });
      root.addEventListener('change', function (e) {
        if (e.target.id === 'focus-task') F.setTask(e.target.value);
      });

      lastKey = '';
      var st0 = F.state();
      lastKey = [st0.mode, st0.running, st0.paused, st0.taskId, st0.round, st0.settings.focus, st0.settings.notify, st0.duration].join('|');
      draw();
      var offFocus = F.subscribe(onTick);
      var offStore = S.subscribe(function (ch) { if (ch.kind === 'focus' || ch.kind === 'task' || ch.kind === 'all') draw(); });
      return function () { offFocus(); offStore(); };
    },
  });
})();
