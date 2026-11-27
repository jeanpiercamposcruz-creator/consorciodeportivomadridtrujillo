/* [ERP 03/18] 03-datos-supabase.js — Capa de datos: autenticación, sincronización y respaldo (sección 4). Código sin cambios respecto a script.js (líneas 301-824). */
/* ==================================================================
   4. CAPA DE DATOS (Supabase: autenticación, sincronización y respaldo)
   ================================================================== */
const CFG = window.__ERP_CONFIG__;

if (!CFG?.supabaseUrl || !CFG?.supabaseKey) {
  throw new Error("Configuración de Supabase no disponible. ERP detenido.");
}
const SB = CFG.supabaseUrl.replace(/\/+$/, ""),
  KEY = CFG.supabaseKey;

let TK = null,
  RT = null,
  UID = null,
  EM = "",
  VER = 0,
  SN = {},
  busy = 0,
  sv = Promise.resolve();

let REFRESHING = null;

async function sb(path, o = {}, retry = 1) {
  const ctl = new AbortController(),
    to = setTimeout(() => ctl.abort(), o.timeout || 20000);

  let r;

  try {
    r = await fetch(SB + path, {
      ...o,
      signal: ctl.signal,
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + (TK || KEY),
        "Content-Type": "application/json",
        ...(o.headers || {}),
      },
    });
  } finally {
    clearTimeout(to);
  }

  if (r.status === 401 && RT && retry) {
    REFRESHING =
      REFRESHING ||
      auth({ refresh_token: RT }, "refresh_token").finally(
        () => (REFRESHING = null)
      );

    await REFRESHING;
    return sb(path, o, 0);
  }

  return r;
}
async function auth(body, q) {
  const r = await fetch(SB + "/auth/v1/token?grant_type=" + q, {
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

  const j = await r.json();
  TK = j.access_token;
  RT = j.refresh_token;
  UID = j.user && j.user.id;
  EM = (j.user && j.user.email) || "";

  try {
    sessionStorage.setItem("cdmt_rt", RT);
  } catch (e) {}
}
async function sess() {
  const r = await sb(`/rest/v1/perfiles?select=rol&user_id=eq.${UID}`),
    j = await r.json();
  if (!r.ok || !j.length || j[0].rol !== "ADM") throw "rol";
  U = { id: "ADMIN", nom: EM, rol: "ADM" };
  V = "home";
}
const uid = () => crypto.randomUUID();
const G = (n, a, c) => ({
  n,
  rows: () =>
    S[a].map((x) => {
      if ("_id" in c && !x._id) {
        const qaId = n === "caja_movimientos" ? window.__ERP_QA_NEXT_CAJA_ID__ : null;
        x._id = qaId || uid();
        if (qaId) delete window.__ERP_QA_NEXT_CAJA_ID__;
      }
      const r = {};
      for (const f in c) {
        const v = x[f];
        r[c[f]] = v === "" || v === undefined ? null : v;
      }
      return r;
    }),
  load: (d) => {
    S[a] = d.map((r) => {
      const x = {};
      for (const f in c) {
        const v = r[c[f]];
        x[f] = v === null ? "" : v;
      }
      return x;
    });
  },
});
const HOR = G("horarios", "hor", {
  id: "id",
  sede: "sede_id",
  dep: "deporte_id",
  cat: "categoria",
  ini: "hora_inicio",
  fin: "hora_fin",
  dia: "dia_semana",
  est: "estado",
});
const TB = [
  {
    ...G("centros_costo", "cc", { id: "id", codigo: "codigo", nombre: "nombre", activo: "activo" }),
    opt: true,
  },
  G("sedes", "sedes", {
    id: "id",
    nombre: "nombre",
    dir: "direccion",
    con: "contacto",
    tipo: "tipo_alquiler",
    costo: "costo_mensual",
    cod: "codigo_corto",
    cc: "centro_costo_id",
    est: "estado",
  }),
  G("deportes", "deportes", { id: "id", nombre: "nombre" }),
  {
    ...G("contratos_alquiler", "contratos", {
      id: "id",
      sede: "sede_id",
      ini: "fecha_inicio",
      fin: "fecha_fin",
      monto: "monto_mensual",
      doc: "documento_url",
      vig: "vigente",
    }),
    opt: true,
  },
  {
    ...G("personal", "personal", {
      id: "id",
      nom: "nombres",
      dni: "dni",
      tel: "telefono",
      esp: "especialidad",
      rol: "rol",
      precio: "precio_hora",
      activo: "activo",
      foto: "foto",
      correo: "correo",
      tc: "tipo_contrato",
      fi: "fecha_inicio",
      ff: "fecha_fin",
      sf: "sueldo_fijo",
      jor: "jornada",
      mv: "permite_varias_sedes",
    }),
    read: async () => {
      if (U?.rol === "ADM") return all("personal");
      const r = await sb("/rest/v1/rpc/personal_directorio", { method: "POST", body: "{}" });
      if (!r.ok) throw new Error("No se pudo cargar el directorio público del personal.");
      return await r.json();
    },
  },
  {
    ...G("personal_sedes", "psedes", {
      id: "id",
      pid: "personal_id",
      sede: "sede_id",
      hr: "horario_resumen",
      hs: "horas_semanales",
    }),
    opt: true,
  },
  {
    ...G("personal_certificaciones", "pcert", {
      id: "id",
      pid: "personal_id",
      cert: "certificacion",
      ent: "entidad",
      ven: "fecha_vencimiento",
      est: "estado",
    }),
    opt: true,
  },
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
        const h = S.hor.find((h) => h.id === r.horario_id);
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
    cons: "consentimiento_ley_29733",
    mp: "metodo_pago",
    hoy: "monto_pagar_hoy",
  }),
  {
    ...G("cronograma_cuotas", "cuotas", {
      id: "id",
      aid: "alumno_id",
      n: "numero_cuota",
      f: "fecha_vencimiento",
      m: "monto",
      a: "monto_abonado",
      s: "saldo_pendiente",
      e: "estado",
    }),
    opt: true,
  },
  {
    n: "asistencias",
    rows: () =>
      S.asis.map((x) => {
        if (!x._id) {
          const qaId = window.__ERP_QA_NEXT_ASISTENCIA_ID__;
          x._id = qaId || uid();
          if (qaId) delete window.__ERP_QA_NEXT_ASISTENCIA_ID__;
        }
        return {
          id: x._id,
          fecha: x.f,
          tipo: x.t,
          alumno_id: x.t === "A" ? x.ref : null,
          personal_id: x.t === "P" ? x.ref : null,
          horario_id: x.h || null,
          asistio: x.ok === undefined ? null : x.ok,
          pago_campo: x.pc === undefined ? null : x.pc,
          pago_campo_movimiento_id: x.pcId || null,
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
        pcId: r.pago_campo_movimiento_id || null,
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
    est: "estado",
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
      const f = d.find((r) => r.id === "fee");
      S.fee = f ? f.valor : 5;
    },
  },
];
async function all(n) {
  let o = [],
    i = 0;
  for (;;) {
    const r = await sb(`/rest/v1/${n}?select=*&order=id&limit=1000&offset=${i}`);
    if (!r.ok) throw n;
    const j = await r.json();
    o = o.concat(j);
    if (j.length < 1000) return o;
    i += 1000;
  }
}
async function ver() {
  try {
    // La lectura de versión solo sincroniza el sondeo entre pestañas;
    // nunca debe dejar una escritura de negocio esperando indefinidamente.
    const r = await sb("/rest/v1/erp_meta?id=eq.1&select=ver", { timeout: 5000 });
    if (!r.ok) return;
    const rows = await r.json();
    if (rows[0] && Number.isFinite(Number(rows[0].ver))) VER = Number(rows[0].ver);
  } catch (e) {}
}
async function pull() {
  const aj = await all("ajustes");
  if (!aj.length && U.rol === "ADM") {
    let old = null;
    try {
      old = (await (await sb("/rest/v1/erp_state?id=eq.1&select=data")).json())[0].data;
    } catch (e) {}
    S = old && old.sedes ? old : seed();
    S.cuotas = S.cuotas || [];
    ["cc", "contratos", "psedes", "pcert"].forEach((k) => (S[k] = S[k] || []));
    SN = {};
    await flush();
    await ver();
    return;
  }
  // 1) Descargar todas las tablas en paralelo antes de tocar S o SN.
  // La lectura secuencial multiplicaba el timeout de 20 s por cada tabla y
  // podía dejar una recarga completa esperando varios minutos.
  const entradas = await Promise.all(TB.map(async (t) => [
    t.n,
    t.n === "ajustes"
      ? aj
      : t.read
        ? await t.read()
        : t.opt
          ? await all(t.n).catch(() => [])
          : await all(t.n),
  ]));
  const raw = Object.fromEntries(entradas);
  // 2) reemplazar el estado de golpe, sin ningún await en medio
  S = {
    sedes: [],
    deportes: [],
    personal: [],
    hor: [],
    alu: [],
    asis: [],
    kits: [],
    caja: [],
    cuotas: [],
    cc: [],
    contratos: [],
    psedes: [],
    pcert: [],
    c: {},
  };
  for (const t of TB) t.load(raw[t.n]);
  SN = {};
  TB.forEach((t) => (SN[t.n] = new Map(t.rows().map((r) => [r.id, JSON.stringify(r)]))));
  await ver();
}
async function flush() {
  const W = [],
    D = [];
  for (const t of TB) {
    const cur = t.rows(),
      m = new Map(cur.map((r) => [r.id, JSON.stringify(r)])),
      o = SN[t.n] || new Map();
    W.push([
      t,
      cur.filter((r) => !o.has(r.id)),
      cur.filter((r) => o.has(r.id) && o.get(r.id) !== m.get(r.id)),
      m,
    ]);
    D.unshift([t, [...o.keys()].filter((k) => !m.has(k)), m]);
  }

  // Una única RPC hace todos los INSERT/UPDATE/DELETE en una transacción PostgreSQL.
  // Si cualquier tabla o trigger rechaza una fila, Supabase revierte el lote completo.
  const delByTable = new Map(D.map(([t, del]) => [t.n, del]));
  const payload = W.map(([t, ins, upd]) => ({
    name: t.n,
    insert: ins,
    // Para alumnos se adjunta el importe visto al cargar el registro.
    // La RPC lo compara bajo bloqueo antes de aceptar cualquier actualización.
    // jsonb_populate_recordset ignora esta propiedad auxiliar.
    update: t.n === "alumnos"
      ? upd.map((r) => ({
          ...r,
          __expected_finanzas: (() => {
            const previo = JSON.parse(SN[t.n]?.get(r.id) || "{}");
            return {
              monto_pagado: previo.monto_pagado ?? null,
              costo_matricula: previo.costo_matricula ?? null,
              costo_mensualidad: previo.costo_mensualidad ?? null,
              meses: previo.meses ?? null,
            };
          })(),
        }))
      : upd,
    delete: delByTable.get(t.n) || [],
  }));
  if (SB === "https://yiredilknlwbzwvwlqyx.supabase.co" && U?.rol === "ADM") {
    const caja = payload.find((x) => x.name === "caja_movimientos");
    const kits = payload.find((x) => x.name === "kits_ventas");
    const asignaciones = payload.find((x) => x.name === "horario_profesores");
    const ids = (caja?.insert || []).map((x) => x.id);
    window.__ERP_QA_LAST_PERSISTENCIA_DIAG__ = {
      cajaInsertIds: ids,
      cajaUpdateIds: (caja?.update || []).map((x) => x.id),
      cajaDeleteIds: (caja?.delete || []),
      cajaDuplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
      kitInsertIds: (kits?.insert || []).map((x) => x.id),
      kitUpdateIds: (kits?.update || []).map((x) => x.id),
      horarioProfesorInsert: (asignaciones?.insert || []).map((x) => ({ id: x.id, horario_id: x.horario_id, personal_id: x.personal_id })),
    };
    window.__ERP_QA_LAST_SAVE_ERROR__ = null;
  }
  const changed = payload.some((x) => x.insert.length || x.update.length || x.delete.length);
  if (!changed) return;

  const r = await sb("/rest/v1/rpc/erp_persistir_lote", {
    method: "POST",
    body: JSON.stringify({ p_payload: payload }),
  });
  if (r.status === 409) throw "dup";
  if (!r.ok) {
    const detalle = await r.text();
    if (/23505|duplicate key/i.test(detalle)) throw "dup: HTTP " + r.status + " " + detalle;
    throw detalle;
  }

  // Solo se actualiza el snapshot local después de confirmar el lote completo.
  for (const [t, ins, upd, m] of W) SN[t.n] = m;
}
let SAVE_OK = true; // resultado del último guardado (lo consultan recibos y borrado de pre-registros)
function save(mensajeExito = "") {
  busy++;
  sv = sv
    .then(async () => {
      try {
        await flush();
        SAVE_OK = true;
        await ver();
        if (mensajeExito) toast(mensajeExito);
      } catch (e) {
        SAVE_OK = false;
        if (SB === "https://yiredilknlwbzwvwlqyx.supabase.co" && U?.rol === "ADM") {
          window.__ERP_QA_LAST_SAVE_ERROR__ = String(e);
        }
        console.error(e);
        const duplicado = e === "dup" || String(e).startsWith("dup:");
        const conflicto = /40001|La matrícula fue modificada en otra sesión/.test(String(e));
        toast(
          duplicado
            ? "Otro equipo creó el mismo código a la vez. Se recargaron los datos: repite tu registro."
            : conflicto
              ? "La matrícula cambió en otra sesión. Se recargaron los datos; revisa los importes y vuelve a intentarlo."
              : "No se pudo guardar: revisa la conexión o tus permisos",
        );
        // El lote RPC es atómico: si falla, recuperamos el estado confirmado
        // por Supabase para no dejar cambios optimistas que nunca se persistieron.
        try {
          await pull();
          R();
        } catch (errorRecarga) {
          console.error("No se pudo restaurar el estado confirmado después del fallo de guardado.", errorRecarga);
          toast("No se pudo guardar ni actualizar los datos. Recarga antes de continuar.");
        }
      } finally {
        busy--; // siempre, pase lo que pase
      }
    })
    .catch((e) => console.error("cola de guardado", e)); // la cadena nunca queda rechazada
}


/* Herramienta E2E de persistencia, limitada al proyecto Supabase QA y a administradores.
   No expone el estado interno general ni se habilita contra la base de producción. */
if (SB === "https://yiredilknlwbzwvwlqyx.supabase.co") {
  Object.defineProperty(window, "__ERP_QA_PERSISTENCIA__", {
    configurable: true,
    value: Object.freeze({
      build: "qa-source-audit-20261127-03",
      async prepararIdMatricula(dni) {
        if (U?.rol !== "ADM") throw new Error("La preparación requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal QA inválido.");
        const id = "QA-MAT-" + dni;
        if (S.alu.some((x) => x.id === id || x.dni === dni)) throw new Error("El identificador o DNI temporal ya existe en el ERP.");
        const r = await sb("/rest/v1/alumnos?dni=eq." + encodeURIComponent(dni) + "&select=id");
        if (!r.ok) throw new Error("No se pudo comprobar la unicidad del DNI QA.");
        if ((await r.json()).length) throw new Error("El DNI temporal ya existe en Supabase QA.");
        return "RPC";
      },
      async verificarMatriculaCompleta(dni) {
        if (U?.rol !== "ADM") throw new Error("La verificación requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal QA inválido.");
        await sv;
        if (!SAVE_OK) throw new Error("El guardado de matrícula no terminó correctamente.");
        const alumno = S.alu.find((x) => x.dni === dni && x.nom === "QA" && x.ape === "Persistencia");
        const prefijo = String(Y).slice(-2);
        if (!alumno || !/^\d{6}$/.test(String(alumno.id)) || !String(alumno.id).startsWith(prefijo)) {
          throw new Error("No se encontró la matrícula QA con código reservado por Supabase.");
        }
        const id = alumno.id;
        const leer = async (ruta) => {
          const r = await sb(ruta);
          if (!r.ok) throw new Error("Falló la lectura QA: " + await r.text());
          return r.json();
        };
        const alumnosDb = await leer("/rest/v1/alumnos?id=eq." + encodeURIComponent(id) +
          "&select=id,dni,nombres,apellidos,costo_matricula,costo_mensualidad,meses,monto_pagado");
        const cuotasDb = await leer("/rest/v1/cronograma_cuotas?alumno_id=eq." + encodeURIComponent(id) +
          "&select=id,alumno_id,numero_cuota,monto,monto_abonado,saldo_pendiente,estado&order=numero_cuota");
        const cajaDb = await leer("/rest/v1/caja_movimientos?detalle=eq." + encodeURIComponent(id) +
          "&select=id,tipo,concepto,detalle,monto,origen");
        if (alumnosDb.length !== 1) throw new Error("Supabase no contiene exactamente la matrícula QA.");
        if (Number(alumnosDb[0].monto_pagado) !== 230) throw new Error("El monto pagado de la ficha no coincide con S/230.");
        if (cuotasDb.length !== 2 || cuotasDb.some((x) =>
          Number(x.monto) !== 90 || Number(x.monto_abonado) !== 90 ||
          Number(x.saldo_pendiente) !== 0 || x.estado !== "Pagada")) {
          throw new Error("El cronograma persistido no contiene las dos cuotas pagadas esperadas.");
        }
        const ingresos = cajaDb.filter((x) => x.tipo === "I" && x.concepto === "Matrícula / mensualidad");
        const totalCaja = ingresos.reduce((s, x) => s + Number(x.monto || 0), 0);
        if (Math.abs(totalCaja - 230) > 0.009 || ingresos.length !== 1) {
          throw new Error("Caja no conserva un único ingreso por S/230 para esta matrícula.");
        }
        const origen = ingresos[0].origen || "";
        const codificado = origen.split("|aplicacion:")[1];
        if (!origen.startsWith("matricula:" + id + "|") || !codificado) {
          throw new Error("El ingreso de Caja no conserva la trazabilidad de la matrícula.");
        }
        const aplicacion = JSON.parse(decodeURIComponent(codificado));
        const esperada = [
          { destino: "Matrícula", cuota: 0, monto: 50 },
          { destino: "Cuota", cuota: 1, monto: 90 },
          { destino: "Cuota", cuota: 2, monto: 90 },
        ];
        if (JSON.stringify(aplicacion) !== JSON.stringify(esperada)) {
          throw new Error("La distribución persistida no coincide con matrícula S/50 y cuotas S/90 + S/90.");
        }
        await pull();
        const recuperado = S.alu.find((x) => x.id === id);
        const cuotasRestauradas = S.cuotas.filter((x) => x.aid === id).sort((a, b) => +a.n - +b.n);
        const cajaRestaurada = S.caja.filter((x) => x.d === id && x.t === "I");
        if (!recuperado || Number(recuperado.pag) !== 230 || cuotasRestauradas.length !== 2 ||
          cuotasRestauradas.some((x) => Number(x.a) !== 90 || Number(x.s) !== 0 || x.e !== "Pagada") ||
          cajaRestaurada.length !== 1 || Number(cajaRestaurada[0].m) !== 230) {
          throw new Error("La recarga del ERP no recuperó íntegramente matrícula, cuotas y Caja.");
        }
        return {
          id,
          alumno: alumnosDb[0],
          cuotas: cuotasDb,
          caja: ingresos[0],
          allocation: aplicacion,
          restored: {
            pagado: recuperado.pag,
            cuotas: cuotasRestauradas.map((x) => ({ n: x.n, monto: x.m, abonado: x.a, saldo: x.s, estado: x.e })),
            caja: cajaRestaurada.map((x) => ({ monto: x.m, origen: x.k })),
          },
        };
      },
      async cleanupMatricula(dni) {
        if (U?.rol !== "ADM") throw new Error("La limpieza requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal QA inválido.");
        if (window.__ERP_QA_NEXT_ALUMNO_ID__ === "QA-MAT-" + dni) delete window.__ERP_QA_NEXT_ALUMNO_ID__;
        await sv;
        await pull();
        const alumno = S.alu.find((x) => x.dni === dni);
        if (!alumno) {
          const r = await sb("/rest/v1/alumnos?dni=eq." + encodeURIComponent(dni) + "&select=id,nombres,apellidos");
          if (!r.ok) throw new Error("No se pudo comprobar si quedó una matrícula temporal.");
          const filas = await r.json();
          if (filas.length) throw new Error("El DNI existe, pero no coincide con la matrícula temporal esperada; se protege el registro.");
          return { removed: true };
        }
        const prefijo = String(Y).slice(-2);
        if (alumno.nom !== "QA" || alumno.ape !== "Persistencia" || alumno.dni !== dni ||
            !/^\d{6}$/.test(String(alumno.id)) || !String(alumno.id).startsWith(prefijo)) {
          throw new Error("El registro no tiene las marcas de seguridad QA; no se eliminará.");
        }
        const id = alumno.id;
        S.asis = S.asis.filter((x) => !(x.t === "A" && x.ref === id));
        S.kits = S.kits.filter((x) => x.aid !== id);
        S.caja = S.caja.filter((x) => x.d !== id);
        S.cuotas = S.cuotas.filter((x) => x.aid !== id);
        S.alu = S.alu.filter((x) => x.id !== id);
        save();
        await sv;
        if (!SAVE_OK) throw new Error("No se pudo guardar la limpieza de la matrícula QA.");
        const borrarSiQueda = async (tabla, filtro) => {
          const ruta = "/rest/v1/" + tabla + "?" + filtro;
          let r = await sb(ruta + "&select=id");
          if (!r.ok) throw new Error("No se pudo verificar limpieza en " + tabla + ".");
          let filas = await r.json();
          if (filas.length) {
            r = await sb(ruta, { method: "DELETE" });
            if (!r.ok) throw new Error("No se pudo limpiar " + tabla + ": " + await r.text());
          }
          r = await sb(ruta + "&select=id");
          if (!r.ok || (await r.json()).length) throw new Error("Quedaron registros temporales en " + tabla + ".");
        };
        await borrarSiQueda("asistencias", "alumno_id=eq." + encodeURIComponent(id));
        await borrarSiQueda("cronograma_cuotas", "alumno_id=eq." + encodeURIComponent(id));
        await borrarSiQueda("kits_ventas", "alumno_id=eq." + encodeURIComponent(id));
        await borrarSiQueda("caja_movimientos", "detalle=eq." + encodeURIComponent(id));
        await borrarSiQueda("alumnos", "id=eq." + encodeURIComponent(id));
        await pull();
        if (S.alu.some((x) => x.id === id) || S.cuotas.some((x) => x.aid === id) ||
          S.caja.some((x) => x.d === id) || S.asis.some((x) => x.ref === id) ||
          S.kits.some((x) => x.aid === id)) {
          throw new Error("El ERP aún conserva datos vinculados a la matrícula QA.");
        }
        return { removed: true, id };
      },
      async probarDashboardSinDobleConteo() {
        if (U?.rol !== "ADM") throw new Error("La prueba financiera requiere una sesión administradora QA.");
        const sede = S.sedes[0];
        if (!sede) throw new Error("No hay sede para probar el Dashboard.");
        const mes = today().slice(0, 7);
        const antes = gerRow(sede, mes);
        const originales = S.caja;
        try {
          S.caja = originales.concat([
            { _id: "QA-DASH-RENT", f: mes + "-10", sede: sede.id, t: "E", c: "Pago de alquiler", d: "QA", m: 100 },
            { _id: "QA-DASH-PAYROLL", f: mes + "-11", sede: sede.id, t: "E", c: "Planilla de entrenadores", d: "QA", m: 200 },
            { _id: "QA-DASH-OTHER", f: mes + "-12", sede: sede.id, t: "E", c: "Compras", d: "QA", m: 50 },
          ]);
          const despues = gerRow(sede, mes);
          return { deltaOtrosEgresos: despues.eg - antes.eg, deltaUtilidad: despues.u - antes.u };
        } finally {
          S.caja = originales;
        }
      },
      async probarRollbackLote() {
        if (U?.rol !== "ADM") throw new Error("La prueba de atomicidad requiere una sesión administradora QA.");
        const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const personalId = "QA-ATOMIC-P-" + suffix;
        const asignacionId = "QA-ATOMIC-H-" + suffix;
        const payload = [
          {
            name: "personal",
            insert: [{
              id: personalId,
              nombres: "QA Atomicidad",
              rol: "ENT",
              activo: 0,
              permite_varias_sedes: false,
              tipo_contrato: "Por horas",
              fecha_inicio: today(),
            }],
            update: [],
            delete: [],
          },
          {
            name: "horario_profesores",
            insert: [{ id: asignacionId, horario_id: "QA-HORARIO-INEXISTENTE", personal_id: personalId }],
            update: [],
            delete: [],
          },
        ];
        const intento = await sb("/rest/v1/rpc/erp_persistir_lote", {
          method: "POST",
          body: JSON.stringify({ p_payload: payload }),
        });
        const detalle = await intento.text();
        if (intento.ok || !/23503|foreign key/i.test(detalle)) {
          throw new Error("La escritura inválida no produjo el error FK esperado: " + detalle);
        }
        const persona = await sb("/rest/v1/personal?id=eq." + encodeURIComponent(personalId) + "&select=id");
        const asignacion = await sb("/rest/v1/horario_profesores?id=eq." + encodeURIComponent(asignacionId) + "&select=id");
        if (!persona.ok || !asignacion.ok) throw new Error("No se pudo verificar la reversión del lote.");
        if ((await persona.json()).length || (await asignacion.json()).length) {
          throw new Error("FALLO DE ATOMICIDAD: quedó persistida una parte del lote rechazado.");
        }
        return { rejected: true, rollback: true, residual: 0 };
      },
      async probarIdsMatriculaConcurrentes() {
        if (U?.rol !== "ADM" || SB !== "https://yiredilknlwbzwvwlqyx.supabase.co") throw new Error("La prueba de IDs de matrícula requiere sesión administradora en QA.");
        const anio = Number(String(Y).slice(2));
        const ruta = "/rest/v1/rpc/siguiente_id_matricula";
        const resultados = await Promise.all([
          sb(ruta, { method: "POST", body: JSON.stringify({ p_anio: anio }) }),
          sb(ruta, { method: "POST", body: JSON.stringify({ p_anio: anio }) }),
        ]);
        const ids = await Promise.all(resultados.map(async (r) => {
          if (!r.ok) throw new Error("Supabase rechazó la reserva concurrente de matrícula: " + await r.text());
          return r.json();
        }));
        const patron = new RegExp("^" + String(anio).padStart(2, "0") + "[0-9]{4}$");
        if (ids.length !== 2 || ids[0] === ids[1] || ids.some((id) => typeof id !== "string" || !patron.test(id))) throw new Error("El generador concurrente produjo IDs repetidos o inválidos.");
        return { ids, unique: new Set(ids).size };
      },
      async probarNumeroCamisetaConcurrente() {
        if (U?.rol !== "ADM" || SB !== "https://yiredilknlwbzwvwlqyx.supabase.co") {
          throw new Error("La prueba de números de camiseta requiere sesión administradora en QA.");
        }
        const sede = S.sedes[0];
        const deporte = S.deportes.find((x) => x.id);
        if (!sede || !deporte) throw new Error("No hay sede o deporte para la prueba de camisetas.");
        const base = String(Date.now() + Math.floor(Math.random() * 800));
        const alumnos = ["A", "B"].map((suffix, index) => ({
          id: "QA-SHIRT-" + base + "-" + suffix,
          nombres: "QA Camiseta " + suffix,
          apellidos: "Temporal",
          fecha_nacimiento: index ? "2013-01-01" : "2012-01-01",
          deporte_id: deporte.id,
          sede_id: sede.id,
          modalidad: "Competitivo",
          estado: "Activo",
        }));
        const kitIds = [base, String(Number(base) + 1)];
        const borrar = async (tabla, campo, valor) => {
          const ruta = "/rest/v1/" + tabla + "?" + campo + "=eq." + encodeURIComponent(valor);
          const r = await sb(ruta, { method: "DELETE" });
          if (!r.ok) throw new Error("No se pudo limpiar el registro QA de " + tabla + ": " + await r.text());
        };
        try {
          const alta = await sb("/rest/v1/alumnos", { method: "POST", body: JSON.stringify(alumnos) });
          if (!alta.ok) throw new Error("No se pudieron preparar los alumnos temporales: " + await alta.text());
          const intentos = await Promise.all(kitIds.map((id, index) => sb("/rest/v1/kits_ventas", {
            method: "POST",
            body: JSON.stringify({
              id: "QA-KIT-" + id,
              codigo: "QA-KIT-TEST",
              alumno_id: alumnos[index].id,
              alumno_nombre: alumnos[index].nombres,
              sede_id: sede.id,
              prenda: "Polo",
              talla: "M",
              nombre_camiseta: "QA",
              numero: "77",
              fecha_pedido: today(),
              precio_publico: 85,
              costo_confeccion: 35,
              estado: "Activa",
            }),
          })));
          const cuerpos = await Promise.all(intentos.map((r) => r.text()));
          const aceptados = intentos.filter((r) => r.ok).length;
          const rechazados = intentos.filter((r, i) => !r.ok && /23505|Ese número de camiseta ya está ocupado/.test(cuerpos[i])).length;
          if (aceptados !== 1 || rechazados !== 1) {
            throw new Error("La concurrencia de números de camiseta no se bloqueó como se esperaba: " + cuerpos.join(" | "));
          }
          const ids = kitIds.map((id) => "QA-KIT-" + id);
          const consulta = await sb("/rest/v1/kits_ventas?id=in.(" + ids.map(encodeURIComponent).join(",") + ")&select=id,estado");
          if (!consulta.ok) throw new Error("No se pudo verificar el resultado concurrente.");
          const persistidos = await consulta.json();
          if (persistidos.length !== 1 || persistidos[0].estado !== "Activa") {
            throw new Error("La base no conserva exactamente una camiseta activa para el mismo número.");
          }
          return { aceptados, rechazados, persistidos: persistidos.length };
        } finally {
          for (const id of kitIds) await borrar("kits_ventas", "id", "QA-KIT-" + id);
          for (const alumno of alumnos) await borrar("alumnos", "id", alumno.id);
          const kitsRestantes = await sb("/rest/v1/kits_ventas?id=in.(" + kitIds.map((id) => encodeURIComponent("QA-KIT-" + id)).join(",") + ")&select=id");
          const alumnosRestantes = await sb("/rest/v1/alumnos?id=in.(" + alumnos.map((a) => encodeURIComponent(a.id)).join(",") + ")&select=id");
          if (!kitsRestantes.ok || !alumnosRestantes.ok || (await kitsRestantes.json()).length || (await alumnosRestantes.json()).length) {
            throw new Error("La prueba de camisetas dejó residuos en Supabase QA.");
          }
        }
      },
      async prepararIdKit(id) {
        if (U?.rol !== "ADM") throw new Error("La preparación de venta QA requiere una sesión administradora.");
        if (!/^QA-KIT-\d{13}$/.test(String(id))) throw new Error("Identificador temporal de venta QA inválido.");
        if (S.kits.some((x) => x._id === id)) throw new Error("El identificador de venta QA ya existe en el ERP.");
        const r = await sb("/rest/v1/kits_ventas?id=eq." + encodeURIComponent(id) + "&select=id");
        if (!r.ok) throw new Error("No se pudo comprobar la unicidad de la venta QA.");
        if ((await r.json()).length) throw new Error("El identificador de venta QA ya existe en Supabase.");
        window.__ERP_QA_NEXT_KIT_ID__ = id;
        return id;
      },
      async verificarKitCaja(id) {
        if (U?.rol !== "ADM") throw new Error("La verificación de venta QA requiere una sesión administradora.");
        if (!/^QA-KIT-\d{13}$/.test(String(id))) throw new Error("Identificador temporal de venta QA inválido.");
        await sv;
        if (!SAVE_OK) {
          const diagnostico = {
            error: window.__ERP_QA_LAST_SAVE_ERROR__ || "desconocido",
            lote: window.__ERP_QA_LAST_PERSISTENCIA_DIAG__ || null,
          };
          throw new Error("El guardado de la venta QA no terminó correctamente: " + JSON.stringify(diagnostico));
        }
        const kitRuta = "/rest/v1/kits_ventas?id=eq." + encodeURIComponent(id) +
          "&select=id,codigo,precio_publico,alumno_id,estado";
        const cajaRuta = "/rest/v1/caja_movimientos?origen=eq." + encodeURIComponent("kit|" + id) +
          "&select=id,origen,monto,detalle,tipo,concepto";
        const reversaRuta = "/rest/v1/caja_movimientos?origen=eq." + encodeURIComponent("reversion-kit|" + id) +
          "&select=id,origen,monto,detalle,tipo,concepto";
        const kitResp = await sb(kitRuta);
        const cajaResp = await sb(cajaRuta);
        const reversaResp = await sb(reversaRuta);
        if (!kitResp.ok || !cajaResp.ok || !reversaResp.ok) throw new Error("No se pudo consultar la relación venta-Caja en Supabase.");
        const kitsDb = await kitResp.json();
        const cajaDb = await cajaResp.json();
        const reversaDb = await reversaResp.json();
        await pull();
        const kitRestaurado = S.kits.find((x) => x._id === id);
        const cajaRestaurada = S.caja.filter((x) => x.k === "kit|" + id);
        const reversaRestaurada = S.caja.filter((x) => x.k === "reversion-kit|" + id);
        return {
          database: { kits: kitsDb, caja: cajaDb, reversas: reversaDb },
          restored: {
            kit: kitRestaurado ? { id: kitRestaurado._id, pr: kitRestaurado.pr, aid: kitRestaurado.aid, est: kitRestaurado.est } : null,
            caja: cajaRestaurada.map((x) => ({ id: x._id, m: x.m, d: x.d, k: x.k, t: x.t })),
            reversas: reversaRestaurada.map((x) => ({ id: x._id, m: x.m, d: x.d, k: x.k, t: x.t })),
          },
        };
      },
      async verificarAusenciaKit(id) {
        if (U?.rol !== "ADM") throw new Error("La verificación de venta QA requiere una sesión administradora.");
        if (!/^QA-KIT-\d{13}$/.test(String(id))) throw new Error("Identificador temporal de venta QA inválido.");
        // Esperar la recuperación local tras el fallo inducido antes de consultar la BD.
        await sv;
        const [kitResp, cajaResp] = await Promise.all([
          sb("/rest/v1/kits_ventas?id=eq." + encodeURIComponent(id) + "&select=id"),
          sb("/rest/v1/caja_movimientos?origen=eq." + encodeURIComponent("kit|" + id) + "&select=id"),
        ]);
        if (!kitResp.ok || !cajaResp.ok) {
          throw new Error("No se pudo comprobar la ausencia de la venta rechazada en Supabase QA.");
        }
        const [kitsDb, cajaDb] = await Promise.all([kitResp.json(), cajaResp.json()]);
        if (kitsDb.length || cajaDb.length ||
            S.kits.some((x) => x._id === id) ||
            S.caja.some((x) => x.k === "kit|" + id)) {
          throw new Error("La venta rechazada dejó registros en memoria o en Supabase QA.");
        }
        return { kits: kitsDb.length, caja: cajaDb.length };
      },
      async cleanupKit(id) {
        if (U?.rol !== "ADM") throw new Error("La limpieza de venta QA requiere una sesión administradora.");
        if (!/^QA-KIT-\d{13}$/.test(String(id))) throw new Error("La limpieza solo acepta IDs temporales QA.");
        if (window.__ERP_QA_NEXT_KIT_ID__ === id) delete window.__ERP_QA_NEXT_KIT_ID__;
        await sv;
        await pull();
        S.kits = S.kits.filter((x) => x._id !== id);
        S.caja = S.caja.filter((x) => x.k !== "kit|" + id && x.k !== "reversion-kit|" + id);
        save();
        await sv;
        // Si el guardado normal falla, la limpieza continúa por REST para no dejar residuos QA.
        const borrar = async (tabla, filtro) => {
          const ruta = "/rest/v1/" + tabla + "?" + filtro;
          let r = await sb(ruta + "&select=id");
          if (!r.ok) throw new Error("No se pudo verificar la limpieza de " + tabla + ".");
          let filas = await r.json();
          if (filas.length) {
            r = await sb(ruta, { method: "DELETE" });
            if (!r.ok) throw new Error("No se pudo limpiar " + tabla + ": " + await r.text());
          }
          r = await sb(ruta + "&select=id");
          if (!r.ok || (await r.json()).length) throw new Error("Quedaron residuos QA en " + tabla + ".");
        };
        await borrar("caja_movimientos", "origen=eq." + encodeURIComponent("kit|" + id));
        await borrar("caja_movimientos", "origen=eq." + encodeURIComponent("reversion-kit|" + id));
        await borrar("kits_ventas", "id=eq." + encodeURIComponent(id));
        await pull();
        if (S.kits.some((x) => x._id === id) || S.caja.some((x) => x.k === "kit|" + id || x.k === "reversion-kit|" + id)) {
          throw new Error("El ERP aún conserva datos de la venta temporal QA.");
        }
        return { removed: true };
      },
      async prepararAsistenciaQA() {
        if (U?.rol !== "ADM") throw new Error("La prueba de asistencia requiere una sesión administradora QA.");
        await sv;
        if (!SAVE_OK) throw new Error("Hay una escritura previa pendiente o fallida; no se crea el alumno temporal.");
        const horario = S.hor.find((h) =>
          h.est !== "Inactivo" && h.sede && h.dep && Number.isInteger(Number(h.cat)) &&
          S.sedes.some((s) => s.id === h.sede) && S.deportes.some((d) => d.id === h.dep)
        );
        if (!horario) throw new Error("No hay un horario activo válido para crear el alumno temporal QA.");
        const fecha = today();
        const alumnoId = "QA-ATT-" + crypto.randomUUID();
        let dni = "";
        for (let intento = 0; intento < 5; intento++) {
          dni = String(10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000));
          const existente = await sb("/rest/v1/alumnos?dni=eq." + encodeURIComponent(dni) + "&select=id");
          if (!existente.ok) throw new Error("No se pudo comprobar la unicidad del DNI temporal QA.");
          if (!(await existente.json()).length) break;
          dni = "";
        }
        if (!dni) throw new Error("No se pudo reservar un DNI temporal único para la prueba QA.");
        const alumno = {
          id: alumnoId, nombres: "QA", apellidos: "Asistencia Temporal", dni, sexo: "M",
          fecha_nacimiento: String(Number(horario.cat)).padStart(4, "0") + "-01-01",
          deporte_id: horario.dep, sede_id: horario.sede, horario_id: horario.id,
          estado: "Activo", costo_matricula: 0, costo_mensualidad: 0, meses: 0,
          monto_pagado: 0, fecha_registro: fecha, monto_pagar_hoy: 0,
          qr_token: null, consentimiento_ley_29733: false,
        };
        let insertado = false;
        try {
          const respuesta = await sb("/rest/v1/alumnos", {
            method: "POST", body: JSON.stringify([alumno]),
          });
          if (!respuesta.ok) throw new Error("No se pudo crear el alumno temporal QA: " + await respuesta.text());
          insertado = true;
          await pull();
          const recuperado = S.alu.find((a) => a.id === alumnoId);
          if (!recuperado || recuperado.dni !== dni || recuperado.est !== "Activo" ||
              recuperado.hor !== horario.id || recuperado.sede !== horario.sede) {
            throw new Error("El ERP no recuperó correctamente el alumno temporal desde Supabase.");
          }
          const asistenciaId = crypto.randomUUID();
          const cajaId = crypto.randomUUID();
          window.__ERP_QA_NEXT_ASISTENCIA_ID__ = asistenciaId;
          window.__ERP_QA_NEXT_CAJA_ID__ = cajaId;
          return {
            alumnoId, alumnoDni: dni, horarioId: horario.id, sedeId: horario.sede,
            grupo: horario.dep + "|" + horario.cat, fecha,
            fee: Number(S.fee ?? 5), feeOriginal: Number(S.fee ?? 5),
            asistenciaId, cajaId,
          };
        } catch (error) {
          if (insertado) {
            const borrado = await sb("/rest/v1/alumnos?id=eq." + encodeURIComponent(alumnoId), { method: "DELETE" });
            if (!borrado.ok) throw new Error("Falló la preparación QA y no se pudo retirar el alumno temporal: " + await borrado.text());
          }
          throw error;
        }
      },
      async verificarAsistenciaQA(datos, asistio, pagoCampo, recargar = false) {
        if (U?.rol !== "ADM") throw new Error("La verificación requiere una sesión administradora QA.");
        if (!datos || !String(datos.alumnoId).startsWith("QA-ATT-") ||
            !/^\d{8}$/.test(String(datos.alumnoDni)) ||
            !/^[0-9a-f-]{36}$/i.test(String(datos.asistenciaId)) ||
            !/^[0-9a-f-]{36}$/i.test(String(datos.cajaId))) {
          throw new Error("IDs temporales de asistencia inválidos.");
        }
        // No verificar el estado intermedio mientras payRun aún mantiene bloqueadas
        // las acciones de cobro/reversión y termina la animación de confirmación.
        const limitePago = Date.now() + 10000;
        while (PAYB && Date.now() < limitePago) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (PAYB) throw new Error("La operación de pago de campo no liberó su bloqueo en 10 segundos.");
        const guardadoCompleto = await Promise.race([
          sv.then(() => true),
          new Promise((resolve) => setTimeout(() => resolve(false), 15000)),
        ]);
        if (!guardadoCompleto) {
          throw new Error("La cola de persistencia no terminó en 15 segundos. Estado: " +
            JSON.stringify({ busy, PAYB, SAVE_OK, ultimoError: window.__ERP_QA_LAST_SAVE_ERROR__ || null }));
        }
        if (!SAVE_OK) throw new Error("El guardado de asistencia falló: " + (window.__ERP_QA_LAST_SAVE_ERROR__ || "sin detalle"));

        const asistenciaResp = await sb("/rest/v1/asistencias?id=eq." + encodeURIComponent(datos.asistenciaId) +
          "&select=id,fecha,tipo,alumno_id,horario_id,asistio,pago_campo,pago_campo_movimiento_id");
        const cajaResp = await sb("/rest/v1/caja_movimientos?detalle=eq." + encodeURIComponent(datos.alumnoId) +
          "&fecha=eq." + encodeURIComponent(datos.fecha) +
          "&select=id,fecha,sede_id,tipo,concepto,detalle,monto,origen");
        const asistenciaCompResp = await sb("/rest/v1/asistencias?alumno_id=eq." + encodeURIComponent(datos.alumnoId) +
          "&horario_id=eq." + encodeURIComponent(datos.horarioId) + "&fecha=eq." +
          encodeURIComponent(datos.fecha) + "&tipo=eq.A&select=id");
        if (!asistenciaResp.ok || !cajaResp.ok || !asistenciaCompResp.ok) {
          throw new Error("No se pudo consultar la persistencia real de asistencia y Caja.");
        }

        const asistenciasDb = await asistenciaResp.json();
        const cajaRows = await cajaResp.json();
        const asistenciasComp = await asistenciaCompResp.json();
        if (asistenciasDb.length !== 1 || asistenciasComp.length !== 1 ||
            asistenciasComp[0].id !== datos.asistenciaId) {
          throw new Error("Supabase no contiene exactamente una asistencia para alumno, horario y fecha.");
        }

        const base = "campo|" + datos.fecha + "|" + datos.alumnoId + "|" + datos.horarioId;
        const ingresos = cajaRows.filter((x) => x.tipo === "I" && x.concepto === "Pago de campo" &&
          (x.origen === base || String(x.origen || "").startsWith(base + "|")));
        const reversiones = cajaRows.filter((x) => x.tipo === "E" && x.concepto === "Reversión de pago de campo" &&
          String(x.origen || "").startsWith("reversion-campo:"));
        if (cajaRows.some((x) => !ingresos.includes(x) && !reversiones.includes(x))) {
          throw new Error("Caja contiene un movimiento ajeno al pago temporal de esta asistencia.");
        }

        const asistencia = asistenciasDb[0];
        const currentId = asistencia.pago_campo_movimiento_id || null;
        if (asistencia.alumno_id !== datos.alumnoId || asistencia.horario_id !== datos.horarioId ||
            asistencia.fecha !== datos.fecha || asistencia.tipo !== "A" || asistencia.asistio !== asistio ||
            (pagoCampo === null ? asistencia.pago_campo !== null : asistencia.pago_campo !== pagoCampo)) {
          throw new Error("La asistencia persistida no coincide con el estado solicitado.");
        }
        if (pagoCampo === true && Number(datos.fee) > 0) {
          const actual = ingresos.find((x) => x.id === currentId);
          if (!currentId || !actual || Number(actual.monto) !== Number(datos.fee)) {
            throw new Error("La asistencia no apunta al ingreso vigente de Caja.");
          }
        } else if (pagoCampo !== true && currentId) {
          throw new Error("Una asistencia pendiente conserva un vínculo a un ingreso de Caja.");
        }

        for (const ingreso of ingresos) {
          const partes = String(ingreso.origen || "").split("|");
          if (partes.length === 5 && partes[4] !== ingreso.id) {
            throw new Error("El origen del ingreso no coincide con su identificador.");
          }
          const reversa = reversiones.filter((x) => x.origen === "reversion-campo:" + ingreso.id);
          if (ingreso.id === currentId) {
            if (reversa.length) throw new Error("El ingreso vigente ya tiene una reversión registrada.");
          } else if (reversa.length !== 1 || Number(reversa[0].monto) !== Number(ingreso.monto)) {
            throw new Error("Un ingreso anterior no conserva su reversión compensatoria exacta.");
          }
        }
        if (reversiones.some((x) => !ingresos.some((i) => x.origen === "reversion-campo:" + i.id))) {
          throw new Error("Existe una reversión de campo sin ingreso original.");
        }

        if (recargar) await pull();
        const restaurada = S.asis.find((x) => x._id === datos.asistenciaId);
        const movimientosRestaurados = S.caja.filter((x) => x.d === datos.alumnoId && x.f === datos.fecha &&
          (x.k === base || String(x.k || "").startsWith(base + "|") ||
           String(x.k || "").startsWith("reversion-campo:")));
        if (!restaurada || restaurada.ok !== asistio ||
            (pagoCampo === null ? restaurada.pc !== undefined : restaurada.pc !== pagoCampo) ||
            (restaurada.pcId || null) !== currentId ||
            (pagoCampo === true && Number(datos.fee) > 0 && !movimientosRestaurados.some((x) => x._id === currentId))) {
          throw new Error("El ERP no conserva el estado y vínculo esperado de asistencia y Caja en memoria.");
        }
        return {
          asistencia,
          caja: ingresos,
          reversion: reversiones,
          currentCajaId: currentId,
          restored: { asistio: restaurada.ok, pagoCampo: restaurada.pc, caja: movimientosRestaurados.length, currentCajaId: restaurada.pcId || null },
        };
      },
      async cleanupAsistenciaQA(datos) {
        if (U?.rol !== "ADM") throw new Error("La limpieza requiere una sesión administradora QA.");
        if (!datos || !String(datos.alumnoId).startsWith("QA-ATT-") ||
            !/^\d{8}$/.test(String(datos.alumnoDni)) ||
            !/^[0-9a-f-]{36}$/i.test(String(datos.asistenciaId)) ||
            !/^[0-9a-f-]{36}$/i.test(String(datos.cajaId)) ||
            !Number.isFinite(Number(datos.feeOriginal))) {
          throw new Error("IDs temporales de asistencia o tarifa original inválidos.");
        }
        if (window.__ERP_QA_NEXT_ASISTENCIA_ID__ === datos.asistenciaId) delete window.__ERP_QA_NEXT_ASISTENCIA_ID__;
        if (window.__ERP_QA_NEXT_CAJA_ID__ === datos.cajaId) delete window.__ERP_QA_NEXT_CAJA_ID__;
        // Nunca limpiar mientras una escritura anterior siga pendiente:
        // hacerlo podría competir con una RPC tardía y dejar residuos.
        const guardadoTermino = await Promise.race([
          sv.then(() => true),
          new Promise((resolve) => setTimeout(() => resolve(false), 10000)),
        ]);
        if (!guardadoTermino) {
          throw new Error("La cola de persistencia sigue activa; se pospone la limpieza para no competir con una escritura.");
        }
        if (!SAVE_OK) {
          throw new Error("La última escritura falló; se conserva el fixture QA para una limpieza segura.");
        }

        const asistenciaRuta = "/rest/v1/asistencias?id=eq." + encodeURIComponent(datos.asistenciaId);
        const alumnoRuta = "/rest/v1/alumnos?id=eq." + encodeURIComponent(datos.alumnoId);
        // Buscar todos los movimientos del fixture: una reversión de limpieza
        // puede tener fecha posterior a la asistencia original.
        const cajaRuta = "/rest/v1/caja_movimientos?detalle=eq." + encodeURIComponent(datos.alumnoId);
        const [asistenciaCheck, cajaCheck, alumnoCheck, otrasAsistencias] = await Promise.all([
          sb(asistenciaRuta + "&select=id,fecha,tipo,alumno_id,horario_id,pago_campo,pago_campo_movimiento_id"),
          sb(cajaRuta + "&select=id,fecha,sede_id,tipo,concepto,detalle,monto,origen"),
          sb(alumnoRuta + "&select=id,nombres,apellidos,dni,horario_id,sede_id,deporte_id"),
          sb("/rest/v1/asistencias?alumno_id=eq." + encodeURIComponent(datos.alumnoId) + "&select=id"),
        ]);
        if (![asistenciaCheck, cajaCheck, alumnoCheck, otrasAsistencias].every((r) => r.ok)) {
          throw new Error("No se pudo verificar la limpieza del alumno temporal QA.");
        }

        const asistencias = await asistenciaCheck.json();
        const cajas = await cajaCheck.json();
        const alumnos = await alumnoCheck.json();
        const asistenciasRelacionadas = await otrasAsistencias.json();
        if (alumnos.some((a) => a.nombres !== "QA" || a.apellidos !== "Asistencia Temporal" ||
            a.dni !== datos.alumnoDni || a.horario_id !== datos.horarioId ||
            a.sede_id !== datos.sedeId || a.deporte_id !== datos.grupo.split("|")[0])) {
          throw new Error("El ID de alumno ya no coincide con el registro temporal; se protege el registro.");
        }
        if (asistencias.some((x) => x.fecha !== datos.fecha || x.tipo !== "A" ||
            x.alumno_id !== datos.alumnoId || x.horario_id !== datos.horarioId) ||
            asistenciasRelacionadas.some((x) => x.id !== datos.asistenciaId)) {
          throw new Error("La asistencia ya no coincide con el único registro temporal; se protege el registro.");
        }

        const base = "campo|" + datos.fecha + "|" + datos.alumnoId + "|" + datos.horarioId;
        const ingresos = cajas.filter((x) => x.tipo === "I" && x.concepto === "Pago de campo" &&
          (x.origen === base || String(x.origen || "").startsWith(base + "|")));
        const reversiones = cajas.filter((x) => x.tipo === "E" && x.concepto === "Reversión de pago de campo" &&
          String(x.origen || "").startsWith("reversion-campo:"));
        if (cajas.some((x) => !ingresos.includes(x) && !reversiones.includes(x)) ||
            ingresos.some((x) => x.detalle !== datos.alumnoId || x.sede_id !== datos.sedeId ||
              (String(x.origen).split("|").length === 5 && String(x.origen).split("|")[4] !== x.id)) ||
            reversiones.some((x) => {
              const original = ingresos.find((i) => x.origen === "reversion-campo:" + i.id);
              return !original || Number(x.monto) !== Number(original.monto) || x.detalle !== datos.alumnoId;
            })) {
          throw new Error("Los movimientos de Caja ya no coinciden con el ledger temporal; se protegen.");
        }

        if (alumnos.length > 1 || asistencias.length > 1) {
          throw new Error("El fixture temporal tiene más de un alumno o asistencia; se protege la información.");
        }
        const asistencia = asistencias[0] || null;
        const activos = ingresos.filter((ingreso) =>
          !reversiones.some((reversa) => reversa.origen === "reversion-campo:" + ingreso.id)
        );
        if (activos.length && (!asistencia || asistencia.pago_campo !== true)) {
          throw new Error("Hay un ingreso de campo activo sin una asistencia temporal marcada como pagada; se aborta la limpieza.");
        }
        if (asistencia && asistencia.pago_campo_movimiento_id &&
            !ingresos.some((ingreso) => ingreso.id === asistencia.pago_campo_movimiento_id)) {
          throw new Error("La asistencia apunta a un ingreso ajeno al fixture QA; se protege el registro.");
        }
        // Si una prueba falló después de cobrar, primero compensamos el ingreso
        // temporal y desvinculamos la asistencia; así el trigger de integridad
        // permite borrarla sin dejar un pago de campo huérfano.
        for (const ingreso of activos) {
          const compensacion = {
            id: crypto.randomUUID(),
            fecha: today(),
            sede_id: ingreso.sede_id,
            tipo: "E",
            concepto: "Reversión de pago de campo",
            detalle: datos.alumnoId,
            monto: Number(ingreso.monto),
            origen: "reversion-campo:" + ingreso.id,
          };
          const creada = await sb("/rest/v1/caja_movimientos", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(compensacion),
          });
          if (!creada.ok) throw new Error("No se pudo compensar el pago temporal antes de limpiar: " + await creada.text());
          reversiones.push(compensacion);
        }
        if (asistencia && (asistencia.pago_campo === true || asistencia.pago_campo_movimiento_id)) {
          const desvinculada = await sb(asistenciaRuta, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ pago_campo: false, pago_campo_movimiento_id: null }),
          });
          if (!desvinculada.ok) throw new Error("No se pudo desvincular el pago temporal antes de limpiar: " + await desvinculada.text());
        }
        if (asistencias.length) {
          const borrado = await sb(asistenciaRuta, { method: "DELETE" });
          if (!borrado.ok) throw new Error("No se pudo eliminar la asistencia temporal: " + await borrado.text());
        }
        for (const movimiento of [...reversiones, ...ingresos]) {
          const borrado = await sb("/rest/v1/caja_movimientos?id=eq." + encodeURIComponent(movimiento.id), { method: "DELETE" });
          if (!borrado.ok) throw new Error("No se pudo retirar un movimiento temporal de Caja: " + await borrado.text());
        }
        if (alumnos.length) {
          const borrado = await sb(alumnoRuta, { method: "DELETE" });
          if (!borrado.ok) throw new Error("No se pudo eliminar el alumno temporal: " + await borrado.text());
        }

        const [asistenciaFinal, cajaFinal, alumnoFinal] = await Promise.all([
          sb(asistenciaRuta + "&select=id"),
          sb(cajaRuta + "&select=id"),
          sb(alumnoRuta + "&select=id"),
        ]);
        if (![asistenciaFinal, cajaFinal, alumnoFinal].every((r) => r.ok) ||
            (await asistenciaFinal.json()).length || (await cajaFinal.json()).length ||
            (await alumnoFinal.json()).length) {
          throw new Error("La limpieza de asistencia QA dejó registros residuales.");
        }

        await pull();
        if (S.asis.some((x) => x._id === datos.asistenciaId) ||
            S.caja.some((x) => x.d === datos.alumnoId && x.f === datos.fecha) ||
            S.alu.some((x) => x.id === datos.alumnoId)) {
          throw new Error("El ERP todavía conserva los registros temporales de asistencia.");
        }
        if (Number(S.fee ?? 5) !== Number(datos.feeOriginal)) {
          S.fee = Number(datos.feeOriginal);
          save();
          await sv;
          if (!SAVE_OK) throw new Error("No se pudo restaurar la tarifa original de campo en QA.");
          await pull();
        }
        if (Number(S.fee ?? 5) !== Number(datos.feeOriginal)) {
          throw new Error("La tarifa de campo no volvió a su valor original después de la prueba.");
        }
        return { removed: true, feeRestored: Number(S.fee ?? 5) };
      },
      async prepararPersonalContratoQA(dni) {
        if (U?.rol !== "ADM") throw new Error("La prueba de contrato requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal de personal inválido.");
        if (S.personal.some((p) => p.dni === dni)) throw new Error("El DNI temporal ya existe en el ERP.");
        const r = await sb("/rest/v1/personal?dni=eq." + encodeURIComponent(dni) + "&select=id");
        if (!r.ok) throw new Error("No se pudo comprobar la unicidad del DNI de personal.");
        if ((await r.json()).length) throw new Error("El DNI temporal ya existe en Supabase QA.");
        return { dni, preparado: true };
      },
      async verificarPersonalContratoQA(dni, esperado) {
        if (U?.rol !== "ADM") throw new Error("La verificación requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal de personal inválido.");
        await sv;
        if (!SAVE_OK) throw new Error("El guardado del contrato de personal falló: " + (window.__ERP_QA_LAST_SAVE_ERROR__ || "sin detalle"));
        const r = await sb("/rest/v1/personal?dni=eq." + encodeURIComponent(dni) +
          "&select=id,nombres,dni,rol,tipo_contrato,fecha_inicio,fecha_fin,precio_hora,sueldo_fijo,jornada,activo");
        if (!r.ok) throw new Error("No se pudo leer el contrato persistido: " + await r.text());
        const rows = await r.json();
        if (rows.length !== 1) throw new Error("Supabase no contiene exactamente un registro para el contrato temporal.");
        const p = rows[0];
        if (p.nombres !== "QA Contrato Temporal" || p.dni !== dni || p.rol !== "ENT" ||
            p.tipo_contrato !== esperado.tipo || p.fecha_inicio !== esperado.inicio ||
            p.fecha_fin !== esperado.fin || Number(p.precio_hora) !== esperado.precio ||
            Number(p.sueldo_fijo) !== esperado.sueldo || p.jornada !== esperado.jornada ||
            Number(p.activo) !== 1) {
          throw new Error("Los campos del contrato persistidos no coinciden con los valores enviados.");
        }
        await pull();
        const recuperado = S.personal.find((x) => x.id === p.id);
        if (!recuperado || recuperado.nom !== "QA Contrato Temporal" || recuperado.tc !== esperado.tipo ||
            recuperado.fi !== esperado.inicio || recuperado.ff !== esperado.fin ||
            Number(recuperado.precio) !== esperado.precio || Number(recuperado.sf) !== esperado.sueldo ||
            recuperado.jor !== esperado.jornada || Number(recuperado.activo) !== 1) {
          throw new Error("El ERP no recuperó los campos del contrato después de recargar Supabase.");
        }
        return { id: p.id, database: p, restored: recuperado };
      },
      async asignarHorarioPersonalQA(dni) {
        if (U?.rol !== "ADM") throw new Error("La asignación de prueba requiere una sesión administradora QA.");
        await sv;
        if (!SAVE_OK) throw new Error("Hay una escritura pendiente o fallida antes de asignar el horario.");
        const personaResp = await sb("/rest/v1/personal?dni=eq." + encodeURIComponent(dni) +
          "&select=id,nombres,dni,rol,activo,precio_hora");
        if (!personaResp.ok) throw new Error("No se pudo recuperar el personal temporal.");
        const personas = await personaResp.json();
        if (personas.length !== 1 || personas[0].nombres !== "QA Contrato Temporal" ||
            personas[0].rol !== "ENT" || Number(personas[0].activo) !== 1) {
          throw new Error("El personal temporal no está listo para recibir un horario.");
        }
        const persona = personas[0];
        const plantillaHorario = S.hor.find((h) =>
          h.est !== "Inactivo" && h.sede && h.dep && h.ini && h.fin &&
          S.sedes.some((s) => s.id === h.sede) && S.deportes.some((d) => d.id === h.dep)
        );
        if (!plantillaHorario) throw new Error("No hay un horario base válido para la prueba.");
        // El ERP y la columna horarios.dia_semana usan números: lunes=1 ... domingo=7.
        // Guardar nombres localizados aquí hacía que +h.dia fuera NaN y las horas semanales fueran 0.
        const dias = {
          Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
          Friday: 5, Saturday: 6, Sunday: 7,
        };
        const diaActual = dias[new Intl.DateTimeFormat("en-US", {
          weekday: "long", timeZone: "America/Lima",
        }).format(new Date())];
        if (!Number.isInteger(diaActual) || diaActual < 1 || diaActual > 7) {
          throw new Error("No se pudo determinar el día local numérico de la prueba.");
        }
        const horario = {
          id: "HOR-QA-E2E-" + crypto.randomUUID(),
          sede: plantillaHorario.sede, dep: plantillaHorario.dep, cat: plantillaHorario.cat,
          ini: plantillaHorario.ini, fin: plantillaHorario.fin, dia: diaActual, est: "Activo",
        };
        const existentesSede = await sb("/rest/v1/personal_sedes?personal_id=eq." +
          encodeURIComponent(persona.id) + "&select=id");
        const existentesHorario = await sb("/rest/v1/horario_profesores?personal_id=eq." +
          encodeURIComponent(persona.id) + "&select=id");
        if (!existentesSede.ok || !existentesHorario.ok) throw new Error("No se pudieron comprobar las asignaciones previas.");
        if ((await existentesSede.json()).length || (await existentesHorario.json()).length) {
          throw new Error("El personal temporal ya tiene asignaciones; no se modifica ninguna.");
        }
        const minutos = (valor) => {
          const partes = String(valor).split(":").map(Number);
          return partes.length >= 2 ? partes[0] * 60 + partes[1] : NaN;
        };
        const horas = Math.round((minutos(horario.fin) - minutos(horario.ini)) / 60 * 100) / 100;
        if (!Number.isFinite(horas) || horas <= 0) throw new Error("La duración del horario no es válida.");
        const sedeLinkId = crypto.randomUUID();
        const horarioLinkId = crypto.randomUUID();
        const asistenciaId = crypto.randomUUID();
        const sedeLink = {
          id: sedeLinkId, personal_id: persona.id, sede_id: horario.sede,
          horario_resumen: "QA E2E " + horario.ini + "-" + horario.fin,
          horas_semanales: horas,
        };
        const horarioLink = {
          id: horarioLinkId, horario_id: horario.id, personal_id: persona.id,
        };
        let horarioTemporalInsertado = false;
        let sedeInsertada = false;
        let horarioInsertado = false;
        try {
          const horarioTemporalResp = await sb("/rest/v1/horarios", {
            method: "POST",
            body: JSON.stringify([{
              id: horario.id, sede_id: horario.sede, deporte_id: horario.dep,
              categoria: horario.cat, hora_inicio: horario.ini, hora_fin: horario.fin,
              dia_semana: horario.dia, estado: "Activo",
            }]),
          });
          if (!horarioTemporalResp.ok) throw new Error("No se pudo crear el horario QA temporal: " + await horarioTemporalResp.text());
          horarioTemporalInsertado = true;
          const sedeResp = await sb("/rest/v1/personal_sedes", {
            method: "POST", body: JSON.stringify([sedeLink]),
          });
          if (!sedeResp.ok) throw new Error("No se pudo crear el vínculo temporal de sede: " + await sedeResp.text());
          sedeInsertada = true;
          const horarioResp = await sb("/rest/v1/horario_profesores", {
            method: "POST", body: JSON.stringify([horarioLink]),
          });
          if (!horarioResp.ok) throw new Error("El trigger rechazó la asignación temporal de horario: " + await horarioResp.text());
          horarioInsertado = true;
          await pull();
          const horarioRestaurado = S.hor.find((h) => h.id === horario.id);
          if (!S.psedes.some((x) => x.pid === persona.id && x.sede === horario.sede) ||
              !horarioRestaurado?.profs?.includes(persona.id)) {
            throw new Error("El ERP no recuperó la asignación temporal de sede y horario.");
          }
          window.__ERP_QA_NEXT_ASISTENCIA_ID__ = asistenciaId;
          return {
            personalId: persona.id, sedeId: horario.sede, horarioId: horario.id,
            horarioTemporalId: horario.id, diaSemana: horario.dia,
            grupo: horario.dep + "|" + horario.cat, fecha: today(), tarifa: Number(persona.precio_hora),
            horasHorario: horas, sedeLinkId, horarioLinkId, asistenciaId,
          };
        } catch (error) {
          if (horarioInsertado) {
            await sb("/rest/v1/horario_profesores?id=eq." + encodeURIComponent(horarioLinkId), { method: "DELETE" });
          }
          if (sedeInsertada) {
            await sb("/rest/v1/personal_sedes?id=eq." + encodeURIComponent(sedeLinkId), { method: "DELETE" });
          }
          if (horarioTemporalInsertado) {
            await sb("/rest/v1/horarios?id=eq." + encodeURIComponent(horario.id), { method: "DELETE" });
          }
          await pull();
          throw error;
        }
      },
      async verificarAsistenciaPersonalQA(datos, asistio, recargar = false) {
        if (U?.rol !== "ADM" || !datos || !String(datos.personalId).startsWith("PER-ENT-") ||
            !/^[0-9a-f-]{36}$/i.test(String(datos.asistenciaId))) {
          throw new Error("Datos de asistencia temporal del personal inválidos.");
        }
        await sv;
        if (!SAVE_OK) throw new Error("El guardado de asistencia del personal falló: " + (window.__ERP_QA_LAST_SAVE_ERROR__ || "sin detalle"));
        const rutaId = "/rest/v1/asistencias?id=eq." + encodeURIComponent(datos.asistenciaId) +
          "&select=id,fecha,tipo,personal_id,horario_id,asistio";
        const rutaComp = "/rest/v1/asistencias?personal_id=eq." + encodeURIComponent(datos.personalId) +
          "&horario_id=eq." + encodeURIComponent(datos.horarioId) + "&fecha=eq." +
          encodeURIComponent(datos.fecha) + "&tipo=eq.P&select=id";
        const [porId, porComp] = await Promise.all([sb(rutaId), sb(rutaComp)]);
        if (!porId.ok || !porComp.ok) throw new Error("No se pudo consultar la asistencia del personal en Supabase.");
        const filas = await porId.json();
        const coincidencias = await porComp.json();
        if (filas.length !== 1 || coincidencias.length !== 1 || coincidencias[0].id !== datos.asistenciaId) {
          throw new Error("Supabase no contiene exactamente una asistencia para el personal temporal.");
        }
        const fila = filas[0];
        if (fila.personal_id !== datos.personalId || fila.horario_id !== datos.horarioId ||
            fila.fecha !== datos.fecha || fila.tipo !== "P" || fila.asistio !== asistio) {
          throw new Error("La asistencia del personal persistida no coincide con el estado solicitado.");
        }
        if (recargar) await pull();
        const restaurada = S.asis.find((x) => x._id === datos.asistenciaId);
        if (!restaurada || restaurada.t !== "P" || restaurada.ref !== datos.personalId ||
            restaurada.h !== datos.horarioId || restaurada.ok !== asistio) {
          throw new Error("El ERP no recuperó la asistencia del personal desde Supabase.");
        }
        return { database: fila, restored: { tipo: restaurada.t, personal: restaurada.ref, asistio: restaurada.ok } };
      },
      async cleanupPersonalContratoQA(dni, extras = null) {
        if (U?.rol !== "ADM") throw new Error("La limpieza requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal de personal inválido.");
        if (extras && (!/^[0-9a-f-]{36}$/i.test(String(extras.sedeLinkId)) ||
            !/^[0-9a-f-]{36}$/i.test(String(extras.horarioLinkId)) ||
            !/^HOR-QA-E2E-[0-9a-f-]{36}$/i.test(String(extras.horarioTemporalId)) ||
            extras.horarioTemporalId !== extras.horarioId ||
            !/^[0-9a-f-]{36}$/i.test(String(extras.asistenciaId)))) {
          throw new Error("Los identificadores de asignación temporal no son válidos.");
        }
        if (extras && window.__ERP_QA_NEXT_ASISTENCIA_ID__ === extras.asistenciaId) {
          delete window.__ERP_QA_NEXT_ASISTENCIA_ID__;
        }
        await sv;
        const r = await sb("/rest/v1/personal?dni=eq." + encodeURIComponent(dni) +
          "&select=id,nombres,dni,rol");
        if (!r.ok) throw new Error("No se pudo comprobar la limpieza del personal temporal.");
        const rows = await r.json();
        if (rows.length > 1) throw new Error("Hay más de un registro con el DNI temporal; no se elimina nada.");
        if (rows.length) {
          const p = rows[0];
          if (p.nombres !== "QA Contrato Temporal" || p.dni !== dni ||
              p.rol !== "ENT" || !String(p.id).startsWith("PER-ENT-")) {
            throw new Error("El personal ya no coincide con el registro temporal; se protege el registro.");
          }
          const id = encodeURIComponent(p.id);
          const [sedesResp, horariosResp, asistenciasResp, certificacionesResp] = await Promise.all([
            sb("/rest/v1/personal_sedes?personal_id=eq." + id + "&select=id,sede_id,horario_resumen,horas_semanales"),
            sb("/rest/v1/horario_profesores?personal_id=eq." + id + "&select=id,horario_id"),
            sb("/rest/v1/asistencias?personal_id=eq." + id + "&select=id,fecha,tipo,personal_id,horario_id"),
            sb("/rest/v1/personal_certificaciones?personal_id=eq." + id + "&select=id"),
          ]);
          if (![sedesResp, horariosResp, asistenciasResp, certificacionesResp].every((x) => x.ok)) {
            throw new Error("No se pudieron comprobar las dependencias del personal temporal.");
          }
          const [sedes, horarios, asistencias, certificaciones] = await Promise.all([
            sedesResp.json(), horariosResp.json(), asistenciasResp.json(), certificacionesResp.json(),
          ]);
          if (extras) {
            if (sedes.some((x) => x.id !== extras.sedeLinkId || x.sede_id !== extras.sedeId ||
                !String(x.horario_resumen).startsWith("QA E2E ")) ||
                horarios.some((x) => x.id !== extras.horarioLinkId || x.horario_id !== extras.horarioId) ||
                asistencias.some((x) => x.id !== extras.asistenciaId || x.tipo !== "P" ||
                  x.personal_id !== p.id || x.horario_id !== extras.horarioId || x.fecha !== extras.fecha) ||
                certificaciones.length || sedes.length > 1 || horarios.length > 1 || asistencias.length > 1) {
              throw new Error("Las asignaciones o asistencias ya no coinciden con los artefactos QA; se protegen los registros.");
            }
            if (asistencias.length) {
              const borrado = await sb("/rest/v1/asistencias?id=eq." + encodeURIComponent(extras.asistenciaId), { method: "DELETE" });
              if (!borrado.ok) throw new Error("No se pudo retirar la asistencia temporal: " + await borrado.text());
            }
            if (horarios.length) {
              const borrado = await sb("/rest/v1/horario_profesores?id=eq." + encodeURIComponent(extras.horarioLinkId), { method: "DELETE" });
              if (!borrado.ok) throw new Error("No se pudo retirar el horario temporal: " + await borrado.text());
            }
            if (sedes.length) {
              const borrado = await sb("/rest/v1/personal_sedes?id=eq." + encodeURIComponent(extras.sedeLinkId), { method: "DELETE" });
              if (!borrado.ok) throw new Error("No se pudo retirar el vínculo de sede temporal: " + await borrado.text());
            }
            const horarioQAResp = await sb("/rest/v1/horarios?id=eq." +
              encodeURIComponent(extras.horarioTemporalId) + "&select=id,sede_id,deporte_id,categoria,dia_semana");
            if (!horarioQAResp.ok) throw new Error("No se pudo verificar el horario QA temporal.");
            const horariosQA = await horarioQAResp.json();
            if (horariosQA.length > 1 || (horariosQA.length === 1 &&
                (horariosQA[0].id !== extras.horarioTemporalId ||
                 horariosQA[0].sede_id !== extras.sedeId ||
                 horariosQA[0].deporte_id !== extras.grupo.split("|")[0] ||
                 String(horariosQA[0].categoria) !== extras.grupo.split("|")[1] ||
                 String(horariosQA[0].dia_semana) !== String(extras.diaSemana)))) {
              throw new Error("El horario temporal no coincide con el creado por esta prueba; se protege.");
            }
            if (horariosQA.length) {
              const borrado = await sb("/rest/v1/horarios?id=eq." +
                encodeURIComponent(extras.horarioTemporalId), { method: "DELETE" });
              if (!borrado.ok) throw new Error("No se pudo retirar el horario QA temporal: " + await borrado.text());
            }
          } else if (sedes.length || horarios.length || asistencias.length || certificaciones.length) {
            throw new Error("El personal temporal tiene dependencias no registradas por esta prueba; no se elimina.");
          }
          const borrado = await sb("/rest/v1/personal?id=eq." + id, { method: "DELETE" });
          if (!borrado.ok) throw new Error("No se pudo eliminar el contrato temporal: " + await borrado.text());
        }
        const final = await sb("/rest/v1/personal?dni=eq." + encodeURIComponent(dni) + "&select=id");
        if (!final.ok || (await final.json()).length) throw new Error("El contrato temporal sigue en Supabase.");
        await pull();
        if (S.personal.some((x) => x.dni === dni)) throw new Error("El ERP todavía conserva el personal temporal.");
        return { removed: true };
      },
      async roundTripCuota(id) {
        if (U?.rol !== "ADM") throw new Error("La prueba de persistencia requiere una sesión administradora QA.");
        if (!/^QA-PERSIST-CUOTA-[A-Za-z0-9-]+$/.test(String(id))) throw new Error("Identificador temporal QA inválido.");
        if (S.cuotas.some((x) => x.id === id)) throw new Error("El identificador temporal ya existe.");
        const alumno = S.alu.find((x) => x.id);
        if (!alumno) throw new Error("No hay alumno QA para asociar la cuota temporal.");

        S.cuotas.push({
          id, aid: alumno.id, n: 99, f: "2026-12-31",
          m: 90, a: 50, s: 40, e: "Parcial",
        });
        save();
        await sv;
        if (!SAVE_OK) throw new Error("El guardado real del ERP falló.");

        const ruta = "/rest/v1/cronograma_cuotas?id=eq." + encodeURIComponent(id) +
          "&select=id,alumno_id,numero_cuota,monto,monto_abonado,saldo_pendiente,estado";
        const respuesta = await sb(ruta);
        if (!respuesta.ok) throw new Error("Consulta posterior al guardado falló: " + await respuesta.text());
        const filas = await respuesta.json();
        if (filas.length !== 1) throw new Error("Supabase no devolvió una única cuota temporal.");

        await pull();
        const recuperada = S.cuotas.find((x) => x.id === id);
        if (!recuperada) throw new Error("El ERP no recuperó la cuota desde Supabase.");
        return {
          database: filas[0],
          restored: { id: recuperada.id, m: recuperada.m, a: recuperada.a, s: recuperada.s, e: recuperada.e },
        };
      },
      async forzarGeneracionCarnetQA(dni) {
        if (U?.rol !== "ADM") throw new Error("La prueba de carnet requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal de carnet inválido.");
        const alumno = S.alu.find((x) => x.dni === dni);
        if (!alumno) throw new Error("No se encontró el alumno temporal para generar el carnet.");
        // Simular un registro antiguo sin token para probar la persistencia real.
        alumno.qt = "";
        carnet(alumno.id);
        return { id: alumno.id };
      },
      async consultarTokenCarnetQA(dni) {
        if (U?.rol !== "ADM") throw new Error("La consulta de carnet requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal de carnet inválido.");
        await sv;
        const respuesta = await sb("/rest/v1/alumnos?select=qr_token&dni=eq." + encodeURIComponent(dni));
        if (!respuesta.ok) throw new Error("No se pudo consultar el token QR en Supabase QA.");
        const filas = await respuesta.json();
        return filas[0]?.qr_token ?? null;
      },
      async verificarAusenciaMatriculaQA(dni) {
        if (U?.rol !== "ADM") throw new Error("La verificación de matrícula requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal de matrícula inválido.");
        await sv;
        const respuesta = await sb("/rest/v1/alumnos?select=id&dni=eq." + encodeURIComponent(dni));
        if (!respuesta.ok) throw new Error("No se pudo comprobar la matrícula fallida en Supabase QA.");
        return (await respuesta.json()).length;
      },
      obtenerContextoRpcQA() {
        if (U?.rol !== "ADM" || !TK) {
          throw new Error("La prueba de snapshot requiere una sesión administradora QA activa.");
        }
        // Solo expone el token de sesión del administrador QA al runner E2E;
        // nunca devuelve ni utiliza service_role.
        return { url: SB, apikey: KEY, accessToken: TK };
      },
      async roundTripCaja(id) {
        if (U?.rol !== "ADM") throw new Error("La prueba de Caja requiere una sesión administradora QA.");
        if (!/^QA-PERSIST-CAJA-[A-Za-z0-9-]+$/.test(String(id))) throw new Error("Identificador temporal de Caja inválido.");
        if (S.caja.some((x) => x._id === id)) throw new Error("El identificador temporal de Caja ya existe.");
        const aplicacion = [
          { destino: "Matrícula", cuota: 0, monto: 50 },
          { destino: "Cuota", cuota: 1, monto: 90 },
          { destino: "Cuota", cuota: 2, monto: 90 },
        ];
        const origen = "matricula:QA-ABONO|aplicacion:" + encodeURIComponent(JSON.stringify(aplicacion));
        S.caja.push({
          _id: id, f: today(), sede: S.sedes[0]?.id || "", t: "I",
          c: "Matrícula / mensualidad", d: "QA-ABONO", m: 230, k: origen,
        });
        save();
        await sv;
        if (!SAVE_OK) throw new Error("El guardado real del movimiento de Caja falló.");
        const ruta = "/rest/v1/caja_movimientos?id=eq." + encodeURIComponent(id);
        const respuesta = await sb(ruta + "&select=id,detalle,monto,origen");
        if (!respuesta.ok) throw new Error("La consulta del movimiento en Supabase falló: " + await respuesta.text());
        const filas = await respuesta.json();
        if (filas.length !== 1) throw new Error("Supabase no devolvió un único movimiento temporal.");
        await pull();
        const recuperado = S.caja.find((x) => x._id === id);
        if (!recuperado) throw new Error("El ERP no recuperó el movimiento de Caja desde Supabase.");
        return {
          database: filas[0],
          restored: { id: recuperado._id, d: recuperado.d, m: recuperado.m, k: recuperado.k },
          allocation: aplicacion,
        };
      },
      async cleanupCaja(id) {
        if (U?.rol !== "ADM") throw new Error("La limpieza requiere una sesión administradora QA.");
        if (!/^QA-PERSIST-CAJA-[A-Za-z0-9-]+$/.test(String(id))) throw new Error("La limpieza solo acepta IDs temporales QA.");
        S.caja = S.caja.filter((x) => x._id !== id);
        save();
        await sv;
        if (!SAVE_OK) throw new Error("No se pudo guardar la limpieza del movimiento temporal.");
        const ruta = "/rest/v1/caja_movimientos?id=eq." + encodeURIComponent(id);
        let verificacion = await sb(ruta + "&select=id");
        if (!verificacion.ok) throw new Error("No se pudo verificar la limpieza: " + await verificacion.text());
        let filas = await verificacion.json();
        if (filas.length) {
          const borrado = await sb(ruta, { method: "DELETE" });
          if (!borrado.ok) throw new Error("No se pudo eliminar el movimiento temporal QA: " + await borrado.text());
        }
        verificacion = await sb(ruta + "&select=id");
        if (!verificacion.ok) throw new Error("No se pudo confirmar la limpieza QA.");
        filas = await verificacion.json();
        if (filas.length) throw new Error("El movimiento temporal continúa en Supabase.");
        await pull();
        return { removed: true };
      },
      async verificarEgresoCajaQA(detalle) {
        if (U?.rol !== "ADM") throw new Error("La verificación de Caja requiere una sesión administradora QA.");
        if (!/^QA-DOBLE-CAJA-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(String(detalle))) {
          throw new Error("Marcador de egreso QA inválido.");
        }
        await sv;
        const ruta = "/rest/v1/caja_movimientos?detalle=eq." + encodeURIComponent(detalle);
        const respuesta = await sb(ruta + "&select=id,tipo,concepto,monto");
        if (!respuesta.ok) throw new Error("No se pudo verificar el egreso QA: " + await respuesta.text());
        const filas = await respuesta.json();
        if (filas.some((x) => x.tipo !== "E" || x.concepto !== "Otros" || Number(x.monto) !== 1.23)) {
          throw new Error("El egreso QA no coincide con el marcador y los importes esperados.");
        }
        return filas.length;
      },
      async cleanupEgresoCajaQA(detalle) {
        if (U?.rol !== "ADM") throw new Error("La limpieza de Caja requiere una sesión administradora QA.");
        if (!/^QA-DOBLE-CAJA-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(String(detalle))) {
          throw new Error("Marcador de egreso QA inválido.");
        }
        await sv;
        const ruta = "/rest/v1/caja_movimientos?detalle=eq." + encodeURIComponent(detalle);
        let respuesta = await sb(ruta + "&select=id,tipo,concepto,monto");
        if (!respuesta.ok) throw new Error("No se pudo verificar la limpieza del egreso QA.");
        let filas = await respuesta.json();
        if (filas.some((x) => x.tipo !== "E" || x.concepto !== "Otros" || Number(x.monto) !== 1.23)) {
          throw new Error("El egreso QA no coincide exactamente; no se elimina.");
        }
        for (const fila of filas) {
          const borrado = await sb("/rest/v1/caja_movimientos?id=eq." + encodeURIComponent(fila.id), { method: "DELETE" });
          if (!borrado.ok) throw new Error("No se pudo retirar el egreso temporal QA: " + await borrado.text());
        }
        respuesta = await sb(ruta + "&select=id");
        if (!respuesta.ok || (await respuesta.json()).length) throw new Error("Quedó un egreso temporal QA en Supabase.");
        await pull();
        if (S.caja.some((x) => x.d === detalle)) throw new Error("El ERP aún conserva el egreso temporal QA.");
        return { removed: true, count: filas.length };
      },
      async cleanupCuota(id) {
        if (U?.rol !== "ADM") throw new Error("La limpieza requiere una sesión administradora QA.");
        if (!/^QA-PERSIST-CUOTA-[A-Za-z0-9-]+$/.test(String(id))) throw new Error("La limpieza solo acepta IDs temporales QA.");
        S.cuotas = S.cuotas.filter((x) => x.id !== id);
        save();
        await sv;

        const ruta = "/rest/v1/cronograma_cuotas?id=eq." + encodeURIComponent(id);
        let verificacion = await sb(ruta + "&select=id");
        if (!verificacion.ok) throw new Error("No se pudo verificar la limpieza: " + await verificacion.text());
        let filas = await verificacion.json();
        if (filas.length) {
          const borrado = await sb(ruta, { method: "DELETE" });
          if (!borrado.ok) throw new Error("No se pudo eliminar el ID temporal QA: " + await borrado.text());
        }
        verificacion = await sb(ruta + "&select=id");
        if (!verificacion.ok) throw new Error("No se pudo confirmar la limpieza QA.");
        filas = await verificacion.json();
        if (filas.length) throw new Error("El registro temporal QA continúa en Supabase.");
        await pull();
        return { removed: true };
      },
    }),
  });
}

async function backup() {
  try {
    await pull();

    const o = {
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
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Respaldo descargado");
    return true;
  } catch (e) {
    console.error("Error al generar respaldo:", e);
    toast("No se pudo generar el respaldo. No se descargó ningún archivo.");
    return false;
  }
}

const tok = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => (b % 36).toString(36)).join("");
const base = () => location.href.split("#")[0],
  carnetUrl = (a) => {
    if (!a.qt) {
      a.qt = tok();
      save();
    }
    return base() + "#c=" + a.qt;
  };
const DOC_OK = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
async function subirArch(f, carpeta, tipo) {
  const ext = DOC_OK[f.type];
  if (!ext || f.size > 5e6) throw "archivo";
  const path = `${carpeta}/${tipo}-${Date.now()}.${ext}`,
    r = await sb("/storage/v1/object/documentos/" + path, {
      method: "POST",
      headers: { "Content-Type": f.type },
      timeout: 90000,
      body: f,
    });
  if (!r.ok) throw "subida";
  return path;
}
async function verDoc(path) {
  const w = window.open("", "_blank");
  try {
    const r = await sb("/storage/v1/object/sign/documentos/" + path, {
      method: "POST",
      body: JSON.stringify({ expiresIn: 120 }),
    });
    if (!r.ok) throw 0;
    const j = await r.json(),
      u = SB + "/storage/v1" + j.signedURL;
    if (!w) return toast("Permite las ventanas emergentes para ver el archivo");
    w.opener = null;
    w.location.href = u;
  } catch (e) {
    if (w) w.close();
    toast("No se pudo abrir el documento");
  }
}
