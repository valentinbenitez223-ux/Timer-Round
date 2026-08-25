(() => {
  'use strict';

  const STORAGE_KEY = 'timer-round:v4';
  const CIRCUMFERENCE = 2 * Math.PI * 120;
  const app = document.getElementById('app');
  const feedbackTimers = new Set();
  const activeOscillators = new Set();
  let animationFrame = 0;
  let wakeLock = null;
  let audioContext = null;
  let toastTimer = 0;

  const defaults = {
    activeMode: 'random',
    settings: {
      random: { minutes: 1, alerts: 10 },
      tabata: { work: 20, rest: 10, rounds: 8 },
      focus: { minutes: 5, seconds: 0 }
    },
    preferences: { sound: true, voice: true, vibration: true, preparation: true, volume: 70 },
    history: []
  };

  const state = {
    ...loadStoredData(),
    ui: { settingsOpen: false, historyOpen: false, installAvailable: false },
    session: null
  };
  state.session = createIdleSession();

  function number(value, min, max, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
  }

  function loadStoredData() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && typeof raw === 'object') return sanitizeStoredData(raw);

      const oldHistory = JSON.parse(localStorage.getItem('timer_history') || '[]');
      return sanitizeStoredData({ history: Array.isArray(oldHistory) ? oldHistory.map(migrateHistoryItem) : [] });
    } catch (_) {
      return sanitizeStoredData({});
    }
  }

  function migrateHistoryItem(item) {
    const modes = { RND: 'random', TABATA: 'tabata', BASIC: 'focus' };
    return {
      id: String((item && item.id) || `${Date.now()}-${Math.random()}`),
      completedAt: (item && item.date) || new Date().toISOString(),
      mode: modes[item && item.mode] || 'focus',
      durationMs: number(item && item.totalTimeMs, 1000, 86400000, 60000),
      rounds: number(item && item.rounds, 1, 60, 1)
    };
  }

  function sanitizeStoredData(raw) {
    const random = (raw.settings && raw.settings.random) || {};
    const tabata = (raw.settings && raw.settings.tabata) || {};
    const focus = (raw.settings && raw.settings.focus) || {};
    const prefs = raw.preferences || {};
    const validModes = ['random', 'tabata', 'focus'];
    const history = Array.isArray(raw.history) ? raw.history.slice(0, 80).map(item => ({
      id: String((item && item.id) || `${Date.now()}-${Math.random()}`),
      completedAt: new Date((item && item.completedAt) || (item && item.date) || Date.now()).toISOString(),
      mode: validModes.includes(item && item.mode) ? item.mode : 'focus',
      durationMs: number((item && item.durationMs) || (item && item.totalTimeMs), 1000, 86400000, 60000),
      rounds: number(item && item.rounds, 1, 60, 1)
    })).filter(item => !Number.isNaN(new Date(item.completedAt).valueOf())) : [];

    return {
      activeMode: validModes.includes(raw.activeMode) ? raw.activeMode : defaults.activeMode,
      settings: {
        random: {
          minutes: number(random.minutes !== undefined ? random.minutes : raw.timer_rnd_min, 1, 120, defaults.settings.random.minutes),
          alerts: number(random.alerts !== undefined ? random.alerts : raw.timer_rnd_alerts, 1, 60, defaults.settings.random.alerts)
        },
        tabata: {
          work: number(tabata.work !== undefined ? tabata.work : raw.timer_tabata_work, 1, 600, defaults.settings.tabata.work),
          rest: number(tabata.rest !== undefined ? tabata.rest : raw.timer_tabata_rest, 0, 600, defaults.settings.tabata.rest),
          rounds: number(tabata.rounds !== undefined ? tabata.rounds : raw.timer_tabata_rounds, 1, 60, defaults.settings.tabata.rounds)
        },
        focus: {
          minutes: number(focus.minutes !== undefined ? focus.minutes : raw.timer_basic_min, 0, 99, defaults.settings.focus.minutes),
          seconds: number(focus.seconds !== undefined ? focus.seconds : raw.timer_basic_sec, 0, 59, defaults.settings.focus.seconds)
        }
      },
      preferences: {
        sound: prefs.sound !== undefined ? prefs.sound : defaults.preferences.sound,
        voice: prefs.voice !== undefined ? prefs.voice : defaults.preferences.voice,
        vibration: prefs.vibration !== undefined ? prefs.vibration : defaults.preferences.vibration,
        preparation: prefs.preparation !== undefined ? prefs.preparation : defaults.preferences.preparation,
        volume: number(prefs.volume, 0, 100, defaults.preferences.volume)
      },
      history
    };
  }

  function persist() {
    try {
      const { activeMode, settings, preferences, history } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeMode, settings, preferences, history }));
    } catch (_) {
      showToast('No se pudieron guardar los cambios en este navegador.', 'warning');
    }
  }

  function getPlan(mode = state.activeMode) {
    const { random, tabata, focus } = state.settings;
    if (mode === 'tabata') {
      const durationMs = (tabata.work * tabata.rounds + tabata.rest * Math.max(0, tabata.rounds - 1)) * 1000;
      return { mode, durationMs, workMs: tabata.work * 1000, restMs: tabata.rest * 1000, rounds: tabata.rounds, alerts: 0 };
    }
    if (mode === 'focus') {
      const durationMs = (focus.minutes * 60 + focus.seconds) * 1000;
      return { mode, durationMs, rounds: 1, alerts: 0 };
    }
    return { mode: 'random', durationMs: random.minutes * 60000, rounds: 1, alerts: random.alerts };
  }

  function createIdleSession() {
    const plan = getPlan();
    return {
      running: false,
      paused: false,
      phase: 'idle',
      plan,
      round: 1,
      durationMs: plan.durationMs,
      remainingMs: plan.durationMs,
      phaseStartedAt: 0,
      endAt: 0,
      startedAt: 0,
      alertsFired: 0,
      alertSchedule: [],
      alertIndex: 0,
      cueFlags: {},
      completed: false
    };
  }

  function formatTime(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }

  function formatDuration(milliseconds) {
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return minutes ? `${minutes} min${rest ? ` ${rest} s` : ''}` : `${rest} s`;
  }

  function modeLabel(mode) {
    return ({ random: 'Round aleatorio', tabata: 'Tabata', focus: 'Cuenta regresiva' })[mode];
  }

  function icon(name) {
    const paths = {
      clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
      play: '<path d="m8.5 5 9 7-9 7z" fill="currentColor" stroke="none"/>',
      pause: '<path d="M8 5.5v13M16 5.5v13"/>',
      reset: '<path d="M4.5 11a7.5 7.5 0 1 1 1.7 5.1"/><path d="M4.5 5.5V11H10"/>',
      history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.1-5.2"/><path d="M4.5 5.5V11H10"/><path d="M12 8v4l2.8 1.8"/>',
      fullscreen: '<path d="M8.5 4.5h-4v4M15.5 4.5h4v4M19.5 15.5v4h-4M4.5 15.5v4h4"/>',
      install: '<path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 20h14"/>',
      volume: '<path d="M4 10h4l4-3.5v11L8 14H4z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/>',
      close: '<path d="m7 7 10 10M17 7 7 17"/>',
      check: '<path d="m5 12 4.2 4.2L19 6.5"/>',
      info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function getPhaseCopy(session = state.session) {
    if (session.phase === 'prep') return { label: 'Prepárate', detail: 'El round empieza en un instante.' };
    if (session.phase === 'rest') return { label: 'Descanso', detail: `Recuperá aire · sigue la ronda ${session.round + 1}.` };
    if (session.phase === 'finished') return { label: 'Sesión completada', detail: 'Excelente trabajo. Tu sesión quedó guardada.' };
    if (session.paused) return { label: 'Pausado', detail: 'El tiempo quedó exactamente donde lo dejaste.' };
    if (session.phase === 'work') return { label: session.plan.mode === 'tabata' ? 'Trabajo' : 'En marcha', detail: 'Mantené el ritmo y seguí las señales.' };
    return { label: 'Listo para empezar', detail: modeLabel(state.activeMode) };
  }

  function displayValue(session = state.session) {
    if (session.phase === 'prep') return String(Math.max(1, Math.ceil(session.remainingMs / 1000)));
    return formatTime(session.remainingMs);
  }

  function progressFor(session = state.session) {
    if (session.phase === 'finished') return 1;
    if (session.phase === 'idle' || !session.durationMs) return 0;
    return Math.min(1, Math.max(0, 1 - session.remainingMs / session.durationMs));
  }

  function render() {
    const s = state.session;
    const phaseCopy = getPhaseCopy(s);
    const theme = s.paused ? 'paused' : ['prep', 'rest', 'finished'].includes(s.phase) ? s.phase : s.plan.mode;
    const isRunning = s.running;
    const tabataPips = s.plan.mode === 'tabata' ? renderRoundPips(s.plan.rounds, s.round) : '';
    const actionText = isRunning ? 'Pausar' : s.paused ? 'Reanudar' : s.phase === 'finished' ? 'Empezar de nuevo' : 'Iniciar';

    app.setAttribute('aria-busy', 'false');
    app.innerHTML = `
      <div class="app-shell ${isRunning ? 'session-running' : ''}">
        <header class="app-header">
          <div class="brand">
            <span class="brand-mark">${icon('clock')}</span>
            <div><div class="brand-name">Timer Round</div><div class="brand-subtitle">Entrená a tu ritmo</div></div>
          </div>
          <div class="header-actions">
            <button class="icon-button ${state.ui.installAvailable ? '' : 'hidden'}" data-action="install" title="Instalar app" aria-label="Instalar app">${icon('install')}</button>
            <button class="icon-button" data-action="fullscreen" title="Pantalla completa" aria-label="Pantalla completa">${icon('fullscreen')}</button>
            <button class="icon-button" data-action="open-history" title="Ver historial" aria-label="Ver historial">${icon('history')}</button>
            <span class="connection-dot ${navigator.onLine ? '' : 'offline'}" id="connectionDot" title="${navigator.onLine ? 'Con conexión' : 'Sin conexión'}"></span>
          </div>
        </header>

        <nav class="mode-tabs" aria-label="Tipo de entrenamiento" role="tablist">
          ${renderModeTab('random', 'Aleatorio')}
          ${renderModeTab('tabata', 'Tabata')}
          ${renderModeTab('focus', 'Tiempo')}
        </nav>

        <section class="surface timer-card" id="timerCard" data-theme="${theme}" data-phase="${s.paused ? 'paused' : s.phase}" aria-label="Temporizador">
          <div class="status-row">
            <span class="mode-badge" id="modeBadge">${modeLabel(s.plan.mode)}</span>
            <span class="status-chip" id="statusChip">${statusMarkup(s)}</span>
          </div>
          <div class="timer-display">
            <div class="timer-ring">
              <svg viewBox="0 0 288 288" aria-hidden="true">
                <circle class="timer-ring-track" cx="144" cy="144" r="120"></circle>
                <circle class="timer-ring-progress" id="progressRing" cx="144" cy="144" r="120" stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${CIRCUMFERENCE * (1 - progressFor(s))}"></circle>
              </svg>
              <div class="timer-core">
                <div class="phase-kicker" id="phaseLabel" aria-live="polite">${phaseCopy.label}</div>
                <div class="time-value ${s.phase === 'prep' ? 'countdown' : ''}" id="timeValue" aria-live="off">${displayValue(s)}</div>
                <div class="phase-detail" id="phaseDetail">${phaseCopy.detail}</div>
              </div>
            </div>
          </div>
          <div class="mode-summary" id="modeSummary">${modeSummaryMarkup(s, tabataPips)}</div>
          <div class="timer-controls">
            <button class="button button-primary" id="toggleButton" data-action="toggle">${isRunning ? icon('pause') : icon('play')}<span id="controlText">${actionText}</span></button>
            <button class="button button-secondary" data-action="reset" ${canReset(s) ? '' : 'disabled'}>${icon('reset')}<span>Reiniciar</span></button>
          </div>
        </section>

        ${isRunning ? '' : renderSettings()}
      </div>
      ${state.ui.historyOpen ? renderHistoryModal() : ''}
      <div class="toast" id="toast" role="status" aria-live="polite"><span class="toast-indicator"></span><span id="toastText"></span></div>
    `;
    updateLiveUi();
  }

  function renderModeTab(mode, label) {
    const selected = state.activeMode === mode;
    return `<button class="mode-tab" data-mode="${mode}" role="tab" aria-selected="${selected}">${label}</button>`;
  }

  function statusMarkup(s) {
    if (s.plan.mode === 'tabata') return `Ronda <strong id="roundNumber">${s.round}/${s.plan.rounds}</strong>`;
    if (s.plan.mode === 'random') return `Señales <strong id="alertsNumber">${s.alertsFired}/${s.alertSchedule.length || s.plan.alerts}</strong>`;
    return `<strong>Cuenta regresiva</strong>`;
  }

  function renderRoundPips(rounds, current) {
    const visible = Math.min(rounds, 18);
    const pips = Array.from({ length: visible }, (_, index) => {
      const number = index + 1;
      const stateClass = number < current ? 'complete' : number === current ? 'current' : '';
      return `<i class="round-pip ${stateClass}" data-round-pip="${number}"></i>`;
    }).join('');
    return `<span class="round-pips" aria-label="Ronda ${current} de ${rounds}">${pips}</span>${rounds > visible ? `<span>+${rounds - visible}</span>` : ''}`;
  }

  function modeSummaryMarkup(s, tabataPips) {
    if (s.plan.mode === 'tabata') return `${tabataPips}<span>Trabajo ${state.settings.tabata.work}s · Descanso ${state.settings.tabata.rest}s</span>`;
    if (s.plan.mode === 'random') return `<span>Duración <strong>${formatDuration(s.plan.durationMs)}</strong></span><span>·</span><span>${s.plan.alerts} señales al azar</span>`;
    return `<span>Duración <strong>${formatDuration(s.plan.durationMs)}</strong></span>`;
  }

  function canReset(s) {
    return s.running || s.paused || s.phase === 'finished';
  }

  function renderSettings() {
    const isOpen = state.ui.settingsOpen;
    return `
      <section class="surface settings-card ${isOpen ? 'open' : ''}" aria-label="Configuración">
        <button class="settings-heading" data-action="toggle-settings" aria-expanded="${isOpen}">
          <span><span class="settings-title">Configuración</span><span class="settings-caption">Ajustá el tipo de sesión y las señales</span></span>
          <i class="chevron" aria-hidden="true"></i>
        </button>
        <div class="settings-body">
          ${state.activeMode === 'random' ? renderRandomSettings() : ''}
          ${state.activeMode === 'tabata' ? renderTabataSettings() : ''}
          ${state.activeMode === 'focus' ? renderFocusSettings() : ''}
          ${renderPreferences()}
        </div>
      </section>`;
  }

  function renderRandomSettings() {
    const config = state.settings.random;
    return `<div class="settings-section">
      <h2 class="section-title">Round aleatorio</h2>
      <p class="section-help">Las señales se reparten durante el round para que no anticipes el próximo cambio.</p>
      <div class="preset-grid" aria-label="Duración rápida">
        ${[1, 2, 3, 5, 10].map(value => `<button class="preset-button ${config.minutes === value ? 'active' : ''}" data-action="random-preset" data-value="${value}">${value} min</button>`).join('')}
      </div>
      <div class="config-grid" style="margin-top:14px">
        ${numberField('Minutos', 'random.minutes', config.minutes, 1, 120, 'minutes')}
        ${numberField('Señales', 'random.alerts', config.alerts, 1, 60, 'alerts')}
      </div>
    </div>`;
  }

  function renderTabataSettings() {
    const config = state.settings.tabata;
    const total = getPlan('tabata').durationMs;
    return `<div class="settings-section">
      <h2 class="section-title">Intervalos Tabata</h2>
      <p class="section-help">Alterná trabajo y descanso. Duración total: <strong>${formatDuration(total)}</strong>.</p>
      <div class="config-grid three">
        ${numberField('Trabajo (s)', 'tabata.work', config.work, 1, 600, 'work')}
        ${numberField('Descanso (s)', 'tabata.rest', config.rest, 0, 600, 'rest')}
        ${numberField('Rondas', 'tabata.rounds', config.rounds, 1, 60, 'rounds')}
      </div>
    </div>`;
  }

  function renderFocusSettings() {
    const config = state.settings.focus;
    return `<div class="settings-section">
      <h2 class="section-title">Cuenta regresiva</h2>
      <p class="section-help">Ideal para series, pausas de recuperación o bloques de enfoque.</p>
      <div class="input-pair">
        ${numberField('Minutos', 'focus.minutes', config.minutes, 0, 99, 'focus-minutes')}
        ${numberField('Segundos', 'focus.seconds', config.seconds, 0, 59, 'focus-seconds')}
      </div>
    </div>`;
  }

  function numberField(label, field, value, min, max, id) {
    return `<label class="field" for="field-${id}"><span class="field-label">${label}</span><input class="number-input" id="field-${id}" data-field="${field}" inputmode="numeric" type="number" min="${min}" max="${max}" value="${value}"></label>`;
  }

  function renderPreferences() {
    const prefs = state.preferences;
    return `<div class="settings-section">
      <h2 class="section-title">Señales y comodidad</h2>
      <div class="switch-row">${switchCopy('Sonidos', 'Tonos al iniciar, cambiar de fase y finalizar', 'sound', prefs.sound)}</div>
      <div class="switch-row">${switchCopy('Voz', 'Indicaciones breves en español', 'voice', prefs.voice)}</div>
      <div class="switch-row">${switchCopy('Vibración', 'Refuerzo háptico si tu dispositivo lo permite', 'vibration', prefs.vibration)}</div>
      <div class="switch-row">${switchCopy('Cuenta previa', 'Tres segundos antes de comenzar', 'preparation', prefs.preparation)}</div>
      <div class="settings-section">
        <div class="setting-label"><span class="field-label">Volumen de señales</span><span class="range-value" id="volumeValue">${prefs.volume}%</span></div>
        <div class="range-row"><input data-field="preferences.volume" type="range" min="0" max="100" value="${prefs.volume}" aria-label="Volumen de señales"><button class="button button-tertiary" data-action="test-sound">Probar sonido</button></div>
      </div>
      <div class="settings-actions"><div class="shortcut-list"><span><kbd>Espacio</kbd> iniciar / pausar</span><span><kbd>R</kbd> reiniciar</span></div></div>
    </div>`;
  }

  function switchCopy(title, help, preference, isOn) {
    return `<span class="switch-copy"><span class="switch-title">${title}</span><span class="switch-help">${help}</span></span><button class="switch" data-action="toggle-preference" data-preference="${preference}" aria-pressed="${isOn}" aria-label="${title}: ${isOn ? 'activado' : 'desactivado'}"></button>`;
  }

  function renderHistoryModal() {
    const history = state.history;
    const total = history.reduce((sum, item) => sum + item.durationMs, 0);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekTotal = history.filter(item => new Date(item.completedAt) >= weekStart).reduce((sum, item) => sum + item.durationMs, 0);
    return `<div class="modal-backdrop" data-action="close-history">
      <section class="history-modal" role="dialog" aria-modal="true" aria-labelledby="historyTitle" data-modal-content>
        <div class="history-heading"><div><h2 id="historyTitle">Tu historial</h2><p>Las sesiones se guardan solo en este dispositivo.</p></div><button class="icon-button" data-action="close-history" aria-label="Cerrar historial">${icon('close')}</button></div>
        <div class="history-stats"><div class="stat"><span class="stat-value">${history.length}</span><span class="stat-label">Sesiones</span></div><div class="stat"><span class="stat-value">${formatDuration(weekTotal)}</span><span class="stat-label">Esta semana</span></div><div class="stat"><span class="stat-value">${formatDuration(total)}</span><span class="stat-label">Acumulado</span></div></div>
        <div class="history-list">${history.length ? history.map(renderHistoryItem).join('') : '<p class="empty-history">Todavía no terminaste una sesión. Cuando completes una, aparecerá acá.</p>'}</div>
        <div class="modal-actions"><button class="button button-tertiary danger" data-action="clear-history" ${history.length ? '' : 'disabled'}>Borrar historial</button><button class="button button-secondary" data-action="close-history">Cerrar</button></div>
      </section>
    </div>`;
  }

  function renderHistoryItem(item) {
    const detail = item.mode === 'tabata' ? `${item.rounds} ${item.rounds === 1 ? 'ronda' : 'rondas'}` : modeLabel(item.mode);
    const date = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.completedAt));
    return `<article class="history-item"><div><div class="history-mode">${modeLabel(item.mode)}</div><div class="history-date">${date}</div></div><div class="history-duration">${formatDuration(item.durationMs)}<span class="history-detail">${detail}</span></div></article>`;
  }

  function updateLiveUi() {
    const s = state.session;
    const time = document.getElementById('timeValue');
    const phase = document.getElementById('phaseLabel');
    const detail = document.getElementById('phaseDetail');
    const ring = document.getElementById('progressRing');
    const card = document.getElementById('timerCard');
    if (!time || !phase || !detail || !ring || !card) return;

    const copy = getPhaseCopy(s);
    time.textContent = displayValue(s);
    time.classList.toggle('countdown', s.phase === 'prep');
    phase.textContent = copy.label;
    detail.textContent = copy.detail;
    ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progressFor(s)));
    card.dataset.phase = s.paused ? 'paused' : s.phase;
    card.dataset.theme = s.paused ? 'paused' : ['prep', 'rest', 'finished'].includes(s.phase) ? s.phase : s.plan.mode;

    const alerts = document.getElementById('alertsNumber');
    if (alerts) alerts.textContent = `${s.alertsFired}/${s.alertSchedule.length || s.plan.alerts}`;
    const round = document.getElementById('roundNumber');
    if (round) round.textContent = `${s.round}/${s.plan.rounds}`;
    document.querySelectorAll('[data-round-pip]').forEach(pip => {
      const current = Number(pip.dataset.roundPip);
      pip.classList.toggle('complete', current < s.round);
      pip.classList.toggle('current', current === s.round);
    });
  }

  function createRandomSchedule(durationMs, alertCount) {
    if (!alertCount || !durationMs) return [];
    const start = durationMs * 0.08;
    const usable = durationMs * 0.84;
    const block = usable / alertCount;
    return Array.from({ length: alertCount }, (_, index) => {
      const jitter = (Math.random() - 0.5) * block * 0.65;
      return Math.round(start + block * (index + 0.5) + jitter);
    }).sort((a, b) => a - b);
  }

  function startOrResume() {
    if (!state.session.plan.durationMs) {
      showToast('Elegí una duración mayor a cero para empezar.', 'warning');
      return;
    }
    prepareAudio();
    acquireWakeLock();
    const now = Date.now();
    if (state.session.paused) {
      state.session.running = true;
      state.session.paused = false;
      state.session.endAt = now + state.session.remainingMs;
      render();
      requestAnimationFrame(tick);
      showToast('Sesión reanudada.');
      return;
    }

    const plan = getPlan();
    state.session = {
      ...createIdleSession(),
      running: true,
      plan,
      durationMs: state.preferences.preparation ? 3000 : (plan.mode === 'tabata' ? plan.workMs : plan.durationMs),
      remainingMs: state.preferences.preparation ? 3000 : (plan.mode === 'tabata' ? plan.workMs : plan.durationMs),
      phase: state.preferences.preparation ? 'prep' : 'work',
      phaseStartedAt: now,
      endAt: now + (state.preferences.preparation ? 3000 : (plan.mode === 'tabata' ? plan.workMs : plan.durationMs)),
      startedAt: now,
      alertSchedule: plan.mode === 'random' ? createRandomSchedule(plan.durationMs, plan.alerts) : [],
      cueFlags: { countdownSecond: 4 }
    };
    if (state.session.phase === 'work') announceWorkStart(false);
    else say('Prepárate', true);
    render();
    requestAnimationFrame(tick);
  }

  function pauseSession() {
    const s = state.session;
    if (!s.running) return;
    s.remainingMs = Math.max(0, s.endAt - Date.now());
    s.running = false;
    s.paused = true;
    cancelAnimationFrame(animationFrame);
    clearFeedbackQueue();
    releaseWakeLock();
    render();
    showToast('Sesión pausada.');
  }

  function resetSession() {
    clearFeedbackQueue();
    cancelAnimationFrame(animationFrame);
    releaseWakeLock();
    state.session = createIdleSession();
    render();
  }

  function tick() {
    const s = state.session;
    if (!s.running) return;
    const now = Date.now();
    let guard = 0;
    while (s.running && now >= s.endAt && guard < 150) {
      advancePhase(s.endAt);
      guard += 1;
    }
    if (guard === 150) {
      finishSession();
      return;
    }
    if (!s.running) return;
    s.remainingMs = Math.max(0, s.endAt - now);
    processCues(s);
    updateLiveUi();
    animationFrame = requestAnimationFrame(tick);
  }

  function advancePhase(boundaryAt) {
    const s = state.session;
    if (s.phase === 'prep') {
      beginWork(boundaryAt);
      announceWorkStart(true);
      render();
      return;
    }
    if (s.phase === 'work') {
      if (s.plan.mode !== 'tabata' || s.round >= s.plan.rounds) {
        finishSession();
        return;
      }
      if (s.plan.restMs === 0) {
        s.round += 1;
        beginWork(boundaryAt);
        announceWorkStart(true);
      } else {
        s.phase = 'rest';
        s.durationMs = s.plan.restMs;
        s.remainingMs = s.durationMs;
        s.phaseStartedAt = boundaryAt;
        s.endAt = boundaryAt + s.durationMs;
        s.cueFlags = { countdownSecond: 4 };
        playCue('rest');
        say('Descanso', true);
      }
      render();
      return;
    }
    if (s.phase === 'rest') {
      s.round += 1;
      beginWork(boundaryAt);
      announceWorkStart(true);
      render();
    }
  }

  function beginWork(boundaryAt) {
    const s = state.session;
    s.phase = 'work';
    s.durationMs = s.plan.mode === 'tabata' ? s.plan.workMs : s.plan.durationMs;
    s.remainingMs = s.durationMs;
    s.phaseStartedAt = boundaryAt;
    s.endAt = boundaryAt + s.durationMs;
    s.cueFlags = {};
  }

  function announceWorkStart(withCue) {
    const s = state.session;
    if (withCue) playCue('go');
    if (s.plan.mode === 'tabata') say(`Ronda ${s.round}. A trabajar`, true);
    else say('Comenzamos', true);
  }

  function processCues(s) {
    const remainingSeconds = Math.ceil(s.remainingMs / 1000);
    if (s.phase === 'prep' || s.phase === 'rest') {
      if (remainingSeconds > 0 && remainingSeconds <= 3 && remainingSeconds !== s.cueFlags.countdownSecond) {
        s.cueFlags.countdownSecond = remainingSeconds;
        playCue('countdown');
      }
      return;
    }
    if (s.phase !== 'work') return;
    const elapsed = s.durationMs - s.remainingMs;
    if (s.plan.mode === 'random') {
      let due = 0;
      while (s.alertIndex < s.alertSchedule.length && elapsed >= s.alertSchedule[s.alertIndex]) {
        s.alertIndex += 1;
        s.alertsFired += 1;
        due += 1;
      }
      if (due) playCue('alert');
    }
    if (s.durationMs >= 40000 && !s.cueFlags.halfway && s.remainingMs <= s.durationMs / 2) {
      s.cueFlags.halfway = true;
      say('Mitad de tiempo');
    }
    if (s.durationMs >= 15000 && !s.cueFlags.tenSeconds && s.remainingMs <= 10000) {
      s.cueFlags.tenSeconds = true;
      say('Diez segundos');
    }
  }

  function finishSession() {
    const s = state.session;
    if (s.completed) return;
    s.completed = true;
    s.running = false;
    s.paused = false;
    s.phase = 'finished';
    s.remainingMs = 0;
    cancelAnimationFrame(animationFrame);
    releaseWakeLock();
    saveCompletedSession(s);
    render();
    playCue('finish');
    later(() => playCue('finish'), 180);
    later(() => playCue('finish'), 360);
    later(() => say('Entrenamiento completado. Gran trabajo.', true), 620);
  }

  function saveCompletedSession(s) {
    state.history.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      completedAt: new Date().toISOString(),
      mode: s.plan.mode,
      durationMs: s.plan.durationMs,
      rounds: s.plan.rounds
    });
    state.history = state.history.slice(0, 80);
    persist();
  }

  function prepareAudio() {
    if (!state.preferences.sound) return;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext = audioContext || new AudioCtor();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (_) {}
  }

  function playTone(frequency, duration = 0.13, type = 'sine') {
    if (!state.preferences.sound || !state.preferences.volume) return;
    prepareAudio();
    if (!audioContext) return;
    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const volume = Math.max(0.0001, (state.preferences.volume / 100) * 0.26);
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      activeOscillators.add(oscillator);
      oscillator.onended = () => activeOscillators.delete(oscillator);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration + 0.02);
    } catch (_) {}
  }

  function playCue(kind) {
    const patterns = {
      countdown: [650, 0.09, 'sine', [45]],
      go: [1220, 0.28, 'triangle', [160]],
      rest: [400, 0.26, 'sine', [110, 70, 110]],
      alert: [1850, 0.16, 'square', [75, 40, 75]],
      finish: [980, 0.16, 'triangle', [80]]
    };
    const [frequency, duration, type, vibration] = patterns[kind] || patterns.alert;
    playTone(frequency, duration, type);
    if (state.preferences.vibration && navigator.vibrate) {
      try { navigator.vibrate(vibration); } catch (_) {}
    }
  }

  function say(text, interrupt = false) {
    if (!state.preferences.voice || !('speechSynthesis' in window)) return;
    try {
      if (interrupt) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-AR';
      utterance.rate = 1.18;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  }

  function clearFeedbackQueue() {
    feedbackTimers.forEach(timer => clearTimeout(timer));
    feedbackTimers.clear();
    activeOscillators.forEach(oscillator => { try { oscillator.stop(); } catch (_) {} });
    activeOscillators.clear();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function later(callback, delay) {
    const timer = setTimeout(() => {
      feedbackTimers.delete(timer);
      callback();
    }, delay);
    feedbackTimers.add(timer);
  }

  async function acquireWakeLock() {
    try {
      if (!('wakeLock' in navigator) || wakeLock) return;
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (_) {}
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    const current = wakeLock;
    wakeLock = null;
    current.release().catch(() => {});
  }

  function showToast(message, kind = 'success') {
    const toast = document.getElementById('toast');
    const text = document.getElementById('toastText');
    if (!toast || !text) return;
    clearTimeout(toastTimer);
    text.textContent = message;
    toast.classList.toggle('warning', kind === 'warning');
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
  }

  function setMode(mode) {
    if (state.session.running || !['random', 'tabata', 'focus'].includes(mode)) return;
    state.activeMode = mode;
    state.session = createIdleSession();
    persist();
    render();
  }

  function updateSetting(field, rawValue, shouldRender = true) {
    const ranges = {
      'random.minutes': [1, 120], 'random.alerts': [1, 60],
      'tabata.work': [1, 600], 'tabata.rest': [0, 600], 'tabata.rounds': [1, 60],
      'focus.minutes': [0, 99], 'focus.seconds': [0, 59], 'preferences.volume': [0, 100]
    };
    const range = ranges[field];
    if (!range) return;
    const [group, key] = field.split('.');
    const target = group === 'preferences' ? state.preferences : state.settings[group];
    if (!target) return;
    const fallback = target[key] !== undefined ? target[key] : 0;
    target[key] = number(rawValue, range[0], range[1], fallback);
    state.session = createIdleSession();
    persist();
    if (shouldRender) render();
  }

  function togglePreference(preference) {
    if (!(preference in state.preferences)) return;
    state.preferences[preference] = !state.preferences[preference];
    persist();
    render();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => showToast('La pantalla completa no está disponible.', 'warning')); }
    else { if (document.exitFullscreen) document.exitFullscreen(); }
  }

  async function installApp() {
    if (!window.deferredInstallPrompt) return;
    window.deferredInstallPrompt.prompt();
    await window.deferredInstallPrompt.userChoice.catch(() => null);
    window.deferredInstallPrompt = null;
    state.ui.installAvailable = false;
    render();
  }

  app.addEventListener('click', event => {
    const button = event.target.closest('[data-action], [data-mode]');
    if (!button) return;
    const action = button.dataset.action;
    if (button.dataset.mode) return setMode(button.dataset.mode);
    if (action === 'toggle') return state.session.running ? pauseSession() : startOrResume();
    if (action === 'reset') return resetSession();
    if (action === 'toggle-settings') { state.ui.settingsOpen = !state.ui.settingsOpen; return render(); }
    if (action === 'random-preset') { state.settings.random.minutes = number(button.dataset.value, 1, 120, 1); state.session = createIdleSession(); persist(); return render(); }
    if (action === 'toggle-preference') return togglePreference(button.dataset.preference);
    if (action === 'test-sound') { prepareAudio(); playCue('alert'); return showToast('Sonido de prueba.'); }
    if (action === 'open-history') { state.ui.historyOpen = true; return render(); }
    if (action === 'close-history') {
      if (event.target.closest('[data-modal-content]') && event.target === event.currentTarget) return;
      state.ui.historyOpen = false;
      return render();
    }
    if (action === 'clear-history') {
      if (state.history.length && window.confirm('¿Querés borrar todo el historial guardado en este dispositivo?')) { state.history = []; persist(); render(); showToast('Historial borrado.'); }
      return;
    }
    if (action === 'fullscreen') return toggleFullscreen();
    if (action === 'install') return installApp();
  });

  app.addEventListener('change', event => {
    if (event.target.matches('[data-field]')) updateSetting(event.target.dataset.field, event.target.value);
  });

  app.addEventListener('input', event => {
    if (event.target.dataset.field === 'preferences.volume') {
      const value = number(event.target.value, 0, 100, state.preferences.volume);
      const label = document.getElementById('volumeValue');
      if (label) label.textContent = `${value}%`;
    } else if (event.target.matches('input[data-field]')) {
      updateSetting(event.target.dataset.field, event.target.value, false);
    }
  });

  app.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('input[data-field]')) {
      event.preventDefault();
      event.target.blur();
    }
  });

  window.addEventListener('keydown', event => {
    if (event.target.matches('input, textarea, select') || state.ui.historyOpen) {
      if (event.key === 'Escape' && state.ui.historyOpen) { state.ui.historyOpen = false; render(); }
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      state.session.running ? pauseSession() : startOrResume();
    }
    if (event.key.toLowerCase() === 'r' && canReset(state.session)) resetSession();
    if (event.key === 'Escape' && state.ui.settingsOpen) { state.ui.settingsOpen = false; render(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.session.running) {
      acquireWakeLock();
      tick();
    }
  });

  window.addEventListener('online', render);
  window.addEventListener('offline', () => { render(); showToast('Sin conexión: la app sigue disponible.', 'warning'); });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    window.deferredInstallPrompt = event;
    state.ui.installAvailable = true;
    render();
  });
  window.addEventListener('appinstalled', () => { state.ui.installAvailable = false; window.deferredInstallPrompt = null; render(); showToast('Timer Round se instaló correctamente.'); });
  window.addEventListener('error', () => showToast('Ocurrió un problema inesperado. Probá recargar la app.', 'warning'));

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(registration => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (worker) worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showToast('Hay una actualización disponible al recargar.');
          });
        });
      }).catch(() => {});
    });
  }

  render();
})();
