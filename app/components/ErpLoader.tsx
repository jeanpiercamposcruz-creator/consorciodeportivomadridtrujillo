"use client";

import { useEffect } from "react";

/**
 * Carga, en este orden y UNA sola vez:
 *   1. qrcode-generator  -> genera el QR de padres y el carnet de cada alumno
 *   2. jsQR              -> lee el QR con la cámara (asistencia)
 *   3. /app/*.js         -> la aplicación, partida en módulos (arranca sola con boot(), el último)
 *
 * Por qué así:
 *  - La aplicación necesita las librerías ya cargadas cuando arranca (la página pública del
 *    carnet dibuja el QR en el primer render), por eso la carga es secuencial (async = false).
 *  - La marca window.__erpLoader evita cargarlo dos veces (StrictMode de `next dev`,
 *    Fast Refresh o remontajes). Una segunda ejecución de la aplicación reiniciaría sus
 *    variables globales y duplicaría los listeners y temporizadores.
 *  - No se elimina el <script> al desmontar: la aplicación ya se ejecutó y sigue viva.
 *  - Los módulos de /app/ son UN solo programa partido en archivos que comparten el ámbito
 *    global (const/let no se pueden usar antes de declararse), por eso el ORDEN de APP importa.
 *    Se verifica que todos existan ANTES de ejecutar el primero: así nunca arranca a medias.
 *    `npm run verificar:modulos` comprueba que esta lista coincide con la carpeta public/app/.
 */
const LIBS = ["/vendor/qrcode.min.js", "/vendor/jsQR.min.js"];
const APP = [
  "/app/01-config.js",
  "/app/02-estado.js",
  "/app/03-datos-supabase.js",
  "/app/04-adjuntos.js",
  "/app/05-preregistro-kits.js",
  "/app/06-camara-qr.js",
  "/app/07-publico.js",
  "/app/08-sesion-navegacion.js",
  "/app/09-ui-helpers.js",
  "/app/10-login-dashboard.js",
  "/app/11-vistas-base.js",
  "/app/12-vistas-sedes.js",
  "/app/13-vistas-personal.js",
  "/app/14-vistas-horarios.js",
  "/app/15-acciones.js",
  "/app/16-animaciones.js",
  "/app/17-listeners.js",
  "/app/18-arranque.js",
];

declare global {
  interface Window {
    __erpLoader?: Promise<void>;
    __ERP_CONFIG__?: {
      supabaseUrl: string;
      supabaseKey: string;
    };
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

/** Falla si algún módulo no está disponible, sin haber ejecutado ninguno. */
async function verificarModulos(srcs: string[]): Promise<void> {
  const respuestas = await Promise.all(srcs.map((s) => fetch(s, { method: "HEAD" })));
  const mala = respuestas.find((r) => !r.ok);
  if (mala) throw new Error("Módulo no disponible: " + mala.url);
}

/**
 * Carga los módulos de la aplicación como si fueran un solo script:
 *  - Todos menos el último se insertan a la vez (descarga en paralelo) y, con async = false,
 *    el navegador los EJECUTA en el orden de la lista.
 *  - Si alguno lanza un error al ejecutarse, NO se ejecuta el último (el que llama a boot()).
 *    Con un solo archivo pasaba lo mismo: una excepción detenía el resto y la app no arrancaba
 *    a medias.
 */
async function cargarAplicacion(srcs: string[]): Promise<void> {
  const arranque = srcs[srcs.length - 1];
  const fallos: string[] = [];
  const alError = (e: ErrorEvent) => {
    if (e.filename && e.filename.includes("/app/")) fallos.push(e.filename + " -> " + e.message);
  };
  window.addEventListener("error", alError);
  try {
    await Promise.all(srcs.slice(0, -1).map((src) => loadScript(src)));
    if (fallos.length) throw new Error("Error al ejecutar la aplicación: " + fallos.join(" | "));
    await loadScript(arranque);
  } finally {
    window.removeEventListener("error", alError);
  }
}

export default function ErpLoader() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (window.__erpLoader) return;

    // Diagnóstico QA: solo registra presencia/ausencia; nunca imprime credenciales.
    console.info("[ERP QA] Diagnóstico de configuración:", {
      urlConfigurada: Boolean(supabaseUrl),
      claveConfigurada: Boolean(supabaseKey),
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error("Faltan las variables de entorno de Supabase.");
      const app = document.getElementById("app");
      if (app) app.textContent = "Error de configuración. Contacta al administrador.";
      return;
    }

    window.__ERP_CONFIG__ = {
      supabaseUrl,
      supabaseKey,
    };
    window.__erpLoader = (async () => {
      for (const src of LIBS) {
        // Si la CDN falla, el sistema sigue funcionando (sin QR) en vez de quedarse en blanco.
        await loadScript(src).catch((e) => console.warn(e));
      }
      await verificarModulos(APP);
      await cargarAplicacion(APP);
    })().catch((e) => {
      console.error(e);
      const app = document.getElementById("app");
      if (app) app.textContent = "No se pudo cargar el sistema. Recarga la página.";
    });
      }, [supabaseUrl, supabaseKey]);

  return null;
}
