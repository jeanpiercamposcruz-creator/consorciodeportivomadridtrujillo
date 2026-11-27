/* [ERP 01/18] 01-config.js — Configuración, referencias al DOM, utilidades y validación (secciones 1-2). Código sin cambios respecto a script.js (líneas 1-110). */
/* ==================================================================
   1. CONFIGURACIÓN, REFERENCIAS AL DOM Y UTILIDADES
   ================================================================== */
const K = "cdmt_erp_v2",
  Y = new Date().getFullYear(),
  $ = (s) => document.querySelector(s);

/* Referencias a los nodos estáticos de index.html */
const DOM = {
  app: $("#app"),
  mod: $("#mod"),
  toast: $("#toast"),
  video: $("#bgv"),
};
const v = (id) => {
  const e = document.getElementById(id);
  return e ? e.value.trim() : "";
};
/* Fecha civil de Perú, independiente de la zona horaria del navegador o del servidor. */
const today = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return p.year + "-" + p.month + "-" + p.day;
  },
  money = (n) => "S/ " + (+n || 0).toFixed(2);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"'`]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" })[c],
  );
const limpiar = (s, max = 80) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const RX = {
    nombre: /^[\p{L}][\p{L} .'-]{0,59}$/u,
    dni: /^\d{8}$/,
    cel: /^\d{1,9}$/,
    mail: /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/,
    fecha: /^\d{4}-\d{2}-\d{2}$/,
  },
  IMG_OK = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]{0,200000}$/;
const LISTAS = {
  sex: ["M", "F"],
  mod: ["Formativo", "Competitivo"],
  con: ["Ninguna", "Media Beca", "Becado"],
  est: ["Activo", "Inactivo"],
};
/* Monto estricto: solo dígitos con hasta 2 decimales (rechaza 0x10, 1e3, "abc", negativos). */
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
};
/* ==================================================================
   2. VALIDACIÓN Y SANEAMIENTO DE DATOS
   ================================================================== */
function validarAlumno(f) {
  const d = {
      nom: limpiar(f.nom, 60),
      ape: limpiar(f.ape, 60),
      dni: limpiar(f.dni, 40), // sin truncar: el regex decide (antes "123456789012" pasaba como "12345678")
      ac: limpiar(f.ac, 40),
      am: limpiar(f.am, 120).toLowerCase(),
      an: limpiar(f.an, 80),
      seg: limpiar(f.seg, 60),
      nac: limpiar(f.nac, 40),
      sex: f.sex,
      mod: f.mod,
      con: f.con,
      est: f.est,
    },
    e = [];
  if (!RX.nombre.test(d.nom) || !RX.nombre.test(d.ape))
    e.push("Nombres o apellidos inválidos (solo letras)");
  if (d.dni && !RX.dni.test(d.dni)) e.push("El DNI debe tener 8 dígitos");
  if (d.ac && !RX.cel.test(d.ac)) e.push("El celular admite hasta 9 dígitos");
  if (d.am && !RX.mail.test(d.am)) e.push("Correo inválido");
  if (!fechaOk(d.nac)) e.push("Fecha de nacimiento inválida");
  for (const k in LISTAS) if (!LISTAS[k].includes(d[k])) e.push("Valor no permitido en " + k);
  for (const k of ["cm", "cmen", "pag"]) {
    d[k] = monto(f[k]);
    if (d[k] === null) e.push("Monto inválido");
  }
  return { d, e };
}
function validarPago(f) {
  const m = monto(f.m),
    e = [];
  if (m === null || m <= 0) e.push("Monto inválido");
  if (!["I", "E"].includes(f.t)) e.push("Tipo inválido");
  const concepto = limpiar(f.c, 60);
  if (!concepto) e.push("Concepto obligatorio");
  return { d: { m, t: f.t, c: concepto, d: limpiar(f.d, 120) }, e };
}
const o = (a, val, ph) =>
  (ph !== undefined ? `<option value="">${ph}</option>` : "") +
  a
    .map(([x, y]) => `<option value="${esc(x)}"${x == val ? " selected" : ""}>${esc(y)}</option>`)
    .join("");
const fl = (l, h) => `<label>${l}${h}</label>`;
