/* [ERP 09/18] 09-ui-helpers.js — Helpers de negocio y UI, íconos, módulos y enrutador (secciones 11-12). Código sin cambios respecto a script.js (líneas 1795-2052). */
/* ==================================================================
   11. HELPERS DE NEGOCIO Y UI (toast, modal, QR, exportar a Excel)
   ================================================================== */
const nx = (k, p) => {
  const L = k === "HOR" ? S.hor : S.personal.filter((x) => x.id.startsWith(k + "-"));
  return String(Math.max(0, ...L.map((x) => +x.id.split("-").pop())) + 1).padStart(p, "0");
};
const cats = () => {
  const r = [];
  for (let y = Y - 17; y <= Y - 5; y++) r.push(y);
  return r;
};
const catOk = (y) => y >= Y - 17 && y <= Y - 5;
const sn = (id) => (S.sedes.find((x) => x.id === id) || {}).nombre || "-",
  dn = (id) => (S.deportes.find((x) => x.id === id) || {}).nombre || "-";
const hrs = (h) => {
  const minutos = (valor) => {
    const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(String(valor || ""));
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const inicio = minutos(h?.ini), fin = minutos(h?.fin);
  return Number.isFinite(inicio) && Number.isFinite(fin)
    ? Math.max(0, (fin - inicio) / 60)
    : 0;
};
const hl = (h) =>
  `${esc(sn(h.sede))} · ${esc(dn(h.dep))} ${esc(h.cat)} · ${DIAS[h.dia] ? DIAS[h.dia] + " " : ""}${esc(h.ini)}-${esc(h.fin)}`;
const falta = (a) => {
  const f = [];
  if (!/^\d{8}$/.test(a.dni || "")) f.push("DNI");
  if (!a.foto) f.push("Foto");
  if (!a.seg) f.push("Seguro");
  if (!a.an) f.push("Apoderado");
  if (!a.ac) f.push("Celular");
  if (!a.am) f.push("Correo");
  if (!a.dnf) f.push("Arch. DNI");
  if (!a.dsg) f.push("Arch. seguro");
  if (!a.dfm) f.push("Arch. ficha");
  return f;
};
const deuda = (a) => (+a.cm || 0) + (+a.cmen || 0) * (+a.mes || 0) - (+a.pag || 0);
function toast(m) {
  const t = DOM.toast;
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 2600);
}
const cl = () => {
  stopCam();
  DOM.mod.classList.remove("o", "rcm");
};
const modal = (h) => {
  DOM.mod.innerHTML = `<div class=card>${h}<div class="row u-jc-center"><button class=g data-f=cl>Cerrar</button></div></div>`;
  DOM.mod.classList.add("o");
};
const qr = (t) => {
  try {
    const q = qrcode(0, "M");
    q.addData(t);
    q.make();
    return '<div class="qr-box">' + q.createSvgTag(6) + "</div>";
  } catch (e) {
    return "<p class=mu>(" + esc(t) + ")</p>";
  }
};
const XL = {
  sedes: () => [
    ["Código", "Sede", "Centro de costo", "Dirección", "Contacto", "Tipo de alquiler", "Alquiler mensual (S/)", "Estado"],
    S.sedes.map((s) => [s.id, s.nombre, ccTxt(s.cc), s.dir, s.con, s.tipo, +costoSede(s), sedEst(s)]),
  ],
  personal: () => [
    [
      "Código",
      "DNI",
      "Nombres",
      "Teléfono",
      "Correo",
      "Especialidad",
      "Rol",
      "Tipo de contrato",
      "Inicio",
      "Fin",
      "Jornada",
      "Sueldo fijo (S/)",
      "Precio por hora (S/)",
      "Horas semana",
      "Pago semana (S/)",
      "Estado",
    ],
    S.personal.map((p) => [
      p.id,
      p.dni,
      p.nom,
      p.tel,
      p.correo,
      p.esp,
      p.rol,
      p.tc,
      p.fi,
      p.ff,
      p.jor,
      +p.sf || 0,
      +p.precio,
      +hsem(p).toFixed(1),
      +(hsem(p) * p.precio).toFixed(2),
      p.activo ? "Activo" : "Inactivo",
    ]),
  ],
  hor: () => [
    ["Código", "Día", "Sede", "Deporte", "Categoría", "Inicio", "Fin", "Profesores", "Estado"],
    S.hor.map((h) => [
      h.id,
      DIAL[h.dia] || "",
      sn(h.sede),
      dn(h.dep),
      "CAT-" + h.cat,
      h.ini,
      h.fin,
      h.profs.map((x) => (S.personal.find((p) => p.id === x) || {}).nom).join(", "),
      h.est || "Activo",
    ]),
  ],
  dir: () => [
    [
      "Código",
      "Alumno",
      "DNI",
      "Sexo",
      "Edad",
      "Sede",
      "Deporte",
      "Categoría",
      "Modalidad",
      "Estado",
      "Datos",
      "Deuda (S/)",
    ],
    dirL().map((a) => [
      a.id,
      a.nom + " " + a.ape,
      a.dni,
      a.sex,
      age(a.nac),
      sn(a.sede),
      dn(a.dep),
      "CAT-" + a.nac.slice(0, 4),
      a.mod,
      a.est,
      falta(a).length ? "Falta: " + falta(a).join(", ") : "Completa",
      Math.max(0, deuda(a)),
    ]),
  ],
  kits: () => [
    [
      "Código",
      "Alumno",
      "Prenda",
      "Talla",
      "Nombre",
      "Número",
      "Pedido",
      "Entrega",
      "Precio público (S/)",
      "Estado",
    ].concat(KS ? ["Costo (S/)", "Utilidad (S/)"] : []),
    S.kits.map((k) =>
      [k.code, k.al, k.p, k.t, k.n, k.u, k.f, k.e, +k.pr, k.est || "Activa"].concat(KS ? [+k.c, k.est === "Anulada" ? 0 : k.pr - k.c] : []),
    ),
  ],
  caja: () => {
    const s = AS.cs || S.sedes[0].id;
    return [
      ["Fecha", "Sede", "Tipo", "Concepto", "Detalle", "Monto (S/)"],
      S.caja
        .filter((x) => x.sede === s)
        .map((x) => [x.f, sn(x.sede), x.t === "I" ? "Ingreso" : "Egreso", x.c, x.d, +x.m]),
    ];
  },
};
function cp(k) {
  const [h, r0] = XL[k](),
    r = r0.map((x) => x.map((c) => (typeof c === "string" && /^[=+\-@]/.test(c) ? "'" + c : c))),
    t = [h, ...r]
      .map((x) => x.map((c) => String(c ?? "").replace(/[\t\r\n]+/g, " ")).join("\t"))
      .join("\n"),
    H = `<table border=1 style="border-collapse:collapse;font-family:Calibri,Arial"><tr>${h.map((x) => `<th style="background:#14633f;color:#fff;text-align:left">${esc(x)}</th>`).join("")}</tr>${r.map((x) => `<tr>${x.map((c) => (typeof c === "number" ? `<td style="text-align:right">${c}</td>` : `<td style="mso-number-format:'\\@'">${esc(c)}</td>`)).join("")}</tr>`).join("")}</table>`,
    ok = () => toast("Copiado. Pega en Excel o Google Sheets con Ctrl+V"),
    tx = () => navigator.clipboard.writeText(t).then(ok, () => toast("No se pudo copiar"));
  try {
    navigator.clipboard
      .write([
        new ClipboardItem({
          "text/html": new Blob([H], { type: "text/html" }),
          "text/plain": new Blob([t], { type: "text/plain" }),
        }),
      ])
      .then(ok, tx);
  } catch (e) {
    try {
      tx();
    } catch (_) {
      toast("No se pudo copiar");
    }
  }
}
/* ==================================================================
   12. ÍCONOS, MÓDULOS Y ENRUTADOR
   ================================================================== */
const IC = {
  sedes: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M12 9v2"/>',
  personal:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 2 4 5"/>',
  horarios: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  mat: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  dir: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  asis: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  kits: '<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  caja: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  pre: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM12 11v6M9 14h6"/>',
  ger: '<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
};
/* Iconos de acción (estilo Lucide/Heroicons, SVG vectorial — nunca emojis) */
const IA = {
  edit: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  block: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
};
const ico = (k, z = 34) =>
  `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
const iac = (k) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IA[k]}</svg>`;
const M = [
  ["sedes", "Sedes y Alquileres", "Sedes de terceros y costos fijos", ["ADM"], "sedes"],
  ["personal", "Personal y Planillas", "Entrenadores, horas y pago", ["ADM"], "personal"],
  ["horarios", "Horarios y Categorías", "Sede, deporte, categoría y hora", ["ADM"], "horarios"],
  ["mat", "Matrículas y Alumnos", "Ficha del alumno y carnet", ["ADM"], "mat"],
  ["dir", "Directorio de Alumnos", "Búsqueda, filtros y semáforo", ["ADM"], "dir"],
  ["asis", "Toma de Asistencias", "Asistencia y pago de campo", ["ADM"], "asis"],
  ["kits", "Ventas de Indumentaria", "Kits, tallas y entregas", ["ADM"], "kits"],
  ["caja", "Caja Chica y Finanzas", "Ingresos, egresos y saldo", ["ADM"], "caja"],
  ["ger", "Dashboard Gerencial", "Utilidad neta por sede", ["ADM"], "ger"],
  ["pre", "Pre-registro", "Solicitudes de los padres", ["ADM"], "pre", 1],
];
const go = (x) => {
  V = x;
  if (innerWidth <= 900) SIDE = false;
  ED = ES = EP = EC = EK = null;
  PFOTO = "";
  FOTO = null;
  DWK = null;
  PRE = PREID = FRESH = null;
  if (x === "pre") PR = null;
  R();
  if (x === "pre") cargarPre();
};
const LOGO = "assets/logo.png";
const SHIRT_SRC = "assets/shirt.png";
const sha = async (t) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
