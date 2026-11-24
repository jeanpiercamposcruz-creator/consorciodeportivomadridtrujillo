/* [ERP 11/18] 11-vistas-base.js — Vistas: registro VW y helpers compartidos (sección 15, parte 1). Código sin cambios respecto a script.js (líneas 2272-2302). */
/* ==================================================================
   15. VISTAS (un módulo por pantalla)
   ================================================================== */
const tbl = (h, r) =>
  `<div class=tw><table><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr>${r.join("") || `<tr><td colspan=${esc(h.length)} class=mu>Sin registros todavía.</td></tr>`}</table></div>`;
const VW = {};
VW.pre = () => vwPre();
/* ==================================================================
   PARTE 2: helpers compartidos (días, pestañas, enlaces, contadores)
   ================================================================== */
const DIAS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAL = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const nxl = (L, p, n) =>
  p +
  String(
    Math.max(
      0,
      ...L.filter((x) => String(x.id).startsWith(p)).map((x) => +String(x.id).slice(p.length) || 0),
    ) + 1,
  ).padStart(n, "0");
const urlOk = (u) => /^https?:\/\/[^\s"'<>`]{1,500}$/i.test(u || "");
const tabs = (cur, L, f) =>
  `<div class=tabs role=tablist>${L.map(([k, t]) => `<button type=button role=tab aria-selected=${k === cur} class="tab${k === cur ? " on" : ""}" data-f=${f} data-i=${k}>${t}</button>`).join("")}</div>`;
const sedEst = (s) => s.est || "Activa";
const ctrVig = (sid) => S.contratos.find((c) => c.sede === sid && c.vig);
const costoSede = (s) => {
  const c = ctrVig(s.id);
  return c ? +c.monto : +s.costo || 0;
};
const ccTxt = (id) => (S.cc.find((x) => x.id === id) || {}).codigo || "-";

