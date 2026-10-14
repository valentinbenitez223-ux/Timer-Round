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
      settings: { random: { minutes: '', alerts: 500 } },
      preferences: { volume: null },
      history: [
        { id: 'dup-1', completedAt: '2026-10-10T10:00:00Z', mode: 'tabata', durationMs: 120000, rounds: 8 },
        { id: 'dup-1', completedAt: '2026-10-10T10:00:00Z', mode: 'tabata', durationMs: 120000, rounds: 8 },
        { id: 'bad-date', completedAt: 'fecha-invalida', mode: 'focus', durationMs: 5000 }
      ]
    });

    assert('sanitizeStoredData() corrige activeMode inválido', sanitized.activeMode === 'random');
    assert('sanitizeStoredData() preserva volumen por defecto ante null', sanitized.preferences.volume === 70);
    assert('sanitizeStoredData() deduplica historial y filtra fechas inválidas', sanitized.history.length === 1 && sanitized.history[0].id === 'dup-1');

    const tabataPlan = utils.getPlan('tabata', {
      random: { minutes: 1, alerts: 5 },
      tabata: { work: 20, rest: 10, rounds: 8 },
      focus: { minutes: 5, seconds: 0 }
    });
    assert('getPlan("tabata") calcula duración exacta (8×20s + 7×10s = 230s)', tabataPlan.durationMs === 230000);

    const schedule = utils.createRandomSchedule(60000, 15);
    const isSortedAndSpaced = schedule.every((val, i) => i === 0 || val >= schedule[i - 1] + 200);
    assert('createRandomSchedule() genera señales ordenadas y con separación mínima', schedule.length === 15 && isSortedAndSpaced);

    assert('formatTime() formatea correctamente mm:ss', utils.formatTime(65000) === '01:05' && utils.formatTime(0) === '00:00');
  } else {
    assert('Motor TimerRound accesible en vista de prueba', false, 'No se encontró window.TimerRound');
  }

  window.timerRoundUnitTests = unitSuites;
  window.dispatchEvent(new CustomEvent('timer-round-unit-complete', { detail: unitSuites }));
})();
