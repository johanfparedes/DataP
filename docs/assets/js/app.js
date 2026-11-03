/* ==========================================================================
   DataP · núcleo de la aplicación
   - Registro de módulos (cada sección de la web es un módulo).
   - Enrutador por hash: #/<modulo> o #/<modulo>/<seccion>.
   - Navegación lateral, tema claro/oscuro y utilidades compartidas.

   Se usan scripts clásicos (sin "type=module") para que la web funcione
   también abriendo index.html directamente desde el disco (file://).
   ========================================================================== */
(function () {
  'use strict';

  var DataP = (window.DataP = window.DataP || {});
  DataP.lib = DataP.lib || {};
  DataP.data = DataP.data || {};

  DataP.config = {
    repoUrl: 'https://github.com/johanfparedes/DataP',
    colabBase: 'https://colab.research.google.com/github/johanfparedes/DataP/blob/main/',
  };

  /* ------------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------------ */

  /** Escapa texto para insertarlo de forma segura en plantillas HTML/SVG. */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Formatea un número con un número fijo de decimales (punto decimal, como el notebook). */
  function fmt(value, decimals) {
    if (value == null || !isFinite(value)) return '—';
    var d = decimals == null ? 2 : decimals;
    var out = Number(value).toFixed(d);
    if (/^-0(\.0+)?$/.test(out)) out = out.slice(1);
    return out.replace('-', '−');
  }

  /** Porcentaje con símbolo. */
  function pct(value, decimals) {
    return fmt(value, decimals == null ? 1 : decimals) + '%';
  }

  /** Convierte un nombre de columna en una etiqueta legible. */
  function prettyLabel(name) {
    return String(name).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Iconos SVG de trazo (24×24). */
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    scatter: '<path d="M4 4v16h16"/><circle cx="9" cy="14" r="1.6"/><circle cx="13" cy="10" r="1.6"/><circle cx="17" cy="7" r="1.6"/><circle cx="15.5" cy="14.5" r="1.6"/>',
    flask: '<path d="M9.5 3h5"/><path d="M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.5 14.5h9"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    code: '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5l-3 14"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    file: '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10z"/><path d="M14 3.5v5h5"/>',
    notebook: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5v17M12 8h4M12 11.5h4"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17h.01"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  };

  function icon(name) {
    var body = ICONS[name] || '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  /** Descarga un texto como archivo (funciona también en file://). */
  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  DataP.util = { esc: esc, fmt: fmt, pct: pct, prettyLabel: prettyLabel, icon: icon, downloadText: downloadText };

  /* ------------------------------------------------------------------------
     Registro de módulos
     ------------------------------------------------------------------------ */
  var modules = [];
  var SECTIONS = ['General', 'Proyectos', 'Herramientas'];

  /**
   * Registra un módulo de la web.
   * @param {Object} mod
   *   id        identificador y ruta (#/id)
   *   title     título de la página
   *   navLabel  texto en el menú (por defecto, title)
   *   section   grupo del menú: 'General' | 'Proyectos' | 'Herramientas'
   *   icon      nombre de icono de DataP.util.icon
   *   order     orden dentro del grupo
   *   summary   descripción corta (se usa en las tarjetas de Inicio)
   *   status    texto de estado opcional (p. ej. 'Completado')
   *   render(container, ctx)  dibuja la página; puede devolver una función de limpieza
   */
  DataP.registerModule = function (mod) {
    if (!mod || !mod.id || typeof mod.render !== 'function') {
      throw new Error('Módulo inválido: necesita id y render()');
    }
    modules.push(mod);
  };

  DataP.getModules = function (section) {
    return modules
      .filter(function (m) { return !section || m.section === section; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  };

  /* ------------------------------------------------------------------------
     Tema claro / oscuro
     ------------------------------------------------------------------------ */
  var THEME_KEY = 'datap-theme';
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function effectiveTheme() {
    var forced = document.documentElement.getAttribute('data-theme');
    if (forced === 'light' || forced === 'dark') return forced;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* almacenamiento no disponible */ }
    updateThemeButton();
  }

  function updateThemeButton() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var dark = effectiveTheme() === 'dark';
    btn.innerHTML = icon(dark ? 'sun' : 'moon') + '<span>' + (dark ? 'Modo claro' : 'Modo oscuro') + '</span>';
    btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }

  /* ------------------------------------------------------------------------
     Navegación
     ------------------------------------------------------------------------ */
  function buildNav() {
    var nav = document.getElementById('nav');
    var html = '';
    SECTIONS.forEach(function (section) {
      var items = DataP.getModules(section).filter(function (m) { return m.nav !== false; });
      if (!items.length) return;
      html += '<div class="nav-group"><div class="nav-group-label">' + esc(section) + '</div><ul class="nav-list">';
      items.forEach(function (m) {
        html += '<li><a class="nav-link" href="#/' + esc(m.id) + '" data-route="' + esc(m.id) + '">' +
          icon(m.icon || 'grid') + '<span>' + esc(m.navLabel || m.title) + '</span></a></li>';
      });
      html += '</ul></div>';
    });
    nav.innerHTML = html;
  }

  function setActiveNav(id) {
    var links = document.querySelectorAll('.nav-link[data-route]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('data-route') === id) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }

  var sidebar, scrim, menuBtn;

  function openDrawer() {
    sidebar.classList.add('is-open');
    scrim.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    var first = sidebar.querySelector('.nav-link');
    if (first) first.focus();
  }

  function closeDrawer() {
    if (!sidebar.classList.contains('is-open')) return;
    sidebar.classList.remove('is-open');
    scrim.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  /* ------------------------------------------------------------------------
     Enrutador
     ------------------------------------------------------------------------ */
  var view;
  var currentId = null;
  var cleanup = null;

  function parseHash() {
    var m = location.hash.match(/^#\/([\w-]+)(?:\/([\w-]+))?/);
    return { id: m ? m[1] : null, sub: m ? m[2] || null : null };
  }

  function scrollToSub(sub) {
    if (!sub) return;
    var target = document.getElementById(sub);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function route() {
    // Los anclajes que no empiezan con "#/" (p. ej. el enlace "saltar al contenido") no cambian de página.
    if (location.hash && location.hash.indexOf('#/') !== 0) return;

    var r = parseHash();
    var mod = modules.filter(function (m) { return m.id === r.id; })[0];
    if (!mod) {
      mod = modules.filter(function (m) { return m.id === 'inicio'; })[0] || DataP.getModules()[0];
    }

    closeDrawer();

    // Misma página, distinta sección: solo desplazarse.
    if (mod.id === currentId) {
      scrollToSub(r.sub);
      return;
    }

    if (typeof cleanup === 'function') {
      try { cleanup(); } catch (e) { console.error(e); }
    }
    cleanup = null;
    if (DataP.lib.charts) DataP.lib.charts.disposeAll();

    view.innerHTML = '';
    currentId = mod.id;
    setActiveNav(mod.id);
    document.title = mod.id === 'inicio' ? 'DataP' : mod.title + ' · DataP';

    try {
      var result = mod.render(view, { sub: r.sub, navigate: navigate });
      if (typeof result === 'function') cleanup = result;
    } catch (err) {
      console.error(err);
      view.innerHTML = '<div class="callout callout-warn">' + icon('alert') +
        '<div><strong>No se pudo mostrar esta página.</strong> ' + esc(err.message) + '</div></div>';
    }

    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
    if (r.sub) requestAnimationFrame(function () { scrollToSub(r.sub); });
  }

  function navigate(id, sub) {
    var hash = '#/' + id + (sub ? '/' + sub : '');
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  DataP.navigate = navigate;

  /* ------------------------------------------------------------------------
     Arranque
     ------------------------------------------------------------------------ */
  function boot() {
    view = document.getElementById('view');
    sidebar = document.getElementById('sidebar');
    scrim = document.getElementById('scrim');
    menuBtn = document.getElementById('menu-btn');

    // Iconos estáticos del marco
    var marks = document.querySelectorAll('[data-icon]');
    for (var i = 0; i < marks.length; i++) marks[i].innerHTML = icon(marks[i].getAttribute('data-icon'));

    var repoLink = document.getElementById('repo-link');
    if (repoLink) {
      repoLink.href = DataP.config.repoUrl;
      repoLink.innerHTML = icon('code') + '<span>Ver en GitHub</span>';
    }

    buildNav();
    updateThemeButton();

    document.getElementById('theme-toggle').addEventListener('click', function () {
      setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
    });
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', updateThemeButton);

    menuBtn.addEventListener('click', function () {
      if (sidebar.classList.contains('is-open')) closeDrawer();
      else openDrawer();
    });
    scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        closeDrawer();
        menuBtn.focus();
      }
    });

    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
