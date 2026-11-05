/* ==========================================================================
   Módulo: Hábitos
   Marca cada día lo que quieres repetir. Rachas, cumplimiento de 30 días y
   un mapa de los últimos meses por hábito.
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;

  var DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  var DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
  var SUGGESTIONS = ['Beber 2 litros de agua', 'Leer 20 minutos', 'Meditar 10 minutos', 'Hacer ejercicio', 'Revisar mis gastos', 'Dormir antes de las 23:00'];
  var WEEKS = 26;

  var dtTip = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
  var dtMonth = new Intl.DateTimeFormat('es', { month: 'short' });

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function scheduleText(days) {
    var d = days.slice().sort();
    if (d.length === 7) return 'Todos los días';
    if (d.join() === '1,2,3,4,5') return 'De lunes a viernes';
    if (d.join() === '0,6') return 'Fines de semana';
    return WEEK_ORDER.filter(function (x) { return d.indexOf(x) >= 0; }).map(function (x) { return DAY_NAMES[x].slice(0, 3); }).join(', ');
  }

  function habitDialog(id, defaults) {
    var S = DataP.store;
    var UI = DataP.ui;
    var h = id ? S.habit(id) : null;
    var d = Object.assign({ name: '', days: [0, 1, 2, 3, 4, 5, 6], color: 0 }, defaults || {}, h || {});
    if (!d.color) {
      var used = S.habits().map(function (x) { return x.color; });
      d.color = (S.COLORS.filter(function (c) { return used.indexOf(c.id) < 0; })[0] || S.COLORS[0]).id;
    }
    var dayBoxes = WEEK_ORDER.map(function (wd) {
      return '<label class="day-box"><input type="checkbox" name="day" value="' + wd + '"' + (d.days.indexOf(wd) >= 0 ? ' checked' : '') + ' aria-label="' + DAY_NAMES[wd] + '"><span>' + DAY_LETTERS[wd] + '</span></label>';
    }).join('');
    var swatches = S.COLORS.map(function (c) {
      return '<label class="swatch pc-' + c.id + '"><input type="radio" name="color" value="' + c.id + '"' + (c.id === d.color ? ' checked' : '') + ' aria-label="' + esc(c.label) + '"><span></span></label>';
    }).join('');
    var actions = [];
    if (h) actions.push({ value: 'delete', label: 'Eliminar', kind: 'ghost', align: 'start', icon: 'trash' });
    actions.push({ value: 'cancel', label: 'Cancelar' });
    actions.push({ value: 'save', label: h ? 'Guardar' : 'Crear hábito', kind: 'primary' });

    UI.dialog({
      title: h ? 'Editar hábito' : 'Nuevo hábito',
      body:
        '<label class="fld"><span class="fld-label">¿Qué quieres repetir?</span><input class="input" name="name" required maxlength="120" autocomplete="off" value="' + esc(d.name) + '" placeholder="Ej.: Leer 20 minutos" autofocus></label>' +
        '<fieldset class="fld"><legend class="fld-label">¿Qué días?</legend><div class="day-boxes">' + dayBoxes + '</div>' +
          '<div class="day-presets"><button type="button" class="btn btn-ghost btn-sm" data-preset="0,1,2,3,4,5,6">Todos</button><button type="button" class="btn btn-ghost btn-sm" data-preset="1,2,3,4,5">Lunes a viernes</button><button type="button" class="btn btn-ghost btn-sm" data-preset="0,6">Fin de semana</button></div></fieldset>' +
        '<fieldset class="fld"><legend class="fld-label">Color</legend><div class="swatches">' + swatches + '</div></fieldset>',
      actions: actions,
      onAction: function (value, form) {
        if (value === 'delete') {
          var r = S.removeHabit(h.id);
          UI.toast('Hábito eliminado', { action: { label: 'Deshacer', run: r.undo } });
          return;
        }
        var days = Array.prototype.filter.call(form.querySelectorAll('input[name="day"]'), function (c) { return c.checked; }).map(function (c) { return +c.value; });
        var data = {
          name: form.name.value.trim(),
          days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
          color: +((form.querySelector('input[name="color"]:checked') || {}).value || d.color),
        };
        if (!data.name) { form.name.focus(); return false; }
        if (h) { S.updateHabit(h.id, data); UI.toast('Hábito guardado'); }
        else { S.addHabit(data); UI.toast('Hábito creado'); }
      },
    }).addEventListener('click', function (e) {
      var b = e.target.closest('[data-preset]');
      if (!b) return;
      var set = b.getAttribute('data-preset').split(',').map(Number);
      b.closest('form').querySelectorAll('input[name="day"]').forEach(function (c) { c.checked = set.indexOf(+c.value) >= 0; });
    });
  }

  /** Tira de los últimos 7 días: botones para marcar o corregir un día. */
  function weekStrip(h) {
    var S = DataP.store;
    var out = '';
    for (var i = 6; i >= 0; i--) {
      var day = S.dayStr(-i);
      var dt = DataP.ui.parseDay(day);
      var due = S.habitDue(h, day);
      var done = !!h.log[day];
      var name = dtTip.format(dt);
      out += '<button type="button" class="hday' + (done ? ' is-done' : '') + (due ? '' : ' is-off') + (i === 0 ? ' is-today' : '') + '" data-habit-day="' + day + '" aria-pressed="' + done + '" ' +
        'aria-label="' + esc(name + ': ' + (done ? 'cumplido' : due ? 'pendiente' : 'no toca')) + '" title="' + esc(name) + '">' +
        '<span class="hday-l">' + DAY_LETTERS[dt.getDay()] + '</span><span class="hday-n">' + (done ? icon('check') : dt.getDate()) + '</span></button>';
    }
    return out;
  }

  /** Mapa de cuadros: columnas = semanas (lunes arriba), color del hábito = cumplido. */
  function heatmapSvg(h) {
    var S = DataP.store;
    var UI = DataP.ui;
    var cell = 11;
    var gap = 2;
    var top = 14;
    var today = UI.parseDay(S.dayStr(0));
    var dow = (today.getDay() + 6) % 7; // 0 = lunes
    var start = new Date(today);
    start.setDate(start.getDate() - dow - (WEEKS - 1) * 7);
    var created = String(h.createdAt || '').slice(0, 10);
    var rects = '';
    var labels = '';
    var lastMonth = -1;
    for (var w = 0; w < WEEKS; w++) {
      for (var r = 0; r < 7; r++) {
        var dt = new Date(start);
        dt.setDate(start.getDate() + w * 7 + r);
        if (dt > today) continue;
        var key = S.toDayStr(dt);
        var due = S.habitDue(h, key);
        var done = !!h.log[key];
        var before = key < created && !done;
        var cls = done ? 'hm-done' : before ? 'hm-before' : due ? 'hm-miss' : 'hm-off';
        rects += '<rect class="' + cls + '" x="' + (w * (cell + gap)) + '" y="' + (top + r * (cell + gap)) + '" width="' + cell + '" height="' + cell + '" rx="2.5" data-day="' + key + '"></rect>';
        if (r === 0 && dt.getMonth() !== lastMonth && dt.getDate() <= 7) {
          labels += '<text x="' + (w * (cell + gap)) + '" y="9" class="hm-month">' + esc(dtMonth.format(dt).replace('.', '')) + '</text>';
          lastMonth = dt.getMonth();
        }
      }
    }
    var W = WEEKS * (cell + gap) - gap;
    var H = top + 7 * (cell + gap) - gap;
    return '<svg class="hm-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Últimas ' + WEEKS + ' semanas de ' + esc(h.name) + '">' + labels + rects + '</svg>';
  }

  DataP.registerModule({
    id: 'habitos',
    title: 'Hábitos',
    section: 'General',
    icon: 'flame',
    order: 25,
    summary: 'Marca cada día lo que quieres repetir y mira tus rachas.',
    keywords: 'habitos rutina racha diario seguimiento',
    badge: function () {
      var S = DataP.store;
      var n = S.habits().filter(function (h) { var st = S.habitStats(h.id); return st.dueToday && !st.doneToday; }).length;
      return n || null;
    },

    render: function (root) {
      var S = DataP.store;
      var UI = DataP.ui;
      var C = DataP.lib.charts;
      var tip = null;

      function draw() {
        var focusKey = document.activeElement && root.contains(document.activeElement) ? document.activeElement.getAttribute('data-habit-day') : null;
        var focusHabit = focusKey ? document.activeElement.closest('[data-habit]').getAttribute('data-habit') : null;
        var list = S.habits();
        var dueToday = list.filter(function (h) { return S.habitStats(h.id).dueToday; });
        var doneToday = dueToday.filter(function (h) { return S.habitStats(h.id).doneToday; });

        var lede = list.length
          ? 'Hoy: ' + doneToday.length + ' de ' + plural(dueToday.length, 'hábito cumplido', 'hábitos cumplidos') + '. Marca el día en cuanto lo hagas; puedes corregir los últimos 7 días.'
          : 'Elige algo pequeño que quieras hacer a menudo. Lo importante es no romper la racha.';

        var cards = list.map(function (h) {
          var st = S.habitStats(h.id);
          return '<article class="card habit pc-' + h.color + '" data-habit="' + esc(h.id) + '">' +
            '<div class="habit-top">' +
              '<button type="button" class="habit-check' + (st.doneToday ? ' is-done' : '') + '" data-habit-day="' + S.dayStr(0) + '" aria-pressed="' + st.doneToday + '" aria-label="' + esc((st.doneToday ? 'Desmarcar hoy: ' : 'Marcar hoy: ') + h.name) + '">' + icon('check') + '</button>' +
              '<div class="habit-title"><h2 class="card-title">' + esc(h.name) + '</h2><span class="habit-sched">' + esc(scheduleText(h.days)) + (st.dueToday ? '' : ' · hoy no toca') + '</span></div>' +
              '<button type="button" class="icon-btn" data-edit-habit aria-label="Editar ' + esc(h.name) + '" title="Editar">' + icon('edit') + '</button>' +
            '</div>' +
            '<div class="habit-stats">' +
              '<div class="hstat"><span class="hstat-v">' + icon('flame') + st.streak + '</span><span class="hstat-l">' + (st.streak === 1 ? 'día de racha' : 'días de racha') + '</span></div>' +
              '<div class="hstat"><span class="hstat-v">' + st.best + '</span><span class="hstat-l">mejor racha</span></div>' +
              '<div class="hstat"><span class="hstat-v">' + (st.rate == null ? '—' : st.rate + '%') + '</span><span class="hstat-l">últimos 30 días</span></div>' +
            '</div>' +
            '<div class="habit-week" role="group" aria-label="Últimos 7 días">' + weekStrip(h) + '</div>' +
            '<div class="habit-map">' + heatmapSvg(h) + '</div>' +
          '</article>';
        }).join('');

        var suggestions = SUGGESTIONS.filter(function (s) { return !list.some(function (h) { return h.name.toLowerCase() === s.toLowerCase(); }); }).slice(0, 4);

        root.innerHTML =
          '<div class="page-top">' +
            '<header class="page-header"><h1>Hábitos</h1><p class="lede">' + esc(lede) + '</p></header>' +
            '<div class="header-actions"><button type="button" class="btn btn-primary" data-new-habit>' + icon('plus') + 'Nuevo hábito</button></div>' +
          '</div>' +
          (list.length
            ? '<div class="hm-legend" aria-hidden="true"><span><i class="hm-key hm-done pc-' + list[0].color + '"></i>Cumplido (color del hábito)</span><span><i class="hm-key hm-miss"></i>Tocaba y no se hizo</span><span><i class="hm-key hm-off"></i>No toca ese día</span></div>' +
              '<div class="habit-grid">' + cards + '</div>'
            : '<div class="card empty" style="padding:40px 16px">' + icon('flame') + '<strong>Aún no tienes hábitos</strong><span>Empieza con uno de estos o crea el tuyo.</span></div>') +
          (suggestions.length ? '<section class="section" style="margin-top:24px"><h2 class="card-title" style="margin-bottom:10px">Ideas para empezar</h2><div class="link-chips">' +
            suggestions.map(function (s) { return '<button type="button" class="link-chip" data-suggest="' + esc(s) + '">' + icon('plus') + esc(s) + '</button>'; }).join('') + '</div></section>' : '');

        if (focusKey && focusHabit) {
          var el = root.querySelector('[data-habit="' + focusHabit + '"] [data-habit-day="' + focusKey + '"]');
          if (el) el.focus();
        }

        // Tooltips del mapa.
        root.querySelectorAll('.habit-map').forEach(function (wrap) {
          var t = C.makeTip(wrap);
          var hId = wrap.closest('[data-habit]').getAttribute('data-habit');
          wrap.addEventListener('pointermove', function (e) {
            var r = e.target.closest && e.target.closest('rect[data-day]');
            if (!r) { t.hide(); return; }
            var hb = S.habit(hId);
            var key = r.getAttribute('data-day');
            var txt = hb.log[key] ? 'Cumplido' : r.classList.contains('hm-before') ? 'Antes de crear el hábito' : S.habitDue(hb, key) ? 'No se hizo' : 'No tocaba';
            var p = C.localPoint(wrap, e);
            t.show(p.x, p.y, dtTip.format(UI.parseDay(key)), [{ value: txt, key: hb.log[key] ? getComputedStyle(r).fill : null }]);
          });
          wrap.addEventListener('pointerleave', function () { t.hide(); });
        });
      }

      root.addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('[data-new-habit]')) { habitDialog(null); return; }
        var sug = t.closest('[data-suggest]');
        if (sug) { S.addHabit({ name: sug.getAttribute('data-suggest') }); UI.toast('Hábito creado'); return; }
        var card = t.closest('[data-habit]');
        if (!card) return;
        var id = card.getAttribute('data-habit');
        if (t.closest('[data-edit-habit]')) { habitDialog(id); return; }
        var dayBtn = t.closest('[data-habit-day]');
        if (dayBtn) {
          var day = dayBtn.getAttribute('data-habit-day');
          var on = S.toggleHabit(id, day);
          if (day === S.dayStr(0) && on) {
            var st = S.habitStats(id);
            UI.toast(st.streak > 1 ? '¡' + st.streak + ' días seguidos!' : 'Hábito cumplido hoy');
          }
        }
      });

      draw();
      return S.subscribe(function (ch) { if (!ch.kind || ch.kind === 'habit' || ch.kind === 'all') draw(); });
    },
  });

  DataP.ui.habitDialog = habitDialog;
  DataP.ui.habitScheduleText = scheduleText;
})();
