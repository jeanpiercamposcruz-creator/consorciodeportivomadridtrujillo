'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Carga tu script.js original para que todo el ERP cobre vida
    const script = document.createElement('script');
    script.src = '/script.js';
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <>
      {/* Fondo de video decorativo original */}
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
        ></video>
        <div className="video-overlay"></div>
      </div>

      {/* Raíz de tu SPA original */}
      <div id="app"></div>

      {/* Modal accesible */}
      <div id="mod" role="dialog" aria-modal="true" aria-label="Ventana de diálogo"></div>

      {/* Avisos breves */}
      <div id="toast" role="status" aria-live="polite"></div>
    </>
  );
}