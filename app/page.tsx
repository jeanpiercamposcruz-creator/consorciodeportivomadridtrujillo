'use client';

import { useEffect } from 'react';
import Image from 'next/image';

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
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
          <Image
            className="dark:invert h-5 w-[100px]"
            src="/next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
            <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
              Consorcio Deportivo Madrid Trujillo
            </h1>
            <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Sistema ERP sincronizado con Supabase y listo para producción.
            </p>
          </div>
        </main>
      </div>

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