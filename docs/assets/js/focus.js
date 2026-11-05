/* ==========================================================================
   DataP · temporizador de enfoque (técnica Pomodoro)
   - Sigue contando aunque cambies de página o cierres la pestaña: guarda la
     hora de fin, no los segundos restantes.
   - Al terminar un bloque de enfoque lo registra en el espacio de trabajo
     (DataP.store.addFocus) y avisa con sonido, aviso y notificación.
   - Muestra el tiempo restante en el menú y en el título de la pestaña.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'datap-focus';
  var S = DataP.store;
  var listeners = [];
  var ticker = null;
  var audio = null;

  var MODES = {
    focus: { label: 'Enfoque', short: 'Enfoque' },
    short: { label: 'Descanso corto', short: 'Descanso' },
    long: { label: 'Descanso largo', short: 'Descanso' },
  };

  var data = {
    settings: { focus: 25, short: 5, long: 15, rounds: 4, notify: false },
    timer: { mode: 'focus', running: false, endAt: 0, remaining: 25 * 60000, duration: 25 * 60000, taskId: '', startedAt: '', round: 1 },
  };

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d && d.settings) Object.assign(data.settings, d.settings);
      if (d && d.timer) Object.assign(data.timer, d.timer);
    } catch (e) { /* sin almacenamiento */ }
  }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* sin almacenamiento */ }
  }

  function minutesFor(mode) { return data.settings[mode] || 25; }

  function remaining() {
    var t = data.timer;
    return t.running ? Math.max(0, t.endAt - Date.now()) : t.remaining;
  }

  function state() {
    var t = data.timer;
    return {
      mode: t.mode,
      modeLabel: MODES[t.mode].label,
      running: t.running,
      paused: !t.running && t.remaining < t.duration,
      remaining: remaining(),
      duration: t.duration,
      taskId: t.taskId,
      round: t.round,
      rounds: data.settings.rounds,
      settings: Object.assign({}, data.settings),
    };
  }

  function clock(ms) {
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);
    return (m < 10 ? '0' : '') + m + ':' + ((s % 60) < 10 ? '0' : '') + (s % 60);
  }

  function emit() {
    var st = state();
    listeners.slice().forEach(function (fn) { try { fn(st); } catch (e) { console.error(e); } });
    paintChrome(st);
  }

  /* ---------- Menú lateral y título de la pestaña ---------- */
  var TITLE_RE = /^(\d{1,3}:\d{2}|❚❚ \d{1,3}:\d{2}) · /;
  function paintChrome(st) {
    var active = st.running || st.paused;
    var pills = document.querySelectorAll('[data-focus-pill]');
    for (var i = 0; i < pills.length; i++) {
      var p = pills[i];
      p.hidden = !active;
      if (!active) continue;
      p.classList.toggle('is-break', st.mode !== 'focus');
      p.classList.toggle('is-paused', !st.running);
      var txt = p.querySelector('[data-focus-time]');
      if (txt) txt.textContent = clock(st.remaining);
      p.setAttribute('aria-label', st.modeLabel + ': quedan ' + clock(st.remaining) + (st.running ? '' : ' (en pausa)'));
    }
    var base = document.title.replace(TITLE_RE, '');
    document.title = st.running ? clock(st.remaining) + ' · ' + base : base;
  }

  /* ---------- Sonido y avisos ---------- */
  function unlockAudio() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audio) audio = new Ctx();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
  }

  function chime() {
    if (!audio) return;
    try {
      var now = audio.currentTime;
      [0, 0.22, 0.44].forEach(function (offset, i) {
        var o = audio.createOscillator();
        var g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = [660, 880, 990][i];
        g.gain.setValueAtTime(0.0001, now + offset);
        g.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);
        o.connect(g); g.connect(audio.destination);
        o.start(now + offset); o.stop(now + offset + 0.4);
      });
    } catch (e) { /* sin sonido */ }
  }

  function notify(title, body) {
    if (!data.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(title, { body: body, icon: 'assets/icons/icon-192.png', tag: 'datap-focus' }); });
      } else {
        new Notification(title, { body: body, icon: 'assets/icons/icon-192.png', tag: 'datap-focus' });
      }
    } catch (e) { /* sin notificaciones */ }
  }

  /* ---------- Ciclo ---------- */
  function setMode(mode, keepTask) {
    var ms = minutesFor(mode) * 60000;
    data.timer.mode = mode;
    data.timer.running = false;
    data.timer.endAt = 0;
    data.timer.duration = ms;
    data.timer.remaining = ms;
    data.timer.startedAt = '';
    if (!keepTask) data.timer.taskId = '';
  }

  function finish(silent) {
    // Otra pestaña pudo terminarlo ya: se relee antes de registrar.
    var mine = data.timer.endAt;
    read();
    if (!data.timer.running || data.timer.endAt !== mine) { emit(); schedule(); return; }

    var t = data.timer;
    var endedAt = new Date(t.endAt).toISOString();
    var wasFocus = t.mode === 'focus';
    var minutes = Math.round(t.duration / 60000);
    var taskId = t.taskId;
    var startedAt = t.startedAt;
    var next;
    if (wasFocus) {
      next = t.round % data.settings.rounds === 0 ? 'long' : 'short';
    } else {
      next = 'focus';
      t.round = t.mode === 'long' ? 1 : t.round + 1;
    }
    setMode(next, true);
    write();

    if (wasFocus) {
      S.addFocus({ taskId: taskId, minutes: minutes, startedAt: startedAt || new Date(Date.parse(endedAt) - minutes * 60000).toISOString(), endedAt: endedAt });
    }
    if (!silent) {
      chime();
      var task = taskId ? S.task(taskId) : null;
      var msg = wasFocus
        ? 'Bloque de ' + minutes + ' min completado' + (task ? ' en «' + task.title + '»' : '') + '. Toca descansar.'
        : 'Descanso terminado. ¿Otro bloque de enfoque?';
      notify(wasFocus ? 'Enfoque completado' : 'Fin del descanso', msg);
      if (DataP.ui) {
        DataP.ui.toast(msg, { timeout: 10000, action: { label: wasFocus ? 'Empezar descanso' : 'Empezar enfoque', run: function () { api.resume(); } } });
      }
    }
    emit();
    schedule();
  }

  function tick() {
    if (data.timer.running && Date.now() >= data.timer.endAt) finish(false);
    else emit();
  }

  function schedule() {
    clearInterval(ticker);
    ticker = null;
    if (data.timer.running) ticker = setInterval(tick, 1000);
  }

  var api = {
    MODES: MODES,
    clock: clock,
    state: state,
    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    },
    /** Empieza un bloque nuevo (por defecto de enfoque) y opcionalmente lo asocia a una tarea. */
    start: function (opts) {
      opts = opts || {};
      unlockAudio();
      var mode = opts.mode || 'focus';
      setMode(mode, true);
      if (opts.taskId !== undefined) data.timer.taskId = opts.taskId || '';
      if (opts.minutes) { data.timer.duration = opts.minutes * 60000; data.timer.remaining = data.timer.duration; }
      api.resume();
    },
    resume: function () {
      unlockAudio();
      var t = data.timer;
      if (t.running) return;
      t.running = true;
      t.endAt = Date.now() + t.remaining;
      if (!t.startedAt) t.startedAt = new Date().toISOString();
      write(); emit(); schedule();
    },
    pause: function () {
      var t = data.timer;
      if (!t.running) return;
      t.remaining = Math.max(0, t.endAt - Date.now());
      t.running = false;
      t.endAt = 0;
      write(); emit(); schedule();
    },
    toggle: function () { if (data.timer.running) api.pause(); else api.resume(); },
    /** Vuelve al inicio del bloque actual sin registrarlo. */
    reset: function () {
      setMode(data.timer.mode, true);
      write(); emit(); schedule();
    },
    /** Termina el bloque ya: si era de enfoque, registra los minutos hechos. */
    skip: function () {
      var t = data.timer;
      var done = t.duration - remaining();
      if (t.mode === 'focus' && done >= 60000) {
        S.addFocus({ taskId: t.taskId, minutes: Math.round(done / 60000), startedAt: t.startedAt || new Date(Date.now() - done).toISOString(), endedAt: new Date().toISOString() });
      }
      var next = t.mode === 'focus' ? (t.round % data.settings.rounds === 0 ? 'long' : 'short') : 'focus';
      if (t.mode !== 'focus') t.round = t.mode === 'long' ? 1 : t.round + 1;
      setMode(next, true);
      write(); emit(); schedule();
    },
    setMode: function (mode) {
      if (!MODES[mode]) return;
      setMode(mode, true);
      write(); emit(); schedule();
    },
    setTask: function (id) {
      data.timer.taskId = id || '';
      write(); emit();
    },
    setMinutes: function (mode, min) {
      data.settings[mode] = min;
      if (data.timer.mode === mode && !data.timer.running && data.timer.remaining === data.timer.duration) setMode(mode, true);
      write(); emit();
    },
    setNotify: function (on) {
      if (!on) { data.settings.notify = false; write(); emit(); return Promise.resolve(false); }
      if (!('Notification' in window)) return Promise.resolve(false);
      return Promise.resolve(Notification.permission === 'granted' ? 'granted' : Notification.requestPermission()).then(function (perm) {
        data.settings.notify = perm === 'granted';
        write(); emit();
        return data.settings.notify;
      });
    },
  };

  DataP.focus = api;

  read();
  // Si terminó mientras la pestaña estaba cerrada, se registra sin sonar.
  if (data.timer.running && Date.now() >= data.timer.endAt) {
    setTimeout(function () { finish(true); }, 0);
  } else {
    schedule();
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    read();
    emit();
    schedule();
  });
  document.addEventListener('DOMContentLoaded', function () { paintChrome(state()); });
  setTimeout(function () { paintChrome(state()); }, 0);
})();
