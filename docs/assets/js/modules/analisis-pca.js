/* ==========================================================================
   Módulo: Proyecto · Segmentación de clientes con PCA
   Presenta los resultados guardados del notebook (DataP.data.pcaClientes).
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;
  var fmt = U.fmt;
  var pct = U.pct;

  function sectionHead(num, id, title, text) {
    return '<div class="section-head"><h2><span class="section-num">' + num + '</span>' + esc(title) + '</h2>' +
      (text ? '<p>' + text + '</p>' : '') + '</div>';
  }

  function stat(label, value, note) {
    return '<div class="card stat"><span class="stat-label">' + esc(label) + '</span><span class="stat-value">' + esc(value) + '</span>' +
      (note ? '<span class="stat-note">' + esc(note) + '</span>' : '') + '</div>';
  }

  DataP.registerModule({
    id: 'analisis-pca',
    title: 'Segmentación de clientes con PCA',
    navLabel: 'Reporte · Segmentación de clientes',
    nav: false,
    project: 'pca-clientes',
    keywords: 'reporte pca componentes principales clientes notebook',
    icon: 'scatter',
    order: 10,
    summary: 'Reducción de 8 variables de compra a 2 componentes principales para identificar perfiles de clientes y decidir a quién priorizar.',

    render: function (root) {
      var D = DataP.data.pcaClientes;
      var C = DataP.lib.charts;
      var labels = D.variables.map(function (v) { return v.etiqueta; });
      var p = labels.length;
      var v1 = D.varianza[0];
      var v2 = D.varianza[1];
      var colabUrl = DataP.config.colabBase + D.notebook;
      var githubUrl = DataP.config.repoUrl + '/blob/main/' + D.notebook;

      // Orden de las cargas: de mayor a menor en CP1 (agrupa los dos perfiles).
      var order = labels.map(function (_, i) { return i; })
        .sort(function (a, b) { return D.cargas.CP1[b] - D.cargas.CP1[a]; });
      var cp2Sorted = labels.map(function (l, i) { return { l: l, v: D.cargas.CP2[i] }; })
        .sort(function (a, b) { return b.v - a.v; });

      var sampleHead = '<tr><th>ID</th>' + labels.map(function (l) { return '<th>' + esc(l) + '</th>'; }).join('') + '</tr>';
      var sampleBody = D.muestra.filas.map(function (row, i) {
        return '<tr><th>' + D.muestra.ids[i] + '</th>' + row.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>';
      }).join('');

      var corrTable = '<tr><th></th>' + labels.map(function (l) { return '<th>' + esc(l) + '</th>'; }).join('') + '</tr>';
      var corrBody = D.correlacion.map(function (row, i) {
        return '<tr><th>' + esc(labels[i]) + '</th>' + row.map(function (v) { return '<td>' + fmt(v, 2) + '</td>'; }).join('') + '</tr>';
      }).join('');

      var varBody = D.varianza.map(function (r) {
        return '<tr><th>' + esc(r.componente) + '</th><td>' + fmt(r.autovalor, 2) + '</td><td>' + fmt(r.explicada, 2) + '%</td><td>' + fmt(r.acumulada, 2) + '%</td></tr>';
      }).join('');

      var loadBody = order.map(function (i) {
        return '<tr><th>' + esc(labels[i]) + '</th><td>' + fmt(D.cargas.CP1[i], 3) + '</td><td>' + fmt(D.cargas.CP2[i], 3) + '</td></tr>';
      }).join('');

      root.innerHTML =
        '<nav class="crumbs" aria-label="Ruta"><a href="#/proyectos">Proyectos</a><span class="sep">›</span>' +
          '<a href="#/proyectos/pca-clientes">Segmentación de clientes</a><span class="sep">›</span><span>Reporte</span></nav>' +
        '<header class="page-header" style="margin-top:10px">' +
          '<span class="eyebrow">Reporte del notebook</span>' +
          '<h1>' + esc(D.titulo) + '</h1>' +
          '<p class="lede">Análisis de Componentes Principales (PCA) sobre el comportamiento de compra de ' + D.observaciones +
            ' clientes. Resume ' + p + ' variables en 2 componentes para identificar perfiles y decidir a quién priorizar.</p>' +
          '<div class="header-meta"><span class="status status-done">Completado</span>' +
            '<span class="chip">' + D.observaciones + ' clientes</span><span class="chip">' + p + ' variables</span>' +
            '<span class="chip">Python · pandas · scikit-learn</span></div>' +
          '<div class="header-actions">' +
            '<a class="btn btn-primary" href="' + esc(colabUrl) + '" target="_blank" rel="noopener">' + icon('external') + 'Abrir en Colab</a>' +
            '<a class="btn" href="' + esc(githubUrl) + '" target="_blank" rel="noopener">' + icon('notebook') + 'Ver notebook</a>' +
            '<a class="btn btn-ghost" href="#/laboratorio">' + icon('flask') + 'Repetir con mis datos</a>' +
          '</div>' +
        '</header>' +

        '<div class="grid grid-4">' +
          stat('Variables originales', String(p), 'Datos de compra y perfil') +
          stat('Componentes retenidos', '2', 'CP1 y CP2') +
          stat('Información conservada', pct(v2.acumulada), 'Varianza acumulada CP1 + CP2') +
          stat('Peso del CP1', pct(v1.explicada), 'Un solo eje explica casi todo') +
        '</div>' +

        '<nav class="toc" aria-label="Secciones" style="margin-top:24px">' +
          '<a href="#/analisis-pca/flujo">Flujo</a><a href="#/analisis-pca/datos">Datos</a>' +
          '<a href="#/analisis-pca/correlacion">Correlación</a><a href="#/analisis-pca/varianza">Varianza</a>' +
          '<a href="#/analisis-pca/cargas">Cargas</a><a href="#/analisis-pca/segmentacion">Segmentación</a>' +
          '<a href="#/analisis-pca/conclusiones">Conclusiones</a>' +
        '</nav>' +

        // 1. Flujo
        '<section class="section" id="flujo">' +
          sectionHead(1, 'flujo', 'Flujo del análisis', 'Los mismos pasos, en el mismo orden, que las celdas del notebook.') +
          '<ol class="steps">' +
            '<li><strong>Cargar</strong>Excel con ' + D.observaciones + ' clientes</li>' +
            '<li><strong>Estandarizar</strong>Media 0, varianza 1</li>' +
            '<li><strong>Correlación</strong>Detectar redundancia</li>' +
            '<li><strong>PCA</strong>Varianza por componente</li>' +
            '<li><strong>Cargas</strong>Interpretar cada eje</li>' +
            '<li><strong>Segmentar</strong>Mapa CP1 × CP2</li>' +
          '</ol>' +
        '</section>' +

        // 2. Datos
        '<section class="section" id="datos">' +
          sectionHead(2, 'datos', 'Datos', 'Archivo <code>' + esc(D.archivoDatos) + '</code>: ' + D.observaciones + ' filas, una por cliente, con su <code>ID</code> y ' + p + ' variables numéricas.') +
          '<div class="card"><div class="card-title">Primeras 5 filas</div>' +
            '<div class="table-wrap"><table class="table"><thead>' + sampleHead + '</thead><tbody>' + sampleBody + '</tbody></table></div>' +
          '</div>' +
        '</section>' +

        // 3. Correlación
        '<section class="section" id="correlacion">' +
          sectionHead(3, 'correlacion', 'Matriz de correlación', 'Todas las variables están muy correlacionadas entre sí (|r| ≥ 0.85). Esa multicolinealidad es justamente lo que justifica resumirlas con PCA.') +
          '<div class="grid grid-2" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))">' +
            '<div class="card chart-card" style="grid-column:1/-1">' +
              '<div class="card-title">Correlación entre variables</div>' +
              '<div class="card-sub">Rojo: se mueven juntas · Azul: se mueven en sentido contrario</div>' +
              '<div id="chart-corr"></div>' +
              C.gradientLegend('−1 negativa', '+1 positiva') +
              '<details class="data-details"><summary>Ver tabla</summary><div class="table-wrap"><table class="table"><thead>' + corrTable + '</thead><tbody>' + corrBody + '</tbody></table></div></details>' +
            '</div>' +
            '<div class="card"><div class="card-title">Bloque “valor”</div><p class="card-sub">Edad, ingreso mensual, monto promedio y antigüedad suben juntos (r entre 0.96 y 0.99).</p></div>' +
            '<div class="card"><div class="card-title">Bloque “digital”</div><p class="card-sub">Frecuencia de compra, productos diferentes, uso de promociones y visitas web suben juntos (r entre 0.98 y 0.99).</p></div>' +
            '<div class="card"><div class="card-title">Entre bloques</div><p class="card-sub">Los dos bloques se oponen: cuando uno sube, el otro baja (r entre −0.85 y −0.96).</p></div>' +
          '</div>' +
        '</section>' +

        // 4. Varianza
        '<section class="section" id="varianza">' +
          sectionHead(4, 'varianza', 'Varianza explicada', 'Cuánta información conserva cada componente. Con 2 componentes se supera de sobra el umbral habitual del 80%.') +
          '<div class="grid grid-2">' +
            '<div class="card chart-card">' +
              '<div class="card-title">Gráfico de sedimentación</div>' +
              C.legend([{ shape: 'rect', cls: 'bg-s1', label: 'Varianza individual' }, { shape: 'line', cls: 'bg-s2', label: 'Varianza acumulada' }, { shape: 'ref', label: 'Umbral 80%' }]) +
              '<div id="chart-scree"></div>' +
            '</div>' +
            '<div class="card">' +
              '<div class="card-title">Resumen por componente</div>' +
              '<div class="table-wrap"><table class="table"><thead><tr><th>Componente</th><th>Autovalor</th><th>Explicada</th><th>Acumulada</th></tr></thead><tbody>' + varBody + '</tbody></table></div>' +
              '<p class="card-sub">CP5 a CP8 suman el ' + fmt(100 - D.varianza[D.varianza.length - 1].acumulada, 2) + '% restante (el notebook muestra solo los 4 primeros).</p>' +
              '<div class="callout">' + icon('info') + '<div><strong>CP1 por sí solo explica el ' + pct(v1.explicada) + '.</strong> Las 8 variables cuentan casi la misma historia desde ángulos distintos.</div></div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        // 5. Cargas
        '<section class="section" id="cargas">' +
          sectionHead(5, 'cargas', 'Cargas factoriales', 'Cuánto aporta cada variable a cada componente. El signo indica hacia qué lado del eje empuja.') +
          '<div class="card chart-card">' +
            '<div class="multiples">' +
              '<div><div class="multiple-title">CP1 · Perfil valor vs. digital</div><div class="multiple-sub">' + pct(v1.explicada) + ' de la varianza</div><div id="chart-cp1"></div></div>' +
              '<div><div class="multiple-title">CP2 · Componente residual</div><div class="multiple-sub">' + pct(v2.explicada) + ' de la varianza</div><div id="chart-cp2"></div></div>' +
            '</div>' +
            '<details class="data-details"><summary>Ver tabla</summary><div class="table-wrap"><table class="table"><thead><tr><th>Variable</th><th>CP1</th><th>CP2</th></tr></thead><tbody>' + loadBody + '</tbody></table></div></details>' +
          '</div>' +
          '<div class="grid grid-2" style="margin-top:16px">' +
            '<div class="card"><div class="card-title">Lectura del CP1</div><p class="card-sub">Las 8 variables pesan casi lo mismo (≈ 0.35), pero con signos opuestos: edad, ingreso, monto promedio y antigüedad empujan hacia el lado positivo; frecuencia, productos diferentes, promociones y visitas web, hacia el negativo.</p></div>' +
            '<div class="card"><div class="card-title">Lectura del CP2</div><p class="card-sub">Todas las cargas son positivas. La mayor es ' + esc(cp2Sorted[0].l.toLowerCase()) + ' (' + fmt(cp2Sorted[0].v, 2) + '), seguida de ' + esc(cp2Sorted[1].l.toLowerCase()) + ' (' + fmt(cp2Sorted[1].v, 2) + ') y ' + esc(cp2Sorted[2].l.toLowerCase()) + ' (' + fmt(cp2Sorted[2].v, 2) + ').</p></div>' +
          '</div>' +
        '</section>' +

        // 6. Segmentación
        '<section class="section" id="segmentacion">' +
          sectionHead(6, 'segmentacion', 'Mapa de segmentación', 'Cada punto es un cliente ubicado según sus puntuaciones en CP1 y CP2.') +
          '<div class="grid grid-2" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))">' +
            '<figure class="card figure" style="grid-column:1/-1">' +
              '<img src="' + esc(D.figuraSegmentacion) + '" alt="Dispersión de los 50 clientes según CP1 (eje horizontal) y CP2 (eje vertical). A la derecha el perfil premium, a la izquierda el perfil cazaofertas." loading="lazy" width="1184" height="784">' +
              '<figcaption>Figura original del notebook (celda 7). Para un mapa interactivo con tus propios datos, usa el <a href="#/laboratorio">Laboratorio PCA</a>.</figcaption>' +
            '</figure>' +
            '<div class="card"><div class="card-title"><span class="key-dot bg-s1" style="margin-right:8px"></span>Perfil premium · CP1 &gt; 0</div>' +
              '<ul class="list-check" style="margin-top:10px"><li>Mayor edad, ingresos y antigüedad.</li><li>Ticket de compra alto, pero compran con poca frecuencia.</li><li>Poco uso de la web y de promociones.</li><li>Ejemplos: clientes 2 y 21.</li></ul></div>' +
            '<div class="card"><div class="card-title"><span class="key-dot bg-s2" style="margin-right:8px"></span>Perfil digital / cazaofertas · CP1 &lt; 0</div>' +
              '<ul class="list-check" style="margin-top:10px"><li>Más jóvenes y con menores ingresos.</li><li>Compran muy seguido y prueban muchos productos, con ticket bajo.</li><li>Muy dependientes de la web y de las ofertas.</li><li>Ejemplos: clientes 7 y 29.</li></ul></div>' +
          '</div>' +
        '</section>' +

        // 7. Conclusiones
        '<section class="section" id="conclusiones">' +
          sectionHead(7, 'conclusiones', 'Interpretación ejecutiva', 'Respuestas a las preguntas estratégicas planteadas en el notebook.') +
          '<div class="grid grid-2">' +
            '<div class="card qa"><span class="qa-q">¿Cuántas variables se redujeron?</span><p>Se pasó de <strong>8 variables operativas a 2 componentes estratégicos</strong>. Se elimina el ruido y la redundancia y se conserva el ' + pct(v2.acumulada) + ' de la información sobre el comportamiento del cliente.</p></div>' +
            '<div class="card qa"><span class="qa-q">¿Qué representan los nuevos componentes?</span><p><strong>CP1</strong> separa al cliente premium tradicional del cliente digital cazaofertas. <strong>CP2</strong> recoge variaciones residuales (' + pct(v2.explicada) + ' de la varianza) independientes de la edad o el ingreso.</p></div>' +
            '<div class="card qa"><span class="qa-q">¿Qué decisiones puede tomar la empresa?</span>' +
              '<ul class="list-check"><li><strong>Premium:</strong> dejar los correos masivos de descuentos y pasar a atención personalizada, catálogos físicos o un programa VIP basado en el valor del ticket.</li>' +
              '<li><strong>Digital:</strong> mejorar la experiencia web (UX) y lanzar campañas flash, cupones digitales y venta cruzada.</li></ul></div>' +
            '<div class="card qa"><span class="qa-q">¿Qué clientes se deben priorizar?</span><p>Depende del objetivo comercial (OKR/KPI) del trimestre:</p>' +
              '<ul class="list-check"><li><strong>Rentabilidad y flujo de caja:</strong> clientes con CP1 alto (premium, ticket alto).</li>' +
              '<li><strong>Tráfico web, rotación de inventario y adquisición:</strong> clientes con CP1 negativo (alta frecuencia y volumen).</li></ul></div>' +
          '</div>' +
          '<div class="callout callout-warn" style="margin-top:16px">' + icon('alert') + '<div><strong>Nota de revisión:</strong> el texto original del notebook dice que CP2 explica el 13.5% de la varianza, pero la tabla calculada en la celda 5 da ' + pct(v2.explicada, 2) + '. Aquí se usa el valor calculado.</div></div>' +
        '</section>' +

        '<footer class="page-foot">Fuente: <a href="' + esc(githubUrl) + '" target="_blank" rel="noopener">' + esc(D.notebook) + '</a>. Las cifras se copiaron de las salidas guardadas del notebook.</footer>';

      // Gráficos
      C.heatmap(root.querySelector('#chart-corr'), {
        labels: labels,
        matrix: D.correlacion,
        ariaLabel: 'Matriz de correlación entre las 8 variables',
      });
      C.scree(root.querySelector('#chart-scree'), {
        labels: D.varianza.map(function (r) { return r.componente; }),
        individual: D.varianza.map(function (r) { return r.explicada; }),
        cumulative: D.varianza.map(function (r) { return r.acumulada; }),
        eigenvalues: D.varianza.map(function (r) { return r.autovalor; }),
        threshold: 80,
      });
      var sortedLabels = order.map(function (i) { return labels[i]; });
      C.hbars(root.querySelector('#chart-cp1'), {
        labels: sortedLabels,
        values: order.map(function (i) { return D.cargas.CP1[i]; }),
        domain: 0.8,
        sideLabels: ['← Perfil digital', 'Perfil premium →'],
        ariaLabel: 'Cargas de cada variable en CP1',
      });
      C.hbars(root.querySelector('#chart-cp2'), {
        labels: sortedLabels,
        values: order.map(function (i) { return D.cargas.CP2[i]; }),
        domain: 0.8,
        sideLabels: ['', ''],
        ariaLabel: 'Cargas de cada variable en CP2',
      });
    },
  });
})();
