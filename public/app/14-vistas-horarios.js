/* [ERP 14/18] 14-vistas-horarios.js — Vistas: Horarios, categorías y resto de módulos. Código sin cambios respecto a script.js (líneas 2823-3632). */
/* ==================================================================
   HORARIOS Y CATEGORÍAS (calendario semanal, un horario por día y categoría)
   ================================================================== */
const QA_PAGOS_BUILD = "qa-pagos-v4-caja-auditoria-20261125";
const tmin = (x) => +x.slice(0, 2) * 60 + +x.slice(3, 5),
  solapa = (a, b) => tmin(a.ini) < tmin(b.fin) && tmin(b.ini) < tmin(a.fin),
  mismaSes = (a, b) => a.sede === b.sede && a.dep === b.dep && a.ini === b.ini && a.fin === b.fin;
/* Devuelve un mensaje si el horario n choca con otro activo; "" si no hay cruce */
function choque(n, ps, skipId) {
  for (const h of S.hor) {
    if (h.id === skipId || h.est === "Inactivo" || +h.dia !== +n.dia || !solapa(n, h)) continue;
    if (h.sede === n.sede && +h.cat === +n.cat)
      return `CAT-${n.cat} ya tiene horario ese día en ${sn(n.sede)} (${h.id}, ${h.ini}-${h.fin})`;
    if (mismaSes(n, h)) continue;
    const p = ps.find((x) => h.profs.includes(x));
    if (p) return `${nomP(p)} ya dicta ${h.id} (${sn(h.sede)}, ${DIAL[h.dia]} ${h.ini}-${h.fin})`;
  }
  return "";
}
function horCal() {
  const L = S.hor.filter((h) => !HFS || h.sede === HFS);
  return `<div class=tw><div class=cal>${[1, 2, 3, 4, 5, 6, 7]
    .map(
      (d) =>
        `<div class=cald><b>${DIAL[d]}</b>${
          L.filter((h) => +h.dia === d)
            .sort((a, b) => tmin(a.ini) - tmin(b.ini))
            .map(
              (h) =>
                `<div class="calb${h.est === "Inactivo" ? " off" : ""}"><b>${esc(h.ini)}-${esc(h.fin)}</b><span>${esc(sn(h.sede))} · ${esc(dn(h.dep))} CAT-${esc(h.cat)}</span><small>${esc(h.profs.map(nomP).join(", ") || "Sin profesor")}</small></div>`,
            )
            .join("") || "<span class=mu>-</span>"
        }</div>`,
    )
    .join("")}</div></div>`;
}
VW.horarios = () => {
  const sd = S.hor.filter((h) => !(+h.dia >= 1 && +h.dia <= 7));
  return `<div class=card><h3>Categorías ${Y}</h3><div class=row>${cats()
    .map((c) => `<span class="b ok">CAT-${c}</span>`)
    .join(
      "",
    )}</div></div><div class=card><h3>Nuevo deporte</h3><div class=row>${'<input id=d_n placeholder="Nombre">'}<input id=d_c maxlength=3 placeholder="Código (3 letras)"><button data-f=addDep>Agregar deporte</button></div><p class=mu>${S.deportes.map((d) => d.id + " " + d.nombre).join(" · ")}</p></div><div class=card><h3>Nuevo horario</h3><div class=fg>${fl("Sede", "<select id=h_s>" + o(S.sedes.filter((s) => sedEst(s) === "Activa").map((s) => [s.id, s.nombre])) + "</select>")}${fl("Deporte", "<select id=h_d>" + o(S.deportes.map((s) => [s.id, s.nombre])) + "</select>")}${fl("Inicio", "<input id=h_i type=time value=16:00>")}${fl("Fin", "<input id=h_f type=time value=18:00>")}<div class="fgrp u-col-full" role="group" aria-labelledby=h_cl><span class=fgrp-l id=h_cl>Categorías</span><div class="chk-grid" id=h_c>${cats().map((c) => `<label class=chk><input type=checkbox value=${c}><span>CAT-${c} (${Y - c} años)</span></label>`).join("")}</div></div><div class="fgrp u-col-full" role="group" aria-labelledby=h_pl><span class=fgrp-l id=h_pl>Profesores</span><div class="chk-grid" id=h_p>${S.personal.filter((p) => p.rol === "ENT" && p.activo).map((p) => `<label class=chk><input type=checkbox value="${esc(p.id)}"><span>${esc(p.nom)}</span></label>`).join("") || "<span class=mu>No hay profesores activos. Regístralos en Personal y Planillas.</span>"}</div></div>
</div><div class="fgrp u-m-8-0-0" role="group" aria-labelledby=h_dl><span class=fgrp-l id=h_dl>Días de la semana</span><div class=dias>${[1, 2, 3, 4, 5, 6, 7].map((d) => `<label class=chk><input type=checkbox class=h_dia value=${d}><span>${DIAS[d]}</span></label>`).join("")}</div></div><p class=mu>Se crea un horario por cada día y categoría elegidos. Se bloquean los cruces de profesores y de categorías.</p><div class=row><button data-f=addHor>Guardar horario</button></div></div><div class=card><div class=row><h3 class="u-m-0 u-flex-1">Calendario semanal</h3><select data-ch=horSede aria-label="Filtrar por sede">${o(S.sedes.map((s) => [s.id, s.nombre]), HFS, "Todas las sedes")}</select></div>${horCal()}</div>${
    sd.length
      ? `<div class=card><h3>Horarios sin día asignado</h3><p class=mu>Estos horarios son anteriores al calendario. Elige el día para incluirlos.</p>${tbl(
          ["Código", "Sede", "Deporte", "Categoría", "Horario", "Día"],
          sd.map(
            (h) =>
              `<tr><td>${esc(h.id)}</td><td>${esc(sn(h.sede))}</td><td>${esc(dn(h.dep))}</td><td>CAT-${esc(h.cat)}</td><td>${esc(h.ini)}-${esc(h.fin)}</td><td><select data-ch=horDia data-id="${esc(h.id)}">${o(DIAL.slice(1).map((x, i) => [i + 1, x]), "", "Elegir...")}</select></td></tr>`,
          ),
        )}</div>`
      : ""
  }<div class=card>${tbl(
    ["Código", "Día", "Sede", "Deporte", "Categoría", "Horario", "Profesores", "Estado", ""],
    [...S.hor]
      .sort((a, b) => (+a.dia || 9) - (+b.dia || 9) || tmin(a.ini) - tmin(b.ini))
      .map((h) => {
        const on = h.est !== "Inactivo",
          id = esc(h.id);
        return `<tr><td>${id}</td><td>${esc(DIAS[h.dia] || "-")}</td><td>${esc(sn(h.sede))}</td><td>${esc(dn(h.dep))}</td><td>CAT-${esc(h.cat)}</td><td>${esc(h.ini)}-${esc(h.fin)}</td><td>${esc(h.profs.map(nomP).join(", "))}</td><td><span class="b ${on ? "ok" : "no"}">${on ? "Activo" : "Inactivo"}</span></td><td><button class="s act ${on ? "ban" : "g"}" data-f=horEst data-i="${id}" title="${on ? "Desactivar" : "Activar"}" aria-label="${on ? "Desactivar" : "Activar"}">${on ? iac("block") : iac("check")}</button> <button class="s r act" data-f=delHor data-i="${id}" title="Quitar" aria-label="Quitar">${iac("trash")}</button></td></tr>`;
      }),
  )}<div class=row><button class=g data-f=cp data-i=hor>Copiar para Excel</button></div></div>`;
};
function addDep() {
  const c = v("d_c").toUpperCase(),
    n = limpiar(v("d_n"), 40);
  if (!n || !/^[A-Z]{3}$/.test(c)) return toast("Nombre y código de 3 letras");
  if (S.deportes.some((d) => d.id === "DEP-" + c)) return toast("Código repetido");
  S.deportes.push({ id: "DEP-" + c, nombre: n });
  save();
  R();
}
function addHor() {
  const ps = [...document.querySelectorAll("#h_p input:checked")].map((x) => x.value),
    cs = [...document.querySelectorAll("#h_c input:checked")].map((x) => +x.value),
    ds = [...document.querySelectorAll(".h_dia:checked")].map((x) => +x.value),
    n = { sede: v("h_s"), dep: v("h_d"), ini: v("h_i"), fin: v("h_f") };
  if (!S.sedes.some((s) => s.id === n.sede && sedEst(s) === "Activa")) return toast("Elige una sede activa");
  if (!S.deportes.some((d) => d.id === n.dep)) return toast("Elige un deporte");
  if (!cs.length || !cs.every(catOk)) return toast("Elige al menos una categoría");
  if (!ds.length) return toast("Elige al menos un día");
  if (!n.ini || !n.fin || n.ini >= n.fin) return toast("La hora de fin debe ser posterior");
  if (!ps.length) return toast("Asigna al menos un profesor");
  for (const p of ps) {
    const pe = S.personal.find((x) => x.id === p);
    if (!pe) return toast("Profesor inválido");
    if (!S.psedes.some((x) => x.pid === p && x.sede === n.sede))
      return toast(`${pe.nom} no está asignado a la sede seleccionada`);
    if (!pe.mv && S.hor.some((h) => h.est !== "Inactivo" && h.profs.includes(p) && h.sede !== n.sede))
      return toast(`${pe.nom} no tiene permitido dictar en varias sedes`);
  }
  const nuevos = [];
  for (const d of ds)
    for (const c of cs) {
      const h = { ...n, cat: c, dia: d },
        m = choque(h, ps);
      if (m) return toast(`${DIAL[d]}: ${m}`);
      nuevos.push(h);
    }
  nuevos.forEach((h) => S.hor.push({ id: "HOR-" + nx("HOR", 4), ...h, est: "Activo", profs: [...ps] }));
  save(nuevos.length === 1 ? "Horario guardado" : `${nuevos.length} horarios guardados`);
  R();
}
const horEst = (id) => {
  const h = S.hor.find((x) => x.id === id);
  if (!h) return;
  if (h.est !== "Inactivo") {
    h.est = "Inactivo";
  } else {
    const m = +h.dia ? choque(h, h.profs, h.id) : "";
    if (m) return toast(m);
    h.est = "Activo";
  }
  save();
  R();
};
function horDia(el) {
  const h = S.hor.find((x) => x.id === el.dataset.id),
    d = +el.value;
  if (!h || !(d >= 1 && d <= 7)) return;
  const m = choque({ ...h, dia: d }, h.profs, h.id);
  if (m) {
    toast(`${DIAL[d]}: ${m}`);
    return R();
  }
  h.dia = d;
  save();
  R();
}
const delHor = (id) => {
  if (S.alu.some((a) => a.hor === id)) return toast("Hay alumnos en este horario; reasígnalos primero");
  S.hor = S.hor.filter((h) => h.id !== id);
  save();
  R();
};

/* Acciones nuevas de la parte 2 (se mezclan en FN, ON_INPUT y ON_CHANGE) */
const NEW_FN = {
  sedTab: (i) => {
    SEDT = i;
    ES = EC = EK = null;
    R();
  },
  sedCtr: (i) => {
    SEDT = "c";
    EC = EK = null;
    ES = i;
    R();
  },
  sedTog: (i) => sedTog(i),
  addCtr: () => addCtr(),
  ctrEd: (i) => {
    EC = i;
    SEDT = "c";
    R();
  },
  cancelCtr: () => {
    EC = null;
    R();
  },
  delCtr: (i) => delCtr(i),
  addCc: () => addCc(),
  ccEd: (i) => {
    EK = i;
    R();
  },
  cancelCc: () => {
    EK = null;
    R();
  },
  delCc: (i) => delCc(i),
  ccAuto: () => ccAuto(),
  perTab: (i) => {
    PERT = i;
    EP = null;
    PFOTO = "";
    R();
  },
  perSedAdd: () => perSedAdd(),
  perSedDel: (i) => perSedDel(i),
  perCerAdd: () => perCerAdd(),
  perCerDel: (i) => perCerDel(i),
  horEst: (i) => horEst(i),
};
const NEW_IN = {
  sedQ: (el) => {
    SQ = el.value;
    $("#sed_t").innerHTML = sedTbl();
  },
  perQ: (el) => {
    PQ = el.value;
    $("#per_t").innerHTML = perTbl();
  },
};
const NEW_CH = {
  perFoto: (el) => perFotoSel(el),
  horSede: (el) => {
    HFS = el.value;
    R();
  },
  horDia: (el) => horDia(el),
};
VW.mat = () => {
  const a = ED
    ? S.alu.find((x) => x.id === ED)
    : PRE
      ? preAlu(PRE)
      : {
          est: "Activo",
          con: "Ninguna",
          mod: "Formativo",
          sex: "M",
          cm: 0,
          cmen: 0,
          mes: 1,
          pag: 0,
          sede: S.sedes[0].id,
          dep: S.deportes[0].id,
        };
  const r = (k, x, t = "text", e = "") =>
    `<input id=m_${k} type=${t} value="${esc(x)}" data-r=1 class="${x ? "" : "bad"}" data-in=ck ${e}>`;
  adjInit(a);
  return `<div class=card><h3>${ED ? "Ficha " + esc(ED) : PRE ? "Matrícula desde pre-registro (" + esc(PRE.modalidad) + ")" : "Nueva matrícula"} <span class=mu>· fecha ${esc(a.fecha || today())}</span></h3><p class=mu>Puedes guardar con datos pendientes: los campos en rojo se completan después.</p><div class=msec><h4 class=bh><span class=mnum>1</span>Datos del alumno</h4><div class=mtop><div class=mleft><div class="fg mfields">${fl("Nombres", `<input id=m_nom value="${esc(a.nom || "")}">`)}${fl("Apellidos", `<input id=m_ape value="${esc(a.ape || "")}">`)}${fl("DNI", r("dni", a.dni || "", "text", "maxlength=8 inputmode=numeric data-d=1"))}${fl("Sexo", "<select id=m_sex>" + o([["M", "Masculino"], ["F", "Femenino"]], a.sex) + "</select>")}${fl("Fecha de nacimiento", `<input id=m_nac type=date value="${esc(a.nac || "")}" data-ch=upHor>`)}${fl("Categoría y edad", '<b id=m_cat class="u-py-8">-</b>')}${fl("Seguro médico", r("seg", a.seg || ""))}</div><label class="chk"><input type=checkbox id=m_cons ${a.cons ? "checked" : ""}><span>Consentimiento de protección de datos personales (Ley N° 29733)</span></label></div><div class=mfoto><span class=mfoto-l>Foto del alumno</span><button type=button class="foto-box" id=foto_box data-f=adjFoto aria-label="Elegir foto del alumno">${fotoBox()}</button></div></div></div><div class=msec><h4 class=bh><span class=mnum>2</span>Apoderado y contacto</h4><div class=fg>${fl("Apoderado", r("an", a.an || ""))}${fl("Celular", r("ac", a.ac || "", "text", "maxlength=9 inputmode=numeric data-d=1"))}${fl("Correo", r("am", a.am || "", "email"))}</div></div><div class=mcols><div class=msec><h4 class=bh><span class=mnum>3</span>Inscripción, sede y horario</h4><div class=fg>${fl("Deporte", "<select id=m_dep data-ch=upHor>" + o(S.deportes.map((d) => [d.id, d.nombre]), a.dep) + "</select>")}${fl("Sede", "<select id=m_sed data-ch=upHor>" + o(S.sedes.map((d) => [d.id, d.nombre]), a.sede) + "</select>")}${fl("Horario", "<select id=m_hor></select>")}${fl("Condición", "<select id=m_con>" + o(["Ninguna", "Media Beca", "Becado"].map((x) => [x, x]), a.con) + "</select>")}${fl("Modalidad", "<select id=m_mod>" + o(["Formativo", "Competitivo"].map((x) => [x, x]), a.mod) + "</select>")}${fl("Estado", "<select id=m_est>" + o(["Activo", "Inactivo"].map((x) => [x, x]), a.est) + "</select>")}</div></div><div class=msec><h4 class=bh><span class=mnum>4</span>Facturación y cronograma de cuotas</h4><div class=bill><div class=fg>${fl("Costo matrícula (S/)", `<input id=m_cm data-in=cron type=number min=0 value="${esc(a.cm)}">`)}${fl("Costo mensualidad (S/)", `<input id=m_cmen data-in=cron type=number min=0 value="${esc(a.cmen)}">`)}${fl("Plan / Meses contratados", `<input id=m_mes data-in=cron type=number min=0 value="${esc(a.mes)}">`)}${fl("Monto pagado (S/)", `<input id=m_pag data-in=cron type=number min=0 value="${esc(a.pag)}">`)}${fl("Monto a pagar hoy (S/)", `<input id=m_hoy type=number min=0 data-in=cron value="${esc(a.hoy ?? 0)}">`)}${fl("Método de pago", "<select id=m_mp>" + o([["Efectivo", "Efectivo"], ["Transferencia", "Transferencia"], ["Yape/Plin", "Yape/Plin"]], a.mp || "Efectivo") + "</select>")}</div><div class="cron"><b>Cronograma de cuotas generado automáticamente</b><div id=cron_t></div></div></div></div></div><div class=row id=ad_r>${adjBoton()}</div><div class=row><button data-f=matPay>Guardar matrícula</button><button class=g data-f=limpiarMat>Limpiar formulario</button><button class=g data-f=carnetMat>Generar carnet</button><button class=g data-f=qrPadres>QR para padres</button><button class=g data-f=go data-i=dir>Cancelar</button></div></div>`;
};

function upHor() {
  const y = +v("m_nac").slice(0, 4),
    c = $("#m_cat");
  if (!c) return;
  c.textContent = y
    ? catOk(y)
      ? "CAT-" + y + " · " + age(v("m_nac")) + " años"
      : "Fuera de rango (5 a 17 años)"
    : "-";
  c.classList.toggle("u-neg", !!(y && !catOk(y)));
  const cur = ED ? (S.alu.find((x) => x.id === ED) || {}).hor : "";
  const hs = S.hor.filter(
    (h) => h.est !== "Inactivo" && h.sede === v("m_sed") && h.dep === v("m_dep") && (!y || h.cat === y),
  );
  $("#m_hor").innerHTML = o(
    hs.map((h) => [h.id, `${DIAS[h.dia] ? DIAS[h.dia] + " " : ""}${esc(h.cat)} · ${esc(h.ini)}-${esc(h.fin)}`]),
    v("m_hor") || cur,
    "Sin horario aún",
  );
}
/* Asigna el tramo de un abono nuevo a matrícula y cuotas, conservando el detalle
   dentro del movimiento de caja para que sobreviva a la sincronización con Supabase. */
function distribuirAbonoMatricula(cm, cmen, meses, desde, hasta) {
  const cent = (n) => Math.round((Math.max(0, +n || 0) + Number.EPSILON) * 100) / 100;
  let inicio = cent(desde), fin = cent(hasta);
  if (fin <= inicio) return [];
  const tramos = [],
    matricula = cent(cm),
    mensualidad = cent(cmen),
    totalMeses = Math.min(36, Math.max(0, parseInt(meses) || 0));
  if (matricula > 0) tramos.push({ destino: "Matrícula", cuota: 0, inicio: 0, fin: matricula });
  for (let n = 1; n <= totalMeses && mensualidad > 0; n++) {
    const a = matricula + (n - 1) * mensualidad;
    tramos.push({ destino: "Cuota", cuota: n, inicio: a, fin: a + mensualidad });
  }
  return tramos.map((t) => ({
    destino: t.destino,
    cuota: t.cuota,
    monto: cent(Math.max(0, Math.min(fin, t.fin) - Math.max(inicio, t.inicio))),
  })).filter((x) => x.monto > 0.009);
}

async function saveAlu() {
  const { d, e } = validarAlumno({
      nom: v("m_nom"),
      ape: v("m_ape"),
      dni: v("m_dni"),
      ac: v("m_ac"),
      am: v("m_am"),
      an: v("m_an"),
      seg: v("m_seg"),
      nac: v("m_nac"),
      sex: v("m_sex"),
      mod: v("m_mod"),
      con: v("m_con"),
      est: v("m_est"),
      cm: v("m_cm") || 0,
      cmen: v("m_cmen") || 0,
      pag: v("m_pag") || 0,
    }),
    y = +d.nac.slice(0, 4);
  if (!e.length && !catOk(y))
    e.push(`Fecha de nacimiento fuera del rango: solo nacidos entre ${Y - 17} y ${Y - 5}`);
  if (!S.sedes.some((s) => s.id === v("m_sed")) || !S.deportes.some((x) => x.id === v("m_dep")))
    e.push("Sede o deporte inválido");
  if (e.length) return toast(e[0]);
  const old = ED ? S.alu.find((x) => x.id === ED) : null,
    horarioId = v("m_hor"),
    hh = horarioId ? S.hor.find((h) => h.id === horarioId) : null;
  if (
    horarioId &&
    (!hh ||
      hh.est === "Inactivo" ||
      hh.sede !== v("m_sed") ||
      hh.dep !== v("m_dep") ||
      +hh.cat !== y)
  )
    return toast("El horario seleccionado no corresponde a la sede, deporte y categoría del alumno, o está inactivo.");
  Object.assign(d, {
    dep: v("m_dep"),
    sede: v("m_sed"),
    hor: hh ? hh.id : "",
    foto: IMG_OK.test(DW.foto || "") ? DW.foto : "",
    mes: Math.min(36, Math.max(0, parseInt(v("m_mes")) || 0)),
    cons: !!($("#m_cons") && $("#m_cons").checked),
    mp: ["Efectivo", "Transferencia", "Yape/Plin"].includes(v("m_mp")) ? v("m_mp") : "Efectivo",
    hoy: monto(v("m_hoy") || 0) ?? 0,
  });
  const totalContrato = Math.round(((+d.cm || 0) + (+d.cmen || 0) * (+d.mes || 0)) * 100) / 100;
  if ((+d.pag || 0) > totalContrato + 0.009)
    return toast("El monto pagado no puede superar el total de matrícula y mensualidades contratadas.");
  if (d.dni && S.alu.some((x) => x.dni === d.dni && x.id !== ED))
    return toast("Ese DNI ya está registrado");
  let id = old ? old.id : "";
  if (!old) {
    const qaId = window.__ERP_QA_NEXT_ALUMNO_ID__;
    const qaOverride =
      SB === "https://yiredilknlwbzwvwlqyx.supabase.co" &&
      U?.rol === "ADM" &&
      /^QA-MAT-[0-9]{8}$/.test(String(qaId || "")) &&
      !S.alu.some((a) => a.id === qaId);
    if (qaOverride) {
      id = nid();
    } else {
      const anio = Number(String(Y).slice(-2));
      try {
        const reserva = await sb("/rest/v1/rpc/siguiente_id_matricula", {
          method: "POST",
          body: JSON.stringify({ p_anio: anio }),
        });
        if (!reserva.ok) {
          console.error("No se pudo reservar el código de matrícula:", await reserva.text());
          return toast("No se pudo reservar un código de matrícula. No se guardó ningún cambio.");
        }
        id = await reserva.json();
        const prefijo = String(anio).padStart(2, "0");
        if (typeof id !== "string" || !new RegExp("^" + prefijo + "[0-9]{4}$").test(id) ||
            S.alu.some((a) => a.id === id)) {
          return toast("Supabase devolvió un código de matrícula inválido o repetido. No se guardó ningún cambio.");
        }
      } catch (error) {
        console.error("Error reservando código de matrícula:", error);
        return toast("No se pudo reservar un código de matrícula por un problema de conexión.");
      }
    }
  }
  const pagadoAnterior = old ? Math.max(0, +old.pag || 0) : 0,
    delta = Math.round((d.pag - pagadoAnterior) * 100) / 100,
    dc = { qt: old && old.qt ? old.qt : tok() };
  if (delta < 0) {
    const reversas = calcularReversionesCaja(S.caja, id, -delta);
    const disponible = reversas.reduce((s, x) => s + x.monto, 0);
    if (Math.abs(disponible - -delta) > 0.009)
      return toast("No se puede reducir el pago: los ingresos originales disponibles en caja no cubren la reversión.");
  }
  try {
    await adjCommit(id);
  } catch (e) {
    return toast("No se pudo subir un archivo (solo JPG, PNG o PDF de hasta 5 MB)");
  }
  Object.assign(d, { foto: DW.foto, dnf: DW.dnf, dsg: DW.dsg, dfm: DW.dfm });
  Object.assign(d, dc);
  if (old) Object.assign(old, d);
  else S.alu.push({ id, fecha: today(), ...d });
  regenCuotas(
    id,
    S.alu.find((x) => x.id === id),
  );
  if (delta > 0) {
    S.caja.push({
      _id: uid(),
      f: today(),
      sede: d.sede,
      t: "I",
      c: "Matrícula / mensualidad",
      d: id,
      m: delta,
      // La aplicación por concepto/cuota queda ligada al ingreso original.
      k: "matricula:" + id + "|aplicacion:" + encodeURIComponent(JSON.stringify(
        distribuirAbonoMatricula(d.cm, d.cmen, d.mes, pagadoAnterior, d.pag),
      )),
    });
  } else if (delta < 0) {
    calcularReversionesCaja(S.caja, id, -delta).forEach((x) => {
      S.caja.push({
        _id: uid(),
        f: today(),
        sede: d.sede,
        t: "E",
        c: "Reversión de pago de matrícula",
        d: id,
        m: x.monto,
        k: "reversion:" + x.originalId,
      });
    });
  }
  save();
  const pf = falta(d);
  if (PREID) {
    const pid = PREID;
    PREID = PRE = null;
    sv.then(() => {
      if (!SAVE_OK) return; // el alumno no llegó a la BD: el pre-registro (datos + archivos) se conserva
      return sb("/rest/v1/preregistros?id=eq." + encodeURIComponent(pid), { method: "DELETE" }).then(() => {
        if (PR) PR = PR.filter((x) => x.id !== pid);
        PRN = PR ? PR.length : PRN;
      });
    }).catch(() => {});
  }
  sv.then(() => {
    if (!SAVE_OK) return;
    adjLimpiar(id);
    if (!old || FRESH === id) {
      FRESH = id;
      ED = id;
      R();
      toast(pf.length
        ? "Matrícula guardada con datos pendientes: " + pf.join(", ")
        : "Matrícula guardada. Ya puedes generar el carnet.");
    } else {
      go("dir");
      toast(pf.length
        ? "Matrícula actualizada con datos pendientes: " + pf.join(", ")
        : "Matrícula actualizada");
    }
  });
}
const addMes = (f, n) => {
  const [y, m, d] = f.split("-").map(Number),
    x = new Date(Date.UTC(y, m - 1 + n, 1)),
    ult = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(d, ult));
  return x.toISOString().slice(0, 10);
};
/* Distribuye el pago primero a matrícula y luego a cuotas en orden cronológico. */
function cronograma(a) {
  const n = Math.min(36, Math.max(0, parseInt(a.mes) || 0)),
    m = Math.max(0, Math.round((+a.cmen || 0) * 100) / 100),
    matricula = Math.max(0, Math.round((+a.cm || 0) * 100) / 100),
    base = a.fecha || today(),
    r = [];
  let resto = Math.max(0, Math.round((+a.pag || 0) * 100) / 100),
    pagadoMatricula = Math.min(matricula, resto);
  resto = Math.round((resto - pagadoMatricula) * 100) / 100;
  for (let i = 1; i <= n; i++) {
    const abonado = Math.min(m, resto),
      saldo = Math.round((m - abonado) * 100) / 100,
      e = saldo <= 0.009 ? "Pagada" : abonado > 0 ? "Parcial" : "Pendiente";
    resto = Math.round((resto - abonado) * 100) / 100;
    r.push({ n: i, f: addMes(base, i), m, a: abonado, s: saldo, e });
  }
  return { cuotas: r, matricula: { m: matricula, a: pagadoMatricula, s: Math.round((matricula - pagadoMatricula) * 100) / 100 } };
}
function regenCuotas(id, a) {
  const plan = cronograma(a).cuotas;
  for (const c of plan) {
    const existente = S.cuotas.find((x) => x.aid === id && +x.n === c.n);
    if (existente) Object.assign(existente, c, { e: c.e });
    else S.cuotas.push({ id: `CUO-${id}-${c.n}`, aid: id, ...c });
  }
  // No se eliminan cuotas históricas si se reduce el número de meses contratado.
  S.cuotas.filter((x) => x.aid === id && !plan.some((c) => c.n === +x.n)).forEach((x) => {
    x.e = "Anulada";
  });
}
/* Calcula cuánto puede revertirse de cada ingreso, sin alterar ni borrar movimientos previos. */
function calcularReversionesCaja(caja, alumnoId, importe) {
  let pendiente = Math.round(Math.max(0, importe) * 100) / 100;
  const ingresos = caja.filter((x) => x.d === alumnoId && x.t === "I" &&
    (x.c === "Matrícula / mensualidad" || (typeof x.k === "string" && x.k.startsWith("matricula:" + alumnoId + "|"))));
  const resultado = [];
  // Revertir primero el ingreso más reciente, sin modificar los movimientos originales.
  for (const ingreso of ingresos.slice().reverse()) {
    // Los movimientos persistidos reciben _id desde la capa de datos. No inventar
    // identificadores aquí: esta función también se usa para prevalidar el ajuste.
    const originalId = ingreso._id;
    if (!originalId) continue;
    const revertido = caja.filter((x) => x.t === "E" && x.k === "reversion:" + originalId)
      .reduce((s, x) => s + (+x.m || 0), 0);
    const disponible = Math.max(0, Math.round(((+ingreso.m || 0) - revertido) * 100) / 100);
    const monto = Math.min(disponible, pendiente);
    if (monto > 0.009) {
      resultado.push({ originalId, monto: Math.round(monto * 100) / 100 });
      pendiente = Math.round((pendiente - monto) * 100) / 100;
    }
    if (pendiente <= 0.009) break;
  }
  // Si no alcanza el saldo original, devolver solo lo realmente reversible.
  // saveAlu compara la suma con el importe solicitado y bloquea el guardado.
  return resultado;
}
function cronRender() {
  const t = $("#cron_t");
  if (!t) return;
  const old = ED ? S.alu.find((x) => x.id === ED) : null,
    a = {
      fecha: (old && old.fecha) || today(),
      cm: v("m_cm"),
      cmen: v("m_cmen"),
      mes: v("m_mes"),
      pag: v("m_pag"),
    },
    plan = cronograma(a),
    c = plan.cuotas,
    tot = plan.matricula.m + c.reduce((s, x) => s + x.m, 0),
    hoy = today();
  t.innerHTML =
    tbl(
      ["Cuota #", "Fecha venc.", "Importe S/", "Abonado S/", "Saldo S/", "Estado"],
      c.map((x) => {
        const venc = x.e !== "Pagada" && x.f < hoy;
        return `<tr><td>${x.n}</td><td>${esc(x.f)}</td><td>${money(x.m)}</td><td>${money(x.a)}</td><td>${money(x.s)}</td><td><span class="b ${x.e === "Pagada" ? "ok" : x.e === "Parcial" ? "wa" : "no"}">${venc && x.e !== "Parcial" ? "Vencida" : x.e}</span></td></tr>`;
      }),
    ) + `<p><b>Matrícula: ${money(plan.matricula.m)}</b> · Abonado: ${money(plan.matricula.a)} · Saldo: ${money(plan.matricula.s)}</p><p><b>Monto total proyectado: ${money(tot)}</b> <span class=mu>(matrícula + cuotas)</span></p>`;
}
/* "Monto a pagar hoy" y "Monto pagado" se mantienen coherentes; el flujo de caja sigue usando Monto pagado. */
function cronSync(el) {
  const old = ED ? (S.alu.find((x) => x.id === ED) || {}).pag || 0 : 0,
    r2 = (n) => Math.round(n * 100) / 100;
  if (el.id === "m_hoy" && $("#m_pag")) $("#m_pag").value = r2(old + (+el.value || 0));
  else if (el.id === "m_pag" && $("#m_hoy")) $("#m_hoy").value = Math.max(0, r2((+el.value || 0) - old));
  cronRender();
}
const fotoBox = () =>
  DW && DW.foto && IMG_OK.test(DW.foto)
    ? `<img src="${esc(DW.foto)}" alt="Foto del alumno"><span class="foto-cambiar">Cambiar foto</span>`
    : `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>Elegir foto...</span>`;
function carnet(id) {
  const a = S.alu.find((x) => x.id === id);
  if (!a) return;
  // Esperar a que Supabase confirme el qr_token antes de mostrar/imprimir el QR.
  carnetUrl(a);
  sv.then(() => {
    if (!SAVE_OK) {
      toast("No se pudo guardar el código QR. Inténtalo de nuevo antes de imprimir.");
      return;
    }
    modal(
      `<h3>${esc(a.nom + " " + a.ape)}</h3>${IMG_OK.test(a.foto || "") ? `<img src="${esc(a.foto)}" width=90 height=90 class="u-rounded-6">` : "<p class=mu>Sin foto</p>"}<p><b>${esc(a.id)}</b><br>${esc(dn(a.dep))} · CAT-${esc(a.nac.slice(0, 4))} · ${esc(sn(a.sede))}</p>${qr(carnetUrl(a))}<div class="row u-jc-center"><button data-f=print>Imprimir (PVC / papel)</button></div>`,
    );
  }).catch((e) => {
    console.error("No se pudo confirmar el código QR:", e);
    toast("No se pudo guardar el código QR. Inténtalo de nuevo.");
  });
}
const ed = (id) => {
  V = "mat";
  ED = id;
  R();
};
const dirL = () => {
  const q = (DF.q || "").toLowerCase().trim();
  return S.alu.filter(
    (a) =>
      (!DF.s || a.sede === DF.s) &&
      (!DF.d || a.dep === DF.d) &&
      (!DF.c || a.nac.slice(0, 4) === DF.c) &&
      (!DF.e || (DF.e === "Incompleto" ? falta(a).length : a.est === DF.e)) &&
      (!DF.p || (DF.p === "Moroso") === deuda(a) > 0) &&
      (!q ||
        (String(a.nom || "") + " " + String(a.ape || "")).toLowerCase().includes(q) ||
        String(a.dni || "").includes(q) ||
        String(a.id || "").includes(q)),
  );
};
const dirT = () =>
  tbl(
    ["Código", "Alumno", "DNI", "Sede", "Deporte", "Cat.", "Edad", "Estado", "Datos", "Pago", ""],
    dirL().map((a) => {
      const f = falta(a),
        dd = deuda(a);
      return `<tr class="${f.length ? "inc" : ""}"><td>${esc(a.id)}</td><td>${esc(a.nom + " " + a.ape)}</td><td>${a.dni ? esc(a.dni) : "<b class=u-neg>falta</b>"}</td><td>${esc(sn(a.sede))}</td><td>${esc(dn(a.dep))}</td><td>${esc(a.nac.slice(0, 4))}</td><td>${age(a.nac)}</td><td>${esc(a.est)}</td><td>${f.length ? `<span class="b no">Falta: ${f.join(", ")}</span>` : '<span class="b ok">Completa</span>'}</td><td><span class="b ${dd > 0 ? "no" : "ok"}">${dd > 0 ? "Moroso " + money(dd) : "Al día"}</span></td><td><button class="s" data-f="ed" data-i="${esc(a.id)}">Abrir</button></td></tr>`;
    }),
  );
VW.dir = () => {
  const sel = (k, l, a) =>
    fl(l, `<select data-ch=dfSet data-i=${k}>${o(a, DF[k], "Todos")}</select>`);
  return `<div class=card><div class=fg>${fl("Buscar por nombre, DNI o código", `<input id=q placeholder="Ej. Luis, 71234567 o 260001" value="${esc(DF.q || "")}" data-in=dirQ>`)}${sel(
    "s",
    "Sede",
    S.sedes.map((s) => [s.id, s.nombre]),
  )}${sel(
    "d",
    "Deporte",
    S.deportes.map((s) => [s.id, s.nombre]),
  )}${sel(
    "c",
    "Categoría",
    cats().map((c) => [c, "CAT-" + c]),
  )}${sel(
    "e",
    "Estado",
    ["Activo", "Inactivo", "Incompleto"].map((x) => [x, x]),
  )}${sel(
    "p",
    "Pago",
    ["Al día", "Moroso"].map((x) => [x, x]),
  )}</div><div class=row><button data-f=go data-i=mat>+ Nueva matrícula</button><button class=g data-f=clearDF>Limpiar filtros</button></div></div><div class=card><div id=dt>${dirT()}</div><div class=row><button class=g data-f=cp data-i=dir>Copiar para Excel</button></div></div>`;
};
VW.asis = () => {
  const hs = S.hor.filter((h) => U.rol !== "ENT" || h.profs.includes(U.id)),
    ss = [...new Set(hs.map((h) => h.sede))],
    g = hs.filter((h) => h.sede === AS.s),
    gk = [
      ...new Map(
        g.map((h) => [h.dep + "|" + h.cat, [h.dep + "|" + h.cat, dn(h.dep) + " " + h.cat]]),
      ).values(),
    ],
    hh = g.filter((h) => h.dep + "|" + h.cat === AS.g),
    H = hh.find((h) => h.id === AS.h),
    rec = (t, r) =>
      S.asis.find((x) => x.f === today() && x.t === t && x.ref === r && x.h === AS.h) || {};
  const row = (t, r, n) => {
    const c = rec(t, r);
    return `<tr><td>${n}</td><td><button class="s ${c.ok === true ? "" : "g"}" data-f="mkA" data-i="${t}" data-j="${esc(r)}" data-k="1">Asistió</button> <button class="s ${c.ok === false ? "r" : "g"}" data-f="mkA" data-i="${t}" data-j="${esc(r)}" data-k="0">Faltó</button></td>${t === "A" && U.rol !== "ENT" ? `<td><button class="s ${c.pc === true ? "" : "g"}" data-f="mkP" data-i="${esc(r)}" data-j="1">Pagó</button> <button class="s ${c.pc === false ? "r" : "g"}" data-f="mkP" data-i="${esc(r)}" data-j="0">Debe</button></td>` : ""}</tr>`;
  };
  let list = "";
  if (H && AS.t === "A")
    list = tbl(
      U.rol === "ENT" ? ["Alumno", "Asistencia"] : ["Alumno", "Asistencia", "Pago de campo"],
      S.alu
        .filter((a) => a.est === "Activo" && a.hor === H.id)
        .filter((a) => !AS.only || rec("A", a.id).ok === true)
        .map((a) => row("A", a.id, esc(a.nom + " " + a.ape))),
    );
  if (H && AS.t === "P")
    list = tbl(
      ["Profesor", "Asistencia"],
      H.profs
        .filter((p) => U.rol !== "ENT" || p === U.id)
        .map((p) => row("P", p, esc((S.personal.find((x) => x.id === p) || {}).nom))),
    );
  const sl = (k, l, a, ph) => fl(l, `<select data-ch=setA data-i=${k}>${o(a, AS[k], ph)}</select>`);
  return `<div class=card><div class=fg>${sl(
    "s",
    "1. Sede",
    ss.map((s) => [s, sn(s)]),
    "Elige sede",
  )}${sl("g", "2. Deporte + categoría", gk, "Elige grupo")}${sl(
    "h",
    "3. Hora",
    hh.map((h) => [h.id, h.ini + " - " + h.fin]),
    "Elige hora",
  )}${sl(
    "t",
    "4. Tomar a",
    [
      ["A", "Alumnos"],
      ["P", "Personal"],
    ],
    "Elige",
  )}${fl("Pago de campo por alumno (S/)", `<input type=number min=0 ${U.rol === "ADM" ? "" : "disabled"} value="${S.fee ?? 5}" data-ch=setFee>`)}</div><div class=row><button data-f=qrFotoAbrir>Tomar foto del QR (cámara del celular)</button><button class=g data-f=scan>Escanear en vivo</button></div></div><div class=card>${list ? `<h3>${hl(H)} · ${today()}</h3><div class="row u-m-0-0-8"><button class="s ${AS.only ? "" : "g"}" data-f=toggleOnly>Solo los que asistieron</button></div>${list}<p class=mu>Al marcar "Pagó" se registra un ingreso en la caja de la sede. Los alumnos inactivos no aparecen, pero conservan su historial.</p>` : "<p class=mu>Completa los 4 filtros para ver la lista.</p>"}</div>`;
};
const setA = (k, x) => {
  AS[k] = x;
  if (k === "s") AS.g = AS.h = "";
  if (k === "g") AS.h = "";
  R();
};
function mkA(t, r, ok) {
  let x = S.asis.find((x) => x.f === today() && x.t === t && x.ref === r && x.h === AS.h);
  if (x) x.ok = ok;
  else S.asis.push({ f: today(), t, ref: r, h: AS.h, ok });
  save();
  R();
}
function mkP(r, pc) {
  let x = S.asis.find((x) => x.f === today() && x.t === "A" && x.ref === r && x.h === AS.h);
  if (!x) {
    x = { f: today(), t: "A", ref: r, h: AS.h };
    S.asis.push(x);
  }
  x.pc = pc;
  const k = `campo|${today()}|${r}|${AS.h}`;
  S.caja = S.caja.filter((c) => c.k !== k);
  if (pc) {
    const a = S.alu.find((a) => a.id === r);
    S.caja.push({ f: today(), sede: a.sede, t: "I", c: "Pago de campo", d: r, m: S.fee ?? 5, k });
  }
  save();
  R();
}
VW.kits = () => {
  const adm = KS && U.rol === "ADM",
    edKey = String(KE ?? "").trim(),
    ed = edKey
      ? S.kits.find(
          (x) =>
            String(x._id ?? "").trim() === edKey ||
            String(x.id ?? "").trim() === edKey ||
            String(x.code ?? "").trim() === edKey ||
            String(x.codigo ?? "").trim() === edKey
        ) || {}
      : {};
  return `<div class=card><h3>${KE ? "Editar venta" : "Nueva venta"}</h3><div class=kitw><div class=kitf><div class=fg><label class="u-col-full">Buscar alumno (código, DNI, nombres o apellidos)<input id=k_q value="${esc(KQ)}" data-in=kitQ autocomplete=off placeholder="Escribe al menos 2 letras o números"></label><div id=k_res class="u-col-full"></div><input type=hidden id=k_a value="${esc(ed.aid || KSEL || "")}">${kSelHtml()}${fl("Prenda", "<select id=k_p>" + o(["Kit completo", "Polo", "Short", "Calcetines"].map((x) => [x, x]), ed.p || "Kit completo") + "</select>")}${fl("Talla", "<select id=k_t>" + o(["6", "8", "10", "12", "14", "S", "M", "L", "XL"].map((x) => [x, x]), ed.t || "6") + "</select>")}${fl("Nombre en camiseta", '<input id=k_n autocomplete=off placeholder="Ej. JUAN" data-in=shirtDraw value="' + esc(ed.n || "") + '">')}${fl("Número elegido", '<input id=k_u inputmode=numeric autocomplete=off maxlength=3 placeholder="00" data-in=kNumTyped value="' + esc(ed.u || KNUM || "") + '">')}${fl("Fecha de pedido", `<input id=k_f type=date value="${esc(ed.f || today())}">`)}${fl("Fecha de entrega", "<input id=k_e type=date value=" + esc(ed.e || "") + ">")}${fl("Precio público (S/)", "<input id=k_pr type=number min=0 value=" + esc(ed.pr ?? 90) + ">")}${fl("Costo de confección (S/)", "<input id=k_c type=number min=0 value=" + esc(ed.c ?? 45) + ">")}</div><div class=row><button data-f=kitPay>${KE ? "Guardar cambios" : "Registrar venta"}</button>${KE ? "<button class=g data-f=cancelKit>Cancelar</button>" : ""}</div></div>${shirtHtml()}</div></div><div class=card>${tbl(
    ["Código", "Alumno", "Prenda", "Talla", "Camiseta", "Pedido", "Entrega", "Cobrado", "Estado"].concat(
      adm ? ["Costo", "Utilidad", "Acciones"] : ["Acciones"],
    ),
    S.kits.map((k) => {
      const anulada = k.est === "Anulada";
      const key = esc(k._id || k.id || k.code || k.codigo || "");
      return `<tr><td>${esc(k.code)}</td><td>${esc(k.al)}</td><td>${esc(k.p)}</td><td>${esc(k.t)}</td><td>${esc(k.n)} ${esc(k.u)}</td><td>${esc(k.f)}</td><td>${esc(k.e || "Pendiente")}</td><td>${money(k.pr)}</td><td><span class="b ${anulada ? "no" : "ok"}">${anulada ? "Anulada" : "Activa"}</span></td>${adm ? `<td>${money(k.c)}</td><td><b>${money(anulada ? 0 : k.pr - k.c)}</b></td>` : ""}<td>${anulada ? "—" : `<button class="s g act" data-f=kitEd data-i="${key}" title="Modificar" aria-label="Modificar">${iac("edit")}</button> <button class="s r act" data-f=delKit data-i="${key}" title="Anular" aria-label="Anular">${iac("trash")}</button>`}</td></tr>`;
    }))}<div class=row><button class=g data-f=cp data-i=kits>Copiar para Excel</button>${U.rol === "ADM" ? `<button class=g data-f=toggleKS>${KS ? "Ocultar" : "Mostrar"} costos y utilidad</button>` : ""}</div>${adm ? `<p><b>Utilidad total de indumentaria: ${money(S.kits.filter((k) => k.est !== "Anulada").reduce((t, k) => t + k.pr - k.c, 0))}</b></p>` : ""}</div>`;
};
function saveKit() {
  const a = S.alu.find((x) => x.id === v("k_a"));
  if (!a) return toast("Elige un alumno");
  const pr = monto(v("k_pr") || 0),
    cc = monto(v("k_c") || 0);
  if (pr === null || cc === null) return toast("Precio o costo inválido");
  if (
    !["Kit completo", "Polo", "Short", "Calcetines"].includes(v("k_p")) ||
    !["6", "8", "10", "12", "14", "S", "M", "L", "XL"].includes(v("k_t"))
  )
  return toast("Prenda o talla inválida");

  const editKey = String(KE ?? "").trim();
  const findKitMatch = (key) => {
    const cleanKey = String(key ?? "").trim();
    if (!cleanKey) return undefined;
    return S.kits.find(
      (x) =>
        String(x._id ?? "").trim() === cleanKey ||
        String(x.id ?? "").trim() === cleanKey ||
        String(x.code ?? "").trim() === cleanKey ||
        String(x.codigo ?? "").trim() === cleanKey
    );
  };

  const existingEdit = editKey ? findKitMatch(editKey) : null;
  const nu = KNUM ? +KNUM : "";
  if (
    nu &&
    a.mod === "Competitivo" &&
    ocup(a).has(nu) &&
    (!existingEdit || String(existingEdit.u ?? "") !== String(nu))
  )
    return toast("Ese número ya está ocupado en su categoría (±2 años)");

  if (!RX.fecha.test(v("k_f")) || (v("k_e") && !RX.fecha.test(v("k_e"))))
    return toast("Fechas inválidas");
  if (v("k_e") && v("k_e") < v("k_f"))
    return toast("La fecha de entrega no puede ser anterior a la fecha del pedido");

  const kit = {
    code: `KIT-${a.dep.slice(4)}-${v("k_t")}`,
    aid: a.id,
    al: a.nom + " " + a.ape,
    sede: a.sede,
    p: v("k_p"),
    t: v("k_t"),
    n: limpiar(v("k_n"), 30),
    u: limpiar(v("k_u"), 3).replace(/\D/g, ""),
    f: v("k_f"),
    e: v("k_e"),
    pr,
    c: cc,
    est: existingEdit?.est || "Activa",
  };

  let mensajeGuardadoKit = "";
  if (editKey) {
    if (!existingEdit) {
      KE = null;
      return toast("La venta ya no existe. Recarga e inténtalo de nuevo.");
    }
    if (existingEdit.est === "Anulada") return toast("Una venta anulada no se puede modificar.");
    const realId = String(existingEdit._id ?? "").trim();
    const movimientos = S.caja.filter((c) => String(c.k ?? "").trim() === "kit|" + realId);
    if (!realId || movimientos.length !== 1) {
      return toast("No se puede editar esta venta: su ingreso de Caja no está vinculado de forma única. No se modificó nada.");
    }
    Object.assign(existingEdit, kit);
    Object.assign(movimientos[0], { f: kit.f, sede: kit.sede, d: kit.aid, m: kit.pr, k: "kit|" + realId });
    KE = null;
    mensajeGuardadoKit = "Venta actualizada";
  } else {
    const qaId = window.__ERP_QA_NEXT_KIT_ID__;
    const id =
      SB === "https://yiredilknlwbzwvwlqyx.supabase.co" &&
      U?.rol === "ADM" &&
      /^QA-KIT-\d{13}$/.test(String(qaId || "")) &&
      !S.kits.some((x) => x._id === qaId)
        ? (delete window.__ERP_QA_NEXT_KIT_ID__, qaId)
        : uid();
    S.kits.push({ _id: id, ...kit });
    S.caja.push({ f: kit.f || today(), sede: kit.sede, t: "I", c: "Indumentaria", d: kit.aid, m: kit.pr, k: "kit|" + id });
    mensajeGuardadoKit = "Venta registrada";
  }

  save(mensajeGuardadoKit);
  KSEL = KNUM = KQ = "";
  R();
}
function delKit(id) {
  const targetId = String(id ?? "").trim();
  if (!targetId) {
    return toast("No se pudo identificar la venta a eliminar");
  }

  const match = S.kits.find(
    (k) =>
      String(k._id ?? "").trim() === targetId ||
      String(k.id ?? "").trim() === targetId ||
      String(k.code ?? "").trim() === targetId ||
      String(k.codigo ?? "").trim() === targetId
  );

  if (!match) {
    return toast("La venta no se encontró en la lista");
  }

  const realId = String(match._id ?? "").trim();
  const movimientos = S.caja.filter((c) => String(c.k ?? "").trim() === "kit|" + realId);
  if (match.est === "Anulada") return toast("La venta ya está anulada.");
  if (!realId || movimientos.length !== 1 || movimientos[0].t !== "I" || movimientos[0].c !== "Indumentaria" || movimientos[0].sede !== match.sede || Math.abs((+movimientos[0].m || 0) - (+match.pr || 0)) >= 0.01) {
    return toast("No se puede anular: el ingreso original de Caja no está vinculado y conciliado de forma única.");
  }
  if (S.caja.some((c) => c.k === "reversion-kit|" + realId)) return toast("La venta ya tiene una reversión registrada.");
  if (!confirm("¿Anular esta venta? Se conservará el ingreso original y se registrará un egreso de reversión en Caja.")) return;

  // La reversión la crea el trigger trg_auditar_anulacion_kit dentro
  // de la misma transacción que cambia el estado de la venta. No insertar otra
  // fila aquí: duplicaría el movimiento protegido por origen único.
  match.est = "Anulada";
  save();
  sv = sv.then(async () => {
    if (!SAVE_OK) return;
    try {
      await pull();
      R();
      toast("Venta anulada y reversión registrada en Caja");
    } catch (e) {
      console.error("La venta se anuló, pero no se pudo refrescar la vista de Caja.", e);
      toast("Venta anulada. Recarga para actualizar la reversión de Caja.");
    }
  });
  R();
}
function cajaAuditoria(x) {
  const origen = String(x.k || "");
  if (origen.startsWith("matricula:")) {
    const raw = origen.split("|aplicacion:")[1];
    if (raw) {
      try {
        const partes = JSON.parse(decodeURIComponent(raw));
        return partes.map((p) =>
          `${p.destino}${p.cuota ? " " + p.cuota : ""}: ${money(p.monto)}`
        ).join(" · ");
      } catch (e) {
        return "Abono de matrícula (detalle no disponible)";
      }
    }
  }
  if (origen.startsWith("reversion-kit|")) {
    const id = origen.slice("reversion-kit|".length);
    return `Reversión de venta de indumentaria ${id}`;
  }
  if (origen.startsWith("reversion:")) {
    const id = origen.slice("reversion:".length),
      ingreso = S.caja.find((m) => m._id === id);
    return ingreso
      ? `Reversión vinculada al ingreso del ${ingreso.f} por ${money(ingreso.m)}`
      : `Reversión vinculada al ingreso ${id}`;
  }
  return "—";
}
VW.caja = () => {
  const s = AS.cs || S.sedes[0].id,
    L = S.caja.filter((x) => x.sede === s),
    b = L.reduce((t, x) => t + (x.t === "I" ? x.m : -x.m), 0);
  return `<div class=card><div class=fg>${fl(
    "Sede",
    `<select data-ch=asCs>${o(
      S.sedes.map((x) => [x.id, x.nombre]),
      s,
    )}</select>`,
  )}${fl(
    "Tipo",
    "<select id=c_t>" +
      o([
        ["I", "Ingreso"],
        ["E", "Egreso"],
      ]) +
      "</select>",
  )}${fl("Concepto", "<select id=c_c>" + o(["Matrícula / mensualidad", "Indumentaria", "Pago de campo", "Pago de alquiler", "Planilla de entrenadores", "Compras", "Otros"].filter((x) => U.rol === "ADM" || !/alquiler|Planilla/.test(x)).map((x) => [x, x])) + "</select>")}${fl("Detalle", "<input id=c_d>")}${fl("Monto (S/)", "<input id=c_m type=number min=0>")}</div><div class=row><button data-f="addCaja" data-i="${esc(s)}">Registrar movimiento</button></div></div><div class=card><h3>Saldo de ${esc(sn(s))}: ${money(b)}</h3>${tbl(
    ["Fecha", "Tipo", "Concepto", "Detalle", "Trazabilidad", "Monto"],
    L.slice()
      .reverse()
      .map(
        (x) =>
          `<tr><td>${esc(x.f)}</td><td><span class="b ${x.t === "I" ? "ok" : "no"}">${x.t === "I" ? "Ingreso" : "Egreso"}</span></td><td>${esc(x.c)}</td><td>${esc(x.d)}</td><td>${esc(cajaAuditoria(x))}</td><td>${money(x.m)}</td></tr>`,
      ),
  )}<div class=row><button class=g data-f=cp data-i=caja>Copiar para Excel</button></div></div>`;
};
function addCaja(s) {
  const { d, e } = validarPago({ m: v("c_m"), t: v("c_t"), c: v("c_c"), d: v("c_d") });
  if (e.length) return toast(e[0]);
  if (!S.sedes.some((x) => x.id === s)) return toast("Sede inválida");
  S.caja.push({ f: today(), sede: s, t: d.t, c: d.c, d: d.d, m: d.m });
  save();
  R();
}
let GR = "anio";
const MFULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WARN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/></svg>';
function gerRow(s, ym) {
  const mc = S.caja.filter((x) => x.sede === s.id && x.f.startsWith(ym)),
    ing = mc.filter((x) => x.t === "I").reduce((t, x) => t + x.m, 0),
    // Alquiler y planilla se calculan por separado abajo; no deben repetirse en "otros egresos".
    eg = mc
      .filter((x) => x.t === "E" && !["Pago de alquiler", "Planilla de entrenadores"].includes(x.c))
      .reduce((t, x) => t + x.m, 0),
    kc = S.kits.filter((k) => k.est !== "Anulada" && k.sede === s.id && k.f.startsWith(ym)).reduce((t, k) => t + k.c, 0),
    pl = S.asis
      .filter((x) => x.t === "P" && x.ok && x.f.startsWith(ym) && x.f <= today())
      .reduce((t, x) => {
        const h = S.hor.find((h) => h.id === x.h);
        const p = S.personal.find((p) => p.id === x.ref);
        return h && p && h.sede === s.id ? t + hrs(h) * p.precio : t;
      }, 0);
  return { s, ing, eg, kc, pl, al: +s.costo, u: ing - eg - kc - pl - s.costo };
}
const gerIni = () =>
  ([
    ...S.caja.map((x) => x.f),
    ...S.alu.map((a) => a.fecha),
    ...S.asis.map((x) => x.f),
    ...S.kits.map((k) => k.f),
  ].filter(Boolean).sort()[0] || today()).slice(0, 7);
const gerU = (s, ym, ini) => (ym < ini ? 0 : gerRow(s, ym).u);
const gerNet = (ym, ini) => S.sedes.reduce((t, s) => t + gerU(s, ym, ini), 0);
const lastMonths = (ym, n) => {
  let [y, m] = ym.split("-").map(Number);
  const r = [];
  for (let i = 0; i < n; i++) {
    r.unshift(`${y}-${String(m).padStart(2, "0")}`);
    if (--m < 1) {
      m = 12;
      y--;
    }
  }
  return r;
};
const mesesRango = () =>
  GR === "anio"
    ? Array.from({ length: 12 }, (_, i) => `${GM.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`)
    : lastMonths(today().slice(0, 7), 12);
const mLbl = (ym) => MS[+ym.slice(5, 7) - 1];
function spark(vs) {
  const W = 84,
    H = 24,
    mn = Math.min(...vs),
    mx = Math.max(...vs),
    rg = mx - mn || 1,
    pts = vs
      .map((x, i) => `${((i / (vs.length - 1)) * W).toFixed(1)},${(H - 2 - ((x - mn) / rg) * (H - 4)).toFixed(1)}`)
      .join(" ");
  return `<svg class=spk width=${W} height=${H} viewBox="0 0 ${W} ${H}" role=img aria-label="Tendencia de rendimiento, últimos 6 meses"><title>Tendencia de rendimiento por sede (6 meses)</title><polyline points="${pts}" fill=none stroke="${vs[vs.length - 1] < 0 ? "var(--rd)" : "var(--ac)"}" stroke-width=2 stroke-linejoin=round stroke-linecap=round /></svg>`;
}
function svgBars(ms, vals, hoyYm) {
  const W = 600,
    H = 220,
    P = 30,
    mn = Math.min(0, ...vals),
    mx = Math.max(0, ...vals),
    rg = mx - mn || 1,
    y = (x) => P + ((mx - x) / rg) * (H - 2 * P - 14),
    z = y(0),
    bw = (W - 2 * P) / ms.length;
  return `<svg viewBox="0 0 ${W} ${H}" class=gch role=img aria-label="Utilidad neta por mes"><line x1=${P} x2=${W - P} y1=${z} y2=${z} stroke=currentColor opacity=.3 />${ms
    .map((m, i) => {
      const x = vals[i],
        h = Math.max(2, Math.abs(y(x) - z)),
        fut = m > hoyYm,
        px = P + i * bw;
      return `<g class=gb data-f=gerMes data-i=${m}><title>${MFULL[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}: ${money(x)}${fut ? " (proyectado)" : ""}</title><rect x=${px} y=0 width=${bw} height=${H} fill=transparent /><rect class=bv x=${(px + bw * 0.16).toFixed(1)} y=${(x >= 0 ? z - h : z).toFixed(1)} width=${(bw * 0.68).toFixed(1)} height=${h.toFixed(1)} rx=3 fill="${x < 0 ? "var(--rd)" : "var(--ac)"}" opacity=${m === GM ? 1 : fut ? 0.3 : 0.62} /><text x=${(px + bw / 2).toFixed(1)} y=${H - 6} text-anchor=middle font-size=11 fill=currentColor opacity=${m === GM ? 1 : 0.7}>${mLbl(m)}</text></g>`;
    })
    .join("")}</svg>`;
}
function svgLine(ms, vals) {
  const W = 600,
    H = 220,
    P = 30,
    mx = Math.max(4, ...vals),
    x = (i) => P + (i * (W - 2 * P)) / Math.max(1, ms.length - 1),
    y = (n) => H - P - (n / mx) * (H - 2 * P - 6),
    d = vals.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class=gch role=img aria-label="Matrículas registradas por mes"><line x1=${P} x2=${W - P} y1=${y(0)} y2=${y(0)} stroke=currentColor opacity=.3 /><text x=4 y=${y(mx) + 4} font-size=11 fill=currentColor opacity=.7>${mx}</text><text x=4 y=${y(0) + 4} font-size=11 fill=currentColor opacity=.7>0</text><path d="${d}" fill=none stroke="var(--ac)" stroke-width=2.5 stroke-linejoin=round />${ms
    .map(
      (m, i) =>
        `<g class=gb data-f=gerMes data-i=${m}><title>${MFULL[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}: ${vals[i]} matrículas</title><rect x=${(x(i) - 14).toFixed(1)} y=0 width=28 height=${H} fill=transparent /><circle cx=${x(i).toFixed(1)} cy=${y(vals[i]).toFixed(1)} r=${m === GM ? 6 : 3.5} fill="var(--ac)" /><text x=${x(i).toFixed(1)} y=${H - 6} text-anchor=middle font-size=11 fill=currentColor opacity=${m === GM ? 1 : 0.7}>${mLbl(m)}</text></g>`,
    )
    .join("")}</svg>`;
}
VW.ger = () => {
  const mm = GM.slice(5, 7),
    yy = GM.slice(0, 4),
    hoyYm = today().slice(0, 7),
    parcial = GM === hoyYm,
    ini = gerIni(),
    yrs = [
      ...new Set([
        +hoyYm.slice(0, 4),
        +yy,
        ...S.alu.map((a) => +(a.fecha || "").slice(0, 4)).filter(Boolean),
        ...S.caja.map((x) => +(x.f || "").slice(0, 4)).filter(Boolean),
        ...S.asis.map((x) => +(x.f || "").slice(0, 4)).filter(Boolean),
        ...S.kits.map((k) => +(k.f || "").slice(0, 4)).filter(Boolean),
      ]),
    ].sort(),
    rows = S.sedes.map((s) => ({ ...gerRow(s, GM), tr: lastMonths(GM, 6).map((m) => gerU(s, m, ini)) })),
    mx = Math.max(1, ...rows.map((r) => Math.abs(r.u))),
    tot = rows.reduce((t, r) => t + r.u, 0),
    ms = mesesRango(),
    nets = ms.map((m) => gerNet(m, ini)),
    mats = ms.map((m) => S.alu.filter((a) => (a.fecha || "").startsWith(m)).length),
    aviso = `Datos de ${MFULL[+mm - 1].toLowerCase()} parciales: fin de mes en progreso`;
  return `<div class=card><div class="row u-m-0">${fl("Mes a analizar", `<select data-ch=setGMm>${o(MFULL.map((n, i) => [String(i + 1).padStart(2, "0"), n]), mm)}</select>`)}${fl("Año", `<select data-ch=setGMy>${o(yrs.map((n) => [String(n), String(n)]), yy)}</select>`)}<p class=mu>Utilidad neta = Ingresos − Alquileres − Planilla − Costo de kits − Otros egresos</p></div></div><div class=card><h3>Balance de utilidad por sede</h3>${tbl(
    ["Sede", "Ingresos", "Alquiler", "Planilla", "Costo kits", "Otros egresos", "Utilidad neta", "Rendimiento"],
    rows.map(
      (r, ri) =>
        `<tr><td>${esc(r.s.nombre)}</td><td>${money(r.ing)}</td><td>${money(r.al)}</td><td>${money(r.pl)}</td><td>${money(r.kc)}</td><td>${money(r.eg)}</td><td><b class="${r.u < 0 ? "u-neg" : "u-pos"}">${money(r.u)}</b>${parcial ? `<span class=warn title="${aviso}" aria-label="${aviso}">${WARN}</span>` : ""}</td><td><div class=rend><div class="bar ${r.u < 0 ? "n" : ""}${NAVF ? " ga" : ""}" data-dw="${(Math.abs(r.u) / mx) * 100}" data-dx=${ri}></div>${spark(r.tr)}</div></td></tr>`,
    ),
  )}<p><b>Utilidad neta total del mes: ${money(tot)}</b></p>${parcial ? `<p class=mu>${aviso}.</p>` : ""}</div><div class=gcharts><div class=card><div class="row ghd"><h3>Utilidad neta por mes <span class=mu>(clic en barra para ver mes)</span></h3><button class="g s" data-f=gerRango>Filtrar</button></div><p class=mu>Filtro de fecha: ${GR === "anio" ? "Año " + yy : "Últimos 12 meses"}</p>${svgBars(ms, nets, hoyYm)}</div><div class=card><h3>Matrículas registradas por mes</h3><p class=mu>Filtro de fecha: ${GR === "anio" ? "Año " + yy : "Últimos 12 meses"}</p>${svgLine(ms, mats)}</div></div>`;
};
