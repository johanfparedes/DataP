/* ==========================================================================
   Módulo: Ajustes
   Apariencia, respaldo de datos, instalación como app, atajos y estructura
   del repositorio.
   ========================================================================== */
(function () {
  'use strict';

  var U = DataP.util;
  var esc = U.esc;
  var icon = U.icon;

  // El navegador avisa cuando la web se puede instalar como app.
  var installPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installPrompt = e;
  });

  var REPO_TREE = [
    { name: 'README.md', type: 'file', desc: 'Guía del repositorio' },
    { name: 'notebooks/', type: 'folder', desc: 'Notebooks de análisis (Colab / Jupyter)',
      children: [{ name: 'analisis_pca_clientes.ipynb', type: 'notebook', desc: 'Segmentación de clientes con PCA' }] },
    { name: 'data/', type: 'folder', desc: 'Datos de entrada', children: [{ name: 'README.md', type: 'file', desc: 'Formato de Data.xlsx' }] },
    { name: 'docs/', type: 'folder', desc: 'Esta web (GitHub Pages)', children: [
      { name: 'index.html', type: 'file', desc: 'Punto de entrada' },
      { name: 'manifest.webmanifest · sw.js', type: 'file', desc: 'App instalable y sin conexión' },
      { name: 'assets/js/app.js', type: 'file', desc: 'Núcleo: menú, rutas, tema' },
      { name: 'assets/js/store.js', type: 'file', desc: 'Proyectos, tareas, notas, hábitos y enfoque' },
      { name: 'assets/js/ui.js', type: 'file', desc: 'Diálogos, avisos, buscador, captura inteligente' },
      { name: 'assets/js/focus.js', type: 'file', desc: 'Temporizador de enfoque' },
      { name: 'assets/js/modules/', type: 'folder', desc: 'Una página por archivo' },
      { name: 'assets/js/lib/', type: 'folder', desc: 'PCA, Excel/CSV y gráficos' },
      { name: 'assets/data/', type: 'folder', desc: 'Resultados de los notebooks' },
    ] },
  ];

  function treeHtml(nodes) {
    return '<ul>' + nodes.map(function (n) {
      return '<li><div class="tree-row"><span class="tree-name">' + icon(n.type === 'folder' ? 'folder' : n.type === 'notebook' ? 'notebook' : 'file') +
        esc(n.name) + '</span>' + (n.desc ? '<span class="tree-desc">' + esc(n.desc) + '</span>' : '') + '</div>' +
        (n.children ? treeHtml(n.children) : '') + '</li>';
    }).join('') + '</ul>';
  }

  DataP.registerModule({
    id: 'ajustes',
    title: 'Ajustes',
    nav: false,
    icon: 'settings',
    order: 90,
    summary: 'Tema, respaldo de datos, instalación como app y atajos.',
    keywords: 'configuracion preferencias respaldo exportar importar tema instalar',

    render: function (root) {
      var S = DataP.store;
      var UI = DataP.ui;
      var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
      var mod = mac ? '⌘' : 'Ctrl';

      function draw() {
        var snap = S.snapshot();
        var pref = DataP.themePreference();
        var themeOpt = function (id, label) {
          return '<label class="var-toggle"><input type="radio" name="theme" value="' + id + '"' + (pref === id ? ' checked' : '') + '>' + label + '</label>';
        };
        root.innerHTML =
          '<div class="page-top"><header class="page-header"><h1>Ajustes</h1><p class="lede">Apariencia, tus datos y cómo instalar DataP en el móvil.</p></header></div>' +

          '<section class="card"><h2 class="card-title">Apariencia</h2>' +
            '<div class="settings-row"><div class="txt"><strong>Tema</strong><span>“Sistema” sigue la configuración de tu dispositivo.</span></div>' +
              '<div class="var-list" role="radiogroup" aria-label="Tema">' + themeOpt('system', 'Sistema') + themeOpt('light', 'Claro') + themeOpt('dark', 'Oscuro') + '</div></div>' +
          '</section>' +

          '<section class="card" style="margin-top:16px"><h2 class="card-title">Tus datos</h2>' +
            (S.isPersistent() ? '' : '<div class="callout callout-warn" style="margin-top:12px">' + icon('alert') + '<div>Este navegador no permite guardar datos. Exporta un respaldo antes de cerrar la pestaña.</div></div>') +
            '<div class="settings-row"><div class="txt"><strong>Dónde se guardan</strong><span>En este navegador, en este dispositivo. No se envían a ningún servidor: ' +
              snap.projects.length + ' proyectos, ' + snap.tasks.length + ' tareas, ' + snap.notes.length + ' notas, ' + snap.habits.length + ' hábitos y ' + snap.focus.length + ' bloques de enfoque.</span></div></div>' +
            '<div class="settings-row"><div class="txt"><strong>Exportar respaldo</strong><span>Descarga un archivo .json con todo. Úsalo para pasar tus datos a otro equipo.</span></div>' +
              '<button type="button" class="btn" data-export>' + icon('download') + 'Exportar</button></div>' +
            '<div class="settings-row"><div class="txt"><strong>Importar respaldo</strong><span>Reemplaza los datos actuales por los del archivo.</span></div>' +
              '<button type="button" class="btn" data-import>' + icon('upload') + 'Importar…</button><input type="file" id="import-file" accept=".json,application/json" hidden></div>' +
            '<div class="settings-row"><div class="txt"><strong>Restablecer</strong><span>Borra todo y vuelve a los datos iniciales.</span></div>' +
              '<button type="button" class="btn" data-reset style="color:var(--critical)">' + icon('trash') + 'Restablecer</button></div>' +
          '</section>' +

          '<section class="card" style="margin-top:16px"><h2 class="card-title">Instalar como app</h2>' +
            '<div class="settings-row"><div class="txt"><strong>En el móvil o el ordenador</strong><span>Cuando la web está publicada (por ejemplo en GitHub Pages), puedes instalarla: abre el menú del navegador y elige “Añadir a pantalla de inicio” o “Instalar app”. Funciona también sin conexión.</span></div>' +
              (installPrompt ? '<button type="button" class="btn btn-primary" data-install>' + icon('phone') + 'Instalar</button>' : '') + '</div>' +
          '</section>' +

          '<section class="card" style="margin-top:16px"><h2 class="card-title">Captura inteligente</h2>' +
            '<p class="card-sub">Al escribir una tarea, DataP entiende la fecha, la prioridad, el proyecto y la repetición, y los quita del título.</p>' +
            '<div class="shortcuts" style="margin-top:12px">' +
              '<span><code>hoy</code> · <code>mañana</code> · <code>pasado mañana</code></span><span>Fecha relativa</span>' +
              '<span><code>el viernes</code> · <code>el 15</code> · <code>15/12</code> · <code>24 de diciembre</code></span><span>Día concreto</span>' +
              '<span><code>en 3 días</code> · <code>la próxima semana</code> · <code>fin de semana</code></span><span>Más adelante</span>' +
              '<span><code>!alta</code> · <code>!media</code> · <code>!baja</code> (o <code>!!!</code>, <code>!!</code>)</span><span>Prioridad</span>' +
              '<span><code>#datap</code></span><span>Proyecto (id o parte del nombre)</span>' +
              '<span><code>cada día</code> · <code>cada lunes</code> · <code>entre semana</code> · <code>cada mes</code></span><span>Se repite al completarla</span>' +
            '</div>' +
          '</section>' +

          '<section class="card" style="margin-top:16px"><h2 class="card-title">Atajos de teclado</h2>' +
            '<div class="shortcuts" style="margin-top:12px">' +
              '<span><kbd class="kbd">' + mod + '</kbd> <kbd class="kbd">K</kbd></span><span>Buscar, ir a cualquier sitio o crear</span>' +
              '<span><kbd class="kbd">/</kbd></span><span>Abrir el buscador</span>' +
              '<span><kbd class="kbd">N</kbd></span><span>Nueva tarea</span>' +
              '<span><kbd class="kbd">Enter</kbd></span><span>En el tablero, abrir la tarea seleccionada</span>' +
              '<span><kbd class="kbd">Alt</kbd> <kbd class="kbd">←</kbd> <kbd class="kbd">→</kbd></span><span>En el tablero, mover la tarea de columna</span>' +
              '<span><kbd class="kbd">Esc</kbd></span><span>Cerrar diálogos y el menú</span>' +
            '</div>' +
          '</section>' +

          '<section class="card" style="margin-top:16px"><h2 class="card-title">Estructura del repositorio</h2>' +
            '<p class="card-sub">Cada página es un módulo en <code>docs/assets/js/modules/</code>. Para añadir uno, crea el archivo, llama a <code>DataP.registerModule({…})</code> y enlázalo en <code>index.html</code>. El README tiene el detalle.</p>' +
            '<div class="tree" style="margin-top:12px"><div class="tree-row"><span class="tree-name">' + icon('folder') + 'DataP/</span></div>' + treeHtml(REPO_TREE) + '</div>' +
          '</section>';
      }

      root.addEventListener('change', function (e) {
        if (e.target.name === 'theme') DataP.setTheme(e.target.value);
        if (e.target.id === 'import-file' && e.target.files[0]) {
          var file = e.target.files[0];
          e.target.value = '';
          file.text().then(function (text) {
            return UI.confirm({ title: 'Importar respaldo', message: 'Los datos actuales se reemplazarán por los de “' + file.name + '”.', confirmLabel: 'Importar' })
              .then(function (ok) {
                if (!ok) return;
                var r = S.importJSON(text);
                UI.toast('Importado: ' + r.projects + ' proyectos, ' + r.tasks + ' tareas, ' + r.notes + ' notas y ' + r.habits + ' hábitos');
              });
          }).catch(function (err) {
            UI.toast('No se pudo importar: ' + (err.message || 'archivo inválido'), { timeout: 6000 });
          });
        }
      });
      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-export]')) UI.exportBackup();
        else if (e.target.closest('[data-import]')) root.querySelector('#import-file').click();
        else if (e.target.closest('[data-reset]')) {
          UI.confirm({ title: 'Restablecer datos', message: 'Se borrarán todos tus proyectos, tareas, notas, hábitos y registros de enfoque de este navegador. Te recomendamos exportar un respaldo antes.', confirmLabel: 'Borrar y restablecer', danger: true })
            .then(function (ok) { if (ok) { S.reset(); UI.toast('Datos restablecidos'); } });
        } else if (e.target.closest('[data-install]') && installPrompt) {
          installPrompt.prompt();
          installPrompt = null;
        }
      });

      draw();
      return S.subscribe(draw);
    },
  });
})();
