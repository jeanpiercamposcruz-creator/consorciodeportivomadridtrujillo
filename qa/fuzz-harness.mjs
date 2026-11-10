#!/usr/bin/env node
/**
 * Banco de pruebas negativas / fuzzing defensivo para el ERP CDMT (public/script.js)
 * ---------------------------------------------------------------------------------
 * - Sin dependencias: solo Node >= 20.
 * - Carga el script.js REAL dentro de un sandbox (vm) con un DOM mínimo simulado
 *   y un Supabase falso en memoria (PostgREST + Auth + Storage) con inyección de fallos.
 * - Cada caso afirma el comportamiento CORRECTO. "FALLA" = el defecto está presente.
 *   Cuando corrijas el código, el caso pasa a "PASA" (sirve como suite de regresión).
 *
 * Uso:
 *   node qa/fuzz-harness.mjs                    # usa ./public/script.js
 *   node qa/fuzz-harness.mjs ruta/script.js     # otro archivo (p. ej. uno parcheado)
 *   node qa/fuzz-harness.mjs --json salida.json # además guarda el reporte en JSON
 * Código de salida: 0 = todo pasa, 1 = hay defectos.
 */
process.env.TZ = "America/Lima"; // today() debe evaluarse con la hora local de Trujillo
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { webcrypto } from "node:crypto";

const args = process.argv.slice(2);
const jsonIdx = args.indexOf("--json");
const JSON_OUT = jsonIdx >= 0 ? args.splice(jsonIdx, 2)[1] : null;
const SCRIPT = path.resolve(args[0] || "./public/script.js");
const ROOT = path.resolve(path.dirname(SCRIPT), "..");
const SRC = fs.readFileSync(SCRIPT, "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const unhandled = [];
process.on("unhandledRejection", (e) => unhandled.push(String((e && e.message) || e)));

/* ----------------------------- utilidades ------------------------------ */
function prng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const stable = (o) =>
  JSON.stringify(o, (k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
const resp = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/* ------------------- Supabase falso (PostgREST/Auth/Storage) ------------------- */
class MockSupabase {
  constructor(rows) {
    this.db = JSON.parse(JSON.stringify(rows));
    this.db.erp_meta = [{ id: 1, ver: 1 }];
    this.db.preregistros = [{ id: "pre1", nombres: "Ana" }];
    this.calls = [];
    this.hooks = []; // fn(req) => undefined | respuesta | throw | promesa que no resuelve
    this.expired = new Set(["T_OLD"]);
    this.refreshValid = new Set(["R1"]);
    this.refreshCalls = 0;
    this.n = 1;
  }
  bump() {
    this.db.erp_meta[0].ver++;
  }
  async fetch(url, opts = {}) {
    const u = new URL(url);
    const method = (opts.method || "GET").toUpperCase();
    const h = opts.headers || {};
    const rec = {
      url,
      method,
      path: u.pathname,
      search: u.search,
      hasSignal: !!opts.signal,
      body: opts.body,
      bearer: String(h.Authorization || "").replace("Bearer ", ""),
      prefer: h.Prefer || "",
    };
    this.calls.push(rec);
    const work = (async () => {
      for (const hook of this.hooks) {
        const r = await hook(rec, this);
        if (r !== undefined) return r;
      }
      return this.route(rec, u);
    })();
    if (!opts.signal) return work;
    return Promise.race([work, new Promise((_, rej) => {
      const ab = () => rej(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
      opts.signal.aborted ? ab() : opts.signal.addEventListener("abort", ab);
    })]);
  }
  route(rec, u) {
    if (u.pathname === "/auth/v1/token") {
      const body = JSON.parse(rec.body || "{}");
      if (u.searchParams.get("grant_type") === "refresh_token") {
        this.refreshCalls++;
        if (!this.refreshValid.has(body.refresh_token))
          return resp(400, { error_code: "refresh_token_already_used", msg: "Invalid Refresh Token: Already Used" });
        this.refreshValid.delete(body.refresh_token); // rotación estricta
        this.n++;
        this.refreshValid.add("R" + this.n);
        return resp(200, { access_token: "T" + this.n, refresh_token: "R" + this.n, user: { id: "u1", email: "qa@test" } });
      }
      return resp(200, { access_token: "T1", refresh_token: "R1", user: { id: "u1", email: "qa@test" } });
    }
    if (this.expired.has(rec.bearer)) return resp(401, { message: "JWT expired" });
    if (u.pathname === "/rest/v1/perfiles") return resp(200, [{ rol: "ADM" }]);
    if (u.pathname.startsWith("/rest/v1/rpc/")) return resp(200, []);
    const m = /^\/rest\/v1\/([a-z_]+)$/.exec(u.pathname);
    if (!m) return resp(200, {});
    const t = m[1];
    const tbl = this.db[t];
    if (!tbl) return resp(404, { message: "no existe " + t });
    const idEq = /[?&]id=eq\.([^&]*)/.exec(u.search);
    const idIn = /[?&]id=in\.\((.*)\)(?:&|$)/.exec(u.search);
    if (rec.method === "GET") {
      let rows = tbl;
      if (idEq) rows = tbl.filter((r) => String(r.id) === decodeURIComponent(idEq[1]));
      const off = +u.searchParams.get("offset") || 0,
        lim = +u.searchParams.get("limit") || 1000;
      return resp(200, rows.slice(off, off + lim));
    }
    if (rec.method === "POST") {
      const rows = JSON.parse(rec.body);
      const merge = rec.prefer.includes("merge-duplicates");
      if (!merge && rows.some((r) => tbl.some((x) => x.id === r.id))) return resp(409, { code: "23505" });
      for (const r of rows) {
        const i = tbl.findIndex((x) => x.id === r.id);
        if (i >= 0) tbl[i] = r;
        else tbl.push(r);
      }
      this.bump();
      return resp(201, []);
    }
    if (rec.method === "DELETE") {
      let ids = [];
      if (idEq) ids = [decodeURIComponent(idEq[1])];
      else if (idIn)
        ids = idIn[1].split(",").map((tok) => decodeURIComponent(tok).replace(/^"|"$/g, "").replace(/\\(.)/g, "$1"));
      this.db[t] = tbl.filter((r) => !ids.includes(String(r.id)));
      this.bump();
      return resp(204, []);
    }
    return resp(405, {});
  }
}

/* ----------------------------- DOM mínimo ------------------------------ */
function el(id = "") {
  return {
    id, value: "", textContent: "", innerHTML: "", dataset: {}, children: [], isConnected: true, files: [],
    disabled: false, className: "", style: { setProperty() {} }, offsetWidth: 100, offsetHeight: 30, offsetTop: 0,
    offsetParent: null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelector: () => null, querySelectorAll: () => [], closest: () => null, appendChild() {}, remove() {},
    addEventListener() {}, setAttribute() {}, getAttribute: () => null, focus() {}, click() {}, play: () => Promise.resolve(),
  };
}

let SEED_ROWS = null;
function loadCtx(mock) {
  const nodes = { "#app": el("app"), "#mod": el("mod"), "#toast": el("toast"), "#bgv": el("bgv") };
  const fields = {};
  const store = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) });
  const intervals = [];
  const errs = [];
  const g = {
    document: {
      querySelector: (s) => nodes[s] ?? null, querySelectorAll: () => [], getElementById: (i) => fields[i] ?? null,
      createElement: () => el(), body: { appendChild() {} }, hidden: false, activeElement: null, addEventListener() {},
    },
    addEventListener() {}, setInterval: (fn, ms) => (intervals.push({ fn, ms }), intervals.length),
    setTimeout, clearTimeout, clearInterval() {}, requestAnimationFrame: (f) => setTimeout(() => f(performance.now()), 16),
    performance, crypto: webcrypto, TextEncoder, URL, Blob, File, AbortController, Image: class {},
    navigator: { vibrate() {}, clipboard: { writeText: async () => {} } },
    location: { hash: "", href: "http://localhost:3000/" },
    innerWidth: 1280, innerHeight: 800, matchMedia: () => ({ matches: false, addEventListener() {} }),
    sessionStorage: store(new Map()), localStorage: store(new Map()), confirm: () => true,
    fetch: (u, o) => mock.fetch(u, o),
    console: { log() {}, warn() {}, error: (...a) => errs.push(a.map(String).join(" ")) },
  };
  g.window = g;
  const ctx = vm.createContext(g);
  vm.runInContext(SRC, ctx, { filename: "script.js" });
  const run = (code) => vm.runInContext(code, ctx);
  return { ctx, run, nodes, fields, intervals, errs };
}

async function newEnv() {
  if (!SEED_ROWS) {
    const tmp = loadCtx(new MockSupabase({}));
    SEED_ROWS = JSON.parse(tmp.run("S = seed(); JSON.stringify(Object.fromEntries(TB.map(t => [t.n, t.rows()])))"));
  }
  const mock = new MockSupabase(SEED_ROWS);
  const e = loadCtx(mock);
  const env = {
    ...e, mock, sleep,
    count: (t) => mock.db[t].length,
    setFields(o) { for (const k in o) { e.fields[k] = el(k); e.fields[k].value = o[k]; } },
    async login() {
      e.run("TK='T1'; RT='R1'; UID='u1'; EM='qa@test'");
      await e.run("sess()");
      await e.run("pull()");
    },
    snapshot: () => JSON.parse(e.run("JSON.stringify(Object.fromEntries(TB.map(t => [t.n, t.rows()])))")),
  };
  await sleep(5);
  return env;
}

/* ------------------------------- casos ---------------------------------- */
const CASES = [];
const caso = (id, nivel, titulo, fn) => CASES.push({ id, nivel, titulo, fn });
const CAJA = '{f:"2026-11-09",sede:"SED-CSJ",t:"I",c:"QA",d:"",m:1}';

/* ===== P1. pull(): estado parcial + flush() = borrado masivo ===== */
caso("P1-a", "CRÍTICO", "pull() interrumpido por la red deja S a medias y el siguiente save() borra la BD", async (env) => {
  await env.login();
  const antes = { alu: env.count("alumnos"), asis: env.count("asistencias"), caja: env.count("caja_movimientos") };
  env.mock.hooks.push((r) => {
    if (r.method === "GET" && r.path.endsWith("/alumnos")) throw new TypeError("fetch failed (red caída)");
  });
  await env.run("pull()").catch(() => {}); // el poller de 20 s hace exactamente esto y lo ignora
  env.mock.hooks.length = 0;
  env.run(`S.caja.push(${CAJA}); save()`); // una acción cualquiera del usuario
  await env.run("sv");
  const despues = { alu: env.count("alumnos"), asis: env.count("asistencias"), caja: env.count("caja_movimientos") };
  return { pass: despues.alu === antes.alu && antes.alu > 0, detalle: `BD antes ${JSON.stringify(antes)} → después ${JSON.stringify(despues)}` };
});
caso("P1-b", "CRÍTICO", "save() durante un pull() lento (sin fallo de red) también borra datos", async (env) => {
  await env.login();
  const antes = env.count("alumnos");
  env.mock.hooks.push(async (r) => { if (r.method === "GET" && r.path.endsWith("/alumnos")) await sleep(150); });
  const p = env.run("pull()");
  await sleep(40);
  env.run(`S.caja.push(${CAJA}); save()`); // p. ej. escanear un QR de asistencia justo durante el poll
  await env.run("sv");
  await p.catch(() => {});
  return { pass: env.count("alumnos") === antes && antes > 0, detalle: `alumnos en BD: ${antes} → ${env.count("alumnos")}` };
});

/* ===== P2. flush()/save(): red, timeouts, cola y confirmaciones ===== */
caso("P2-a", "ALTO", "Ninguna petición a Supabase tiene timeout (AbortSignal); una petición colgada bloquea toda la cola de guardado", async (env) => {
  await env.login();
  const sinSignal = env.mock.calls.filter((c) => !c.hasSignal).length, totalPrev = env.mock.calls.length;
  env.mock.hooks.push((r) => (r.method === "POST" && r.path.endsWith("/caja_movimientos") ? new Promise(() => {}) : undefined));
  env.run(`S.caja.push(${CAJA}); save()`);
  await sleep(400);
  const busy = env.run("busy");
  env.mock.hooks.length = 0;
  env.run(`S.caja.push({...${CAJA}, m:2}); save()`);
  await sleep(300);
  const posts = env.mock.calls.filter((c) => c.method === "POST" && c.path.endsWith("/caja_movimientos")).length;
  return { pass: sinSignal === 0, detalle: `${sinSignal}/${totalPrev} peticiones sin signal; tras 700 ms colgado: busy=${busy}, POST enviados=${posts} (el 2.º guardado nunca sale; el poller queda deshabilitado)` };
});
caso("P2-b", "ALTO", "Se emite recibo y '¡PAGADO!' aunque la BD rechace el guardado (UI optimista sin confirmación)", async (env) => {
  await env.login();
  env.mock.hooks.push((r) => (r.method === "POST" && r.path.endsWith("/caja_movimientos") ? resp(500, { message: "db down" }) : undefined));
  env.setFields({ c_m: "50", c_t: "I", c_c: "Mensualidad", c_d: "" });
  env.ctx.__b = el("pay");
  env.run("globalThis.__rec = 0; recibo = () => { __rec++; }");
  const n0 = env.count("caja_movimientos");
  env.run('cajaPay("SED-CSJ", __b)');
  await env.run("sv");
  await sleep(2300);
  const rec = env.run("__rec"), toast = env.nodes["#toast"].textContent;
  return { pass: !(rec > 0 && env.count("caja_movimientos") === n0), detalle: `recibos emitidos=${rec}; filas nuevas en BD=${env.count("caja_movimientos") - n0}; toast="${toast}"` };
});
caso("P2-f", "MEDIO", "Varias peticiones con JWT vencido disparan varios refresh a la vez con el MISMO refresh token (rota: las demás fallan)", async (env) => {
  await env.login();
  env.run("TK = 'T_OLD'; RT = 'R1'");
  const r = JSON.parse(await env.run(`Promise.allSettled([sb("/rest/v1/erp_meta?id=eq.1&select=ver"), sb("/rest/v1/erp_meta?id=eq.1&select=ver"), sb("/rest/v1/erp_meta?id=eq.1&select=ver")]).then(x => JSON.stringify(x.map(y => y.status)))`));
  const ok = r.filter((x) => x === "fulfilled").length;
  return { pass: env.mock.refreshCalls === 1 && ok === 3, detalle: `llamadas a refresh=${env.mock.refreshCalls} (esperado 1); peticiones exitosas=${ok}/3` };
});
caso("P2-c", "ALTO", "Un error dentro del catch de save() (p. ej. R() lanza tras un 409) envenena la cola: todos los guardados posteriores se ignoran en silencio", async (env) => {
  await env.login();
  const ctrl = (() => { try { env.run('V="home"; R()'); return true; } catch { return false; } })();
  env.run('V="mat"; ED="NUEVO"; FRESH="NUEVO"');
  env.run(`S.alu.push({id:"NUEVO",nom:"Ana",ape:"X",dni:"",foto:"",hor:"",est:"Activo",mod:"Formativo",con:"Ninguna",sex:"F",nac:"2015-01-01",sede:"SED-CSJ",dep:S.deportes[0].id,cm:0,cmen:0,mes:1,pag:0,fecha:"2026-11-09",qt:"",dnf:"",dsg:"",dfm:""})`);
  let once = true;
  env.mock.hooks.push((r) => (r.method === "POST" && r.path.endsWith("/alumnos") && once ? ((once = false), resp(409, { code: "23505" })) : undefined));
  env.run("save()"); // otro admin creó el mismo código a la vez → 409 → pull() → R()
  await sleep(150);
  const busy = env.run("busy");
  const antes = env.count("caja_movimientos");
  env.run(`S.caja.push(${CAJA}); save()`);
  await sleep(200);
  const guardo = env.count("caja_movimientos") > antes;
  let rErr = "no lanza";
  try { env.run("R()"); } catch (e) { rErr = `${e.constructor.name}: ${e.message}`; }
  return { pass: guardo && busy === 0, inconcluso: !ctrl, detalle: `control R() en home sin error=${ctrl}; R() con ED inexistente → ${rErr}; tras el 409: busy=${busy}; guardado posterior persistió=${guardo}; promesas sin capturar=${unhandled.length}` };
});
caso("P2-d", "MEDIO", "Propiedad: con 25 % de fallos aleatorios en escrituras, el diff de flush() converge a un estado idéntico (sin pérdida ni duplicados)", async (env) => {
  await env.login();
  const rnd = prng(42);
  env.mock.hooks.push((r) => {
    if ((r.method === "POST" || r.method === "DELETE") && r.path.startsWith("/rest/v1/") && rnd() < 0.25)
      return rnd() < 0.5 ? (() => { throw new TypeError("network"); })() : resp(500, { message: "boom" });
  });
  for (let i = 0; i < 150; i++) {
    const op = Math.floor(rnd() * 4);
    if (op === 0) env.run(`S.caja.push({f:"2026-11-09",sede:"SED-CSJ",t:"${rnd() < 0.5 ? "I" : "E"}",c:"op${i}",d:"",m:${Math.floor(rnd() * 500)}})`);
    if (op === 1) env.run(`if (S.caja.length) S.caja.splice(${Math.floor(rnd() * 5)} % S.caja.length, 1)`);
    if (op === 2) env.run(`if (S.alu.length) { const a = S.alu[${Math.floor(rnd() * 9)} % S.alu.length]; a.pag = ${Math.floor(rnd() * 300)}; }`);
    if (op === 3) env.run(`S.asis.push({f:"2026-11-09",t:"A",ref:S.alu.length?S.alu[0].id:"x",h:"",ok:${rnd() < 0.5}})`);
    env.run("save()");
    if (i % 17 === 0) await env.run("sv");
  }
  env.mock.hooks.length = 0;
  env.run("save()");
  await env.run("sv");
  const local = env.snapshot();
  const difs = [];
  for (const t of Object.keys(local)) {
    const a = new Map(local[t].map((r) => [r.id, stable(r)])), b = new Map(env.mock.db[t].map((r) => [r.id, stable(r)]));
    const falt = [...a.keys()].filter((k) => !b.has(k)).length, sobr = [...b.keys()].filter((k) => !a.has(k)).length;
    const dist = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k)).length;
    if (falt || sobr || dist) difs.push(`${t}: faltan=${falt} sobran=${sobr} distintas=${dist}`);
  }
  return { pass: difs.length === 0, detalle: difs.length ? difs.join("; ") : "BD y estado local idénticos tras 150 operaciones con fallos" };
});
caso("P2-e", "BAJO", "Control positivo: ids hostiles (comillas, comas, paréntesis, barra) no rompen el DELETE ?id=in.(...)", async (env) => {
  const hostil = 'a"b,c)d\\e';
  env.mock.db.caja_movimientos.push(
    { id: hostil, fecha: "2026-11-09", sede_id: "SED-CSJ", tipo: "I", concepto: "x", detalle: null, monto: 1, origen: null },
    { id: "ok1", fecha: "2026-11-09", sede_id: "SED-CSJ", tipo: "I", concepto: "y", detalle: null, monto: 2, origen: null },
  );
  await env.login();
  env.ctx.__h = hostil;
  env.run("S.caja = S.caja.filter(x => x._id !== __h); save()");
  await env.run("sv");
  const ids = env.mock.db.caja_movimientos.map((r) => r.id);
  return { pass: !ids.includes(hostil) && ids.includes("ok1"), detalle: `ids restantes en caja: ${JSON.stringify(ids)}` };
});

/* ===== P3. Validación de entradas (alumnos / pagos) ===== */
const BASE = { nom: "Ana", ape: "Pérez", dni: "12345678", ac: "987654321", am: "a@b.co", an: "Mamá", seg: "", nac: "2015-05-05", sex: "F", mod: "Formativo", con: "Ninguna", est: "Activo", cm: 0, cmen: 0, pag: 0 };
caso("P3-a", "ALTO", "validarAlumno: valores inválidos que DEBERÍAN rechazarse (truncado silencioso antes de validar, fechas imposibles, notación hex/exponencial)", async (env) => {
  const malos = [
    ["DNI de 12 dígitos", { dni: "123456789012" }], ["DNI con basura al final", { dni: "12345678ABCD" }],
    ["celular de 10 dígitos", { ac: "9876543210" }], ["fecha 2015-13-45", { nac: "2015-13-45" }],
    ["fecha 2015-02-31", { nac: "2015-02-31" }], ["fecha con basura 2015-05-05junk", { nac: "2015-05-05junk" }],
    ["fecha 0000-00-00", { nac: "0000-00-00" }], ["monto 0x10", { cm: "0x10" }], ["monto 1e3", { cm: "1e3" }],
    ["nombre con HTML", { nom: "<img src=x onerror=alert(1)>" }],
  ];
  const aceptados = [];
  for (const [nombre, ov] of malos) {
    const r = JSON.parse(env.run(`JSON.stringify(validarAlumno(Object.assign(${JSON.stringify(BASE)}, ${JSON.stringify(ov)})))`));
    if (r.e.length === 0) aceptados.push(`${nombre} → guardaría ${JSON.stringify(Object.fromEntries(Object.keys(ov).map((k) => [k, r.d[k]])))}`);
  }
  return { pass: aceptados.length === 0, detalle: aceptados.length ? "ACEPTADOS: " + aceptados.join(" | ") : "todos rechazados" };
});
caso("P3-b", "ALTO", "today() usa UTC: en Perú (UTC-5) todo registro después de las 19:00 queda con la fecha del día siguiente", async (env) => {
  env.run(`(() => { const R = Date, fijo = new R("2026-11-09T20:30:00-05:00").getTime();
    globalThis.Date = class extends R { constructor(...a) { a.length ? super(...a) : super(fijo); } static now() { return fijo; } }; })()`);
  const hoy = env.run("today()");
  return { pass: hoy === "2026-11-09", detalle: `a las 20:30 hora de Lima today() devuelve "${hoy}" (esperado 2026-11-09). Afecta caja, asistencias y cierres por día/mes` };
});
caso("P3-c", "MEDIO", "age('') devuelve el año actual como 'edad' (fecha vacía de pre-registro/legado no se detecta)", async (env) => {
  const a = env.run('age("")');
  return { pass: !(Number.isFinite(a) && a > 120), detalle: `age("") = ${a}` };
});
caso("P3-d", "BAJO", "money() convierte NaN/undefined/texto en 'S/ 0.00' (oculta datos corruptos en vez de señalarlos)", async (env) => {
  const r = JSON.parse(env.run('JSON.stringify([money(NaN), money(undefined), money("abc")])'));
  return { pass: !r.some((x) => x === "S/ 0.00"), detalle: `money(NaN), money(undefined), money("abc") → ${JSON.stringify(r)}` };
});
caso("P3-e", "MEDIO", "Fuzz de validarAlumno (5000 combinaciones de tipos hostiles): nunca lanza y nunca acepta datos fuera de invariantes", async (env) => {
  const out = JSON.parse(env.run(`(() => {
    let s = 7; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const pool = ["", null, undefined, 0, -1, NaN, Infinity, 1e21, "  ", "\\u0000", "A".repeat(10000), "😀", "<img src=x onerror=alert(1)>", "' OR 1=1 --", "../../etc/passwd", "2026-02-30", {}, [], true, "12345678", "987654321", "M", "F", "Formativo", "Activo", "Ninguna", "2015-05-05", "a@b.co", "1,5", "99999", "-0"];
    const keys = ["nom","ape","dni","ac","am","an","seg","nac","sex","mod","con","est","cm","cmen","pag"];
    const thrown = []; let violaciones = 0;
    for (let i = 0; i < 5000; i++) {
      const f = {}; for (const k of keys) f[k] = pool[Math.floor(rnd() * pool.length)];
      try {
        const r = validarAlumno(f);
        if (!r.e.length) {
          const d = r.d;
          if (!RX.nombre.test(d.nom) || (d.dni && !RX.dni.test(d.dni)) || !(d.cm >= 0 && d.cm <= 99999) || !Number.isFinite(d.cmen) || !LISTAS.sex.includes(d.sex) || /[<>]/.test(d.nom + d.ape)) violaciones++;
        }
      } catch (e) { thrown.push(String(e)); }
    }
    return JSON.stringify({ thrown: thrown.length, ej: thrown[0] || null, violaciones });
  })()`));
  return { pass: out.thrown === 0 && out.violaciones === 0, detalle: JSON.stringify(out) };
});
caso("P3-f", "MEDIO", "Fuzz de esc(): ningún carácter peligroso sobrevive en salidas HTML (anti-XSS)", async (env) => {
  const out = JSON.parse(env.run(`(() => {
    let s = 99; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const ch = ["<",">","&","\\"","'","\`","/","=","a","1"," ","\\n","javascript:","onerror=","&lt;","&amp;"];
    let mal = 0;
    for (let i = 0; i < 3000; i++) { let t = ""; const n = Math.floor(rnd() * 12); for (let j = 0; j < n; j++) t += ch[Math.floor(rnd() * ch.length)];
      const o = esc(t); if (/[<>"'\`]/.test(o) || /&(?!(amp|lt|gt|quot|#39|#96);)/.test(o)) mal++; }
    return JSON.stringify({ mal });
  })()`));
  return { pass: out.mal === 0, detalle: JSON.stringify(out) };
});

/* ===== P4. Estado de alumnos / sedes / contabilidad ===== */
caso("P4-a", "ALTO", "Registrar un alumno desde un pre-registro borra el pre-registro aunque el guardado del alumno falle", async (env) => {
  await env.login();
  env.mock.hooks.push((r) => (r.method === "POST" && r.path.endsWith("/alumnos") ? resp(500, { message: "rls" }) : undefined));
  const Y = env.run("Y");
  env.setFields({ m_nom: "Ana", m_ape: "Quispe", m_dni: "70123456", m_ac: "987654321", m_am: "", m_an: "Rosa", m_seg: "", m_nac: `${Y - 10}-05-05`, m_sex: "F", m_mod: "Formativo", m_con: "Ninguna", m_est: "Activo", m_cm: "0", m_cmen: "0", m_pag: "0", m_sed: "SED-CSJ", m_hor: "", m_mes: "1" });
  env.run('PREID = "pre1"; PRE = {id:"pre1"}; ED = null; V = "mat"; adjInit({})');
  env.fields.m_dep = el("m_dep");
  env.fields.m_dep.value = env.run("S.deportes[0].id");
  try { await env.run("saveAlu()"); } catch { /* R() puede fallar en el DOM simulado; no afecta la comprobación */ }
  await env.run("sv");
  await sleep(150);
  const preSigue = env.mock.db.preregistros.some((p) => p.id === "pre1");
  const alu = env.mock.db.alumnos.some((a) => a.dni === "70123456");
  return { pass: preSigue || alu, detalle: `alumno guardado en BD=${alu}; pre-registro (datos del padre + archivos) ELIMINADO de la BD=${!preSigue}` };
});
caso("P4-b", "MEDIO", "Bajar 'monto pagado' de un alumno no deja ningún asiento en caja (descuadre contable)", async (env) => {
  await env.login();
  env.run('S.alu[0].pag = 100; S.alu[0].nac = (Y - 10) + "-05-05"; ED = S.alu[0].id; PREID = null; V = "mat"; adjInit(S.alu[0])');
  const a = JSON.parse(env.run("JSON.stringify(S.alu[0])"));
  env.setFields({ m_nom: "Ana", m_ape: "Quispe", m_dni: a.dni || "", m_ac: "", m_am: "", m_an: "Rosa", m_seg: "", m_nac: a.nac, m_sex: "F", m_mod: "Formativo", m_con: "Ninguna", m_est: "Activo", m_cm: "0", m_cmen: "0", m_pag: "0", m_sed: a.sede, m_dep: a.dep, m_hor: "", m_mes: "1" });
  const c0 = env.run("S.caja.length");
  try { await env.run("saveAlu()"); } catch {}
  await env.run("sv");
  const pag = env.run("S.alu[0].pag"), c1 = env.run("S.caja.length");
  return { pass: !(pag === 0 && c1 === c0), detalle: `monto_pagado 100 → ${pag}; movimientos de caja ${c0} → ${c1} (ni egreso ni nota de anulación)` };
});
caso("P4-c", "MEDIO", "addSede() en modo edición lanza TypeError si la sede ya no existe (otro admin la borró y el poll recargó)", async (env) => {
  await env.login();
  env.setFields({ s_n: "Nueva", s_c: "", s_d: "", s_t: "", s_k: "Mensual", s_m: "10" });
  env.run('ES = "SED-ELIMINADA"');
  try { env.run("addSede()"); return { pass: true, detalle: "sin excepción" }; }
  catch (e) { return { pass: false, detalle: `${e.constructor.name}: ${e.message}` }; }
});
caso("P4-d", "MEDIO", "qrLeido() sin el modal abierto lanza TypeError (null.textContent); en loopCam() queda tragado por un catch vacío", async (env) => {
  await env.login();
  try { env.run('qrLeido("https://x/#c=aaaaaaaaaaaaaaaa")'); return { pass: true, detalle: "sin excepción" }; }
  catch (e) { return { pass: false, detalle: `${e.constructor.name}: ${e.message}` }; }
});
caso("P4-e", "ALTO", "payRun() reemplaza la función global R() y, si la petición se cuelga, R()/out() quedan anulados: la sesión 'expira' pero los datos siguen en pantalla", async (env) => {
  await env.login();
  env.ctx.__b = el("pay");
  env.run('DOM.app.innerHTML = "DATOS_DE_MENORES_VISIBLES"; payRun(__b, () => new Promise(() => {}), () => S.caja.length, () => ({}))');
  env.run("out()"); // cierre por inactividad (30 min)
  await sleep(1000);
  const html = env.nodes["#app"].innerHTML, payb = env.run("PAYB"), Uv = env.run("U");
  return { pass: html !== "DATOS_DE_MENORES_VISIBLES", detalle: `tras out(): U=${Uv}, PAYB=${payb}, pantalla sigue mostrando datos=${html === "DATOS_DE_MENORES_VISIBLES"}` };
});

/* ===== P5. ErpLoader / seguridad (comprobaciones estáticas sobre el código) ===== */
const rd = (p) => { try { return fs.readFileSync(path.join(ROOT, p), "utf8"); } catch { return ""; } };
const LOADER = rd("app/components/ErpLoader.tsx"), NEXTCFG = rd("next.config.ts");
const est = (id, nivel, titulo, cond, ok, mal) => caso(id, nivel, titulo, async () => ({ pass: !!cond(), detalle: cond() ? ok : mal }));
est("P5-a", "MEDIO", "ErpLoader: scripts de CDN con Subresource Integrity (integrity + crossOrigin)", () => /integrity\s*=/.test(LOADER) || !/https?:\/\/[^"']*(cdnjs|jsdelivr|unpkg)/.test(LOADER), "SRI presente o librerías autoalojadas", "cdnjs se ejecuta sin SRI: si la CDN o el path se comprometen, corre código ajeno con la sesión de ADM");
est("P5-b", "MEDIO", "ErpLoader: timeout al cargar scripts (CDN colgada)", () => /setTimeout|AbortController|Promise\.race/.test(LOADER), "hay timeout", "si la CDN no responde, loadScript() nunca resuelve: #app queda vacío (pantalla en blanco, sin mensaje)");
est("P5-c", "MEDIO", "ErpLoader/script.js: si falla jsQR el escáner avisa al usuario", () => /Lector QR no disponible/.test(SRC), "avisa", "con jsQR ausente loopCam() reintenta en silencio para siempre (el mensaje de ayuda solo se muestra tras ejecutar jsQR)");
est("P5-d", "MEDIO", "CSP: script-src sin 'unsafe-inline'", () => !/script-src[^"`;]*'unsafe-inline'/.test(NEXTCFG), "sin unsafe-inline", "'unsafe-inline' en script-src anula gran parte de la protección anti-XSS (el refresh token vive en sessionStorage)");
est("P5-e", "MEDIO", "out(): revoca la sesión en el servidor (/auth/v1/logout)", () => /auth\/v1\/logout/.test(SRC), "revoca", "out() solo borra variables locales; el refresh token sigue válido en Supabase");
est("P5-f", "BAJO", "FN/ON_* son objetos sin prototipo (data-f='constructor' no resuelve a funciones heredadas)", () => /const FN\s*=\s*Object\.create\(null\)/.test(SRC) || /Object\.hasOwn\(FN/.test(SRC), "FN protegido", "FN['constructor'] y FN['__proto__'] existen; usar Object.create(null) o Object.hasOwn()");
est("P5-g", "BAJO", "Sin código muerto de persistencia local (load()/mig() nunca se invocan)", () => (SRC.match(/\bload\(\)/g) || []).length !== 1, "sin código muerto", "load() y mig() no se llaman en ningún sitio (sessionStorage legado); mantenerlos invita a errores");
est("P5-h", "ALTO", "Alta anónima de pre-registros: anti-bot validado en servidor (el honeypot pp_w es solo cliente)", () => /turnstile|hcaptcha|recaptcha|captcha/i.test(SRC), "captcha presente", "el formulario público y la subida a Storage son llamables directamente con la anon key: sin CAPTCHA/rate-limit ni CHECK/políticas que impongan tamaño y tipo en servidor");

/* ------------------------------ ejecución ------------------------------- */
const ICON = { "CRÍTICO": "🟥", ALTO: "🟧", MEDIO: "🟨", BAJO: "🟦" };
const resultados = [];
const sel = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
for (const c of CASES) {
  if (sel && !sel.test(c.id)) continue;
  let r;
  try {
    const env = await newEnv();
    r = await Promise.race([c.fn(env), sleep(15000).then(() => ({ pass: false, detalle: "el caso excedió 15 s (cuelgue)" }))]);
  } catch (e) {
    r = { pass: false, detalle: "excepción en el caso: " + ((e && e.stack) || e).toString().split("\n").slice(0, 2).join(" ") };
  }
  resultados.push({ id: c.id, nivel: c.nivel, titulo: c.titulo, ...r });
  console.log(`${r.pass ? "✔ PASA " : r.inconcluso ? "? INCONCLUSO" : "✖ FALLA"}  ${ICON[c.nivel]} [${c.id}] ${c.titulo}\n          ↳ ${r.detalle}\n`);
}
const fallan = resultados.filter((r) => !r.pass);
console.log("=".repeat(78));
console.log(`Casos: ${resultados.length} · PASAN: ${resultados.length - fallan.length} · FALLAN (defecto presente): ${fallan.length}`);
for (const n of ["CRÍTICO", "ALTO", "MEDIO", "BAJO"]) console.log(`  ${ICON[n]} ${n}: ${fallan.filter((r) => r.nivel === n).length}`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ script: SCRIPT, fecha: new Date().toISOString(), resultados }, null, 2));
process.exit(fallan.length ? 1 : 0);
