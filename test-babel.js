/*
 * Legacy filename kept for existing bookmarks and local test runners.
 * Timer Round no longer ships Babel; this is a browser smoke test instead.
 */
(async () => {
  const assets = ['index.html', 'app.js', 'styles.css', 'manifest.json', 'sw.js', 'icon.svg'];
  const results = await Promise.all(assets.map(async asset => {
    try {
      const response = await fetch(asset, { cache: 'no-store' });
      return { asset, ok: response.ok, status: response.status };
    } catch (error) {
      return { asset, ok: false, status: error.message };
    }
  }));

  window.timerRoundSmoke = results;
  console.table(results);
  window.dispatchEvent(new CustomEvent('timer-round-smoke-complete', { detail: results }));
})();
