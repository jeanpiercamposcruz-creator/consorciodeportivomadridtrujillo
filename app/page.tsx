import ErpLoader from "./components/ErpLoader";

/**
 * Página única del ERP.
 *
 * Es un Server Component A PROPÓSITO (sin 'use client', sin estado, sin efectos):
 * React nunca vuelve a renderizarla en el navegador, así que no puede recrear ni
 * vaciar #app, #mod o #toast, que son los nodos que public/script.js maneja a mano.
 * Este HTML es el mismo body del index.html original (ERP.zip).
 */
export default function Page() {
  return (
    <>
      {/* Fondo de video decorativo (public/script.js lo reproduce en initBackgroundVideo) */}
      <div className="video-bg-container" aria-hidden="true">
        <video
          id="bgv"
          src="/assets/field.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
        />
        <div className="video-overlay" />
      </div>

      {/* Raíz de la SPA: script.js renderiza aquí <header>, <aside>/<nav> y <main> */}
      <div id="app" suppressHydrationWarning />

      {/* Modal accesible (recibos, carnet, cámara, archivos adjuntos) */}
      <div id="mod" role="dialog" aria-modal="true" aria-label="Ventana de diálogo" suppressHydrationWarning />

      {/* Avisos breves */}
      <div id="toast" role="status" aria-live="polite" suppressHydrationWarning />

      <noscript>Esta aplicación necesita JavaScript habilitado para funcionar.</noscript>

      {/* Carga qrcode + jsQR y después /script.js, una sola vez y en orden */}
      <ErpLoader />
    </>
  );
}
