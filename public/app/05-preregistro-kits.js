/* [ERP 05/18] 05-preregistro-kits.js — Pre-registro (staff) y kits de camiseta (secciones 6-7). Código sin cambios respecto a script.js (líneas 1030-1216). */
/* ==================================================================
   6. PRE-REGISTRO DE ALUMNOS (staff)
   ================================================================== */
const preAlu = (p) => ({
    est: "Activo",
    con: "Ninguna",
    mod: "Formativo",
    sex: p.sexo || "M",
    cm: 0,
    cmen: 0,
    mes: 1,
    pag: 0,
    sede: p.sede_id,
    dep: p.deporte_id,
    nom: p.nombres,
    ape: p.apellidos,
    dni: p.dni || "",
    nac: p.fecha_nacimiento || "",
    an: p.apoderado || "",
    ac: p.celular_apoderado || "",
    am: p.correo_apoderado || "",
    seg: p.seguro || "",
    foto: IMG_OK.test(p.foto || "") ? p.foto : "",
    dnf: PRE_OK.test(p.doc_dni_frente || "") ? p.doc_dni_frente : "",
    dsg: PRE_OK.test(p.doc_seguro || "") ? p.doc_seguro : "",
    dfm: PRE_OK.test(p.doc_ficha || "") ? p.doc_ficha : "",
  }),
  preN = (p) =>
    [
      IMG_OK.test(p.foto || ""),
      PRE_OK.test(p.doc_dni_frente || ""),
      PRE_OK.test(p.doc_seguro || ""),
      PRE_OK.test(p.doc_ficha || ""),
    ].filter(Boolean).length;
function qrPadres() {
  const u = base() + "#prereg";
  modal(
    "<h3>Pre-registro para padres</h3>" +
      qr(u) +
      `<p class="mu u-break-all">${esc(u)}</p><div class="row u-jc-center"><button data-f="cpUrl">Copiar enlace</button><a href="${esc(u)}" target=_blank rel=noopener class="link-accent">Abrir formulario</a></div>`,
  );
}
async function contarPre() {
  if (!U) return;
  try {
    const r = await sb("/rest/v1/preregistros?select=id");
    if (!r.ok) return;
    PRN = (await r.json()).length;
    const e = $("#pb");
    if (e) e.textContent = PRN ? " (" + PRN + ")" : "";
  } catch (e) {}
}
setInterval(contarPre, 30000);
async function cargarPre() {
  try {
    const r = await sb("/rest/v1/preregistros?select=*&order=fecha_hora.asc,id.asc&limit=1000");
    PR = r.ok ? await r.json() : [];
  } catch (e) {
    PR = [];
  }
  PRN = PR.length;
  if (V === "pre") R();
}
const preL = () => {
  const q = PF.q.toLowerCase().trim();
  return (PR || []).filter(
    (p) =>
      (!PF.m || p.modalidad === PF.m) &&
      (!q ||
        (p.nombres + " " + p.apellidos + " " + (p.dni || "") + " " + (p.apoderado || ""))
          .toLowerCase()
          .includes(q)),
  );
};
const preT = () =>
  tbl(
    [
      "N.°",
      "Registrado",
      "Modalidad",
      "Alumno",
      "DNI",
      "Deporte / sede",
      "Apoderado",
      "Celular",
      "Archivos",
      "",
    ],
    preL().map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td>${esc(new Date(p.fecha_hora).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }))}</td><td><span class="b ${p.modalidad === "Presencial" ? "ok" : "no"}">${esc(p.modalidad)}</span></td><td>${esc(p.nombres + " " + p.apellidos)}</td><td>${esc(p.dni || "")}</td><td>${esc(dn(p.deporte_id))} / ${esc(sn(p.sede_id))}</td><td>${esc(p.apoderado || "")}</td><td>${esc(p.celular_apoderado || "")}</td><td><span class="b ${preN(p) === 4 ? "ok" : "no"}">${preN(p)}/4</span></td><td><button class=s data-f="preOk" data-i="${esc(p.id)}">Aceptar</button> <button class="s r act" data-f="preDel" data-i="${esc(p.id)}" title="Eliminar" aria-label="Eliminar">${iac("trash")}</button></td></tr>`,
    ),
  );
const preF = () => {
  $("#pt").innerHTML = preT();
};
const vwPre = () =>
  PR === null
    ? "<div class=card><p class=mu>Cargando...</p></div>"
    : `<div class=card><div class=fg>${fl("Buscar", `<input placeholder="Nombre, DNI o apoderado" value="${esc(PF.q)}" data-in=preQ>`)}${fl(
        "Modalidad",
        "<select data-ch=preM>" +
          o(
            [
              ["Presencial", "Presencial"],
              ["Virtual", "Virtual"],
            ],
            PF.m,
            "Todas",
          ) +
          "</select>",
      )}</div><div class=row><button class=g data-f=cargarPre>Actualizar</button><button class=g data-f=qrPadres>QR para padres</button></div></div><div class=card><div id=pt>${preT()}</div><p class=mu>Orden de llegada: primero quien llenó el formulario antes. Eliminar solo quita la solicitud, no afecta a los alumnos oficiales.</p></div>`;
function preBorrarArch(p) {
  const l = [p.doc_dni_frente, p.doc_seguro, p.doc_ficha].filter((x) => PRE_OK.test(x || ""));
  if (l.length)
    sb("/storage/v1/object/documentos", {
      method: "DELETE",
      body: JSON.stringify({ prefixes: l }),
    }).catch(() => {});
}
async function preDel(id) {
  if (!confirm("¿Eliminar este pre-registro y sus archivos?")) return;
  const q = (PR || []).find((x) => x.id === id),
    r = await sb("/rest/v1/preregistros?id=eq." + encodeURIComponent(id), { method: "DELETE" });
  if (!r.ok) return toast("No se pudo eliminar");
  if (q) preBorrarArch(q);
  PR = PR.filter((x) => x.id !== id);
  PRN = PR.length;
  R();
}
/* ==================================================================
   7. KITS: NÚMEROS DE CAMISETA DISPONIBLES
   ================================================================== */
const ocup = (a) => {
  const y = +a.nac.slice(0, 4),
    o = new Set();
  if (a.mod !== "Competitivo") return o;
  S.kits.forEach((k) => {
    const b = S.alu.find((x) => x.id === k.aid);
    if (
      b &&
      b.id !== a.id &&
      b.mod === "Competitivo" &&
      b.dep === a.dep &&
      Math.abs(+b.nac.slice(0, 4) - y) <= 2 &&
      k.u !== ""
    )
      o.add(+k.u);
  });
  return o;
};
const matriz = (a) => {
  const oc = ocup(a);
  return (
    "<div class=nm>" +
    Array.from({ length: 100 }, (_, i) => i + 1)
      .map((n) =>
        oc.has(n)
          ? `<span class="n x" title="Ocupado">${n}</span>`
          : `<button type=button class="n ${KNUM == n ? "sel" : ""}" data-f="kNum" data-i="${n}">${n}</button>`,
      )
      .join("") +
    "</div>"
  );
};
const kSelHtml = () => {
  const a = S.alu.find((x) => x.id === KSEL);
  if (!a) return "";
  return `<div class="card u-col-full u-m-0"><b>${esc(a.nom + " " + a.ape)}</b> · ${esc(a.id)} · DNI ${esc(a.dni || "sin DNI")}<br><span class=mu>${esc(dn(a.dep))} · CAT-${esc(a.nac.slice(0, 4))} · ${esc(a.mod)}</span><p class="mu u-m-6-0">${a.mod === "Competitivo" ? "Los números en rojo ya están usados en su categoría o en las de ±2 años y no se pueden elegir." : "Modalidad formativo: no hay restricción de números."}</p>${matriz(a)}</div>`;
};
const kRes = () => {
  const q = KQ.toLowerCase().trim(),
    r =
      q.length < 2
        ? []
        : S.alu
            .filter((a) =>
              (a.id + " " + (a.dni || "") + " " + a.nom + " " + a.ape).toLowerCase().includes(q),
            )
            .slice(0, 6);
  $("#k_res").innerHTML = r
    .map(
      (a) =>
        `<button type=button class="s g" data-f="kSel" data-i="${esc(a.id)}">${esc(a.id + " · " + a.nom + " " + a.ape + " · " + (a.dni || "sin DNI"))}</button>`,
    )
    .join(" ");
};
