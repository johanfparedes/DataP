/* ==========================================================================
   Módulo: Herramienta · Laboratorio PCA
   Carga un .xlsx o .csv y repite el flujo del notebook en el navegador:
   estandarización → correlación → PCA → cargas → mapa de segmentación.
   El estado se conserva mientras la pestaña esté abierta.
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;
  var fmt = U.fmt;
  var pct = U.pct;

  var ID_PATTERN = /^(id|codigo|código|cliente|id[_ ]?cliente|n[°º]?)$/i;
  var MAX_TABLE_ROWS = 500;

  var state = {
    fileName: null,
    isSample: false,
    sheets: null,
    sheetIdx: 0,
    table: null,
    idCol: -1,
    selected: null, // índices de columnas elegidas
    error: null,
  };

  /* ------------------------------------------------------------------------
     Datos de ejemplo (sintéticos, generados con semilla fija)
     ------------------------------------------------------------------------ */
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sampleRows() {
    var rand = mulberry32(20261103);
    function normal() {
      var u = 1 - rand();
      var v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi == null ? Infinity : hi, v)); }
    var rows = [['ID', 'Edad', 'Ingreso_Mensual', 'Frecuencia_Compra', 'Monto_Promedio', 'Prod_Diferentes', 'Uso_Promociones_%', 'Visitas_Web', 'Antiguedad_Años']];
    for (var i = 1; i <= 50; i++) {
      var f = normal();
      rows.push([
        i,
        Math.round(clamp(38 + 8.5 * f + 2 * normal(), 18, 75)),
        Math.round(clamp(1050 + 320 * f + 60 * normal(), 400) / 10) * 10,
        Math.round(clamp(4.5 - 1.7 * f + 0.5 * normal(), 1)),
        Math.round(clamp(110 + 50 * f + 12 * normal(), 20)),
        Math.round(clamp(6.5 - 2 * f + 0.6 * normal(), 1)),
        Math.round(clamp(40 - 18 * f + 4 * normal(), 0, 100)),
        Math.round(clamp(8.5 - 3.6 * f + 0.9 * normal(), 0)),
        Math.round(clamp(5.5 + 2.6 * f + 0.7 * normal(), 0)),
      ]);
    }
    return rows;
  }

  /* ------------------------------------------------------------------------
     CSV de salida
     ------------------------------------------------------------------------ */
  function csvCell(v) {
    if (typeof v === 'number') return isFinite(v) ? String(+v.toFixed(6)) : '';
    var s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s; // evita fórmulas al abrir en Excel
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(rows) {
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  /* ------------------------------------------------------------------------
     Carga y análisis
     ------------------------------------------------------------------------ */
  function loadSheets(fileName, sheets, isSample) {
    state.fileName = fileName;
    state.isSample = !!isSample;
    state.sheets = sheets;
    state.error = null;
    // Empieza por la primera hoja que tenga al menos 2 columnas numéricas.
    var start = 0;
    for (var i = 0; i < sheets.length; i++) {
      try {
        var t = DataP.lib.fileReader.toTable(sheets[i].rows);
        if (t.numeric.filter(Boolean).length >= 2) { start = i; break; }
      } catch (e) { /* hoja vacía: se prueba la siguiente */ }
    }
    selectSheet(start);
  }

  function selectSheet(idx) {
    state.sheetIdx = idx;
    state.table = DataP.lib.fileReader.toTable(state.sheets[idx].rows);
    var t = state.table;
    state.idCol = t.headers.findIndex(function (h) { return ID_PATTERN.test(h.trim()); });
    state.selected = [];
    t.headers.forEach(function (_, j) {
      if (t.numeric[j] && j !== state.idCol) state.selected.push(j);
    });
  }

  function analyze() {
    var t = state.table;
    var toNumber = DataP.lib.fileReader.toNumber;
    var cols = state.selected.slice().sort(function (a, b) { return a - b; });
    var notes = [];
    if (cols.length < 2) return { error: 'Elige al menos 2 variables numéricas para el análisis.' };

    var X = [];
    var ids = [];
    var rawRows = [];
    var dropped = 0;
    t.rows.forEach(function (row, i) {
      var vals = cols.map(function (j) { return toNumber(row[j]); });
      if (vals.some(function (v) { return isNaN(v); })) { dropped++; return; }
      X.push(vals);
      rawRows.push(row);
      var id = state.idCol >= 0 ? row[state.idCol] : i + 1;
      ids.push(id === '' || id == null ? 'Fila ' + (i + 2) : String(id));
    });
    if (dropped) notes.push('Se omitieron ' + dropped + (dropped === 1 ? ' fila' : ' filas') + ' con valores vacíos o no numéricos en las variables elegidas.');

    // Columnas constantes: no aportan varianza y romperían la correlación.
    var pcaLib = DataP.lib.pca;
    var keep = [];
    cols.forEach(function (j, k) {
      var col = X.map(function (r) { return r[k]; });
      if (col.length && pcaLib.stdPop(col) > 0) keep.push(k);
      else notes.push('“' + t.headers[j] + '” tiene el mismo valor en todas las filas y se excluyó.');
    });
    if (keep.length !== cols.length) {
      X = X.map(function (r) { return keep.map(function (k) { return r[k]; }); });
      cols = keep.map(function (k) { return cols[k]; });
    }
    if (cols.length < 2) return { error: 'Quedan menos de 2 variables con variación. Elige otras columnas.', notes: notes };
    if (X.length < 3) return { error: 'Hay menos de 3 filas con datos completos. Revisa el archivo.', notes: notes };
    if (X.length <= cols.length) notes.push('Hay pocas filas (' + X.length + ') para ' + cols.length + ' variables: los últimos componentes no serán fiables.');

    var res = pcaLib.run(X);
    res.cols = cols;
    res.names = cols.map(function (j) { return t.headers[j]; });
    res.labels = res.names.map(U.prettyLabel);
    res.ids = ids;
    res.X = X;
    res.notes = notes;
    return res;
  }

  /* ------------------------------------------------------------------------
     Interpretación automática
     ------------------------------------------------------------------------ */
  function sideLists(vec, labels) {
    var maxAbs = Math.max.apply(null, vec.map(Math.abs));
    var thr = maxAbs * 0.5;
    var idx = vec.map(function (_, i) { return i; }).sort(function (a, b) { return Math.abs(vec[b]) - Math.abs(vec[a]); });
    var pos = idx.filter(function (i) { return vec[i] >= thr; }).map(function (i) { return labels[i]; });
    var neg = idx.filter(function (i) { return vec[i] <= -thr; }).map(function (i) { return labels[i]; });
    return { pos: pos, neg: neg };
  }

  function joinList(list) {
    if (!list.length) return '';
    if (list.length === 1) return list[0];
    return list.slice(0, -1).join(', ') + ' y ' + list[list.length - 1];
  }

  function conclusions(res) {
    var items = [];
    var p = res.p;
    var two = res.cumulative[Math.min(1, res.cumulative.length - 1)];
    if (res.k80 === 1) {
      items.push('Un solo componente (CP1) basta para conservar el ' + pct(res.cumulative[0]) + ' de la información de las ' + p + ' variables.');
    } else {
      items.push('Se puede pasar de ' + p + ' variables a ' + res.k80 + ' componentes y conservar el ' + pct(res.cumulative[res.k80 - 1]) + ' de la información (criterio del 80%).');
    }
    items.push('CP1 y CP2 juntos explican el ' + pct(two) + ' de la varianza; ' + res.kaiser + (res.kaiser === 1 ? ' componente tiene' : ' componentes tienen') + ' autovalor mayor que 1 (criterio de Kaiser).');

    var s1 = sideLists(res.components[0], res.labels);
    var t1 = 'CP1: ';
    if (s1.pos.length) t1 += 'en el lado positivo pesan más ' + joinList(s1.pos);
    if (s1.pos.length && s1.neg.length) t1 += '; en el negativo, ' + joinList(s1.neg);
    else if (s1.neg.length) t1 += 'en el lado negativo pesan más ' + joinList(s1.neg);
    items.push(t1 + '.');

    if (res.components.length > 1) {
      var s2 = sideLists(res.components[1], res.labels);
      var t2 = 'CP2: ';
      if (s2.pos.length) t2 += 'en el lado positivo pesan más ' + joinList(s2.pos);
      if (s2.pos.length && s2.neg.length) t2 += '; en el negativo, ' + joinList(s2.neg);
      else if (s2.neg.length) t2 += 'en el lado negativo pesan más ' + joinList(s2.neg);
      items.push(t2 + '.');
    }

    var byCp1 = res.ids.map(function (id, i) { return { id: id, s: res.scores[i][0] }; })
      .sort(function (a, b) { return b.s - a.s; });
    var n = Math.min(3, Math.floor(byCp1.length / 2));
    if (n > 0) {
      items.push('Puntuación más alta en CP1: ' + byCp1.slice(0, n).map(function (o) { return o.id; }).join(', ') +
        '. Más baja: ' + byCp1.slice(-n).reverse().map(function (o) { return o.id; }).join(', ') + '.');
    }
    return items;
  }

  /* ------------------------------------------------------------------------
     Vista
     ------------------------------------------------------------------------ */
  function uploadHtml(compact) {
    return '<div class="dropzone' + (compact ? '" style="padding:20px' : '') + '" id="dropzone">' +
      (compact ? '' : icon('upload') +
        '<div class="dropzone-title">Arrastra aquí tu archivo .xlsx o .csv</div>' +
        '<div class="dropzone-sub">La primera fila debe tener los nombres de las columnas. Si hay una columna <code>ID</code>, se usa para etiquetar cada fila.</div>') +
      '<div class="dropzone-actions" ' + (compact ? 'style="margin-top:0"' : '') + '>' +
        '<button type="button" class="btn btn-primary" data-action="choose">' + icon('upload') + (compact ? 'Cambiar archivo' : 'Elegir archivo') + '</button>' +
        '<button type="button" class="btn" data-action="sample">' + icon('table') + 'Usar datos de ejemplo</button>' +
        '<button type="button" class="btn btn-ghost" data-action="template">' + icon('download') + 'Descargar ejemplo CSV</button>' +
      '</div>' +
      '<input type="file" id="file-input" accept=".xlsx,.xlsm,.csv,.tsv,.txt" hidden>' +
    '</div>';
  }

  function configHtml() {
    var t = state.table;
    var sheetSel = '';
    if (state.sheets.length > 1) {
      sheetSel = '<label class="field"><span class="field-label">Hoja</span><select class="select" id="sel-sheet">' +
        state.sheets.map(function (s, i) { return '<option value="' + i + '"' + (i === state.sheetIdx ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') +
        '</select></label>';
    }
    var idSel = '<label class="field"><span class="field-label">Columna de identificación</span><select class="select" id="sel-id">' +
      '<option value="-1">Ninguna (usar número de fila)</option>' +
      t.headers.map(function (h, j) { return '<option value="' + j + '"' + (j === state.idCol ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join('') +
      '</select></label>';
    var numericCols = t.headers.map(function (h, j) { return j; }).filter(function (j) { return t.numeric[j] && j !== state.idCol; });
    var nonNumeric = t.headers.filter(function (h, j) { return !t.numeric[j] && j !== state.idCol; });
    var vars = '<div class="field" style="flex:1 1 100%"><span class="field-label">Variables del análisis</span><div class="var-list" id="var-list">' +
      numericCols.map(function (j) {
        return '<label class="var-toggle"><input type="checkbox" value="' + j + '"' + (state.selected.indexOf(j) >= 0 ? ' checked' : '') + '>' + esc(t.headers[j]) + '</label>';
      }).join('') + '</div>' +
      (nonNumeric.length ? '<span class="stat-note">Columnas no numéricas (no se usan): ' + nonNumeric.map(esc).join(', ') + '</span>' : '') +
      '</div>';

    return '<div class="card">' +
      '<div class="file-summary"><span class="file-name">' + esc(state.fileName) + '</span>' +
        '<span class="chip">' + t.rows.length + ' filas</span><span class="chip">' + t.headers.length + ' columnas</span>' +
        (state.isSample ? '<span class="chip">Datos sintéticos</span>' : '') + '</div>' +
      (state.isSample ? '<p class="card-sub">Datos inventados con la misma estructura que <code>Data.xlsx</code>, solo para probar la herramienta. No son los datos reales del notebook.</p>' : '') +
      '<div class="controls" style="margin-top:16px">' + sheetSel + idSel + vars + '</div>' +
    '</div>';
  }

  function stat(label, value, note) {
    return '<div class="card stat"><span class="stat-label">' + esc(label) + '</span><span class="stat-value">' + esc(value) + '</span>' +
      (note ? '<span class="stat-note">' + esc(note) + '</span>' : '') + '</div>';
  }

  function resultsHtml(res) {
    var C = DataP.lib.charts;
    var k = res.eigenvalues.length;
    var compLabels = res.eigenvalues.map(function (_, i) { return 'CP ' + (i + 1); });
    var two = res.cumulative[Math.min(1, k - 1)];

    var corrHead = '<tr><th></th>' + res.labels.map(function (l) { return '<th>' + esc(l) + '</th>'; }).join('') + '</tr>';
    var corrBody = res.correlation.map(function (row, i) {
      return '<tr><th>' + esc(res.labels[i]) + '</th>' + row.map(function (v) { return '<td>' + fmt(v, 2) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var varBody = res.eigenvalues.map(function (e, i) {
      return '<tr><th>' + compLabels[i] + '</th><td>' + fmt(e, 3) + '</td><td>' + fmt(res.explained[i], 2) + '%</td><td>' + fmt(res.cumulative[i], 2) + '%</td></tr>';
    }).join('');
    var loadBody = res.labels.map(function (l, j) {
      return '<tr><th>' + esc(l) + '</th><td>' + fmt(res.components[0][j], 3) + '</td><td>' + (res.components[1] ? fmt(res.components[1][j], 3) : '—') + '</td></tr>';
    }).join('');
    var scoreRows = res.ids.slice(0, MAX_TABLE_ROWS).map(function (id, i) {
      return '<tr><th>' + esc(id) + '</th><td>' + fmt(res.scores[i][0], 3) + '</td><td>' + fmt(res.scores[i][1], 3) + '</td></tr>';
    }).join('');

    var notes = (res.notes || []).map(function (n) {
      return '<div class="callout callout-warn">' + icon('alert') + '<div>' + esc(n) + '</div></div>';
    }).join('');

    return (notes ? '<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">' + notes + '</div>' : '') +

      '<section class="section" id="lab-resumen" style="margin-top:28px">' +
        '<div class="section-head"><h2>Resumen</h2></div>' +
        '<div class="grid grid-4">' +
          stat('Observaciones', String(res.n), 'Filas con datos completos') +
          stat('Variables', String(res.p), 'Estandarizadas (media 0, varianza 1)') +
          stat('CP1 + CP2', pct(two), 'Varianza explicada') +
          stat('Componentes para 80%', String(res.k80), 'Varianza acumulada ≥ 80%') +
        '</div>' +
        '<div class="card" style="margin-top:16px"><div class="card-title">Conclusión automática</div><ul class="list-check">' +
          conclusions(res).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
        '</ul><p class="card-sub">Es un punto de partida: la interpretación de negocio de cada componente la decides tú.</p></div>' +
      '</section>' +

      '<section class="section" id="lab-correlacion">' +
        '<div class="section-head"><h2>Matriz de correlación</h2><p>Correlaciones fuertes (colores intensos) indican variables redundantes que PCA puede resumir.</p></div>' +
        '<div class="card chart-card"><div id="lab-chart-corr"></div>' + C.gradientLegend('−1 negativa', '+1 positiva') +
          '<details class="data-details"><summary>Ver tabla</summary><div class="table-wrap"><table class="table"><thead>' + corrHead + '</thead><tbody>' + corrBody + '</tbody></table></div></details>' +
        '</div>' +
      '</section>' +

      '<section class="section" id="lab-varianza">' +
        '<div class="section-head"><h2>Varianza explicada</h2></div>' +
        '<div class="grid grid-2">' +
          '<div class="card chart-card"><div class="card-title">Gráfico de sedimentación</div>' +
            C.legend([{ shape: 'rect', cls: 'bg-s1', label: 'Varianza individual' }, { shape: 'line', cls: 'bg-s2', label: 'Varianza acumulada' }, { shape: 'ref', label: 'Umbral 80%' }]) +
            '<div id="lab-chart-scree"></div></div>' +
          '<div class="card"><div class="card-title">Resumen por componente</div><div class="table-wrap"><table class="table"><thead><tr><th>Componente</th><th>Autovalor</th><th>Explicada</th><th>Acumulada</th></tr></thead><tbody>' + varBody + '</tbody></table></div></div>' +
        '</div>' +
      '</section>' +

      '<section class="section" id="lab-cargas">' +
        '<div class="section-head"><h2>Cargas factoriales</h2><p>Cuánto aporta cada variable a CP1 y CP2. Ordenadas de mayor a menor carga en CP1.</p></div>' +
        '<div class="card chart-card"><div class="multiples">' +
          '<div><div class="multiple-title">CP1</div><div class="multiple-sub">' + pct(res.explained[0]) + ' de la varianza</div><div id="lab-chart-cp1"></div></div>' +
          (k > 1 ? '<div><div class="multiple-title">CP2</div><div class="multiple-sub">' + pct(res.explained[1]) + ' de la varianza</div><div id="lab-chart-cp2"></div></div>' : '') +
        '</div>' +
        '<details class="data-details"><summary>Ver tabla</summary><div class="table-wrap"><table class="table"><thead><tr><th>Variable</th><th>CP1</th><th>CP2</th></tr></thead><tbody>' + loadBody + '</tbody></table></div></details>' +
        '</div>' +
      '</section>' +

      (k > 1 ?
      '<section class="section" id="lab-segmentacion">' +
        '<div class="section-head"><h2>Mapa de segmentación</h2><p>Cada punto es una fila del archivo, ubicada por sus puntuaciones en CP1 y CP2. Pasa el cursor sobre un punto para ver su detalle.</p></div>' +
        '<div class="card chart-card">' +
          C.legend([{ shape: 'dot', cls: 'bg-s1', label: 'CP1 positivo' }, { shape: 'dot', cls: 'bg-s2', label: 'CP1 negativo' }]) +
          '<div id="lab-chart-scatter"></div>' +
          '<details class="data-details"><summary>Ver puntuaciones</summary><div class="table-wrap" style="max-height:360px"><table class="table"><thead><tr><th>ID</th><th>CP1</th><th>CP2</th></tr></thead><tbody>' + scoreRows + '</tbody></table></div>' +
            (res.ids.length > MAX_TABLE_ROWS ? '<p class="stat-note">Se muestran las primeras ' + MAX_TABLE_ROWS + ' filas; descarga el CSV para verlas todas.</p>' : '') +
          '</details>' +
        '</div>' +
      '</section>' : '') +

      '<section class="section" id="lab-descargas">' +
        '<div class="section-head"><h2>Descargar resultados</h2><p>Archivos CSV listos para abrir en Excel o en el notebook.</p></div>' +
        '<div class="header-actions">' +
          '<button type="button" class="btn btn-primary" data-action="dl-scores">' + icon('download') + 'Puntuaciones por fila</button>' +
          '<button type="button" class="btn" data-action="dl-loadings">' + icon('download') + 'Cargas factoriales</button>' +
          '<button type="button" class="btn" data-action="dl-variance">' + icon('download') + 'Varianza explicada</button>' +
        '</div>' +
        '<div class="card" style="margin-top:16px"><div class="card-head"><div><div class="card-title">Guardar en tu espacio</div>' +
          '<p class="card-sub">Crea una nota con el resumen de este análisis dentro de un proyecto, para no perderlo.</p></div>' +
          '<button type="button" class="btn btn-primary" data-action="save-note">' + icon('note') + 'Guardar como nota</button></div></div>' +
      '</section>';
  }

  function drawCharts(root, res) {
    var C = DataP.lib.charts;
    C.disposeAll();
    var k = res.eigenvalues.length;
    C.heatmap(root.querySelector('#lab-chart-corr'), { labels: res.labels, matrix: res.correlation });
    C.scree(root.querySelector('#lab-chart-scree'), {
      labels: res.eigenvalues.map(function (_, i) { return 'CP ' + (i + 1); }),
      individual: res.explained,
      cumulative: res.cumulative,
      eigenvalues: res.eigenvalues,
      threshold: 80,
    });

    var order = res.labels.map(function (_, i) { return i; })
      .sort(function (a, b) { return res.components[0][b] - res.components[0][a]; });
    var maxAbs = 0;
    res.components.slice(0, 2).forEach(function (vec) { vec.forEach(function (v) { maxAbs = Math.max(maxAbs, Math.abs(v)); }); });
    var domain = Math.min(1, Math.ceil(maxAbs * 1.3 * 10) / 10);
    var sorted = order.map(function (i) { return res.labels[i]; });
    C.hbars(root.querySelector('#lab-chart-cp1'), {
      labels: sorted,
      values: order.map(function (i) { return res.components[0][i]; }),
      domain: domain,
      sideLabels: ['← negativo', 'positivo →'],
      ariaLabel: 'Cargas en CP1',
    });
    if (k > 1) {
      C.hbars(root.querySelector('#lab-chart-cp2'), {
        labels: sorted,
        values: order.map(function (i) { return res.components[1][i]; }),
        domain: domain,
        sideLabels: ['← negativo', 'positivo →'],
        ariaLabel: 'Cargas en CP2',
      });

      var pts = res.scores.map(function (s, i) {
        return { x: s[0], y: s[1], id: res.ids[i], group: s[0] >= 0 ? 'pos' : 'neg' };
      });
      // Etiquetas selectivas: solo los extremos de cada eje.
      var pick = {};
      function mark(sortFn) { var o = pts.slice().sort(sortFn); pick[o[0].id] = true; }
      mark(function (a, b) { return b.x - a.x; });
      mark(function (a, b) { return a.x - b.x; });
      mark(function (a, b) { return b.y - a.y; });
      mark(function (a, b) { return a.y - b.y; });
      C.scatter(root.querySelector('#lab-chart-scatter'), {
        points: pts,
        groups: [
          { id: 'pos', label: 'CP1 positivo', cls: 'fill-s1', color: 'var(--series-1)' },
          { id: 'neg', label: 'CP1 negativo', cls: 'fill-s2', color: 'var(--series-2)' },
        ],
        labelIds: Object.keys(pick),
        xTitle: 'Componente principal 1 (' + pct(res.explained[0]) + ' de varianza)',
        yTitle: 'Componente principal 2 (' + pct(res.explained[1]) + ')',
        idLabel: state.idCol >= 0 ? state.table.headers[state.idCol] : 'Fila',
        ariaLabel: 'Mapa de dispersión de las filas según CP1 y CP2',
      });
    }
  }

  function download(kind, res) {
    var base = (state.fileName || 'datos').replace(/\.[^.]+$/, '');
    if (kind === 'dl-scores') {
      var header = ['ID'].concat(res.names, ['Score_CP1', 'Score_CP2']);
      var rows = [header].concat(res.ids.map(function (id, i) {
        return [id].concat(res.X[i], [res.scores[i][0], res.scores[i][1] == null ? '' : res.scores[i][1]]);
      }));
      U.downloadText(base + '_puntuaciones_pca.csv', toCsv(rows), 'text/csv;charset=utf-8');
    } else if (kind === 'dl-loadings') {
      var comps = res.components.map(function (_, i) { return 'CP' + (i + 1); });
      var rows2 = [['Variable'].concat(comps)].concat(res.names.map(function (n, j) {
        return [n].concat(res.components.map(function (vec) { return vec[j]; }));
      }));
      U.downloadText(base + '_cargas_pca.csv', toCsv(rows2), 'text/csv;charset=utf-8');
    } else if (kind === 'dl-variance') {
      var rows3 = [['Componente', 'Autovalor', 'Varianza_Explicada_%', 'Varianza_Acumulada_%']].concat(res.eigenvalues.map(function (e, i) {
        return ['CP ' + (i + 1), e, res.explained[i], res.cumulative[i]];
      }));
      U.downloadText(base + '_varianza_pca.csv', toCsv(rows3), 'text/csv;charset=utf-8');
    }
  }

  /* ------------------------------------------------------------------------
     Guardar el resumen como nota de un proyecto
     ------------------------------------------------------------------------ */
  function summaryMarkdown(res) {
    var lines = [];
    var two = res.cumulative[Math.min(1, res.cumulative.length - 1)];
    lines.push('## Datos');
    lines.push('- Archivo: `' + (state.fileName || 'datos') + '`' + (state.isSample ? ' (datos sintéticos de ejemplo)' : ''));
    lines.push('- ' + res.n + ' filas y ' + res.p + ' variables: ' + res.names.join(', '));
    lines.push('');
    lines.push('## Resultados');
    lines.push('- CP1 explica el **' + pct(res.explained[0]) + '** de la varianza; CP1 + CP2, el **' + pct(two) + '**.');
    lines.push('- Componentes para llegar al 80%: **' + res.k80 + '**.');
    conclusions(res).slice(2).forEach(function (c) { lines.push('- ' + c); });
    lines.push('');
    lines.push('## Próximos pasos');
    lines.push('- [ ] Interpretar qué representa cada componente para el negocio');
    return lines.join('\n');
  }

  function saveAsNote(res) {
    var UI = DataP.ui;
    var base = (state.fileName || 'datos').replace(/\.[^.]+$/, '');
    UI.dialog({
      title: 'Guardar como nota',
      size: 'sm',
      body:
        '<label class="fld"><span class="fld-label">Título</span><input class="input" name="title" required maxlength="160" value="' + esc('Análisis PCA · ' + base) + '" autofocus></label>' +
        '<label class="fld"><span class="fld-label">Proyecto</span><select class="input" name="projectId">' + UI.projectOptions('pca-clientes') + '</select></label>',
      actions: [{ value: 'cancel', label: 'Cancelar' }, { value: 'save', label: 'Guardar nota', kind: 'primary' }],
      onAction: function (value, form) {
        var n = DataP.store.addNote({ title: form.title.value.trim() || 'Análisis PCA', body: summaryMarkdown(res), projectId: form.projectId.value });
        UI.toast('Nota guardada', { action: { label: 'Abrir', run: function () { DataP.navigate('notas', n.id); } } });
      },
    });
  }

  /* ------------------------------------------------------------------------
     Registro del módulo
     ------------------------------------------------------------------------ */
  DataP.registerModule({
    id: 'laboratorio',
    title: 'Laboratorio PCA',
    section: 'Herramientas',
    icon: 'flask',
    order: 10,
    summary: 'Carga un Excel o CSV y repite el análisis del notebook en el navegador: correlación, varianza, cargas y mapa de segmentación.',
    keywords: 'pca excel csv subir archivo analisis componentes',

    render: function (root) {
      root.innerHTML =
        '<header class="page-header">' +
          '<span class="eyebrow">Herramienta</span>' +
          '<h1>Laboratorio PCA</h1>' +
          '<p class="lede">Carga un Excel o CSV y repite el flujo del notebook (estandarizar, correlación, PCA, cargas y segmentación) en segundos. Tus datos no salen de este navegador.</p>' +
        '</header>' +
        '<div id="lab-upload"></div>' +
        '<div id="lab-error"></div>' +
        '<div id="lab-config" style="margin-top:16px"></div>' +
        '<div id="lab-results"></div>';

      var uploadEl = root.querySelector('#lab-upload');
      var errorEl = root.querySelector('#lab-error');
      var configEl = root.querySelector('#lab-config');
      var resultsEl = root.querySelector('#lab-results');
      var lastResult = null;

      function showError(msg) {
        errorEl.innerHTML = msg
          ? '<div class="callout callout-warn" style="margin-top:16px">' + icon('alert') + '<div class="error-box"><strong>No se pudo completar.</strong> ' + esc(msg) + '</div></div>'
          : '';
      }

      function renderUpload() {
        uploadEl.innerHTML = uploadHtml(!!state.table);
        var zone = uploadEl.querySelector('#dropzone');
        var input = uploadEl.querySelector('#file-input');
        input.addEventListener('change', function () {
          if (input.files && input.files[0]) handleFile(input.files[0]);
          input.value = '';
        });
        zone.addEventListener('click', function (e) {
          var btn = e.target.closest('button');
          if (!btn) { input.click(); return; }
          var action = btn.getAttribute('data-action');
          if (action === 'choose') input.click();
          else if (action === 'sample') {
            loadSheets('ejemplo_sintetico.csv', [{ name: 'Ejemplo', rows: sampleRows() }], true);
            refresh();
          } else if (action === 'template') {
            U.downloadText('ejemplo_pca_clientes.csv', toCsv(sampleRows()), 'text/csv;charset=utf-8');
          }
        });
        zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-over'); });
        zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
        zone.addEventListener('drop', function (e) {
          e.preventDefault();
          zone.classList.remove('is-over');
          var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) handleFile(f);
        });
      }

      function handleFile(file) {
        showError('');
        DataP.lib.fileReader.readFile(file).then(function (out) {
          loadSheets(out.fileName, out.sheets, false);
          refresh();
        }).catch(function (err) {
          console.error(err);
          showError(err.message || String(err));
        });
      }

      function renderConfig() {
        if (!state.table) { configEl.innerHTML = ''; return; }
        configEl.innerHTML = configHtml();
        var sheet = configEl.querySelector('#sel-sheet');
        if (sheet) sheet.addEventListener('change', function () {
          try { selectSheet(+sheet.value); } catch (e) { showError(e.message); return; }
          refresh();
        });
        configEl.querySelector('#sel-id').addEventListener('change', function (e) {
          state.idCol = +e.target.value;
          var t = state.table;
          state.selected = state.selected.filter(function (j) { return j !== state.idCol; });
          if (!state.selected.length) {
            t.headers.forEach(function (_, j) { if (t.numeric[j] && j !== state.idCol) state.selected.push(j); });
          }
          renderConfig();
          renderResults();
        });
        configEl.querySelector('#var-list').addEventListener('change', function () {
          state.selected = Array.prototype.map.call(configEl.querySelectorAll('#var-list input:checked'), function (i) { return +i.value; });
          renderResults();
        });
      }

      function renderResults() {
        DataP.lib.charts.disposeAll();
        lastResult = null;
        if (!state.table) {
          resultsEl.innerHTML =
            '<div class="grid grid-3" style="margin-top:20px">' +
              '<div class="card"><div class="card-title">1. Carga tus datos</div><p class="card-sub">Un archivo .xlsx o .csv con una fila por cliente (u observación) y una columna por variable.</p></div>' +
              '<div class="card"><div class="card-title">2. Elige las variables</div><p class="card-sub">Se detectan solas las columnas numéricas y la columna <code>ID</code>. Puedes quitar o añadir variables.</p></div>' +
              '<div class="card"><div class="card-title">3. Lee los resultados</div><p class="card-sub">Correlación, varianza explicada, cargas, mapa de segmentación y una conclusión automática, con descarga en CSV.</p></div>' +
            '</div>';
          return;
        }
        var res;
        try { res = analyze(); } catch (e) { console.error(e); res = { error: e.message }; }
        if (res.error) {
          resultsEl.innerHTML = (res.notes || []).concat([res.error]).map(function (n) {
            return '<div class="callout callout-warn" style="margin-top:16px">' + icon('alert') + '<div>' + esc(n) + '</div></div>';
          }).join('');
          return;
        }
        lastResult = res;
        resultsEl.innerHTML = resultsHtml(res);
        drawCharts(resultsEl, res);
      }

      resultsEl.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn || !lastResult) return;
        if (btn.getAttribute('data-action') === 'save-note') saveAsNote(lastResult);
        else download(btn.getAttribute('data-action'), lastResult);
      });

      function refresh() {
        renderUpload();
        renderConfig();
        renderResults();
      }

      refresh();
    },
  });
})();
