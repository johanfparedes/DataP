/* ==========================================================================
   DataP · núcleo de la aplicación
   - Registro de módulos (cada página de la web es un módulo).
   - Enrutador por hash: #/<modulo> o #/<modulo>/<parámetro>.
   - Navegación lateral (con proyectos y contadores), tema y atajos.

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

  /** Formatea un número con decimales fijos (punto decimal, como el notebook). */
  function fmt(value, decimals) {
    if (value == null || !isFinite(value)) return '—';
    var d = decimals == null ? 2 : decimals;
    var out = Number(value).toFixed(d);
    if (/^-0(\.0+)?$/.test(out)) out = out.slice(1);
    return out.replace('-', '−');
  }

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
    board: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M9.2 4v16M14.8 4v16"/><path d="M5.6 8h1.6M11.2 8h1.6M16.8 8h1.6M5.6 11h1.6M11.2 11h1.6"/>',
    note: '<path d="M5.5 3.5h9l4 4v13h-13z"/><path d="M14.5 3.5v4h4M8.5 12h7M8.5 15.5h7M8.5 8.5h3"/>',
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
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.3 2.4 2.4 4.8-5"/>',
    circle: '<circle cx="12" cy="12" r="8.5"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4z"/>',
    pin: '<path d="M9 3.5h6l-1 6 3.5 3.5h-11L10 9.5z"/><path d="M12 13v7.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    inbox: '<path d="M3.5 13.5 6 5h12l2.5 8.5V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3.5 13.5H9l1 2.5h4l1-2.5h5.5"/>',
    spark: '<path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2z"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    repeat: '<path d="M17 3.5 20 6.5l-3 3"/><path d="M4 12v-1.5a4 4 0 0 1 4-4h12"/><path d="M7 20.5 4 17.5l3-3"/><path d="M20 12v1.5a4 4 0 0 1-4 4H4"/>',
    flame: '<path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4.5-4-6.5-4.5-11-2.5 1.5-4 4-4 6.5-1-.5-2-1.8-2.2-3C6.2 9 5.5 11.5 5.5 14.5A6.5 6.5 0 0 0 12 21z"/><path d="M12 21a2.8 2.8 0 0 1-2.8-2.8c0-2 2.8-3.7 2.8-5.2 0 1.5 2.8 3.2 2.8 5.2A2.8 2.8 0 0 1 12 21z"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5M19 6.5l1.5-1.5"/>',
    play: '<path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l10.8-6.8a.8.8 0 0 0 0-1.4L8.7 4.5a.8.8 0 0 0-1.2.7z"/>',
    pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1"/><rect x="13.9" y="5" width="3.6" height="14" rx="1"/>',
    skip: '<path d="M5.5 5.5v13l9-6.5z"/><path d="M18.5 5.5v13"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v4h4"/>',
    'chev-left': '<path d="m14.5 6-6 6 6 6"/>',
    'chev-right': '<path d="m9.5 6 6 6-6 6"/>',
    'list-check': '<path d="m3.5 6.5 1.8 1.8 3-3.3M3.5 15.5l1.8 1.8 3-3.3"/><path d="M11.5 7h9M11.5 16h9"/>',
  };

  function icon(name) {
    var body = ICONS[name] || ICONS.grid;
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

  /**
   * Registra un módulo (una página).
   *   id        identificador y ruta (#/id)
   *   title     título de la página
   *   navLabel  texto en el menú (por defecto, title)
   *   section   'General' | 'Herramientas' (los proyectos se listan solos)
   *   nav       false para no mostrarlo en el menú
   *   icon      nombre de icono de DataP.util.icon
   *   order     orden dentro del grupo
   *   summary   descripción corta (tarjetas y buscador)
   *   keywords  palabras extra para el buscador
   *   badge()   número opcional junto al enlace del menú
   *   params    true si #/id/<param> identifica contenido (se vuelve a dibujar)
   *   project   id de proyecto al que pertenece (resalta su enlace en el menú)
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
     Tema claro / oscuro / sistema
     ------------------------------------------------------------------------ */
  var THEME_KEY = 'datap-theme';
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function themePreference() {
    var t = document.documentElement.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  }

  function effectiveTheme() {
    var p = themePreference();
    if (p !== 'system') return p;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }

  function setTheme(pref) {
    if (pref === 'light' || pref === 'dark') document.documentElement.setAttribute('data-theme', pref);
    else document.documentElement.removeAttribute('data-theme');
    try {
      if (pref === 'light' || pref === 'dark') localStorage.setItem(THEME_KEY, pref);
      else localStorage.removeItem(THEME_KEY);
    } catch (e) { /* almacenamiento no disponible */ }
    updateThemeButton();
  }

  DataP.setTheme = setTheme;
  DataP.themePreference = themePreference;
  DataP.toggleTheme = function () { setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark'); };

  function updateThemeButton() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var dark = effectiveTheme() === 'dark';
    btn.innerHTML = icon(dark ? 'sun' : 'moon');
    btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    btn.title = dark ? 'Modo claro' : 'Modo oscuro';
  }

  /* ------------------------------------------------------------------------
     Navegación
     ------------------------------------------------------------------------ */
  function navLink(href, route, sub, iconHtml, text, badge) {
    return '<li><a class="nav-link" href="' + href + '" title="' + esc(text) + '" data-route="' + esc(route) + '"' + (sub ? ' data-sub="' + esc(sub) + '"' : '') + '>' +
      iconHtml + '<span class="nav-text">' + esc(text) + '</span>' +
      (badge ? '<span class="nav-badge">' + esc(badge) + '</span>' : '') + '</a></li>';
  }

  function moduleLinks(section) {
    return DataP.getModules(section).filter(function (m) { return m.nav !== false; }).map(function (m) {
      var b = typeof m.badge === 'function' ? m.badge() : null;
      return navLink('#/' + m.id, m.id, null, icon(m.icon || 'grid'), m.navLabel || m.title, b);
    }).join('');
  }

  function buildNav() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var S = DataP.store;
    var html = '<div class="nav-group"><ul class="nav-list">' + moduleLinks('General') + '</ul></div>';

    if (S) {
      var projects = S.projects();
      html += '<div class="nav-group"><div class="nav-group-label"><a href="#/proyectos" class="nav-group-link" data-route="proyectos">Proyectos</a>' +
        '<button type="button" class="nav-add" data-action="new-project" aria-label="Nuevo proyecto" title="Nuevo proyecto">' + icon('plus') + '</button></div><ul class="nav-list">';
      html += projects.map(function (p) {
        var open = S.projectProgress(p.id).open;
        return navLink('#/proyectos/' + encodeURIComponent(p.id), 'proyectos', p.id,
          '<span class="nav-dot pc-' + p.color + '"><span class="pdot"></span></span>', p.name, open || null);
      }).join('');
      if (!projects.length) html += '<li><span class="nav-empty">Aún no hay proyectos</span></li>';
      html += '</ul></div>';
    }

    var tools = moduleLinks('Herramientas');
    if (tools) html += '<div class="nav-group"><div class="nav-group-label">Herramientas</div><ul class="nav-list">' + tools + '</ul></div>';
    nav.innerHTML = html;
    setActiveNav();
  }

  function setActiveNav() {
    var r = parseHash();
    var mod = findModule(r.id);
    var route = mod ? mod.id : 'inicio';
    var sub = r.sub;
    if (mod && mod.project) { route = 'proyectos'; sub = mod.project; }
    var links = document.querySelectorAll('.nav-link[data-route]');
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      var match = l.getAttribute('data-route') === route &&
        (l.getAttribute('data-sub') || null) === (l.hasAttribute('data-sub') ? sub : null);
      if (match) l.setAttribute('aria-current', 'page');
      else l.removeAttribute('aria-current');
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
    if (!sidebar || !sidebar.classList.contains('is-open')) return;
    sidebar.classList.remove('is-open');
    scrim.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  /* ------------------------------------------------------------------------
     Enrutador
     ------------------------------------------------------------------------ */
  var view;
  var current = { id: null, sub: null };
  var cleanup = null;

  function parseHash() {
    var m = location.hash.match(/^#\/([\w-]+)(?:\/([^/?#]+))?/);
    var sub = null;
    if (m && m[2]) {
      try { sub = decodeURIComponent(m[2]); } catch (e) { sub = m[2]; }
    }
    return { id: m ? m[1] : null, sub: sub };
  }

  function findModule(id) {
    return modules.filter(function (m) { return m.id === id; })[0] || null;
  }

  function scrollToSub(sub) {
    if (!sub) return;
    var target = document.getElementById(sub);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function route() {
    // Los anclajes que no empiezan con "#/" (p. ej. "saltar al contenido") no cambian de página.
    if (location.hash && location.hash.indexOf('#/') !== 0) return;

    var r = parseHash();
    var mod = findModule(r.id) || findModule('inicio') || DataP.getModules()[0];

    closeDrawer();

    // Misma página y la ruta es una sección: solo desplazarse.
    if (mod.id === current.id && !mod.params) {
      scrollToSub(r.sub);
      setActiveNav();
      return;
    }
    if (mod.id === current.id && mod.params && r.sub === current.sub) return;

    if (typeof cleanup === 'function') {
      try { cleanup(); } catch (e) { console.error(e); }
    }
    cleanup = null;
    if (DataP.lib.charts) DataP.lib.charts.disposeAll();

    var samePage = mod.id === current.id;
    view.innerHTML = '';
    current = { id: mod.id, sub: r.sub };
    setActiveNav();
    document.title = mod.id === 'inicio' ? 'DataP' : (mod.title + ' · DataP');

    try {
      var result = mod.render(view, { sub: r.sub, navigate: navigate });
      if (typeof result === 'function') cleanup = result;
    } catch (err) {
      console.error(err);
      view.innerHTML = '<div class="callout callout-warn">' + icon('alert') +
        '<div><strong>No se pudo mostrar esta página.</strong> ' + esc(err.message) + '</div></div>';
    }

    if (!samePage) {
      window.scrollTo(0, 0);
      view.focus({ preventScroll: true });
    }
    if (r.sub && !mod.params) requestAnimationFrame(function () { scrollToSub(r.sub); });
  }

  function navigate(id, sub) {
    var hash = '#/' + id + (sub ? '/' + encodeURIComponent(sub) : '');
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  DataP.navigate = navigate;

  /**
   * Cambia el parámetro de la ruta actual (#/modulo/<sub>) sin volver a dibujar
   * la página. Útil cuando el módulo ya muestra ese contenido.
   */
  DataP.setSub = function (sub) {
    var hash = '#/' + current.id + (sub ? '/' + encodeURIComponent(sub) : '');
    if (location.hash !== hash) history.pushState(null, '', hash);
    current.sub = sub || null;
    setActiveNav();
  };
  DataP.setTitle = function (title) { document.title = title ? title + ' · DataP' : 'DataP'; };

  /* ------------------------------------------------------------------------
     Arranque
     ------------------------------------------------------------------------ */
  function isTyping(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function boot() {
    view = document.getElementById('view');
    sidebar = document.getElementById('sidebar');
    scrim = document.getElementById('scrim');
    menuBtn = document.getElementById('menu-btn');

    var marks = document.querySelectorAll('[data-icon]');
    for (var i = 0; i < marks.length; i++) marks[i].innerHTML = icon(marks[i].getAttribute('data-icon'));

    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    var kbds = document.querySelectorAll('[data-kbd-mod]');
    for (var k = 0; k < kbds.length; k++) kbds[k].textContent = mac ? '⌘K' : 'Ctrl K';

    var repoLink = document.getElementById('repo-link');
    if (repoLink) repoLink.href = DataP.config.repoUrl;

    buildNav();
    updateThemeButton();

    document.getElementById('theme-toggle').addEventListener('click', DataP.toggleTheme);
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', updateThemeButton);

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action]');
      if (!t) return;
      var a = t.getAttribute('data-action');
      if (a === 'search') { e.preventDefault(); closeDrawer(); DataP.ui.openPalette(); }
      else if (a === 'new-project') { e.preventDefault(); closeDrawer(); DataP.ui.projectDialog(null); }
      else if (a === 'new-task' && !t.closest('#view')) { e.preventDefault(); closeDrawer(); DataP.ui.taskDialog(null); }
    });

    menuBtn.addEventListener('click', function () {
      if (sidebar.classList.contains('is-open')) closeDrawer();
      else openDrawer();
    });
    scrim.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        DataP.ui.openPalette();
        return;
      }
      if (e.key === '/' && !isTyping(document.activeElement) && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        DataP.ui.openPalette();
        return;
      }
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(document.activeElement) && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        DataP.ui.taskDialog(null);
        return;
      }
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        closeDrawer();
        menuBtn.focus();
      }
    });

    if (DataP.store) {
      DataP.store.subscribe(buildNav);
      if (!DataP.store.isPersistent()) {
        setTimeout(function () {
          DataP.ui.toast('Este navegador no permite guardar datos: los cambios se perderán al cerrar la pestaña.', { timeout: 8000 });
        }, 600);
      }
    }

    window.addEventListener('hashchange', route);
    route();

    // App instalable y uso sin conexión (solo cuando se sirve por http/https).
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function (err) { console.warn('Service worker:', err); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
