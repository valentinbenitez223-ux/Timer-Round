import { useEffect } from 'react';
import './styles.css';

/**
 * React adapter for Timer Round.
 *
 * The timer engine intentionally lives in app.js so the same implementation
 * powers the zero-build PWA (index.html) and any React host. Keeping a single
 * implementation prevents the deployed timer and this component from drifting.
 */
export default function App() {
  useEffect(() => {
    import('./app.js');
  }, []);

  return (
    <main id="app" aria-busy="true">
      <p className="boot-message">Cargando Timer Round…</p>
    </main>
  );
}
