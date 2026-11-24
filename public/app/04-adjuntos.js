/* [ERP 04/18] 04-adjuntos.js — Archivos adjuntados: foto + 3 documentos (sección 5). Código sin cambios respecto a script.js (líneas 825-1029). */
/* ==================================================================
   5. ARCHIVOS ADJUNTADOS (foto + 3 documentos)
   ================================================================== */
const DOC_PATH = /^(?!.*\.\.)[\w\-./]{3,160}\/(dni|seguro|ficha)-\d+\.(jpg|png|pdf)$/,
  PRE_OK = /^preregistro\/[a-z0-9]+\/(dni|seguro|ficha)-\d+\.(jpg|png|pdf)$/;
const ADJ = [
    ["foto", "Foto del alumno", "Foto"],
    ["dnf", "DNI (AMBOS LADOS)", "DNI"],
    ["dsg", "Documento del seguro médico", "Seguro"],
    ["dfm", "Ficha de notaría", "Ficha"],
  ],
  ADJ_T = { dnf: "dni", dsg: "seguro", dfm: "ficha" };
let DW = null,
  DP = {},
  DWK = null,
  DDEL = [],
  ADJ_BUSY = false,
  ADJ_K = "",
  ADJ_IN = null;
/* DW = referencias vigentes (foto = data URL, resto = ruta en Storage). DP = cambios pendientes: File (reemplazo) o null (eliminar). */
function adjInit(a) {
  const k = ED || (PREID ? "pre:" + PREID : "nuevo");
  if (DW && DWK === k) return;
  DWK = k;
  DP = {};
  DDEL = [];
  ADJ_BUSY = false;
  DW = {
    foto: IMG_OK.test(a.foto || "") ? a.foto : "",
    dnf: a.dnf || "",
    dsg: a.dsg || "",
    dfm: a.dfm || "",
  };
}
const adjHas = (k) =>
  k === "foto" ? !!DW.foto : DP[k] === null ? false : DP[k] instanceof File || !!DW[k];
function adjBoton() {
  const f = ADJ.filter((x) => !adjHas(x[0]));
  return `<button data-f="adjAbrir" id=ad_b>Archivos adjuntados (${4 - f.length}/4)</button><span class="b ${f.length ? "no" : "ok"}">${f.length ? "Faltan: " + f.map((x) => x[2]).join(", ") : "Archivos completos"}</span>`;
}
function adjHtml(m = "") {
  const n = ADJ.filter((x) => adjHas(x[0])).length;
  return `<h3>Archivos adjuntados</h3><p class=mu>${n} de 4 cargados · JPG, PNG o PDF, máx. 5 MB${ED ? "" : " · se guardan al presionar Guardar"}</p><div class=adj>${ADJ.map(
    ([k, t]) => {
      const ok = adjHas(k),
        pd = DP[k] instanceof File;
      return `<div class="adj-i${ok ? "" : " miss"}"><div class=adj-h><b>${t}</b><span class="b ${ok ? "ok" : "no"}">${ok ? (pd ? "Cargado (pendiente de guardar)" : "Cargado") : "Faltante"}</span></div><div class=adj-a>${ok ? `<button class="s g" data-f=adjVer data-i=${k}>Ver</button>` : ""}<button class=s data-f=adjCamb data-i=${k}>${ok ? "Reemplazar" : "Subir"}</button>${ok ? `<button class="s r act" data-f=adjDel data-i=${k} title="Eliminar" aria-label="Eliminar">${iac("trash")}</button>` : ""}</div></div>`;
    },
  ).join("")}</div><p id=adj_m class=mu>${m}</p>`;
}
function adjRefrescar() {
  const r = $("#ad_r");
  if (r) r.innerHTML = adjBoton();
  const fb = $("#foto_box");
  if (fb) fb.innerHTML = fotoBox();
  if ($("#adj_m") && DOM.mod.classList.contains("o")) modal(adjHtml());
}
function abrirBlob(b) {
  const u = URL.createObjectURL(b);
  window.open(u, "_blank");
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}
function adjVer(k) {
  if (k === "foto") {
    const m = /^data:([^;]+);base64,(.*)$/.exec(DW.foto || "");
    if (!m) return;
    const b = atob(m[2]),
      u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return abrirBlob(new Blob([u], { type: m[1] }));
  }
  if (DP[k] instanceof File) return abrirBlob(DP[k]);
  if (DW[k]) verDoc(DW[k]);
}
function adjCamb(k) {
  ADJ_K = k;
  if (!ADJ_IN) {
    ADJ_IN = document.createElement("input");
    ADJ_IN.type = "file";
    ADJ_IN.className = "offscreen-file-input";
    ADJ_IN.addEventListener("change", () => {
      const f = ADJ_IN.files && ADJ_IN.files[0];
      ADJ_IN.value = "";
      if (f) adjSet(ADJ_K, f);
    });
    document.body.appendChild(ADJ_IN);
  }
  ADJ_IN.accept = k === "foto" ? "image/jpeg,image/png" : "image/jpeg,image/png,application/pdf";
  ADJ_IN.click();
}
async function adjSet(k, f) {
  if (ADJ_BUSY) return;
  try {
    if (f.size > 5e6) throw 0;
    if (k === "foto") {
      if (!/^image\/(jpeg|png)$/.test(f.type)) throw 0;
      DW.foto = await fotoData(f);
    } else {
      if (!DOC_OK[f.type]) throw 0;
      DP[k] = f;
    }
  } catch (e) {
    return toast("Solo JPG, PNG o PDF de hasta 5 MB");
  }
  await adjAplicar();
}
async function adjDel(k) {
  if (ADJ_BUSY || !confirm("¿Eliminar este archivo?")) return;
  if (k === "foto") DW.foto = "";
  else DP[k] = null;
  await adjAplicar();
}
/* Ficha existente: el cambio se guarda al instante. Matrícula nueva / desde pre-registro: queda pendiente hasta "Guardar". */
async function adjAplicar() {
  if (!ED) return adjRefrescar();
  const a = S.alu.find((x) => x.id === ED);
  if (!a) return;
  ADJ_BUSY = true;
  const m = $("#adj_m");
  if (m) m.textContent = "Guardando…";
  try {
    await adjCommit(a.id);
    Object.assign(a, { foto: DW.foto, dnf: DW.dnf, dsg: DW.dsg, dfm: DW.dfm });
    save();
    adjLimpiar(a.id);
    toast("Archivos actualizados");
  } catch (e) {
    DWK = null;
    adjInit(a);
    toast("No se pudo subir el archivo (JPG, PNG o PDF de hasta 5 MB)");
  }
  ADJ_BUSY = false;
  adjRefrescar();
}
async function adjCommit(id) {
  for (const [k, t] of Object.entries(ADJ_T)) {
    const p = DP[k];
    if (p === undefined) continue;
    if (p instanceof File) {
      const n = await subirArch(p, id, t);
      if (DW[k]) DDEL.push(DW[k]);
      DW[k] = n;
    } else {
      if (DW[k]) DDEL.push(DW[k]);
      DW[k] = "";
    }
    delete DP[k];
  }
}
/* Borra de Storage lo reemplazado/eliminado, solo si la ficha guardada ya no lo referencia */
async function adjLimpiar(id) {
  const del = [...new Set(DDEL)].filter((x) => DOC_PATH.test(x || ""));
  DDEL = [];
  if (!del.length) return;
  try {
    await sv;
    const r = await sb(
      "/rest/v1/alumnos?id=eq." +
        encodeURIComponent(id) +
        "&select=doc_dni_frente,doc_seguro,doc_ficha",
    );
    if (!r.ok) return;
    const j = (await r.json())[0];
    if (!j) return;
    const en = new Set([j.doc_dni_frente, j.doc_seguro, j.doc_ficha]),
      b = del.filter((x) => !en.has(x));
    if (b.length)
      await sb("/storage/v1/object/documentos", {
        method: "DELETE",
        body: JSON.stringify({ prefixes: b }),
      });
  } catch (e) {}
}
/* Foto: recorte cuadrado centrado, 200x200 JPEG (se guarda en alumnos.foto como antes) */
function fotoData(f) {
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(f),
      im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(u);
      const s = Math.min(im.naturalWidth, im.naturalHeight);
      if (!s) return no();
      const c = document.createElement("canvas");
      c.width = c.height = 200;
      c.getContext("2d").drawImage(
        im,
        (im.naturalWidth - s) / 2,
        (im.naturalHeight - s) / 2,
        s,
        s,
        0,
        0,
        200,
        200,
      );
      const d = c.toDataURL("image/jpeg", 0.8);
      IMG_OK.test(d) ? ok(d) : no();
    };
    im.onerror = () => {
      URL.revokeObjectURL(u);
      no();
    };
    im.src = u;
  });
}
