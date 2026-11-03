/* ==========================================================================
   Módulo: Inicio
   Portada de DataP: accesos a proyectos y herramientas, y mapa del repositorio.
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;

  var REPO_TREE = [
    { name: 'README.md', type: 'file', desc: 'Guía del repositorio' },
    {
      name: 'notebooks/', type: 'folder', desc: 'Notebooks de análisis (Colab / Jupyter)',
      children: [{ name: 'analisis_pca_clientes.ipynb', type: 'notebook', desc: 'Segmentación de clientes con PCA' }],
    },
    {
      name: 'data/', type: 'folder', desc: 'Datos de entrada',
      children: [{ name: 'README.md', type: 'file', desc: 'Formato esperado de Data.xlsx' }],
    },
    {
      name: 'docs/', type: 'folder', desc: 'Esta web (lista para GitHub Pages)',
      children: [
        { name: 'index.html', type: 'file', desc: 'Punto de entrada' },
        {
          name: 'assets/', type: 'folder', desc: '',
          children: [
            { name: 'css/', type: 'folder', desc: 'Estilos y temas claro/oscuro' },
            { name: 'js/app.js', type: 'file', desc: 'Núcleo: menú, rutas y tema' },
            { name: 'js/lib/', type: 'folder', desc: 'PCA, lectura de Excel/CSV y gráficos' },
            { name: 'js/modules/', type: 'folder', desc: 'Un archivo por página (módulo)' },
            { name: 'data/', type: 'folder', desc: 'Resultados guardados de cada proyecto' },
            { name: 'img/', type: 'folder', desc: 'Figuras exportadas de los notebooks' },
          ],
        },
      ],
    },
  ];

  function treeHtml(nodes) {
    return '<ul>' + nodes.map(function (n) {
      return '<li><div class="tree-row"><span class="tree-name">' + icon(n.type === 'folder' ? 'folder' : n.type === 'notebook' ? 'notebook' : 'file') +
        esc(n.name) + '</span>' + (n.desc ? '<span class="tree-desc">' + esc(n.desc) + '</span>' : '') + '</div>' +
        (n.children ? treeHtml(n.children) : '') + '</li>';
    }).join('') + '</ul>';
  }

  function moduleCard(m) {
    var tags = (m.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('');
    var status = m.status ? '<span class="status ' + (m.statusClass || '') + '">' + esc(m.status) + '</span>' : '';
    return '<a class="card card-link" href="#/' + esc(m.id) + '">' +
      '<span class="card-icon">' + icon(m.icon || 'grid') + '</span>' +
      '<span class="card-title">' + esc(m.title) + '</span>' +
      '<span class="card-sub">' + esc(m.summary || '') + '</span>' +
      '<span class="card-foot">' + status + tags + '</span>' +
      '</a>';
  }

  DataP.registerModule({
    id: 'inicio',
    title: 'Inicio',
    section: 'General',
    icon: 'home',
    order: 0,

    render: function (root) {
      var projects = DataP.getModules('Proyectos');
      var tools = DataP.getModules('Herramientas');

      root.innerHTML =
        '<header class="page-header">' +
          '<span class="eyebrow">Inicio</span>' +
          '<h1>Bienvenido a DataP</h1>' +
          '<p class="lede">Este es el primer paso de la super app de organización: todo lo que hay en este repositorio, ordenado en un solo lugar. Desde aquí llegas a cada proyecto y a cada herramienta.</p>' +
        '</header>' +

        '<div class="grid grid-2" style="margin-top:8px;gap:24px">' +
          '<section>' +
            '<div class="section-head"><h2>Proyectos</h2><p>Análisis terminados, con sus resultados y conclusiones.</p></div>' +
            '<div class="grid">' + projects.map(moduleCard).join('') + '</div>' +
          '</section>' +
          '<section>' +
            '<div class="section-head"><h2>Herramientas</h2><p>Utilidades para repetir los análisis con datos nuevos.</p></div>' +
            '<div class="grid">' + tools.map(moduleCard).join('') + '</div>' +
          '</section>' +
        '</div>' +

        '<section class="section">' +
          '<div class="section-head"><h2>Cómo está organizado el repositorio</h2><p>Cada carpeta tiene un propósito. Los notebooks producen resultados, y esta web los presenta.</p></div>' +
          '<div class="grid grid-2">' +
            '<div class="card"><div class="card-title">Estructura</div><div class="tree">' +
              '<div class="tree-row"><span class="tree-name">' + icon('folder') + 'DataP/</span></div>' +
              treeHtml(REPO_TREE) +
            '</div></div>' +
            '<div class="card">' +
              '<div class="card-title">Agregar un módulo nuevo</div>' +
              '<p class="card-sub">Cada página de esta web es un módulo independiente. Para sumar una sección nueva (otro análisis, tareas, notas…):</p>' +
              '<ol class="steps" style="grid-template-columns:1fr">' +
                '<li><strong>Crea el archivo</strong>En <code>docs/assets/js/modules/</code>, por ejemplo <code>tareas.js</code>.</li>' +
                '<li><strong>Regístralo</strong>Llama a <code>DataP.registerModule({ id, title, section, render })</code>.</li>' +
                '<li><strong>Enlázalo</strong>Añade su <code>&lt;script&gt;</code> al final de <code>docs/index.html</code>. Aparecerá solo en el menú.</li>' +
              '</ol>' +
              '<p class="card-sub">El detalle está en el README del repositorio.</p>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<footer class="page-foot">DataP · Todo se ejecuta en tu navegador: los archivos que cargues no se envían a ningún servidor.</footer>';
    },
  });
})();
