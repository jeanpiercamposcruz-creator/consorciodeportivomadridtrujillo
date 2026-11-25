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
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const G = (n, a, c) => ({
  n,
  rows: () =>
    S[a].map((x) => {
      if ("_id" in c && !x._id) x._id = uid();
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
  G("personal", "personal", {
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
    VER = (await (await sb("/rest/v1/erp_meta?id=eq.1&select=ver")).json())[0].ver;
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
  // 1) descargar TODO primero (si algo falla aquí, S y SN siguen intactos)
  const raw = {};
  for (const t of TB)
    raw[t.n] = t.n === "ajustes" ? aj : t.opt ? await all(t.n).catch(() => []) : await all(t.n);
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
    update: upd,
    delete: delByTable.get(t.n) || [],
  }));
  const changed = payload.some((x) => x.insert.length || x.update.length || x.delete.length);
  if (!changed) return;

  const r = await sb("/rest/v1/rpc/erp_persistir_lote", {
    method: "POST",
    body: JSON.stringify({ p_payload: payload }),
  });
  if (r.status === 409) throw "dup";
  if (!r.ok) {
    const detalle = await r.text();
    if (/23505|duplicate key/i.test(detalle)) throw "dup";
    throw detalle;
  }

  // Solo se actualiza el snapshot local después de confirmar el lote completo.
  for (const [t, ins, upd, m] of W) SN[t.n] = m;
}
let SAVE_OK = true; // resultado del último guardado (lo consultan recibos y borrado de pre-registros)
function save() {
  busy++;
  sv = sv
    .then(async () => {
      try {
        await flush();
        SAVE_OK = true;
        await ver();
      } catch (e) {
        SAVE_OK = false;
        console.error(e);
        if (e === "dup") {
          toast(
            "Otro equipo creó el mismo código a la vez. Se recargaron los datos: repite tu registro.",
          );
          try {
            await pull();
          } catch (_) {}
          try {
            R();
          } catch (x) {
            console.error(x);
          }
        } else toast("No se pudo guardar: revisa la conexión o tus permisos");
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
      build: "qa-dashboard-expenses-v2-v1-20261125",
      async prepararIdMatricula(dni) {
        if (U?.rol !== "ADM") throw new Error("La preparación requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal QA inválido.");
        const id = "QA-MAT-" + dni;
        if (S.alu.some((x) => x.id === id || x.dni === dni)) throw new Error("El identificador o DNI temporal ya existe en el ERP.");
        const r = await sb("/rest/v1/alumnos?dni=eq." + encodeURIComponent(dni) + "&select=id");
        if (!r.ok) throw new Error("No se pudo comprobar la unicidad del DNI QA.");
        if ((await r.json()).length) throw new Error("El DNI temporal ya existe en Supabase QA.");
        window.__ERP_QA_NEXT_ALUMNO_ID__ = id;
        return id;
      },
      async verificarMatriculaCompleta(dni) {
        if (U?.rol !== "ADM") throw new Error("La verificación requiere una sesión administradora QA.");
        if (!/^\d{8}$/.test(String(dni))) throw new Error("DNI temporal QA inválido.");
        await sv;
        if (!SAVE_OK) throw new Error("El guardado de matrícula no terminó correctamente.");
        const alumno = S.alu.find((x) => x.dni === dni && x.nom === "QA" && x.ape === "Persistencia");
        if (!alumno || !/^QA-MAT-\d{8}$/.test(String(alumno.id))) throw new Error("No se encontró la matrícula temporal identificada.");
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
        if (alumno.nom !== "QA" || alumno.ape !== "Persistencia" || !/^QA-MAT-\d{8}$/.test(String(alumno.id))) {
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
            insert: [{ id: personalId, nombres: "QA Atomicidad", rol: "ENT", activo: 1, permite_varias_sedes: false }],
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
        if (!SAVE_OK) throw new Error("El guardado de la venta QA no terminó correctamente.");
        const kitRuta = "/rest/v1/kits_ventas?id=eq." + encodeURIComponent(id) +
          "&select=id,codigo,precio_publico,alumno_id";
        const cajaRuta = "/rest/v1/caja_movimientos?origen=eq." + encodeURIComponent("kit|" + id) +
          "&select=id,origen,monto,detalle";
        const kitResp = await sb(kitRuta);
        const cajaResp = await sb(cajaRuta);
        if (!kitResp.ok || !cajaResp.ok) throw new Error("No se pudo consultar la relación venta-Caja en Supabase.");
        const kitsDb = await kitResp.json();
        const cajaDb = await cajaResp.json();
        await pull();
        const kitRestaurado = S.kits.find((x) => x._id === id);
        const cajaRestaurada = S.caja.filter((x) => x.k === "kit|" + id);
        return {
          database: { kits: kitsDb, caja: cajaDb },
          restored: {
            kit: kitRestaurado ? { id: kitRestaurado._id, pr: kitRestaurado.pr, aid: kitRestaurado.aid } : null,
            caja: cajaRestaurada.map((x) => ({ id: x._id, m: x.m, d: x.d, k: x.k })),
          },
        };
      },
      async cleanupKit(id) {
        if (U?.rol !== "ADM") throw new Error("La limpieza de venta QA requiere una sesión administradora.");
        if (!/^QA-KIT-\d{13}$/.test(String(id))) throw new Error("La limpieza solo acepta IDs temporales QA.");
        if (window.__ERP_QA_NEXT_KIT_ID__ === id) delete window.__ERP_QA_NEXT_KIT_ID__;
        await sv;
        await pull();
        S.kits = S.kits.filter((x) => x._id !== id);
        S.caja = S.caja.filter((x) => x.k !== "kit|" + id);
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
        await borrar("kits_ventas", "id=eq." + encodeURIComponent(id));
        await pull();
        if (S.kits.some((x) => x._id === id) || S.caja.some((x) => x.k === "kit|" + id)) {
          throw new Error("El ERP aún conserva datos de la venta temporal QA.");
        }
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
