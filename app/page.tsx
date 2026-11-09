'use client';

import { useEffect } from 'react';

export default function Page() {
  useEffect(() => {
    // Evitar duplicar el script si ya está cargado
    if (document.getElementById('erp-script')) return;

    const script = document.createElement('script');
    script.id = 'erp-script';
    script.src = '/script.js';
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      const scriptEl = document.getElementById('erp-script');
      if (scriptEl) scriptEl.remove();
    };
  }, []);

  return (
    <>
      <div id="app">
        <main className="login">
          <section className="card u-text-center">
            <p className="mu">Cargando sistema...</p>
          </section>
        </main>
      </div>
      <div id="mod" className="modal"></div>
      <div id="toast" className="toast"></div>
    </>
  );
}