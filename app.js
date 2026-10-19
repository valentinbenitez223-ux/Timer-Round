(() => {
  'use strict';

  const STORAGE_KEY = 'timer-round:v4';
  const CIRCUMFERENCE = 2 * Math.PI * 120;
  const VALID_MODES = ['random', 'tabata', 'emom', 'focus'];
  const VALID_CUE_TYPES = ['pip', 'numbers', 'combat'];
  const VALID_COMBAT_FOCUS = ['all', 'combinations', 'displacements', 'actions'];
  const VALID_SOUND_PACKS = ['classic', 'whistle', 'woodblock'];
  const SESSION_RECOVERY_KEY = 'timer-round:session-recovery';

  const SOUND_PACKS = {
    classic: {
      label: 'Clásica (campana)',
      prep: () => {
        playTone(550, 0.09, 'sine', 0.85);
        later(() => playTone(720, 0.13, 'triangle', 0.9), 110);
      },
      countdown: () => playTone(800, 0.14, 'triangle'),
      go: () => {
        playTone(1050, 0.30, 'triangle');
        later(() => playTone(1260, 0.25, 'triangle'), 110);
      },
      alert: () => playTone(2100, 0.075, 'triangle', 0.95),
      clapper: () => {
        playTone(1480, 0.045, 'square', 0.7);
        later(() => playTone(1480, 0.045, 'square', 0.7), 85);
        later(() => playTone(1480, 0.055, 'square', 0.75), 170);
      },
      finish: () => {
        playTone(784, 0.18, 'triangle');
        later(() => playTone(988, 0.18, 'triangle'), 150);
        later(() => playTone(1175, 0.45, 'triangle'), 300);
      }
    },
    whistle: {
      label: 'Silbato (agudo)',
      prep: () => {
        playTone(1800, 0.08, 'sine', 0.7);
        later(() => playTone(2100, 0.12, 'sine', 0.75), 100);
      },
      countdown: () => playTone(2400, 0.10, 'sine', 0.8),
      go: () => playTone(2800, 0.25, 'sine', 0.85),
      alert: () => playTone(3000, 0.06, 'sine', 0.9),
      clapper: () => {
        playTone(2600, 0.04, 'sine', 0.7);
        later(() => playTone(2600, 0.04, 'sine', 0.7), 85);
        later(() => playTone(2600, 0.05, 'sine', 0.75), 170);
      },
      finish: () => {
        playTone(3000, 0.20, 'sine', 0.9);
        later(() => playTone(2400, 0.20, 'sine', 0.85), 150);
        later(() => playTone(1800, 0.35, 'sine', 0.8), 300);
      }
    },
    woodblock: {
      label: 'Caja china (seco)',
      prep: () => {
        playTone(880, 0.06, 'square', 0.7);
        later(() => playTone(1100, 0.09, 'square', 0.75), 90);
      },
      countdown: () => playTone(1200, 0.07, 'square', 0.8),
      go: () => playTone(1400, 0.18, 'square', 0.85),
      alert: () => playTone(2200, 0.04, 'square', 0.85),
      clapper: () => {
        playTone(1400, 0.04, 'square', 0.8);
        later(() => playTone(1400, 0.04, 'square', 0.8), 80);
        later(() => playTone(1400, 0.05, 'square', 0.85), 160);
      },
      finish: () => {
        playTone(1400, 0.12, 'square', 0.8);
        later(() => playTone(1800, 0.12, 'square', 0.85), 130);
        later(() => playTone(2200, 0.30, 'square', 0.9), 260);
      }
    }
  };

  function soundPackLabel(key) {
    return (SOUND_PACKS[key] && SOUND_PACKS[key].label) || SOUND_PACKS.classic.label;
  }

  const KARATE_COMBINATIONS = [
    'Kizami - Gyaku',
    'Finta y Gyaku',
    'Gyaku tsuki al cuerpo',
    'Anticipación y Uraken',
    'Doble kizami',
    'Kizami y barrida',
    'Mawashi chudan',
    'Uraken y Gyaku'
  ];

  const KARATE_DISPLACEMENTS = [
    'Salida lateral en ángulo',
    'Paso diagonal y contra',
    'Esquiva y entrada',
    'Desplazamiento atrás y finta',
    'Pivoteo y Uraken',
    'Cambio de guardia y ataque',
    'Ruptura de distancia y contra'
  ];

  const TACTICAL_ACTIONS = [
    '¡Entrada rápida!',
    '¡Anticipá!',
    '¡Contraataque!',
    '¡Defensa y salida!',
    '¡Presión y remate!',
    '¡Finta!'
  ];

  const COMBAT_CALLOUTS = [
    ...KARATE_COMBINATIONS,
    ...KARATE_DISPLACEMENTS,
    ...TACTICAL_ACTIONS
  ];

  const PHONETIC_REPLACEMENTS = [
    [/kizami/gi, 'kisami'],
    [/gyaku/gi, 'guiaku'],
    [/tsuki/gi, 'suki'],
    [/mawashi/gi, 'maguashi'],
    [/chudan/gi, 'chúdan'],
    [/uraken/gi, 'uráken'],
    [/ - /g, ', ']
  ];

  const NUMBER_CALLOUTS = ['Uno', 'Dos', 'Tres', 'Cuatro'];

  const feedbackTimers = new Set();
  const activeOscillators = new Set();
  let app = document.getElementById('app');
  let animationFrame = 0;
  let wakeLock = null;
  let audioContext = null;
  let audioUnlocked = false;
  let toastTimer = 0;
  let alertFlashTimer = 0;
  let persistDebounceTimer = 0;
  let lastFocusedElement = null;
  let globalListenersBound = false;
  let previousCallout = '';
  let loadedFromUrl = false;

  const defaults = {
    activeMode: 'random',
    settings: {
      random: { minutes: 1, alerts: 10, rounds: 1, rest: 30, cueType: 'pip', combatFocus: 'all' },
      tabata: { work: 20, rest: 10, rounds: 8 },
      emom: { interval: 60, rounds: 10 },
      focus: { minutes: 5, seconds: 0 }
    },
    preferences: {
      sound: true,
      voice: true,
      vibration: true,
      preparation: true,
      prepSeconds: 3,
      dualScore: false,
      volume: 70,
      soundPack: 'classic'
    },
    savedRoutines: [],
    history: []
  };

  const FIELD_RANGES = {
    'random.minutes': [1, 120],
    'random.alerts': [1, 60],
    'random.rounds': [1, 60],
    'random.rest': [0, 600],
    'tabata.work': [1, 600],
    'tabata.rest': [0, 600],
    'tabata.rounds': [1, 60],
    'emom.interval': [10, 600],
    'emom.rounds': [1, 60],
    'focus.minutes': [0, 99],
    'focus.seconds': [0, 59],
    'preferences.volume': [0, 100],
    'preferences.prepSeconds': [3, 15]
  };

  const RANDOM_PRESETS = [
    { label: '1 min · 10 pips', minutes: 1, alerts: 10, rounds: 1, rest: 30 },
    { label: '2 min · 15 pips', minutes: 2, alerts: 15, rounds: 1, rest: 30 },
    { label: 'Point Fight 2m×3', minutes: 2, alerts: 12, rounds: 3, rest: 60 },
    { label: 'Full Contact 3m×3', minutes: 3, alerts: 18, rounds: 3, rest: 60 },
    { label: 'Reacción 1m×5', minutes: 1, alerts: 12, rounds: 5, rest: 30 }
  ];

  const TABATA_PRESETS = [
    { label: 'Clásico 20/10×8', work: 20, rest: 10, rounds: 8 },
    { label: 'HIIT 30/15×6', work: 30, rest: 15, rounds: 6 },
    { label: 'Combate 120/60×3', work: 120, rest: 60, rounds: 3 },
    { label: 'Sprint 15/15×10', work: 15, rest: 15, rounds: 10 }
  ];

  const EMOM_PRESETS = [
    { label: 'EMOM 60s×10', interval: 60, rounds: 10 },
    { label: 'EMOM 45s×8', interval: 45, rounds: 8 },
    { label: 'E2MOM 120s×5', interval: 120, rounds: 5 },
    { label: 'Explosivo 30s×12', interval: 30, rounds: 12 }
  ];

  const FOCUS_PRESETS = [
    { label: '1 min', minutes: 1, seconds: 0 },
    { label: '3 min', minutes: 3, seconds: 0 },
    { label: '5 min', minutes: 5, seconds: 0 },
    { label: '15 min', minutes: 15, seconds: 0 },
    { label: '25 min', minutes: 25, seconds: 0 }
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

  function formatSpeechText(text) {
    let output = String(text || '');
    for (const [pattern, replacement] of PHONETIC_REPLACEMENTS) {
      output = output.replace(pattern, replacement);
    }
    return output;
  }

  function getCombatPool(combatFocus = 'all') {
    if (combatFocus === 'combinations') return KARATE_COMBINATIONS;
    if (combatFocus === 'displacements') return KARATE_DISPLACEMENTS;
    if (combatFocus === 'actions') return TACTICAL_ACTIONS;
    return COMBAT_CALLOUTS;
  }

  function generateKarateCallout(combatFocus = 'all') {
    const pool = getCombatPool(combatFocus);
    if (!pool.length) return '¡Señal!';
    if (pool.length === 1) return pool[0];
    let candidate = pool[Math.floor(Math.random() * pool.length)];
    let attempts = 0;
    while (candidate === previousCallout && attempts < 8) {
      candidate = pool[Math.floor(Math.random() * pool.length)];
      attempts += 1;
    }
    previousCallout = candidate;
    return candidate;
  }

  function migrateHistoryItem(item) {
    const modes = { RND: 'random', TABATA: 'tabata', EMOM: 'emom', BASIC: 'focus' };
    return {
      id: String((item && item.id) || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      completedAt: (item && item.date) || new Date().toISOString(),
      mode: modes[item && item.mode] || 'focus',
      durationMs: number(item && item.totalTimeMs, 1000, 86400000, 60000),
      rounds: number(item && item.rounds, 1, 60, 1),
      score: number(item && item.score, 0, 9999, 0),
      scoreAo: number(item && item.scoreAo, 0, 9999, 0)
    };
  }

  function sanitizeHistoryList(rawHistory) {
    if (!Array.isArray(rawHistory)) return [];
    const seenIds = new Set();
    const sanitized = [];

    for (const item of rawHistory) {
      if (!item || typeof item !== 'object') continue;
      const rawCompleted = item.completedAt || item.date || Date.now();
      const timestamp = new Date(rawCompleted).valueOf();
      if (Number.isNaN(timestamp)) continue;
      const id = String(item.id || `${timestamp}-${Math.random().toString(16).slice(2)}`);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      sanitized.push({
        id,
        completedAt: new Date(timestamp).toISOString(),
        mode: VALID_MODES.includes(item.mode) ? item.mode : 'focus',
        durationMs: number(item.durationMs !== undefined ? item.durationMs : item.totalTimeMs, 1000, 86400000, 60000),
        rounds: number(item.rounds, 1, 60, 1),
        score: number(item.score, 0, 9999, 0),
        scoreAo: number(item.scoreAo, 0, 9999, 0)
      });
      if (sanitized.length >= 100) break;
    }
    return sanitized;
  }

  function sanitizeRoutineList(rawRoutines) {
    if (!Array.isArray(rawRoutines)) return [];
    const sanitized = [];
    for (const item of rawRoutines) {
      if (!item || typeof item !== 'object') continue;
      const name = String(item.name || '').trim().slice(0, 32);
      if (!name || !VALID_MODES.includes(item.mode)) continue;
      sanitized.push({
        id: String(item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        name,
        mode: item.mode,
        config: item.config && typeof item.config === 'object' ? item.config : {}
      });
      if (sanitized.length >= 12) break;
    }
    return sanitized;
  }

  function sanitizeStoredData(raw = {}) {
    const safeRaw = raw && typeof raw === 'object' ? raw : {};
    const random = (safeRaw.settings && safeRaw.settings.random) || {};
    const tabata = (safeRaw.settings && safeRaw.settings.tabata) || {};
    const emom = (safeRaw.settings && safeRaw.settings.emom) || {};
    const focus = (safeRaw.settings && safeRaw.settings.focus) || {};
    const prefs = safeRaw.preferences || {};

    return {
      activeMode: VALID_MODES.includes(safeRaw.activeMode) ? safeRaw.activeMode : defaults.activeMode,
      settings: {
        random: {
          minutes: number(random.minutes !== undefined ? random.minutes : safeRaw.timer_rnd_min, 1, 120, defaults.settings.random.minutes),
          alerts: number(random.alerts !== undefined ? random.alerts : safeRaw.timer_rnd_alerts, 1, 60, defaults.settings.random.alerts),
          rounds: number(random.rounds, 1, 60, defaults.settings.random.rounds),
          rest: number(random.rest, 0, 600, defaults.settings.random.rest),
          cueType: VALID_CUE_TYPES.includes(random.cueType) ? random.cueType : defaults.settings.random.cueType,
          combatFocus: VALID_COMBAT_FOCUS.includes(random.combatFocus) ? random.combatFocus : defaults.settings.random.combatFocus
        },
        tabata: {
          work: number(tabata.work !== undefined ? tabata.work : safeRaw.timer_tabata_work, 1, 600, defaults.settings.tabata.work),
          rest: number(tabata.rest !== undefined ? tabata.rest : safeRaw.timer_tabata_rest, 0, 600, defaults.settings.tabata.rest),
          rounds: number(tabata.rounds !== undefined ? tabata.rounds : safeRaw.timer_tabata_rounds, 1, 60, defaults.settings.tabata.rounds)
        },
        emom: {
          interval: number(emom.interval, 10, 600, defaults.settings.emom.interval),
          rounds: number(emom.rounds, 1, 60, defaults.settings.emom.rounds)
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
        prepSeconds: number(prefs.prepSeconds, 3, 15, defaults.preferences.prepSeconds),
        dualScore: typeof prefs.dualScore === 'boolean' ? prefs.dualScore : defaults.preferences.dualScore,
        volume: number(prefs.volume, 0, 100, defaults.preferences.volume),
        soundPack: VALID_SOUND_PACKS.includes(prefs.soundPack) ? prefs.soundPack : defaults.preferences.soundPack
      },
      savedRoutines: sanitizeRoutineList(safeRaw.savedRoutines),
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

  function applyUrlParams(targetState) {
    try {
      if (typeof location === 'undefined' || !location.search) return;
      const params = new URLSearchParams(location.search);
      const mode = params.get('mode');
      if (!VALID_MODES.includes(mode)) return;
      targetState.activeMode = mode;
      loadedFromUrl = true;

      if (mode === 'random') {
        targetState.settings.random.minutes = number(params.get('min'), 1, 120, targetState.settings.random.minutes);
        targetState.settings.random.alerts = number(params.get('alerts'), 1, 60, targetState.settings.random.alerts);
        targetState.settings.random.rounds = number(params.get('rounds'), 1, 60, targetState.settings.random.rounds);
        targetState.settings.random.rest = number(params.get('rest'), 0, 600, targetState.settings.random.rest);
        const cue = params.get('cue');
        if (VALID_CUE_TYPES.includes(cue)) targetState.settings.random.cueType = cue;
        const focus = params.get('focus');
        if (VALID_COMBAT_FOCUS.includes(focus)) targetState.settings.random.combatFocus = focus;
      } else if (mode === 'tabata') {
        targetState.settings.tabata.work = number(params.get('work'), 1, 600, targetState.settings.tabata.work);
        targetState.settings.tabata.rest = number(params.get('rest'), 0, 600, targetState.settings.tabata.rest);
        targetState.settings.tabata.rounds = number(params.get('rounds'), 1, 60, targetState.settings.tabata.rounds);
      } else if (mode === 'emom') {
        targetState.settings.emom.interval = number(params.get('interval'), 10, 600, targetState.settings.emom.interval);
        targetState.settings.emom.rounds = number(params.get('rounds'), 1, 60, targetState.settings.emom.rounds);
      } else if (mode === 'focus') {
        targetState.settings.focus.minutes = number(params.get('min'), 0, 99, targetState.settings.focus.minutes);
        targetState.settings.focus.seconds = number(params.get('sec'), 0, 59, targetState.settings.focus.seconds);
      }
    } catch (_) {}
  }

  const state = {
    ...loadStoredData(),
    ui: {
      settingsOpen: false,
      historyOpen: false,
      historyFilter: 'all',
      confirmClearHistory: false,
      routineNameDraft: '',
      installAvailable: Boolean(window.deferredInstallPrompt),
      alertFlash: false,
      lastCallout: '',
      toast: { visible: false, message: '', kind: 'success' },
      recoveryAvailable: false,
      recoverySnapshot: null
    },
    session: null
  };
  applyUrlParams(state);

  function getPlan(mode = state.activeMode, settings = state.settings) {
    const random = (settings && settings.random) || defaults.settings.random;
    const tabata = (settings && settings.tabata) || defaults.settings.tabata;
    const emom = (settings && settings.emom) || defaults.settings.emom;
    const focus = (settings && settings.focus) || defaults.settings.focus;

    if (mode === 'tabata') {
      const durationMs = (tabata.work * tabata.rounds + tabata.rest * Math.max(0, tabata.rounds - 1)) * 1000;
      return { mode, durationMs, workMs: tabata.work * 1000, restMs: tabata.rest * 1000, rounds: tabata.rounds, alerts: 0 };
    }
    if (mode === 'emom') {
      const workMs = emom.interval * 1000;
      const rounds = emom.rounds;
      return { mode, durationMs: workMs * rounds, workMs, restMs: 0, rounds, alerts: 0 };
    }
    if (mode === 'focus') {
      const durationMs = (focus.minutes * 60 + focus.seconds) * 1000;
      return { mode, durationMs, workMs: durationMs, restMs: 0, rounds: 1, alerts: 0 };
    }
    const workMs = random.minutes * 60000;
    const rounds = number(random.rounds, 1, 60, 1);
    const restSec = number(random.rest, 0, 600, 0);
    const restMs = rounds > 1 ? restSec * 1000 : 0;
    const durationMs = workMs * rounds + restMs * Math.max(0, rounds - 1);
    return {
      mode: 'random',
      durationMs,
      workMs,
      restMs,
      rounds,
      alerts: random.alerts,
      cueType: VALID_CUE_TYPES.includes(random.cueType) ? random.cueType : 'pip',
      combatFocus: VALID_COMBAT_FOCUS.includes(random.combatFocus) ? random.combatFocus : 'all'
    };
  }

  function createIdleSession(mode = state.activeMode) {
    const plan = getPlan(mode);
    const initialDisplayMs = plan.rounds > 1 ? plan.workMs : plan.durationMs;
    return {
      running: false,
      paused: false,
      phase: 'idle',
      plan,
      round: 1,
      score: 0,
      scoreAo: 0,
      lastSignalText: '',
      durationMs: initialDisplayMs,
      remainingMs: initialDisplayMs,
      phaseStartedAt: 0,
      endAt: 0,
      startedAt: 0,
      alertsFired: 0,
      alertSchedule: [],
      alertIndex: 0,
      cueFlags: {},
      timeAdjustedMs: 0,
      completed: false
    };
  }

  state.session = createIdleSession();

  const recoverySnap = readSessionSnapshot();
  if (recoverySnap) {
    state.ui.recoveryAvailable = true;
    state.ui.recoverySnapshot = recoverySnap;
  }

  function persist() {
    try {
      const { activeMode, settings, preferences, savedRoutines, history } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeMode,
        settings,
        preferences,
        savedRoutines,
        history
      }));
    } catch (_) {
      showToast('No se pudieron guardar los cambios en este navegador.', 'warning');
    }
  }

  function debouncedPersist(delay = 200) {
    clearTimeout(persistDebounceTimer);
    persistDebounceTimer = setTimeout(persist, delay);
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
    return ({
      random: 'Round aleatorio',
      tabata: 'Tabata',
      emom: 'EMOM',
      focus: 'Cuenta regresiva'
    })[mode] || 'Temporizador';
  }

  function cueTypeLabel(cueType) {
    return ({
      pip: 'Pip de reacción',
      numbers: 'Combos (1–4)',
      combat: 'Táctico (Karate / Combate)'
    })[cueType] || 'Pip de reacción';
  }

  function combatFocusLabel(focus) {
    return ({
      all: 'Completo',
      combinations: 'Combinaciones',
      displacements: 'Desplazamientos',
      actions: 'Reacción rápida'
    })[focus] || 'Completo';
  }

  function getWkfAdvantageText(s = state.session) {
    if (!state.preferences.dualScore || !s) return '';
    const diff = s.score - s.scoreAo;
    if (Math.abs(diff) >= 8) {
      return diff > 0 ? 'Ventaja 8 pts (Aka)' : 'Ventaja 8 pts (Ao)';
    }
    return '';
  }

  function persistSessionSnapshot() {
    const s = state.session;
    if (!s || (!s.running && !s.paused)) {
      try { sessionStorage.removeItem(SESSION_RECOVERY_KEY); } catch (_) {}
      return;
    }
    try {
      const phase = s.phase === 'prep' ? 'work' : s.phase;
      const remainingMs = s.phase === 'prep' ? (s.plan.workMs || s.plan.durationMs) : s.remainingMs;
      const durationMs = s.phase === 'prep' ? (s.plan.workMs || s.plan.durationMs) : s.durationMs;
      sessionStorage.setItem(SESSION_RECOVERY_KEY, JSON.stringify({
        savedAt: Date.now(),
        plan: s.plan,
        phase,
        round: s.round,
        score: s.score || 0,
        scoreAo: s.scoreAo || 0,
        durationMs,
        remainingMs,
        alertsFired: s.alertsFired || 0,
        alertIndex: s.alertIndex || 0,
        alertSchedule: s.alertSchedule || [],
        timeAdjustedMs: s.timeAdjustedMs || 0
      }));
    } catch (_) {}
  }

  function readSessionSnapshot() {
    try {
      const raw = sessionStorage.getItem(SESSION_RECOVERY_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      if (!snap || Date.now() - snap.savedAt > 4 * 60 * 60 * 1000) {
        sessionStorage.removeItem(SESSION_RECOVERY_KEY);
        return null;
      }
      return snap;
    } catch (_) { return null; }
  }

  function acceptSessionRecovery() {
    const snap = state.ui.recoverySnapshot;
    if (!snap) return;
    state.session = {
      ...createIdleSession(),
      running: false,
      paused: true,
      phase: snap.phase || 'work',
      plan: snap.plan,
      round: snap.round || 1,
      score: snap.score || 0,
      scoreAo: snap.scoreAo || 0,
      durationMs: snap.durationMs,
      remainingMs: snap.remainingMs,
      alertSchedule: snap.alertSchedule || [],
      alertIndex: snap.alertIndex || 0,
      alertsFired: snap.alertsFired || 0,
      timeAdjustedMs: snap.timeAdjustedMs || 0
    };
    state.ui.recoveryAvailable = false;
    state.ui.recoverySnapshot = null;
    try { sessionStorage.removeItem(SESSION_RECOVERY_KEY); } catch (_) {}
    render();
    showToast('Sesión anterior restaurada en pausa.');
  }

  function dismissSessionRecovery() {
    state.ui.recoveryAvailable = false;
    state.ui.recoverySnapshot = null;
    try { sessionStorage.removeItem(SESSION_RECOVERY_KEY); } catch (_) {}
    render();
  }

  function renderRecoveryBanner() {
    if (!state.ui.recoverySnapshot || !state.ui.recoverySnapshot.plan) return '';
    return `
      <div class="recovery-banner" role="alert">
        <span class="recovery-text">Sesión interrumpida · ${escapeHtml(modeLabel(state.ui.recoverySnapshot.plan.mode))}</span>
        <div class="recovery-actions">
          <button class="button button-tertiary" type="button" data-action="dismiss-recovery">Descartar</button>
          <button class="button button-primary recovery-btn" type="button" data-action="recover-session">Reanudar</button>
        </div>
      </div>`;
  }

  function getUpcomingPhaseInfo(s = state.session) {
    if (!s || (!s.running && !s.paused)) return '';
    const { plan } = s;
    if (!plan || plan.rounds <= 1) return '';

    if (s.phase === 'work' && s.round < plan.rounds) {
      if (plan.restMs > 0) {
        return `Luego: descanso ${Math.round(plan.restMs / 1000)}s · R${s.round + 1}/${plan.rounds}`;
      }
      return `Luego: R${s.round + 1}/${plan.rounds}`;
    }
    if (s.phase === 'rest') {
      return `Luego: R${s.round + 1}/${plan.rounds}`;
    }
    if (s.plan.mode === 'emom' && s.round < plan.rounds) {
      return `Luego: minuto ${s.round + 1}/${plan.rounds}`;
    }
    return '';
  }

  function renderUpcomingPhase(s = state.session) {
    if (!s || (!s.running && !s.paused)) return '';
    const info = getUpcomingPhaseInfo(s);
    return `<div class="upcoming-row" style="${info ? '' : 'display:none;'}"><span class="upcoming-chip" id="upcomingPhase">${escapeHtml(info)}</span></div>`;
  }

  function calculateStreakDays(history = state.history) {
    if (!history.length) return 0;
    const daySet = new Set(
      history.map(item => {
        const d = new Date(item.completedAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    );
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    const todayKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!daySet.has(todayKey)) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let streak = 0;
    while (true) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (!daySet.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function getWeeklyActivity(history = state.history) {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const days = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        key,
        label: i === 0 ? 'Hoy' : dayNames[d.getDay()],
        durationMs: 0,
        sessions: 0
      });
    }

    const map = new Map(days.map(item => [item.key, item]));
    for (const item of history) {
      const d = new Date(item.completedAt);
      if (Number.isNaN(d.valueOf())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const bucket = map.get(key);
      if (bucket) {
        bucket.durationMs += item.durationMs || 0;
        bucket.sessions += 1;
      }
    }
    const maxMs = Math.max(60000, ...days.map(d => d.durationMs));
    return days.map(d => ({
      ...d,
      heightPct: d.durationMs ? Math.max(14, Math.round((d.durationMs / maxMs) * 100)) : 6
    }));
  }

  function icon(name) {
    const paths = {
      clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
      play: '<path d="m8.5 5 9 7-9 7z" fill="currentColor" stroke="none"/>',
      pause: '<path d="M8 5.5v13M16 5.5v13"/>',
      reset: '<path d="M4.5 11a7.5 7.5 0 1 1 1.7 5.1"/><path d="M4.5 5.5V11H10"/>',
      skip: '<path d="m5.5 6 8.5 6-8.5 6z" fill="currentColor" stroke="none"/><path d="M18 6v12"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      minus: '<path d="M5 12h14"/>',
      share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.6M8.3 13.2l7.4 4.6"/>',
      bookmark: '<path d="M6 4.5h12a1 1 0 0 1 1 1v14l-7-4-7 4v-14a1 1 0 0 1 1-1z"/>',
      trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M7.5 7l.8 12.5h7.4L16.5 7"/>',
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
      if (state.ui.alertFlash) {
        return {
          label: state.ui.lastCallout || '¡Señal!',
          detail: 'Reaccioná al estímulo con máxima velocidad.'
        };
      }
      if (session.plan.mode === 'emom') {
        return { label: `Minuto ${session.round}`, detail: 'Completá la serie y usá el resto del bloque para recuperar.' };
      }
      return {
        label: session.plan.rounds > 1 ? `Ronda ${session.round}` : 'En marcha',
        detail: session.lastSignalText ? `Última señal: ${session.lastSignalText}` : 'Mantené el ritmo y seguí las señales.'
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

  function getTotalRemainingMs(session = state.session) {
    if (session.plan.rounds <= 1) return session.remainingMs;
    if (session.phase === 'idle' || session.phase === 'prep') return session.plan.durationMs;
    if (session.phase === 'finished') return 0;

    const futureRounds = Math.max(0, session.plan.rounds - session.round);
    const workMs = session.plan.workMs || session.durationMs;
    const restMs = session.plan.restMs || 0;

    if (session.phase === 'work') {
      const restAfterCurrent = session.round < session.plan.rounds ? restMs : 0;
      const futureWorkAndRest = futureRounds * workMs + Math.max(0, futureRounds - 1) * restMs;
      return session.remainingMs + restAfterCurrent + futureWorkAndRest;
    }
    if (session.phase === 'rest') {
      const futureWorkAndRest = futureRounds * workMs + Math.max(0, futureRounds - 1) * restMs;
      return session.remainingMs + futureWorkAndRest;
    }
    return session.remainingMs;
  }

  function updateDocumentTitle(s = state.session) {
    if (typeof document === 'undefined') return;
    if (s.running || s.paused) {
      const copy = getPhaseCopy(s);
      document.title = `(${displayValue(s)}) ${copy.label} · Timer Round`;
    } else {
      document.title = 'Timer Round';
    }
  }

  function canReset(s) {
    return s.running || s.paused || s.phase === 'finished';
  }

  function canSkipPhase(s) {
    if (!s.running && !s.paused) return false;
    if (s.phase === 'prep') return true;
    return s.plan.rounds > 1 && (s.phase === 'work' || s.phase === 'rest');
  }

  function render() {
    if (!app) return;
    const s = state.session;
    const phaseCopy = getPhaseCopy(s);
    const isLongKicker = phaseCopy.label.length > 16;
    const theme = s.paused ? 'paused' : ['prep', 'rest', 'finished'].includes(s.phase) ? s.phase : s.plan.mode;
    const isRunning = s.running;
    const isLocked = s.running || s.paused;
    const showPips = s.plan.rounds > 1 ? renderRoundPips(s.plan.rounds, s.round) : '';
    const actionText = isRunning ? 'Pausar' : s.paused ? 'Reanudar' : s.phase === 'finished' ? 'Empezar de nuevo' : 'Iniciar';
    const toast = state.ui.toast;
    const showLiveTools = isRunning || s.paused || s.score > 0 || s.scoreAo > 0;

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
            <button class="icon-button" type="button" data-action="share-config" title="Compartir enlace de esta rutina" aria-label="Compartir configuración">${icon('share')}</button>
            <button class="icon-button" type="button" data-action="fullscreen" title="Pantalla completa (F)" aria-label="Pantalla completa">${icon('fullscreen')}</button>
            <button class="icon-button" type="button" data-action="open-history" id="openHistoryButton" title="Ver historial" aria-label="Ver historial">${icon('history')}</button>
            <span class="connection-dot ${navigator.onLine ? '' : 'offline'}" id="connectionDot" role="status" aria-label="${navigator.onLine ? 'Con conexión' : 'Sin conexión'}" title="${navigator.onLine ? 'Con conexión' : 'Sin conexión'}"></span>
          </div>
        </header>

        ${state.ui.recoveryAvailable && state.ui.recoverySnapshot ? renderRecoveryBanner() : ''}

        <div class="mode-tabs" aria-label="Tipo de entrenamiento" role="tablist">
          ${renderModeTab('random', 'Aleatorio', isLocked)}
          ${renderModeTab('tabata', 'Tabata', isLocked)}
          ${renderModeTab('emom', 'EMOM', isLocked)}
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
                <div class="phase-kicker ${isLongKicker ? 'compact-kicker' : ''}" id="phaseLabel" aria-live="polite">${escapeHtml(phaseCopy.label)}</div>
                <div class="time-value ${s.phase === 'prep' ? 'countdown' : ''}" id="timeValue" aria-live="off">${displayValue(s)}</div>
                <div class="phase-detail" id="phaseDetail">${escapeHtml(phaseCopy.detail)}</div>
              </div>
            </div>
          </div>
          <div class="mode-summary" id="modeSummary">${modeSummaryMarkup(s, showPips)}</div>
          ${renderUpcomingPhase(s)}
          ${showLiveTools ? renderLiveTools(s) : ''}
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

  function renderLiveTools(s) {
    const canAdjustTime = (s.running || s.paused) && s.phase !== 'prep';
    const isDual = state.preferences.dualScore;
    const advText = getWkfAdvantageText(s);

    return `
      <div class="live-counter-row">
        ${canAdjustTime ? `
          <div class="time-adjust-group" role="group" aria-label="Ajustar tiempo del bloque actual">
            <button class="counter-reset" type="button" data-action="adjust-time" data-delta-ms="-15000" title="Restar 15 segundos">−15s</button>
            <button class="counter-reset" type="button" data-action="adjust-time" data-delta-ms="15000" title="Sumar 15 segundos">+15s</button>
          </div>
        ` : ''}
        ${isDual ? `
          <div class="dual-score-group" role="group" aria-label="Marcador Aka vs Ao">
            <div class="score-fighter aka">
              <button class="score-step" type="button" data-action="decrement-score" aria-label="Restar Aka">−</button>
              <button class="score-main" type="button" data-action="increment-score" title="Punto Aka (Tecla C)">Aka <strong id="scoreValue">${s.score}</strong></button>
            </div>
            <button class="counter-reset dual-reset-btn" type="button" data-action="reset-score" aria-label="Reiniciar Aka y Ao" title="Reiniciar ambos a 0">↺</button>
            <div class="score-fighter ao">
              <button class="score-main" type="button" data-action="increment-score-ao" title="Punto Ao (Tecla V)">Ao <strong id="scoreAoValue">${s.scoreAo}</strong></button>
              <button class="score-step" type="button" data-action="decrement-score-ao" aria-label="Restar Ao">−</button>
            </div>
            <span class="score-advantage-badge" id="wkfAdvantageBadge" style="${advText ? '' : 'display: none;'}">${advText}</span>
          </div>
        ` : `
          <div class="single-score-group">
            <button class="counter-reset" type="button" data-action="decrement-score" aria-label="Restar 1 al marcador" ${s.score > 0 ? '' : 'disabled'}>−</button>
            <button class="counter-pill" type="button" data-action="increment-score" title="Registrar serie, combo o punto (Tecla C)">
              ${icon('plus')}
              <span>Marcador: <strong id="scoreValue">${s.score}</strong></span>
            </button>
            ${s.score > 0 ? `<button class="counter-reset" type="button" data-action="reset-score" title="Reiniciar a 0">0</button>` : ''}
          </div>
        `}
      </div>
    `;
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
    if (s.plan.mode === 'tabata' || s.plan.mode === 'emom') {
      return `Ronda <strong id="roundNumber">${s.round}/${s.plan.rounds}</strong>`;
    }
    if (s.plan.mode === 'random') {
      const roundPart = s.plan.rounds > 1 ? `R<strong id="roundNumber">${s.round}/${s.plan.rounds}</strong> · ` : '';
      return `${roundPart}Señales <strong id="alertsNumber">${s.alertsFired}/${s.alertSchedule.length || s.plan.alerts}</strong>`;
    }
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

  function modeSummaryMarkup(s, showPips) {
    const totalRem = getTotalRemainingMs(s);
    const remainingChip = (s.running || s.paused) && s.plan.rounds > 1
      ? ` · Total <strong id="totalRemainingValue">${formatTime(totalRem)}</strong>`
      : '';

    if (s.plan.mode === 'tabata') {
      return `${showPips}<span>Trabajo ${state.settings.tabata.work}s · Descanso ${state.settings.tabata.rest}s${remainingChip}</span>`;
    }
    if (s.plan.mode === 'emom') {
      return `${showPips}<span>Cada <strong>${state.settings.emom.interval}s</strong> · ${s.plan.rounds} rondas${remainingChip}</span>`;
    }
    if (s.plan.mode === 'random') {
      const cueCopy = s.plan.cueType !== 'pip' ? ` · ${cueTypeLabel(s.plan.cueType)}` : '';
      return `${showPips}<span>Total <strong id="summaryDuration">${formatDuration(s.plan.durationMs)}</strong></span><span>·</span><span><strong id="summaryAlerts">${s.plan.alerts}</strong> señales/round${cueCopy}${remainingChip}</span>`;
    }
    return `<span>Duración <strong id="summaryDuration">${formatDuration(s.plan.durationMs)}</strong></span>`;
  }

  function renderSettings(isPaused = false) {
    const isOpen = state.ui.settingsOpen;
    return `
      <section class="surface settings-card ${isOpen ? 'open' : ''}" aria-label="Configuración">
        <button class="settings-heading" type="button" data-action="toggle-settings" aria-expanded="${isOpen}" aria-controls="settingsBody">
          <span>
            <span class="settings-title">Configuración y Rutinas</span>
            <span class="settings-caption">${isPaused ? 'Sesión en pausa · podés ajustar señales y volumen' : 'Personalizá rondas, estímulos, rutinas y audio'}</span>
          </span>
          <i class="chevron" aria-hidden="true"></i>
        </button>
        <div class="settings-body" id="settingsBody">
          ${isPaused ? '<p class="paused-notice">Reiniciá la sesión si querés modificar la duración o cambiar de modo.</p>' : ''}
          ${!isPaused && state.activeMode === 'random' ? renderRandomSettings() : ''}
          ${!isPaused && state.activeMode === 'tabata' ? renderTabataSettings() : ''}
          ${!isPaused && state.activeMode === 'emom' ? renderEmomSettings() : ''}
          ${!isPaused && state.activeMode === 'focus' ? renderFocusSettings() : ''}
          ${!isPaused ? renderSavedRoutinesSection() : ''}
          ${renderPreferences()}
        </div>
      </section>`;
  }

  function renderRandomSettings() {
    const config = state.settings.random;
    const total = getPlan('random').durationMs;
    return `<div class="settings-section">
      <h2 class="section-title">Round aleatorio y reacción</h2>
      <p class="section-help">Señales con separación mínima garantizada. Duración total: <strong id="randomTotalPreview">${formatDuration(total)}</strong>.</p>
      <div class="preset-grid preset-grid-wrap" aria-label="Preajustes de Round aleatorio">
        ${RANDOM_PRESETS.map((p, idx) => {
          const isCurrent = config.minutes === p.minutes && config.alerts === p.alerts && config.rounds === p.rounds && config.rest === p.rest;
          return `<button class="preset-button ${isCurrent ? 'active' : ''}" type="button" data-action="random-preset" data-preset-index="${idx}">${p.label}</button>`;
        }).join('')}
      </div>
      <div class="config-grid two-by-two" style="margin-top:14px">
        ${numberField('Minutos / round', 'random.minutes', config.minutes, 1, 120, 'minutes')}
        ${numberField('Señales / round', 'random.alerts', config.alerts, 1, 60, 'alerts')}
        ${numberField('Rondas', 'random.rounds', config.rounds, 1, 60, 'random-rounds')}
        ${numberField('Descanso (s)', 'random.rest', config.rest, 0, 600, 'random-rest')}
      </div>
      <div class="cue-type-block">
        <span class="field-label">Tipo de estímulo en cada señal</span>
        <div class="preset-grid three-cols" style="margin-top:7px">
          ${VALID_CUE_TYPES.map(type => `
            <button class="preset-button ${config.cueType === type ? 'active' : ''}" type="button" data-action="set-cue-type" data-cue-type="${type}">
              ${cueTypeLabel(type)}
            </button>
          `).join('')}
        </div>
      </div>
      ${config.cueType === 'combat' ? `
        <div class="cue-type-block">
          <span class="field-label">Repertorio táctico de Karate / Combate</span>
          <div class="preset-grid preset-grid-wrap" style="margin-top:7px">
            ${VALID_COMBAT_FOCUS.map(focus => `
              <button class="preset-button ${config.combatFocus === focus ? 'active' : ''}" type="button" data-action="set-combat-focus" data-combat-focus="${focus}">
                ${combatFocusLabel(focus)}
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
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

  function renderEmomSettings() {
    const config = state.settings.emom;
    const total = getPlan('emom').durationMs;
    return `<div class="settings-section">
      <h2 class="section-title">EMOM (Cada minuto en el minuto)</h2>
      <p class="section-help">Iniciá cada serie al sonar la campana; el tiempo que te sobre es tu descanso. Total: <strong id="emomTotalPreview">${formatDuration(total)}</strong>.</p>
      <div class="preset-grid preset-grid-wrap" aria-label="Preajustes EMOM">
        ${EMOM_PRESETS.map((p, idx) => {
          const isCurrent = config.interval === p.interval && config.rounds === p.rounds;
          return `<button class="preset-button ${isCurrent ? 'active' : ''}" type="button" data-action="emom-preset" data-preset-index="${idx}">${p.label}</button>`;
        }).join('')}
      </div>
      <div class="config-grid" style="margin-top:14px">
        ${numberField('Cada cuántos seg.', 'emom.interval', config.interval, 10, 600, 'emom-interval')}
        ${numberField('Rondas totales', 'emom.rounds', config.rounds, 1, 60, 'emom-rounds')}
      </div>
    </div>`;
  }

  function renderFocusSettings() {
    const config = state.settings.focus;
    return `<div class="settings-section">
      <h2 class="section-title">Cuenta regresiva</h2>
      <p class="section-help">Ideal para bloques de estudio, isométricos o pausas de recuperación.</p>
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

  function renderSavedRoutinesSection() {
    const routines = state.savedRoutines;
    return `<div class="settings-section">
      <h2 class="section-title">Mis rutinas guardadas</h2>
      <p class="section-help">Guardá la configuración actual para cargarla en un toque cuando quieras.</p>
      <div class="routine-save-row">
        <input class="text-input" id="routineNameInput" type="text" maxlength="32" placeholder="Ej: Kumite 2m×3, Pliometría, Pomodoro…" value="${escapeHtml(state.ui.routineNameDraft)}" aria-label="Nombre de la rutina">
        <button class="button button-tertiary" type="button" data-action="save-routine">${icon('bookmark')}<span>Guardar actual</span></button>
      </div>
      ${routines.length ? `
        <div class="routine-list">
          ${routines.map(item => `
            <div class="routine-chip">
              <button class="routine-load" type="button" data-action="load-routine" data-routine-id="${escapeHtml(item.id)}">
                <span class="routine-tag">${modeLabel(item.mode)}</span>
                <span class="routine-name">${escapeHtml(item.name)}</span>
              </button>
              <button class="routine-delete" type="button" data-action="delete-routine" data-routine-id="${escapeHtml(item.id)}" aria-label="Eliminar rutina ${escapeHtml(item.name)}">${icon('close')}</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
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
      <div class="switch-row">${switchCopy('Sonidos y tablilla (10s)', 'Campana, pips de reacción y clapper en los últimos 10s', 'sound', prefs.sound)}</div>
      <div class="switch-row">${switchCopy('Voz', 'Indicaciones y estímulos tácticos en español', 'voice', prefs.voice)}</div>
      <div class="switch-row">${switchCopy('Vibración', 'Refuerzo háptico si tu dispositivo lo permite', 'vibration', prefs.vibration)}</div>
      <div class="switch-row">${switchCopy('Marcador dual (Aka / Ao)', 'Doble tanteador para sparring y combate por puntos', 'dualScore', prefs.dualScore)}</div>
      <div class="switch-row">${switchCopy('Cuenta previa', 'Conteo regresivo antes de arrancar el primer round', 'preparation', prefs.preparation)}</div>
      ${prefs.preparation ? `
        <div class="prep-duration-row">
          <span class="field-label">Segundos de preparación</span>
          <div class="preset-grid three-cols" style="margin-top:6px">
            ${[3, 5, 10].map(sec => `
              <button class="preset-button ${prefs.prepSeconds === sec ? 'active' : ''}" type="button" data-action="set-prep-seconds" data-value="${sec}">${sec} s</button>
            `).join('')}
          </div>
        </div>
      ` : ''}
      <div class="cue-type-block" style="margin-top:10px">
        <span class="field-label">Pack de sonido</span>
        <div class="preset-grid three-cols" style="margin-top:7px">
          ${VALID_SOUND_PACKS.map(key => `
            <button class="preset-button ${prefs.soundPack === key ? 'active' : ''}"
                    type="button"
                    data-action="set-sound-pack"
                    data-sound-pack="${key}">
              ${soundPackLabel(key)}
            </button>
          `).join('')}
        </div>
      </div>
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
          <span><kbd>C</kbd> +1 Aka/Serie</span>
          <span><kbd>V</kbd> +1 Ao</span>
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
    const filter = state.ui.historyFilter;
    const filtered = filter === 'all' ? history : history.filter(item => item.mode === filter);
    const total = history.reduce((sum, item) => sum + item.durationMs, 0);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekTotal = history.filter(item => new Date(item.completedAt) >= weekStart).reduce((sum, item) => sum + item.durationMs, 0);
    const streakDays = calculateStreakDays(history);
    const weeklyChart = getWeeklyActivity(history);
    const confirming = state.ui.confirmClearHistory;

    return `<div class="modal-backdrop" data-action="close-history">
      <section class="history-modal" role="dialog" aria-modal="true" aria-labelledby="historyTitle" data-modal-content>
        <div class="history-heading">
          <div>
            <h2 id="historyTitle">Tu historial y progreso</h2>
            <p>Las sesiones se guardan en este dispositivo. Podés filtrarlas o exportarlas en JSON.</p>
          </div>
          <button class="icon-button" type="button" id="closeHistoryButton" data-action="close-history" aria-label="Cerrar historial">${icon('close')}</button>
        </div>
        <div class="history-stats four-stats">
          <div class="stat"><span class="stat-value">${history.length}</span><span class="stat-label">Sesiones</span></div>
          <div class="stat"><span class="stat-value">${streakDays} ${streakDays === 1 ? 'día' : 'días'}</span><span class="stat-label">Racha actual</span></div>
          <div class="stat"><span class="stat-value">${formatDuration(weekTotal)}</span><span class="stat-label">Esta semana</span></div>
          <div class="stat"><span class="stat-value">${formatDuration(total)}</span><span class="stat-label">Acumulado</span></div>
        </div>
        <div class="weekly-chart" aria-label="Actividad de los últimos 7 días">
          ${weeklyChart.map(day => `
            <div class="chart-col" title="${day.label}: ${formatDuration(day.durationMs)} (${day.sessions} sesiones)">
              <div class="chart-bar-wrap">
                <div class="chart-bar ${day.durationMs > 0 ? 'has-data' : ''}" style="height:${day.heightPct}%"></div>
              </div>
              <span class="chart-label">${day.label}</span>
            </div>
          `).join('')}
        </div>
        <div class="history-tools">
          <div class="history-filters" role="group" aria-label="Filtrar por modo">
            ${[
              ['all', 'Todos'],
              ['random', 'Aleatorio'],
              ['tabata', 'Tabata'],
              ['emom', 'EMOM'],
              ['focus', 'Tiempo']
            ].map(([key, label]) => `
              <button class="filter-chip ${filter === key ? 'active' : ''}" type="button" data-action="filter-history" data-filter="${key}">${label}</button>
            `).join('')}
          </div>
          <div class="history-io">
            <button class="button button-tertiary" type="button" data-action="export-history" ${history.length ? '' : 'disabled'}>${icon('download')}<span>Exportar</span></button>
            <label class="button button-tertiary file-button" tabindex="0">
              ${icon('upload')}<span>Importar</span>
              <input type="file" id="importHistoryInput" accept="application/json,.json" class="hidden">
            </label>
          </div>
        </div>
        <div class="history-list">${filtered.length ? filtered.map(renderHistoryItem).join('') : '<p class="empty-history">No hay sesiones registradas en esta vista.</p>'}</div>
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
    const roundsInfo = item.rounds > 1 ? `${item.rounds} rondas` : modeLabel(item.mode);
    let scoreInfo = '';
    if (item.score > 0 || item.scoreAo > 0) {
      scoreInfo = item.scoreAo > 0
        ? ` · Aka ${item.score} - ${item.scoreAo} Ao`
        : ` · ${item.score} pts/series`;
    }
    const date = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.completedAt));
    return `
      <article class="history-item">
        <div>
          <div class="history-mode">${modeLabel(item.mode)}</div>
          <div class="history-date">${date}</div>
        </div>
        <div class="history-right">
          <div class="history-duration">${formatDuration(item.durationMs)}<span class="history-detail">${roundsInfo}${scoreInfo}</span></div>
          <button class="icon-button history-delete-btn" type="button" data-action="delete-history-item" data-history-id="${escapeHtml(item.id)}" title="Borrar esta sesión" aria-label="Borrar esta sesión">${icon('trash')}</button>
        </div>
      </article>`;
  }

  function updateLiveUi() {
    const s = state.session;
    updateDocumentTitle(s);
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
    phase.classList.toggle('compact-kicker', copy.label.length > 16);
    detail.textContent = copy.detail;
    ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progressFor(s)));
    card.dataset.phase = s.paused ? 'paused' : s.phase;
    card.dataset.theme = s.paused ? 'paused' : ['prep', 'rest', 'finished'].includes(s.phase) ? s.phase : s.plan.mode;
    card.classList.toggle('alert-flash', Boolean(state.ui.alertFlash));

    const alerts = document.getElementById('alertsNumber');
    if (alerts) alerts.textContent = `${s.alertsFired}/${s.alertSchedule.length || s.plan.alerts}`;
    const round = document.getElementById('roundNumber');
    if (round) round.textContent = `${s.round}/${s.plan.rounds}`;
    const totalRemNode = document.getElementById('totalRemainingValue');
    if (totalRemNode) totalRemNode.textContent = formatTime(getTotalRemainingMs(s));
    const scoreNode = document.getElementById('scoreValue');
    if (scoreNode) scoreNode.textContent = String(s.score);
    const scoreAoNode = document.getElementById('scoreAoValue');
    if (scoreAoNode) scoreAoNode.textContent = String(s.scoreAo);

    updateWkfAdvantageBadge(s);

    const upcoming = document.getElementById('upcomingPhase');
    if (upcoming) {
      const info = getUpcomingPhaseInfo(s);
      upcoming.textContent = info;
      const row = upcoming.closest('.upcoming-row');
      if (row) row.style.display = info ? 'flex' : 'none';
    }

    const summaryDuration = document.getElementById('summaryDuration');
    if (summaryDuration) summaryDuration.textContent = formatDuration(s.plan.durationMs);
    const summaryAlerts = document.getElementById('summaryAlerts');
    if (summaryAlerts) summaryAlerts.textContent = String(s.plan.alerts);
    const randomPreview = document.getElementById('randomTotalPreview');
    if (randomPreview) randomPreview.textContent = formatDuration(getPlan('random').durationMs);
    const tabataPreview = document.getElementById('tabataTotalPreview');
    if (tabataPreview) tabataPreview.textContent = formatDuration(getPlan('tabata').durationMs);
    const emomPreview = document.getElementById('emomTotalPreview');
    if (emomPreview) emomPreview.textContent = formatDuration(getPlan('emom').durationMs);

    document.querySelectorAll('[data-round-pip]').forEach(pip => {
      const current = Number(pip.dataset.roundPip);
      pip.classList.toggle('complete', current < s.round);
      pip.classList.toggle('current', current === s.round);
    });
  }

  function updateWkfAdvantageBadge(s) {
    const badge = document.getElementById('wkfAdvantageBadge');
    const advText = getWkfAdvantageText(s);
    if (badge) {
      badge.textContent = advText;
      badge.style.display = advText ? 'inline-flex' : 'none';
    }
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

  function triggerAlertFlash(calloutText = '¡Señal!') {
    clearTimeout(alertFlashTimer);
    state.ui.alertFlash = true;
    state.ui.lastCallout = calloutText;
    state.session.lastSignalText = calloutText;
    updateLiveUi();
    alertFlashTimer = setTimeout(() => {
      state.ui.alertFlash = false;
      state.ui.lastCallout = '';
      updateLiveUi();
    }, 1400);
  }

  function fireRandomReactionStimulus(plan) {
    playCue('alert');
    let callout = '¡Señal!';
    if (plan.cueType === 'numbers') {
      callout = NUMBER_CALLOUTS[Math.floor(Math.random() * NUMBER_CALLOUTS.length)];
      later(() => say(callout, true), 95);
    } else if (plan.cueType === 'combat') {
      callout = generateKarateCallout(plan.combatFocus);
      later(() => say(callout, true), 95);
    }
    triggerAlertFlash(callout);
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
      persistSessionSnapshot();
      return;
    }

    const usePrep = state.preferences.preparation;
    const prepDurationMs = number(state.preferences.prepSeconds, 3, 15, 3) * 1000;
    const firstWorkMs = currentPlan.workMs || currentPlan.durationMs;
    const firstPhaseDuration = usePrep ? prepDurationMs : firstWorkMs;
    const initialCountdownSec = Math.ceil(firstPhaseDuration / 1000);

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
      alertSchedule: currentPlan.mode === 'random' ? createRandomSchedule(firstWorkMs, currentPlan.alerts) : [],
      cueFlags: { countdownSecond: usePrep ? Math.min(4, initialCountdownSec) : 4 }
    };
    if (state.session.phase === 'work') {
      announceWorkStart(true);
    } else {
      playCue('prep');
    }
    render();
    scheduleTick();
    persistSessionSnapshot();
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
    persistSessionSnapshot();
  }

  function resetSession() {
    clearFeedbackQueue();
    stopTick();
    clearTimeout(alertFlashTimer);
    state.ui.alertFlash = false;
    state.ui.lastCallout = '';
    releaseWakeLock();
    try { sessionStorage.removeItem(SESSION_RECOVERY_KEY); } catch (_) {}
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

  function adjustRemainingTime(deltaMs) {
    const s = state.session;
    if ((!s.running && !s.paused) || s.phase === 'prep' || s.phase === 'finished') return;
    const now = Date.now();
    const currentRem = s.running ? Math.max(0, s.endAt - now) : s.remainingMs;
    const nextRem = Math.max(1000, Math.min(7200000, currentRem + deltaMs));
    const appliedDelta = nextRem - currentRem;

    s.remainingMs = nextRem;
    s.durationMs = Math.max(s.durationMs + appliedDelta, nextRem);
    s.timeAdjustedMs = (s.timeAdjustedMs || 0) + appliedDelta;

    if (s.running) s.endAt = now + nextRem;
    if (nextRem > 10000) s.cueFlags.tenSeconds = false;
    updateLiveUi();
  }

  function animateScoreBump(fighter = 'aka') {
    const id = fighter === 'ao' ? 'scoreAoValue' : 'scoreValue';
    const node = document.getElementById(id);
    if (!node) return;
    const target = node.closest('.counter-pill, .score-main') || node;
    target.classList.remove('score-bump');
    void target.offsetWidth;
    target.classList.add('score-bump');
    window.setTimeout(() => target.classList.remove('score-bump'), 400);
  }

  function incrementScore(delta = 1, fighter = 'aka') {
    const s = state.session;
    const oldScore = s.score;
    const oldScoreAo = s.scoreAo;

    if (fighter === 'ao') {
      s.scoreAo = Math.max(0, Math.min(9999, (s.scoreAo || 0) + delta));
    } else {
      s.score = Math.max(0, Math.min(9999, (s.score || 0) + delta));
    }

    const scoreNode = document.getElementById('scoreValue');
    const scoreAoNode = document.getElementById('scoreAoValue');

    if (scoreNode) {
      if (fighter === 'ao' && scoreAoNode) {
        scoreAoNode.textContent = String(s.scoreAo);
      } else {
        scoreNode.textContent = String(s.score);
      }
      updateWkfAdvantageBadge(s);

      if (delta > 0) animateScoreBump(fighter);

      // Si no es dual y cambiamos de 0 a >0 (o viceversa), re-renderizamos para mostrar/ocultar el botón reset
      if (!state.preferences.dualScore && ((oldScore === 0 && s.score > 0) || (oldScore > 0 && s.score === 0))) {
        render();
      }
    } else {
      render();
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
      if (s.round >= s.plan.rounds) {
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
    const workMs = s.plan.workMs || s.plan.durationMs;
    s.phase = 'work';
    s.durationMs = workMs;
    s.remainingMs = workMs;
    s.phaseStartedAt = boundaryAt;
    s.endAt = boundaryAt + workMs;
    s.lastSignalText = '';
    s.cueFlags = {};
    if (s.plan.mode === 'random') {
      s.alertIndex = 0;
      s.alertsFired = 0;
      s.alertSchedule = createRandomSchedule(workMs, s.plan.alerts);
    }
  }

  function announceWorkStart(withCue) {
    const s = state.session;
    if (withCue) playCue('go');
    let msg = 'Comenzamos';
    if (s.plan.mode === 'emom') {
      msg = `Minuto ${s.round}`;
    } else if (s.plan.rounds > 1) {
      msg = `Ronda ${s.round}. A trabajar`;
    }
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
        fireRandomReactionStimulus(s.plan);
      }
    }
    if (s.durationMs >= 40000 && !s.cueFlags.halfway && s.remainingMs <= s.durationMs / 2) {
      s.cueFlags.halfway = true;
      say('Mitad de tiempo');
    }
    if (s.durationMs >= 15000 && !s.cueFlags.tenSeconds && s.remainingMs <= 10000) {
      s.cueFlags.tenSeconds = true;
      playCue('clapper');
      later(() => say('Diez segundos'), 260);
    }
    if (s.plan.mode === 'emom' && remainingSeconds > 0 && remainingSeconds <= 3 && remainingSeconds !== s.cueFlags.countdownSecond) {
      s.cueFlags.countdownSecond = remainingSeconds;
      playCue('countdown');
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
    state.ui.lastCallout = '';
    releaseWakeLock();
    try { sessionStorage.removeItem(SESSION_RECOVERY_KEY); } catch (_) {}
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
      durationMs: Math.max(1000, s.plan.durationMs + (s.timeAdjustedMs || 0)),
      rounds: s.plan.rounds,
      score: s.score || 0,
      scoreAo: s.scoreAo || 0
    });
    state.history = state.history.slice(0, 100);
    persist();
  }

  function buildShareableUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    const mode = state.activeMode;
    url.searchParams.set('mode', mode);
    const cfg = state.settings[mode];
    if (mode === 'random') {
      url.searchParams.set('min', cfg.minutes);
      url.searchParams.set('alerts', cfg.alerts);
      url.searchParams.set('rounds', cfg.rounds);
      url.searchParams.set('rest', cfg.rest);
      url.searchParams.set('cue', cfg.cueType);
      if (cfg.cueType === 'combat' && cfg.combatFocus) {
        url.searchParams.set('focus', cfg.combatFocus);
      }
    } else if (mode === 'tabata') {
      url.searchParams.set('work', cfg.work);
      url.searchParams.set('rest', cfg.rest);
      url.searchParams.set('rounds', cfg.rounds);
    } else if (mode === 'emom') {
      url.searchParams.set('interval', cfg.interval);
      url.searchParams.set('rounds', cfg.rounds);
    } else if (mode === 'focus') {
      url.searchParams.set('min', cfg.minutes);
      url.searchParams.set('sec', cfg.seconds);
    }
    return url.toString();
  }

  async function shareCurrentConfig() {
    const shareUrl = buildShareableUrl();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Timer Round · ${modeLabel(state.activeMode)}`,
          url: shareUrl
        });
        return;
      }
    } catch (_) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Enlace de la rutina copiado al portapapeles.');
        return;
      }
    } catch (_) {}
    window.history.replaceState(null, '', shareUrl);
    showToast('URL actualizada en la barra de direcciones.');
  }

  function saveCurrentRoutine() {
    const input = document.getElementById('routineNameInput');
    const rawName = (input ? input.value : state.ui.routineNameDraft).trim();
    const mode = state.activeMode;
    const defaultName = `${modeLabel(mode)} (${formatDuration(getPlan(mode).durationMs)})`;
    const name = (rawName || defaultName).slice(0, 32);

    const configCopy = JSON.parse(JSON.stringify(state.settings[mode]));
    state.savedRoutines.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      name,
      mode,
      config: configCopy
    });
    state.savedRoutines = state.savedRoutines.slice(0, 12);
    state.ui.routineNameDraft = '';
    persist();
    render();
    showToast(`Rutina "${name}" guardada.`);
  }

  function loadRoutineById(routineId) {
    if (state.session.running || state.session.paused) {
      showToast('Reiniciá la sesión actual para cargar una rutina.', 'warning');
      return;
    }
    const found = state.savedRoutines.find(r => r.id === routineId);
    if (!found) return;
    state.activeMode = found.mode;
    state.settings[found.mode] = {
      ...state.settings[found.mode],
      ...found.config
    };
    const sanitized = sanitizeStoredData(state);
    state.settings = sanitized.settings;
    state.session = createIdleSession(state.activeMode);
    persist();
    render();
    showToast(`Rutina "${found.name}" cargada.`);
  }

  function deleteRoutineById(routineId) {
    state.savedRoutines = state.savedRoutines.filter(r => r.id !== routineId);
    persist();
    render();
    showToast('Rutina eliminada.');
  }

  function exportHistoryJson() {
    if (!state.history.length) return;
    try {
      const payload = JSON.stringify({
        exportedAt: new Date().toISOString(),
        app: 'Timer Round',
        version: 4,
        savedRoutines: state.savedRoutines,
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
        ).slice(0, 100);
        state.history = merged;
        if (Array.isArray(parsed.savedRoutines)) {
          state.savedRoutines = sanitizeRoutineList([...parsed.savedRoutines, ...state.savedRoutines]);
        }
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
        audioUnlocked = false;
      }
      if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
        audioContext.resume().catch(() => {});
      }
      if (!audioUnlocked) {
        try {
          const buffer = audioContext.createBuffer(1, 1, 22050);
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext.destination);
          source.start(0);
          if (audioContext.state === 'running') {
            audioUnlocked = true;
          }
        } catch (_) {}
      }
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

        const userVol = Math.max(0, Math.min(100, state.preferences.volume)) / 100;
        const peakVolume = Math.max(0.02, userVol * 0.85 * gainMultiplier);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);

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
      ctx.resume().then(() => {
        if (ctx.state === 'running') executeTone();
      }).catch(() => {});
    } else {
      executeTone();
    }
  }

  function playCue(kind) {
    if (!state.preferences.sound && !state.preferences.vibration) return;
    const pack = SOUND_PACKS[state.preferences.soundPack] || SOUND_PACKS.classic;

    if (state.preferences.sound) {
      if (kind === 'rest') {
        playTone(520, 0.24, 'sine');
        later(() => playTone(390, 0.32, 'sine'), 120);
      } else if (typeof pack[kind] === 'function') {
        pack[kind]();
      } else {
        playTone(900, 0.18, 'triangle');
      }
    }

    if (kind === 'prep') vibrate([60, 40, 60]);
    else if (kind === 'countdown') vibrate([50]);
    else if (kind === 'go') vibrate([180]);
    else if (kind === 'rest') vibrate([100, 60, 100]);
    else if (kind === 'alert') vibrate([45]);
    else if (kind === 'clapper') vibrate([35, 35, 35]);
    else if (kind === 'finish') vibrate([100, 80, 100, 80, 250]);
    else vibrate([60]);
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
      const spokenText = formatSpeechText(text);
      const utterance = new SpeechSynthesisUtterance(spokenText);
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
    activeOscillators.forEach(oscillator => {
      try {
        oscillator.stop();
        oscillator.disconnect();
      } catch (_) {}
    });
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
    if (!VALID_MODES.includes(mode)) return;
    if (state.session.running || state.session.paused) {
      showToast('Reiniciá la sesión actual para cambiar de modo.', 'warning');
      return;
    }
    state.activeMode = mode;
    state.session = createIdleSession(mode);
    persist();
    render();
  }

  function updateSetting(field, rawValue, shouldRender = false, immediatePersist = true) {
    const range = FIELD_RANGES[field];
    if (!range) return;
    const [group, key] = field.split('.');

    if (group === 'preferences') {
      const fallback = state.preferences[key] !== undefined ? state.preferences[key] : range[0];
      state.preferences[key] = number(rawValue, range[0], range[1], fallback);
      if (immediatePersist) {
        persist();
      } else {
        debouncedPersist(200);
      }
      const label = document.getElementById('volumeValue');
      if (label && key === 'volume') label.textContent = `${state.preferences.volume}%`;
      if (shouldRender) render();
      return;
    }

    if (state.session.running || state.session.paused) return;
    const target = state.settings[group];
    if (!target) return;
    const fallback = target[key] !== undefined ? target[key] : range[0];
    target[key] = number(rawValue, range[0], range[1], fallback);
    state.session = createIdleSession();

    if (immediatePersist) {
      persist();
    } else {
      debouncedPersist(200);
    }

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
    if (action === 'adjust-time') {
      return adjustRemainingTime(Number(button.dataset.deltaMs || 0));
    }
    if (action === 'increment-score') {
      playTone(1320, 0.045, 'sine', 0.45);
      return incrementScore(1, 'aka');
    }
    if (action === 'decrement-score') {
      return incrementScore(-1, 'aka');
    }
    if (action === 'increment-score-ao') {
      playTone(980, 0.045, 'sine', 0.45);
      return incrementScore(1, 'ao');
    }
    if (action === 'decrement-score-ao') {
      return incrementScore(-1, 'ao');
    }
    if (action === 'reset-score') {
      state.session.score = 0;
      state.session.scoreAo = 0;
      const scoreNode = document.getElementById('scoreValue');
      if (scoreNode) scoreNode.textContent = '0';
      const scoreAoNode = document.getElementById('scoreAoValue');
      if (scoreAoNode) scoreAoNode.textContent = '0';
      updateWkfAdvantageBadge(state.session);
      return render();
    }
    if (action === 'share-config') return shareCurrentConfig();
    if (action === 'toggle-settings') {
      state.ui.settingsOpen = !state.ui.settingsOpen;
      return render();
    }
    if (action === 'step-field') {
      return stepField(button.dataset.field, Number(button.dataset.delta || 0));
    }
    if (action === 'random-preset') {
      if (state.session.running || state.session.paused) return;
      const preset = RANDOM_PRESETS[Number(button.dataset.presetIndex)];
      if (preset) {
        state.settings.random = {
          ...state.settings.random,
          minutes: preset.minutes,
          alerts: preset.alerts,
          rounds: preset.rounds,
          rest: preset.rest
        };
      } else if (button.dataset.value) {
        state.settings.random.minutes = number(button.dataset.value, 1, 120, 1);
      }
      state.session = createIdleSession();
      persist();
      return render();
    }
    if (action === 'set-cue-type') {
      if (state.session.running || state.session.paused) return;
      const cueType = button.dataset.cueType;
      if (!VALID_CUE_TYPES.includes(cueType)) return;
      state.settings.random.cueType = cueType;
      state.session = createIdleSession();
      persist();
      return render();
    }
    if (action === 'set-combat-focus') {
      if (state.session.running || state.session.paused) return;
      const focus = button.dataset.combatFocus;
      if (!VALID_COMBAT_FOCUS.includes(focus)) return;
      previousCallout = '';
      state.settings.random.combatFocus = focus;
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
    if (action === 'emom-preset') {
      if (state.session.running || state.session.paused) return;
      const preset = EMOM_PRESETS[Number(button.dataset.presetIndex)];
      if (!preset) return;
      state.settings.emom = { interval: preset.interval, rounds: preset.rounds };
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
    if (action === 'save-routine') return saveCurrentRoutine();
    if (action === 'load-routine') return loadRoutineById(button.dataset.routineId);
    if (action === 'delete-routine') return deleteRoutineById(button.dataset.routineId);
    if (action === 'set-prep-seconds') {
      updateSetting('preferences.prepSeconds', button.dataset.value, true);
      return;
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
      fireRandomReactionStimulus(getPlan('random'));
      return showToast('Estímulo de prueba emitido.');
    }
    if (action === 'set-sound-pack') {
      const key = button.dataset.soundPack;
      if (!VALID_SOUND_PACKS.includes(key)) return;
      state.preferences.soundPack = key;
      persist();
      playCue('go');
      return render();
    }
    if (action === 'recover-session') return acceptSessionRecovery();
    if (action === 'dismiss-recovery') return dismissSessionRecovery();
    if (action === 'open-history') return openHistoryModal();
    if (action === 'close-history') {
      if (button.classList.contains('modal-backdrop') && event.target.closest('[data-modal-content]')) return;
      return closeHistoryModal();
    }
    if (action === 'filter-history') {
      state.ui.historyFilter = button.dataset.filter || 'all';
      return render();
    }
    if (action === 'delete-history-item') {
      const id = button.dataset.historyId;
      state.history = state.history.filter(item => item.id !== id);
      persist();
      render();
      return showToast('Sesión eliminada.');
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
      updateSetting(field, event.target.value, false, true);
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
    if (event.target.id === 'routineNameInput') {
      state.ui.routineNameDraft = event.target.value;
      return;
    }
    if (event.target.dataset.field === 'preferences.volume') {
      const range = FIELD_RANGES['preferences.volume'];
      const val = number(event.target.value, range[0], range[1], state.preferences.volume);
      state.preferences.volume = val;
      const label = document.getElementById('volumeValue');
      if (label) label.textContent = `${val}%`;
      debouncedPersist(200);
    } else if (event.target.matches('input[data-field]')) {
      if (event.target.value === '') return;
      updateSetting(event.target.dataset.field, event.target.value, false, false);
    }
  }

  function onAppKeydown(event) {
    if (event.key === 'Enter' && event.target.id === 'routineNameInput') {
      event.preventDefault();
      saveCurrentRoutine();
      return;
    }
    if (event.key === 'Enter' && event.target.matches('input[data-field]')) {
      event.preventDefault();
      event.target.blur();
      return;
    }
    if (event.target.matches('[role="tab"]')) {
      const currentIdx = VALID_MODES.indexOf(event.target.dataset.mode);
      if (currentIdx === -1) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextMode = VALID_MODES[(currentIdx + delta + VALID_MODES.length) % VALID_MODES.length];
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

    const unlockEvents = ['pointerdown', 'touchstart', 'keydown', 'click'];
    const unlockAudio = () => {
      const ctx = prepareAudio();
      if (ctx && ctx.state === 'running') {
        unlockEvents.forEach(type => window.removeEventListener(type, unlockAudio, { passive: true }));
      }
    };
    unlockEvents.forEach(eventType => {
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
      } else if (event.key.toLowerCase() === 'c' && (state.session.running || state.session.paused)) {
        playTone(1320, 0.045, 'sine', 0.45);
        incrementScore(1, 'aka');
      } else if (event.key.toLowerCase() === 'v' && (state.session.running || state.session.paused) && state.preferences.dualScore) {
        playTone(980, 0.045, 'sine', 0.45);
        incrementScore(1, 'ao');
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
      if (document.visibilityState === 'hidden' && (state.session.running || state.session.paused)) {
        persistSessionSnapshot();
      }
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
    if (loadedFromUrl) {
      later(() => showToast('Configuración cargada desde el enlace compartido.'), 350);
      loadedFromUrl = false;
    }
  }

  window.TimerRound = {
    mount,
    getState: () => state,
    actions: {
      startOrResume,
      pauseSession,
      resetSession,
      skipCurrentPhase,
      adjustRemainingTime,
      incrementScore,
      setMode,
      updateSetting,
      stepField,
      togglePreference,
      saveCurrentRoutine,
      loadRoutineById,
      deleteRoutineById,
      shareCurrentConfig
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
      sanitizeRoutineList,
      migrateHistoryItem,
      getPlan,
      createRandomSchedule,
      calculateStreakDays,
      getWeeklyActivity,
      generateKarateCallout,
      formatSpeechText,
      COMBAT_CALLOUTS,
      KARATE_COMBINATIONS,
      KARATE_DISPLACEMENTS,
      TACTICAL_ACTIONS,
      formatTime,
      formatDuration,
      buildShareableUrl,
      applyUrlParams,
      getUpcomingPhaseInfo,
      VALID_SOUND_PACKS,
      SOUND_PACKS
    }
  };

  if (app) {
    mount(app);
  }
})();
