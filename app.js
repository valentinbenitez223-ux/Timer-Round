(() => {
  'use strict';

  const STORAGE_KEY = 'timer-round:v4';
  const SESSION_RECOVERY_KEY = 'timer-round:session-recovery';
  const CIRCUMFERENCE = 2 * Math.PI * 120;
  const CIRCUMFERENCE_TOTAL = 2 * Math.PI * 136;
  const VALID_MODES = ['random', 'tabata', 'emom', 'focus'];
  const VALID_CUE_TYPES = ['pip', 'numbers', 'combat'];
  const VALID_COMBAT_FOCUS = ['all', 'combinations', 'displacements', 'actions', 'custom'];
  const VALID_SOUND_PACKS = ['classic', 'whistle', 'woodblock', 'buzzer'];
  const PENALTY_LEVELS = ['', 'C1', 'C2', 'C3', 'HC', 'H'];

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
    },
    buzzer: {
      label: 'Buzzer (electrónico)',
      prep: () => {
        playTone(340, 0.08, 'sawtooth', 0.65);
        later(() => playTone(440, 0.12, 'sawtooth', 0.7), 100);
      },
      countdown: () => playTone(520, 0.10, 'sawtooth', 0.75),
      go: () => {
        playTone(260, 0.28, 'sawtooth', 0.85);
        playTone(520, 0.28, 'sawtooth', 0.55);
      },
      alert: () => playTone(1800, 0.065, 'sawtooth', 0.9),
      clapper: () => {
        playTone(900, 0.04, 'sawtooth', 0.75);
        later(() => playTone(900, 0.04, 'sawtooth', 0.75), 80);
        later(() => playTone(900, 0.05, 'sawtooth', 0.8), 160);
      },
      finish: () => {
        playTone(220, 0.35, 'sawtooth', 0.9);
        playTone(440, 0.35, 'sawtooth', 0.6);
        later(() => {
          playTone(220, 0.45, 'sawtooth', 0.95);
          playTone(440, 0.45, 'sawtooth', 0.65);
        }, 380);
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
    [/jodan/gi, 'shódan'],
    [/uraken/gi, 'uráken'],
    [/ - /g, ', ']
  ];

  const NUMBER_CALLOUTS = ['Uno', 'Dos', 'Tres', 'Cuatro'];

  const MET_VALUES = {
    tabata: 11.0,
    random: 10.0,
    emom: 8.5,
    focus: 3.5
  };

  function calculateKcal(mode, durationMs, weightKg = 70) {
    const met = MET_VALUES[mode] || 7.0;
    const minutes = Math.max(0, durationMs) / 60000;
    const safeWeight = number(weightKg, 30, 250, 70);
    return Math.round(met * safeWeight * (minutes / 60) * 10) / 10;
  }

  const feedbackTimers = new Set();
  const activeOscillators = new Set();
  let app = document.getElementById('app');
  let animationFrame = 0;
  let wakeLock = null;
  let audioContext = null;
  let audioUnlocked = false;
  let toastTimer = 0;
  let alertFlashTimer = 0;
  let phaseTransitionTimer = 0;
  let persistDebounceTimer = 0;
  let lastFocusedElement = null;
  let globalListenersBound = false;
  let previousCallout = '';
  let loadedFromUrl = false;

  const defaults = {
    activeMode: 'random',
    settings: {
      random: {
        minutes: 1,
        alerts: 10,
        rounds: 1,
        rest: 30,
        cueType: 'pip',
        combatFocus: 'all',
        customCallouts: []
      },
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
      cooldownSeconds: 0,
      dualScore: false,
      tatamiView: false,
      volume: 70,
      soundPack: 'classic',
      userWeightKg: 70
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
    'preferences.prepSeconds': [3, 15],
    'preferences.cooldownSeconds': [0, 300],
    'preferences.userWeightKg': [30, 250]
  };

  const RANDOM_PRESETS = [
    { label: '1 min · 10 pips', minutes: 1, alerts: 10, rounds: 1, rest: 30 },
    { label: '2 min · 15 pips', minutes: 2, alerts: 15, rounds: 1, rest: 30 },
    { label: 'Point Fight 2m×3', minutes: 2, alerts: 12, rounds: 3, rest: 60 },
    { label: 'Full Contact 3m×3', minutes: 3, alerts: 18, rounds: 3, rest: 60 },
    { label: 'Boxeo Pro 3m×5', minutes: 3, alerts: 15, rounds: 5, rest: 60 },
    { label: 'Shadow Boxing 2m×4', minutes: 2, alerts: 14, rounds: 4, rest: 45 },
    { label: 'Reacción 1m×5', minutes: 1, alerts: 12, rounds: 5, rest: 30 }
  ];

  const TABATA_PRESETS = [
    { label: 'Clásico 20/10×8', work: 20, rest: 10, rounds: 8 },
    { label: 'HIIT 30/15×6', work: 30, rest: 15, rounds: 6 },
    { label: 'Pliometría 40/20×5', work: 40, rest: 20, rounds: 5 },
    { label: 'Kumite Drills 45/15×8', work: 45, rest: 15, rounds: 8 },
    { label: 'Combate 120/60×3', work: 120, rest: 60, rounds: 3 },
    { label: 'Sprint 15/15×10', work: 15, rest: 15, rounds: 10 }
  ];

  const EMOM_PRESETS = [
    { label: 'EMOM 60s×10', interval: 60, rounds: 10 },
    { label: 'EMOM 45s×8', interval: 45, rounds: 8 },
    { label: 'E2MOM 120s×5', interval: 120, rounds: 5 },
    { label: 'Power Clean 90s×6', interval: 90, rounds: 6 },
    { label: 'Death by reps 60s×15', interval: 60, rounds: 15 },
    { label: 'Explosivo 30s×12', interval: 30, rounds: 12 }
  ];

  const FOCUS_PRESETS = [
    { label: '45 s (Isométrico)', minutes: 0, seconds: 45 },
    { label: '1 min', minutes: 1, seconds: 0 },
    { label: '3 min', minutes: 3, seconds: 0 },
    { label: '5 min', minutes: 5, seconds: 0 },
    { label: '10 min (Movilidad)', minutes: 10, seconds: 0 },
    { label: '25 min (Pomodoro)', minutes: 25, seconds: 0 }
  ];

  const OFFICIAL_ROUTINES = [
    {
      id: 'template-wkf-kumite',
      name: 'WKF Kumite 3m × 3',
      mode: 'random',
      config: { minutes: 3, alerts: 15, rounds: 3, rest: 60, cueType: 'combat', combatFocus: 'all' }
    },
    {
      id: 'template-tabata-hiit',
      name: 'Tabata HIIT 20/10 × 8',
      mode: 'tabata',
      config: { work: 20, rest: 10, rounds: 8 }
    },
    {
      id: 'template-emom-functional',
      name: 'EMOM Funcional 60s × 10',
      mode: 'emom',
      config: { interval: 60, rounds: 10 }
    },
    {
      id: 'template-boxing-pro',
      name: 'Boxeo Tradicional 3m × 5',
      mode: 'random',
      config: { minutes: 3, alerts: 12, rounds: 5, rest: 60, cueType: 'pip' }
    },
    {
      id: 'template-mobility-isometric',
      name: 'Isométricos 45s / 15s × 6',
      mode: 'tabata',
      config: { work: 45, rest: 15, rounds: 6 }
    }
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

  function sanitizeCustomCallouts(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    for (const raw of list) {
      const clean = String(raw || '').trim().slice(0, 34);
      if (!clean || seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      result.push(clean);
      if (result.length >= 20) break;
    }
    return result;
  }

  function getCombatPool(combatFocus = 'all', customList = []) {
    const custom = Array.isArray(customList) && customList.length
      ? customList
      : ((state && state.settings && state.settings.random && state.settings.random.customCallouts) || []);
    if (combatFocus === 'combinations') return KARATE_COMBINATIONS;
    if (combatFocus === 'displacements') return KARATE_DISPLACEMENTS;
    if (combatFocus === 'actions') return TACTICAL_ACTIONS;
    if (combatFocus === 'custom') return custom.length ? custom : COMBAT_CALLOUTS;
    return [...COMBAT_CALLOUTS, ...custom];
  }

  function generateKarateCallout(combatFocus = 'all', customList = []) {
    const pool = getCombatPool(combatFocus, customList);
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
        scoreAo: number(item.scoreAo, 0, 9999, 0),
        kcal: number(item.kcal, 0, 9999, 0)
      });
      if (sanitized.length >= 100) break;
    }
    return sanitized;
  }

  function sanitizeRoutineList(rawRoutines) {
    if (!Array.isArray(rawRoutines)) return [];
    const seenSignatures = new Set();
    const sanitized = [];
    for (const item of rawRoutines) {
      if (!item || typeof item !== 'object') continue;
      const name = String(item.name || '').trim().slice(0, 32);
      if (!name || !VALID_MODES.includes(item.mode)) continue;
      const signature = `${item.mode}:${name.toLowerCase()}`;
      if (seenSignatures.has(signature)) continue;
      seenSignatures.add(signature);
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
          combatFocus: VALID_COMBAT_FOCUS.includes(random.combatFocus) ? random.combatFocus : defaults.settings.random.combatFocus,
          customCallouts: sanitizeCustomCallouts(random.customCallouts)
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
        focus: (() => {
          const m = number(focus.minutes !== undefined ? focus.minutes : safeRaw.timer_basic_min, 0, 99, defaults.settings.focus.minutes);
          const s = number(focus.seconds !== undefined ? focus.seconds : safeRaw.timer_basic_sec, 0, 59, defaults.settings.focus.seconds);
          if (m === 0 && s === 0) return { minutes: 1, seconds: 0 };
          return { minutes: m, seconds: s };
        })()
      },
      preferences: {
        sound: typeof prefs.sound === 'boolean' ? prefs.sound : defaults.preferences.sound,
        voice: typeof prefs.voice === 'boolean' ? prefs.voice : defaults.preferences.voice,
        vibration: typeof prefs.vibration === 'boolean' ? prefs.vibration : defaults.preferences.vibration,
        preparation: typeof prefs.preparation === 'boolean' ? prefs.preparation : defaults.preferences.preparation,
        prepSeconds: number(prefs.prepSeconds, 3, 15, defaults.preferences.prepSeconds),
        cooldownSeconds: number(prefs.cooldownSeconds, 0, 300, defaults.preferences.cooldownSeconds),
        dualScore: typeof prefs.dualScore === 'boolean' ? prefs.dualScore : defaults.preferences.dualScore,
        tatamiView: typeof prefs.tatamiView === 'boolean' ? prefs.tatamiView : defaults.preferences.tatamiView,
        volume: number(prefs.volume, 0, 100, defaults.preferences.volume),
        soundPack: VALID_SOUND_PACKS.includes(prefs.soundPack) ? prefs.soundPack : defaults.preferences.soundPack,
        userWeightKg: number(prefs.userWeightKg, 30, 250, defaults.preferences.userWeightKg)
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
        const custom = params.get('custom');
        if (custom) {
          try {
            const list = custom.split('|').map(s => s.trim()).filter(Boolean);
            if (list.length) targetState.settings.random.customCallouts = sanitizeCustomCallouts(list);
          } catch (_) {}
        }
      } else if (mode === 'tabata') {
        targetState.settings.tabata.work = number(params.get('work'), 1, 600, targetState.settings.tabata.work);
        targetState.settings.tabata.rest = number(params.get('rest'), 0, 600, targetState.settings.tabata.rest);
        targetState.settings.tabata.rounds = number(params.get('rounds'), 1, 60, targetState.settings.tabata.rounds);
      } else if (mode === 'emom') {
        targetState.settings.emom.interval = number(params.get('interval'), 10, 600, targetState.settings.emom.interval);
        targetState.settings.emom.rounds = number(params.get('rounds'), 1, 60, targetState.settings.emom.rounds);
      } else if (mode === 'focus') {
        const m = number(params.get('min'), 0, 99, targetState.settings.focus.minutes);
        const s = number(params.get('sec'), 0, 59, targetState.settings.focus.seconds);
        if (m === 0 && s === 0) {
          targetState.settings.focus.minutes = 1;
          targetState.settings.focus.seconds = 0;
        } else {
          targetState.settings.focus.minutes = m;
          targetState.settings.focus.seconds = s;
        }
      }
    } catch (_) {}
  }

  const state = {
    ...loadStoredData(),
    ui: {
      settingsOpen: false,
      historyOpen: false,
      historyFilter: 'all',
      historySearchQuery: '',
      confirmClearHistory: false,
      routineNameDraft: '',
      customCalloutDraft: '',
      installAvailable: Boolean(window.deferredInstallPrompt),
      alertFlash: false,
      lastCallout: '',
      toast: { visible: false, message: '', kind: 'success' },
      recoveryAvailable: false,
      recoverySnapshot: null,
      pocketMode: false
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
      const durationMs = Math.max(1000, (focus.minutes * 60 + focus.seconds) * 1000);
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
      combatFocus: VALID_COMBAT_FOCUS.includes(random.combatFocus) ? random.combatFocus : 'all',
      customCallouts: Array.isArray(random.customCallouts) ? random.customCallouts : []
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
      senshu: '',
      penaltyAka: 0,
      penaltyAo: 0,
      advantageAnnounced: false,
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
      elapsedMs: 0,
      effectiveDurationMs: 0,
      phaseElapsedRecorded: false,
      scoreHistory: [],
      completed: false
    };
  }

  function getSessionTotalDuration(s = state.session) {
    if (!s || !s.plan) return 0;
    const cooldownMs = (state.preferences.cooldownSeconds || 0) * 1000;
    if (s.phase === 'finished' && s.effectiveDurationMs > 0) {
      return s.effectiveDurationMs;
    }
    return Math.max(1000, s.plan.durationMs + cooldownMs + (s.timeAdjustedMs || 0));
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
      actions: 'Reacción rápida',
      custom: 'Mis técnicas'
    })[focus] || 'Completo';
  }

  function getWkfAdvantageText(s = state.session) {
    if (!state.preferences.dualScore || !s) return '';
    if (s.penaltyAka >= 5) return 'Hansoku Aka · Gana Ao';
    if (s.penaltyAo >= 5) return 'Hansoku Ao · Gana Aka';
    const diff = s.score - s.scoreAo;
    if (Math.abs(diff) >= 8) {
      return diff > 0 ? 'Ventaja 8 pts (Aka)' : 'Ventaja 8 pts (Ao)';
    }
    return '';
  }

  function getCombatResultMessage(s = state.session) {
    if (!s || (s.score === 0 && s.scoreAo === 0 && !s.senshu && (s.penaltyAka || 0) === 0 && (s.penaltyAo || 0) === 0)) {
      return '';
    }
    const akaHansoku = (s.penaltyAka || 0) >= 5;
    const aoHansoku = (s.penaltyAo || 0) >= 5;
    if (akaHansoku && aoHansoku) return 'Descalificación mutua · Hansoku';
    if (akaHansoku) return 'Victoria Ao · Hansoku Aka';
    if (aoHansoku) return 'Victoria Aka · Hansoku Ao';
    const diff = (s.score || 0) - (s.scoreAo || 0);
    if (diff >= 8) return `Victoria Aka (+${diff} pts)`;
    if (diff <= -8) return `Victoria Ao (+${Math.abs(diff)} pts)`;
    if (diff > 0) return `Victoria Aka (${s.score} - ${s.scoreAo})`;
    if (diff < 0) return `Victoria Ao (${s.scoreAo} - ${s.score})`;
    if (s.senshu === 'aka') return `Victoria Aka por Senshu (${s.score} - ${s.scoreAo})`;
    if (s.senshu === 'ao') return `Victoria Ao por Senshu (${s.score} - ${s.scoreAo})`;
    return `Empate (${s.score} - ${s.scoreAo})`;
  }

  function persistSessionSnapshot() {
    const s = state.session;
    if (!s || (!s.running && !s.paused)) {
      try { sessionStorage.removeItem(SESSION_RECOVERY_KEY); } catch (_) {}
      return;
    }
    try {
      const now = Date.now();
      const liveRem = s.running ? Math.max(0, s.endAt - now) : s.remainingMs;
      const phase = s.phase === 'prep' ? 'work' : s.phase;
      const remainingMs = s.phase === 'prep' ? (s.plan.workMs || s.plan.durationMs) : liveRem;
      const durationMs = s.phase === 'prep' ? (s.plan.workMs || s.plan.durationMs) : s.durationMs;
      sessionStorage.setItem(SESSION_RECOVERY_KEY, JSON.stringify({
        savedAt: now,
        plan: s.plan,
        phase,
        round: s.round,
        score: s.score || 0,
        scoreAo: s.scoreAo || 0,
        senshu: s.senshu || '',
        penaltyAka: s.penaltyAka || 0,
        penaltyAo: s.penaltyAo || 0,
        scoreHistory: Array.isArray(s.scoreHistory) ? s.scoreHistory.slice(-25) : [],
        durationMs,
        remainingMs,
        alertsFired: s.alertsFired || 0,
        alertIndex: s.alertIndex || 0,
        alertSchedule: s.alertSchedule || [],
        cueFlags: s.cueFlags ? { ...s.cueFlags } : {},
        timeAdjustedMs: s.timeAdjustedMs || 0,
        elapsedMs: s.elapsedMs || 0
      }));
    } catch (_) {}
  }

  function readSessionSnapshot() {
    try {
      const raw = sessionStorage.getItem(SESSION_RECOVERY_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      if (!snap || typeof snap !== 'object' || Date.now() - snap.savedAt > 4 * 60 * 60 * 1000) {
        sessionStorage.removeItem(SESSION_RECOVERY_KEY);
        return null;
      }
      if (!snap.plan || typeof snap.plan !== 'object' || !VALID_MODES.includes(snap.plan.mode)) {
        sessionStorage.removeItem(SESSION_RECOVERY_KEY);
        return null;
      }
      if (typeof snap.remainingMs !== 'number' || snap.remainingMs <= 0 || typeof snap.durationMs !== 'number') {
        sessionStorage.removeItem(SESSION_RECOVERY_KEY);
        return null;
      }
      return snap;
    } catch (_) { return null; }
  }

  function acceptSessionRecovery() {
    const snap = state.ui.recoverySnapshot;
    if (!snap) return;
    if (snap.plan && VALID_MODES.includes(snap.plan.mode)) {
      state.activeMode = snap.plan.mode;
    }
    state.session = {
      ...createIdleSession(snap.plan ? snap.plan.mode : state.activeMode),
      running: false,
      paused: true,
      phase: snap.phase || 'work',
      plan: snap.plan,
      round: snap.round || 1,
      score: snap.score || 0,
      scoreAo: snap.scoreAo || 0,
      senshu: snap.senshu || '',
      penaltyAka: snap.penaltyAka || 0,
      penaltyAo: snap.penaltyAo || 0,
      scoreHistory: Array.isArray(snap.scoreHistory) ? snap.scoreHistory : [],
      durationMs: snap.durationMs,
      remainingMs: snap.remainingMs,
      alertSchedule: snap.alertSchedule || [],
      alertIndex: snap.alertIndex || 0,
      alertsFired: snap.alertsFired || 0,
      cueFlags: snap.phase === 'prep' ? {} : (snap.cueFlags ? { ...snap.cueFlags } : {}),
      timeAdjustedMs: snap.timeAdjustedMs || 0,
      elapsedMs: snap.elapsedMs || 0
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
        <span class="recovery-text">${icon('alert')}<span>Sesión interrumpida · ${escapeHtml(modeLabel(state.ui.recoverySnapshot.plan.mode))}</span></span>
        <div class="recovery-actions">
          <button class="button button-tertiary" type="button" data-action="dismiss-recovery">Descartar</button>
          <button class="button button-primary recovery-btn" type="button" data-action="recover-session">Restaurar sesión</button>
        </div>
      </div>`;
  }

  function getUpcomingPhaseInfo(s = state.session) {
    if (!s || (!s.running && !s.paused)) return '';
    const { plan } = s;
    if (!plan) return '';

    if (s.phase === 'cooldown') {
      return 'Fase final de recuperación';
    }
    if (s.phase === 'work' && s.round < plan.rounds) {
      if (plan.mode === 'emom') {
        return `Luego: minuto ${s.round + 1}/${plan.rounds}`;
      }
      if (plan.restMs > 0) {
        return `Luego: descanso ${Math.round(plan.restMs / 1000)}s · R${s.round + 1}/${plan.rounds}`;
      }
      return `Luego: R${s.round + 1}/${plan.rounds}`;
    }
    if (s.phase === 'work' && s.round >= plan.rounds && state.preferences.cooldownSeconds > 0) {
      return `Luego: enfriamiento ${state.preferences.cooldownSeconds}s`;
    }
    if (s.phase === 'rest') {
      return `Luego: R${s.round + 1}/${plan.rounds}`;
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
      tatami: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M12 5.5v13M3.5 12h17"/>',
      share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.6M8.3 13.2l7.4 4.6"/>',
      bookmark: '<path d="M6 4.5h12a1 1 0 0 1 1 1v14l-7-4-7 4v-14a1 1 0 0 1 1-1z"/>',
      trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M7.5 7l.8 12.5h7.4L16.5 7"/>',
      history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.1-5.2"/><path d="M4.5 5.5V11H10"/><path d="M12 8v4l2.8 1.8"/>',
      fullscreen: '<path d="M8.5 4.5h-4v4M15.5 4.5h4v4M19.5 15.5v4h-4M4.5 15.5v4h4"/>',
      install: '<path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 20h14"/>',
      download: '<path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/>',
      upload: '<path d="M12 15V5"/><path d="m8 9 4-4 4 4"/><path d="M5 19h14"/>',
      close: '<path d="m7 7 10 10M17 7 7 17"/>',
      alert: '<path d="m10.29 3.86-8.29 14.36A2 2 0 0 0 3.73 21h16.54a2 2 0 0 0 1.73-2.78L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
      pocket: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4v4a3 3 0 0 0 6 0V4"/><circle cx="12" cy="15" r="1"/>',
      check: '<polyline points="20 6 9 17 4 12"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function getPhaseCopy(session = state.session) {
    if (session.phase === 'prep') return { label: 'Prepárate', detail: 'El round empieza en un instante.' };
    if (session.phase === 'rest') return { label: 'Descanso', detail: `Recuperá aire · sigue la ronda ${session.round + 1}.` };
    if (session.phase === 'cooldown') return { label: 'Enfriamiento', detail: 'Bajá pulsaciones y respirá profundo.' };
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

  function progressTotalFor(session = state.session) {
    if (!session || session.phase === 'finished') return 1;
    if (session.phase === 'idle' || session.phase === 'prep') return 0;
    const cooldownMs = (state.preferences.cooldownSeconds || 0) * 1000;
    const totalPlanMs = session.plan.durationMs + cooldownMs + (session.timeAdjustedMs || 0);
    if (totalPlanMs <= 0) return 0;
    const rem = getTotalRemainingMs(session);
    return Math.min(1, Math.max(0, 1 - (rem / totalPlanMs)));
  }

  function getTotalRemainingMs(session = state.session) {
    const cooldownMs = (state.preferences.cooldownSeconds || 0) * 1000;
    if (session.phase === 'cooldown') return session.remainingMs;
    if (session.plan.rounds <= 1 && !cooldownMs) return session.remainingMs;
    if (session.phase === 'idle' || session.phase === 'prep') return session.plan.durationMs + cooldownMs;
    if (session.phase === 'finished') return 0;

    const futureRounds = Math.max(0, session.plan.rounds - session.round);
    const workMs = session.plan.workMs || session.durationMs;
    const restMs = session.plan.restMs || 0;

    if (session.phase === 'work') {
      const restAfterCurrent = session.round < session.plan.rounds ? restMs : 0;
      const futureWorkAndRest = futureRounds * workMs + Math.max(0, futureRounds - 1) * restMs;
      return session.remainingMs + restAfterCurrent + futureWorkAndRest + cooldownMs;
    }
    if (session.phase === 'rest') {
      const futureWorkAndRest = futureRounds * workMs + Math.max(0, futureRounds - 1) * restMs;
      return session.remainingMs + futureWorkAndRest + cooldownMs;
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
    if (s.phase === 'prep' || s.phase === 'cooldown') return true;
    return (s.plan.rounds > 1 || state.preferences.cooldownSeconds > 0) && (s.phase === 'work' || s.phase === 'rest');
  }

  function render() {
    if (!app) return;
    const s = state.session;
    const phaseCopy = getPhaseCopy(s);
    const isLongKicker = phaseCopy.label.length > 16;
    const theme = s.paused ? 'paused' : ['prep', 'rest', 'cooldown', 'finished'].includes(s.phase) ? (s.phase === 'cooldown' ? 'rest' : s.phase) : s.plan.mode;
    const isRunning = s.running;
    const isLocked = s.running || s.paused;
    const showPips = s.plan.rounds > 1 ? renderRoundPips(s.plan.rounds, s.round) : '';
    const actionText = isRunning ? 'Pausar' : s.paused ? 'Reanudar' : s.phase === 'finished' ? 'Empezar de nuevo' : 'Iniciar';
    const toast = state.ui.toast;
    const showLiveTools = isRunning || s.paused || s.score > 0 || s.scoreAo > 0 || state.preferences.dualScore;
    const tatamiClass = state.preferences.tatamiView ? 'tatami-view' : '';
    const brandIconName = s.phase === 'finished' ? 'check'
      : (isRunning && s.phase === 'work') ? 'play'
      : (isRunning && (s.phase === 'rest' || s.phase === 'cooldown')) ? 'pause'
      : 'clock';

    app.setAttribute('aria-busy', 'false');
    app.innerHTML = `
      <div class="app-shell ${isRunning ? 'session-running' : ''} ${s.paused ? 'session-paused' : ''} ${tatamiClass} ${state.ui.pocketMode ? 'pocket-mode' : ''}">
        <header class="app-header">
          <div class="brand">
            <span class="brand-mark" id="brandMark" data-icon="${brandIconName}">${icon(brandIconName)}</span>
            <div>
              <div class="brand-name">Timer Round</div>
              <div class="brand-subtitle">Entrená a tu ritmo</div>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon-button ${state.ui.installAvailable ? '' : 'hidden'}" type="button" data-action="install" title="Instalar app" aria-label="Instalar app">${icon('install')}</button>
            <button class="icon-button ${state.ui.pocketMode ? 'active-icon' : ''}" type="button" data-action="toggle-pocket" title="Modo Bolsillo / Pantalla oscura (P)" aria-pressed="${state.ui.pocketMode}" aria-label="Modo Bolsillo">${icon('pocket')}</button>
            <button class="icon-button ${state.preferences.tatamiView ? 'active-icon' : ''}" type="button" data-action="toggle-tatami" title="Modo Vista Tatami / Pantalla grande (T)" aria-pressed="${state.preferences.tatamiView}" aria-label="Vista Tatami">${icon('tatami')}</button>
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
                <circle class="timer-ring-track-total" cx="144" cy="144" r="136"></circle>
                <circle class="timer-ring-progress-total" id="progressRingTotal" cx="144" cy="144" r="136" stroke-dasharray="${CIRCUMFERENCE_TOTAL}" stroke-dashoffset="${CIRCUMFERENCE_TOTAL * (1 - progressTotalFor(s))}"></circle>
                <circle class="timer-ring-track" cx="144" cy="144" r="120"></circle>
                <circle class="timer-ring-progress" id="progressRing" cx="144" cy="144" r="120" stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${CIRCUMFERENCE * (1 - progressFor(s))}"></circle>
              </svg>
              <div class="timer-core" data-action="toggle" role="button" tabindex="0" title="Tocar para iniciar o pausar (Modo Guantes)">
                <div class="phase-kicker ${isLongKicker ? 'compact-kicker' : ''}" id="phaseLabel" aria-live="polite">${escapeHtml(phaseCopy.label)}</div>
                <div class="time-value ${s.phase === 'prep' ? 'countdown' : ''}" id="timeValue" role="timer" aria-label="Tiempo restante" aria-live="off">${displayValue(s)}</div>
                <div class="phase-detail" id="phaseDetail">${escapeHtml(phaseCopy.detail)}</div>
              </div>
            </div>
          </div>
          <div class="mode-summary" id="modeSummary">${modeSummaryMarkup(s, showPips)}</div>
          ${renderUpcomingPhase(s)}
          ${showLiveTools ? renderLiveTools(s) : ''}
          <div class="timer-controls">
            <button class="button button-primary" type="button" id="toggleButton" data-action="toggle">${isRunning ? icon('pause') : icon('play')}<span id="controlText">${actionText}</span></button>
            ${s.phase === 'finished' ? `<button class="button button-secondary" type="button" data-action="share-result" title="Compartir resumen de la sesión">${icon('share')}<span>Compartir</span></button>` : ''}
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
    if (state.ui.historyOpen) {
      const modal = document.querySelector('[data-modal-content]');
      if (modal) trapFocus(modal);
    }
    updateLiveUi();
  }

  function renderLiveTools(s) {
    const canAdjustTime = (s.running || s.paused) && s.phase !== 'prep';
    const isDual = state.preferences.dualScore;
    const advText = getWkfAdvantageText(s);
    const penAkaLabel = PENALTY_LEVELS[s.penaltyAka || 0] || 'Falta';
    const penAoLabel = PENALTY_LEVELS[s.penaltyAo || 0] || 'Falta';

    return `
      <div class="live-counter-row">
        ${canAdjustTime ? `
          <div class="time-adjust-group" role="group" aria-label="Ajustar tiempo del bloque actual">
            <button class="counter-reset" type="button" data-action="adjust-time" data-delta-ms="-15000" title="Restar 15 segundos" ${s.remainingMs > 15000 ? '' : 'disabled'}>−15s</button>
            <button class="counter-reset" type="button" data-action="adjust-time" data-delta-ms="15000" title="Sumar 15 segundos">+15s</button>
          </div>
        ` : ''}
        ${isDual ? `
          <div class="dual-score-group" role="group" aria-label="Marcador Aka vs Ao">
            <div class="score-fighter aka">
              <button class="score-step" type="button" data-action="decrement-score" aria-label="Restar Aka">−</button>
              <button class="score-main" type="button" data-action="increment-score" title="Punto Aka (Tecla C)">Aka <strong id="scoreValue">${s.score}</strong></button>
              <button class="senshu-btn ${s.senshu === 'aka' ? 'active' : ''}" type="button" data-action="toggle-senshu" data-fighter="aka" title="Senshu Aka (Primer punto)">S</button>
              <button class="penalty-btn ${s.penaltyAka > 0 ? 'active' : ''}" type="button" data-action="cycle-penalty" data-fighter="aka" title="Penalización Aka (C1-H)">${penAkaLabel}</button>
            </div>
            <div class="score-center-actions">
              <button class="counter-reset dual-reset-btn" type="button" data-action="undo-score" aria-label="Deshacer última acción" title="Deshacer acción (Tecla Z)" ${s.scoreHistory && s.scoreHistory.length ? '' : 'disabled'}>↶</button>
              <button class="counter-reset dual-reset-btn" type="button" data-action="reset-score" aria-label="Reiniciar Aka y Ao" title="Reiniciar tablero">↺</button>
            </div>
            <div class="score-fighter ao">
              <button class="penalty-btn ${s.penaltyAo > 0 ? 'active' : ''}" type="button" data-action="cycle-penalty" data-fighter="ao" title="Penalización Ao (C1-H)">${penAoLabel}</button>
              <button class="senshu-btn ${s.senshu === 'ao' ? 'active' : ''}" type="button" data-action="toggle-senshu" data-fighter="ao" title="Senshu Ao (Primer punto)">S</button>
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
            ${s.scoreHistory && s.scoreHistory.length ? `<button class="counter-reset" type="button" data-action="undo-score" title="Deshacer (Tecla Z)">↶</button>` : ''}
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
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderModeTab(mode, label, isLocked) {
    const selected = state.activeMode === mode;
    return `<button class="mode-tab" type="button" data-mode="${mode}" role="tab" aria-selected="${selected}" tabindex="${selected ? '0' : '-1'}" ${isLocked ? 'aria-disabled="true"' : ''}>${label}</button>`;
  }

  function statusMarkup(s) {
    if (s.phase === 'cooldown') return `<strong>Enfriamiento</strong>`;
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
    if (s.phase === 'finished') {
      const totalMs = getSessionTotalDuration(s);
      const dur = formatDuration(totalMs);
      const roundsText = s.plan.rounds > 1 ? `${s.round}/${s.plan.rounds} rondas` : '1 round';
      const kcalVal = calculateKcal(s.plan.mode, totalMs, state.preferences.userWeightKg);
      const kcalBadge = kcalVal > 0 ? `<span class="finished-badge" title="Estimación metabólica aproximada">${kcalVal} kcal*</span>` : '';
      const combatOutcome = getCombatResultMessage(s);
      const scoreBadge = combatOutcome
        ? `<span class="finished-badge ${combatOutcome.includes('Aka') ? 'winner-aka' : combatOutcome.includes('Ao') ? 'winner-ao' : ''}">${escapeHtml(combatOutcome)}</span>`
        : s.score > 0
        ? `<span class="finished-badge">${s.score} pts</span>`
        : '';
      return `
        <div class="finished-summary">
          <span class="finished-badge">${icon('check')} ${roundsText}</span>
          <span class="finished-badge">${dur}</span>
          ${kcalBadge}
          ${scoreBadge}
        </div>`;
    }

    const totalRem = getTotalRemainingMs(s);
    const remainingChip = (s.running || s.paused) && (s.plan.rounds > 1 || state.preferences.cooldownSeconds > 0)
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
    return `<span>Duración <strong id="summaryDuration">${formatDuration(s.plan.durationMs)}</strong>${remainingChip}</span>`;
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
    const customList = config.customCallouts || [];
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
          <div class="routine-save-row" style="margin-top:10px">
            <input class="text-input" id="customCalloutInput" type="text" maxlength="34" placeholder="Agregar técnica propia (ej: Blitz y salida)…" value="${escapeHtml(state.ui.customCalloutDraft)}" aria-label="Nueva técnica táctica">
            <button class="button button-tertiary" type="button" data-action="add-custom-callout">${icon('plus')}<span>Sumar</span></button>
          </div>
          ${customList.length ? `
            <div class="routine-list">
              ${customList.map((text, idx) => `
                <div class="routine-chip">
                  <span class="routine-load">${escapeHtml(text)}</span>
                  <button class="routine-delete" type="button" data-action="remove-custom-callout" data-index="${idx}" aria-label="Borrar ${escapeHtml(text)}">${icon('close')}</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
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
      <div class="history-io" style="margin-top: 10px;">
        <button class="button button-tertiary" type="button" data-action="export-routines" ${routines.length ? '' : 'disabled'}>${icon('download')}<span>Exportar rutinas</span></button>
        <label class="button button-tertiary file-button" role="button" tabindex="0" aria-label="Importar archivo de rutinas JSON">
          ${icon('upload')}<span>Importar rutinas</span>
          <input type="file" id="importRoutinesInput" accept="application/json,.json" class="hidden">
        </label>
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
      <div class="official-templates-block" style="margin-top: 14px;">
        <span class="field-label">Plantillas oficiales recomendadas</span>
        <div class="preset-grid preset-grid-wrap" style="margin-top: 6px;">
          ${OFFICIAL_ROUTINES.map(tpl => `
            <button class="preset-button" type="button" data-action="load-routine" data-routine-id="${escapeHtml(tpl.id)}" title="Cargar ${escapeHtml(tpl.name)}">
              ${icon('bookmark')} <span>${escapeHtml(tpl.name)}</span>
            </button>
          `).join('')}
        </div>
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

  function getNotificationStatusHelp() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'No compatible con este navegador';
    }
    if (Notification.permission === 'granted') {
      return 'Notificaciones activadas al completar la sesión';
    }
    if (Notification.permission === 'denied') {
      return 'Bloqueadas desde los ajustes del navegador';
    }
    return 'Recibí un aviso si minimizás la pestaña durante el round';
  }

  function getNotificationBtnLabel() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'No disponible';
    if (Notification.permission === 'granted') return 'Activadas ✓';
    if (Notification.permission === 'denied') return 'Bloqueadas';
    return 'Activar avisos';
  }

  function getNotificationBtnDisabled() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'disabled';
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return 'disabled';
    return '';
  }

  function renderPreferences() {
    const prefs = state.preferences;
    return `<div class="settings-section">
      <h2 class="section-title">Señales, tablero y comodidad</h2>
      <div class="switch-row">${switchCopy('Sonidos y tablilla (10s)', 'Campana, pips de reacción y clapper en los últimos 10s', 'sound', prefs.sound)}</div>
      <div class="switch-row">${switchCopy('Voz', 'Indicaciones y estímulos tácticos en español', 'voice', prefs.voice)}</div>
      <div class="switch-row">${switchCopy('Vibración', 'Refuerzo háptico si tu dispositivo lo permite', 'vibration', prefs.vibration)}</div>
      <div class="switch-row">${switchCopy('Marcador dual WKF (Aka / Ao)', 'Tanteador doble con Senshu, faltas y ventaja de 8 puntos', 'dualScore', prefs.dualScore)}</div>
      <div class="switch-row">${switchCopy('Vista Tatami (Pantalla grande)', 'Reloj y tanteador ampliados para lectura a distancia', 'tatamiView', prefs.tatamiView)}</div>
      <div class="switch-row">${switchCopy('Cuenta previa', 'Conteo regresivo antes de arrancar el primer round', 'preparation', prefs.preparation)}</div>
      <div class="switch-row">
        <span class="switch-copy">
          <span class="switch-title">Aviso al terminar en segundo plano</span>
          <span class="switch-help">${getNotificationStatusHelp()}</span>
        </span>
        <button class="button button-tertiary" type="button" data-action="request-notifications" ${getNotificationBtnDisabled()}>
          ${getNotificationBtnLabel()}
        </button>
      </div>
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
      <div class="prep-duration-row">
        <span class="field-label">Enfriamiento final (Cooldown)</span>
        <div class="preset-grid four-cols" style="margin-top:6px">
          ${[
            [0, 'Sin enfriamiento'],
            [30, '30 s'],
            [60, '1 min'],
            [120, '2 min']
          ].map(([sec, label]) => `
            <button class="preset-button ${prefs.cooldownSeconds === sec ? 'active' : ''}" type="button" data-action="set-cooldown-seconds" data-value="${sec}">${label}</button>
          `).join('')}
        </div>
      </div>
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
          <button class="button button-tertiary" type="button" data-action="test-voice">Probar voz</button>
          <button class="button button-tertiary" type="button" data-action="test-vibration">Probar vibración</button>
        </div>
      </div>
      <div class="settings-section">
        <div class="setting-label"><span class="field-label">Peso corporal para estimar Kcal</span><span class="range-value" id="weightValue">${prefs.userWeightKg || 70} kg</span></div>
        <div class="range-row">
          <input data-field="preferences.userWeightKg" type="range" min="30" max="150" step="1" value="${prefs.userWeightKg || 70}" aria-label="Peso corporal en kilogramos">
        </div>
      </div>
      <div class="settings-actions">
        <div class="shortcut-list">
          <span><kbd>Espacio</kbd> iniciar / pausar</span>
          <span><kbd>C</kbd> +1 Aka</span>
          <span><kbd>X</kbd> −1 Aka</span>
          <span><kbd>V</kbd> +1 Ao</span>
          <span><kbd>B</kbd> −1 Ao</span>
          <span><kbd>Z</kbd> deshacer</span>
          <span><kbd>S</kbd> saltar fase</span>
          <span><kbd>T</kbd> vista tatami</span>
          <span><kbd>P</kbd> modo bolsillo</span>
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
    const searchQuery = String(state.ui.historySearchQuery || '').trim().toLowerCase();
    const filtered = history.filter(item => {
      if (filter !== 'all' && item.mode !== filter) return false;
      if (!searchQuery) return true;
      const modeTxt = modeLabel(item.mode).toLowerCase();
      const dateTxt = new Date(item.completedAt).toLocaleDateString('es-AR').toLowerCase();
      const scoreTxt = `aka ${item.score} ao ${item.scoreAo}`.toLowerCase();
      return modeTxt.includes(searchQuery) || dateTxt.includes(searchQuery) || scoreTxt.includes(searchQuery);
    });
    const total = history.reduce((sum, item) => sum + item.durationMs, 0);
    const avgDuration = history.length ? Math.round(total / history.length) : 0;
    const totalKcal = history.reduce((sum, item) => sum + (item.kcal || 0), 0);
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
            <p>Las sesiones se guardan en este dispositivo. Podés filtrarlas, buscarlas o exportarlas.</p>
          </div>
          <button class="icon-button" type="button" id="closeHistoryButton" data-action="close-history" aria-label="Cerrar historial">${icon('close')}</button>
        </div>
        <div class="history-stats">
          <div class="stat"><span class="stat-value">${history.length}</span><span class="stat-label">Sesiones</span></div>
          <div class="stat"><span class="stat-value">${streakDays} ${streakDays === 1 ? 'día' : 'días'}</span><span class="stat-label">Racha actual</span></div>
          <div class="stat"><span class="stat-value">${formatDuration(weekTotal)}</span><span class="stat-label">Esta semana</span></div>
          <div class="stat"><span class="stat-value">${formatDuration(avgDuration)}</span><span class="stat-label">Promedio</span></div>
          <div class="stat"><span class="stat-value">${totalKcal} kcal</span><span class="stat-label">Total Kcal</span></div>
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
        <div class="history-search-row">
          <input class="text-input" id="historySearchInput" type="search" placeholder="Buscar por fecha, modo o tanteador…" value="${escapeHtml(state.ui.historySearchQuery || '')}" aria-label="Buscar en historial">
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
            <button class="button button-tertiary" type="button" data-action="export-history" ${history.length ? '' : 'disabled'}>${icon('download')}<span>JSON</span></button>
            <button class="button button-tertiary" type="button" data-action="export-csv" ${history.length ? '' : 'disabled'}>${icon('download')}<span>CSV</span></button>
            <label class="button button-tertiary file-button" role="button" tabindex="0" aria-label="Importar archivo de historial JSON">
              ${icon('upload')}<span>Importar</span>
              <input type="file" id="importHistoryInput" accept="application/json,.json" class="hidden">
            </label>
          </div>
        </div>
        <div class="history-list">${filtered.length ? filtered.map(renderHistoryItem).join('') : `<p class="empty-history">${history.length ? 'No se encontraron sesiones que coincidan con la búsqueda.' : 'No hay sesiones registradas todavía. ¡Completá tu primer entrenamiento!'}</p>`}</div>
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
    const kcalInfo = item.kcal ? ` · ${item.kcal} kcal` : '';
    const date = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.completedAt));
    return `
      <article class="history-item">
        <div>
          <div class="history-mode">${modeLabel(item.mode)}</div>
          <div class="history-date">${date}</div>
        </div>
        <div class="history-right">
          <div class="history-duration">${formatDuration(item.durationMs)}<span class="history-detail">${roundsInfo}${scoreInfo}${kcalInfo}</span></div>
          <button class="icon-button history-delete-btn" type="button" data-action="delete-history-item" data-history-id="${escapeHtml(item.id)}" title="Borrar esta sesión" aria-label="Borrar esta sesión">${icon('trash')}</button>
        </div>
      </article>`;
  }

  let cachedDom = null;
  let lastRingOffset = -1;
  let lastTotalOffset = -1;
  let lastPipsRound = -1;

  function refreshDomCache() {
    cachedDom = {
      time: document.getElementById('timeValue'),
      phase: document.getElementById('phaseLabel'),
      detail: document.getElementById('phaseDetail'),
      ring: document.getElementById('progressRing'),
      ringTotal: document.getElementById('progressRingTotal'),
      card: document.getElementById('timerCard'),
      brandMark: document.getElementById('brandMark'),
      sub15Btn: document.querySelector('[data-action="adjust-time"][data-delta-ms="-15000"]'),
      alerts: document.getElementById('alertsNumber'),
      round: document.getElementById('roundNumber'),
      totalRemNode: document.getElementById('totalRemainingValue'),
      scoreNode: document.getElementById('scoreValue'),
      scoreAoNode: document.getElementById('scoreAoValue'),
      upcoming: document.getElementById('upcomingPhase'),
      upcomingRow: document.querySelector('.upcoming-row'),
      summaryDuration: document.getElementById('summaryDuration'),
      summaryAlerts: document.getElementById('summaryAlerts'),
      pips: document.querySelectorAll('[data-round-pip]')
    };
  }

  function updateLiveUi() {
    const s = state.session;
    updateDocumentTitle(s);
    if (!cachedDom || !cachedDom.card || !cachedDom.card.isConnected) {
      refreshDomCache();
    }
    const { time, phase, detail, ring, ringTotal, card, brandMark, sub15Btn, alerts, round, totalRemNode, scoreNode, scoreAoNode, upcoming, upcomingRow, summaryDuration, summaryAlerts, pips } = cachedDom;
    if (!time || !phase || !detail || !ring || !card) return;

    const copy = getPhaseCopy(s);
    const timeVal = displayValue(s);
    if (time.textContent !== timeVal) {
      time.textContent = timeVal;
    }
    const isPrep = s.phase === 'prep';
    if (time.classList.contains('countdown') !== isPrep) {
      time.classList.toggle('countdown', isPrep);
    }

    if (phase.dataset.currentLabel !== copy.label) {
      phase.dataset.currentLabel = copy.label;
      if (document.hidden || s.phase === 'prep' || state.ui.alertFlash) {
        phase.textContent = copy.label;
        phase.classList.toggle('compact-kicker', copy.label.length > 16);
      } else {
        phase.classList.remove('phase-enter');
        phase.classList.add('phase-exit');
        clearTimeout(phaseTransitionTimer);
        phaseTransitionTimer = setTimeout(() => {
          phase.textContent = copy.label;
          phase.classList.toggle('compact-kicker', copy.label.length > 16);
          phase.classList.remove('phase-exit');
          phase.classList.add('phase-enter');
        }, 130);
      }
    } else {
      phase.classList.toggle('compact-kicker', copy.label.length > 16);
    }

    if (detail.textContent !== copy.detail) {
      detail.textContent = copy.detail;
    }

    if (!state.ui.pocketMode) {
      const ringOffset = CIRCUMFERENCE * (1 - progressFor(s));
      if (Math.abs(lastRingOffset - ringOffset) > 0.25 || s.phase === 'finished') {
        ring.style.strokeDashoffset = String(ringOffset);
        lastRingOffset = ringOffset;
      }
      if (ringTotal) {
        const totalOffset = CIRCUMFERENCE_TOTAL * (1 - progressTotalFor(s));
        if (Math.abs(lastTotalOffset - totalOffset) > 0.25 || s.phase === 'finished') {
          ringTotal.style.strokeDashoffset = String(totalOffset);
          lastTotalOffset = totalOffset;
        }
      }
    }

    const cardPhase = s.paused ? 'paused' : s.phase;
    if (card.dataset.phase !== cardPhase) card.dataset.phase = cardPhase;

    const cardTheme = s.paused ? 'paused' : ['prep', 'rest', 'cooldown', 'finished'].includes(s.phase) ? (s.phase === 'cooldown' ? 'rest' : s.phase) : s.plan.mode;
    if (card.dataset.theme !== cardTheme) card.dataset.theme = cardTheme;

    const isAlertFlash = Boolean(state.ui.alertFlash);
    if (card.classList.contains('alert-flash') !== isAlertFlash) {
      card.classList.toggle('alert-flash', isAlertFlash);
    }

    const isFinalTen = s.running && s.phase === 'work' && s.remainingMs <= 10000 && s.remainingMs > 0;
    if (card.classList.contains('final-ten-urgency') !== isFinalTen) {
      card.classList.toggle('final-ten-urgency', isFinalTen);
    }

    if (brandMark) {
      const currentIcon = s.phase === 'finished' ? 'check'
        : (s.running && s.phase === 'work') ? 'play'
        : (s.running && (s.phase === 'rest' || s.phase === 'cooldown')) ? 'pause'
        : 'clock';
      if (brandMark.dataset.icon !== currentIcon) {
        brandMark.dataset.icon = currentIcon;
        brandMark.innerHTML = icon(currentIcon);
      }
    }

    if (sub15Btn) {
      const shouldDisable = s.remainingMs <= 15000;
      if (sub15Btn.disabled !== shouldDisable) sub15Btn.disabled = shouldDisable;
    }

    if (alerts) {
      const alertsStr = `${s.alertsFired}/${s.alertSchedule.length || s.plan.alerts}`;
      if (alerts.textContent !== alertsStr) alerts.textContent = alertsStr;
    }
    if (round) {
      const roundStr = `${s.round}/${s.plan.rounds}`;
      if (round.textContent !== roundStr) round.textContent = roundStr;
    }
    if (totalRemNode) {
      const totalStr = formatTime(getTotalRemainingMs(s));
      if (totalRemNode.textContent !== totalStr) totalRemNode.textContent = totalStr;
    }
    if (scoreNode && scoreNode.textContent !== String(s.score)) {
      scoreNode.textContent = String(s.score);
    }
    if (scoreAoNode && scoreAoNode.textContent !== String(s.scoreAo)) {
      scoreAoNode.textContent = String(s.scoreAo);
    }

    updateWkfAdvantageBadge(s);

    if (upcoming) {
      const info = getUpcomingPhaseInfo(s);
      if (upcoming.textContent !== info) {
        upcoming.textContent = info;
        if (upcomingRow) upcomingRow.style.display = info ? 'flex' : 'none';
      }
    }

    if (summaryDuration && summaryDuration.textContent !== formatDuration(s.plan.durationMs)) {
      summaryDuration.textContent = formatDuration(s.plan.durationMs);
    }
    if (summaryAlerts && summaryAlerts.textContent !== String(s.plan.alerts)) {
      summaryAlerts.textContent = String(s.plan.alerts);
    }

    if (pips && pips.length && lastPipsRound !== s.round) {
      lastPipsRound = s.round;
      pips.forEach(pip => {
        const current = Number(pip.dataset.roundPip);
        pip.classList.toggle('complete', current < s.round);
        pip.classList.toggle('current', current === s.round);
      });
    }
  }

  function updateWkfAdvantageBadge(s) {
    const badge = document.getElementById('wkfAdvantageBadge');
    const advText = getWkfAdvantageText(s);
    if (badge) {
      badge.textContent = advText;
      badge.style.display = advText ? 'inline-flex' : 'none';
    }
    if (advText && !s.advantageAnnounced) {
      s.advantageAnnounced = true;
      playCue('finish');
      later(() => say(advText, true), 420);
    } else if (!advText) {
      s.advantageAnnounced = false;
    }

    const akaCorner = document.querySelector('.score-fighter.aka');
    const aoCorner = document.querySelector('.score-fighter.ao');
    if (akaCorner && aoCorner) {
      const akaDisqualified = (s.penaltyAka || 0) >= 5;
      const aoDisqualified = (s.penaltyAo || 0) >= 5;
      const isAkaLead8 = !akaDisqualified && ((s.score - s.scoreAo >= 8) || aoDisqualified);
      const isAoLead8 = !aoDisqualified && ((s.scoreAo - s.score >= 8) || akaDisqualified);
      const isFinishedWinnerAka = s.phase === 'finished' && !akaDisqualified && (aoDisqualified || s.score > s.scoreAo || (s.score === s.scoreAo && s.senshu === 'aka'));
      const isFinishedWinnerAo = s.phase === 'finished' && !aoDisqualified && (akaDisqualified || s.scoreAo > s.score || (s.score === s.scoreAo && s.senshu === 'ao'));
      akaCorner.classList.toggle('winner-corner', isAkaLead8 || isFinishedWinnerAka);
      aoCorner.classList.toggle('winner-corner', isAoLead8 || isFinishedWinnerAo);
    }
  }

  function createRandomSchedule(durationMs, alertCount) {
    if (!alertCount || !durationMs || durationMs < 2000) return [];
    const start = Math.max(800, Math.floor(durationMs * 0.08));
    const end = Math.floor(durationMs * 0.92);
    const usable = Math.max(1000, end - start);
    const minGapMs = Math.max(300, Math.min(600, Math.floor(usable / (alertCount * 2))));
    const maxPossibleAlerts = Math.max(1, Math.floor(usable / (minGapMs + 100)));
    const effectiveCount = Math.min(alertCount, maxPossibleAlerts);
    const block = usable / effectiveCount;

    const rawSchedule = Array.from({ length: effectiveCount }, (_, index) => {
      const jitter = (Math.random() - 0.5) * block * 0.5;
      return Math.round(start + block * (index + 0.5) + jitter);
    }).sort((a, b) => a - b);

    const validSchedule = [rawSchedule[0]];
    for (let i = 1; i < rawSchedule.length; i += 1) {
      const nextTime = Math.max(rawSchedule[i], validSchedule[validSchedule.length - 1] + minGapMs);
      if (nextTime < durationMs - 500) {
        validSchedule.push(nextTime);
      }
    }
    return validSchedule;
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
    clearTimeout(phaseTransitionTimer);
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
      callout = generateKarateCallout(plan.combatFocus, plan.customCallouts);
      later(() => say(callout, true), 95);
    }
    triggerAlertFlash(callout);
    const ring = document.getElementById('progressRing');
    if (ring) {
      ring.classList.remove('pip-fired');
      void ring.offsetWidth;
      ring.classList.add('pip-fired');
      setTimeout(() => ring.classList.remove('pip-fired'), 650);
    }
  }

  function startOrResume() {
    const currentPlan = getPlan();
    if (!currentPlan.durationMs) {
      showToast('Elegí una duración mayor a cero para empezar.', 'warning');
      return;
    }
    state.ui.recoveryAvailable = false;
    state.ui.recoverySnapshot = null;

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
    state.ui.recoveryAvailable = false;
    state.ui.recoverySnapshot = null;
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
    if (s.running) {
      s.remainingMs = Math.max(0, s.endAt - now);
    }
    const isSilent = Boolean(s.paused);
    advancePhase(now, isSilent, true);
    if (s.paused && s.running === false && s.phase !== 'finished') {
      s.phaseStartedAt = now;
      s.endAt = now + s.remainingMs;
      render();
    } else if (s.running) {
      scheduleTick();
    }
    persistSessionSnapshot();
  }

  function adjustRemainingTime(deltaMs) {
    const s = state.session;
    if ((!s.running && !s.paused) || s.phase === 'prep' || s.phase === 'finished') return;
    const now = Date.now();
    const currentRem = s.running ? Math.max(0, s.endAt - now) : s.remainingMs;
    if (deltaMs < 0 && currentRem <= 15000) {
      const btn = document.querySelector('[data-action="adjust-time"][data-delta-ms="-15000"]');
      if (btn) {
        btn.classList.remove('shake');
        void btn.offsetWidth;
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 400);
      }
      return showToast('No se puede restar: quedan 15 segundos o menos.', 'warning');
    }
    const nextRem = Math.max(1000, Math.min(7200000, currentRem + deltaMs));
    const appliedDelta = nextRem - currentRem;

    s.remainingMs = nextRem;
    s.durationMs = Math.max(s.durationMs + appliedDelta, nextRem);
    s.timeAdjustedMs = (s.timeAdjustedMs || 0) + appliedDelta;

    if (s.running) s.endAt = now + nextRem;
    if (nextRem > 10000) {
      s.cueFlags.tenSeconds = false;
    } else if (currentRem > 10000 && nextRem <= 9000) {
      s.cueFlags.tenSeconds = true;
    }
    if (s.plan.mode === 'random' && Array.isArray(s.alertSchedule)) {
      s.alertSchedule = s.alertSchedule.filter(alertTime => alertTime < s.durationMs);
      s.alertIndex = Math.min(s.alertIndex, s.alertSchedule.length);
    }
    updateLiveUi();
    persistSessionSnapshot();
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

  function pushScoreSnapshot(actionName = '') {
    const s = state.session;
    if (!s) return;
    if (!Array.isArray(s.scoreHistory)) s.scoreHistory = [];
    s.scoreHistory.push({
      score: s.score || 0,
      scoreAo: s.scoreAo || 0,
      senshu: s.senshu || '',
      penaltyAka: s.penaltyAka || 0,
      penaltyAo: s.penaltyAo || 0,
      action: actionName,
      remainingMs: s.remainingMs,
      round: s.round,
      timestamp: Date.now()
    });
    if (s.scoreHistory.length > 25) s.scoreHistory.shift();
  }

  function undoLastScoreAction() {
    const s = state.session;
    if (!s || !Array.isArray(s.scoreHistory) || !s.scoreHistory.length) {
      showToast('No hay acciones del tanteador para deshacer.', 'warning');
      return;
    }
    const prev = s.scoreHistory.pop();
    s.score = prev.score;
    s.scoreAo = prev.scoreAo;
    s.senshu = prev.senshu;
    s.penaltyAka = prev.penaltyAka;
    s.penaltyAo = prev.penaltyAo;

    const scoreNode = document.getElementById('scoreValue');
    if (scoreNode) scoreNode.textContent = String(s.score);
    const scoreAoNode = document.getElementById('scoreAoValue');
    if (scoreAoNode) scoreAoNode.textContent = String(s.scoreAo);

    const btnAka = document.querySelector('[data-action="toggle-senshu"][data-fighter="aka"]');
    const btnAo = document.querySelector('[data-action="toggle-senshu"][data-fighter="ao"]');
    if (btnAka) btnAka.classList.toggle('active', s.senshu === 'aka');
    if (btnAo) btnAo.classList.toggle('active', s.senshu === 'ao');

    const penAkaBtn = document.querySelector('[data-action="cycle-penalty"][data-fighter="aka"]');
    if (penAkaBtn) {
      penAkaBtn.textContent = PENALTY_LEVELS[s.penaltyAka] || 'Falta';
      penAkaBtn.classList.toggle('active', s.penaltyAka > 0);
    }
    const penAoBtn = document.querySelector('[data-action="cycle-penalty"][data-fighter="ao"]');
    if (penAoBtn) {
      penAoBtn.textContent = PENALTY_LEVELS[s.penaltyAo] || 'Falta';
      penAoBtn.classList.toggle('active', s.penaltyAo > 0);
    }

    const undoBtns = document.querySelectorAll('[data-action="undo-score"]');
    undoBtns.forEach(b => { b.disabled = s.scoreHistory.length === 0; });

    updateWkfAdvantageBadge(s);
    if (!state.preferences.dualScore) {
      render();
    }
    persistSessionSnapshot();
    showToast('Última acción del marcador deshecha.');
  }

  function incrementScore(delta = 1, fighter = 'aka') {
    const s = state.session;
    pushScoreSnapshot(delta > 0 ? `${fighter}+1` : `${fighter}-1`);
    const oldScore = s.score;

    if (fighter === 'ao') {
      s.scoreAo = Math.max(0, Math.min(9999, (s.scoreAo || 0) + delta));
    } else {
      s.score = Math.max(0, Math.min(9999, (s.score || 0) + delta));
    }

    const needsStructuralRender = !state.preferences.dualScore && ((oldScore === 0 && s.score > 0) || (oldScore > 0 && s.score === 0));
    const scoreNode = document.getElementById('scoreValue');
    const scoreAoNode = document.getElementById('scoreAoValue');

    if (needsStructuralRender || !scoreNode) {
      render();
    } else {
      if (fighter === 'ao' && scoreAoNode) {
        scoreAoNode.textContent = String(s.scoreAo);
      } else {
        scoreNode.textContent = String(s.score);
      }
      updateWkfAdvantageBadge(s);
    }

    const undoBtns = document.querySelectorAll('[data-action="undo-score"]');
    undoBtns.forEach(b => { b.disabled = false; });

    if (delta > 0) {
      animateScoreBump(fighter);
      vibrate(fighter === 'ao' ? [70] : [40]);
    }
    persistSessionSnapshot();
  }

  function toggleSenshu(fighter) {
    const s = state.session;
    pushScoreSnapshot(`senshu-${fighter}`);
    s.senshu = s.senshu === fighter ? '' : fighter;
    persistSessionSnapshot();
    const btnAka = document.querySelector('[data-action="toggle-senshu"][data-fighter="aka"]');
    const btnAo = document.querySelector('[data-action="toggle-senshu"][data-fighter="ao"]');
    if (btnAka && btnAo) {
      btnAka.classList.toggle('active', s.senshu === 'aka');
      btnAo.classList.toggle('active', s.senshu === 'ao');
      updateWkfAdvantageBadge(s);
    } else {
      render();
    }
    const undoBtns = document.querySelectorAll('[data-action="undo-score"]');
    undoBtns.forEach(b => { b.disabled = false; });
  }

  function cyclePenalty(fighter) {
    const s = state.session;
    pushScoreSnapshot(`penalty-${fighter}`);
    if (fighter === 'ao') {
      s.penaltyAo = ((s.penaltyAo || 0) + 1) % PENALTY_LEVELS.length;
    } else {
      s.penaltyAka = ((s.penaltyAka || 0) + 1) % PENALTY_LEVELS.length;
    }
    persistSessionSnapshot();
    const btn = document.querySelector(`[data-action="cycle-penalty"][data-fighter="${fighter}"]`);
    if (btn) {
      const level = fighter === 'ao' ? s.penaltyAo : s.penaltyAka;
      btn.textContent = PENALTY_LEVELS[level] || 'Falta';
      btn.classList.toggle('active', level > 0);
      updateWkfAdvantageBadge(s);
    } else {
      render();
    }
    const undoBtns = document.querySelectorAll('[data-action="undo-score"]');
    undoBtns.forEach(b => { b.disabled = false; });
  }

  function tick() {
    const s = state.session;
    if (!s.running) return;
    const now = Date.now();
    let guard = 0;
    let advancedCount = 0;

    while (s.running && now >= s.endAt && guard < 150) {
      advancePhase(s.endAt, true, false);
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
      persistSessionSnapshot();
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
    } else if (s.phase === 'cooldown') {
      playCue('rest');
      later(() => say('Enfriamiento. Respirá profundo', true), 320);
    }
  }

  function recordPhaseElapsed(s, natural = false) {
    if (!s) return;
    if (s.phase === 'work' || s.phase === 'rest' || s.phase === 'cooldown') {
      if (s.phaseElapsedRecorded) return;
      s.phaseElapsedRecorded = true;
      const elapsed = natural ? s.durationMs : Math.max(0, s.durationMs - Math.max(0, s.remainingMs));
      s.elapsedMs = (s.elapsedMs || 0) + elapsed;
    }
  }

  function advancePhase(boundaryAt, silent = false, isSkip = false) {
    const s = state.session;
    recordPhaseElapsed(s, !isSkip);
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
        if (state.preferences.cooldownSeconds > 0) {
          s.phase = 'cooldown';
          s.phaseElapsedRecorded = false;
          s.durationMs = state.preferences.cooldownSeconds * 1000;
          s.remainingMs = s.durationMs;
          s.phaseStartedAt = boundaryAt;
          s.endAt = boundaryAt + s.durationMs;
          s.cueFlags = { countdownSecond: 4 };
          if (!silent) {
            playCue('rest');
            later(() => say('Enfriamiento. Respirá profundo', true), 320);
            render();
          }
          return;
        }
        finishSession();
        return;
      }
      if (s.plan.restMs === 0) {
        s.round += 1;
        beginWork(boundaryAt);
        if (!silent) announceWorkStart(true);
      } else {
        s.phase = 'rest';
        s.phaseElapsedRecorded = false;
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
      return;
    }
    if (s.phase === 'cooldown') {
      finishSession();
    }
  }

  function beginWork(boundaryAt) {
    const s = state.session;
    const workMs = s.plan.workMs || s.plan.durationMs;
    s.phase = 'work';
    s.phaseElapsedRecorded = false;
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
    if (s.phase === 'prep' || s.phase === 'rest' || s.phase === 'cooldown') {
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

  function notifyBackgroundCompletion(s) {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const body = `${modeLabel(s.plan.mode)} finalizado (${formatDuration(s.plan.durationMs)}).`;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        if (reg && reg.showNotification) {
          reg.showNotification('¡Sesión completada! · Timer Round', {
            body,
            icon: 'icon.svg',
            badge: 'icon.svg',
            tag: 'timer-round-complete'
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  function finishSession() {
    const s = state.session;
    if (s.completed) return;
    s.completed = true;
    s.running = false;
    s.paused = false;
    recordPhaseElapsed(s, true);
    const cooldownMs = (state.preferences.cooldownSeconds || 0) * 1000;
    const plannedTotal = Math.max(1000, s.plan.durationMs + cooldownMs + (s.timeAdjustedMs || 0));
    s.effectiveDurationMs = (s.elapsedMs && s.elapsedMs > 0) ? s.elapsedMs : plannedTotal;
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
    notifyBackgroundCompletion(s);
  }

  function saveCompletedSession(s) {
    const totalMs = getSessionTotalDuration(s);
    const cooldownMs = (state.preferences.cooldownSeconds || 0) * 1000;
    const plannedMs = Math.max(1000, s.plan.durationMs + cooldownMs + (s.timeAdjustedMs || 0));
    const kcal = calculateKcal(s.plan.mode, totalMs, state.preferences.userWeightKg);
    state.history.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      completedAt: new Date().toISOString(),
      mode: s.plan.mode,
      durationMs: totalMs,
      plannedDurationMs: plannedMs,
      rounds: s.plan.rounds,
      score: s.score || 0,
      scoreAo: s.scoreAo || 0,
      kcal
    });
    state.history = state.history.slice(0, 100);
    persist();
  }

  function addCustomCallout(explicitText) {
    const input = document.getElementById('customCalloutInput');
    const text = String(explicitText || (input ? input.value : state.ui.customCalloutDraft) || '').trim().slice(0, 34);
    if (!text) return;
    const list = sanitizeCustomCallouts([...(state.settings.random.customCallouts || []), text]);
    state.settings.random.customCallouts = list;
    state.ui.customCalloutDraft = '';
    state.session = createIdleSession();
    persist();
    render();
    showToast(`Técnica "${text}" agregada.`);
  }

  function removeCustomCallout(index) {
    const current = state.settings.random.customCallouts || [];
    state.settings.random.customCallouts = current.filter((_, idx) => idx !== index);
    state.session = createIdleSession();
    persist();
    render();
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
      if (cfg.customCallouts && cfg.customCallouts.length) {
        url.searchParams.set('custom', cfg.customCallouts.join('|'));
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

  async function shareSessionResult() {
    const s = state.session;
    const totalMs = getSessionTotalDuration(s);
    const dur = formatDuration(totalMs);
    const combatOutcome = getCombatResultMessage(s);
    const scorePart = combatOutcome ? ` · ${combatOutcome}` : s.scoreAo > 0 ? ` · Aka ${s.score} - ${s.scoreAo} Ao` : s.score > 0 ? ` · ${s.score} pts` : '';
    const roundsPart = s.plan.rounds > 1 ? ` · ${s.round}/${s.plan.rounds} rondas` : '';
    const shareText = `🥋 ¡Entrenamiento completado en Timer Round! Modo: ${modeLabel(s.plan.mode)}${roundsPart} · Duración: ${dur}${scorePart}`;
    const url = buildShareableUrl();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Timer Round · Sesión completada',
          text: shareText,
          url
        });
        return;
      }
    } catch (_) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        showToast('¡Resumen de sesión copiado al portapapeles!');
        return;
      }
    } catch (_) {}
    showToast('Sesión completada.');
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
    const found = state.savedRoutines.find(r => r.id === routineId)
      || OFFICIAL_ROUTINES.find(r => r.id === routineId);
    if (!found) return;
    state.activeMode = found.mode;
    state.settings[found.mode] = {
      ...defaults.settings[found.mode],
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

  function exportHistoryCsv() {
    if (!state.history.length) return;
    try {
      const headers = ['ID', 'Fecha_ISO', 'Modo', 'Rondas', 'Duracion_Segundos', 'Duracion_Formato', 'Puntos_Aka', 'Puntos_Ao', 'Kcal_Estimadas'];
      const rows = state.history.map(item => {
        const durSec = Math.round((item.durationMs || 0) / 1000);
        const durFmt = formatDuration(item.durationMs || 0);
        return [
          `"${String(item.id || '').replace(/"/g, '""')}"`,
          `"${item.completedAt}"`,
          `"${modeLabel(item.mode)}"`,
          item.rounds || 1,
          durSec,
          `"${durFmt}"`,
          item.score || 0,
          item.scoreAo || 0,
          item.kcal || 0
        ].join(',');
      });
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `timer-round-historial-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast('Historial exportado en formato CSV.');
    } catch (_) {
      showToast('No se pudo exportar el historial en CSV.', 'warning');
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

  function exportRoutinesJson() {
    if (!state.savedRoutines.length) {
      showToast('No tenés rutinas guardadas para exportar.', 'warning');
      return;
    }
    try {
      const payload = JSON.stringify({
        exportedAt: new Date().toISOString(),
        app: 'Timer Round',
        type: 'routines',
        version: 1,
        savedRoutines: state.savedRoutines
      }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `timer-round-rutinas-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast('Rutinas exportadas correctamente.');
    } catch (_) {
      showToast('No se pudieron exportar las rutinas.', 'warning');
    }
  }

  function importRoutinesFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.savedRoutines) ? parsed.savedRoutines : null);
        if (!list) {
          showToast('El archivo no contiene rutinas válidas.', 'warning');
          return;
        }
        const merged = sanitizeRoutineList([...list, ...state.savedRoutines]);
        state.savedRoutines = merged;
        persist();
        render();
        showToast(`Rutinas actualizadas (${merged.length} guardadas).`);
      } catch (_) {
        showToast('No se pudo leer el archivo JSON.', 'warning');
      }
    };
    reader.readAsText(file);
  }

  function togglePocketMode(forced) {
    state.ui.pocketMode = typeof forced === 'boolean' ? forced : !state.ui.pocketMode;
    const shell = document.querySelector('.app-shell');
    if (shell) shell.classList.toggle('pocket-mode', state.ui.pocketMode);
    const pocketBtn = document.querySelector('[data-action="toggle-pocket"]');
    if (pocketBtn) {
      pocketBtn.classList.toggle('active-icon', state.ui.pocketMode);
      pocketBtn.setAttribute('aria-pressed', String(state.ui.pocketMode));
    }
    showToast(state.ui.pocketMode ? 'Modo Bolsillo (OLED) activo · Tocá la pantalla o presioná P para salir' : 'Modo Bolsillo desactivado');
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
      if (!audioContext.onstatechange) {
        audioContext.onstatechange = () => {
          if (audioContext && (audioContext.state === 'suspended' || audioContext.state === 'interrupted')) {
            const s = state.session;
            if (s && (s.running || s.paused)) {
              audioContext.resume().catch(() => {});
            }
          }
        };
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
    const modal = document.querySelector('[data-modal-content]');
    const closeBtn = document.getElementById('closeHistoryButton');
    if (closeBtn) closeBtn.focus();
    if (modal) trapFocus(modal);
  }

  function trapFocus(modal) {
    if (!modal || modal.dataset.focusTrapped === 'true') return;
    modal.dataset.focusTrapped = 'true';
    modal.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(modal.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function closeHistoryModal() {
    state.ui.historyOpen = false;
    state.ui.confirmClearHistory = false;
    render();
    if (lastFocusedElement && lastFocusedElement.isConnected && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    } else {
      const historyBtn = document.getElementById('openHistoryButton');
      if (historyBtn && typeof historyBtn.focus === 'function') {
        historyBtn.focus();
      }
    }
    lastFocusedElement = null;
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
    if (state.ui.pocketMode) {
      const pocketBtn = event.target.closest('[data-action="toggle-pocket"]');
      if (!pocketBtn) {
        togglePocketMode(false);
        return;
      }
    }
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
    if (action === 'toggle-senshu') {
      return toggleSenshu(button.dataset.fighter || 'aka');
    }
    if (action === 'cycle-penalty') {
      return cyclePenalty(button.dataset.fighter || 'aka');
    }
    if (action === 'undo-score') {
      return undoLastScoreAction();
    }
    if (action === 'reset-score') {
      pushScoreSnapshot('reset');
      state.session.score = 0;
      state.session.scoreAo = 0;
      state.session.senshu = '';
      state.session.penaltyAka = 0;
      state.session.penaltyAo = 0;
      state.session.advantageAnnounced = false;
      persistSessionSnapshot();
      showToast('Marcador reiniciado. Tocá ↶ Deshacer (Z) si fue un error.');
      return render();
    }
    if (action === 'toggle-tatami') {
      togglePreference('tatamiView');
      return showToast(state.preferences.tatamiView ? 'Vista Tatami activada.' : 'Vista estándar activada.');
    }
    if (action === 'share-config') return shareCurrentConfig();
    if (action === 'share-result') return shareSessionResult();
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
    if (action === 'add-custom-callout') return addCustomCallout();
    if (action === 'remove-custom-callout') return removeCustomCallout(Number(button.dataset.index));
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
    if (action === 'set-cooldown-seconds') {
      updateSetting('preferences.cooldownSeconds', button.dataset.value, true);
      return;
    }
    if (action === 'toggle-preference') return togglePreference(button.dataset.preference);
    if (action === 'request-notifications') {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        return showToast('Tu navegador no soporta notificaciones.', 'warning');
      }
      Notification.requestPermission().then(permission => {
        render();
        if (permission === 'granted') {
          showToast('Notificaciones activadas para cuando la app esté en segundo plano.');
        } else {
          showToast('Permiso de notificaciones no concedido.', 'warning');
        }
      });
      return;
    }
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
    if (action === 'test-voice') {
      if (!state.preferences.voice) {
        return showToast('La voz está desactivada en Configuración.', 'warning');
      }
      if (!('speechSynthesis' in window)) {
        return showToast('Tu navegador no soporta síntesis de voz.', 'warning');
      }
      say('Timer Round listo. ¡A trabajar!', true);
      return showToast('Voz de prueba emitida.');
    }
    if (action === 'test-vibration') {
      if (!state.preferences.vibration) {
        return showToast('La vibración está desactivada en Configuración.', 'warning');
      }
      if (!('vibrate' in navigator)) {
        return showToast('Tu dispositivo no soporta vibración háptica.', 'warning');
      }
      vibrate([100, 60, 100, 60, 200]);
      return showToast('Patrón de vibración emitido.');
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
      render();
      const newActive = document.querySelector(`[data-action="filter-history"][data-filter="${state.ui.historyFilter}"]`);
      if (newActive && typeof newActive.focus === 'function') newActive.focus();
      return;
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
    if (action === 'export-csv') return exportHistoryCsv();
    if (action === 'export-routines') return exportRoutinesJson();
    if (action === 'toggle-pocket') return togglePocketMode();
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
    if (event.target.id === 'importRoutinesInput') {
      const file = event.target.files && event.target.files[0];
      importRoutinesFile(file);
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
    if (event.target.id === 'historySearchInput') {
      state.ui.historySearchQuery = event.target.value;
      const historyList = document.querySelector('.history-list');
      if (historyList) {
        const filter = state.ui.historyFilter;
        const q = state.ui.historySearchQuery.trim().toLowerCase();
        const filtered = state.history.filter(item => {
          if (filter !== 'all' && item.mode !== filter) return false;
          if (!q) return true;
          const modeTxt = modeLabel(item.mode).toLowerCase();
          const dateTxt = new Date(item.completedAt).toLocaleDateString('es-AR').toLowerCase();
          const scoreTxt = `aka ${item.score} ao ${item.scoreAo}`.toLowerCase();
          return modeTxt.includes(q) || dateTxt.includes(q) || scoreTxt.includes(q);
        });
        historyList.innerHTML = filtered.length
          ? filtered.map(renderHistoryItem).join('')
          : `<p class="empty-history">${state.history.length ? 'No se encontraron sesiones que coincidan con la búsqueda.' : 'No hay sesiones registradas todavía.'}</p>`;
      }
      return;
    }
    if (event.target.id === 'routineNameInput') {
      state.ui.routineNameDraft = event.target.value;
      return;
    }
    if (event.target.id === 'customCalloutInput') {
      state.ui.customCalloutDraft = event.target.value;
      return;
    }
    if (event.target.dataset.field === 'preferences.volume') {
      const range = FIELD_RANGES['preferences.volume'];
      const val = number(event.target.value, range[0], range[1], state.preferences.volume);
      state.preferences.volume = val;
      const label = document.getElementById('volumeValue');
      if (label) label.textContent = `${val}%`;
      debouncedPersist(200);
    } else if (event.target.dataset.field === 'preferences.userWeightKg') {
      const range = FIELD_RANGES['preferences.userWeightKg'];
      const val = number(event.target.value, range[0], range[1], state.preferences.userWeightKg || 70);
      state.preferences.userWeightKg = val;
      const label = document.getElementById('weightValue');
      if (label) label.textContent = `${val} kg`;
      debouncedPersist(200);
    } else if (event.target.matches('input[data-field]')) {
      if (event.target.value === '') return;
      updateSetting(event.target.dataset.field, event.target.value, false, false);
    }
  }

  function onAppKeydown(event) {
    if (event.target.matches('.timer-core') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      state.session.running ? pauseSession() : startOrResume();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.file-button')) {
      event.preventDefault();
      event.stopPropagation();
      const input = event.target.querySelector('input[type="file"]');
      if (input) input.click();
      return;
    }
    if (event.key === 'Enter' && event.target.id === 'routineNameInput') {
      event.preventDefault();
      saveCurrentRoutine();
      return;
    }
    if (event.key === 'Enter' && event.target.id === 'customCalloutInput') {
      event.preventDefault();
      addCustomCallout();
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
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (state.ui.historyOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeHistoryModal();
        }
        return;
      }
      if (event.target && typeof event.target.matches === 'function') {
        if (event.target.matches('input, textarea, select')) return;
      }

      if (event.code === 'Space') {
        if (event.target && typeof event.target.matches === 'function' && event.target.matches('button, [role="button"], [role="tab"], .file-button')) {
          return;
        }
        event.preventDefault();
        state.session.running ? pauseSession() : startOrResume();
      } else if (event.key.toLowerCase() === 'z' && (state.session.running || state.session.paused || (state.session.scoreHistory && state.session.scoreHistory.length))) {
        undoLastScoreAction();
      } else if (event.key.toLowerCase() === 'c' && (state.session.running || state.session.paused)) {
        playTone(1320, 0.045, 'sine', 0.45);
        incrementScore(1, 'aka');
      } else if (event.key.toLowerCase() === 'x' && (state.session.running || state.session.paused)) {
        incrementScore(-1, 'aka');
      } else if (event.key.toLowerCase() === 'v' && (state.session.running || state.session.paused) && state.preferences.dualScore) {
        playTone(980, 0.045, 'sine', 0.45);
        incrementScore(1, 'ao');
      } else if (event.key.toLowerCase() === 'b' && (state.session.running || state.session.paused) && state.preferences.dualScore) {
        incrementScore(-1, 'ao');
      } else if (event.key.toLowerCase() === 's' && canSkipPhase(state.session)) {
        skipCurrentPhase();
      } else if (event.key.toLowerCase() === 't') {
        togglePreference('tatamiView');
        showToast(state.preferences.tatamiView ? 'Vista Tatami activada.' : 'Vista estándar activada.');
      } else if (event.key.toLowerCase() === 'p') {
        togglePocketMode();
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
        if (audioContext && (audioContext.state === 'suspended' || audioContext.state === 'interrupted')) {
          audioContext.resume().catch(() => {});
        }
        tick();
      }
    });

    window.addEventListener('pagehide', () => {
      if (state.session.running || state.session.paused) {
        persistSessionSnapshot();
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
      toggleSenshu,
      cyclePenalty,
      undoScore: undoLastScoreAction,
      addCustomCallout,
      removeCustomCallout,
      setMode,
      updateSetting,
      stepField,
      togglePreference,
      saveCurrentRoutine,
      loadRoutineById,
      deleteRoutineById,
      shareCurrentConfig,
      shareSessionResult,
      exportRoutines: exportRoutinesJson,
      importRoutines: importRoutinesFile,
      exportHistoryCsv,
      togglePocket: togglePocketMode,
      advancePhase,
      tick,
      render
    },
    audio: {
      prepareAudio,
      playTone,
      playCue,
      say
    },
    utils: {
      CIRCUMFERENCE,
      CIRCUMFERENCE_TOTAL,
      progressFor,
      progressTotalFor,
      calculateKcal,
      getSessionTotalDuration,
      recordPhaseElapsed,
      getCombatResultMessage,
      OFFICIAL_ROUTINES,
      exportHistoryCsv,
      MET_VALUES,
      number,
      escapeHtml,
      sanitizeStoredData,
      sanitizeHistoryList,
      sanitizeRoutineList,
      sanitizeCustomCallouts,
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
      PENALTY_LEVELS,
      formatTime,
      formatDuration,
      buildShareableUrl,
      applyUrlParams,
      getUpcomingPhaseInfo,
      getWkfAdvantageText,
      VALID_SOUND_PACKS,
      SOUND_PACKS
    }
  };

  if (app) {
    mount(app);
  }
})();
