/* [ERP 07/18] 07-publico.js — Páginas públicas: carnet digital y pre-registro (sección 9). Código sin cambios respecto a script.js (líneas 1538-1675). */
/* ==================================================================
   9. PÁGINAS PÚBLICAS (carnet digital y formulario de pre-registro)
   ================================================================== */
async function pubCarnet(t) {
  DOM.app.innerHTML = `<main class=login><section class="card u-text-center"><img src="${LOGO}" class=lg alt="CDMT"><p class=mu>Cargando carnet...</p></section></main>`;
  let a = null;
  try {
    const r = await sb("/rest/v1/rpc/carnet_publico", {
      method: "POST",
      body: JSON.stringify({ t }),
    });
    a = (await r.json())[0];
  } catch (e) {}
  DOM.app.innerHTML = `<main class=login><section class="card u-text-center"><img src="${LOGO}" class=lg alt="CDMT">${a ? `${IMG_OK.test(a.foto || "") ? `<img src="${esc(a.foto)}" width=110 height=110 class="carnet-photo">` : ""}<h3 class="u-m-10-0-2">${esc(a.nombres + " " + a.apellidos)}</h3><p class="u-m-0">Código <b>${esc(a.codigo)}</b></p><p class="mu u-m-4-0">${esc(a.deporte || "")} · CAT-${esc(a.categoria || "")} · ${esc(a.sede || "")}</p><span class="b ${a.estado === "Activo" ? "ok" : "no"}">${esc(a.estado || "")}</span><p class="mu u-mt-12">Carnet digital oficial del Consorcio Deportivo Madrid Trujillo</p>` : "<p>Carnet no encontrado.</p>"}</section></main>`;
}
async function pubPre() {
  document.title = "Pre-registro | CDMT";
  let cat = [];
  const op = (t) =>
    o(
      cat.filter((x) => x.tipo === t).map((x) => [x.id, x.nombre]),
      "",
      "Elige",
    );

  // Renderizar el formulario antes de consultar el catálogo: una latencia del
  // Data API no debe dejar al usuario frente a una pantalla de carga indefinida.
  DOM.app.innerHTML = `<main class="login login--wide"><section class=card><img src="${LOGO}" class=lg alt="CDMT"><h3>Pre-registro de alumno</h3><p class=mu>Completa los datos. En la sede solo validaremos y confirmaremos la matrícula.</p><div class=fg>${fl(
    "¿Cómo llenas este formulario?",
    "<select id=pp_m>" +
      o([
        ["Presencial", "Presencial (en la sede)"],
        ["Virtual", "Virtual (desde casa)"],
      ]) +
      "</select>",
  )}${fl("Nombres", "<input id=pp_n>")}${fl("Apellidos", "<input id=pp_a>")}${fl("DNI del alumno", "<input id=pp_d maxlength=8 inputmode=numeric data-in=digits>")}${fl(
    "Sexo",
    "<select id=pp_s>" +
      o([
        ["M", "Masculino"],
        ["F", "Femenino"],
      ]) +
      "</select>",
  )}${fl("Fecha de nacimiento", "<input id=pp_f type=date>")}${fl("Deporte", "<select id=pp_dp disabled>" + op("D") + "</select>")}${fl("Sede", "<select id=pp_sd disabled>" + op("S") + "</select>")}${fl("Apoderado", "<input id=pp_ap>")}${fl("Celular del apoderado", "<input id=pp_c maxlength=9 inputmode=numeric data-in=digits>")}${fl("Correo", "<input id=pp_e type=email>")}${fl("Seguro médico (opcional)", "<input id=pp_sg>")}<h4 class="u-m-10-0-0">Documentos del alumno <span class="mu u-fw-400">(JPG, PNG o PDF · máx. 5 MB cada uno)</span></h4>${fl("Foto del alumno", '<input type=file id=pp_fo accept="image/jpeg,image/png">')}${fl("DNI (AMBOS LADOS)", '<input type=file id=pp_dn accept="image/jpeg,image/png,application/pdf">')}${fl("Seguro médico (documento)", '<input type=file id=pp_sf accept="image/jpeg,image/png,application/pdf">')}${fl("Ficha de notaría", '<input type=file id=pp_fm accept="image/jpeg,image/png,application/pdf">')}<input id=pp_w class="u-hidden" tabindex=-1 autocomplete=off></div><div class=row><button id=pp_b data-f=enviarPre>Enviar pre-registro</button></div></section></main>`;

  try {
    const respuesta = await sb("/rest/v1/catalogo_publico?select=*", { timeout: 8000 });
    if (!respuesta.ok) throw new Error("No se pudo cargar el catálogo público.");
    const filas = await respuesta.json();
    if (!Array.isArray(filas)) throw new Error("El catálogo público tiene un formato inválido.");
    cat = filas.filter((x) => x && ["D", "S"].includes(x.tipo) && x.id && x.nombre);
    const deporte = $("#pp_dp");
    const sede = $("#pp_sd");
    deporte.innerHTML = op("D");
    sede.innerHTML = op("S");
    deporte.disabled = !cat.some((x) => x.tipo === "D");
    sede.disabled = !cat.some((x) => x.tipo === "S");
    if (deporte.disabled || sede.disabled) {
      toast("No hay deportes o sedes disponibles para el pre-registro.");
    }
  } catch (e) {
    console.error("No se pudo cargar el catálogo del pre-registro:", e);
    toast("No se pudieron cargar los deportes y sedes. Intenta recargar.");
  }
}
async function enviarPre() {
  if (v("pp_w")) return;
  const { d, e } = validarAlumno({
    nom: v("pp_n"),
    ape: v("pp_a"),
    dni: v("pp_d"),
    ac: v("pp_c"),
    am: v("pp_e"),
    an: v("pp_ap"),
    seg: v("pp_sg"),
    nac: v("pp_f"),
    sex: v("pp_s"),
    mod: "Formativo",
    con: "Ninguna",
    est: "Activo",
    cm: 0,
    cmen: 0,
    pag: 0,
  });
  if (!e.length && !catOk(+d.nac.slice(0, 4)))
    e.push(`Solo se aceptan nacidos entre ${Y - 17} y ${Y - 5}`);
  if (!v("pp_dp") || !v("pp_sd")) e.push("Elige deporte y sede");
  if (!d.an) e.push("Escribe el nombre del apoderado");
  if (!["Presencial", "Virtual"].includes(v("pp_m"))) e.push("Elige Presencial o Virtual");
  if (e.length) return toast(e[0]);
  const b = $("#pp_b"),
    fs = {
      foto: $("#pp_fo").files[0],
      dnf: $("#pp_dn").files[0],
      dsg: $("#pp_sf").files[0],
      dfm: $("#pp_fm").files[0],
    };
  for (const k in fs) {
    const f = fs[k];
    if (!f) continue;
    if (f.size > 5e6) return toast("Cada archivo debe pesar máximo 5 MB");
    if (!(k === "foto" ? /^image\/(jpeg|png)$/.test(f.type) : DOC_OK[f.type]))
      return toast(
        k === "foto" ? "La foto debe ser JPG o PNG" : "Los documentos deben ser JPG, PNG o PDF",
      );
  }
  // Storage valida carpetas alfanuméricas; compactar el UUID antes de usarlo como ID/ruta.
  const pid = uid().replace(/-/g, ""),
    tx = b.textContent,
    ps = {};
  b.disabled = true;
  try {
    let foto = null;
    if (fs.foto) {
      b.textContent = "Procesando foto...";
      foto = await fotoData(fs.foto);
    }
    for (const [k, t] of [
      ["dnf", "dni"],
      ["dsg", "seguro"],
      ["dfm", "ficha"],
    ])
      if (fs[k]) {
        b.textContent = "Subiendo archivos...";
        ps[k] = await subirArch(fs[k], "preregistro/" + pid, t);
      }
    b.textContent = "Enviando...";
    const r = await sb("/rest/v1/preregistros", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: pid,
        modalidad: v("pp_m"),
        nombres: d.nom,
        apellidos: d.ape,
        dni: d.dni || null,
        sexo: d.sex,
        fecha_nacimiento: d.nac,
        deporte_id: v("pp_dp"),
        sede_id: v("pp_sd"),
        apoderado: d.an,
        celular_apoderado: d.ac || null,
        correo_apoderado: d.am || null,
        seguro: d.seg || null,
        foto,
        doc_dni_frente: ps.dnf || null,
        doc_seguro: ps.dsg || null,
        doc_ficha: ps.dfm || null,
      }),
    });
    if (!r.ok) {
      await r.text().catch(() => "");
      throw new Error("No se pudo enviar el pre-registro.");
    }
    await r.text().catch(() => "");
    DOM.app.innerHTML = `<main class=login><section class="card u-text-center"><img src="${LOGO}" class=lg alt="CDMT"><h3>Pre-registro enviado</h3><p>Gracias. Presenta tu DNI en la sede para confirmar la matrícula.</p></section></main>`;
  } catch (x) {
    // Si falla el envío después de subir documentos, limpiar los objetos huérfanos.
    const rutas = Object.values(ps).filter(
      (p) => typeof p === "string" && /^preregistro\/[a-z0-9]+\/(dni|seguro|ficha)-\d+\.(jpg|png|pdf)$/.test(p),
    );
    if (rutas.length) {
      try {
        const limpieza = await sb("/functions/v1/preregistro-cleanup", {
          method: "POST",
          body: JSON.stringify({ prefixes: rutas }),
        });
        if (!limpieza.ok) console.error("No se pudieron limpiar los documentos del pre-registro fallido");
        await limpieza.text().catch(() => "");
      } catch (e) {
        console.error("Error al limpiar documentos del pre-registro fallido:", e);
      }
    }
    b.disabled = false;
    b.textContent = tx;
    toast("No se pudo enviar. Revisa tus archivos e intenta de nuevo.");
  }
}
