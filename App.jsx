import { useEffect, useRef } from 'react';
import './styles.css';

/**
 * React adapter for Timer Round.
 *
 * Uses the idempotent window.TimerRound.mount() API exposed by app.js so
 * React 18+ StrictMode remounts and route transitions always bind cleanly
 * to the active DOM node.
 */
export default function App() {
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    import('./app.js').then(() => {
      if (active && window.TimerRound && containerRef.current) {
        window.TimerRound.mount(containerRef.current);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main id="app" ref={containerRef} aria-busy="true">
      <p className="boot-message">Cargando Timer Round…</p>
    </main>
  );
}
