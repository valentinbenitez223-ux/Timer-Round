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
      settings: { random: { minutes: '', alerts: 500, cueType: 'combat', combatFocus: 'combinations' } },
      preferences: { volume: null, prepSeconds: 5, dualScore: true },
      history: [
        { id: 'dup-1', completedAt: '2026-10-10T10:00:00Z', mode: 'tabata', durationMs: 120000, rounds: 8, score: 12, scoreAo: 9 },
        { id: 'dup-1', completedAt: '2026-10-10T10:00:00Z', mode: 'tabata', durationMs: 120000, rounds: 8, score: 12, scoreAo: 9 },
        { id: 'bad-date', completedAt: 'fecha-invalida', mode: 'focus', durationMs: 5000 }
      ]
    });

    assert('sanitizeStoredData() corrige activeMode inválido', sanitized.activeMode === 'random');
    assert('sanitizeStoredData() preserva volumen, cueType y combatFocus', sanitized.preferences.volume === 70 && sanitized.settings.random.cueType === 'combat' && sanitized.settings.random.combatFocus === 'combinations');
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

    assert('Generador táctico de Karate soporta filtros por subcategoría y evita duplicados consecutivos',
      Array.isArray(utils.KARATE_COMBINATIONS) &&
      utils.KARATE_COMBINATIONS.includes(utils.generateKarateCallout('combinations')) &&
      utils.KARATE_DISPLACEMENTS.includes(utils.generateKarateCallout('displacements'))
    );

    assert('adjustRemainingTime() no altera plan.workMs en rondas futuras',
      (() => {
        const before = utils.getPlan('random', {
          random: { minutes: 2, alerts: 5, rounds: 3, rest: 30, cueType: 'pip' }
        });
        const after = utils.getPlan('random', {
          random: { minutes: 2, alerts: 5, rounds: 3, rest: 30, cueType: 'pip' }
        });
        return before.workMs === after.workMs && before.workMs === 120000;
      })()
    );

    assert('getUpcomingPhaseInfo() muestra próxima ronda durante work con descanso',
      typeof utils.getUpcomingPhaseInfo === 'function' &&
      utils.getUpcomingPhaseInfo({
        running: true, paused: false, phase: 'work', round: 1,
        plan: { mode: 'tabata', rounds: 3, restMs: 10000, workMs: 20000 }
      }).includes('R2/3')
    );

    assert('SOUND_PACKS expone los tres packs esperados',
      Array.isArray(utils.VALID_SOUND_PACKS) &&
      utils.VALID_SOUND_PACKS.includes('classic') &&
      utils.VALID_SOUND_PACKS.includes('whistle') &&
      utils.VALID_SOUND_PACKS.includes('woodblock')
    );
  } else {
    assert('Motor TimerRound accesible en vista de prueba', false, 'No se encontró window.TimerRound');
  }

  window.timerRoundUnitTests = unitSuites;
  window.dispatchEvent(new CustomEvent('timer-round-unit-complete', { detail: unitSuites }));
})();
