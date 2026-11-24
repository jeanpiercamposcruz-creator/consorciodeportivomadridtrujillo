/* [ERP 12/18] 12-vistas-sedes.js — Vistas: Sedes y alquileres. Código sin cambios respecto a script.js (líneas 2303-2557). */
/* ==================================================================
   SEDES Y ALQUILERES (pestañas: Sedes · Contratos de Alquiler · Centros de Costo)
   ================================================================== */
VW.sedes = () =>
  `<div class=card>${tabs(
    SEDT,
    [
      ["s", "Sedes"],
      ["c", "Contratos de Alquiler"],
      ["k", "Centros de Costo"],
    ],
    "sedTab",
  )}</div>` + (SEDT === "c" ? vwCtr() : SEDT === "k" ? vwCc() : vwSed());
const sedTbl = () => {
  const q = SQ.toLowerCase(),
    L = S.sedes.filter((s) => !q || `${s.id} ${s.nombre} ${s.dir}`.toLowerCase().includes(q));
  return tbl(
    ["Código", "Sede", "Centro de costo", "Dirección", "Contacto", "Alquiler / mes", "Estado", ""],
    L.map((s) => {
      const on = sedEst(s) === "Activa",
        id = esc(s.id);
      return `<tr><td>${id}</td><td>${esc(s.nombre)}</td><td>${esc(ccTxt(s.cc))}</td><td>${esc(s.dir)}</td><td>${esc(s.con)}</td><td>${money(costoSede(s))}</td><td><span class="b ${on ? "ok" : "no"}">${on ? "Activa" : "Inactiva"}</span></td><td><button class="s g act" data-f=sedEd data-i="${id}" title="Modificar" aria-label="Modificar">${iac("edit")}</button> <button class="s g act" data-f=sedCtr data-i="${id}" title="Contratos" aria-label="Contratos">${iac("doc")}</button> <button class="s act ${on ? "ban" : "g"}" data-f=sedTog data-i="${id}" title="${on ? "Desactivar" : "Activar"}" aria-label="${on ? "Desactivar" : "Activar"}">${on ? iac("block") : iac("check")}</button> <button class="s r act" data-f=delSede data-i="${id}" title="Eliminar" aria-label="Eliminar">${iac("trash")}</button></td></tr>`;
    }),
  );
};
function vwSed() {
  const e = S.sedes.find((s) => s.id === ES) || {},
    cv = ES ? ctrVig(ES) : null,
    tot = S.sedes.filter((s) => sedEst(s) === "Activa").reduce((t, s) => t + costoSede(s), 0);
  return `<div class=card><h3>${ES ? "Modificar " + esc(ES) : "Datos de la sede"}</h3><div class=fg>${fl("Nombre de la sede *", `<input id=s_n value="${esc(e.nombre || "")}">`)}${fl("Código corto (3 letras) *", `<input id=s_c maxlength=3 value="${esc(ES ? ES.slice(4) : "")}" ${ES ? "disabled" : ""}>`)}${fl("Dirección", `<input id=s_d value="${esc(e.dir || "")}">`)}${fl("Contacto", `<input id=s_t value="${esc(e.con || "")}">`)}${fl(
    "Centro de costo",
    "<select id=s_cc>" +
      o(
        S.cc.filter((c) => c.activo || c.id === e.cc).map((c) => [c.id, c.codigo + " - " + c.nombre]),
        e.cc,
        "Seleccionar...",
      ) +
      "</select>",
  )}${fl(
    "Estado",
    "<select id=s_e>" +
      o(
        [
          ["Activa", "Activa"],
          ["Inactiva", "Inactiva"],
        ],
        sedEst(e),
      ) +
      "</select>",
  )}${fl(
    "Tipo de alquiler",
    "<select id=s_k>" +
      o(
        ["Mensual", "Por hora", "Anual"].map((x) => [x, x]),
        e.tipo,
      ) +
      "</select>",
  )}${fl("Costo mensual de alquiler (S/)", `<input id=s_m type=number min=0 value="${esc(cv ? cv.monto : (e.costo ?? ""))}" ${cv ? "disabled" : ""}>`)}</div><p class=mu>${cv ? `Costo vigente: <b>${money(cv.monto)} / mes</b> · contrato del ${esc(cv.ini)} al ${esc(cv.fin)}${urlOk(cv.doc) ? ` · <a href="${esc(cv.doc)}" target=_blank rel="noopener noreferrer">Ver contrato</a>` : ""}` : "Sin contrato vigente: se usa el costo mensual indicado. Puedes registrar el contrato en la pestaña Contratos de Alquiler."}</p><div class=row><button data-f=addSede>${ES ? "Guardar cambios" : "Guardar sede"}</button>${ES ? "<button class=g data-f=cancelSede>Cancelar</button>" : ""}</div></div><div class=card><div class=row><h3 class="u-m-0 u-flex-1">Sedes registradas</h3><input id=s_q data-in=sedQ placeholder="Buscar por código, nombre o dirección..." value="${esc(SQ)}"></div><div id=sed_t>${sedTbl()}</div><div class=row><button class=g data-f=cp data-i=sedes>Copiar para Excel</button></div><p><b>Total de alquileres activos: ${money(tot)} al mes</b></p></div>`;
}
function addSede() {
  const n = limpiar(v("s_n"), 60),
    c = v("s_c").toUpperCase(),
    cc = v("s_cc"),
    est = v("s_e");
  if (!n) return toast("Ingresa el nombre");
  if (!["Activa", "Inactiva"].includes(est)) return toast("Estado inválido");
  if (S.cc.length && !S.cc.some((x) => x.id === cc)) return toast("Elige un centro de costo");
  const d = {
    nombre: n,
    dir: limpiar(v("s_d"), 120),
    con: limpiar(v("s_t"), 80),
    tipo: ["Mensual", "Por hora", "Anual"].includes(v("s_k")) ? v("s_k") : "Mensual",
    costo: monto(v("s_m") || 0),
    cc,
    est,
  };
  if (d.costo === null) return toast("Costo inválido");
  if (ES) {
    const tgt = S.sedes.find((s) => s.id === ES);
    if (!tgt) {
      ES = null;
      return toast("La sede ya no existe (otro usuario la eliminó). Recarga e inténtalo de nuevo.");
    }
    const cv = ctrVig(ES);
    if (cv) d.costo = +cv.monto;
    Object.assign(tgt, d);
    tgt.cod = tgt.cod || ES.slice(4);
    ES = null;
    toast("Sede actualizada");
  } else {
    if (!/^[A-Z]{3}$/.test(c)) return toast("El código debe tener 3 letras (A-Z)");
    if (S.sedes.some((s) => s.id === "SED-" + c)) return toast("Ese código ya existe");
    S.sedes.push({ id: "SED-" + c, cod: c, ...d });
    toast("Sede guardada");
  }
  save();
  R();
}
const sedTog = (id) => {
  const s = S.sedes.find((x) => x.id === id);
  if (!s) return;
  s.est = sedEst(s) === "Activa" ? "Inactiva" : "Activa";
  save();
  toast(s.est === "Activa" ? "Sede activada" : "Sede desactivada");
  R();
};
function delSede(id) {
  if (
    S.hor.some((h) => h.sede === id) ||
    S.alu.some((a) => a.sede === id) ||
    S.caja.some((x) => x.sede === id) ||
    S.kits.some((x) => x.sede === id) ||
    S.contratos.some((x) => x.sede === id) ||
    S.psedes.some((x) => x.sede === id)
  )
    return toast("No se puede eliminar: tiene horarios, alumnos, contratos o movimientos. Puedes desactivarla.");
  S.sedes = S.sedes.filter((s) => s.id !== id);
  save();
  toast("Sede eliminada");
  R();
}

/* ---------- Contratos de alquiler ---------- */
function vwCtr() {
  const e = S.contratos.find((c) => c.id === EC) || {},
    sid = e.sede || ES || (S.sedes[0] || {}).id,
    hoy = today(),
    L = [...S.contratos].sort(
      (a, b) => a.sede.localeCompare(b.sede) || String(b.ini).localeCompare(String(a.ini)),
    );
  return `<div class=card><h3>${EC ? "Modificar " + esc(EC) : "Nuevo contrato de alquiler"}</h3><div class=fg>${fl("Sede *", "<select id=c_s>" + o(S.sedes.map((s) => [s.id, s.nombre]), sid) + "</select>")}${fl("Inicio *", `<input id=c_i type=date value="${esc(e.ini || "")}">`)}${fl("Fin *", `<input id=c_f type=date value="${esc(e.fin || "")}">`)}${fl("Monto mensual (S/) *", `<input id=c_m type=number min=0 value="${esc(e.monto ?? "")}">`)}${fl("Enlace del contrato (opcional)", `<input id=c_u placeholder="https://..." value="${esc(e.doc || "")}">`)}<label class=chk><input type=checkbox id=c_v ${EC ? (e.vig ? "checked" : "") : "checked"}><span>Contrato vigente (define el costo de alquiler de la sede)</span></label></div><div class=row><button data-f=addCtr>${EC ? "Guardar cambios" : "Guardar contrato"}</button>${EC ? "<button class=g data-f=cancelCtr>Cancelar</button>" : ""}</div></div><div class=card>${tbl(
    ["Código", "Sede", "Vigencia", "Monto / mes", "Documento", "Estado", ""],
    L.map((c) => {
      const venc = c.fin < hoy,
        id = esc(c.id);
      return `<tr><td>${id}</td><td>${esc(sn(c.sede))}</td><td>${esc(c.ini)} al ${esc(c.fin)}</td><td>${money(c.monto)}</td><td>${urlOk(c.doc) ? `<a href="${esc(c.doc)}" target=_blank rel="noopener noreferrer">Ver contrato</a>` : "-"}</td><td><span class="b ${c.vig && !venc ? "ok" : "no"}">${c.vig ? (venc ? "Vencido" : "Vigente") : "Finalizado"}</span></td><td><button class="s g act" data-f=ctrEd data-i="${id}" title="Modificar" aria-label="Modificar">${iac("edit")}</button> <button class="s r act" data-f=delCtr data-i="${id}" title="Eliminar" aria-label="Eliminar">${iac("trash")}</button></td></tr>`;
    }),
  )}</div>`;
}
function addCtr() {
  const sid = v("c_s"),
    ini = v("c_i"),
    fin = v("c_f"),
    m = monto(v("c_m")),
    u = v("c_u"),
    vig = $("#c_v").checked;
  if (!S.sedes.some((s) => s.id === sid)) return toast("Elige una sede");
  if (!fechaOk(ini) || !fechaOk(fin)) return toast("Las fechas de inicio y fin son obligatorias");
  if (fin <= ini) return toast("La fecha de fin debe ser posterior al inicio");
  if (m === null || m <= 0) return toast("Monto mensual inválido");
  if (u && !urlOk(u)) return toast("El enlace debe empezar con http:// o https://");
  const d = { sede: sid, ini, fin, monto: m, doc: u, vig };
  let idc = EC;
  if (EC) {
    const t = S.contratos.find((c) => c.id === EC);
    if (!t) {
      EC = null;
      return toast("El contrato ya no existe. Recarga e inténtalo de nuevo.");
    }
    Object.assign(t, d);
  } else {
    idc = nxl(S.contratos, "CTR-", 4);
    S.contratos.push({ id: idc, ...d });
  }
  if (vig) {
    S.contratos.forEach((c) => {
      if (c.sede === sid && c.id !== idc) c.vig = false;
    });
    const s = S.sedes.find((x) => x.id === sid);
    if (s) s.costo = m;
  }
  EC = null;
  save();
  toast("Contrato guardado");
  R();
}
function delCtr(id) {
  S.contratos = S.contratos.filter((c) => c.id !== id);
  save();
  toast("Contrato eliminado");
  R();
}

/* ---------- Centros de costo ---------- */
function vwCc() {
  const e = S.cc.find((c) => c.id === EK) || {};
  return `<div class=card><h3>${EK ? "Modificar " + esc(EK) : "Nuevo centro de costo"}</h3><div class=fg>${fl("Código *", `<input id=k_c maxlength=12 value="${esc(e.codigo || nxl(S.cc, "CC-", 3))}" ${EK ? "disabled" : ""}>`)}${fl("Nombre *", `<input id=k_n value="${esc(e.nombre || "")}">`)}${fl(
    "Estado",
    "<select id=k_a>" +
      o(
        [
          ["1", "Activo"],
          ["0", "Inactivo"],
        ],
        EK ? (e.activo ? "1" : "0") : "1",
      ) +
      "</select>",
  )}</div><div class=row><button data-f=addCc>${EK ? "Guardar cambios" : "Guardar centro de costo"}</button>${EK ? "<button class=g data-f=cancelCc>Cancelar</button>" : ""}${!S.cc.length && S.sedes.length ? "<button class=g data-f=ccAuto>Crear uno por cada sede existente</button>" : ""}</div></div><div class=card>${tbl(
    ["Código", "Nombre", "Sedes asociadas", "Estado", ""],
    S.cc.map((c) => {
      const id = esc(c.id);
      return `<tr><td>${id}</td><td>${esc(c.nombre)}</td><td>${esc(S.sedes.filter((s) => s.cc === c.id).map((s) => s.nombre).join(", ") || "-")}</td><td><span class="b ${c.activo ? "ok" : "no"}">${c.activo ? "Activo" : "Inactivo"}</span></td><td><button class="s g act" data-f=ccEd data-i="${id}" title="Modificar" aria-label="Modificar">${iac("edit")}</button> <button class="s r act" data-f=delCc data-i="${id}" title="Eliminar" aria-label="Eliminar">${iac("trash")}</button></td></tr>`;
    }),
  )}</div>`;
}
function addCc() {
  const c = v("k_c").toUpperCase(),
    n = limpiar(v("k_n"), 60),
    a = v("k_a") === "1";
  if (!n) return toast("Ingresa el nombre");
  if (EK) {
    const t = S.cc.find((x) => x.id === EK);
    if (!t) {
      EK = null;
      return toast("El centro de costo ya no existe. Recarga e inténtalo de nuevo.");
    }
    Object.assign(t, { nombre: n, activo: a });
  } else {
    if (!/^[A-Z0-9-]{2,12}$/.test(c)) return toast("Código: 2 a 12 letras, números o guiones");
    if (S.cc.some((x) => x.id === c || x.codigo === c)) return toast("Ese código ya existe");
    S.cc.push({ id: c, codigo: c, nombre: n, activo: a });
  }
  EK = null;
  save();
  toast("Centro de costo guardado");
  R();
}
function delCc(id) {
  if (S.sedes.some((s) => s.cc === id))
    return toast("No se puede eliminar: hay sedes asociadas. Desactívalo o cambia la sede.");
  S.cc = S.cc.filter((c) => c.id !== id);
  save();
  toast("Centro de costo eliminado");
  R();
}
function ccAuto() {
  S.sedes
    .filter((s) => !s.cc)
    .forEach((s) => {
      const c = nxl(S.cc, "CC-", 3);
      S.cc.push({ id: c, codigo: c, nombre: "Sede " + s.nombre, activo: true });
      s.cc = c;
    });
  save();
  toast("Centros de costo creados y asignados");
  R();
}
const hsem = (p) => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const w = d.toISOString().slice(0, 10);
  return S.asis
    .filter((x) => x.t === "P" && x.ref === p.id && x.ok && x.f >= w)
    .reduce((t, x) => t + hrs(S.hor.find((h) => h.id === x.h) || { ini: "0:00", fin: "0:00" }), 0);
};
