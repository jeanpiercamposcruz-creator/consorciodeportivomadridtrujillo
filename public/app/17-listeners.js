/* [ERP 17/18] 17-listeners.js — Event listeners (sección 18). Código sin cambios respecto a script.js (líneas 4337-4383). */
/* ==================================================================
   18. EVENT LISTENERS (todos los eventos se registran aquí, ninguno en el HTML)
   ================================================================== */

/* Delegación: un único listener por tipo de evento resuelve el [data-*] más cercano */
function delegate(type, attr, registry) {
  document.addEventListener(type, (e) => {
    const el = e.target.closest("[" + attr + "]");
    const k = el && el.getAttribute(attr),
      fn = el && Object.hasOwn(registry, k) ? registry[k] : null;
    if (fn) fn(el, el.dataset.i, e);
  });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (b && Object.hasOwn(FN, b.dataset.f)) FN[b.dataset.f](b.dataset.i, b.dataset.j, b.dataset.k, b);
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
  const vid = DOM.video;
  if (!vid) return;
  vid.muted = true;
  vid.defaultMuted = true;
  vid.play().catch(() => {});
  const resume = () => {
    if (vid.paused) vid.play().catch(() => {});
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resume();
  });
  ["click", "touchstart", "keydown"].forEach((ev) =>
    addEventListener(ev, resume, { passive: true }),
  );
}

