(() => {
  'use strict';

  const STORAGE_KEY = 'timer-round:v4';
  const CIRCUMFERENCE = 2 * Math.PI * 120;
  const feedbackTimers = new Set();
  const activeOscillators = new Set();
  let app = document.getElementById('app');
  let animationFrame = 0;
  let wakeLock = null;
  let audioContext = null;
  let toastTimer = 0;
  let alertFlashTimer = 0;
  let lastFocusedElement = null;
  let globalListenersBound = false;

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

  const FIELD_RANGES = {
    'random.minutes': [1, 120],
    'random.alerts': [1, 60],
    'tabata.work': [1, 600],
    'tabata.rest': [0, 600],
    'tabata.rounds': [1, 60],
    'focus.minutes': [0, 99],
    'focus.seconds': [0, 59],
    'preferences.volume': [0, 100]
  };

  const TABATA_PRESETS = [
    { label: 'Clásico 20/10×8', work: 20, rest: 10, rounds: 8 },
    { label: 'HIIT 30/15×6', work: 30, rest: 15, rounds: 6 },
    { label: 'Combate 120/60×3', work: 120, rest: 60, rounds: 3 },
    { label: 'Sprint 15/15×10', work: 15, rest: 15, rounds: 10 }
  ];

  const FOCUS_PRESETS = [
    { label: '1 min', minutes: 1, seconds: 0 },
    { label: '3 min', minutes: 3, seconds: 0 },
    { label: '5 min', minutes: 5, seconds: 0 },
    { label: '10 min', minutes: 10, seconds: 0 },
    { label: '15 min', minutes: 15, seconds: 0 }
  ];

  function number(value, min, max, fallback) {
    if (value === '' || value === null || value === undefined || typeof value === 'boolean') {
      return fallback;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
  }

  function migrateHistoryItem(item) {
    const modes = { RND: 'random', TABATA: 'tabata', BASIC: 'focus' };
    return {
      id: String((item && item.id) || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      completedAt: (item && item.date) || new Date().toISOString(),
      mode: modes[item && item.mode] || 'focus',
      durationMs: number(item && item.totalTimeMs, 1000, 86400000, 60000),
      rounds: number(item && item.rounds, 1, 60, 1)
    };
  }

  function sanitizeHistoryList(rawHistory) {
    if (!Array.isArray(rawHistory)) return [];
    const validModes = ['random', 'tabata', 'focus'];
    const seenIds = new Set();
    const sanitized = [];

    for (const item of rawHistory) {
      if (!item || typeof item !== 'object') continue;
      const timestamp = new Date(item.completedAt || item.date || Date.now()).valueOf();
      if (Number.isNaN(timestamp)) continue;
      const id = String(item.id || `${timestamp}-${Math.random().toString(16).slice(2)}`);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      sanitized.push({
        id,
        completedAt: new Date(timestamp).toISOString(),
        mode: validModes.includes(item.mode) ? item.mode : 'focus',
        durationMs: number(item.durationMs !== undefined ? item.durationMs : item.totalTimeMs, 1000, 86400000, 60000),
        rounds: number(item.rounds, 1, 60, 1)
      });
      if (sanitized.length >= 80) break;
    }
    return sanitized;
  }

  function sanitizeStoredData(raw = {}) {
    const safeRaw = raw && typeof raw === 'object' ? raw : {};
    const random = (safeRaw.settings && safeRaw.settings.random) || {};
    const tabata = (safeRaw.settings && safeRaw.settings.tabata) || {};
    const focus = (safeRaw.settings && safeRaw.settings.focus) || {};
    const prefs = safeRaw.preferences || {};
    const validModes = ['random', 'tabata', 'focus'];

    return {
      activeMode: validModes.includes(safeRaw.activeMode) ? safeRaw.activeMode : defaults.activeMode,
      settings: {
        random: {
          minutes: number(random.minutes !== undefined ? random.minutes : safeRaw.timer_rnd_min, 1, 120, defaults.settings.random.minutes),
          alerts: number(random.alerts !== undefined ? random.alerts : safeRaw.timer_rnd_alerts, 1, 60, defaults.settings.random.alerts)
        },
        tabata: {
          work: number(tabata.work !== undefined ? tabata.work : safeRaw.timer_tabata_work, 1, 600, defaults.settings.tabata.work),
          rest: number(tabata.rest !== undefined ? tabata.rest : safeRaw.timer_tabata_rest, 0, 600, defaults.settings.tabata.rest),
          rounds: number(tabata.rounds !== undefined ? tabata.rounds : safeRaw.timer_tabata_rounds, 1, 60, defaults.settings.tabata.rounds)
        },
        focus: {
          minutes: number(focus.minutes !== undefined ? focus.minutes : safeRaw.timer_basic_min, 0, 99, defaults.settings.focus.minutes),
          seconds: number(focus.seconds !== undefined ? focus.seconds : safeRaw.timer_basic_sec, 0, 59, defaults.settings.focus.seconds)
        }
      },
      preferences: {
        sound: typeof prefs.sound === 'boolean' ? prefs.sound : defaults.preferences.sound,
        voice: typeof prefs.voice === 'boolean' ? prefs.voice : defaults.preferences.voice,
        vibration: typeof prefs.vibration === 'boolean' ? prefs.vibration : defaults.preferences.vibration,
        preparation: typeof prefs.preparation === 'boolean' ? prefs.preparation : defaults.preferences.preparation,
        volume: number(prefs.volume, 0, 100, defaults.preferences.volume)
      },
      history: sanitizeHistoryList(safeRaw.history)
    };
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

  const state = {
    ...loadStoredData(),
    ui: {
      settingsOpen: false,
      historyOpen: false,
      confirmClearHistory: false,
      installAvailable: Boolean(window.deferredInstallPrompt),
      alertFlash: false,
      toast: { visible: false, message: '', kind: 'success' }
    },
    session: null
  };

  function getPlan(mode = state.activeMode, settings = state.settings) {
    const { random, tabata, focus } = settings;
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

  function createIdleSession(mode = state.activeMode) {
    const plan = getPlan(mode);
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

  state.session = createIdleSession();

  function persist() {
    try {
      const { activeMode, settings, preferences, history } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeMode, settings, preferences, history }));
    } catch (_) {
      showToast('No se pudieron guardar los cambios en este navegador.', 'warning');
    }
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
    return ({ random: 'Round aleatorio', tabata: 'Tabata', focus: 'Cuenta regresiva' })[mode] || 'Temporizador';
  }

  function icon(name) {
    const paths = {
      clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
      play: '<path d="m8.5 5 9 7-9 7z" fill="currentColor" stroke="none"/>',
      pause: '<path d="M8 5.5v13M16 5.5v13"/>',
      reset: '<path d="M4.5 11a7.5 7.5 0 1 1 1.7 5.1"/><path d="M4.5 5.5V11H10"/>',
      skip: '<path d="m5.5 6 8.5 6-8.5 6z" fill="currentColor" stroke="none"/><path d="M18 6v12"/>',
      history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.1-5.2"/><path d="M4.5 5.5V11H10"/><path d="M12 8v4l2.8 1.8"/>',
      fullscreen: '<path d="M8.5 4.5h-4v4M15.5 4.5h4v4M19.5 15.5v4h-4M4.5 15.5v4h4"/>',
      install: '<path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 20h14"/>',
      download: '<path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/>',
      upload: '<path d="M12 15V5"/><path d="m8 9 4-4 4 4"/><path d="M5 19h14"/>',
      close: '<path d="m7 7 10 10M17 7 7 17"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function getPhaseCopy(session = state.session) {
    if (session.phase === 'prep') return { label: 'Prepárate', detail: 'El round empieza en un instante.' };
    if (session.phase === 'rest') return { label: 'Descanso', detail: `Recuperá aire · sigue la ronda ${session.round + 1}.` };
    if (session.phase === 'finished') return { label: 'Sesión completada', detail: 'Excelente trabajo. Tu sesión quedó guardada.' };
    if (session.paused) return { label: 'Pausado', detail: 'El tiempo quedó exactamente donde lo dejaste.' };
    if (session.phase === 'work') {
      if (state.ui.alertFlash) return { label: '¡Señal!', detail: 'Cambiá de ritmo o ejecutá la combinación.' };
      return {
        label: session.plan.mode === 'tabata' ? 'Trabajo' : 'En marcha',
        detail: 'Mantené el ritmo y seguí las señales.'
      };
    }
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

  function getTabataTotalRemainingMs(session = state.session) {
    if (session.plan.mode !== 'tabata') return session.remainingMs;
    if (session.phase === 'idle') return session.plan.durationMs;
    if (session.phase === 'finished') return 0;
    if (session.phase === 'prep') return session.plan.durationMs;

    const futureRounds = Math.max(0, session.plan.rounds - session.round);
    if (session.phase === 'work') {
      const restAfterCurrent = session.round < session.plan.rounds ? session.plan.restMs : 0;
      const futureWorkAndRest = futureRounds * session.plan.workMs + Math.max(0, futureRounds - 1) * session.plan.restMs;
      return session.remainingMs + restAfterCurrent + futureWorkAndRest;
    }
    if (session.phase === 'rest') {
      const futureWorkAndRest = futureRounds * session.plan.workMs + Math.max(0, futureRounds - 1) * session.plan.restMs;
      return session.remainingMs + futureWorkAndRest;
    }
    return session.remainingMs;
  }

  function canReset(s) {
    return s.running || s.paused || s.phase === 'finished';
  }

  function canSkipPhase(s) {
    if (!s.running && !s.paused) return false;
    if (s.phase === 'prep') return true;
    return s.plan.mode === 'tabata' && (s.phase === 'work' || s.phase === 'rest');
  }

  function render() {
    if (!app) return;
    const s = state.session;
    const phaseCopy = getPhaseCopy(s);
    const theme = s.paused ? 'paused' : ['prep', 'rest', 'finished'].includes(s.phase) ? s.phase : s.plan.mode;
    const isRunning = s.running;
    const isLocked = s.running || s.paused;
    const tabataPips = s.plan.mode === 'tabata' ? renderRoundPips(s.plan.rounds, s.round) : '';
    const actionText = isRunning ? 'Pausar' : s.paused ? 'Reanudar' : s.phase === 'finished' ? 'Empezar de nuevo' : 'Iniciar';
    const toast = state.ui.toast;

    app.setAttribute('aria-busy', 'false');
    app.innerHTML = `
      <div class="app-shell ${isRunning ? 'session-running' : ''} ${s.paused ? 'session-paused' : ''}">
        <header class="app-header">
          <div class="brand">
            <span class="brand-mark">${icon('clock')}</span>
            <div>
              <div class="brand-name">Timer Round</div>
              <div class="brand-subtitle">Entrená a tu ritmo</div>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon-button ${state.ui.installAvailable ? '' : 'hidden'}" type="button" data-action="install" title="Instalar app" aria-label="Instalar app">${icon('install')}</button>
            <button class="icon-button" type="button" data-action="fullscreen" title="Pantalla completa (F)" aria-label="Pantalla completa">${icon('fullscreen')}</button>
            <button class="icon-button" type="button" data-action="open-history" id="openHistoryButton" title="Ver historial" aria-label="Ver historial">${icon('history')}</button>
            <span class="connection-dot ${navigator.onLine ? '' : 'offline'}" id="connectionDot" role="status" aria-label="${navigator.onLine ? 'Con conexión' : 'Sin conexión'}" title="${navigator.onLine ? 'Con conexión' : 'Sin conexión'}"></span>
          </div>
        </header>

        <div class="mode-tabs" aria-label="Tipo de entrenamiento" role="tablist">
          ${renderModeTab('random', 'Aleatorio', isLocked)}
          ${renderModeTab('tabata', 'Tabata', isLocked)}
          ${renderModeTab('focus', 'Tiempo', isLocked)}
        </div>

        <section class="surface timer-card ${state.ui.alertFlash ? 'alert-flash' : ''}" id="timerCard" data-theme="${theme}" data-phase="${s.paused ? 'paused' : s.phase}" aria-label="Temporizador">
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
            <button class="button button-primary" type="button" id="toggleButton" data-action="toggle">${isRunning ? icon('pause') : icon('play')}<span id="controlText">${actionText}</span></button>
            ${canSkipPhase(s) ? `<button class="button button-secondary" type="button" data-action="skip-phase" title="Saltar a la siguiente fase">${icon('skip')}<span>Saltar</span></button>` : ''}
            <button class="button button-secondary" type="button" data-action="reset" ${canReset(s) ? '' : 'disabled'}>${icon('reset')}<span>Reiniciar</span></button>
          </div>
        </section>

        ${isRunning ? '' : renderSettings(s.paused)}
      </div>
      ${state.ui.historyOpen ? renderHistoryModal() : ''}
      <div class="toast ${toast.visible ? 'visible' : ''} ${toast.kind === 'warning' ? 'warning' : ''}" id="toast" role="status" aria-live="polite">
        <span class="toast-indicator"></span>
        <span id="toastText">${escapeHtml(toast.message)}</span>
      </div>
    `;
    updateLiveUi();
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderModeTab(mode, label, isLocked) {
    const selected = state.activeMode === mode;
    return `<button class="mode-tab" type="button" data-mode="${mode}" role="tab" aria-selected="${selected}" tabindex="${selected ? '0' : '-1'}" ${isLocked ? 'aria-disabled="true"' : ''}>${label}</button>`;
  }

  function statusMarkup(s) {
    if (s.plan.mode === 'tabata') return `Ronda <strong id="roundNumber">${s.round}/${s.plan.rounds}</strong>`;
    if (s.plan.mode === 'random') return `Señales <strong id="alertsNumber">${s.alertsFired}/${s.alertSchedule.length || s.plan.alerts}</strong>`;
    return `<strong>Cuenta regresiva</strong>`;
  }

  function renderRoundPips(rounds, current) {
    const visible = Math.min(rounds, 18);
    const pips = Array.from({ length: visible }, (_, index) => {
      const num = index + 1;
      const stateClass = num < current ? 'complete' : num === current ? 'current' : '';
      return `<i class="round-pip ${stateClass}" data-round-pip="${num}"></i>`;
    }).join('');
    return `<span class="round-pips" aria-label="Ronda ${current} de ${rounds}">${pips}</span>${rounds > visible ? `<span>+${rounds - visible}</span>` : ''}`;
  }

  function modeSummaryMarkup(s, tabataPips) {
    if (s.plan.mode === 'tabata') {
      const totalRem = getTabataTotalRemainingMs(s);
      const totalText = (s.running || s.paused) ? ` · Restante <strong id="tabataTotalRemaining">${formatTime(totalRem)}</strong>` : '';
      return `${tabataPips}<span>Trabajo ${state.settings.tabata.work}s · Descanso ${state.settings.tabata.rest}s${totalText}</span>`;
    }
    if (s.plan.mode === 'random') {
      return `<span>Duración <strong id="summaryDuration">${formatDuration(s.plan.durationMs)}</strong></span><span>·</span><span><strong id="summaryAlerts">${s.plan.alerts}</strong> señales al azar</span>`;
    }
    return `<span>Duración <strong id="summaryDuration">${formatDuration(s.plan.durationMs)}</strong></span>`;
  }

  function renderSettings(isPaused = false) {
    const isOpen = state.ui.settingsOpen;
    return `
      <section class="surface settings-card ${isOpen ? 'open' : ''}" aria-label="Configuración">
        <button class="settings-heading" type="button" data-action="toggle-settings" aria-expanded="${isOpen}" aria-controls="settingsBody">
          <span>
            <span class="settings-title">Configuración</span>
            <span class="settings-caption">${isPaused ? 'Sesión en pausa · podés ajustar señales y volumen' : 'Ajustá el tipo de sesión y las señales'}</span>
          </span>
          <i class="chevron" aria-hidden="true"></i>
        </button>
        <div class="settings-body" id="settingsBody">
          ${isPaused ? '<p class="paused-notice">Reiniciá la sesión si querés modificar la duración o cambiar de modo.</p>' : ''}
          ${!isPaused && state.activeMode === 'random' ? renderRandomSettings() : ''}
          ${!isPaused && state.activeMode === 'tabata' ? renderTabataSettings() : ''}
          ${!isPaused && state.activeMode === 'focus' ? renderFocusSettings() : ''}
          ${renderPreferences()}
        </div>
      </section>`;
  }

  function renderRandomSettings() {
    const config = state.settings.random;
    return `<div class="settings-section">
      <h2 class="section-title">Round aleatorio</h2>
      <p class="section-help">Las señales se reparten durante el round con separación garantizada para que no anticipes el cambio.</p>
      <div class="preset-grid" aria-label="Duración rápida">
        ${[1, 2, 3, 5, 10].map(value => `<button class="preset-button ${config.minutes === value ? 'active' : ''}" type="button" data-action="random-preset" data-value="${value}">${value} min</button>`).join('')}
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
      <p class="section-help">Alterná trabajo y descanso. Duración total: <strong id="tabataTotalPreview">${formatDuration(total)}</strong>.</p>
      <div class="preset-grid preset-grid-wrap" aria-label="Preajustes Tabata">
        ${TABATA_PRESETS.map((p, idx) => {
          const isCurrent = config.work === p.work && config.rest === p.rest && config.rounds === p.rounds;
          return `<button class="preset-button ${isCurrent ? 'active' : ''}" type="button" data-action="tabata-preset" data-preset-index="${idx}">${p.label}</button>`;
        }).join('')}
      </div>
      <div class="config-grid three" style="margin-top:14px">
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
      <div class="preset-grid" aria-label="Duración rápida">
        ${FOCUS_PRESETS.map((p, idx) => {
          const isCurrent = config.minutes === p.minutes && config.seconds === p.seconds;
          return `<button class="preset-button ${isCurrent ? 'active' : ''}" type="button" data-action="focus-preset" data-preset-index="${idx}">${p.label}</button>`;
        }).join('')}
      </div>
      <div class="input-pair" style="margin-top:14px">
        ${numberField('Minutos', 'focus.minutes', config.minutes, 0, 99, 'focus-minutes')}
        ${numberField('Segundos', 'focus.seconds', config.seconds, 0, 59, 'focus-seconds')}
      </div>
    </div>`;
  }

  function numberField(label, field, value, min, max, id) {
    return `
      <div class="field">
        <label class="field-label" for="field-${id}">${label}</label>
        <div class="stepper-input">
          <button class="stepper-btn" type="button" data-action="step-field" data-field="${field}" data-delta="-1" aria-label="Disminuir ${label}">−</button>
          <input class="number-input" id="field-${id}" data-field="${field}" inputmode="numeric" type="number" min="${min}" max="${max}" value="${value}">
          <button class="stepper-btn" type="button" data-action="step-field" data-field="${field}" data-delta="1" aria-label="Aumentar ${label}">+</button>
        </div>
      </div>`;
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
        <div class="range-row">
          <input data-field="preferences.volume" type="range" min="0" max="100" value="${prefs.volume}" aria-label="Volumen de señales">
          <button class="button button-tertiary" type="button" data-action="test-sound">Probar sonido</button>
        </div>
      </div>
      <div class="settings-actions">
        <div class="shortcut-list">
          <span><kbd>Espacio</kbd> iniciar / pausar</span>
          <span><kbd>R</kbd> reiniciar</span>
          <span><kbd>M</kbd> sonido</span>
          <span><kbd>F</kbd> pantalla completa</span>
        </div>
      </div>
    </div>`;
  }

  function switchCopy(title, help, preference, isOn) {
    return `<span class="switch-copy"><span class="switch-title">${title}</span><span class="switch-help">${help}</span></span><button class="switch" type="button" data-action="toggle-preference" data-preference="${preference}" aria-pressed="${isOn}" aria-label="${title}: ${isOn ? 'activado' : 'desactivado'}"></button>`;
  }

  function renderHistoryModal() {
    const history = state.history;
    const total = history.reduce((sum, item) => sum + item.durationMs, 0);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekTotal = history.filter(item => new Date(item.completedAt) >= weekStart).reduce((sum, item) => sum + item.durationMs, 0);
    const confirming = state.ui.confirmClearHistory;

    return `<div class="modal-backdrop" data-action="close-history">
      <section class="history-modal" role="dialog" aria-modal="true" aria-labelledby="historyTitle" data-modal-content>
        <div class="history-heading">
          <div>
            <h2 id="historyTitle">Tu historial</h2>
            <p>Las sesiones se guardan en este dispositivo. Podés exportarlas o importarlas cuando quieras.</p>
          </div>
          <button class="icon-button" type="button" id="closeHistoryButton" data-action="close-history" aria-label="Cerrar historial">${icon('close')}</button>
        </div>
        <div class="history-stats">
          <div class="stat"><span class="stat-value">${history.length}</span><span class="stat-label">Sesiones</span></div>
          <div class="stat"><span class="stat-value">${formatDuration(weekTotal)}</span><span class="stat-label">Esta semana</span></div>
          <div class="stat"><span class="stat-value">${formatDuration(total)}</span><span class="stat-label">Acumulado</span></div>
        </div>
        <div class="history-tools">
          <button class="button button-tertiary" type="button" data-action="export-history" ${history.length ? '' : 'disabled'}>${icon('download')}<span>Exportar JSON</span></button>
          <label class="button button-tertiary file-button" tabindex="0">
            ${icon('upload')}<span>Importar JSON</span>
            <input type="file" id="importHistoryInput" accept="application/json,.json" class="hidden">
          </label>
        </div>
        <div class="history-list">${history.length ? history.map(renderHistoryItem).join('') : '<p class="empty-history">Todavía no terminaste una sesión. Cuando completes una, aparecerá acá.</p>'}</div>
        <div class="modal-actions">
          ${confirming
            ? `<div class="confirm-inline">
                <button class="button button-tertiary danger" type="button" data-action="confirm-clear-history">Sí, borrar todo</button>
                <button class="button button-tertiary" type="button" data-action="cancel-clear-history">Cancelar</button>
              </div>`
            : `<button class="button button-tertiary danger" type="button" data-action="clear-history" ${history.length ? '' : 'disabled'}>Borrar historial</button>`
          }
          <button class="button button-secondary" type="button" data-action="close-history">Cerrar</button>
        </div>
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
    card.classList.toggle('alert-flash', Boolean(state.ui.alertFlash));

    const alerts = document.getElementById('alertsNumber');
    if (alerts) alerts.textContent = `${s.alertsFired}/${s.alertSchedule.length || s.plan.alerts}`;
    const round = document.getElementById('roundNumber');
    if (round) round.textContent = `${s.round}/${s.plan.rounds}`;
    const tabataTotal = document.getElementById('tabataTotalRemaining');
    if (tabataTotal) tabataTotal.textContent = formatTime(getTabataTotalRemainingMs(s));

    const summaryDuration = document.getElementById('summaryDuration');
    if (summaryDuration) summaryDuration.textContent = formatDuration(s.plan.durationMs);
    const summaryAlerts = document.getElementById('summaryAlerts');
    if (summaryAlerts) summaryAlerts.textContent = String(s.plan.alerts);
    const tabataPreview = document.getElementById('tabataTotalPreview');
    if (tabataPreview) tabataPreview.textContent = formatDuration(getPlan('tabata').durationMs);

    document.querySelectorAll('[data-round-pip]').forEach(pip => {
      const current = Number(pip.dataset.roundPip);
      pip.classList.toggle('complete', current < s.round);
      pip.classList.toggle('current', current === s.round);
    });
  }

  function createRandomSchedule(durationMs, alertCount) {
    if (!alertCount || !durationMs || durationMs < 2000) return [];
    const start = Math.max(800, durationMs * 0.08);
    const usable = Math.max(1000, durationMs * 0.84);
    const maxPossibleAlerts = Math.max(1, Math.floor(usable / 750));
    const effectiveCount = Math.min(alertCount, maxPossibleAlerts);
    const block = usable / effectiveCount;
    const minGapMs = Math.min(600, Math.floor(block * 0.35));

    const rawSchedule = Array.from({ length: effectiveCount }, (_, index) => {
      const jitter = (Math.random() - 0.5) * block * 0.6;
      return Math.round(start + block * (index + 0.5) + jitter);
    }).sort((a, b) => a - b);

    for (let i = 1; i < rawSchedule.length; i += 1) {
      if (rawSchedule[i] - rawSchedule[i - 1] < minGapMs) {
        rawSchedule[i] = Math.min(durationMs - 500, rawSchedule[i - 1] + minGapMs);
      }
    }
    return rawSchedule;
  }

  function scheduleTick() {
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(tick);
  }

  function stopTick() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function triggerAlertFlash() {
    clearTimeout(alertFlashTimer);
    state.ui.alertFlash = true;
    updateLiveUi();
    alertFlashTimer = setTimeout(() => {
      state.ui.alertFlash = false;
      updateLiveUi();
    }, 650);
  }

  function startOrResume() {
    const currentPlan = getPlan();
    if (!currentPlan.durationMs) {
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
      scheduleTick();
      showToast('Sesión reanudada.');
      return;
    }

    const usePrep = state.preferences.preparation;
    const firstPhaseDuration = usePrep ? 3000 : (currentPlan.mode === 'tabata' ? currentPlan.workMs : currentPlan.durationMs);
    state.session = {
      ...createIdleSession(),
      running: true,
      plan: currentPlan,
      durationMs: firstPhaseDuration,
      remainingMs: firstPhaseDuration,
      phase: usePrep ? 'prep' : 'work',
      phaseStartedAt: now,
      endAt: now + firstPhaseDuration,
      startedAt: now,
      alertSchedule: currentPlan.mode === 'random' ? createRandomSchedule(currentPlan.durationMs, currentPlan.alerts) : [],
      cueFlags: { countdownSecond: 4 }
    };
    if (state.session.phase === 'work') {
      announceWorkStart(true);
    } else {
      playCue('prep');
    }
    render();
    scheduleTick();
  }

  function pauseSession() {
    const s = state.session;
    if (!s.running) return;
    s.remainingMs = Math.max(0, s.endAt - Date.now());
    s.running = false;
    s.paused = true;
    stopTick();
    clearFeedbackQueue();
    releaseWakeLock();
    render();
    showToast('Sesión pausada.');
  }

  function resetSession() {
    clearFeedbackQueue();
    stopTick();
    clearTimeout(alertFlashTimer);
    state.ui.alertFlash = false;
    releaseWakeLock();
    state.session = createIdleSession();
    render();
  }

  function skipCurrentPhase() {
    const s = state.session;
    if (!canSkipPhase(s)) return;
    clearFeedbackQueue();
    const now = Date.now();
    advancePhase(now, false);
    if (s.paused && s.running === false && s.phase !== 'finished') {
      s.endAt = now + s.remainingMs;
    } else if (s.running) {
      scheduleTick();
    }
  }

  function tick() {
    const s = state.session;
    if (!s.running) return;
    const now = Date.now();
    let guard = 0;
    let advancedCount = 0;

    while (s.running && now >= s.endAt && guard < 150) {
      advancePhase(s.endAt, true);
      guard += 1;
      advancedCount += 1;
    }
    if (guard === 150) {
      finishSession();
      return;
    }
    if (advancedCount > 0 && s.running) {
      announceCurrentPhaseAfterTransition();
      render();
    }
    if (!s.running) return;
    s.remainingMs = Math.max(0, s.endAt - now);
    processCues(s);
    updateLiveUi();
    scheduleTick();
  }

  function announceCurrentPhaseAfterTransition() {
    const s = state.session;
    if (s.phase === 'work') {
      announceWorkStart(true);
    } else if (s.phase === 'rest') {
      playCue('rest');
      later(() => say('Descanso', true), 320);
    }
  }

  function advancePhase(boundaryAt, silent = false) {
    const s = state.session;
    if (s.phase === 'prep') {
      beginWork(boundaryAt);
      if (!silent) {
        announceWorkStart(true);
        render();
      }
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
        if (!silent) announceWorkStart(true);
      } else {
        s.phase = 'rest';
        s.durationMs = s.plan.restMs;
        s.remainingMs = s.durationMs;
        s.phaseStartedAt = boundaryAt;
        s.endAt = boundaryAt + s.durationMs;
        s.cueFlags = { countdownSecond: 4 };
        if (!silent) {
          playCue('rest');
          later(() => say('Descanso', true), 320);
        }
      }
      if (!silent) render();
      return;
    }
    if (s.phase === 'rest') {
      s.round += 1;
      beginWork(boundaryAt);
      if (!silent) {
        announceWorkStart(true);
        render();
      }
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
    const msg = s.plan.mode === 'tabata' ? `Ronda ${s.round}. A trabajar` : 'Comenzamos';
    later(() => say(msg, true), withCue ? 320 : 0);
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
      if (due) {
        playCue('alert');
        triggerAlertFlash();
      }
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
    stopTick();
    clearTimeout(alertFlashTimer);
    state.ui.alertFlash = false;
    releaseWakeLock();
    saveCompletedSession(s);
    render();
    playCue('finish');
    later(() => say('Entrenamiento completado. Gran trabajo.', true), 900);
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

  function exportHistoryJson() {
    if (!state.history.length) return;
    try {
      const payload = JSON.stringify({
        exportedAt: new Date().toISOString(),
        app: 'Timer Round',
        version: 4,
        history: state.history
      }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `timer-round-historial-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast('Historial exportado correctamente.');
    } catch (_) {
      showToast('No se pudo exportar el historial.', 'warning');
    }
  }

  function importHistoryFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.history) ? parsed.history : null);
        if (!list) {
          showToast('El archivo no contiene un historial válido.', 'warning');
          return;
        }
        const merged = sanitizeHistoryList([...list, ...state.history]).sort(
          (a, b) => new Date(b.completedAt).valueOf() - new Date(a.completedAt).valueOf()
        ).slice(0, 80);
        state.history = merged;
        persist();
        render();
        showToast(`Historial actualizado (${merged.length} sesiones).`);
      } catch (_) {
        showToast('No se pudo leer el archivo JSON.', 'warning');
      }
    };
    reader.readAsText(file);
  }

  function prepareAudio() {
    if (!state.preferences.sound) return null;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioCtor();
      }
      if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
        audioContext.resume().catch(() => {});
      }
      // Unlock mobile audio pipeline with a silent 1-sample buffer
      try {
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
      } catch (_) {}

      return audioContext;
    } catch (_) {
      return null;
    }
  }

  function playTone(frequency, duration = 0.16, type = 'triangle', gainMultiplier = 1) {
    if (!state.preferences.sound || !state.preferences.volume) return;
    const ctx = prepareAudio();
    if (!ctx) return;

    const executeTone = () => {
      try {
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Calculate clear, audible volume scaled to preferences (volume 1-100)
        const userVol = Math.max(0, Math.min(100, state.preferences.volume)) / 100;
        const peakVolume = Math.max(0.02, userVol * 0.85 * gainMultiplier);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);

        // Linear envelope with fast attack and clean release (no clicks, full sustained volume)
        const attackTime = 0.008;
        const releaseTime = Math.min(0.04, duration * 0.35);
        const sustainEndTime = Math.max(now + attackTime, now + duration - releaseTime);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.linearRampToValueAtTime(peakVolume, now + attackTime);
        gainNode.gain.setValueAtTime(peakVolume, sustainEndTime);
        gainNode.gain.linearRampToValueAtTime(0.0001, now + duration);

        oscillator.connect(gainNode).connect(ctx.destination);
        activeOscillators.add(oscillator);

        oscillator.onended = () => {
          activeOscillators.delete(oscillator);
          try {
            oscillator.disconnect();
            gainNode.disconnect();
          } catch (_) {}
        };

        oscillator.start(now);
        oscillator.stop(now + duration + 0.04);
      } catch (_) {}
    };

    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      ctx.resume().then(executeTone).catch(executeTone);
    } else {
      executeTone();
    }
  }

  function playCue(kind) {
    if (!state.preferences.sound && !state.preferences.vibration) return;

    if (kind === 'prep') {
      // Tono característico de preparación (doble señal de aviso ascendente, sin voz)
      playTone(550, 0.09, 'sine', 0.85);
      later(() => playTone(720, 0.13, 'triangle', 0.9), 110);
      vibrate([60, 40, 60]);
    } else if (kind === 'countdown') {
      playTone(800, 0.14, 'triangle');
      vibrate([50]);
    } else if (kind === 'go') {
      playTone(1050, 0.30, 'triangle');
      later(() => playTone(1260, 0.25, 'triangle'), 110);
      vibrate([180]);
    } else if (kind === 'rest') {
      playTone(520, 0.24, 'sine');
      later(() => playTone(390, 0.32, 'sine'), 120);
      vibrate([100, 60, 100]);
    } else if (kind === 'alert') {
      // Auténtico PIP de reacción: agudo, instantáneo y penetrante para reflejos inmediatos
      playTone(2100, 0.075, 'triangle', 0.95);
      vibrate([45]);
    } else if (kind === 'finish') {
      playTone(784, 0.18, 'triangle');
      later(() => playTone(988, 0.18, 'triangle'), 150);
      later(() => playTone(1175, 0.45, 'triangle'), 300);
      vibrate([100, 80, 100, 80, 250]);
    } else {
      playTone(900, 0.18, 'triangle');
      vibrate([60]);
    }
  }

  function vibrate(pattern) {
    if (state.preferences.vibration && 'vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch (_) {}
    }
  }

  function say(text, interrupt = false) {
    if (!state.preferences.voice || !('speechSynthesis' in window)) return;
    try {
      if (interrupt && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || [];
      const spanishVoice = voices.find(v => v.lang === 'es-AR')
        || voices.find(v => v.lang && v.lang.startsWith('es'))
        || voices.find(v => /spanish|español/i.test(v.name));
      if (spanishVoice) {
        utterance.voice = spanishVoice;
        utterance.lang = spanishVoice.lang;
      } else {
        utterance.lang = 'es';
      }
      utterance.rate = 1.15;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  }

  function clearFeedbackQueue() {
    feedbackTimers.forEach(timer => clearTimeout(timer));
    feedbackTimers.clear();
    activeOscillators.forEach(oscillator => { try { oscillator.stop(); } catch (_) {} });
    activeOscillators.clear();
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
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
    clearTimeout(toastTimer);
    state.ui.toast = { visible: true, message, kind };
    const toast = document.getElementById('toast');
    const text = document.getElementById('toastText');
    if (toast && text) {
      text.textContent = message;
      toast.classList.toggle('warning', kind === 'warning');
      toast.classList.add('visible');
    }
    toastTimer = setTimeout(() => {
      state.ui.toast.visible = false;
      const currentToast = document.getElementById('toast');
      if (currentToast) currentToast.classList.remove('visible');
    }, 2800);
  }

  function setMode(mode) {
    if (!['random', 'tabata', 'focus'].includes(mode)) return;
    if (state.session.running || state.session.paused) {
      showToast('Reiniciá la sesión actual para cambiar de modo.', 'warning');
      return;
    }
    state.activeMode = mode;
    state.session = createIdleSession(mode);
    persist();
    render();
  }

  function updateSetting(field, rawValue, shouldRender = false) {
    const range = FIELD_RANGES[field];
    if (!range) return;
    const [group, key] = field.split('.');

    if (group === 'preferences') {
      const fallback = state.preferences[key] !== undefined ? state.preferences[key] : 70;
      state.preferences[key] = number(rawValue, range[0], range[1], fallback);
      persist();
      const label = document.getElementById('volumeValue');
      if (label && key === 'volume') label.textContent = `${state.preferences.volume}%`;
      return;
    }

    if (state.session.running || state.session.paused) return;
    const target = state.settings[group];
    if (!target) return;
    const fallback = target[key] !== undefined ? target[key] : range[0];
    target[key] = number(rawValue, range[0], range[1], fallback);
    state.session = createIdleSession();
    persist();

    if (shouldRender) {
      render();
    } else {
      updateLiveUi();
    }
  }

  function stepField(field, delta) {
    const range = FIELD_RANGES[field];
    if (!range || state.session.running || state.session.paused) return;
    const [group, key] = field.split('.');
    const target = state.settings[group];
    if (!target) return;
    const nextValue = number((target[key] || 0) + delta, range[0], range[1], target[key]);
    target[key] = nextValue;
    state.session = createIdleSession();
    persist();
    render();
  }

  function togglePreference(preference) {
    if (!(preference in state.preferences)) return;
    state.preferences[preference] = !state.preferences[preference];
    persist();
    render();
  }

  function openHistoryModal() {
    lastFocusedElement = document.activeElement;
    state.ui.historyOpen = true;
    state.ui.confirmClearHistory = false;
    render();
    const closeBtn = document.getElementById('closeHistoryButton');
    if (closeBtn) closeBtn.focus();
  }

  function closeHistoryModal() {
    state.ui.historyOpen = false;
    state.ui.confirmClearHistory = false;
    render();
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    } else {
      const historyBtn = document.getElementById('openHistoryButton');
      if (historyBtn) historyBtn.focus();
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => showToast('La pantalla completa no está disponible.', 'warning'));
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  async function installApp() {
    if (!window.deferredInstallPrompt) return;
    window.deferredInstallPrompt.prompt();
    await window.deferredInstallPrompt.userChoice.catch(() => null);
    window.deferredInstallPrompt = null;
    state.ui.installAvailable = false;
    render();
  }

  function onAppClick(event) {
    const button = event.target.closest('[data-action], [data-mode]');
    if (!button) return;

    if (button.dataset.mode) {
      return setMode(button.dataset.mode);
    }

    const action = button.dataset.action;
    if (action === 'toggle') return state.session.running ? pauseSession() : startOrResume();
    if (action === 'reset') return resetSession();
    if (action === 'skip-phase') return skipCurrentPhase();
    if (action === 'toggle-settings') {
      state.ui.settingsOpen = !state.ui.settingsOpen;
      return render();
    }
    if (action === 'step-field') {
      return stepField(button.dataset.field, Number(button.dataset.delta || 0));
    }
    if (action === 'random-preset') {
      if (state.session.running || state.session.paused) return;
      state.settings.random.minutes = number(button.dataset.value, 1, 120, 1);
      state.session = createIdleSession();
      persist();
      return render();
    }
    if (action === 'tabata-preset') {
      if (state.session.running || state.session.paused) return;
      const preset = TABATA_PRESETS[Number(button.dataset.presetIndex)];
      if (!preset) return;
      state.settings.tabata = { work: preset.work, rest: preset.rest, rounds: preset.rounds };
      state.session = createIdleSession();
      persist();
      return render();
    }
    if (action === 'focus-preset') {
      if (state.session.running || state.session.paused) return;
      const preset = FOCUS_PRESETS[Number(button.dataset.presetIndex)];
      if (!preset) return;
      state.settings.focus = { minutes: preset.minutes, seconds: preset.seconds };
      state.session = createIdleSession();
      persist();
      return render();
    }
    if (action === 'toggle-preference') return togglePreference(button.dataset.preference);
    if (action === 'test-sound') {
      if (!state.preferences.sound) {
        return showToast('Los sonidos están desactivados en Configuración.', 'warning');
      }
      if (state.preferences.volume === 0) {
        return showToast('El volumen está al 0%. Subí el deslizador de volumen.', 'warning');
      }
      prepareAudio();
      playCue('alert');
      return showToast('Pip de reacción emitido.');
    }
    if (action === 'open-history') return openHistoryModal();
    if (action === 'close-history') {
      if (button.classList.contains('modal-backdrop') && event.target.closest('[data-modal-content]')) return;
      return closeHistoryModal();
    }
    if (action === 'clear-history') {
      if (!state.history.length) return;
      state.ui.confirmClearHistory = true;
      return render();
    }
    if (action === 'cancel-clear-history') {
      state.ui.confirmClearHistory = false;
      return render();
    }
    if (action === 'confirm-clear-history') {
      state.history = [];
      state.ui.confirmClearHistory = false;
      persist();
      render();
      return showToast('Historial borrado.');
    }
    if (action === 'export-history') return exportHistoryJson();
    if (action === 'fullscreen') return toggleFullscreen();
    if (action === 'install') return installApp();
  }

  function onAppChange(event) {
    if (event.target.id === 'importHistoryInput') {
      const file = event.target.files && event.target.files[0];
      importHistoryFile(file);
      event.target.value = '';
      return;
    }
    if (event.target.matches('[data-field]')) {
      const field = event.target.dataset.field;
      updateSetting(field, event.target.value, false);
      const [group, key] = field.split('.');
      const currentVal = group === 'preferences' ? state.preferences[key] : state.settings[group][key];
      event.target.value = String(currentVal);
      if (field === 'preferences.volume' && state.preferences.sound && state.preferences.volume > 0) {
        prepareAudio();
        playTone(880, 0.12, 'triangle');
      }
    }
  }

  function onAppInput(event) {
    if (event.target.dataset.field === 'preferences.volume') {
      updateSetting('preferences.volume', event.target.value, false);
    } else if (event.target.matches('input[data-field]')) {
      if (event.target.value === '') return;
      updateSetting(event.target.dataset.field, event.target.value, false);
    }
  }

  function onAppKeydown(event) {
    if (event.key === 'Enter' && event.target.matches('input[data-field]')) {
      event.preventDefault();
      event.target.blur();
      return;
    }
    if (event.target.matches('[role="tab"]')) {
      const modes = ['random', 'tabata', 'focus'];
      const currentIdx = modes.indexOf(event.target.dataset.mode);
      if (currentIdx === -1) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextMode = modes[(currentIdx + delta + modes.length) % modes.length];
        setMode(nextMode);
        const nextTab = app && app.querySelector(`[data-mode="${nextMode}"]`);
        if (nextTab) nextTab.focus();
      }
    }
  }

  function bindContainerListeners(targetApp) {
    if (!targetApp || targetApp.dataset.timerBound === 'true') return;
    targetApp.dataset.timerBound = 'true';
    targetApp.addEventListener('click', onAppClick);
    targetApp.addEventListener('change', onAppChange);
    targetApp.addEventListener('input', onAppInput);
    targetApp.addEventListener('keydown', onAppKeydown);
  }

  function bindGlobalListeners() {
    if (globalListenersBound) return;
    globalListenersBound = true;

    const unlockAudio = () => {
      prepareAudio();
    };
    ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(eventType => {
      window.addEventListener(eventType, unlockAudio, { passive: true });
    });

    window.addEventListener('keydown', event => {
      if (state.ui.historyOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeHistoryModal();
        }
        return;
      }
      if (event.target.matches('input, textarea, select')) return;

      if (event.code === 'Space') {
        event.preventDefault();
        state.session.running ? pauseSession() : startOrResume();
      } else if (event.key.toLowerCase() === 'r' && canReset(state.session)) {
        resetSession();
      } else if (event.key.toLowerCase() === 'm') {
        togglePreference('sound');
        showToast(state.preferences.sound ? 'Sonidos activados.' : 'Sonidos silenciados.');
      } else if (event.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (event.key === 'Escape' && state.ui.settingsOpen) {
        state.ui.settingsOpen = false;
        render();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.session.running) {
        acquireWakeLock();
        tick();
      }
    });

    window.addEventListener('online', render);
    window.addEventListener('offline', () => {
      render();
      showToast('Sin conexión: la app sigue disponible.', 'warning');
    });
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      window.deferredInstallPrompt = event;
      state.ui.installAvailable = true;
      render();
    });
    window.addEventListener('appinstalled', () => {
      state.ui.installAvailable = false;
      window.deferredInstallPrompt = null;
      render();
      showToast('Timer Round se instaló correctamente.');
    });
    window.addEventListener('error', () => {
      showToast('Ocurrió un problema inesperado. Probá recargar la app.', 'warning');
    });

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(registration => {
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (worker) {
              worker.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                  showToast('Hay una actualización disponible al recargar.');
                }
              });
            }
          });
        }).catch(() => {});
      });
    }
  }

  function mount(targetElement = document.getElementById('app')) {
    if (!targetElement) return;
    app = targetElement;
    bindContainerListeners(app);
    bindGlobalListeners();
    render();
  }

  window.TimerRound = {
    mount,
    getState: () => state,
    actions: {
      startOrResume,
      pauseSession,
      resetSession,
      skipCurrentPhase,
      setMode,
      updateSetting,
      stepField,
      togglePreference
    },
    audio: {
      prepareAudio,
      playTone,
      playCue,
      say
    },
    utils: {
      number,
      sanitizeStoredData,
      sanitizeHistoryList,
      migrateHistoryItem,
      getPlan,
      createRandomSchedule,
      formatTime,
      formatDuration
    }
  };

  if (app) {
    mount(app);
  }
})();
