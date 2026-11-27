/* [ERP 10/18] 10-login-dashboard.js — Login, render principal, dashboard y gráficos (secciones 13-14). Código sin cambios respecto a script.js (líneas 2053-2271). */
/* ==================================================================
   13. LOGIN Y RENDER PRINCIPAL
   ================================================================== */
function login() {
  return `<main class=login><section class=card><img src="${LOGO}" alt="Consorcio Deportivo Madrid Trujillo" class=lg><div class="fg fg--single">${fl("Usuario", "<input id=lu autocomplete=username autofocus>")}${fl("Contraseña", '<div class=pw><input id=lp type=password autocomplete=current-password data-kd=enterLogin><button type=button class=eye aria-label="Mostrar u ocultar contraseña" data-f=eye><svg width=22 height=22 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2 stroke-linecap=round><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx=12 cy=12 r=3 /><path id=sl d="M3 3l18 18"/></svg></button></div>')}</div><div class=row><button id=lb data-f=doLogin>Iniciar sesión</button></div></section><div id=ball class=ball><svg viewBox="0 0 100 100" aria-label="Cargando"><defs><radialGradient id="bgr" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e3e7ea"/><stop offset="1" stop-color="#aab2b9"/></radialGradient><clipPath id="bcl"><circle cx="50" cy="50" r="46"/></clipPath></defs><circle cx="50" cy="50" r="46" fill="url(#bgr)"/><g clip-path="url(#bcl)" fill="#1f252b" stroke="#1f252b" stroke-width="1.4" stroke-linejoin="round"><polygon points="50.0,37.0 62.4,46.0 57.6,60.5 42.4,60.5 37.6,46.0"/><polygon points="50.0,18.0 37.6,9.0 42.4,-5.5 57.6,-5.5 62.4,9.0"/><polygon points="80.4,40.1 85.2,25.6 100.4,25.6 105.2,40.1 92.8,49.1"/><polygon points="68.8,75.9 84.1,75.9 88.8,90.4 76.5,99.4 64.1,90.4"/><polygon points="31.2,75.9 35.9,90.4 23.5,99.4 11.2,90.4 15.9,75.9"/><polygon points="19.6,40.1 7.2,49.1 -5.2,40.1 -0.4,25.6 14.8,25.6"/><path fill="none" d="M50.0 37.0L50.0 18.0M62.4 46.0L80.4 40.1M57.6 60.5L68.8 75.9M42.4 60.5L31.2 75.9M37.6 46.0L19.6 40.1M37.6 9.0L92.8 49.1M85.2 25.6L64.1 90.4M84.1 75.9L15.9 75.9M35.9 90.4L14.8 25.6M7.2 49.1L62.4 9.0"/></g><ellipse cx="36" cy="30" rx="16" ry="9" fill="#fff" opacity=".35" transform="rotate(-30 36 30)"/><circle cx="50" cy="50" r="46" fill="none" stroke="#8d969e" stroke-width="1.5"/></svg><span>Autenticando...</span></div></main>`;
}
function eye() {
  const p = $("#lp"),
    h = p.type === "password";
  p.type = h ? "text" : "password";
  $("#sl").classList.toggle("u-hidden", h);
}
async function doLogin() {
  const b = $("#lb"),
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
    console.error(e);
    if (e?.status >= 500 || /Failed to fetch|network|timed out|No se pudo validar el perfil/i.test(e?.message || "")) {
      return toast("No se pudo validar el perfil por un problema temporal de conexión con la base de datos. Intenta de nuevo.");
    }
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
const out = () => {
  if (TK) sb("/auth/v1/logout?scope=local", { method: "POST" }).catch(() => {}); // revoca la sesión en el servidor
  if (typeof R_REAL === "function") R = R_REAL; // payRun() pudo dejar R() anulada
  PAYB = 0;
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
  const a = DOM.app;
  if (!U) {
    NAVF = true;
    a.innerHTML = login();
    postR();
    return;
  }
  if (V === "mat" && ED && !S.alu.some((x) => x.id === ED)) {
    ED = null; // el alumno ya no existe (otro admin lo borró o un pull lo reemplazó)
    FRESH = null;
  }
  const m = M.find((x) => x[0] === V);
  if (m && !m[3].includes(U.rol)) V = "home";
  NAVF = V !== LASTV;
  a.innerHTML = `<header>${V !== "home" ? '<button class="g ib" data-f=tgSide aria-label="Mostrar u ocultar el menú lateral"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>' : ""}<img src="${LOGO}" alt="Consorcio Deportivo Madrid Trujillo" class=hl data-f=go data-i=home><span class=sp></span><span class=mu>${esc(U.nom)}</span>${V !== "home" ? "<button class=g data-f=go data-i=home>← Menú</button>" : ""}<button class=g data-f=out>Salir</button></header><div class=shell>${V === "home" ? "" : sideHtml()}<main class="${V === "home" ? "hm" : ""}">${V === "home" ? home() : `<h2 class=h2><span class=hi>${ico(m[4], 28)}</span> ${m[1]}</h2>` + VW[V]()}</main></div>${U ? "<button class=fab data-f=go data-i=pre>PRE-REGISTRO<span id=pb>" + (PRN ? " (" + PRN + ")" : "") + "</span></button>" : ""}`;
  if (PRN === null) {
    PRN = 0;
    contarPre();
  }
  if (V === "mat") {
    FOTO = ED ? (S.alu.find((x) => x.id === ED) || {}).foto || "" : "";
    upHor();
    cronRender();
  }
  postR();
}
/* ==================================================================
   14. DASHBOARD Y GRÁFICOS
   ================================================================== */
const MS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
let CS = { u: null, m: null, r: 6, v: "d", mo: today().slice(0, 7) };
const uMes = (m) => {
  const c = S.caja.filter((x) => x.f.startsWith(m)),
    ing = c.filter((x) => x.t === "I").reduce((t, x) => t + x.m, 0),
    // Alquiler y planilla se descuentan por separado abajo; excluirlos evita duplicar egresos.
    eg = c
      .filter((x) => x.t === "E" && !["Pago de alquiler", "Planilla de entrenadores"].includes(x.c))
      .reduce((t, x) => t + x.m, 0),
    // Una venta anulada no debe seguir restando su costo de confección a la utilidad.
    kc = S.kits.filter((k) => k.est !== "Anulada" && k.f.startsWith(m)).reduce((t, k) => t + k.c, 0),
    pl = S.asis
      // Una asistencia futura no es un servicio realizado ni un gasto devengado.
      .filter((x) => x.t === "P" && x.ok && x.f.startsWith(m) && x.f <= today())
      .reduce((t, x) => {
        const h = S.hor.find((h) => h.id === x.h),
          p = S.personal.find((p) => p.id === x.ref);
        return h && p ? t + hrs(h) * p.precio : t;
      }, 0),
    al = S.sedes.reduce((t, s) => t + +s.costo, 0);
  return { ing, u: ing - eg - kc - pl - al };
};
const bars = (d, k) => {
  const W = 600,
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
        const h = (Math.abs(x.v) / rg) * (H - 30),
          y = x.v >= 0 ? z - h : z;
        return `<g data-f=chSel data-i=${k} data-j=${i} class="u-pointer"><rect x="${i * w + w * 0.14}" y="${y}" width="${w * 0.72}" height="${Math.max(h, 2)}" rx="3" fill="${x.v < 0 ? "var(--rd)" : "var(--ac)"}" opacity="${CS[k] === i ? 1 : 0.72}" class="${NAVF ? "gb" + (x.v < 0 ? " neg" : "") : ""}" data-dx=${i}><title>${esc(x.n)}: ${esc(x.t)}</title></rect><text x="${i * w + w / 2}" y="${H + 15}" text-anchor="middle" font-size="11" fill="var(--mu)">${esc(x.l)}</text></g>`;
      })
      .join("") +
    "</svg>"
  );
};
const chSel = (k, i) => {
    CS[k] = CS[k] === i ? null : i;
    rc();
  },
  rc = (a) => {
    NAVF = !!a;
    $("#ch").innerHTML = charts();
    applyDynamicStyles($("#ch"));
  };
function charts() {
  const n = new Date(),
    ud = [...Array(CS.r)].map((_, j) => {
      const d = new Date(n.getFullYear(), n.getMonth() - (CS.r - 1 - j), 1),
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
    const [y, m] = CS.mo.split("-").map(Number),
      nd = new Date(y, m, 0).getDate();
    md = [...Array(nd)].map((_, i) => {
      const c = S.alu.filter(
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
      const c = S.alu.filter((a) =>
        a.fecha.startsWith(`${Y}-${String(i + 1).padStart(2, "0")}`),
      ).length;
      return { l: x, v: c, t: c + " matrículas", n: x + " " + Y };
    });
  const mx = md.reduce((a, b) => (b.v > a.v ? b : a), md[0]),
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
  const adm = U.rol === "ADM",
    act = S.alu.filter((a) => a.est === "Activo"),
    K3 = [
      ["Alumnos activos", act.length, { e: "Activo" }],
      ["Con datos pendientes", S.alu.filter((a) => falta(a).length).length, { e: "Incompleto" }],
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
    )}</div>`;
}

// Diagnóstico de regresión: solo se publica en el proyecto QA y no persiste cambios.
if (window.__ERP_CONFIG__?.supabaseUrl === "https://yiredilknlwbzwvwlqyx.supabase.co") {
  Object.defineProperty(window, "__ERP_QA_DASHBOARD__", {
    configurable: true,
    value: Object.freeze({
      probarAsistenciaFuturaQA() {
        if (typeof U === "undefined" || U?.rol !== "ADM") {
          throw new Error("La prueba del dashboard requiere una sesión administradora QA.");
        }
        const p = S.personal.find((x) => Number(x.activo) === 1 && Number(x.precio) > 0);
        const h = S.hor.find((x) => x.est !== "Inactivo" && hrs(x) > 0);
        if (!p || !h) throw new Error("No hay personal con tarifa y horario válido para la prueba QA.");
        const hoy = today();
        const [y, m, d] = hoy.split("-").map(Number);
        const fecha = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
        const mes = fecha.slice(0, 7);
        const original = S.asis;
        const antes = uMes(mes).u;
        try {
          S.asis = [...original, { t: "P", ref: p.id, ok: true, f: fecha, h: h.id }];
          const despues = uMes(mes).u;
          return { hoy, fecha, antes, despues, diferencia: despues - antes };
        } finally {
          S.asis = original;
        }
      },
    }),
  });
}
