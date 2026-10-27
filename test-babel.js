/*
 * Browser smoke & unit/integration test runner for Timer Round.
 * Preserves window.timerRoundSmoke and the 'timer-round-smoke-complete' event
 * while running non-destructive assertions against the live engine.
 */
(async () => {
  const assets = ['index.html', 'app.js', 'styles.css', 'manifest.json', 'sw.js', 'icon.svg'];
  const assetResults = await Promise.all(assets.map(async asset => {
    try {
      const response = await fetch(asset, { cache: 'no-store' });
      return { asset, ok: response.ok, status: response.status };
    } catch (error) {
      return { asset, ok: false, status: error.message };
    }
  }));

  window.timerRoundSmoke = assetResults;
  console.table(assetResults);
  window.dispatchEvent(new CustomEvent('timer-round-smoke-complete', { detail: assetResults }));

  function waitForEngine(timeoutMs = 3000) {
    return new Promise(resolve => {
      const start = Date.now();
      const check = () => {
        const frame = document.querySelector('iframe');
        const api = (frame && frame.contentWindow && frame.contentWindow.TimerRound) || window.TimerRound;
        if (api) return resolve({ api, frameWindow: (frame && frame.contentWindow) || window });
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, 60);
      };
      check();
    });
  }

  const target = await waitForEngine();
  const unitSuites = [];
  const assert = (name, condition, detail = '') => {
    unitSuites.push({ name, ok: Boolean(condition), detail });
  };

  if (target && target.api) {
    const { utils } = target.api;

    assert('number() rechaza string vacío y usa fallback', utils.number('', 1, 120, 45) === 45);
    assert('number() rechaza null y booleanos', utils.number(null, 0, 100, 70) === 70 && utils.number(false, 0, 100, 70) === 70);
    assert('number() aplica límites min y max', utils.number(999, 1, 60, 10) === 60 && utils.number(-5, 1, 60, 10) === 1);

    const sanitized = utils.sanitizeStoredData({
      activeMode: 'invalid-mode',
      settings: { random: { minutes: '', alerts: 500, cueType: 'combat', combatFocus: 'custom', customCallouts: ['Blitz', 'Blitz', '  '] } },
      preferences: { volume: null, prepSeconds: 5, cooldownSeconds: 60, dualScore: true },
      history: [
        { id: 'dup-1', completedAt: '2026-10-10T10:00:00Z', mode: 'tabata', durationMs: 120000, rounds: 8, score: 12, scoreAo: 9 },
        { id: 'dup-1', completedAt: '2026-10-10T10:00:00Z', mode: 'tabata', durationMs: 120000, rounds: 8, score: 12, scoreAo: 9 },
        { id: 'bad-date', completedAt: 'fecha-invalida', mode: 'focus', durationMs: 5000 }
      ]
    });

    assert('sanitizeStoredData() corrige activeMode inválido', sanitized.activeMode === 'random');
    assert('sanitizeStoredData() preserva volumen, cueType, cooldown y deduplica customCallouts',
      sanitized.preferences.volume === 70 &&
      sanitized.preferences.cooldownSeconds === 60 &&
      sanitized.settings.random.customCallouts.length === 1
    );
    assert('sanitizeStoredData() deduplica historial y conserva marcador Aka/Ao', sanitized.history.length === 1 && sanitized.history[0].score === 12 && sanitized.history[0].scoreAo === 9);

    const tabataPlan = utils.getPlan('tabata', {
      random: { minutes: 1, alerts: 5 },
      tabata: { work: 20, rest: 10, rounds: 8 },
      focus: { minutes: 5, seconds: 0 }
    });
    assert('getPlan("tabata") calcula duración exacta (8×20s + 7×10s = 230s)', tabataPlan.durationMs === 230000);

    const multiRandomPlan = utils.getPlan('random', {
      random: { minutes: 2, alerts: 12, rounds: 3, rest: 60, cueType: 'combat' }
    });
    assert('getPlan("random") multi-round calcula trabajo + descansos (3×120s + 2×60s = 480s)', multiRandomPlan.durationMs === 480000 && multiRandomPlan.rounds === 3);

    const emomPlan = utils.getPlan('emom', {
      emom: { interval: 45, rounds: 8 }
    });
    assert('getPlan("emom") calcula duración total (8×45s = 360s)', emomPlan.durationMs === 360000 && emomPlan.workMs === 45000);

    const schedule = utils.createRandomSchedule(60000, 15);
    const isSortedAndSpaced = schedule.every((val, i) => i === 0 || val >= schedule[i - 1] + 200);
    assert('createRandomSchedule() genera señales ordenadas y con separación mínima', schedule.length === 15 && isSortedAndSpaced);

    const streak = utils.calculateStreakDays([
      { completedAt: new Date().toISOString() },
      { completedAt: new Date(Date.now() - 86400000).toISOString() }
    ]);
    assert('calculateStreakDays() contabiliza días consecutivos correctamente', streak === 2);

    const weekly = utils.getWeeklyActivity([{ completedAt: new Date().toISOString(), durationMs: 120000 }]);
    assert('getWeeklyActivity() genera los 7 días de la semana con porcentajes de barra', Array.isArray(weekly) && weekly.length === 7 && weekly[6].sessions === 1);

    assert('formatSpeechText() adapta fonética japonesa de Karate al español', utils.formatSpeechText('Kizami - Gyaku') === 'kisami, guiaku');

    assert('Generador táctico de Karate soporta técnicas personalizadas y filtros por categoría',
      utils.generateKarateCallout('custom', ['Barrida y Gyaku']) === 'Barrida y Gyaku' &&
      utils.KARATE_COMBINATIONS.includes(utils.generateKarateCallout('combinations'))
    );

    assert('adjustRemainingTime() no altera plan.workMs en rondas futuras',
      (() => {
        const before = utils.getPlan('random', {
          random: { minutes: 2, alerts: 5, rounds: 3, rest: 30, cueType: 'pip' }
        });
        return before.workMs === 120000;
      })()
    );

    assert('getUpcomingPhaseInfo() distingue correctamente Tabata y EMOM sin código muerto',
      utils.getUpcomingPhaseInfo({
        running: true, paused: false, phase: 'work', round: 1,
        plan: { mode: 'tabata', rounds: 3, restMs: 10000, workMs: 20000 }
      }).includes('R2/3') &&
      utils.getUpcomingPhaseInfo({
        running: true, paused: false, phase: 'work', round: 1,
        plan: { mode: 'emom', rounds: 10, restMs: 0, workMs: 60000 }
      }).includes('minuto 2/10')
    );

    assert('SOUND_PACKS expone los 4 packs esperados (incluyendo buzzer) y PENALTY_LEVELS incluye Hansoku (H)',
      Array.isArray(utils.VALID_SOUND_PACKS) &&
      utils.VALID_SOUND_PACKS.length === 4 &&
      utils.VALID_SOUND_PACKS.includes('buzzer') &&
      Array.isArray(utils.PENALTY_LEVELS) &&
      utils.PENALTY_LEVELS.includes('H')
    );

    assert('sanitizeCustomCallouts() recorta espacios, respeta tope de 20 y elimina duplicados',
      (() => {
        const list = ['  Kizami  ', 'kizami', '', 'Gyaku'];
        const res = utils.sanitizeCustomCallouts(list);
        return res.length === 2 && res[0] === 'Kizami' && res[1] === 'Gyaku';
      })()
    );

    assert('PENALTY_LEVELS contiene la progresión oficial WKF de 6 niveles (vacío, C1..C3, HC, H)',
      Array.isArray(utils.PENALTY_LEVELS) &&
      utils.PENALTY_LEVELS.length === 6 &&
      utils.PENALTY_LEVELS[4] === 'HC' &&
      utils.PENALTY_LEVELS[5] === 'H'
    );

    assert('escapeHtml() sanitiza &, <, >, ", y apóstrofes (\')',
      typeof utils.escapeHtml === 'function' &&
      utils.escapeHtml("<b class='test'>O'Connor & Sons</b>") ===
      '&lt;b class=&#39;test&#39;&gt;O&#39;Connor &amp; Sons&lt;/b&gt;'
    );

    assert('shareSessionResult está disponible en las acciones del motor',
      typeof target.api.actions.shareSessionResult === 'function'
    );

    assert('calculateKcal() calcula gasto calórico según METs y peso corporal',
      typeof utils.calculateKcal === 'function' &&
      utils.calculateKcal('tabata', 240000, 70) === 51.3 &&
      utils.calculateKcal('focus', 300000, 70) === 20.4
    );

    assert('CIRCUMFERENCE_TOTAL coincide con radio de 136px del anillo exterior',
      Math.abs(utils.CIRCUMFERENCE_TOTAL - (2 * Math.PI * 136)) < 0.001
    );

    assert('Acciones de Rutinas JSON y Modo Bolsillo disponibles en target.api.actions',
      typeof target.api.actions.exportRoutines === 'function' &&
      typeof target.api.actions.importRoutines === 'function' &&
      typeof target.api.actions.togglePocket === 'function'
    );

    assert('progressTotalFor() calcula progreso global macro sin errores',
      typeof utils.progressTotalFor === 'function' &&
      utils.progressTotalFor({ phase: 'idle', plan: { durationMs: 60000, rounds: 1 } }) === 0 &&
      utils.progressTotalFor({ phase: 'finished', plan: { durationMs: 60000, rounds: 1 } }) === 1
    );

    assert('getSessionTotalDuration() devuelve duración completa de la sesión y no solo la fase activa',
      typeof utils.getSessionTotalDuration === 'function' &&
      utils.getSessionTotalDuration({
        phase: 'finished',
        durationMs: 20000,
        plan: { mode: 'tabata', durationMs: 230000, rounds: 8, workMs: 20000, restMs: 10000 }
      }) === 230000
    );

    assert('sanitizeRoutineList() deduplica rutinas por firma (modo + nombre)',
      (() => {
        const dupes = [
          { id: '1', mode: 'tabata', name: 'HIIT Intenso' },
          { id: '2', mode: 'tabata', name: 'hiit intenso' },
          { id: '3', mode: 'random', name: 'Combate 2m' }
        ];
        const res = utils.sanitizeRoutineList(dupes);
        return res.length === 2 && res[0].name === 'HIIT Intenso' && res[1].name === 'Combate 2m';
      })()
    );

    assert('undoScore() está disponible en actions del motor',
      typeof target.api.actions.undoScore === 'function'
    );

    assert('recordPhaseElapsed() es idempotente y no duplica el tiempo transcurrido en llamadas consecutivas',
      (() => {
        const testSession = {
          phase: 'work',
          durationMs: 60000,
          remainingMs: 0,
          elapsedMs: 0,
          phaseElapsedRecorded: false
        };
        utils.recordPhaseElapsed(testSession);
        const afterFirst = testSession.elapsedMs;
        utils.recordPhaseElapsed(testSession);
        return afterFirst === 60000 && testSession.elapsedMs === 60000 && testSession.phaseElapsedRecorded === true;
      })()
    );

    assert('sw.js aísla la búsqueda en caché con matchInAppCache',
      (await fetch('sw.js').then(r => r.text())).includes('matchInAppCache')
    );

    assert('exportHistoryCsv() y OFFICIAL_ROUTINES están disponibles en el motor',
      typeof target.api.actions.exportHistoryCsv === 'function' &&
      Array.isArray(utils.OFFICIAL_ROUTINES) &&
      utils.OFFICIAL_ROUTINES.length >= 5
    );

    assert('getCombatResultMessage() calcula victorias por puntos, Senshu y Hansoku correctamente',
      utils.getCombatResultMessage({ score: 5, scoreAo: 2 }) === 'Victoria Aka (5 - 2)' &&
      utils.getCombatResultMessage({ score: 3, scoreAo: 3, senshu: 'ao' }) === 'Victoria Ao por Senshu (3 - 3)' &&
      utils.getCombatResultMessage({ score: 1, scoreAo: 0, penaltyAka: 5 }) === 'Victoria Ao · Hansoku Aka' &&
      utils.getCombatResultMessage({ score: 8, scoreAo: 0 }) === 'Victoria Aka (+8 pts)'
    );

    assert('Supremacía arbitral WKF: Hansoku descalifica a Aka aun con ventaja de puntos (6 a 2)',
      utils.getCombatResultMessage({ score: 6, scoreAo: 2, penaltyAka: 5 }) === 'Victoria Ao · Hansoku Aka'
    );

    assert('Prueba determinista: suspensión en Tabata 20/10/3 reanuda en R2 work con tiempos exactos', (() => {
      const state = target.api.getState();
      const origSession = state.session;
      const origPrefs = state.preferences;
      try {
        const t0 = 100000;
        state.preferences.cooldownSeconds = 0;
        state.session = {
          running: true,
          paused: false,
          phase: 'work',
          round: 1,
          phaseElapsedRecorded: false,
          elapsedMs: 0,
          durationMs: 20000,
          remainingMs: 20000,
          phaseStartedAt: t0,
          endAt: t0 + 20000,
          plan: { mode: 'tabata', durationMs: 80000, workMs: 20000, restMs: 10000, rounds: 3 },
          cueFlags: {}
        };
        const wakeTime = t0 + 36000;
        const origNow = Date.now;
        const origFrameNow = target.frameWindow.Date.now;
        Date.now = () => wakeTime;
        target.frameWindow.Date.now = () => wakeTime;
        try {
          target.api.actions.tick();
        } finally {
          Date.now = origNow;
          target.frameWindow.Date.now = origFrameNow;
        }
        const s = state.session;
        return s.round === 2 && s.phase === 'work' && s.elapsedMs === 30000 && s.remainingMs === 14000;
      } finally {
        state.session = origSession;
        state.preferences = origPrefs;
      }
    })());

    assert('Prueba suspensión prolongada: sesión completa terminada registra duración y calorías exactas', (() => {
      const state = target.api.getState();
      const origSession = state.session;
      const origPrefs = state.preferences;
      const origHistory = state.history;
      try {
        const t0 = 100000;
        state.preferences.cooldownSeconds = 0;
        state.preferences.userWeightKg = 70;
        state.session = {
          running: true,
          paused: false,
          phase: 'work',
          round: 1,
          phaseElapsedRecorded: false,
          elapsedMs: 0,
          durationMs: 20000,
          remainingMs: 20000,
          phaseStartedAt: t0,
          endAt: t0 + 20000,
          plan: { mode: 'tabata', durationMs: 80000, workMs: 20000, restMs: 10000, rounds: 3 },
          cueFlags: {}
        };
        const wakeTime = t0 + 100000;
        const origNow = Date.now;
        const origFrameNow = target.frameWindow.Date.now;
        Date.now = () => wakeTime;
        target.frameWindow.Date.now = () => wakeTime;
        try {
          target.api.actions.tick();
        } finally {
          Date.now = origNow;
          target.frameWindow.Date.now = origFrameNow;
        }
        const s = state.session;
        const latestHist = state.history[0];
        return s.phase === 'finished' &&
          s.effectiveDurationMs === 80000 &&
          latestHist &&
          latestHist.durationMs === 80000 &&
          latestHist.plannedDurationMs === 80000;
      } finally {
        state.session = origSession;
        state.preferences = origPrefs;
        state.history = origHistory;
      }
    })());

    assert('Salto de fase en pausa es silencioso y acumula solo el tiempo parcial transcurrido', (() => {
      const state = target.api.getState();
      const origSession = state.session;
      try {
        state.session = {
          running: false,
          paused: true,
          phase: 'work',
          round: 1,
          phaseElapsedRecorded: false,
          elapsedMs: 0,
          durationMs: 20000,
          remainingMs: 8000,
          plan: { mode: 'tabata', durationMs: 80000, workMs: 20000, restMs: 10000, rounds: 3 },
          cueFlags: {}
        };
        target.api.actions.skipCurrentPhase();
        const s = state.session;
        return s.phase === 'rest' && s.round === 1 && s.elapsedMs === 12000 && s.remainingMs === 10000 && s.paused === true;
      } finally {
        state.session = origSession;
      }
    })());

    assert('Atajos de teclado ignoran combinaciones con Ctrl/Meta/Alt para evitar colisiones del sistema', (() => {
      const state = target.api.getState();
      const origSession = state.session;
      try {
        state.session = {
          running: true,
          paused: false,
          phase: 'work',
          round: 1,
          durationMs: 20000,
          remainingMs: 20000,
          score: 0,
          scoreAo: 0,
          plan: { mode: 'tabata', durationMs: 80000, workMs: 20000, restMs: 10000, rounds: 3 },
          cueFlags: {}
        };
        target.frameWindow.dispatchEvent(new target.frameWindow.KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true }));
        target.frameWindow.dispatchEvent(new target.frameWindow.KeyboardEvent('keydown', { key: 'c', code: 'KeyC', ctrlKey: true, bubbles: true }));
        return state.session.phase === 'work' && state.session.score === 0;
      } finally {
        state.session = origSession;
      }
    })());
  } else {
    assert('Motor TimerRound accesible en vista de prueba', false, 'No se encontró window.TimerRound');
  }

  window.timerRoundUnitTests = unitSuites;
  window.dispatchEvent(new CustomEvent('timer-round-unit-complete', { detail: unitSuites }));
})();
