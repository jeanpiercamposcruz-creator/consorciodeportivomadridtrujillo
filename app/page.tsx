'use client';

import { useEffect } from 'react';

export default function Page() {
  return (
    <div id="app">
      {/* Tu SPA de script.js inyectará la interfaz aquí */}
      <main className="login">
        <section className="card u-text-center">
          <p className="mu">Cargando sistema...</p>
        </section>
      </main>
      <div id="mod" className="modal"></div>
      <div id="toast" className="toast"></div>
    </div>
  );
}