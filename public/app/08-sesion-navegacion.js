/* [ERP 08/18] 08-sesion-navegacion.js — Navegación lateral, restauración, sesión y arranque de sesión (sección 10). Código sin cambios respecto a script.js (líneas 1676-1794). */
/* ==================================================================
   10. NAVEGACIÓN LATERAL, RESTAURACIÓN, SESIÓN Y ARRANQUE
   ================================================================== */
let SIDE =
  innerWidth > 900 &&
  (() => {
    try {
      return localStorage.getItem("cdmt_side") !== "0";
    } catch (e) {
      return true;
    }
  })();
const sideHtml = () =>
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
  const a = $(".side");
  if (a) a.classList.toggle("off", !SIDE);
  const nv = $(".side nav");
  if (nv && nv._pl) requestAnimationFrame(nv._pl);
}
async function restaurar(inp) {
  const f = inp.files[0];
  inp.value = "";
  if (!f) return;
  if (f.size > 20e6) return toast("El archivo es demasiado grande");
  let o;
  try {
    o = JSON.parse(await f.text());
  } catch (e) {
    return toast("El archivo no es un JSON válido");
  }
  const T = o && o.tablas;
  if (
    !T ||
    typeof T !== "object" ||
    TB.some(
      (t) =>
        !(t.opt && T[t.n] === undefined) &&
        (!Array.isArray(T[t.n]) || T[t.n].some((r) => !r || typeof r.id !== "string")),
    )
  )
    return toast("El archivo no parece un respaldo de este sistema");
  if (
    !confirm(
      `Se reemplazarán TODOS los datos actuales por los del respaldo (${T.alumnos.length} alumnos, generado el ${esc(String(o.generado || "").slice(0, 10))}). Antes se descargará una copia de lo actual. ¿Continuar?`,
    )
  )
    return;
    busy++;
  try {
    if (!(await backup())) {
      busy--;
      R();
      return;
    }
    T.alumnos.forEach((r) => {
      if (r.foto && !IMG_OK.test(r.foto)) r.foto = null;
    });
    (T.personal || []).forEach((r) => {
      if (r.foto && !IMG_OK.test(r.foto)) r.foto = null;
    });
    for (const t of TB) t.load(T[t.n] || []);
    await flush();
    await ver();
    toast("Respaldo restaurado correctamente");
  } catch (e) {
    console.error(e);
    toast("No se pudo restaurar el respaldo. Se recargó el estado actual.");
    try {
      await pull();
    } catch (_) {}
  }
  busy--;
  R();
}
let idle, BOOTING = false;
const rIdle = () => {
  clearTimeout(idle);
  if (U) idle = setTimeout(out, 30 * 60 * 1000);
};
async function boot() {
  const h = location.hash;
  if (/^#c=[a-z0-9]{16}$/.test(h)) return pubCarnet(h.slice(3));
  if (h === "#prereg") return pubPre();
  if (BOOTING) return;
  BOOTING = true;
  try {
    RT = sessionStorage.getItem("cdmt_rt");
    if (RT && !KEY.startsWith("PEGA")) {
      await auth({ refresh_token: RT }, "refresh_token");
      await sess();
      await pull();
    }
  } catch (e) {
    U = null;
  } finally {
    BOOTING = false;
    R();
  }
}
setInterval(async () => {
  if (!U || document.hidden || V === "mat" || busy) return;
  const a = document.activeElement;
  if (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  try {
    const j = await (await sb("/rest/v1/erp_meta?id=eq.1&select=ver")).json();
    if (j[0] && j[0].ver > VER) {
      await pull();
      R();
    }
  } catch (e) {}
}, 30000 + Math.floor(Math.random() * 10000));
