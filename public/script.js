/* ==================================================================
   1. CONFIGURACIÓN, REFERENCIAS AL DOM Y UTILIDADES
   ================================================================== */
var K = "cdmt_erp_v2",
  Y = new Date().getFullYear(),
  $ = (s) => document.querySelector(s);

/* Referencias a los nodos estáticos de index.html */
var DOM = {
  app: $("#app"),
  mod: $("#mod"),
  toast: $("#toast"),
  video: $("#bgv"),
};
var v = (id) => {
  var e = document.getElementById(id);
  return e ? e.value.trim() : "";
};
var today = () => new Date().toISOString().slice(0, 10),
  money = (n) => "S/ " + (+n || 0).toFixed(2);
var esc = (s) =>
  String(s ?? "").replace(
    /[&<>"'`]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" })[c],
  );
var limpiar = (s, max = 80) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
var RX = {
    nombre: /^[\p{L}][\p{L} .'-]{0,59}$/u,
    dni: /^\d{8}$/,
    cel: /^\d{1,9}$/,
    mail: /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/,
    fecha: /^\d{4}-\d{2}-\d{2}$/,
  },
  IMG_OK = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]{0,200000}$/;
var LISTAS = {
  sex: ["M", "F"],
  mod: ["Formativo", "Competitivo"],
  con: ["Ninguna", "Media Beca", "Becado"],
  est: ["Activo", "Inactivo"],
};
var monto = (v) => {
  var n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 99999 ? Math.round(n * 100) / 100 : null;
};
/* ==================================================================
   2. VALIDACIÓN Y SANEAMIENTO DE DATOS
   ================================================================== */
function validarAlumno(f) {
  var d = {
      nom: limpiar(f.nom, 60),
      ape: limpiar(f.ape, 60),
      dni: limpiar(f.dni, 8),
      ac: limpiar(f.ac, 9),
      am: limpiar(f.am, 120).toLowerCase(),
      an: limpiar(f.an, 80),
      seg: limpiar(f.seg, 60),
      nac: limpiar(f.nac, 10),
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
  if (!RX.fecha.test(d.nac)) e.push("Fecha de nacimiento inválida");
  for (var k in LISTAS) if (!LISTAS[k].includes(d[k])) e.push("Valor no permitido en " + k);
  for (var k of ["cm", "cmen", "pag"]) {
    d[k] = monto(f[k]);
    if (d[k] === null) e.push("Monto inválido");
  }
  return { d, e };
}
function validarPago(f) {
  var m = monto(f.m),
    e = [];
  if (m === null || m <= 0) e.push("Monto inválido");
  if (!["I", "E"].includes(f.t)) e.push("Tipo inválido");
  return { d: { m, t: f.t, c: limpiar(f.c, 60), d: limpiar(f.d, 120) }, e };
}
var o = (a, val, ph) =>
  (ph !== undefined ? `<option value="">${ph}</option>` : "") +
  a
    .map(([x, y]) => `<option value="${esc(x)}"${x == val ? " selected" : ""}>${esc(y)}</option>`)
    .join("");
var fl = (l, h) => `<label>${l}${h}</label>`;
/* ==================================================================
   3. ESTADO DE LA APLICACIÓN Y DATOS SEMILLA
   ================================================================== */
var S,
  U = null,
  V = "home",
  ED = null,
  ES = null,
  EP = null,
  KS = 0,
  PRE = null,
  PREID = null,
  FRESH = null,
  PR = null,
  PF = { q: "", m: "" },
  PRN = null,
  KQ = "",
  KSEL = "",
  KNUM = "",
  LASTQ = "",
  LASTT = 0,
  CAM = null,
  FOTO = null,
  DF = {},
  AS = {};
 window.GM = today().slice(0, 7);
function seed() {
  var s = {
    c: { ALU: 3, "PER-ADM": 1, "PER-REC": 1, "PER-ENT": 1, HOR: 2 },
    sedes: [
      ["CSJ", "San Juan", 1200],
      ["EST", "Estete", 1500],
      ["CAN", "La Canchita", 800],
      ["UBA", "Ubatuba", 1000],
      ["PAC", "Pacific", 1300],
    ].map(([c, n, k]) => ({
      id: "SED-" + c,
      nombre: n,
      dir: "Trujillo",
      con: "",
      tipo: "Mensual",
      costo: k,
    })),
    deportes: [
      { id: "DEP-FUT", nombre: "Fútbol" },
      { id: "DEP-VOL", nombre: "Vóley" },
    ],
    personal: [
      {
        id: "PER-ADM-0001",
        nom: "Gerente General",
        dni: "00000001",
        tel: "",
        esp: "Gestión",
        rol: "ADM",
        precio: 0,
        activo: 1,
      },
      {
        id: "PER-REC-0001",
        nom: "Caja Principal",
        dni: "00000002",
        tel: "",
        esp: "Recepción",
        rol: "REC",
        precio: 0,
        activo: 1,
      },
      {
        id: "PER-ENT-0001",
        nom: "Profe Carlos Ruiz",
        dni: "00000003",
        tel: "999111222",
        esp: "Fútbol",
        rol: "ENT",
        precio: 20,
        activo: 1,
      },
    ],
    hor: [
      {
        id: "HOR-0001",
        sede: "SED-CSJ",
        dep: "DEP-FUT",
        cat: Y - 12,
        ini: "16:00",
        fin: "18:00",
        profs: ["PER-ENT-0001"],
      },
      {
        id: "HOR-0002",
        sede: "SED-EST",
        dep: "DEP-VOL",
        cat: Y - 14,
        ini: "16:00",
        fin: "18:00",
        profs: ["PER-ENT-0001"],
      },
    ],
    alu: [],
    asis: [],
    kits: [],
    caja: [],
  };
  var mk = (n, a, ap, dni, nac, h, seg, an, ac, pag) => ({
    id: `${String(Y).slice(2)}000${n}`,
    nom: a,
    ape: ap,
    dni,
    sex: "M",
    nac,
    dep: h.dep,
    sede: h.sede,
    hor: h.id,
    foto: "",
    seg,
    an,
    ac,
    am: "",
    con: "Ninguna",
    mod: "Formativo",
    est: "Activo",
    cm: 50,
    cmen: 90,
    mes: 2,
    pag,
    fecha: today(),
  });
  s.alu = [
    mk(
      1,
      "Luis",
      "Vega",
      "71234567",
      `${Y - 12}-03-10`,
      s.hor[0],
      "EsSalud",
      "Rosa Vega",
      "987654321",
      230,
    ),
    mk(2, "Mateo", "Rojas", "", `${Y - 12}-07-21`, s.hor[0], "", "Pedro Rojas", "", 50),
    mk(
      3,
      "Ana",
      "Paredes",
      "72345678",
      `${Y - 14}-01-15`,
      s.hor[1],
      "SIS",
      "Marta Paredes",
      "955444333",
      100,
    ),
  ];
  return s;
}
function load() {
  try {
    S = JSON.parse(sessionStorage.getItem(K));
  } catch (e) {}
  if (!S) {
    try {
      S = JSON.parse(sessionStorage.getItem("cdmt_erp_v1"));
    } catch (e) {}
    if (S) mig();
    else S = seed();
  }
}
function mig() {
  var m = {};
  S.alu.forEach((a) => {
    var n = a.id.match(/ALU-(\d{4})-(\d+)/),
      o = a.id;
    if (n) a.id = n[1].slice(2) + n[2];
    m[o] = a.id;
    if (a.mod === "Entrenamiento") a.mod = "Formativo";
  });
  S.caja.forEach((x) => {
    if (m[x.d]) x.d = m[x.d];
  });
  S.kits.forEach((k) => {
    if (m[k.aid]) k.aid = m[k.aid];
  });
  S.asis.forEach((x) => {
    if (x.t === "A" && m[x.ref]) x.ref = m[x.ref];
  });
  S.personal.forEach((p) => delete p.pass);
}
var nid = () => {
  var p = String(Y).slice(2);
  return (
    p +
    String(
      Math.max(0, ...S.alu.filter((a) => a.id.startsWith(p)).map((a) => +a.id.slice(2))) + 1,
    ).padStart(4, "0")
  );
};
var age = (d) => {
  var [y, m, x] = d.split("-").map(Number),
    t = new Date();
  return (
    t.getFullYear() -
    y -
    (t.getMonth() + 1 < m || (t.getMonth() + 1 == m && t.getDate() < x) ? 1 : 0)
  );
};
function ck(e) {
  if (e.dataset.d) e.value = e.value.replace(/\D/g, "");
  e.classList.toggle("bad", !e.value.trim());
}
/* ==================================================================
   4. CAPA DE DATOS (Supabase: autenticación, sincronización y respaldo)
   ================================================================== */
var SB = "https://wuoqjcqniacsassxhrvs.supabase.co",
  KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1b3FqY3FuaWFjc2Fzc3hocnZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzODc2MjgsImV4cCI6MjEwODk2MzYyOH0.q8JRxory1AKAVy4oLKkAKfHXvHzW18NMMNqm95H_uIM";
TK = null,
  RT = null,
  UID = null,
  EM = "",
  VER = 0,
  SN = {},
  busy = 0,
  sv = Promise.resolve();
async function sb(path, o = {}, retry = 1) {
  var r = await fetch(SB + path, {
    ...o,
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + (TK || KEY),
      "Content-Type": "application/json",
      ...(o.headers || {}),
    },
  });
  if (r.status === 401 && RT && retry) {
    await auth({ refresh_token: RT }, "refresh_token");
    return sb(path, o, 0);
  }
  return r;
}
async function auth(body, q) {
  var r = await fetch(SB + "/auth/v1/token?grant_type=" + q, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let e = {};
    try {
      e = await r.json();
    } catch (_) {}
    throw {
      st: r.status,
      c: e.error_code || e.code || "",
      m: e.msg || e.message || e.error_description || "",
    };
  }
  var j = await r.json();
  TK = j.access_token;
  RT = j.refresh_token;
  UID = j.user && j.user.id;
  EM = (j.user && j.user.email) || "";
  try {
    sessionStorage.setItem("cdmt_rt", RT);
  } catch (e) {}
}
async function sess() {
  var r = await sb(`/rest/v1/perfiles?select=rol&user_id=eq.${UID}`),
    j = await r.json();
  if (!r.ok || !j.length || j[0].rol !== "ADM") throw "rol";
  U = { id: "ADMIN", nom: EM, rol: "ADM" };
  V = "home";
}
var uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
var G = (n, a, c) => ({
  n,
  rows: () =>
    S[a].map((x) => {
      if ("_id" in c && !x._id) x._id = uid();
      var r = {};
      for (var f in c) {
        var v = x[f];
        r[c[f]] = v === "" || v === undefined ? null : v;
      }
      return r;
    }),
  load: (d) => {
    S[a] = d.map((r) => {
      var x = {};
      for (var f in c) {
        var v = r[c[f]];
        x[f] = v === null ? "" : v;
      }
      return x;
    });
  },
});
var HOR = G("horarios", "hor", {
  id: "id",
  sede: "sede_id",
  dep: "deporte_id",
  cat: "categoria",
  ini: "hora_inicio",
  fin: "hora_fin",
});
var TB = [
  G("sedes", "sedes", {
    id: "id",
    nombre: "nombre",
    dir: "direccion",
    con: "contacto",
    tipo: "tipo_alquiler",
    costo: "costo_mensual",
  }),
  G("deportes", "deportes", { id: "id", nombre: "nombre" }),
  G("personal", "personal", {
    id: "id",
    nom: "nombres",
    dni: "dni",
    tel: "telefono",
    esp: "especialidad",
    rol: "rol",
    precio: "precio_hora",
    activo: "activo",
  }),
  {
    ...HOR,
    load: (d) => {
      HOR.load(d);
      S.hor.forEach((h) => (h.profs = []));
    },
  },
  {
    n: "horario_profesores",
    rows: () =>
      S.hor.flatMap((h) =>
        (h.profs || []).map((p) => ({ id: h.id + "|" + p, horario_id: h.id, personal_id: p })),
      ),
    load: (d) =>
      d.forEach((r) => {
        var h = S.hor.find((h) => h.id === r.horario_id);
        if (h) h.profs.push(r.personal_id);
      }),
  },
  G("alumnos", "alu", {
    id: "id",
    nom: "nombres",
    ape: "apellidos",
    dni: "dni",
    sex: "sexo",
    nac: "fecha_nacimiento",
    dep: "deporte_id",
    sede: "sede_id",
    hor: "horario_id",
    foto: "foto",
    seg: "seguro",
    an: "apoderado",
    ac: "celular_apoderado",
    am: "correo_apoderado",
    con: "condicion",
    mod: "modalidad",
    est: "estado",
    cm: "costo_matricula",
    cmen: "costo_mensualidad",
    mes: "meses",
    pag: "monto_pagado",
    fecha: "fecha_registro",
    qt: "qr_token",
    dnf: "doc_dni_frente",
    dsg: "doc_seguro",
    dfm: "doc_ficha",
  }),
  {
    n: "asistencias",
    rows: () =>
      S.asis.map((x) => {
        if (!x._id) x._id = uid();
        return {
          id: x._id,
          fecha: x.f,
          tipo: x.t,
          alumno_id: x.t === "A" ? x.ref : null,
          personal_id: x.t === "P" ? x.ref : null,
          horario_id: x.h || null,
          asistio: x.ok === undefined ? null : x.ok,
          pago_campo: x.pc === undefined ? null : x.pc,
        };
      }),
    load: (d) => {
      S.asis = d.map((r) => ({
        _id: r.id,
        f: r.fecha,
        t: r.tipo,
        ref: r.alumno_id || r.personal_id,
        h: r.horario_id || "",
        ok: r.asistio === null ? undefined : r.asistio,
        pc: r.pago_campo === null ? undefined : r.pago_campo,
      }));
    },
  },
  G("kits_ventas", "kits", {
    _id: "id",
    code: "codigo",
    aid: "alumno_id",
    al: "alumno_nombre",
    sede: "sede_id",
    p: "prenda",
    t: "talla",
    n: "nombre_camiseta",
    u: "numero",
    f: "fecha_pedido",
    e: "fecha_entrega",
    pr: "precio_publico",
    c: "costo_confeccion",
  }),
  G("caja_movimientos", "caja", {
    _id: "id",
    f: "fecha",
    sede: "sede_id",
    t: "tipo",
    c: "concepto",
    d: "detalle",
    m: "monto",
    k: "origen",
  }),
  {
    n: "ajustes",
    rows: () => [{ id: "fee", valor: S.fee ?? 5 }],
    load: (d) => {
      var f = d.find((r) => r.id === "fee");
      S.fee = f ? f.valor : 5;
    },
  },
];
async function all(n) {
  let o = [],
    i = 0;
  for (;;) {
    var r = await sb(`/rest/v1/${n}?select=*&order=id&limit=1000&offset=${i}`);
    if (!r.ok) throw n;
    var j = await r.json();
    o = o.concat(j);
    if (j.length < 1000) return o;
    i += 1000;
  }
}
async function ver() {
  try {
    VER = (await (await sb("/rest/v1/erp_meta?id=eq.1&select=ver")).json())[0].ver;
  } catch (e) {}
}

async function pull() {
  var aj = await all("ajustes");
  if (!aj.length && U.rol === "ADM") {
    let old = null;
    try {
      old = (await (await sb("/rest/v1/erp_state?id=eq.1&select=data")).json())[0].data;
    } catch (e) {}
    S = old && old.sedes ? old : seed();
    SN = {};
    await flush();
    await ver();
    return;
  }
  S = {
    sedes: [],
    deportes: [],
    personal: [],
    hor: [],
    alu: [],
    asis: [],
    kits: [],
    caja: [],
    c: {},
  };
  
  try {
    for (var t of TB) {
      t.load(t.n === "ajustes" ? aj : await all(t.n));
    }
  } catch (e) {
    console.error("Error al cargar tablas de Supabase, usando datos locales", e);
  }
  
  // Si después de la consulta el arreglo de alumnos sigue vacío, cargamos los datos semilla para que no quede en 0
  if (!S.alu.length) {
    var seeded = seed();
    S.sedes = S.sedes.length ? S.sedes : seeded.sedes;
    S.deportes = S.deportes.length ? S.deportes : seeded.deportes;
    S.personal = S.personal.length ? S.personal : seeded.personal;
    S.hor = S.hor.length ? S.hor : seeded.hor;
    S.alu = seeded.alu;
  }

  SN = {};
  TB.forEach((t) => (SN[t.n] = new Map(t.rows().map((r) => [r.id, JSON.stringify(r)]))));
  await ver();
}

async function pull() {
  var aj = await all("ajustes");
  if (!aj.length && U.rol === "ADM") {
    let old = null;
    try {
      old = (await (await sb("/rest/v1/erp_state?id=eq.1&select=data")).json())[0].data;
    } catch (e) {}
    S = old && old.sedes ? old : seed();
    SN = {};
    await flush();
    await ver();
    return;
  }
  S = {
    sedes: [],
    deportes: [],
    personal: [],
    hor: [],
    alu: [],
    asis: [],
    kits: [],
    caja: [],
    c: {},
  };
  
  try {
    for (var t of TB) {
      t.load(t.n === "ajustes" ? aj : await all(t.n));
    }
  } catch (e) {
    console.error("Error al cargar tablas de Supabase", e);
  }
  
  // Si Supabase no devolvió alumnos, usamos los datos de respaldo (seed)
  if (!S.alu.length) {
    var seeded = seed();
    S.sedes = S.sedes.length ? S.sedes : seeded.sedes;
    S.deportes = S.deportes.length ? S.deportes : seeded.deportes;
    S.personal = S.personal.length ? S.personal : seeded.personal;
    S.hor = S.hor.length ? S.hor : seeded.hor;
    S.alu = seeded.alu;
  }

  SN = {};
  TB.forEach((t) => (SN[t.n] = new Map(t.rows().map((r) => [r.id, JSON.stringify(r)]))));
  await ver();
}
function save() {
  busy++;
  sv = sv.then(async () => {
    try {
      await flush();
      await ver();
    } catch (e) {
      console.error(e);
      if (e === "dup") {
        toast(
          "Otro equipo creó el mismo código a la vez. Se recargaron los datos: repite tu registro.",
        );
        try {
          await pull();
        } catch (_) {}
        R();
      } else toast("No se pudo guardar: revisa la conexión o tus permisos");
    }
    busy--;
  });
}
async function backup() {
  try {
    await pull();
  } catch (e) {}
  var o = {
      sistema: "ERP Consorcio Deportivo Madrid Trujillo",
      generado: new Date().toISOString(),
      tablas: Object.fromEntries(TB.map((t) => [t.n, t.rows()])),
    },
    a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(o, null, 1)], { type: "application/json" }),
  );
  a.download = `respaldo-cdmt-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Respaldo descargado");
}
var tok = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => (b % 36).toString(36)).join("");
var base = () => location.href.split("#")[0],
  carnetUrl = (a) => {
    if (!a.qt) {
      a.qt = tok();
      save();
    }
    return base() + "#c=" + a.qt;
  };
var DOC_OK = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
async function subirArch(f, carpeta, tipo) {
  var ext = DOC_OK[f.type];
  if (!ext || f.size > 5e6) throw "archivo";
  var path = `${carpeta}/${tipo}-${Date.now()}.${ext}`,
    r = await sb("/storage/v1/object/documentos/" + path, {
      method: "POST",
      headers: { "Content-Type": f.type },
      body: f,
    });
  if (!r.ok) throw "subida";
  return path;
}
async function verDoc(path) {
  var w = window.open("", "_blank");
  try {
    var r = await sb("/storage/v1/object/sign/documentos/" + path, {
      method: "POST",
      body: JSON.stringify({ expiresIn: 120 }),
    });
    if (!r.ok) throw 0;
    var j = await r.json(),
      u = SB + "/storage/v1" + j.signedURL;
    if (!w) return toast("Permite las ventanas emergentes para ver el archivo");
    w.opener = null;
    w.location.href = u;
  } catch (e) {
    if (w) w.close();
    toast("No se pudo abrir el documento");
  }
}
/* ==================================================================
   5. ARCHIVOS ADJUNTADOS (foto + 3 documentos)
   ================================================================== */
var DOC_PATH = /^(?!.*\.\.)[\w\-./]{3,160}\/(dni|seguro|ficha)-\d+\.(jpg|png|pdf)$/,
  PRE_OK = /^preregistro\/[a-z0-9]+\/(dni|seguro|ficha)-\d+\.(jpg|png|pdf)$/;
var ADJ = [
    ["foto", "Foto del alumno", "Foto"],
    ["dnf", "DNI (AMBOS LADOS)", "DNI"],
    ["dsg", "Documento del seguro médico", "Seguro"],
    ["dfm", "Ficha de notaría", "Ficha"],
  ],
  ADJ_T = { dnf: "dni", dsg: "seguro", dfm: "ficha" };
DW = null,
  DP = {},
  DWK = null,
  DDEL = [],
  ADJ_BUSY = false,
  ADJ_K = "",
  ADJ_IN = null;
/* DW = referencias vigentes (foto = data URL, resto = ruta en Storage). DP = cambios pendientes: File (reemplazo) o null (eliminar). */
function adjInit(a) {
  var k = ED || (PREID ? "pre:" + PREID : "nuevo");
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
var adjHas = (k) =>
  k === "foto" ? !!DW.foto : DP[k] === null ? false : DP[k] instanceof File || !!DW[k];
function adjBoton() {
  var f = ADJ.filter((x) => !adjHas(x[0]));
  return `<button data-f="adjAbrir" id=ad_b>Archivos adjuntados (${4 - f.length}/4)</button><span class="b ${f.length ? "no" : "ok"}">${f.length ? "Faltan: " + f.map((x) => x[2]).join(", ") : "Archivos completos"}</span>`;
}
function adjHtml(m = "") {
  var n = ADJ.filter((x) => adjHas(x[0])).length;
  return `<h3>Archivos adjuntados</h3><p class=mu>${n} de 4 cargados · JPG, PNG o PDF, máx. 5 MB${ED ? "" : " · se guardan al presionar Guardar"}</p><div class=adj>${ADJ.map(
    ([k, t]) => {
      var ok = adjHas(k),
        pd = DP[k] instanceof File;
      return `<div class="adj-i${ok ? "" : " miss"}"><div class=adj-h><b>${t}</b><span class="b ${ok ? "ok" : "no"}">${ok ? (pd ? "Cargado (pendiente de guardar)" : "Cargado") : "Faltante"}</span></div><div class=adj-a>${ok ? `<button class="s g" data-f=adjVer data-i=${k}>Ver</button>` : ""}<button class=s data-f=adjCamb data-i=${k}>${ok ? "Reemplazar" : "Subir"}</button>${ok ? `<button class="s r" data-f=adjDel data-i=${k}>Eliminar</button>` : ""}</div></div>`;
    },
  ).join("")}</div><p id=adj_m class=mu>${m}</p>`;
}
function adjRefrescar() {
  var r = $("#ad_r");
  if (r) r.innerHTML = adjBoton();
  if ($("#adj_m") && DOM.mod.classList.contains("o")) modal(adjHtml());
}
function abrirBlob(b) {
  var u = URL.createObjectURL(b);
  window.open(u, "_blank");
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}
function adjVer(k) {
  if (k === "foto") {
    var m = /^data:([^;]+);base64,(.*)$/.exec(DW.foto || "");
    if (!m) return;
    var b = atob(m[2]),
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
      var f = ADJ_IN.files && ADJ_IN.files[0];
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
  var a = S.alu.find((x) => x.id === ED);
  if (!a) return;
  ADJ_BUSY = true;
  var m = $("#adj_m");
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
  for (var [k, t] of Object.entries(ADJ_T)) {
    var p = DP[k];
    if (p === undefined) continue;
    if (p instanceof File) {
      var n = await subirArch(p, id, t);
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
  var del = [...new Set(DDEL)].filter((x) => DOC_PATH.test(x || ""));
  DDEL = [];
  if (!del.length) return;
  try {
    await sv;
    var r = await sb(
      "/rest/v1/alumnos?id=eq." +
        encodeURIComponent(id) +
        "&select=doc_dni_frente,doc_seguro,doc_ficha",
    );
    if (!r.ok) return;
    var j = (await r.json())[0];
    if (!j) return;
    var en = new Set([j.doc_dni_frente, j.doc_seguro, j.doc_ficha]),
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
    var u = URL.createObjectURL(f),
      im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(u);
      var s = Math.min(im.naturalWidth, im.naturalHeight);
      if (!s) return no();
      var c = document.createElement("canvas");
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
      var d = c.toDataURL("image/jpeg", 0.8);
      IMG_OK.test(d) ? ok(d) : no();
    };
    im.onerror = () => {
      URL.revokeObjectURL(u);
      no();
    };
    im.src = u;
  });
}
/* ==================================================================
   6. PRE-REGISTRO DE ALUMNOS (staff)
   ================================================================== */
var preAlu = (p) => ({
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
  var u = base() + "#prereg";
  modal(
    "<h3>Pre-registro para padres</h3>" +
      qr(u) +
      `<p class="mu u-break-all">${esc(u)}</p><div class="row u-jc-center"><button data-f="cpUrl">Copiar enlace</button><a href="${esc(u)}" target=_blank rel=noopener class="link-accent">Abrir formulario</a></div>`,
  );
}
async function contarPre() {
  if (!U) return;
  try {
    var r = await sb("/rest/v1/preregistros?select=id");
    if (!r.ok) return;
    PRN = (await r.json()).length;
    var e = $("#pb");
    if (e) e.textContent = PRN ? " (" + PRN + ")" : "";
  } catch (e) {}
}
setInterval(contarPre, 30000);
async function cargarPre() {
  try {
    var r = await sb("/rest/v1/preregistros?select=*&order=fecha_hora.asc,id.asc&limit=1000");
    PR = r.ok ? await r.json() : [];
  } catch (e) {
    PR = [];
  }
  PRN = PR.length;
  if (V === "pre") R();
}
var preL = () => {
  var q = PF.q.toLowerCase().trim();
  return (PR || []).filter(
    (p) =>
      (!PF.m || p.modalidad === PF.m) &&
      (!q ||
        (p.nombres + " " + p.apellidos + " " + (p.dni || "") + " " + (p.apoderado || ""))
          .toLowerCase()
          .includes(q)),
  );
};
var preT = () =>
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
        `<tr><td>${i + 1}</td><td>${esc(new Date(p.fecha_hora).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }))}</td><td><span class="b ${p.modalidad === "Presencial" ? "ok" : "no"}">${esc(p.modalidad)}</span></td><td>${esc(p.nombres + " " + p.apellidos)}</td><td>${esc(p.dni || "")}</td><td>${esc(dn(p.deporte_id))} / ${esc(sn(p.sede_id))}</td><td>${esc(p.apoderado || "")}</td><td>${esc(p.celular_apoderado || "")}</td><td><span class="b ${preN(p) === 4 ? "ok" : "no"}">${preN(p)}/4</span></td><td><button class=s data-f="preOk" data-i="${esc(p.id)}">Aceptar</button> <button class="s r" data-f="preDel" data-i="${esc(p.id)}">Eliminar</button></td></tr>`,
    ),
  );
var preF = () => {
  $("#pt").innerHTML = preT();
};
var vwPre = () =>
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
  var l = [p.doc_dni_frente, p.doc_seguro, p.doc_ficha].filter((x) => PRE_OK.test(x || ""));
  if (l.length)
    sb("/storage/v1/object/documentos", {
      method: "DELETE",
      body: JSON.stringify({ prefixes: l }),
    }).catch(() => {});
}
async function preDel(id) {
  if (!confirm("¿Eliminar este pre-registro y sus archivos?")) return;
  var q = (PR || []).find((x) => x.id === id),
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
var ocup = (a) => {
  var y = +a.nac.slice(0, 4),
    o = new Set();
  if (a.mod !== "Competitivo") return o;
  S.kits.forEach((k) => {
    var b = S.alu.find((x) => x.id === k.aid);
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
var matriz = (a) => {
  var oc = ocup(a);
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
var kSelHtml = () => {
  var a = S.alu.find((x) => x.id === KSEL);
  if (!a) return "";
  return `<div class="card u-col-full u-m-0"><b>${esc(a.nom + " " + a.ape)}</b> · ${esc(a.id)} · DNI ${esc(a.dni || "sin DNI")}<br><span class=mu>${esc(dn(a.dep))} · CAT-${esc(a.nac.slice(0, 4))} · ${esc(a.mod)}</span><p class="mu u-m-6-0">${a.mod === "Competitivo" ? "Los números en rojo ya están usados en su categoría o en las de ±2 años y no se pueden elegir." : "Modalidad formativo: no hay restricción de números."}</p>${matriz(a)}</div>`;
};
var kRes = () => {
  var q = KQ.toLowerCase().trim(),
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
/* ==================================================================
   8. CÁMARA Y LECTURA DE CÓDIGOS QR
   ================================================================== */
CAMID = 0,
  CAMN = 0,
  CAMLAST = 0,
  CAMT0 = 0,
  CAMHIT = false,
  CAMC = null,
  CAMX = null;
function stopCam() {
  CAMID++;
  if (CAM) {
    CAM.getTracks().forEach((t) => t.stop());
    CAM = null;
  }
}
async function scan() {
  modal(
    '<h3>Escanear asistencia</h3><video id=cv playsinline muted autoplay class="scan-video"></video><p id=cs class=mu>Apunta la cámara al QR del carnet</p>',
  );
  stopCam();
  var id = CAMID;
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      throw new Error("sin-mediadevices");
    let st;
    try {
      st = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
    } catch (e) {
      if (
        e &&
        (e.name === "OverconstrainedError" ||
          e.name === "ConstraintNotSatisfiedError" ||
          e.name === "TypeError")
      )
        st = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "environment" },
        });
      else throw e;
    }
    if (id !== CAMID) {
      st.getTracks().forEach((t) => t.stop());
      return;
    }
    CAM = st;
    var tr = st.getVideoTracks()[0];
    try {
      var cp = tr.getCapabilities ? tr.getCapabilities() : {},
        adv = {};
      if (cp.focusMode && cp.focusMode.includes("continuous")) adv.focusMode = "continuous";
      if (cp.exposureMode && cp.exposureMode.includes("continuous"))
        adv.exposureMode = "continuous";
      if (cp.whiteBalanceMode && cp.whiteBalanceMode.includes("continuous"))
        adv.whiteBalanceMode = "continuous";
      if (Object.keys(adv).length) await tr.applyConstraints({ advanced: [adv] });
    } catch (_) {}
    var v = $("#cv");
    v.srcObject = st;
    v.setAttribute("playsinline", "");
    v.muted = true;
    await v.play();
    if (id !== CAMID) return;
    CAMN = 0;
    CAMLAST = 0;
    CAMHIT = false;
    CAMT0 = Date.now();
    if (!CAMC) {
      CAMC = document.createElement("canvas");
      CAMX = CAMC.getContext("2d", { willReadFrequently: true });
    }
    loopCam(id);
  } catch (e) {
    stopCam();
    var m = $("#cs");
    if (m)
      m.textContent =
        "No se pudo abrir la cámara. Permite el acceso en el navegador (requiere HTTPS).";
  }
}
function camGrab(v, sx, sy, sw, sh, maxW) {
  var k = Math.min(1, maxW / sw),
    tw = Math.max(1, Math.round(sw * k)),
    th = Math.max(1, Math.round(sh * k));
  if (CAMC.width !== tw) CAMC.width = tw;
  if (CAMC.height !== th) CAMC.height = th;
  CAMX.imageSmoothingEnabled = true;
  CAMX.imageSmoothingQuality = "high";
  CAMX.drawImage(v, sx, sy, sw, sh, 0, 0, tw, th);
  return CAMX.getImageData(0, 0, tw, th);
}
function camStretch(im) {
  var d = im.data,
    n = d.length >> 2,
    h = new Uint32Array(256),
    g = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    var y = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    g[i] = y;
    h[y]++;
  }
  let a = 0,
    lo = 0,
    hi = 255;
  var c = n * 0.02;
  for (let k = 0; k < 256; k++) {
    a += h[k];
    if (a >= c) {
      lo = k;
      break;
    }
  }
  a = 0;
  for (let k = 255; k >= 0; k--) {
    a += h[k];
    if (a >= c) {
      hi = k;
      break;
    }
  }
  if (hi - lo < 30) return im;
  var f = 255 / (hi - lo);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let y = (g[i] - lo) * f;
    y = y < 0 ? 0 : y > 255 ? 255 : y;
    d[j] = d[j + 1] = d[j + 2] = y;
  }
  return im;
}
function loopCam(id) {
  if (id !== CAMID || !CAM) return;
  var v = $("#cv");
  if (!v) return;
  var again = () => {
    if (id !== CAMID || !CAM) return;
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => loopCam(id));
    else setTimeout(() => loopCam(id), 100);
  };
  var now = performance.now();
  if (now - CAMLAST < 110 || v.readyState < 2 || !v.videoWidth || !window.jsQR || v.paused) {
    if (v.paused) v.play().catch(() => {});
    return again();
  }
  CAMLAST = now;
  try {
    var W = v.videoWidth,
      H = v.videoHeight,
      p = CAMN++ % 3;
    let im,
      q = null;
    if (p === 0) {
      im = camGrab(v, 0, 0, W, H, 1280);
      q = jsQR(im.data, im.width, im.height, { inversionAttempts: "dontInvert" });
    } else if (p === 1) {
      im = camGrab(v, 0, 0, W, H, 560);
      q = jsQR(im.data, im.width, im.height, { inversionAttempts: "dontInvert" });
    } else {
      var s = Math.round(Math.min(W, H) * 0.8),
        sx = (W - s) >> 1,
        sy = (H - s) >> 1;
      im = camStretch(camGrab(v, sx, sy, s, s, 720));
      q = jsQR(im.data, im.width, im.height, { inversionAttempts: "attemptBoth" });
    }
    if (q && q.data) {
      CAMHIT = true;
      qrLeido(q.data);
    } else if (!CAMHIT && Date.now() - CAMT0 > 8000) {
      var m = $("#cs");
      if (m && m.dataset.h !== "1") {
        m.dataset.h = "1";
        m.textContent =
          "Sin lectura: sube el brillo de la pantalla, aleja el celular 20–30 cm y evita reflejos";
      }
    }
  } catch (e) {}
  again();
}
function qrLeido(t) {
  var m = /#c=([a-z0-9]{16})/.exec(String(t));
  if (!m) {
    var z = $("#cs");
    if (z) z.textContent = "QR leído, pero no es un carnet de la academia";
    return;
  }
  var n = Date.now();
  if (m[1] === LASTQ && n - LASTT < 4000) return;
  LASTQ = m[1];
  LASTT = n;
  var e = $("#cs"),
    a = S.alu.find((x) => x.qt === m[1]);
  if (!a) {
    e.textContent = "QR no reconocido";
    return;
  }
  if (a.est !== "Activo" || !a.hor) {
    e.textContent = a.nom + " " + a.ape + ": inactivo o sin horario asignado";
    return;
  }
  var x = S.asis.find((x) => x.f === today() && x.t === "A" && x.ref === a.id && x.h === a.hor);
  if (x && x.ok === true) {
    e.textContent = "Ya registrado hoy: " + a.nom + " " + a.ape;
    return;
  }
  if (x) x.ok = true;
  else S.asis.push({ f: today(), t: "A", ref: a.id, h: a.hor, ok: true });
  save();
  e.classList.add("u-accent");
  e.textContent = "Asistencia registrada: " + a.nom + " " + a.ape;
  toast("Asistencia registrada: " + a.nom + " " + a.ape);
  try {
    navigator.vibrate(80);
  } catch (_) {}
  R();
}
var QFIN = null;
function qrFotoAbrir() {
  if (!QFIN) {
    QFIN = document.createElement("input");
    QFIN.type = "file";
    QFIN.accept = "image/*";
    QFIN.setAttribute("capture", "environment");
    QFIN.className = "offscreen-file-input";
    QFIN.addEventListener("change", () => {
      var f = QFIN.files && QFIN.files[0];
      QFIN.value = "";
      if (f) qrFoto(f);
    });
    document.body.appendChild(QFIN);
  }
  QFIN.click();
}
async function qrDecodeFoto(f) {
  let bmp = null;
  try {
    bmp = await createImageBitmap(f);
  } catch (_) {
    bmp = await new Promise((ok, no) => {
      var u = URL.createObjectURL(f),
        im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(u);
        ok(im);
      };
      im.onerror = () => {
        URL.revokeObjectURL(u);
        no(new Error("img"));
      };
      im.src = u;
    });
  }
  try {
    var W = bmp.naturalWidth || bmp.width,
      H = bmp.naturalHeight || bmp.height;
    if ("BarcodeDetector" in window) {
      try {
        var d = new BarcodeDetector({ formats: ["qr_code"] }),
          r = await d.detect(bmp);
        if (r.length && r[0].rawValue) return r[0].rawValue;
      } catch (_) {}
    }
    if (!window.jsQR) return null;
    var c = document.createElement("canvas"),
      x = c.getContext("2d", { willReadFrequently: true });
    for (var [mw, st] of [
      [1600, 0],
      [900, 0],
      [500, 0],
      [1200, 1],
      [700, 1],
    ]) {
      var k = Math.min(1, mw / Math.max(W, H)),
        tw = Math.max(1, Math.round(W * k)),
        th = Math.max(1, Math.round(H * k));
      c.width = tw;
      c.height = th;
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = "high";
      x.drawImage(bmp, 0, 0, tw, th);
      let im = x.getImageData(0, 0, tw, th);
      if (st) im = camStretch(im);
      var q = jsQR(im.data, tw, th, { inversionAttempts: st ? "attemptBoth" : "dontInvert" });
      if (q && q.data) return q.data;
      await new Promise((r) => setTimeout(r, 0));
    }
    return null;
  } finally {
    if (bmp.close) bmp.close();
  }
}
async function qrFoto(f) {
  stopCam();
  modal(
    '<h3>Escanear asistencia</h3><p id=cs class=mu>Procesando foto…</p><div class="row u-jc-center"><button data-f=qrFotoAbrir>Escanear otro</button></div>',
  );
  var cs = $("#cs");
  let t = null;
  try {
    t = await qrDecodeFoto(f);
  } catch (e) {}
  if (!DOM.mod.classList.contains("o") || $("#cs") !== cs) return;
  if (!t) {
    cs.textContent =
      "No se detectó ningún QR. Enfoca bien, llena el cuadro con el código, sube el brillo de la pantalla y evita reflejos. Intenta de nuevo.";
    return;
  }
  LASTT = 0;
  qrLeido(t);
}
/* ==================================================================
   9. PÁGINAS PÚBLICAS (carnet digital y formulario de pre-registro)
   ================================================================== */
async function pubCarnet(t) {
  DOM.app.innerHTML = `<main class=login><section class="card u-text-center"><img src="${LOGO}" class=lg alt="CDMT"><p class=mu>Cargando carnet...</p></section></main>`;
  let a = null;
  try {
    var r = await sb("/rest/v1/rpc/carnet_publico", {
      method: "POST",
      body: JSON.stringify({ t }),
    });
    a = (await r.json())[0];
  } catch (e) {}
  DOM.app.innerHTML = `<main class=login><section class="card u-text-center"><img src="${LOGO}" class=lg alt="CDMT">${a ? `${IMG_OK.test(a.foto || "") ? `<img src="${esc(a.foto)}" width=110 height=110 class="carnet-photo">` : ""}<h3 class="u-m-10-0-2">${esc(a.nombres + " " + a.apellidos)}</h3><p class="u-m-0">Código <b>${esc(a.codigo)}</b></p><p class="mu u-m-4-0">${esc(a.deporte || "")} · CAT-${esc(a.categoria || "")} · ${esc(a.sede || "")}</p><span class="b ${a.estado === "Activo" ? "ok" : "no"}">${esc(a.estado || "")}</span><p class="mu u-mt-12">Carnet digital oficial del Consorcio Deportivo Madrid Trujillo</p>` : "<p>Carnet no encontrado.</p>"}</section></main>`;
}
async function pubPre() {
  document.title = "Pre-registro | CDMT";
  DOM.app.innerHTML = `<main class=login><section class=card><img src="${LOGO}" class=lg alt="CDMT"><p class=mu>Cargando formulario...</p></section></main>`;
  let cat = [];
  try {
    cat = await (await sb("/rest/v1/catalogo_publico?select=*")).json();
  } catch (e) {}
  var op = (t) =>
    o(
      cat.filter((x) => x.tipo === t).map((x) => [x.id, x.nombre]),
      "",
      "Elige",
    );
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
  )}${fl("Fecha de nacimiento", "<input id=pp_f type=date>")}${fl("Deporte", "<select id=pp_dp>" + op("D") + "</select>")}${fl("Sede", "<select id=pp_sd>" + op("S") + "</select>")}${fl("Apoderado", "<input id=pp_ap>")}${fl("Celular del apoderado", "<input id=pp_c maxlength=9 inputmode=numeric data-in=digits>")}${fl("Correo", "<input id=pp_e type=email>")}${fl("Seguro médico (opcional)", "<input id=pp_sg>")}<h4 class="u-m-10-0-0">Documentos del alumno <span class="mu u-fw-400">(JPG, PNG o PDF · máx. 5 MB cada uno)</span></h4>${fl("Foto del alumno", '<input type=file id=pp_fo accept="image/jpeg,image/png">')}${fl("DNI (AMBOS LADOS)", '<input type=file id=pp_dn accept="image/jpeg,image/png,application/pdf">')}${fl("Seguro médico (documento)", '<input type=file id=pp_sf accept="image/jpeg,image/png,application/pdf">')}${fl("Ficha de notaría", '<input type=file id=pp_fm accept="image/jpeg,image/png,application/pdf">')}<input id=pp_w class="u-hidden" tabindex=-1 autocomplete=off></div><div class=row><button id=pp_b data-f=enviarPre>Enviar pre-registro</button></div></section></main>`;
}
async function enviarPre() {
  if (v("pp_w")) return;
  var { d, e } = validarAlumno({
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
  var b = $("#pp_b"),
    fs = {
      foto: $("#pp_fo").files[0],
      dnf: $("#pp_dn").files[0],
      dsg: $("#pp_sf").files[0],
      dfm: $("#pp_fm").files[0],
    };
  for (var k in fs) {
    var f = fs[k];
    if (!f) continue;
    if (f.size > 5e6) return toast("Cada archivo debe pesar máximo 5 MB");
    if (!(k === "foto" ? /^image\/(jpeg|png)$/.test(f.type) : DOC_OK[f.type]))
      return toast(
        k === "foto" ? "La foto debe ser JPG o PNG" : "Los documentos deben ser JPG, PNG o PDF",
      );
  }
  var pid = uid(),
    tx = b.textContent;
  b.disabled = true;
  try {
    let foto = null;
    var ps = {};
    if (fs.foto) {
      b.textContent = "Procesando foto...";
      foto = await fotoData(fs.foto);
    }
    for (var [k, t] of [
      ["dnf", "dni"],
      ["dsg", "seguro"],
      ["dfm", "ficha"],
    ])
      if (fs[k]) {
        b.textContent = "Subiendo archivos...";
        ps[k] = await subirArch(fs[k], "preregistro/" + pid, t);
      }
    b.textContent = "Enviando...";
    var r = await sb("/rest/v1/preregistros", {
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
    if (!r.ok) throw 0;
    DOM.app.innerHTML = `<main class=login><section class="card u-text-center"><img src="${LOGO}" class=lg alt="CDMT"><h3>Pre-registro enviado</h3><p>Gracias. Presenta tu DNI en la sede para confirmar la matrícula.</p></section></main>`;
  } catch (x) {
    b.disabled = false;
    b.textContent = tx;
    toast("No se pudo enviar. Revisa tus archivos e intenta de nuevo.");
  }
}
/* ==================================================================
   10. NAVEGACIÓN LATERAL, RESTAURACIÓN, SESIÓN Y ARRANQUE
   ================================================================== */
SIDE =
  innerWidth > 900 &&
  (() => {
    try {
      return localStorage.getItem("cdmt_side") !== "0";
    } catch (e) {
      return true;
    }
  })();
var sideHtml = () =>
  `<aside class="side ${SIDE ? "" : "off"}"><nav aria-label="Módulos"><i class=side-pill></i>${M.filter(
    (x) => x[3].includes(U.rol) && !x[5],
  )
    .map(
      (x) =>
        `<button class="si ${x[0] === V ? "on" : ""}" ${x[0] === V ? 'aria-current="page"' : ""} data-f="nav" data-i="${x[0]}">${ico(x[4], 20)}<span>${x[1]}</span></button>`,
    )
    .join("")}</nav></aside>`;
function tgSide() {
  SIDE = !SIDE;
  try {
    localStorage.setItem("cdmt_side", SIDE ? "1" : "0");
  } catch (e) {}
  var a = $(".side");
  if (a) a.classList.toggle("off", !SIDE);
  var nv = $(".side nav");
  if (nv && nv._pl) requestAnimationFrame(nv._pl);
}
async function boot() {
  var h = location.hash;
  if (/^#c=[a-z0-9]{16}$/.test(h)) return pubCarnet(h.slice(3));
  if (h === "#prereg") return pubPre();

  // 1. Cargar datos locales o semilla de inmediato para que la pantalla NUNCA nazca en 0
  load();

  try {
    RT = sessionStorage.getItem("cdmt_rt");
    if (RT && !KEY.startsWith("PEGA")) {
      await auth({ refresh_token: RT }, "refresh_token");
      await sess();
      
      // Pintar de inmediato con lo que hay en memoria en el navegador
      R(); 

      // 2. Sincronizar datos frescos de Supabase en segundo plano
      await pull();
    }
  } catch (e) {
    U = null;
  }

  // 3. Renderizado final con los datos ya sincronizados con Supabase
  R();
}
setInterval(async () => {
  if (!U || document.hidden || V === "mat" || busy) return;
  var a = document.activeElement;
  if (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  try {
    var j = await (await sb("/rest/v1/erp_meta?id=eq.1&select=ver")).json();
    if (j[0] && j[0].ver > VER) {
      await pull();
      R();
    }
  } catch (e) {}
}, 20000);
/* ==================================================================
   11. HELPERS DE NEGOCIO Y UI (toast, modal, QR, exportar a Excel)
   ================================================================== */
var nx = (k, p) => {
  var L = k === "HOR" ? S.hor : S.personal.filter((x) => x.id.startsWith(k + "-"));
  return String(Math.max(0, ...L.map((x) => +x.id.split("-").pop())) + 1).padStart(p, "0");
};
var cats = () => {
  var r = [];
  for (let y = Y - 17; y <= Y - 5; y++) r.push(y);
  return r;
};
var catOk = (y) => y >= Y - 17 && y <= Y - 5;
var sn = (id) => (S.sedes.find((x) => x.id === id) || {}).nombre || "-",
  dn = (id) => (S.deportes.find((x) => x.id === id) || {}).nombre || "-";
var hrs = (h) => {
  var t = (x) => +x.slice(0, 2) + x.slice(3) / 60;
  return Math.max(0, t(h.fin) - t(h.ini));
};
var hl = (h) =>
  `${esc(sn(h.sede))} · ${esc(dn(h.dep))} ${esc(h.cat)} · ${esc(h.ini)}-${esc(h.fin)}`;
var falta = (a) => {
  var f = [];
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
var deuda = (a) => (+a.cm || 0) + (+a.cmen || 0) * (+a.mes || 0) - (+a.pag || 0);
function toast(m) {
  var t = DOM.toast;
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 2600);
}
var cl = () => {
  stopCam();
  DOM.mod.classList.remove("o", "rcm");
};
var modal = (h) => {
  DOM.mod.innerHTML = `<div class=card>${h}<div class="row u-jc-center"><button class=g data-f=cl>Cerrar</button></div></div>`;
  DOM.mod.classList.add("o");
};
var qr = (t) => {
  try {
    var q = qrcode(0, "M");
    q.addData(t);
    q.make();
    return '<div class="qr-box">' + q.createSvgTag(6) + "</div>";
  } catch (e) {
    return "<p class=mu>(" + esc(t) + ")</p>";
  }
};
var XL = {
  sedes: () => [
    ["Código", "Sede", "Dirección", "Contacto", "Tipo de alquiler", "Alquiler mensual (S/)"],
    S.sedes.map((s) => [s.id, s.nombre, s.dir, s.con, s.tipo, +s.costo]),
  ],
  personal: () => [
    [
      "Código",
      "DNI",
      "Nombres",
      "Teléfono",
      "Especialidad",
      "Rol",
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
      p.esp,
      p.rol,
      +p.precio,
      +hsem(p).toFixed(1),
      +(hsem(p) * p.precio).toFixed(2),
      p.activo ? "Activo" : "Inactivo",
    ]),
  ],
  hor: () => [
    ["Código", "Sede", "Deporte", "Categoría", "Inicio", "Fin", "Profesores"],
    S.hor.map((h) => [
      h.id,
      sn(h.sede),
      dn(h.dep),
      "CAT-" + h.cat,
      h.ini,
      h.fin,
      h.profs.map((x) => (S.personal.find((p) => p.id === x) || {}).nom).join(", "),
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
    ].concat(KS ? ["Costo (S/)", "Utilidad (S/)"] : []),
    S.kits.map((k) =>
      [k.code, k.al, k.p, k.t, k.n, k.u, k.f, k.e, +k.pr].concat(KS ? [+k.c, k.pr - k.c] : []),
    ),
  ],
  caja: () => {
    var s = AS.cs || S.sedes[0].id;
    return [
      ["Fecha", "Sede", "Tipo", "Concepto", "Detalle", "Monto (S/)"],
      S.caja
        .filter((x) => x.sede === s)
        .map((x) => [x.f, sn(x.sede), x.t === "I" ? "Ingreso" : "Egreso", x.c, x.d, +x.m]),
    ];
  },
};
function cp(k) {
  var [h, r0] = XL[k](),
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
var IC = {
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
var ico = (k, z = 34) =>
  `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
var M = [
  ["sedes", "Sedes y Alquileres", "Sedes de terceros y costos fijos", ["ADM"], "sedes"],
  ["personal", "Personal y Planillas", "Entrenadores, horas y pago", ["ADM"], "personal"],
  ["horarios", "Horarios y Categorías", "Sede, deporte, categoría y hora", ["ADM"], "horarios"],
  ["mat", "Matrículas y Alumnos", "Ficha del alumno y carnet", ["ADM", "REC"], "mat"],
  ["dir", "Directorio de Alumnos", "Búsqueda, filtros y semáforo", ["ADM", "REC"], "dir"],
  ["asis", "Toma de Asistencias", "Asistencia y pago de campo", ["ADM", "REC", "ENT"], "asis"],
  ["kits", "Ventas de Indumentaria", "Kits, tallas y entregas", ["ADM", "REC"], "kits"],
  ["caja", "Caja Chica y Finanzas", "Ingresos, egresos y saldo", ["ADM", "REC"], "caja"],
  ["ger", "Dashboard Gerencial", "Utilidad neta por sede", ["ADM"], "ger"],
  ["pre", "Pre-registro", "Solicitudes de los padres", ["ADM"], "pre", 1],
];
var go = (x) => {
  V = x;
  if (innerWidth <= 900) SIDE = false;
  ED = ES = EP = null;
  FOTO = null;
  DWK = null;
  PRE = PREID = FRESH = null;
  if (x === "pre") PR = null;
  R();
  if (x === "pre") cargarPre();
};
var LOGO = "assets/logo.png";
var SHIRT_SRC = "assets/shirt.png";
var sha = async (t) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
/* ==================================================================
   13. LOGIN Y RENDER PRINCIPAL
   ================================================================== */
function login() {
  return `<main class=login><section class=card><img src="${LOGO}" alt="Consorcio Deportivo Madrid Trujillo" class=lg><div class="fg fg--single">${fl("Usuario", "<input id=lu autocomplete=username autofocus>")}${fl("Contraseña", '<div class=pw><input id=lp type=password autocomplete=current-password data-kd=enterLogin><button type=button class=eye aria-label="Mostrar u ocultar contraseña" data-f=eye><svg width=22 height=22 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2 stroke-linecap=round><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx=12 cy=12 r=3 /><path id=sl d="M3 3l18 18"/></svg></button></div>')}</div><div class=row><button id=lb data-f=doLogin>Iniciar sesión</button></div></section><div id=ball class=ball><svg viewBox="0 0 100 100" aria-label="Cargando"><defs><radialGradient id="bgr" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e3e7ea"/><stop offset="1" stop-color="#aab2b9"/></radialGradient><clipPath id="bcl"><circle cx="50" cy="50" r="46"/></clipPath></defs><circle cx="50" cy="50" r="46" fill="url(#bgr)"/><g clip-path="url(#bcl)" fill="#1f252b" stroke="#1f252b" stroke-width="1.4" stroke-linejoin="round"><polygon points="50.0,37.0 62.4,46.0 57.6,60.5 42.4,60.5 37.6,46.0"/><polygon points="50.0,18.0 37.6,9.0 42.4,-5.5 57.6,-5.5 62.4,9.0"/><polygon points="80.4,40.1 85.2,25.6 100.4,25.6 105.2,40.1 92.8,49.1"/><polygon points="68.8,75.9 84.1,75.9 88.8,90.4 76.5,99.4 64.1,90.4"/><polygon points="31.2,75.9 35.9,90.4 23.5,99.4 11.2,90.4 15.9,75.9"/><polygon points="19.6,40.1 7.2,49.1 -5.2,40.1 -0.4,25.6 14.8,25.6"/><path fill="none" d="M50.0 37.0L50.0 18.0M62.4 46.0L80.4 40.1M57.6 60.5L68.8 75.9M42.4 60.5L31.2 75.9M37.6 46.0L19.6 40.1M37.6 9.0L92.8 49.1M85.2 25.6L64.1 90.4M84.1 75.9L15.9 75.9M35.9 90.4L14.8 25.6M7.2 49.1L62.4 9.0"/></g><ellipse cx="36" cy="30" rx="16" ry="9" fill="#fff" opacity=".35" transform="rotate(-30 36 30)"/><circle cx="50" cy="50" r="46" fill="none" stroke="#8d969e" stroke-width="1.5"/></svg><span>Autenticando...</span></div></main>`;
}
function eye() {
  var p = $("#lp"),
    h = p.type === "password";
  p.type = h ? "text" : "password";
  $("#sl").classList.toggle("u-hidden", h);
}
async function doLogin() {
  var b = $("#lb"),
    l = $("#ball");
  if (b.disabled) return;
  b.disabled = true;
  b.textContent = "Verificando...";
  l.classList.add("on");
  await doLogin2();
  if ($("#lb")) {
    b.disabled = false;
    b.textContent = "Iniciar sesión";
    l.classList.remove("on");
  }
}
async function doLogin2() {
  if (KEY.startsWith("PEGA"))
    return toast("Falta pegar la clave pública de Supabase en el archivo");
  try {
    await auth({ email: v("lu").toLowerCase(), password: $("#lp").value }, "password");
  } catch (e) {
    console.error("login", e);
    return toast(
      !e || !e.st
        ? "No se pudo conectar con Supabase. Revisa tu internet o si el proyecto está pausado."
        : e.c === "email_not_confirmed" || /not confirmed/i.test(e.m)
          ? "El correo de este usuario no está confirmado en Supabase."
          : /api key|apikey/i.test(e.m)
            ? "La clave pública de Supabase en el archivo es incorrecta."
            : e.st === 400 || e.st === 401
              ? "Usuario o contraseña incorrectos."
              : "Error " + e.st + " al iniciar sesión: " + (e.m || ""),
    );
  }
  try {
    await sess();
  } catch (e) {
    return toast("Este usuario no tiene permiso para entrar al sistema.");
  }
  try {
    await pull();
  } catch (e) {
    console.error(e);
    U = null;
    return toast("No se pudo leer la base de datos. ¿Ejecutaste el script SQL?");
  }
  R();
}
var out = () => {
  U = null;
  TK = RT = null;
  KS = 0;
  V = "home";
  try {
    sessionStorage.removeItem("cdmt_rt");
  } catch (e) {}
  R();
};
function R() {
  var a = DOM.app;
  if (!U) {
    NAVF = true;
    a.innerHTML = login();
    postR();
    return;
  }
  var m = M.find((x) => x[0] === V);
  if (m && !m[3].includes(U.rol)) V = "home";
  NAVF = V !== LASTV;
  a.innerHTML = `<header>${V !== "home" ? '<button class="g ib" data-f=tgSide aria-label="Mostrar u ocultar el menú lateral"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>' : ""}<img src="${LOGO}" alt="Consorcio Deportivo Madrid Trujillo" class=hl data-f=go data-i=home><span class=sp></span><span class=mu>${esc(U.nom)}</span>${V !== "home" ? "<button class=g data-f=go data-i=home>← Menú</button>" : ""}<button class=g data-f=out>Salir</button></header><div class=shell>${V === "home" ? "" : sideHtml()}<main class="${V === "home" ? "hm" : ""}">${V === "home" ? home() : `<h2 class=h2><span class=hi>${ico(m[4], 28)}</span> ${m[1]}</h2>` + VW[V]()}</main></div>${U ? "<button class=fab data-f=go data-i=pre>PRE-REGISTRO<span id=pb>" + (PRN ? " (" + PRN + ")" : "") + "</span></button>" : ""}`;
  if (PRN === null) {
    PRN = 0;
    contarPre();
  }
  if (V === "mat") {
    FOTO = ED ? S.alu.find((x) => x.id === ED).foto : "";
    upHor();
  }
  postR();
}
/* ==================================================================
   14. DASHBOARD Y GRÁFICOS
   ================================================================== */
var MS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
var CS = { u: null, m: null, r: 6, v: "d", mo: today().slice(0, 7) };
var uMes = (m) => {
  var c = S.caja.filter((x) => x.f.startsWith(m)),
    ing = c.filter((x) => x.t === "I").reduce((t, x) => t + x.m, 0),
    eg = c.filter((x) => x.t === "E").reduce((t, x) => t + x.m, 0),
    kc = S.kits.filter((k) => k.f.startsWith(m)).reduce((t, k) => t + k.c, 0),
    pl = S.asis
      .filter((x) => x.t === "P" && x.ok && x.f.startsWith(m))
      .reduce((t, x) => {
        var h = S.hor.find((h) => h.id === x.h),
          p = S.personal.find((p) => p.id === x.ref);
        return h && p ? t + hrs(h) * p.precio : t;
      }, 0),
    al = S.sedes.reduce((t, s) => t + +s.costo, 0);
  return { ing, u: ing - eg - kc - pl - al };
};
var bars = (d, k) => {
  var W = 600,
    H = 190,
    pm = Math.max(0, ...d.map((x) => x.v)),
    mn = Math.min(0, ...d.map((x) => x.v)),
    rg = pm - mn || 1,
    z = 15 + (pm / rg) * (H - 30),
    w = W / d.length;
  return (
    `<svg viewBox="0 0 ${W} ${H + 22}" width="100%" role="img"><line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="var(--bd)"/>` +
    d
      .map((x, i) => {
        var h = (Math.abs(x.v) / rg) * (H - 30),
          y = x.v >= 0 ? z - h : z;
        return `<g data-f=chSel data-i=${k} data-j=${i} class="u-pointer"><rect x="${i * w + w * 0.14}" y="${y}" width="${w * 0.72}" height="${Math.max(h, 2)}" rx="3" fill="${x.v < 0 ? "var(--rd)" : "var(--ac)"}" opacity="${CS[k] === i ? 1 : 0.72}" class="${NAVF ? "gb" + (x.v < 0 ? " neg" : "") : ""}" data-dx=${i}><title>${esc(x.n)}: ${esc(x.t)}</title></rect><text x="${i * w + w / 2}" y="${H + 15}" text-anchor="middle" font-size="11" fill="var(--mu)">${esc(x.l)}</text></g>`;
      })
      .join("") +
    "</svg>"
  );
};
var chSel = (k, i) => {
    CS[k] = CS[k] === i ? null : i;
    rc();
  },
  rc = (a) => {
    NAVF = !!a;
    $("#ch").innerHTML = charts();
    applyDynamicStyles($("#ch"));
  };
function charts() {
  var n = new Date(),
    ud = [...Array(CS.r)].map((_, j) => {
      var d = new Date(n.getFullYear(), n.getMonth() - (CS.r - 1 - j), 1),
        r = uMes(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
      return {
        l: MS[d.getMonth()],
        n: MS[d.getMonth()] + " " + d.getFullYear(),
        v: r.u,
        t: money(r.u),
        ing: r.ing,
      };
    });
  let md;
  if (CS.v === "d") {
    var [y, m] = CS.mo.split("-").map(Number),
      nd = new Date(y, m, 0).getDate();
    md = [...Array(nd)].map((_, i) => {
      var c = S.alu.filter(
        (a) => a.fecha === `${CS.mo}-${String(i + 1).padStart(2, "0")}`,
      ).length;
      return {
        l: nd > 16 && i % 2 ? "" : String(i + 1),
        v: c,
        t: c + " matrículas",
        n: "Día " + (i + 1),
      };
    });
  } else
    md = MS.map((x, i) => {
      var c = S.alu.filter((a) =>
        a.fecha.startsWith(`${Y}-${String(i + 1).padStart(2, "0")}`),
      ).length;
      return { l: x, v: c, t: c + " matrículas", n: x + " " + Y };
    });
  var mx = md.reduce((a, b) => (b.v > a.v ? b : a), md[0]),
    su = ud[CS.u],
    sm = md[CS.m];
  return `<div class=g2><div class=card><div class="row u-m-0-0-8"><h3 class="u-m-0 u-flex-1">Utilidad neta por mes</h3><select data-ch=csR>${o(
    [
      [6, "Últimos 6 meses"],
      [12, "Últimos 12 meses"],
    ],
    CS.r,
  )}</select></div>${bars(ud, "u")}<p class=mu>${su ? `<b>${esc(su.n)}</b>: utilidad ${esc(su.t)} con ingresos de ${money(su.ing)}.` : "Toca una barra para ver el detalle. Incluye el alquiler mensual de todas las sedes."}</p></div><div class=card><div class="row u-m-0-0-8"><h3 class="u-m-0 u-flex-1">Tendencia de matrículas</h3><select data-ch=csV>${o(
    [
      ["d", "Por día"],
      ["m", "Por mes"],
    ],
    CS.v,
  )}</select>${CS.v === "d" ? `<input type="month" value="${CS.mo}" data-ch=csMo>` : ""}</div>${bars(md, "m")}<p class=mu>${sm ? `<b>${esc(sm.n)}</b>: ${esc(sm.t)}.` : mx.v ? `Mayor flujo: <b>${esc(mx.n)}</b> con ${esc(mx.v)} matrículas. Toca una barra para ver el detalle.` : "Sin matrículas en este período."}</p></div></div>`;
}
function home() {
  var adm = U.rol === "ADM",
      alumnos = (S && Array.isArray(S.alu)) ? S.alu : [],
      // Flexible: cuenta como activo si dice "activo", viene vacío o no está marcado como inactivo
      act = alumnos.filter((a) => {
        var est = String(a.est || a.estado || "").trim().toLowerCase();
        return est === "activo" || est === "" || est !== "inactivo";
      }),
      K3 = [
        ["Alumnos activos", act.length, { e: "Activo" }],
        ["Con datos pendientes", alumnos.filter((a) => falta(a).length).length, { e: "Incompleto" }],
        ["Morosos", act.filter((a) => deuda(a) > 0).length, { e: "Activo", p: "Moroso" }],
      ];
  return `${adm ? `<div class="row u-m-0-0-14"><button class="g u-text-white"  data-f=backup>Descargar respaldo completo (JSON)</button><input type="file" id="rf" accept="application/json,.json" hidden data-ch=restaurar><button class="g u-text-white"  data-f=pickRestore>Restaurar respaldo (JSON)</button></div>` : ""}${U.rol === "ENT" ? "" : `<div class="grid t3 kp">${K3.map(([l, n, f]) => `<button class=tile data-f=kpiFilter data-i="${esc(JSON.stringify(f))}"><span class=stat>${n}</span><b>${l}</b></button>`).join("")}</div>`}<div class="grid t3 u-mt-14">${M.filter(
    (x) => x[3].includes(U.rol) && !x[5],
  )
    .map(
      (x) =>
        `<button class=tile data-f=go data-i=${x[0]}><span class=ic>${ico(x[4])}</span><b>${x[1]}</b></button>`,
    )
    .join(
      "",
    )}</div>${adm ? `<h3 class="h2 u-m-24-0-10">Gráficos estadísticos</h3><div id=ch>${charts()}</div>` : ""}`;
}
/* ==================================================================
   15. VISTAS (un módulo por pantalla)
   ================================================================== */
var tbl = (h, r) =>
  `<div class=tw><table><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr>${r.join("") || `<tr><td colspan=${esc(h.length)} class=mu>Sin registros todavía.</td></tr>`}</table></div>`;
var VW = {};
VW.pre = () => vwPre();
VW.sedes = () => {
  var e = S.sedes.find((s) => s.id === ES) || {};
  return `<div class=card><h3>${ES ? "Modificar " + esc(ES) : "Nueva sede"}</h3><div class=fg>${fl("Nombre", `<input id=s_n value="${esc(e.nombre || "")}">`)}${fl("Código corto (3 letras)", `<input id=s_c maxlength=3 value="${esc(ES ? ES.slice(4) : "")}" ${ES ? "disabled" : ""}>`)}${fl("Dirección", `<input id=s_d value="${esc(e.dir || "")}">`)}${fl("Contacto", `<input id=s_t value="${esc(e.con || "")}">`)}${fl(
    "Tipo de alquiler",
    "<select id=s_k>" +
      o(
        ["Mensual", "Por hora", "Anual"].map((x) => [x, x]),
        e.tipo,
      ) +
      "</select>",
  )}${fl("Costo mensual de alquiler (S/)", `<input id=s_m type=number min=0 value="${esc(e.costo ?? "")}">`)}</div><div class=row><button data-f=addSede>${ES ? "Guardar cambios" : "Guardar sede"}</button>${ES ? "<button class=g data-f=cancelSede>Cancelar</button>" : ""}</div></div><div class=card>${tbl(
    ["Código", "Sede", "Dirección", "Contacto", "Tipo", "Alquiler / mes", ""],
    S.sedes.map(
      (s) =>
        `<tr><td>${esc(s.id)}</td><td>${esc(s.nombre)}</td><td>${esc(s.dir)}</td><td>${esc(s.con)}</td><td>${esc(s.tipo)}</td><td>${money(s.costo)}</td><td><button class="s g" data-f="sedEd" data-i="${esc(s.id)}">Modificar</button> <button class="s r" data-f="delSede" data-i="${esc(s.id)}">Eliminar</button></td></tr>`,
    ),
  )}<div class=row><button class=g data-f=cp data-i=sedes>Copiar para Excel</button></div><p><b>Costos fijos de alquiler: ${money(S.sedes.reduce((t, s) => t + +s.costo, 0))} al mes</b></p></div>`;
};
function addSede() {
  var n = limpiar(v("s_n"), 60),
    c = v("s_c").toUpperCase();
  if (!n) return toast("Ingresa el nombre");
  var d = {
    nombre: n,
    dir: limpiar(v("s_d"), 120),
    con: limpiar(v("s_t"), 80),
    tipo: ["Mensual", "Por hora", "Anual"].includes(v("s_k")) ? v("s_k") : "Mensual",
    costo: monto(v("s_m") || 0),
  };
  if (d.costo === null) return toast("Costo inválido");
  if (ES) {
    Object.assign(
      S.sedes.find((s) => s.id === ES),
      d,
    );
    ES = null;
    toast("Sede actualizada");
  } else {
    if (!/^[A-Z]{3}$/.test(c)) return toast("El código debe tener 3 letras (A-Z)");
    if (S.sedes.some((s) => s.id === "SED-" + c)) return toast("Ese código ya existe");
    S.sedes.push({ id: "SED-" + c, ...d });
    toast("Sede guardada");
  }
  save();
  R();
}
function delSede(id) {
  if (
    S.hor.some((h) => h.sede === id) ||
    S.alu.some((a) => a.sede === id) ||
    S.caja.some((x) => x.sede === id)
  )
    return toast("No se puede eliminar: tiene horarios, alumnos o movimientos asociados");
  S.sedes = S.sedes.filter((s) => s.id !== id);
  save();
  toast("Sede eliminada");
  R();
}
var hsem = (p) => {
  var d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  var w = d.toISOString().slice(0, 10);
  return S.asis
    .filter((x) => x.t === "P" && x.ref === p.id && x.ok && x.f >= w)
    .reduce((t, x) => t + hrs(S.hor.find((h) => h.id === x.h) || { ini: "0:00", fin: "0:00" }), 0);
};
VW.personal = () => {
  var e = S.personal.find((p) => p.id === EP) || {},
    dg = "data-in=digits inputmode=numeric";
  return `<div class=card><h3>${EP ? "Modificar " + esc(EP) : "Nuevo personal"}</h3><div class=fg>${fl("Nombres", `<input id=p_n value="${esc(e.nom || "")}">`)}${fl("DNI", `<input id=p_d maxlength=8 ${dg} value="${esc(e.dni || "")}">`)}${fl("Teléfono", `<input id=p_t maxlength=9 ${dg} value="${esc(e.tel || "")}">`)}${fl("Especialidad", `<input id=p_e value="${esc(e.esp || "")}">`)}${fl(
    "Rol",
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
  )}${fl("Precio por hora (S/)", `<input id=p_p type=number min=0 value="${esc(e.precio ?? "")}">`)}</div><div class=row><button data-f=addPer>${EP ? "Guardar cambios" : "Guardar"}</button>${EP ? "<button class=g data-f=cancelPer>Cancelar</button>" : ""}</div></div><div class=card>${tbl(
    [
      "Código",
      "DNI",
      "Nombres",
      "Teléfono",
      "Rol",
      "Especialidad",
      "S/ hora",
      "Horas semana",
      "Pago semana",
      "Estado",
      "",
    ],
    S.personal.map((p) => {
      var h = hsem(p);
      return `<tr><td>${esc(p.id)}</td><td>${esc(p.dni)}</td><td>${esc(p.nom)}</td><td>${esc(p.tel || "")}</td><td>${esc(p.rol)}</td><td>${esc(p.esp)}</td><td>${money(p.precio)}</td><td>${h.toFixed(1)}</td><td>${money(h * p.precio)}</td><td><span class="b ${p.activo ? "ok" : "no"}">${p.activo ? "Activo" : "Inactivo"}</span></td><td><button class="s g" data-f="perEd" data-i="${esc(p.id)}">Modificar</button> <button class="s g" data-f="togP" data-i="${esc(p.id)}">${p.activo ? "Desactivar" : "Activar"}</button></td></tr>`;
    }),
  )}<div class=row><button class=g data-f=cp data-i=personal>Copiar para Excel</button></div></div>`;
};
function addPer() {
  var n = limpiar(v("p_n"), 60),
    d = v("p_d"),
    r = v("p_r");
  if (!RX.nombre.test(n) || !RX.dni.test(d))
    return toast("Nombre válido (solo letras) y DNI de 8 dígitos son obligatorios");
  if (v("p_t") && !RX.cel.test(v("p_t"))) return toast("Teléfono: hasta 9 dígitos");
  if (!["ENT", "ADM", "REC"].includes(r) || monto(v("p_p") || 0) === null)
    return toast("Rol o precio inválido");
  if (S.personal.some((p) => p.dni === d && p.id !== EP))
    return toast("Ese DNI ya está registrado");
  var x = {
    nom: n,
    dni: d,
    tel: v("p_t"),
    esp: limpiar(v("p_e"), 60),
    rol: r,
    precio: monto(v("p_p") || 0),
  };
  if (EP) {
    Object.assign(
      S.personal.find((p) => p.id === EP),
      x,
    );
    EP = null;
    toast("Personal actualizado");
  } else {
    S.personal.push({ id: `PER-${r}-${nx("PER-" + r, 4)}`, ...x, activo: 1 });
    toast("Personal guardado");
  }
  save();
  R();
}
var togP = (id) => {
  var p = S.personal.find((x) => x.id === id);
  if (p === U) return toast("No puedes desactivarte");
  p.activo = p.activo ? 0 : 1;
  save();
  R();
};
VW.horarios = () =>
  `<div class=card><h3>Categorías ${Y}</h3><div class=row>${cats()
    .map((c) => `<span class="b ok">CAT-${c}</span>`)
    .join(
      "",
    )}</div></div><div class=card><h3>Nuevo deporte</h3><div class=row>${'<input id=d_n placeholder="Nombre">'}<input id=d_c maxlength=3 placeholder="Código (3 letras)"><button data-f=addDep>Agregar deporte</button></div><p class=mu>${S.deportes.map((d) => d.id + " " + d.nombre).join(" · ")}</p></div><div class=card><h3>Nuevo horario</h3><div class=fg>${fl("Sede", "<select id=h_s>" + o(S.sedes.map((s) => [s.id, s.nombre])) + "</select>")}${fl("Deporte", "<select id=h_d>" + o(S.deportes.map((s) => [s.id, s.nombre])) + "</select>")}${fl("Categoría", "<select id=h_c>" + o(cats().map((c) => [c, "CAT-" + c])) + "</select>")}${fl("Inicio", "<input id=h_i type=time value=16:00>")}${fl("Fin", "<input id=h_f type=time value=18:00>")}${fl("Profesores (Ctrl para varios)", "<select id=h_p multiple>" + o(S.personal.filter((p) => p.rol === "ENT" && p.activo).map((p) => [p.id, p.nom])) + "</select>")}</div><div class=row><button data-f=addHor>Guardar horario</button></div></div><div class=card>${tbl(
    ["Código", "Sede", "Deporte", "Categoría", "Horario", "Profesores", ""],
    S.hor.map(
      (h) =>
        `<tr><td>${esc(h.id)}</td><td>${esc(sn(h.sede))}</td><td>${esc(dn(h.dep))}</td><td>CAT-${esc(h.cat)}</td><td>${esc(h.ini)}-${esc(h.fin)}</td><td>${esc(h.profs.map((p) => (S.personal.find((x) => x.id === p) || {}).nom).join(", "))}</td><td><button class="s r" data-f="delHor" data-i="${esc(h.id)}">Quitar</button></td></tr>`,
    ),
  )}<div class=row><button class=g data-f=cp data-i=hor>Copiar para Excel</button></div></div>`;
function addDep() {
  var c = v("d_c").toUpperCase(),
    n = limpiar(v("d_n"), 40);
  if (!n || !/^[A-Z]{3}$/.test(c)) return toast("Nombre y código de 3 letras");
  if (S.deportes.some((d) => d.id === "DEP-" + c)) return toast("Código repetido");
  S.deportes.push({ id: "DEP-" + c, nombre: n });
  save();
  R();
}
function addHor() {
  var ps = [...$("#h_p").selectedOptions].map((x) => x.value);
  if (v("h_i") >= v("h_f")) return toast("La hora de fin debe ser posterior");
  if (!ps.length) return toast("Asigna al menos un profesor");
  S.hor.push({
    id: "HOR-" + nx("HOR", 4),
    sede: v("h_s"),
    dep: v("h_d"),
    cat: +v("h_c"),
    ini: v("h_i"),
    fin: v("h_f"),
    profs: ps,
  });
  save();
  toast("Horario guardado");
  R();
}
var delHor = (id) => {
  if (S.alu.some((a) => a.hor === id))
    return toast("Hay alumnos en este horario; reasígnalos primero");
  S.hor = S.hor.filter((h) => h.id !== id);
  save();
  R();
};
VW.mat = () => {
  var a = ED
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
  var r = (k, x, t = "text", e = "") =>
    `<input id=m_${k} type=${t} value="${esc(x)}" data-r=1 class="${x ? "" : "bad"}" data-in=ck ${e}>`;
  adjInit(a);
  return `<div class=card><h3>${ED ? "Ficha " + esc(ED) : PRE ? "Matrícula desde pre-registro (" + esc(PRE.modalidad) + ")" : "Nueva matrícula"} <span class=mu>· fecha ${esc(a.fecha || today())}</span></h3><p class=mu>Puedes guardar con datos pendientes: los campos en rojo se completan después.</p><div class=fg>${fl("Nombres", `<input id=m_nom value="${esc(a.nom || "")}">`)}${fl("Apellidos", `<input id=m_ape value="${esc(a.ape || "")}">`)}${fl("DNI", r("dni", a.dni || "", "text", "maxlength=8 inputmode=numeric data-d=1"))}${fl(
    "Sexo",
    "<select id=m_sex>" +
      o(
        [
          ["M", "Masculino"],
          ["F", "Femenino"],
        ],
        a.sex,
      ) +
      "</select>",
  )}${fl("Fecha de nacimiento", `<input id=m_nac type=date value="${esc(a.nac || "")}" data-ch=upHor>`)}${fl("Categoría y edad", '<b id=m_cat class="u-py-8">-</b>')}${fl(
    "Deporte",
    "<select id=m_dep data-ch=upHor>" +
      o(
        S.deportes.map((d) => [d.id, d.nombre]),
        a.dep,
      ) +
      "</select>",
  )}${fl(
    "Sede",
    "<select id=m_sed data-ch=upHor>" +
      o(
        S.sedes.map((d) => [d.id, d.nombre]),
        a.sede,
      ) +
      "</select>",
  )}${fl("Horario", "<select id=m_hor></select>")}${fl("Seguro médico", r("seg", a.seg || ""))}${fl("Apoderado", r("an", a.an || ""))}${fl("Celular", r("ac", a.ac || "", "text", "maxlength=9 inputmode=numeric data-d=1"))}${fl("Correo", r("am", a.am || "", "email"))}${fl(
    "Condición",
    "<select id=m_con>" +
      o(
        ["Ninguna", "Media Beca", "Becado"].map((x) => [x, x]),
        a.con,
      ) +
      "</select>",
  )}${fl(
    "Modalidad",
    "<select id=m_mod>" +
      o(
        ["Formativo", "Competitivo"].map((x) => [x, x]),
        a.mod,
      ) +
      "</select>",
  )}${fl(
    "Estado",
    "<select id=m_est>" +
      o(
        ["Activo", "Inactivo"].map((x) => [x, x]),
        a.est,
      ) +
      "</select>",
  )}${fl("Costo matrícula (S/)", `<input id=m_cm type=number min=0 value="${esc(a.cm)}">`)}${fl("Costo mensualidad (S/)", `<input id=m_cmen type=number min=0 value="${esc(a.cmen)}">`)}${fl("Meses contratados", `<input id=m_mes type=number min=0 value="${esc(a.mes)}">`)}${fl("Monto pagado (S/)", `<input id=m_pag type=number min=0 value="${esc(a.pag)}">`)}</div><div class=row id=ad_r>${adjBoton()}</div><div class=row><button data-f=matPay>Guardar</button><button class=g data-f=go data-i=mat>Cancelar</button>${ED ? `<button class=g data-f="carnet" data-i="${esc(ED)}">Generar carnet</button>` : ""}<button class=g data-f=qrPadres>QR para padres</button></div></div>`;
};

function upHor() {
  var y = +v("m_nac").slice(0, 4),
    c = $("#m_cat");
  if (!c) return;
  c.textContent = y
    ? catOk(y)
      ? "CAT-" + y + " · " + age(v("m_nac")) + " años"
      : "Fuera de rango (5 a 17 años)"
    : "-";
  c.classList.toggle("u-neg", !!(y && !catOk(y)));
  var cur = ED ? (S.alu.find((x) => x.id === ED) || {}).hor : "";
  var hs = S.hor.filter(
    (h) => h.sede === v("m_sed") && h.dep === v("m_dep") && (!y || h.cat === y),
  );
  $("#m_hor").innerHTML = o(
    hs.map((h) => [h.id, `${esc(h.cat)} · ${esc(h.ini)}-${esc(h.fin)}`]),
    v("m_hor") || cur,
    "Sin horario aún",
  );
}
async function saveAlu() {
  var { d, e } = validarAlumno({
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
  var old = ED ? S.alu.find((x) => x.id === ED) : null,
    hh = S.hor.find((h) => h.id === v("m_hor"));
  Object.assign(d, {
    dep: v("m_dep"),
    sede: v("m_sed"),
    hor: hh ? hh.id : "",
    foto: IMG_OK.test(DW.foto || "") ? DW.foto : "",
    mes: Math.min(36, Math.max(0, parseInt(v("m_mes")) || 0)),
  });
  if (d.dni && S.alu.some((x) => x.dni === d.dni && x.id !== ED))
    return toast("Ese DNI ya está registrado");
  var id = old ? old.id : nid(),
    delta = d.pag - (old ? old.pag : 0),
    dc = { qt: old && old.qt ? old.qt : tok() };
  try {
    await adjCommit(id);
  } catch (e) {
    return toast("No se pudo subir un archivo (solo JPG, PNG o PDF de hasta 5 MB)");
  }
  Object.assign(d, { foto: DW.foto, dnf: DW.dnf, dsg: DW.dsg, dfm: DW.dfm });
  Object.assign(d, dc);
  if (old) Object.assign(old, d);
  else S.alu.push({ id, fecha: today(), ...d });
  if (delta > 0)
    S.caja.push({
      f: today(),
      sede: d.sede,
      t: "I",
      c: "Matrícula / mensualidad",
      d: id,
      m: delta,
    });
  save();
  adjLimpiar(id);
  var pf = falta(d);
  toast(pf.length ? "Guardada con datos pendientes: " + pf.join(", ") : "Matrícula completa");
  if (PREID) {
    var pid = PREID;
    PREID = PRE = null;
    sb("/rest/v1/preregistros?id=eq." + encodeURIComponent(pid), { method: "DELETE" }).then(() => {
      if (PR) PR = PR.filter((x) => x.id !== pid);
      PRN = PR ? PR.length : PRN;
    });
  }
  if (!old || FRESH === id) {
    FRESH = id;
    ED = id;
    R();
    toast("Matrícula guardada. Ya puedes generar el carnet.");
  } else go("dir");
}
function carnet(id) {
  var a = S.alu.find((x) => x.id === id);
  modal(
    `<h3>${esc(a.nom + " " + a.ape)}</h3>${IMG_OK.test(a.foto || "") ? `<img src="${esc(a.foto)}" width=90 height=90 class="u-rounded-6">` : "<p class=mu>Sin foto</p>"}<p><b>${esc(a.id)}</b><br>${esc(dn(a.dep))} · CAT-${esc(a.nac.slice(0, 4))} · ${esc(sn(a.sede))}</p>${qr(carnetUrl(a))}<div class="row u-jc-center"><button data-f=print>Imprimir (PVC / papel)</button></div>`,
  );
}
var ed = (id) => {
  V = "mat";
  ED = id;
  R();
};
var dirL = () => {
  var q = (DF.q || "").toLowerCase().trim();
  return S.alu.filter(
    (a) =>
      (!DF.s || a.sede === DF.s) &&
      (!DF.d || a.dep === DF.d) &&
      (!DF.c || a.nac.slice(0, 4) === DF.c) &&
      (!DF.e || (DF.e === "Incompleto" ? falta(a).length : a.est === DF.e)) &&
      (!DF.p || (DF.p === "Moroso") === deuda(a) > 0) &&
      (!q ||
        (a.nom + " " + a.ape).toLowerCase().includes(q) ||
        (a.dni || "").includes(q) ||
        a.id.includes(q)),
  );
};
var dirT = () =>
  tbl(
    ["Código", "Alumno", "DNI", "Sede", "Deporte", "Cat.", "Edad", "Estado", "Datos", "Pago", ""],
    dirL().map((a) => {
      var f = falta(a),
        dd = deuda(a);
      return `<tr class="${f.length ? "inc" : ""}"><td>${esc(a.id)}</td><td>${esc(a.nom + " " + a.ape)}</td><td>${a.dni ? esc(a.dni) : "<b class=u-neg>falta</b>"}</td><td>${esc(sn(a.sede))}</td><td>${esc(dn(a.dep))}</td><td>${esc(a.nac.slice(0, 4))}</td><td>${age(a.nac)}</td><td>${esc(a.est)}</td><td>${f.length ? `<span class="b no">Falta: ${f.join(", ")}</span>` : '<span class="b ok">Completa</span>'}</td><td><span class="b ${dd > 0 ? "no" : "ok"}">${dd > 0 ? "Moroso " + money(dd) : "Al día"}</span></td><td><button class="s" data-f="ed" data-i="${esc(a.id)}">Abrir</button></td></tr>`;
    }),
  );
VW.dir = () => {
  var sel = (k, l, a) =>
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
  var hs = S.hor.filter((h) => U.rol !== "ENT" || h.profs.includes(U.id)),
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
  var row = (t, r, n) => {
    var c = rec(t, r);
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
  var sl = (k, l, a, ph) => fl(l, `<select data-ch=setA data-i=${k}>${o(a, AS[k], ph)}</select>`);
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
var setA = (k, x) => {
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
  var k = `campo|${today()}|${r}|${AS.h}`;
  S.caja = S.caja.filter((c) => c.k !== k);
  if (pc) {
    var a = S.alu.find((a) => a.id === r);
    S.caja.push({ f: today(), sede: a.sede, t: "I", c: "Pago de campo", d: r, m: S.fee ?? 5, k });
  }
  save();
  R();
}
VW.kits = () => {
  var adm = KS && U.rol === "ADM";
  return `<div class=card><h3>Nueva venta</h3><div class=kitw><div class=kitf><div class=fg><label class="u-col-full">Buscar alumno (código, DNI, nombres o apellidos)<input id=k_q value="${esc(KQ)}" data-in=kitQ autocomplete=off placeholder="Escribe al menos 2 letras o números"></label><div id=k_res class="u-col-full"></div><input type=hidden id=k_a value="${esc(KSEL)}">${kSelHtml()}${fl("Prenda", "<select id=k_p>" + o(["Kit completo", "Polo", "Short", "Calcetines"].map((x) => [x, x])) + "</select>")}${fl("Talla", "<select id=k_t>" + o(["6", "8", "10", "12", "14", "S", "M", "L", "XL"].map((x) => [x, x])) + "</select>")}${fl("Nombre en camiseta", '<input id=k_n autocomplete=off placeholder="Ej. JUAN" data-in=shirtDraw>')}${fl("Número elegido", '<input id=k_u inputmode=numeric autocomplete=off maxlength=3 placeholder="00" data-in=kNumTyped value="' + esc(KNUM) + '">')}${fl("Fecha de pedido", `<input id=k_f type=date value=${today()}>`)}${fl("Fecha de entrega", "<input id=k_e type=date>")}${fl("Precio público (S/)", "<input id=k_pr type=number min=0 value=90>")}${fl("Costo de confección (S/)", "<input id=k_c type=number min=0 value=45>")}</div><div class=row><button data-f=kitPay>Registrar venta</button></div></div>${shirtHtml()}</div></div><div class=card>${tbl(
    ["Código", "Alumno", "Prenda", "Talla", "Camiseta", "Pedido", "Entrega", "Cobrado"].concat(
      adm ? ["Costo", "Utilidad"] : [],
    ),
    S.kits.map(
      (k) =>
        `<tr><td>${esc(k.code)}</td><td>${esc(k.al)}</td><td>${esc(k.p)}</td><td>${esc(k.t)}</td><td>${esc(k.n)} ${esc(k.u)}</td><td>${esc(k.f)}</td><td>${esc(k.e || "Pendiente")}</td><td>${money(k.pr)}</td>${adm ? `<td>${money(k.c)}</td><td><b>${money(k.pr - k.c)}</b></td>` : ""}</tr>`,
    ),
  )}<div class=row><button class=g data-f=cp data-i=kits>Copiar para Excel</button>${U.rol === "ADM" ? `<button class=g data-f=toggleKS>${KS ? "Ocultar" : "Mostrar"} costos y utilidad</button>` : ""}</div>${adm ? `<p><b>Utilidad total de indumentaria: ${money(S.kits.reduce((t, k) => t + k.pr - k.c, 0))}</b></p>` : ""}</div>`;
};
function addKit() {
  var a = S.alu.find((x) => x.id === v("k_a"));
  if (!a) return toast("Elige un alumno");
  var pr = monto(v("k_pr") || 0),
    cc = monto(v("k_c") || 0);
  if (pr === null || cc === null) return toast("Precio o costo inválido");
  if (
    !["Kit completo", "Polo", "Short", "Calcetines"].includes(v("k_p")) ||
    !["6", "8", "10", "12", "14", "S", "M", "L", "XL"].includes(v("k_t"))
  )
    return toast("Prenda o talla inválida");
  var nu = KNUM ? +KNUM : "";
  if (nu && a.mod === "Competitivo" && ocup(a).has(nu))
    return toast("Ese número ya está ocupado en su categoría (±2 años)");
  if (!RX.fecha.test(v("k_f")) || (v("k_e") && !RX.fecha.test(v("k_e"))))
    return toast("Fechas inválidas");
  S.kits.push({
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
  });
  S.caja.push({ f: v("k_f") || today(), sede: a.sede, t: "I", c: "Indumentaria", d: a.id, m: pr });
  save();
  KSEL = KNUM = KQ = "";
  toast("Venta registrada");
  R();
}
VW.caja = () => {
  var s = AS.cs || S.sedes[0].id,
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
    ["Fecha", "Tipo", "Concepto", "Detalle", "Monto"],
    L.slice()
      .reverse()
      .map(
        (x) =>
          `<tr><td>${esc(x.f)}</td><td><span class="b ${x.t === "I" ? "ok" : "no"}">${x.t === "I" ? "Ingreso" : "Egreso"}</span></td><td>${esc(x.c)}</td><td>${esc(x.d)}</td><td>${money(x.m)}</td></tr>`,
      ),
  )}<div class=row><button class=g data-f=cp data-i=caja>Copiar para Excel</button></div></div>`;
};
function addCaja(s) {
  var { d, e } = validarPago({ m: v("c_m"), t: v("c_t"), c: v("c_c"), d: v("c_d") });
  if (e.length) return toast(e[0]);
  if (!S.sedes.some((x) => x.id === s)) return toast("Sede inválida");
  S.caja.push({ f: today(), sede: s, t: d.t, c: d.c, d: d.d, m: d.m });
  save();
  R();
}
VW.ger = () => {
  var rows = S.sedes.map((s) => {
      var mc = S.caja.filter((x) => x.sede === s.id && x.f.startsWith(window.GM)),
        ing = mc.filter((x) => x.t === "I").reduce((t, x) => t + x.m, 0),
        eg = mc.filter((x) => x.t === "E").reduce((t, x) => t + x.m, 0),
        kc = S.kits
          .filter((k) => k.sede === s.id && k.f.startsWith(window.GM))
          .reduce((t, k) => t + k.c, 0),
        pl = S.asis
          .filter((x) => x.t === "P" && x.ok && x.f.startsWith(window.GM))
          .reduce((t, x) => {
            var h = S.hor.find((h) => h.id === x.h);
            var p = S.personal.find((p) => p.id === x.ref);
            return h && p && h.sede === s.id ? t + hrs(h) * p.precio : t;
          }, 0);
      return { s, ing, eg, kc, pl, al: +s.costo, u: ing - eg - kc - pl - s.costo };
    }),
    mx = Math.max(1, ...rows.map((r) => Math.abs(r.u)));
  return `<div class=card><div class="row u-m-0">${fl("Mes", "<input type=month value=" + window.GM + " data-ch=setGM>")}</div></div><div class=card>${tbl(
    [
      "Sede",
      "Ingresos",
      "Alquiler",
      "Planilla",
      "Costo kits",
      "Otros egresos",
      "Utilidad neta",
      "",
    ],
    rows.map(
      (r, ri) =>
        `<tr><td>${esc(r.s.nombre)}</td><td>${money(r.ing)}</td><td>${money(r.al)}</td><td>${money(r.pl)}</td><td>${money(r.kc)}</td><td>${money(r.eg)}</td><td><b class="${r.u < 0 ? "u-neg" : "u-pos"}">${money(r.u)}</b></td><td class="u-w-160"><div class="bar ${r.u < 0 ? "n" : ""}${NAVF ? " ga" : ""}" data-dw="${(Math.abs(r.u) / mx) * 100}" data-dx=${ri}></div></td></tr>`,
    ),
  )}<p><b>Utilidad total del mes: ${money(rows.reduce((t, r) => t + r.u, 0))}</b></p><p class=mu>Utilidad = ingresos − alquiler − planilla (horas asistidas × precio por hora) − costo de confección − otros egresos manuales.</p></div>`;
};
/* ==================================================================
   16. ACCIONES DELEGADAS (data-f) Y REGISTROS DE EVENTOS
   ================================================================== */
var FN = {
  nav: (i) => go(i),
  kSel: (i) => {
    KSEL = i;
    KNUM = "";
    KQ = "";
    R();
  },
  kNum: (n) => {
    KNUM = +n;
    $("#k_u").value = n;
    document.querySelectorAll(".n.sel").forEach((e) => e.classList.remove("sel"));
    document.querySelector('.n[data-i="' + n + '"]').classList.add("sel");
    $("#k_u").classList.remove("bad");
    shirtDraw();
  },
  preOk: (i) => {
    var p = (PR || []).find((x) => x.id === i);
    if (!p) return;
    PRE = p;
    PREID = p.id;
    ED = null;
    FOTO = null;
    DWK = null;
    V = "mat";
    R();
  },
  preDel: (i) => preDel(i),
  verDoc: (i) => verDoc(i),
  cpUrl: () =>
    navigator.clipboard.writeText(base() + "#prereg").then(() => toast("Enlace copiado")),
  sedEd: (i) => {
    ES = i;
    R();
  },
  perEd: (i) => {
    EP = i;
    R();
  },
  delSede: (i) => delSede(i),
  togP: (i) => togP(i),
  delHor: (i) => delHor(i),
  ed: (i) => ed(i),
  carnet: (i) => carnet(i),
  mkA: (t, r, k) => mkA(t, r, k === "1"),
  mkP: (r, k, z, b) => (k === "1" ? campoPay(r, b) : mkP(r, false)),
  addCaja: (i, j, k, b) => cajaPay(i, b),
};
/* Acciones que antes eran onclick="..." embebidos en el HTML */
Object.assign(FN, {
  go: (i) => go(i),
  cl: () => cl(),
  print: () => window.print(),
  tgSide: () => tgSide(),
  out: () => out(),
  eye: () => eye(),
  doLogin: () => doLogin(),
  enviarPre: () => enviarPre(),
  qrPadres: () => qrPadres(),
  qrFotoAbrir: () => qrFotoAbrir(),
  scan: () => scan(),
  cargarPre: () => cargarPre(),
  backup: () => backup(),
  addSede: () => addSede(),
  addPer: () => addPer(),
  addHor: () => addHor(),
  addDep: () => addDep(),
  cp: (i) => cp(i),
  matPay: (i, j, k, b) => matPay(b),
  kitPay: (i, j, k, b) => kitPay(b),
  chSel: (i, j) => chSel(i, +j),
  pickRestore: () => $("#rf").click(),
  toggleKS: () => {
    KS = KS ? 0 : 1;
    R();
  },
  cancelSede: () => {
    ES = null;
    R();
  },
  cancelPer: () => {
    EP = null;
    R();
  },
  clearDF: () => {
    DF = {};
    R();
  },
  toggleOnly: () => {
    AS.only = !AS.only;
    R();
  },
  kpiFilter: (i) => {
    DF = JSON.parse(i);
    go("dir");
  },
});

/* Acciones de teclado (data-in): antes oninput="..." */
var ON_INPUT = {
  digits: (el) => {
    el.value = el.value.replace(/\D/g, "");
  },
  shirtDraw: () => shirtDraw(),
  kNumTyped: (el) => kNumTyped(el),
  ck: (el) => ck(el),
  preQ: (el) => {
    PF.q = el.value;
    preF();
  },
  kitQ: (el) => {
    KQ = el.value;
    kRes();
  },
  dirQ: (el) => {
    DF.q = el.value;
    $("#dt").innerHTML = dirT();
  },
};

/* Cambios de valor (data-ch): antes onchange="..." */
var ON_CHANGE = {
  upHor: () => upHor(),
  restaurar: (el) => restaurar(el),
  setFee: (el) => {
    S.fee = +el.value || 0;
    save();
  },
  preM: (el) => {
    PF.m = el.value;
    preF();
  },
  setGM: (el) => {
    window.GM = el.value;
    R();
  },
  csV: (el) => {
    CS.v = el.value;
    CS.m = null;
    rc(1);
  },
  csR: (el) => {
    CS.r = +el.value;
    CS.u = null;
    rc(1);
  },
  csMo: (el) => {
    CS.mo = el.value || CS.mo;
    CS.m = null;
    rc(1);
  },
  asCs: (el) => {
    AS.cs = el.value;
    R();
  },
  setA: (el, i) => setA(i, el.value),
  dfSet: (el, i) => {
    DF[i] = el.value;
    R();
  },
};

/* Teclas (data-kd): antes onkeydown="..." */
var ON_KEYDOWN = {
  enterLogin: (el, i, e) => {
    if (e.key === "Enter") doLogin();
  },
};

/* Valores dinámicos que antes iban en style="...": se aplican vía CSSOM (compatible con una CSP sin 'unsafe-inline') */
function applyDynamicStyles(root) {
  root.querySelectorAll("[data-dw]").forEach((e) => (e.style.width = e.dataset.dw + "%"));
  root.querySelectorAll("[data-dx]").forEach((e) => e.style.setProperty("--i", e.dataset.dx));
}
Object.assign(FN, {
  adjAbrir: () => modal(adjHtml()),
  adjVer: (k) => adjVer(k),
  adjCamb: (k) => adjCamb(k),
  adjDel: (k) => adjDel(k),
});

/* ==================================================================
   17. ANIMACIONES Y COMPONENTES VISUALES (solo apariencia)
   ================================================================== */
LASTV = null,
  NAVF = false,
  SPY = null,
  SPH = 0,
  PAYB = 0,
  SHIRT_IM = null;

/* ---- 1. Menú lateral: píldora líquida ---- */
function sideInit() {
  var nav = document.querySelector(".side nav");
  if (!nav) return;
  var vis = !!nav.offsetParent;
  if (!vis) SPY = null;
  var pill = nav.querySelector(".side-pill"),
    items = [...nav.querySelectorAll(".si")];
  if (!pill || !items.length) return;
  var act = items.find((i) => i.classList.contains("on")) || items[0];
  let cur = act;
  var put = (el, track) => {
    pill.style.setProperty("--py", el.offsetTop + "px");
    pill.style.height = el.offsetHeight + "px";
    items.forEach((i) => {
      i.classList.toggle("f", i === el);
      i.classList.toggle("dim", i !== el && !i.classList.contains("on"));
    });
    cur = el;
    if (track) {
      SPY = el.offsetTop;
      SPH = el.offsetHeight;
    }
  };
  if (!vis) {
  } else if (SPY !== null) {
    pill.style.transition = "none";
    pill.style.setProperty("--py", SPY + "px");
    pill.style.height = (SPH || act.offsetHeight) + "px";
    void pill.offsetHeight;
    pill.style.transition = "";
    requestAnimationFrame(() => requestAnimationFrame(() => put(act, true)));
  } else {
    pill.style.transition = "none";
    put(act, true);
    void pill.offsetHeight;
    pill.style.transition = "";
    pill.classList.add("in");
  }
  items.forEach((it) => {
    it.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") put(it, true);
    });
    it.addEventListener("focus", () => put(it, true));
    it.addEventListener("blur", () => {
      if (!nav.matches(":hover")) put(act, true);
    });
  });
  nav.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") put(act, true);
  });
  nav._pl = () => put(cur, true);
}

/* ---- 3. Aparición escalonada ---- */
function stagger() {
  var els = [
    ...document.querySelectorAll(
      "main>h2,main>h3,main>.row,main>.card,main>.grid>*,main>.g2>*,main>#ch>.g2>*,#app>.login>.card",
    ),
  ];
  els.forEach((e, i) => {
    var d = Math.min(i, 16) * 70;
    e.style.setProperty("--d", d + "ms");
    e.style.setProperty("--bd", d + "ms");
    e.classList.add("rv");
    e.addEventListener("animationend", (ev) => {
      if (ev.target === e) e.classList.remove("rv");
    });
  });
}

/* ---- 4. Contadores desde cero ---- */
function counters() {
  var els = [...document.querySelectorAll("main .stat,main td,main b,main h3")]
    .filter((e) => !e.children.length)
    .slice(0, 120);
  for (var e of els) {
    var t = e.textContent;
    let pre, num;
    if (e.classList.contains("stat")) {
      if (!/^-?\d+$/.test(t)) continue;
      pre = "";
      num = t;
    } else {
      var m = /^(.*?S\/ )(-?\d+\.\d\d)$/.exec(t);
      if (!m) continue;
      pre = m[1];
      num = m[2];
    }
    var to = parseFloat(num),
      dec = num.includes(".") ? 2 : 0,
      t0 = performance.now() + 250;
    e.textContent = pre + (0).toFixed(dec);
    var step = (now) => {
      if (!e.isConnected) return;
      var p = Math.min(1, Math.max(0, (now - t0) / 1000)),
        k = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        e.textContent = pre + (to * k).toFixed(dec);
        requestAnimationFrame(step);
      } else e.textContent = t;
    };
    requestAnimationFrame(step);
  }
}

function postR() {
  applyDynamicStyles(document);
  if (NAVF) {
    stagger();
    if (U) counters();
  }
  LASTV = U ? V : null;
  if (!document.querySelector(".side")) SPY = null;
  sideInit();
  if (U && V === "kits") shirtInit();
}

/* ---- 2. Botón de pago -> ¡PAGADO! -> recibo ---- */
function payBtn(b) {
  var w = b.offsetWidth,
    h = b.offsetHeight,
    html = b.innerHTML,
    cls = b.className,
    sw = b.style.width,
    sh = b.style.height,
    small = b.classList.contains("s");
  b.style.width = w + "px";
  b.style.height = h + "px";
  void b.offsetWidth;
  b.classList.add("paybtn", "paying");
  b.innerHTML = "<i class=pf></i><span class=pl>Procesando…</span>";
  b.style.width = Math.max(w, small ? 112 : 196) + "px";
  var t0 = performance.now();
  return {
    finish() {
      var wait = Math.max(0, 950 - (performance.now() - t0));
      return new Promise((res) =>
        setTimeout(() => {
          b.classList.remove("paying");
          b.classList.add("paid");
          b.innerHTML =
            '<svg class=pk viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span class=pl>¡PAGADO!</span>';
          setTimeout(res, 800);
        }, wait),
      );
    },
    cancel() {
      b.className = cls;
      b.style.width = sw;
      b.style.height = sh;
      b.innerHTML = html;
    },
  };
}

/* Ejecuta la acción original (sin cambiarla), retiene el re-dibujado y anima solo si hubo un cobro real */
function payRun(b, fn, metric, tk) {
  if (PAYB || !b || !b.isConnected) return fn();
  var m0 = metric(),
    R0 = R;
  let pend = false;
  R = () => {
    pend = true;
  };
  let r;
  try {
    r = fn();
  } catch (e) {
    R = R0;
    throw e;
  }
  var end = () => {
      R = R0;
    },
    ok = () => metric() > m0,
    flush = () => {
      if (pend) R0();
    };
  var done = (ctl) =>
    ctl.finish().then(() => {
      end();
      flush();
      try {
        recibo(tk());
      } catch (e) {
        console.error(e);
      }
      PAYB = 0;
    });
  if (r && typeof r.then === "function") {
    PAYB = 1;
    var ctl = payBtn(b);
    r.then(
      () => {
        if (ok()) done(ctl);
        else {
          ctl.cancel();
          end();
          flush();
          PAYB = 0;
        }
      },
      () => {
        ctl.cancel();
        end();
        flush();
        PAYB = 0;
      },
    );
    return r;
  }
  if (!ok() || !b.isConnected) {
    end();
    flush();
    return r;
  }
  PAYB = 1;
  done(payBtn(b));
  return r;
}

var kitPay = (b) =>
  payRun(
    b,
    addKit,
    () => S.kits.length,
    () => ({ k: S.kits[S.kits.length - 1] }),
  );
var cajaPay = (s, b) =>
  v("c_t") === "I"
    ? payRun(
        b,
        () => addCaja(s),
        () => S.caja.length,
        () => ({ c: S.caja[S.caja.length - 1] }),
      )
    : addCaja(s);
var campoPay = (r, b) =>
  payRun(
    b,
    () => mkP(r, true),
    () => S.caja.length,
    () => ({ c: S.caja[S.caja.length - 1] }),
  );
function matPay(b) {
  var old = ED ? S.alu.find((x) => x.id === ED) : null,
    m = monto(v("m_pag") || 0),
    d = (m || 0) - (old ? old.pag : 0);
  return d > 0
    ? payRun(
        b,
        saveAlu,
        () => S.caja.length,
        () => ({ c: S.caja[S.caja.length - 1] }),
      )
    : saveAlu();
}

function barcode(s) {
  let h = 2166136261;
  for (var c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  var r = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    return (h >>> 0) / 4294967296;
  };
  let w = 0,
    o = "";
  while (w < 196) {
    var bw = 1 + Math.floor(r() * 3),
      g = 1 + Math.floor(r() * 2);
    o += `<rect x="${w}" y="0" width="${bw}" height="46"/>`;
    w += bw + g;
  }
  return `<svg class=rc-bar viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden="true">${o}</svg>`;
}

function recibo(t) {
  var d = new Date(),
    f = d.toLocaleDateString("es-PE"),
    h = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
    num = String(Date.now()).slice(-9);
  let tit,
    sede,
    items = [],
    total,
    notas = [];
  if (t.k) {
    var k = t.k,
      a = S.alu.find((x) => x.id === k.aid);
    tit = "Venta de indumentaria";
    sede = sn(k.sede);
    items.push([k.p + " · Talla " + k.t, k.pr]);
    if (k.n || k.u !== "")
      notas.push("Estampado: " + (k.n || "—") + (k.u !== "" ? " N.° " + k.u : ""));
    notas.push("Alumno: " + k.al + (a ? " (" + a.id + ")" : ""));
    total = k.pr;
  } else {
    var c = t.c,
      a = S.alu.find((x) => x.id === c.d);
    tit = c.t === "I" ? "Comprobante de pago" : "Comprobante";
    sede = sn(c.sede);
    items.push([c.c, c.m]);
    if (a) notas.push("Alumno: " + a.nom + " " + a.ape + " (" + a.id + ")");
    else if (c.d) notas.push("Detalle: " + c.d);
    total = c.m;
  }
  let i = 0;
  var L = (x) => `<div class=rl data-dx=${i++}>${x}</div>`;
  var html = `<div class=rcw><div class=rc-slot></div><div class=rc-win><div class=rc id=rc>
${L(`<div class=rc-h><b>CDMT</b><span>Consorcio Deportivo<br>Madrid Trujillo</span></div>`)}
${L("<div class=rc-sep></div>")}
${L(`<div class=rc-m><span>${esc(tit)}</span><span>N.° ${esc(num)}</span></div>`)}
${L(`<div class=rc-m><span>${esc(f)}</span><span>${esc(h)}</span></div>`)}
${L(`<div class=rc-m><span>Sede</span><span>${esc(sede)}</span></div>`)}
${L("<div class=rc-sep></div>")}
${items.map(([x, m]) => L(`<div class=rc-l><span>${esc(x)}</span><b>${money(m)}</b></div>`)).join("")}
${notas.map((n) => L(`<p class=rc-note>${esc(n)}</p>`)).join("")}
${L("<div class=rc-sep></div>")}
${L(`<div class=rc-t><span>TOTAL</span><b>${money(total)}</b></div>`)}
${L(barcode(num) + `<p class=rc-code>${esc(num)}</p>`)}
${L("<p class=rc-ty>¡Gracias por tu pago!</p>")}
</div></div><div class=row><button data-f=print>Imprimir</button><button class=g data-f=cl>Cerrar</button></div></div>`;
  var m = DOM.mod;
  m.innerHTML = html;
  applyDynamicStyles(m);
  m.classList.add("o", "rcm");
}

/* ---- 5. Camiseta con nombre y número en tiempo real ---- */
function shirtHtml() {
  return `<aside class=kitp aria-label="Vista previa de la camiseta"><div class=shirt-stage><span class=shirt-tag>Espalda</span><canvas id=shirt width=360 height=360></canvas></div><p class="mu u-text-center u-m-8-0-0">El nombre y el número se estampan en tiempo real</p></aside>`;
}
function shirtInit() {
  if (document.fonts && document.fonts.load)
    document.fonts
      .load("400 100px Anton")
      .then(shirtDraw)
      .catch(() => {});
  if (SHIRT_IM) return shirtDraw();
  var im = new Image();
  im.onload = () => {
    SHIRT_IM = im;
    shirtDraw();
  };
  im.src = SHIRT_SRC;
}
function shirtDraw() {
  var c = document.getElementById("shirt");
  if (!c || !SHIRT_IM) return;
  var dpr = Math.min(2, window.devicePixelRatio || 1),
    cw = c.clientWidth || 340,
    iw = SHIRT_IM.width,
    ih = SHIRT_IM.height,
    pad = 0.05;
  var W = Math.round(cw * dpr),
    sw = W * (1 - 2 * pad),
    sc = sw / iw,
    sh = ih * sc,
    H = Math.round(sh + W * pad * 2.2);
  if (c.width !== W || c.height !== H) {
    c.width = W;
    c.height = H;
  }
  var x = c.getContext("2d");
  x.clearRect(0, 0, W, H);
  var ox = W * pad,
    oy = W * pad * 0.9;
  x.save();
  x.shadowColor = "rgba(0,0,0,.45)";
  x.shadowBlur = 22 * dpr;
  x.shadowOffsetY = 12 * dpr;
  x.drawImage(SHIRT_IM, ox, oy, sw, sh);
  x.restore();
  var name = (document.getElementById("k_n") || { value: "" }).value
      .trim()
      .toUpperCase()
      .slice(0, 30),
    num = (document.getElementById("k_u") || { value: "" }).value.trim();
  if (!name && !num) return;
  var o = document.createElement("canvas");
  o.width = W;
  o.height = H;
  var q = o.getContext("2d");
  var FF = 'Anton,Impact,"Arial Narrow",sans-serif',
    BLUE = "#1f4fae";
  var fit = (txt, capH, maxW) => {
    q.font = "100px " + FF;
    var m = q.measureText(txt),
      hh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || 70,
      w = m.width || 1;
    return {
      fs: Math.min((100 * capH) / hh, (100 * maxW) / w),
      asc: m.actualBoundingBoxAscent * (Math.min((100 * capH) / hh, (100 * maxW) / w) / 100),
    };
  };
  q.fillStyle = BLUE;
  q.textAlign = "center";
  q.textBaseline = "alphabetic";
  var cx = ox + sc * 226;
  var ANT = !document.fonts || document.fonts.check("100px Anton");
  q.lineJoin = "round";
  q.strokeStyle = BLUE;
  var put = (t, g, y) => {
    q.font = g.fs + "px " + FF;
    q.fillText(t, cx, y);
    if (!ANT) {
      q.lineWidth = g.fs * 0.07;
      q.strokeText(t, cx, y);
    }
  };
  if (name) {
    var g = fit(name, sc * 27, sc * 178);
    put(name, g, oy + sc * 72 + g.asc / 2);
  }
  if (num) {
    var g = fit(num, sc * 172, sc * 190);
    put(num, g, oy + sc * 190 + g.asc / 2);
  }
  q.globalCompositeOperation = "source-atop";
  q.strokeStyle = "rgba(0,0,45,.26)";
  q.lineWidth = Math.max(1, sc * 1.1);
  for (let sx = 116; sx < 336; sx += 15.8) {
    q.beginPath();
    q.moveTo(ox + sc * sx, 0);
    q.lineTo(ox + sc * sx, H);
    q.stroke();
  }
  q.globalCompositeOperation = "source-atop";
  var gr = q.createLinearGradient(0, oy, 0, oy + sh);
  gr.addColorStop(0, "rgba(255,255,255,.10)");
  gr.addColorStop(1, "rgba(0,0,30,.10)");
  q.fillStyle = gr;
  q.fillRect(0, 0, W, H);
  x.save();
  x.shadowColor = "rgba(0,0,0,.28)";
  x.shadowBlur = 2 * dpr;
  x.shadowOffsetY = 1 * dpr;
  x.drawImage(o, 0, 0);
  x.restore();
}
function kNumTyped(e) {
  e.value = e.value.replace(/\D/g, "").slice(0, 3);
  if (e.value && +e.value > 100) e.value = "100";
  KNUM = e.value ? +e.value : "";
  document.querySelectorAll(".n.sel").forEach((n) => n.classList.remove("sel"));
  var b = KNUM ? document.querySelector('.n[data-i="' + KNUM + '"]') : null;
  if (b) b.classList.add("sel");
  var a = S.alu.find((x) => x.id === KSEL);
  e.classList.toggle("bad", !!(KNUM && a && a.mod === "Competitivo" && ocup(a).has(KNUM)));
  shirtDraw();
}

/* ==================================================================
   18. EVENT LISTENERS (todos los eventos se registran aquí, ninguno en el HTML)
   ================================================================== */

/* Delegación: un único listener por tipo de evento resuelve el [data-*] más cercano */
function delegate(type, attr, registry) {
  document.addEventListener(type, (e) => {
    var el = e.target.closest("[" + attr + "]");
    var fn = el && registry[el.getAttribute(attr)];
    if (fn) fn(el, el.dataset.i, e);
  });
}
document.addEventListener("click", (e) => {
  var b = e.target.closest("[data-f]");
  if (b && FN[b.dataset.f]) FN[b.dataset.f](b.dataset.i, b.dataset.j, b.dataset.k, b);
});
delegate("input", "data-in", ON_INPUT);
delegate("change", "data-ch", ON_CHANGE);
delegate("keydown", "data-kd", ON_KEYDOWN);

/* Cerrar el modal al hacer clic en el fondo */
DOM.mod.addEventListener("click", (e) => {
  if (e.target === DOM.mod) cl();
});

/* Cierre de sesión por inactividad (30 min) */
["click", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, rIdle));

/* Video de fondo: reintenta la reproducción (autoplay bloqueado / pestaña oculta) */
function initBackgroundVideo() {
  var vid = DOM.video;
  if (!vid) return;
  vid.muted = true;
  vid.defaultMuted = true;
  vid.play().catch(() => {});
  var resume = () => {
    if (vid.paused) vid.play().catch(() => {});
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resume();
  });
  ["click", "touchstart", "keydown"].forEach((ev) =>
    addEventListener(ev, resume, { passive: true }),
  );
}

/* ==================================================================
   19. ARRANQUE
   ================================================================== */
initBackgroundVideo();
boot();
