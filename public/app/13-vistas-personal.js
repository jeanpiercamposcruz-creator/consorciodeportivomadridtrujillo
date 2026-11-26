/* [ERP 13/18] 13-vistas-personal.js — Vistas: Personal y planillas. Código sin cambios respecto a script.js (líneas 2558-2822). */
/* ==================================================================
   PERSONAL Y PLANILLAS (pestañas: Datos Generales · Contratos · Pagos y Liquidaciones)
   ================================================================== */
const PTIPOS = ["Planilla", "Locación de servicios", "Por horas"],
  PJOR = ["Tiempo completo", "Tiempo parcial", "Por horas"];
const perSedes = (id) => S.psedes.filter((x) => x.pid === id),
  perCert = (id) => S.pcert.filter((x) => x.pid === id),
  certEst = (c) => (c.ven && c.ven < today() ? "Vencida" : "Vigente"),
  nomP = (id) => (S.personal.find((p) => p.id === id) || {}).nom || id;
const perFotoHtml = () =>
  IMG_OK.test(PFOTO || "")
    ? `<img src="${esc(PFOTO)}" alt="Foto del personal" class="per-foto">`
    : `<div class="per-ph" role="img" aria-label="Foto del personal (sin foto)"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="12.5"/><path d="M6 60c0-15 11.6-24 26-24s26 9 26 24z"/></svg></div>`;
function perFotoSel(el) {
  const f = el.files && el.files[0];
  if (!f || !/^image\/(jpeg|png)$/.test(f.type)) return toast("Elige una imagen JPG o PNG");
  const rd = new FileReader();
  rd.onerror = () => toast("No se pudo leer la imagen");
  rd.onload = () => {
    const img = new Image();
    img.onerror = () => toast("No se pudo leer la imagen");
    img.onload = () => {
      const z = Math.min(1, 320 / Math.max(img.width, img.height)),
        c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * z));
      c.height = Math.max(1, Math.round(img.height * z));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL("image/jpeg", 0.8);
      if (!IMG_OK.test(d)) return toast("La imagen es demasiado grande");
      PFOTO = d;
      const b = $("#p_fp");
      if (b) b.innerHTML = perFotoHtml();
      const t = $("#p_ft");
      if (t) t.textContent = "Cambiar foto";
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
  el.value = ""; // permite volver a elegir el mismo archivo
}
/* Resumen de horario y horas semanales de una persona en una sede, calculado desde Horarios */
function autoSede(pid, sid) {
  const g = {};
  S.hor
    .filter((h) => h.sede === sid && h.est !== "Inactivo" && h.profs.includes(pid) && +h.dia >= 1)
    .forEach((h) => (g[h.ini + "-" + h.fin] = (g[h.ini + "-" + h.fin] || new Set()).add(+h.dia)));
  const e = Object.entries(g);
  return {
    resumen: e
      .map(([k, ds]) => [...ds].sort((a, b) => a - b).map((d) => DIAS[d]).join(" · ") + " " + k)
      .join(" / "),
    horas: e.reduce((t, [k, ds]) => t + ds.size * hrs({ ini: k.slice(0, 5), fin: k.slice(6) }), 0),
  };
}
const perSedTxt = (p) =>
  perSedes(p.id)
    .map((x) => sn(x.sede))
    .join(", ") ||
  [...new Set(S.hor.filter((h) => h.profs.includes(p.id)).map((h) => sn(h.sede)))].join(", ") ||
  "-";
VW.personal = () =>
  `<div class=card>${tabs(
    PERT,
    [
      ["d", "Datos Generales"],
      ["c", "Contratos"],
      ["p", "Pagos y Liquidaciones"],
    ],
    "perTab",
  )}</div>` + (PERT === "c" ? perCtr() : PERT === "p" ? perPay() : perDatos());
const perTbl = () => {
  const q = PQ.toLowerCase(),
    L = S.personal.filter(
      (p) => !q || `${p.id} ${p.dni} ${p.nom} ${p.rol} ${p.esp}`.toLowerCase().includes(q),
    );
  return tbl(
    ["Código", "DNI", "Nombres", "Rol", "Especialidad", "Sedes", "Contrato", "Tarifa (S/)", "Estado", ""],
    L.map((p) => {
      const id = esc(p.id);
      return `<tr><td>${id}</td><td>${esc(p.dni)}</td><td>${esc(p.nom)}</td><td>${esc(p.rol)}</td><td>${esc(p.esp)}</td><td>${esc(perSedTxt(p))}</td><td>${esc(p.tc || "-")}</td><td>${+p.precio ? (+p.precio).toFixed(2) : "--"}</td><td><span class="b ${p.activo ? "ok" : "no"}">${p.activo ? "Activo" : "Inactivo"}</span></td><td><button class="s g act" data-f=perEd data-i="${id}" title="Modificar" aria-label="Modificar">${iac("edit")}</button> <button class="s act ${p.activo ? "ban" : "g"}" data-f=togP data-i="${id}" title="${p.activo ? "Desactivar" : "Activar"}" aria-label="${p.activo ? "Desactivar" : "Activar"}">${p.activo ? iac("block") : iac("check")}</button></td></tr>`;
    }),
  );
};
function perDatos() {
  const e = S.personal.find((p) => p.id === EP) || {},
    dg = "data-in=digits inputmode=numeric",
    act = S.personal.filter((p) => p.activo).length;
  const form = `<div class=card><h3>${EP ? "Modificar " + esc(EP) : "Información del personal"}</h3><div class=pform><div class=pfoto><div id=p_fp>${perFotoHtml()}</div><label class=fbtn>${iac("upload")}<span id=p_ft>${IMG_OK.test(PFOTO || "") ? "Cambiar foto" : "Subir foto"}</span><input id=p_f type=file accept="image/jpeg,image/png" data-ch=perFoto hidden></label></div><div class=fg>${fl("DNI *", `<input id=p_d maxlength=8 ${dg} value="${esc(e.dni || "")}">`)}${fl("Nombres y apellidos *", `<input id=p_n value="${esc(e.nom || "")}">`)}${fl("Teléfono", `<input id=p_t maxlength=9 ${dg} value="${esc(e.tel || "")}">`)}${fl("Correo", `<input id=p_m type=email value="${esc(e.correo || "")}">`)}${fl(
    "Rol / Cargo *",
    "<select id=p_r>" +
      o(
        [
          ["ENT", "Entrenador"],
          ["ADM", "Administrador"],
          ["REC", "Recepcionista"],
        ],
        e.rol,
      ) +
      "</select>",
  )}${fl("Especialidad", `<input id=p_e value="${esc(e.esp || "")}">`)}${fl("Tipo de contrato *", "<select id=p_tc>" + o(PTIPOS.map((x) => [x, x]), e.tc, "Seleccionar...") + "</select>")}${fl("Fecha de inicio *", `<input id=p_fi type=date value="${esc(e.fi || "")}">`)}${fl("Fecha de fin", `<input id=p_ff type=date value="${esc(e.ff || "")}">`)}${fl("Sueldo fijo (S/)", `<input id=p_sf type=number min=0 value="${esc(e.sf ?? 0)}">`)}${fl("Tarifa por hora (S/) *", `<input id=p_p type=number min=0 value="${esc(e.precio ?? "")}">`)}${fl("Jornada / Régimen", "<select id=p_j>" + o(PJOR.map((x) => [x, x]), e.jor, "Seleccionar...") + "</select>")}${fl(
    "Estado *",
    "<select id=p_a>" +
      o(
        [
          ["1", "Activo"],
          ["0", "Inactivo"],
        ],
        e.id ? (e.activo ? "1" : "0") : "1",
      ) +
      "</select>",
  )}<div class=fchk><span class=fchk-l>Varias sedes</span><label class="chk fchk-box"><input type=checkbox id=p_mv ${e.mv ? "checked" : ""}><span>Permite dictar en varias sedes</span></label></div></div></div><div class=row><button data-f=addPer>${EP ? "Guardar cambios" : "Guardar"}</button>${EP ? "<button class=g data-f=cancelPer>Cancelar</button>" : ""}</div></div>`;
  let paneles = '<div class=card><p class=mu>Guarda al personal para asignarle sedes y certificaciones.</p></div>';
  if (EP) {
    const SL = perSedes(EP),
      CL = perCert(EP),
      th = SL.reduce((t, x) => t + (+x.hs || 0), 0);
    paneles = `<div class=pgrid><div class=card><h3>Sedes asignadas</h3>${tbl(
      ["Sede", "Horario", "Horas sem.", ""],
      SL.map(
        (x) =>
          `<tr><td>${esc(sn(x.sede))}</td><td>${esc(x.hr)}</td><td>${esc(x.hs)}</td><td><button class="s r act" data-f=perSedDel data-i="${esc(x.id)}" title="Quitar" aria-label="Quitar">${iac("trash")}</button></td></tr>`,
      ),
    )}<div class=row><select id=ps_s>${o(S.sedes.filter((s) => sedEst(s) === "Activa").map((s) => [s.id, s.nombre]))}</select><input id=ps_h placeholder="Horario (vacío = se toma de Horarios)"><input id=ps_r type=number min=0 placeholder="Horas sem."><button data-f=perSedAdd>Asignar sede</button></div><p class=mu>Total de horas semanales: <b>${th}</b></p></div><div class=card><h3>Certificaciones y acreditaciones</h3>${tbl(
      ["Certificación", "Entidad", "Vencimiento", "Estado", ""],
      CL.map(
        (x) =>
          `<tr><td>${esc(x.cert)}</td><td>${esc(x.ent)}</td><td>${esc(x.ven || "-")}</td><td><span class="b ${certEst(x) === "Vigente" ? "ok" : "no"}">${certEst(x)}</span></td><td><button class="s r act" data-f=perCerDel data-i="${esc(x.id)}" title="Quitar" aria-label="Quitar">${iac("trash")}</button></td></tr>`,
      ),
    )}<div class=row><input id=pc_c placeholder="Certificación"><input id=pc_e placeholder="Entidad"><input id=pc_v type=date><button data-f=perCerAdd>Agregar</button></div></div></div>`;
  }
  return `${form}${paneles}<div class=card><div class=row><h3 class="u-m-0 u-flex-1">Personal registrado</h3><input id=p_q data-in=perQ placeholder="Buscar por DNI, nombre, cargo o especialidad..." value="${esc(PQ)}"></div><div id=per_t>${perTbl()}</div><div class=row><button class=g data-f=cp data-i=personal>Copiar para Excel</button></div><p><b>Total de personal: ${S.personal.length} · Activos: ${act} · Inactivos: ${S.personal.length - act}</b></p></div>`;
}
function addPer() {
  const n = limpiar(v("p_n"), 60),
    d = v("p_d"),
    r = v("p_r"),
    mail = v("p_m"),
    tc = v("p_tc"),
    fi = v("p_fi"),
    ff = v("p_ff"),
    jor = v("p_j"),
    est = v("p_a"),
    pr = monto(v("p_p") || 0),
    sf = monto(v("p_sf") || 0);
  if (!RX.nombre.test(n) || !RX.dni.test(d))
    return toast("Nombre válido (solo letras) y DNI de 8 dígitos son obligatorios");
  if (v("p_t") && !RX.cel.test(v("p_t"))) return toast("Teléfono: hasta 9 dígitos");
  if (mail && !RX.mail.test(mail)) return toast("Correo inválido");
  if (!["ENT", "ADM", "REC"].includes(r)) return toast("Rol inválido");
  if (pr === null || sf === null) return toast("Tarifa o sueldo fijo inválido");
  if ((tc && !PTIPOS.includes(tc)) || (jor && !PJOR.includes(jor))) return toast("Contrato o jornada inválidos");
  if (!EP && (!tc || !fi)) return toast("Tipo de contrato y fecha de inicio son obligatorios");
  if ((fi && !fechaOk(fi)) || (ff && !fechaOk(ff))) return toast("Fecha inválida");
  if (fi && ff && ff < fi) return toast("La fecha de fin no puede ser anterior al inicio");
  if (!["1", "0"].includes(est)) return toast("Estado inválido");
  if (S.personal.some((p) => p.dni === d && p.id !== EP)) return toast("Ese DNI ya está registrado");
  const x = {
    nom: n,
    dni: d,
    tel: v("p_t"),
    esp: limpiar(v("p_e"), 60),
    rol: r,
    precio: pr,
    correo: mail,
    tc,
    fi,
    ff,
    sf,
    jor,
    mv: $("#p_mv").checked,
    foto: IMG_OK.test(PFOTO || "") ? PFOTO : "",
    activo: +est,
  };
  if (EP) {
    const t = S.personal.find((p) => p.id === EP);
    if (!t) {
      EP = null;
      return toast("El personal ya no existe. Recarga e inténtalo de nuevo.");
    }
    Object.assign(t, x);
    EP = null;
    PFOTO = "";
    var mensajeExitoPersonal = "Personal actualizado";
  } else {
    const id = `PER-${r}-${nx("PER-" + r, 4)}`;
    S.personal.push({ id, ...x });
    EP = id;
    var mensajeExitoPersonal = "Personal guardado: ya puedes asignarle sedes y certificaciones";
  }
  save(mensajeExitoPersonal);
  R();
}
function perSedAdd() {
  const sid = v("ps_s");
  if (!S.sedes.some((s) => s.id === sid)) return toast("Elige una sede");
  if (perSedes(EP).some((x) => x.sede === sid)) return toast("Esa sede ya está asignada");
  const p = S.personal.find((x) => x.id === EP);
  if (!p) return;
  if (!p.mv && perSedes(EP).length) return toast("Esta persona no permite dictar en varias sedes");
  const a = autoSede(EP, sid),
    hr = limpiar(v("ps_h"), 80) || a.resumen,
    hs = v("ps_r") === "" ? a.horas : monto(v("ps_r"));
  if (hs === null) return toast("Horas semanales inválidas");
  S.psedes.push({ id: uid(), pid: EP, sede: sid, hr, hs });
  save("Sede asignada");
  R();
}
function perSedDel(id) {
  S.psedes = S.psedes.filter((x) => x.id !== id);
  save();
  R();
}
function perCerAdd() {
  const c = limpiar(v("pc_c"), 80),
    ven = v("pc_v");
  if (!c) return toast("Ingresa la certificación");
  if (ven && !fechaOk(ven)) return toast("Fecha de vencimiento inválida");
  const x = { id: uid(), pid: EP, cert: c, ent: limpiar(v("pc_e"), 60), ven };
  x.est = certEst(x);
  S.pcert.push(x);
  save("Certificación agregada");
  R();
}
function perCerDel(id) {
  S.pcert = S.pcert.filter((x) => x.id !== id);
  save();
  R();
}
function perCtr() {
  const hoy = new Date(today() + "T00:00:00"),
    dd = (f) => Math.ceil((new Date(f + "T00:00:00") - hoy) / 864e5);
  return `<div class=card><h3>Contratos del personal</h3>${tbl(
    ["Código", "Nombres", "Tipo", "Inicio", "Fin", "Situación", "Sueldo fijo", "Tarifa/h", "Jornada", ""],
    S.personal.map((p) => {
      const k = p.ff ? dd(p.ff) : null,
        st = k === null ? ["ok", "Indefinido"] : k < 0 ? ["no", "Vencido"] : k <= 30 ? ["no", `Vence en ${k} d`] : ["ok", "Vigente"];
      return `<tr><td>${esc(p.id)}</td><td>${esc(p.nom)}</td><td>${esc(p.tc || "-")}</td><td>${esc(p.fi || "-")}</td><td>${esc(p.ff || "-")}</td><td><span class="b ${st[0]}">${st[1]}</span></td><td>${money(p.sf)}</td><td>${money(p.precio)}</td><td>${esc(p.jor || "-")}</td><td><button class="s g act" data-f=perEd data-i="${esc(p.id)}" title="Modificar" aria-label="Modificar">${iac("edit")}</button></td></tr>`;
    }),
  )}</div>`;
}
function perPay() {
  let tp = 0,
    tf = 0;
  const rows = S.personal.map((p) => {
    const h = hsem(p),
      pg = h * p.precio;
    tp += pg;
    tf += +p.sf || 0;
    return `<tr><td>${esc(p.id)}</td><td>${esc(p.nom)}</td><td>${esc(p.rol)}</td><td>${money(p.precio)}</td><td>${h.toFixed(1)}</td><td>${money(pg)}</td><td>${money(p.sf)}</td></tr>`;
  });
  return `<div class=card><h3>Pagos y liquidaciones de la semana</h3>${tbl(
    ["Código", "Nombres", "Rol", "S/ hora", "Horas semana", "Pago semana (horas)", "Sueldo fijo (mensual)"],
    rows,
  )}<p><b>Total pago por horas de la semana: ${money(tp)} · Sueldos fijos mensuales: ${money(tf)}</b></p><p class=mu>El Dashboard Gerencial sigue calculando la planilla como horas asistidas × tarifa; el sueldo fijo se muestra aquí como referencia.</p></div>`;
}
const togP = (id) => {
  const p = S.personal.find((x) => x.id === id);
  if (!p) return;
  if (p === U) return toast("No puedes desactivarte");
  p.activo = p.activo ? 0 : 1;
  save();
  R();
};
