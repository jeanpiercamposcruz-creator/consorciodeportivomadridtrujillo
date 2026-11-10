"use client";

import { useEffect } from "react";

/**
 * Carga, en este orden y UNA sola vez:
 *   1. qrcode-generator  -> genera el QR de padres y el carnet de cada alumno
 *   2. jsQR              -> lee el QR con la cámara (asistencia)
 *   3. /script.js        -> la aplicación (arranca sola con boot())
 *
 * Por qué así:
 *  - script.js necesita las librerías ya cargadas cuando arranca (la página pública del
 *    carnet dibuja el QR en el primer render), por eso la carga es secuencial (async = false).
 *  - La marca window.__erpLoader evita cargarlo dos veces (StrictMode de `next dev`,
 *    Fast Refresh o remontajes). Una segunda ejecución de script.js reiniciaría sus
 *    variables globales y duplicaría los listeners y temporizadores.
 *  - No se elimina el <script> al desmontar: script.js ya se ejecutó y sigue vivo.
 */
const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js",
];
const APP = "/script.js";

declare global {
  interface Window {
    __erpLoader?: Promise<void>;
  }
}

function loadScript(src: string, ms = 12000): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    const t = setTimeout(() => {
      s.remove();
      reject(new Error("Tiempo agotado cargando " + src));
    }, ms);
    s.src = src;
    s.async = false;
    s.onload = () => {
      clearTimeout(t);
      resolve();
    };
    s.onerror = () => {
      clearTimeout(t);
      reject(new Error("No se pudo cargar " + src));
    };
    document.body.appendChild(s);
  });
}

export default function ErpLoader() {
  useEffect(() => {
    if (window.__erpLoader) return;
    window.__erpLoader = (async () => {
      for (const src of LIBS) {
        // Si la CDN falla, el sistema sigue funcionando (sin QR) en vez de quedarse en blanco.
        await loadScript(src).catch((e) => console.warn(e));
      }
      await loadScript(APP);
    })().catch((e) => {
      console.error(e);
      const app = document.getElementById("app");
      if (app) app.textContent = "No se pudo cargar el sistema. Recarga la página.";
    });
  }, []);

  return null;
}
