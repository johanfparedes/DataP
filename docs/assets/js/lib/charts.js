/* ==========================================================================
   DataP · gráficos SVG propios
   - Se dibujan al ancho real del contenedor y se redibujan al cambiar de tamaño.
   - Los colores salen de variables CSS, así que siguen al tema claro/oscuro.
   - Cada gráfico tiene tooltip al pasar el cursor; los valores también están
     disponibles en tablas, así que el tooltip nunca es la única vía.
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var observers = [];

  /* ------------------------------------------------------------------------
     Infraestructura
     ------------------------------------------------------------------------ */
  function disposeAll() {
    observers.forEach(function (o) { o.disconnect(); });
    observers = [];
  }

  function mount(el, draw) {
    el.classList.add('chart');
    var lastWidth = -1;
    var pending = false;
    function redraw() {
      pending = false;
      var w = Math.floor(el.clientWidth);
      if (!w || w === lastWidth) return;
      lastWidth = w;
      draw(w);
    }
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        if (!pending) { pending = true; requestAnimationFrame(redraw); }
      });
      ro.observe(el);
      observers.push(ro);
    }
    redraw();
  }

  var measureCtx = null;
  function textWidth(str, size) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    var family = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    measureCtx.font = size + 'px ' + family;
    return measureCtx.measureText(String(str)).width;
  }

  /** Recorta un texto con "…" para que quepa en maxW píxeles. */
  function fitText(str, size, maxW) {
    str = String(str);
    if (textWidth(str, size) <= maxW) return str;
    var lo = 0;
    var hi = str.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (textWidth(str.slice(0, mid) + '…', size) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return str.slice(0, Math.max(1, lo)) + '…';
  }

  function maxTextWidth(list, size) {
    return list.reduce(function (m, s) { return Math.max(m, textWidth(s, size)); }, 0);
  }

  function niceStep(range, count) {
    var raw = range / Math.max(1, count);
    if (!(raw > 0)) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return step * mag;
  }

  function ticks(min, max, count) {
    var step = niceStep(max - min, count);
    var out = [];
    var start = Math.ceil(min / step - 1e-9) * step;
    for (var v = start; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  function niceDomain(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    var step = niceStep(max - min, count);
    return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
  }

  function decimalsFor(step) {
    if (step >= 1) return 0;
    return Math.min(4, Math.ceil(-Math.log10(step)));
  }

  function makeTip(el) {
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    tip.setAttribute('aria-hidden', 'true');
    el.appendChild(tip);

    return {
      show: function (x, y, title, rows) {
        tip.textContent = '';
        if (title) {
          var t = document.createElement('div');
          t.className = 'tip-title';
          t.textContent = title;
          tip.appendChild(t);
        }
        rows.forEach(function (r) {
          var row = document.createElement('div');
          row.className = 'tip-row';
          if (r.key) {
            var k = document.createElement('span');
            k.className = 'tip-key';
            k.style.background = r.key;
            if (r.keyShape === 'dot') { k.style.width = '8px'; k.style.height = '8px'; k.style.borderRadius = '50%'; }
            row.appendChild(k);
          }
          var v = document.createElement('span');
          v.className = 'tip-value';
          v.textContent = r.value;
          row.appendChild(v);
          if (r.label) {
            var l = document.createElement('span');
            l.className = 'tip-label';
            l.textContent = r.label;
            row.appendChild(l);
          }
          tip.appendChild(row);
        });
        tip.hidden = false;
        var W = el.clientWidth;
        var tw = tip.offsetWidth;
        var th = tip.offsetHeight;
        var left = x + 14;
        if (left + tw > W) left = x - tw - 14;
        if (left < 0) left = Math.max(0, Math.min(W - tw, x - tw / 2));
        var top = y - th - 12;
        if (top < 0) top = y + 18;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
      },
      hide: function () { tip.hidden = true; },
    };
  }

  function localPoint(el, evt) {
    var r = el.getBoundingClientRect();
    return { x: evt.clientX - r.left, y: evt.clientY - r.top };
  }

  function centerOf(el, node) {
    var r = el.getBoundingClientRect();
    var b = node.getBoundingClientRect();
    return { x: b.left - r.left + b.width / 2, y: b.top - r.top + Math.min(b.height / 2, 24) };
  }

  /** Columna con extremo de datos redondeado (4px) y base recta. */
  function columnPath(x, w, yBase, yTop) {
    var h = yBase - yTop;
    if (h <= 0) return '';
    var r = Math.min(4, w / 2, h);
    return 'M' + x + ',' + yBase + 'V' + (yTop + r) + 'Q' + x + ',' + yTop + ' ' + (x + r) + ',' + yTop +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + yTop + ' ' + (x + w) + ',' + (yTop + r) + 'V' + yBase + 'Z';
  }

  /** Barra horizontal desde x0 (base) hasta x1, redondeada en el extremo de datos. */
  function hbarPath(x0, x1, y, h) {
    var len = Math.abs(x1 - x0);
    if (len < 0.5) return '';
    var r = Math.min(4, h / 2, len);
    var dir = x1 >= x0 ? 1 : -1;
    var xr = x1 - dir * r;
    return 'M' + x0 + ',' + y + 'H' + xr + 'Q' + x1 + ',' + y + ' ' + x1 + ',' + (y + r) +
      'V' + (y + h - r) + 'Q' + x1 + ',' + (y + h) + ' ' + xr + ',' + (y + h) + 'H' + x0 + 'Z';
  }

  /** Leyenda HTML. items: {shape:'rect'|'line'|'dot'|'ref', cls:'bg-s1', label} */
  function legend(items) {
    return '<div class="chart-legend">' + items.map(function (it) {
      var key = it.shape === 'line' ? 'key-line' : it.shape === 'dot' ? 'key-dot' : it.shape === 'ref' ? 'key-ref' : 'key-rect';
      return '<span class="legend-item"><span class="' + key + ' ' + (it.cls || '') + '"></span>' + esc(it.label) + '</span>';
    }).join('') + '</div>';
  }

  function gradientLegend(minLabel, maxLabel) {
    return '<div class="gradient-legend"><span>' + esc(minLabel) + '</span><span class="gradient-bar"></span><span>' + esc(maxLabel) + '</span></div>';
  }

  /* ------------------------------------------------------------------------
     Mapa de calor (matriz de correlación)
     ------------------------------------------------------------------------ */
  function heatmap(el, spec) {
    var labels = spec.labels;
    var M = spec.matrix;
    var p = labels.length;
    var fmtV = spec.format || function (v) { return U.fmt(v, 2); };

    function cellColor(v) {
      var pct = Math.round(Math.min(1, Math.abs(v)) * 100);
      var pole = v >= 0 ? 'var(--div-pos)' : 'var(--div-neg)';
      return 'color-mix(in oklab, ' + pole + ' ' + pct + '%, var(--div-mid))';
    }

    mount(el, function (W) {
      var labelW = Math.ceil(maxTextWidth(labels, 12)) + 12;
      if (W < 480) labelW = Math.min(labelW, Math.floor(W * 0.42));
      var cell = Math.floor(Math.min(60, (W - labelW - 4) / p));
      cell = Math.max(cell, 14);
      var showValues = cell >= 36;
      var colLabelW = maxTextWidth(labels, 11);
      var bottom = Math.ceil(colLabelW * Math.SQRT1_2) + 18;
      var gridW = cell * p;
      var width = labelW + gridW + 4;
      var height = gridW + bottom;

      var s = '<svg width="' + width + '" height="' + height + '" role="img" aria-label="' +
        esc(spec.ariaLabel || 'Matriz de correlación') + '">';
      for (var i = 0; i < p; i++) {
        var rowLabel = labels[i];
        s += '<text class="cat-label" x="' + (labelW - 8) + '" y="' + (i * cell + cell / 2) +
          '" dy="0.35em" text-anchor="end">' + esc(fitText(rowLabel, 12, labelW - 10)) + '</text>';
        for (var j = 0; j < p; j++) {
          var v = M[i][j];
          var x = labelW + j * cell;
          var y = i * cell;
          s += '<rect class="hm-cell" data-i="' + i + '" data-j="' + j + '" x="' + x + '" y="' + y +
            '" width="' + cell + '" height="' + cell + '" rx="3" style="fill:' + cellColor(v) + '"/>';
          if (showValues) {
            s += '<text class="hm-text ' + (Math.abs(v) >= 0.5 ? 'strong' : 'weak') + '" x="' + (x + cell / 2) +
              '" y="' + (y + cell / 2) + '" dy="0.35em" text-anchor="middle">' + esc(fmtV(v)) + '</text>';
          }
        }
      }
      for (var c = 0; c < p; c++) {
        var cx = labelW + c * cell + cell / 2;
        var cy = gridW + 12;
        s += '<text class="cat-label" style="font-size:11px" x="' + cx + '" y="' + cy +
          '" text-anchor="end" transform="rotate(-45 ' + cx + ' ' + cy + ')">' + esc(labels[c]) + '</text>';
      }
      s += '</svg>';
      el.innerHTML = s;

      var tip = makeTip(el);
      var svg = el.querySelector('svg');
      var active = null;
      svg.addEventListener('pointermove', function (e) {
        var t = e.target.closest ? e.target.closest('[data-i]') : null;
        if (!t) { clear(); return; }
        if (active !== t) {
          if (active) active.classList.remove('is-on');
          active = t;
          t.classList.add('is-on');
        }
        var ii = +t.getAttribute('data-i');
        var jj = +t.getAttribute('data-j');
        var pt = localPoint(el, e);
        tip.show(pt.x, pt.y, labels[ii] + ' × ' + labels[jj], [{ value: fmtV(M[ii][jj]), label: 'correlación' }]);
      });
      function clear() {
        if (active) active.classList.remove('is-on');
        active = null;
        tip.hide();
      }
      svg.addEventListener('pointerleave', clear);
    });
  }

  /* ------------------------------------------------------------------------
     Gráfico de sedimentación (scree): columnas + línea acumulada
     ------------------------------------------------------------------------ */
  function scree(el, spec) {
    var labels = spec.labels;
    var ind = spec.individual;
    var cum = spec.cumulative;
    var eig = spec.eigenvalues || null;
    var threshold = spec.threshold == null ? 80 : spec.threshold;
    var k = labels.length;

    mount(el, function (W) {
      var endLabel = U.pct(cum[k - 1]);
      var m = { top: 14, right: Math.ceil(textWidth(endLabel, 11.5)) + 16, bottom: 30, left: 44 };
      var H = Math.max(240, Math.min(320, Math.round(W * 0.45)));
      var pw = W - m.left - m.right;
      var ph = H - m.top - m.bottom;
      var y = function (v) { return m.top + ph - (v / 100) * ph; };
      var band = pw / k;
      var colW = Math.max(6, Math.min(24, band * 0.55));
      var cx = function (i) { return m.left + band * i + band / 2; };
      var every = Math.max(1, Math.ceil(36 / band));

      var s = '<svg width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.ariaLabel || 'Varianza explicada por componente') + '">';
      [0, 25, 50, 75, 100].forEach(function (t) {
        s += '<line class="' + (t === 0 ? 'baseline' : 'gridline') + '" x1="' + m.left + '" x2="' + (m.left + pw) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>';
        s += '<g class="tick"><text x="' + (m.left - 8) + '" y="' + y(t) + '" dy="0.35em" text-anchor="end">' + t + '%</text></g>';
      });
      for (var i = 0; i < k; i++) {
        s += '<rect class="band-hl" data-band="' + i + '" x="' + (m.left + band * i) + '" y="' + m.top + '" width="' + band + '" height="' + ph + '"/>';
      }
      for (var i2 = 0; i2 < k; i2++) {
        s += '<path class="fill-s1 mark" d="' + columnPath(cx(i2) - colW / 2, colW, y(0), y(Math.max(0, ind[i2]))) + '"/>';
        if (i2 % every === 0) {
          s += '<g class="tick"><text x="' + cx(i2) + '" y="' + (y(0) + 18) + '" text-anchor="middle">' + esc(labels[i2]) + '</text></g>';
        }
      }
      // Umbral
      var yt = y(threshold);
      s += '<line class="refline" x1="' + m.left + '" x2="' + (m.left + pw) + '" y1="' + yt + '" y2="' + yt + '"/>';
      s += '<text class="ref-label" x="' + (m.left + pw - 4) + '" y="' + (yt + 15) + '" text-anchor="end">Umbral ' + threshold + '%</text>';
      // Línea acumulada
      var pts = cum.map(function (v, j) { return cx(j) + ',' + y(v); }).join(' ');
      s += '<polyline class="stroke-s2" points="' + pts + '" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      cum.forEach(function (v, j) {
        s += '<circle class="fill-s2 dot" cx="' + cx(j) + '" cy="' + y(v) + '" r="4"/>';
      });
      s += '<text class="value-label" x="' + (cx(k - 1) + 10) + '" y="' + y(cum[k - 1]) + '" dy="0.35em">' + esc(endLabel) + '</text>';
      // Zonas de interacción
      for (var h = 0; h < k; h++) {
        s += '<rect class="hit" tabindex="0" data-k="' + h + '" x="' + (m.left + band * h) + '" y="' + m.top + '" width="' + band + '" height="' + (ph + m.bottom) + '" aria-label="' +
          esc(labels[h] + ': ' + U.pct(ind[h], 2) + ' individual, ' + U.pct(cum[h], 2) + ' acumulada') + '"/>';
      }
      s += '</svg>';
      el.innerHTML = s;

      var tip = makeTip(el);
      var svg = el.querySelector('svg');
      var bands = svg.querySelectorAll('.band-hl');
      function show(kk, pt) {
        for (var b = 0; b < bands.length; b++) bands[b].classList.toggle('is-on', b === kk);
        var rows = [
          { key: 'var(--series-1)', value: U.pct(ind[kk], 2), label: 'individual' },
          { key: 'var(--series-2)', value: U.pct(cum[kk], 2), label: 'acumulada' },
        ];
        if (eig) rows.push({ value: U.fmt(eig[kk], 2), label: 'autovalor' });
        tip.show(pt.x, pt.y, labels[kk], rows);
      }
      function hide() {
        for (var b = 0; b < bands.length; b++) bands[b].classList.remove('is-on');
        tip.hide();
      }
      svg.querySelectorAll('.hit').forEach(function (node) {
        var kk = +node.getAttribute('data-k');
        node.addEventListener('pointermove', function (e) { show(kk, localPoint(el, e)); });
        node.addEventListener('focus', function () { show(kk, { x: cx(kk), y: y(Math.max(ind[kk], cum[kk])) }); });
        node.addEventListener('blur', hide);
      });
      svg.addEventListener('pointerleave', hide);
    });
  }

  /* ------------------------------------------------------------------------
     Barras horizontales divergentes (cargas factoriales)
     ------------------------------------------------------------------------ */
  function hbars(el, spec) {
    var labels = spec.labels;
    var values = spec.values;
    var n = labels.length;
    var d = spec.domain || Math.max.apply(null, values.map(Math.abs)) * 1.3;
    var fmtV = spec.format || function (v) { return U.fmt(v, 2); };

    mount(el, function (W) {
      var labelW = Math.ceil(maxTextWidth(labels, 12)) + 14;
      labelW = Math.min(labelW, Math.floor(W * 0.45));
      var valW = Math.ceil(textWidth('−0.00', 11.5)) + 8;
      var m = { top: spec.sideLabels ? 22 : 6, right: valW, bottom: 24, left: labelW + valW };
      var rowH = 30;
      var barH = 16;
      var H = m.top + rowH * n + m.bottom;
      var pw = Math.max(60, W - m.left - m.right);
      var x = function (v) { return m.left + ((v + d) / (2 * d)) * pw; };
      var x0 = x(0);
      var tickVals = ticks(-d, d, 4);
      var dec = decimalsFor(niceStep(2 * d, 4));

      var s = '<svg width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.ariaLabel || 'Gráfico de barras') + '">';
      tickVals.forEach(function (t) {
        if (Math.abs(t) < 1e-12) return;
        s += '<line class="gridline" x1="' + x(t) + '" x2="' + x(t) + '" y1="' + m.top + '" y2="' + (m.top + rowH * n) + '"/>';
      });
      tickVals.forEach(function (t) {
        s += '<g class="tick"><text x="' + x(t) + '" y="' + (m.top + rowH * n + 16) + '" text-anchor="middle">' + esc(U.fmt(t, dec)) + '</text></g>';
      });
      if (spec.sideLabels) {
        s += '<text class="side-label" x="' + m.left + '" y="12">' + esc(spec.sideLabels[0]) + '</text>';
        s += '<text class="side-label" x="' + (m.left + pw) + '" y="12" text-anchor="end">' + esc(spec.sideLabels[1]) + '</text>';
      }
      for (var i = 0; i < n; i++) {
        var v = values[i];
        var yRow = m.top + rowH * i;
        var yb = yRow + (rowH - barH) / 2;
        var xv = x(v);
        s += '<rect class="band-hl" data-band="' + i + '" x="0" y="' + yRow + '" width="' + W + '" height="' + rowH + '"/>';
        s += '<text class="cat-label" x="' + (labelW - 10) + '" y="' + (yRow + rowH / 2) + '" dy="0.35em" text-anchor="end">' + esc(fitText(labels[i], 12, labelW - 14)) + '</text>';
        s += '<path class="fill-s1 mark" d="' + hbarPath(x0, xv, yb, barH) + '"/>';
        var pos = v >= 0;
        s += '<text class="value-label" x="' + (xv + (pos ? 6 : -6)) + '" y="' + (yRow + rowH / 2) + '" dy="0.35em" text-anchor="' + (pos ? 'start' : 'end') + '">' + esc(fmtV(v)) + '</text>';
        s += '<rect class="hit" tabindex="0" data-k="' + i + '" x="0" y="' + yRow + '" width="' + W + '" height="' + rowH + '" aria-label="' + esc(labels[i] + ': ' + fmtV(v)) + '"/>';
      }
      s += '<line class="baseline" x1="' + x0 + '" x2="' + x0 + '" y1="' + (m.top - 2) + '" y2="' + (m.top + rowH * n) + '"/>';
      s += '</svg>';
      el.innerHTML = s;

      var tip = makeTip(el);
      var svg = el.querySelector('svg');
      var bands = svg.querySelectorAll('.band-hl');
      function show(kk, pt) {
        for (var b = 0; b < bands.length; b++) bands[b].classList.toggle('is-on', b === kk);
        tip.show(pt.x, pt.y, labels[kk], [{ key: 'var(--series-1)', value: fmtV(values[kk]), label: spec.valueLabel || 'carga' }]);
      }
      function hide() {
        for (var b = 0; b < bands.length; b++) bands[b].classList.remove('is-on');
        tip.hide();
      }
      svg.querySelectorAll('.hit').forEach(function (node) {
        var kk = +node.getAttribute('data-k');
        node.addEventListener('pointermove', function (e) { show(kk, localPoint(el, e)); });
        node.addEventListener('focus', function () { show(kk, { x: x(values[kk]), y: m.top + rowH * kk + rowH / 2 }); });
        node.addEventListener('blur', hide);
      });
      svg.addEventListener('pointerleave', hide);
    });
  }

  /* ------------------------------------------------------------------------
     Dispersión (mapa de segmentación CP1 × CP2)
     ------------------------------------------------------------------------ */
  function scatter(el, spec) {
    var pts = spec.points;           // {x, y, id, group}
    var groups = spec.groups;        // {id, label, cls:'fill-s1', color:'var(--series-1)'}
    var labelSet = {};
    (spec.labelIds || []).forEach(function (id) { labelSet[String(id)] = true; });
    var groupById = {};
    groups.forEach(function (g) { groupById[g.id] = g; });

    mount(el, function (W) {
      var H = Math.max(300, Math.min(480, Math.round(W * 0.6)));
      var m = { top: 12, right: 18, bottom: 46, left: 54 };
      var pw = W - m.left - m.right;
      var ph = H - m.top - m.bottom;
      var xs = pts.map(function (p) { return p.x; });
      var ys = pts.map(function (p) { return p.y; });
      var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
      var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
      var padX = (xMax - xMin || 1) * 0.06;
      var padY = (yMax - yMin || 1) * 0.08;
      var xd = niceDomain(xMin - padX, xMax + padX, 6);
      var yd = niceDomain(yMin - padY, yMax + padY, 5);
      var x = function (v) { return m.left + ((v - xd[0]) / (xd[1] - xd[0])) * pw; };
      var y = function (v) { return m.top + ph - ((v - yd[0]) / (yd[1] - yd[0])) * ph; };
      var xt = ticks(xd[0], xd[1], Math.max(3, Math.floor(pw / 90)));
      var yt = ticks(yd[0], yd[1], 5);
      var xdec = decimalsFor(xt.length > 1 ? xt[1] - xt[0] : 1);
      var ydec = decimalsFor(yt.length > 1 ? yt[1] - yt[0] : 1);

      var s = '<svg width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(spec.ariaLabel || 'Gráfico de dispersión') + '">';
      xt.forEach(function (t) {
        s += '<line class="gridline" x1="' + x(t) + '" x2="' + x(t) + '" y1="' + m.top + '" y2="' + (m.top + ph) + '"/>';
        s += '<g class="tick"><text x="' + x(t) + '" y="' + (m.top + ph + 16) + '" text-anchor="middle">' + esc(U.fmt(t, xdec)) + '</text></g>';
      });
      yt.forEach(function (t) {
        s += '<line class="gridline" x1="' + m.left + '" x2="' + (m.left + pw) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>';
        s += '<g class="tick"><text x="' + (m.left - 8) + '" y="' + y(t) + '" dy="0.35em" text-anchor="end">' + esc(U.fmt(t, ydec)) + '</text></g>';
      });
      if (xd[0] < 0 && xd[1] > 0) s += '<line class="baseline" x1="' + x(0) + '" x2="' + x(0) + '" y1="' + m.top + '" y2="' + (m.top + ph) + '"/>';
      if (yd[0] < 0 && yd[1] > 0) s += '<line class="baseline" x1="' + m.left + '" x2="' + (m.left + pw) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';

      s += '<text class="axis-title" x="' + (m.left + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(spec.xTitle || 'CP1') + '</text>';
      s += '<text class="axis-title" transform="rotate(-90)" x="' + -(m.top + ph / 2) + '" y="14" text-anchor="middle">' + esc(spec.yTitle || 'CP2') + '</text>';

      pts.forEach(function (p, i) {
        var g = groupById[p.group] || groups[0];
        s += '<circle class="dot mark ' + g.cls + '" data-idx="' + i + '" cx="' + x(p.x) + '" cy="' + y(p.y) + '" r="5"/>';
      });
      pts.forEach(function (p) {
        if (!labelSet[String(p.id)]) return;
        var px = x(p.x);
        var right = px < m.left + pw - 40;
        s += '<text class="point-label" x="' + (px + (right ? 8 : -8)) + '" y="' + (y(p.y) - 8) + '" text-anchor="' + (right ? 'start' : 'end') + '">' + esc(p.id) + '</text>';
      });
      s += '<rect class="hit" x="' + m.left + '" y="' + m.top + '" width="' + pw + '" height="' + ph + '"/>';
      s += '</svg>';
      el.innerHTML = s;

      var tip = makeTip(el);
      var svg = el.querySelector('svg');
      var hit = svg.querySelector('.hit');
      var dots = svg.querySelectorAll('circle.dot');
      var active = -1;
      function setActive(idx) {
        if (active === idx) return;
        if (active >= 0) { dots[active].classList.remove('is-on'); dots[active].setAttribute('r', 5); }
        active = idx;
        if (idx >= 0) {
          dots[idx].classList.add('is-on');
          dots[idx].setAttribute('r', 7);
          dots[idx].parentNode.insertBefore(dots[idx], hit);
        }
      }
      hit.addEventListener('pointermove', function (e) {
        var pt = localPoint(el, e);
        var best = -1;
        var bestD = 28 * 28;
        pts.forEach(function (p, i) {
          var dx = x(p.x) - pt.x;
          var dy = y(p.y) - pt.y;
          var dd = dx * dx + dy * dy;
          if (dd < bestD) { bestD = dd; best = i; }
        });
        setActive(best);
        if (best < 0) { tip.hide(); return; }
        var p = pts[best];
        var g = groupById[p.group] || groups[0];
        tip.show(x(p.x), y(p.y), (spec.idLabel || 'ID') + ' ' + p.id, [
          { value: U.fmt(p.x, 2), label: spec.xShort || 'CP1' },
          { value: U.fmt(p.y, 2), label: spec.yShort || 'CP2' },
          { key: g.color, keyShape: 'dot', value: g.label },
        ]);
      });
      hit.addEventListener('pointerleave', function () { setActive(-1); tip.hide(); });
    });
  }

  DataP.lib.charts = {
    heatmap: heatmap,
    scree: scree,
    hbars: hbars,
    scatter: scatter,
    legend: legend,
    gradientLegend: gradientLegend,
    disposeAll: disposeAll,
  };
})();
