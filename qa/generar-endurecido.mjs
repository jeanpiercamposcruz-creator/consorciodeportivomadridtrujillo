#!/usr/bin/env node
/**
 * Genera una COPIA endurecida (no toca tus archivos) en ./.qa-hardened/ aplicando
 * las correcciones recomendadas, y escribe qa/hardened.diff para que revises cada cambio.
 *   node qa/generar-endurecido.mjs
 *   node qa/fuzz-harness.mjs .qa-hardened/public/script.js     # comparar antes/después
 * Cada reemplazo exige exactamente 1 coincidencia: si tu código cambió, falla en voz alta.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".qa-hardened");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
let fallos = 0;
function rep(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error(`✖ ${label}: se esperaba 1 coincidencia y hay ${n}`); fallos++; return src; }
  console.log(`✔ ${label}`);
  return src.replace(from, () => to);
}

/* ------------------------------ public/script.js ------------------------------ */
let js = read("public/script.js");

js = rep(js, String.raw`const today = () => new Date().toISOString().slice(0, 10),`,
String.raw`/* Fecha LOCAL (Perú UTC-5). toISOString() es UTC y después de las 19:00 devolvía el día siguiente. */
const today = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },`, "P3-b today() en hora local");

js = rep(js, String.raw`const monto = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 99999 ? Math.round(n * 100) / 100 : null;
};`,
String.raw`/* Monto estricto: solo dígitos con hasta 2 decimales (rechaza 0x10, 1e3, "abc", negativos). */
const monto = (v) => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n <= 99999 ? Math.round(n * 100) / 100 : null;
};
/* Fecha real (rechaza 2015-02-31, 2015-13-45, 0000-00-00). */
const fechaOk = (s) => {
  if (!RX.fecha.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number),
    t = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};`, "P3-a monto() estricto + fechaOk()");

js = rep(js, String.raw`      dni: limpiar(f.dni, 8),
      ac: limpiar(f.ac, 9),`, String.raw`      dni: limpiar(f.dni, 40), // sin truncar: el regex decide (antes "123456789012" pasaba como "12345678")
      ac: limpiar(f.ac, 40),`, "P3-a no truncar DNI/celular antes de validar");
js = rep(js, String.raw`      nac: limpiar(f.nac, 10),`, String.raw`      nac: limpiar(f.nac, 40),`, "P3-a no truncar fecha");
js = rep(js, String.raw`  if (!RX.fecha.test(d.nac)) e.push("Fecha de nacimiento inválida");`, String.raw`  if (!fechaOk(d.nac)) e.push("Fecha de nacimiento inválida");`, "P3-a validar fecha real");

js = rep(js, String.raw`const age = (d) => {
  const [y, m, x] = d.split("-").map(Number),`, String.raw`const age = (d) => {
  if (!RX.fecha.test(String(d || ""))) return "—"; // antes age("") devolvía 2026
  const [y, m, x] = d.split("-").map(Number),`, "P3-c age() con fecha vacía");

/* sb(): timeout + refresh de sesión de un solo vuelo */
js = rep(js, String.raw`async function sb(path, o = {}, retry = 1) {
  const r = await fetch(SB + path, {
    ...o,
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + (TK || KEY),
      "Content-Type": "application/json",
      ...(o.headers || {}),
    },
  });
  if (r.status === 401 && RT && retry) {
    await auth({ refresh_token: RT }, "refresh_token");
    return sb(path, o, 0);
  }
  return r;
}`, String.raw`let REFRESHING = null;
async function sb(path, o = {}, retry = 1) {
  const ctl = new AbortController(),
    to = setTimeout(() => ctl.abort(), o.timeout || 20000); // sin esto una petición colgada bloquea toda la cola
  let r;
  try {
    r = await fetch(SB + path, {
      ...o,
      signal: ctl.signal,
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + (TK || KEY),
        "Content-Type": "application/json",
        ...(o.headers || {}),
      },
    });
  } finally {
    clearTimeout(to);
  }
  if (r.status === 401 && RT && retry) {
    // Un único refresh aunque 401 lleguen en paralelo (el refresh token rota: reusarlo invalida la sesión)
    REFRESHING = REFRESHING || auth({ refresh_token: RT }, "refresh_token").finally(() => (REFRESHING = null));
    await REFRESHING;
    return sb(path, o, 0);
  }
  return r;
}`, "P2-a/P2-f sb() con timeout y refresh único");
js = rep(js, String.raw`      headers: { "Content-Type": f.type },
      body: f,`, String.raw`      headers: { "Content-Type": f.type },
      timeout: 90000,
      body: f,`, "P2-a timeout largo para subir archivos");

/* pull(): reemplazo atómico */
js = rep(js, String.raw`  S = {
    sedes: [],
    deportes: [],
    personal: [],
    hor: [],
    alu: [],
    asis: [],
    kits: [],
    caja: [],
    c: {},
  };
  for (const t of TB) t.load(t.n === "ajustes" ? aj : await all(t.n));
  SN = {};`, String.raw`  // 1) descargar TODO primero (si algo falla aquí, S y SN siguen intactos)
  const raw = {};
  for (const t of TB) raw[t.n] = t.n === "ajustes" ? aj : await all(t.n);
  // 2) reemplazar el estado de golpe, sin ningún await en medio
  S = {
    sedes: [],
    deportes: [],
    personal: [],
    hor: [],
    alu: [],
    asis: [],
    kits: [],
    caja: [],
    c: {},
  };
  for (const t of TB) t.load(raw[t.n]);
  SN = {};`, "P1 pull() atómico");

/* save(): cola a prueba de excepciones + SAVE_OK */
js = rep(js, String.raw`function save() {
  busy++;
  sv = sv.then(async () => {
    try {
      await flush();
      await ver();
    } catch (e) {
      console.error(e);
      if (e === "dup") {
        toast(
          "Otro equipo creó el mismo código a la vez. Se recargaron los datos: repite tu registro.",
        );
        try {
          await pull();
        } catch (_) {}
        R();
      } else toast("No se pudo guardar: revisa la conexión o tus permisos");
    }
    busy--;
  });
}`, String.raw`let SAVE_OK = true; // resultado del último guardado (lo consultan recibos y borrado de pre-registros)
function save() {
  busy++;
  sv = sv
    .then(async () => {
      try {
        await flush();
        SAVE_OK = true;
        await ver();
      } catch (e) {
        SAVE_OK = false;
        console.error(e);
        if (e === "dup") {
          toast(
            "Otro equipo creó el mismo código a la vez. Se recargaron los datos: repite tu registro.",
          );
          try {
            await pull();
          } catch (_) {}
          try {
            R();
          } catch (x) {
            console.error(x);
          }
        } else toast("No se pudo guardar: revisa la conexión o tus permisos");
      } finally {
        busy--; // siempre, pase lo que pase
      }
    })
    .catch((e) => console.error("cola de guardado", e)); // la cadena nunca queda rechazada
}`, "P2-c save() a prueba de excepciones");

/* R(): estado de edición huérfano */
js = rep(js, String.raw`  const m = M.find((x) => x[0] === V);
  if (m && !m[3].includes(U.rol)) V = "home";`, String.raw`  if (V === "mat" && ED && !S.alu.some((x) => x.id === ED)) {
    ED = null; // el alumno ya no existe (otro admin lo borró o un pull lo reemplazó)
    FRESH = null;
  }
  const m = M.find((x) => x[0] === V);
  if (m && !m[3].includes(U.rol)) V = "home";`, "P2-c R() con ED huérfano");
js = rep(js, String.raw`    FOTO = ED ? S.alu.find((x) => x.id === ED).foto : "";`, String.raw`    FOTO = ED ? (S.alu.find((x) => x.id === ED) || {}).foto || "" : "";`, "P2-c R() foto segura");

/* payRun(): recibo solo si el guardado fue confirmado */
js = rep(js, String.raw`  const done = (ctl) =>
    ctl.finish().then(() => {
      end();
      flush();
      try {
        recibo(tk());
      } catch (e) {
        console.error(e);
      }
      PAYB = 0;
    });`, String.raw`  const done = (ctl) =>
    sv
      .then(() => {
        if (!SAVE_OK) throw new Error("no guardado"); // no hay "¡PAGADO!" ni recibo sin confirmación de la BD
        return ctl.finish();
      })
      .then(() => {
        end();
        flush();
        try {
          recibo(tk());
        } catch (e) {
          console.error(e);
        }
        PAYB = 0;
      })
      .catch(() => {
        ctl.cancel();
        end();
        flush();
        PAYB = 0;
      });`, "P2-b recibo solo tras guardado confirmado");

/* saveAlu(): no borrar el pre-registro si el alumno no se guardó */
js = rep(js, String.raw`    sb("/rest/v1/preregistros?id=eq." + encodeURIComponent(pid), { method: "DELETE" }).then(() => {
      if (PR) PR = PR.filter((x) => x.id !== pid);
      PRN = PR ? PR.length : PRN;
    });`, String.raw`    sv.then(() => {
      if (!SAVE_OK) return; // el alumno no llegó a la BD: el pre-registro (datos + archivos) se conserva
      return sb("/rest/v1/preregistros?id=eq." + encodeURIComponent(pid), { method: "DELETE" }).then(() => {
        if (PR) PR = PR.filter((x) => x.id !== pid);
        PRN = PR ? PR.length : PRN;
      });
    }).catch(() => {});`, "P4-a borrar pre-registro solo tras guardar");

js = rep(js, String.raw`    Object.assign(
      S.sedes.find((s) => s.id === ES),
      d,
    );
    ES = null;
    toast("Sede actualizada");`, String.raw`    const tgt = S.sedes.find((s) => s.id === ES);
    if (!tgt) {
      ES = null;
      return toast("La sede ya no existe (otro usuario la eliminó). Recarga e inténtalo de nuevo.");
    }
    Object.assign(tgt, d);
    ES = null;
    toast("Sede actualizada");`, "P4-c addSede() con sede inexistente");

js = rep(js, String.raw`  const e = $("#cs"),
    a = S.alu.find((x) => x.qt === m[1]);`, String.raw`  const e = $("#cs") || { textContent: "", classList: { add() {} } }, // el modal pudo cerrarse
    a = S.alu.find((x) => x.qt === m[1]);`, "P4-d qrLeido() sin modal");

js = rep(js, String.raw`const out = () => {
  U = null;`, String.raw`const out = () => {
  if (TK) sb("/auth/v1/logout?scope=local", { method: "POST" }).catch(() => {}); // revoca la sesión en el servidor
  if (typeof R_REAL === "function") R = R_REAL; // payRun() pudo dejar R() anulada
  PAYB = 0;
  U = null;`, "P5-e/P4-e out() revoca sesión y restaura R()");
js = rep(js, String.raw`initBackgroundVideo();
boot();`, String.raw`const R_REAL = R;
initBackgroundVideo();
boot();`, "P4-e guardar referencia a R()");

js = rep(js, String.raw`  if (b && FN[b.dataset.f]) FN[b.dataset.f](b.dataset.i, b.dataset.j, b.dataset.k, b);`,
String.raw`  if (b && Object.hasOwn(FN, b.dataset.f)) FN[b.dataset.f](b.dataset.i, b.dataset.j, b.dataset.k, b);`, "P5-f FN sin herencia de prototipo");
js = rep(js, String.raw`    const fn = el && registry[el.getAttribute(attr)];`, String.raw`    const k = el && el.getAttribute(attr),
      fn = el && Object.hasOwn(registry, k) ? registry[k] : null;`, "P5-f registry sin herencia de prototipo");

js = rep(js, String.raw`  const now = performance.now();
  if (now - CAMLAST < 110`, String.raw`  const now = performance.now();
  if (!window.jsQR) {
    const z = $("#cs");
    if (z) z.textContent = "Lector QR no disponible: recarga la página o revisa tu conexión";
  }
  if (now - CAMLAST < 110`, "P5-c aviso si jsQR no cargó");

{ // P5-g código muerto
  const re = /function load\(\) \{[\s\S]*?\n\}\nfunction mig\(\) \{[\s\S]*?\n\}\n(?=const nid)/;
  if (re.test(js)) { js = js.replace(re, ""); console.log("✔ P5-g eliminar load()/mig() (código muerto)"); }
  else { console.error("✖ P5-g no se encontró load()/mig()"); fallos++; }
}

/* ------------------------------ ErpLoader.tsx ------------------------------ */
let ld = read("app/components/ErpLoader.tsx");
ld = rep(ld, String.raw`const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js",
];`, String.raw`// Autoalojadas (public/vendor/): sin terceros en tiempo de ejecución, sin necesidad de SRI.
//   npm i qrcode-generator jsqr   y copiar qrcode.js / jsQR.js desde node_modules a public/vendor/
const LIBS = ["/vendor/qrcode.min.js", "/vendor/jsQR.min.js"];`, "P5-a librerías autoalojadas");
ld = rep(ld, String.raw`function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar " + src));
    document.body.appendChild(s);
  });
}`, String.raw`function loadScript(src: string, ms = 12000): Promise<void> {
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
}`, "P5-b timeout al cargar scripts");

/* ------------------------------ next.config.ts ------------------------------ */
let nx = read("next.config.ts");
nx = rep(nx, String.raw`"script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",`, String.raw`"script-src 'self' 'unsafe-inline'", // cdnjs ya no hace falta (librerías autoalojadas)`, "CSP sin cdnjs");

if (fallos) { console.error(`\n${fallos} reemplazo(s) fallaron: revisa que los archivos coincidan con la versión analizada.`); process.exit(1); }

/* ------------------------------ escribir + diff ------------------------------ */
for (const [rel, txt] of [["public/script.js", js], ["app/components/ErpLoader.tsx", ld], ["next.config.ts", nx]]) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, txt);
}
let diff = "";
for (const [rel, orig] of [["public/script.js", read("public/script.js")], ["app/components/ErpLoader.tsx", read("app/components/ErpLoader.tsx")], ["next.config.ts", read("next.config.ts")]]) {
  const a = path.join(OUT, "_orig_" + path.basename(rel));
  fs.writeFileSync(a, orig);
  const b = path.join(OUT, rel);
  // git viene con tu repo (también en Windows); "diff" como alternativa
  let r = spawnSync("git", ["diff", "--no-index", "--no-color", "--", a, b], { encoding: "utf8" });
  if (r.error) r = spawnSync("diff", ["-u", a, b], { encoding: "utf8" });
  if (r.error) console.warn("⚠ no hay git ni diff en el PATH: se omite hardened.diff");
  diff += r.stdout || "";
  fs.unlinkSync(a);
}
fs.writeFileSync(path.join(ROOT, "qa", "hardened.diff"), diff);
console.log(`\nListo → ${path.relative(ROOT, OUT)}/ y qa/hardened.diff (${diff.split("\n").length} líneas)`);
