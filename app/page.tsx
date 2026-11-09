'use client';

export default function Page() {
  return (
    <div id="app">
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