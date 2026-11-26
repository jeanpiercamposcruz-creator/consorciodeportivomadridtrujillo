/* [ERP 16/18] 16-animaciones.js — Animaciones y componentes visuales (sección 17). Código sin cambios respecto a script.js (líneas 3864-4336). */
/* ==================================================================
   17. ANIMACIONES Y COMPONENTES VISUALES (solo apariencia)
   ================================================================== */
let LASTV = null,
  NAVF = false,
  SPY = null,
  SPH = 0,
  PAYB = 0,
  SHIRT_IM = null;

/* ---- 1. Menú lateral: píldora líquida ---- */
function sideInit() {
  const nav = document.querySelector(".side nav");
  if (!nav) return;
  const vis = !!nav.offsetParent;
  if (!vis) SPY = null;
  const pill = nav.querySelector(".side-pill"),
    items = [...nav.querySelectorAll(".si")];
  if (!pill || !items.length) return;
  const act = items.find((i) => i.classList.contains("on")) || items[0];
  let cur = act;
  const put = (el, track) => {
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
  const els = [
    ...document.querySelectorAll(
      "main>h2,main>h3,main>.row,main>.card,main>.grid>*,main>.g2>*,main>#ch>.g2>*,#app>.login>.card",
    ),
  ];
  els.forEach((e, i) => {
    const d = Math.min(i, 16) * 70;
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
  const els = [...document.querySelectorAll("main .stat,main td,main b,main h3")]
    .filter((e) => !e.children.length)
    .slice(0, 120);
  for (const e of els) {
    const t = e.textContent;
    let pre, num;
    if (e.classList.contains("stat")) {
      if (!/^-?\d+$/.test(t)) continue;
      pre = "";
      num = t;
    } else {
      const m = /^(.*?S\/ )(-?\d+\.\d\d)$/.exec(t);
      if (!m) continue;
      pre = m[1];
      num = m[2];
    }
    const to = parseFloat(num),
      dec = num.includes(".") ? 2 : 0,
      t0 = performance.now() + 250;
    e.textContent = pre + (0).toFixed(dec);
    const step = (now) => {
      if (!e.isConnected) return;
      const p = Math.min(1, Math.max(0, (now - t0) / 1000)),
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
  const w = b.offsetWidth,
    h = b.offsetHeight,
    html = b.innerHTML,
    cls = b.className,
    sw = b.style.width,
    sh = b.style.height,
    disabled = b.disabled,
    small = b.classList.contains("s");
  b.style.width = w + "px";
  b.style.height = h + "px";
  void b.offsetWidth;
  b.classList.add("paybtn", "paying");
  b.disabled = true;
  b.innerHTML = "<i class=pf></i><span class=pl>Procesando…</span>";
  b.style.width = Math.max(w, small ? 112 : 196) + "px";
  const t0 = performance.now();
  return {
    finish() {
      const wait = Math.max(0, 950 - (performance.now() - t0));
      return new Promise((res) =>
        setTimeout(() => {
          b.classList.remove("paying");
          b.classList.add("paid");
          b.disabled = disabled;
          b.innerHTML =
            '<svg class=pk viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span class=pl>¡PAGADO!</span>';
          setTimeout(res, 800);
        }, wait),
      );
    },
    cancel() {
      b.className = cls;
      b.disabled = disabled;
      b.style.width = sw;
      b.style.height = sh;
      b.innerHTML = html;
    },
  };
}

/* Ejecuta la acción original (sin cambiarla), retiene el re-dibujado y anima solo si hubo un cobro real */
function payRun(b, fn, metric, tk) {
  if (PAYB) return; // Un segundo cobro durante una operación activa nunca debe ejecutar fn().
  if (!b || !b.isConnected) return fn();
  const m0 = metric(),
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
  const end = () => {
      R = R0;
    },
    ok = () => metric() > m0,
    flush = () => {
      if (pend) R0();
    };
  const done = (ctl) =>
    sv
      .then(() => {
        if (!SAVE_OK) throw new Error("no guardado"); // no hay "¡PAGADO!" ni recibo sin confirmación de la BD
        return ctl.finish();
      })
      .then(() => {
        end();
        flush();
        try {
          recibo(tk());
        } catch (e) {
          console.error(e);
        }
        PAYB = 0;
      })
      .catch(() => {
        ctl.cancel();
        end();
        flush();
        PAYB = 0;
      });
  if (r && typeof r.then === "function") {
    PAYB = 1;
    const ctl = payBtn(b);
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

const kitPay = () => saveKit();
const cajaPay = (s, b) =>
  v("c_t") === "I"
    ? payRun(
        b,
        () => addCaja(s),
        () => S.caja.length,
        () => ({ c: S.caja[S.caja.length - 1] }),
      )
    : addCaja(s);
const campoPay = (r, b) =>
  payRun(
    b,
    () => mkP(r, true),
    () => S.caja.length,
    () => ({ c: S.caja[S.caja.length - 1] }),
  );
function matPay(b) {
  if (PAYB) return;
  const old = ED ? S.alu.find((x) => x.id === ED) : null,
    m = monto(v("m_pag") || 0),
    d = (m || 0) - (old ? old.pag : 0);
  if (d > 0) {
    return payRun(
      b,
      saveAlu,
      () => S.caja.length,
      () => ({ c: S.caja[S.caja.length - 1] }),
    );
  }
  // También serializar ediciones y reversiones: no todas usan la animación de cobro.
  PAYB = 1;
  let resultado;
  try {
    resultado = saveAlu();
  } catch (e) {
    PAYB = 0;
    throw e;
  }
  return Promise.resolve(resultado)
    .then(() => sv)
    .finally(() => {
      PAYB = 0;
    });
}

function barcode(s) {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const r = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    return (h >>> 0) / 4294967296;
  };
  let w = 0,
    o = "";
  while (w < 196) {
    const bw = 1 + Math.floor(r() * 3),
      g = 1 + Math.floor(r() * 2);
    o += `<rect x="${w}" y="0" width="${bw}" height="46"/>`;
    w += bw + g;
  }
  return `<svg class=rc-bar viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden="true">${o}</svg>`;
}

function recibo(t) {
  const d = new Date(),
    f = d.toLocaleDateString("es-PE"),
    h = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
    num = String(Date.now()).slice(-9);
  let tit,
    sede,
    items = [],
    total,
    notas = [];
  if (t.k) {
    const k = t.k,
      a = S.alu.find((x) => x.id === k.aid);
    tit = "Venta de indumentaria";
    sede = sn(k.sede);
    items.push([k.p + " · Talla " + k.t, k.pr]);
    if (k.n || k.u !== "")
      notas.push("Estampado: " + (k.n || "—") + (k.u !== "" ? " N.° " + k.u : ""));
    notas.push("Alumno: " + k.al + (a ? " (" + a.id + ")" : ""));
    total = k.pr;
  } else {
    const c = t.c,
      a = S.alu.find((x) => x.id === c.d);
    tit = c.t === "I" ? "Comprobante de pago" : "Comprobante";
    sede = sn(c.sede);
    items.push([c.c, c.m]);
    if (a) notas.push("Alumno: " + a.nom + " " + a.ape + " (" + a.id + ")");
    else if (c.d) notas.push("Detalle: " + c.d);
    total = c.m;
  }
  let i = 0;
  const L = (x) => `<div class=rl data-dx=${i++}>${x}</div>`;
  const html = `<div class=rcw><div class=rc-slot></div><div class=rc-win><div class=rc id=rc>
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
  const m = DOM.mod;
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
  const im = new Image();
  im.onload = () => {
    SHIRT_IM = im;
    shirtDraw();
  };
  im.src = SHIRT_SRC;
}
function shirtDraw() {
  const c = document.getElementById("shirt");
  if (!c || !SHIRT_IM) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1),
    cw = c.clientWidth || 340,
    iw = SHIRT_IM.width,
    ih = SHIRT_IM.height,
    pad = 0.05;
  const W = Math.round(cw * dpr),
    sw = W * (1 - 2 * pad),
    sc = sw / iw,
    sh = ih * sc,
    H = Math.round(sh + W * pad * 2.2);
  if (c.width !== W || c.height !== H) {
    c.width = W;
    c.height = H;
  }
  const x = c.getContext("2d");
  x.clearRect(0, 0, W, H);
  const ox = W * pad,
    oy = W * pad * 0.9;
  x.save();
  x.shadowColor = "rgba(0,0,0,.45)";
  x.shadowBlur = 22 * dpr;
  x.shadowOffsetY = 12 * dpr;
  x.drawImage(SHIRT_IM, ox, oy, sw, sh);
  x.restore();
  const name = (document.getElementById("k_n") || { value: "" }).value
      .trim()
      .toUpperCase()
      .slice(0, 30),
    num = (document.getElementById("k_u") || { value: "" }).value.trim();
  if (!name && !num) return;
  const o = document.createElement("canvas");
  o.width = W;
  o.height = H;
  const q = o.getContext("2d");
  const FF = 'Anton,Impact,"Arial Narrow",sans-serif',
    BLUE = "#1f4fae";
  const fit = (txt, capH, maxW) => {
    q.font = "100px " + FF;
    const m = q.measureText(txt),
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
  const cx = ox + sc * 226;
  const ANT = !document.fonts || document.fonts.check("100px Anton");
  q.lineJoin = "round";
  q.strokeStyle = BLUE;
  const put = (t, g, y) => {
    q.font = g.fs + "px " + FF;
    q.fillText(t, cx, y);
    if (!ANT) {
      q.lineWidth = g.fs * 0.07;
      q.strokeText(t, cx, y);
    }
  };
  if (name) {
    const g = fit(name, sc * 27, sc * 178);
    put(name, g, oy + sc * 72 + g.asc / 2);
  }
  if (num) {
    const g = fit(num, sc * 172, sc * 190);
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
  const gr = q.createLinearGradient(0, oy, 0, oy + sh);
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
  const b = KNUM ? document.querySelector('.n[data-i="' + KNUM + '"]') : null;
  if (b) b.classList.add("sel");
  const a = S.alu.find((x) => x.id === KSEL);
  e.classList.toggle("bad", !!(KNUM && a && a.mod === "Competitivo" && ocup(a).has(KNUM)));
  shirtDraw();
}

