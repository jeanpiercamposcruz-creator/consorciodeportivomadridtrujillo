/* [ERP 06/18] 06-camara-qr.js — Cámara y lectura de códigos QR (sección 8). Código sin cambios respecto a script.js (líneas 1217-1537). */
/* ==================================================================
   8. CÁMARA Y LECTURA DE CÓDIGOS QR
   ================================================================== */
let CAMID = 0,
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
  const id = CAMID;
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
    const tr = st.getVideoTracks()[0];
    try {
      const cp = tr.getCapabilities ? tr.getCapabilities() : {},
        adv = {};
      if (cp.focusMode && cp.focusMode.includes("continuous")) adv.focusMode = "continuous";
      if (cp.exposureMode && cp.exposureMode.includes("continuous"))
        adv.exposureMode = "continuous";
      if (cp.whiteBalanceMode && cp.whiteBalanceMode.includes("continuous"))
        adv.whiteBalanceMode = "continuous";
      if (Object.keys(adv).length) await tr.applyConstraints({ advanced: [adv] });
    } catch (_) {}
    const v = $("#cv");
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
    const m = $("#cs");
    if (m)
      m.textContent =
        "No se pudo abrir la cámara. Permite el acceso en el navegador (requiere HTTPS).";
  }
}
function camGrab(v, sx, sy, sw, sh, maxW) {
  const k = Math.min(1, maxW / sw),
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
  const d = im.data,
    n = d.length >> 2,
    h = new Uint32Array(256),
    g = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const y = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    g[i] = y;
    h[y]++;
  }
  let a = 0,
    lo = 0,
    hi = 255;
  const c = n * 0.02;
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
  const f = 255 / (hi - lo);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let y = (g[i] - lo) * f;
    y = y < 0 ? 0 : y > 255 ? 255 : y;
    d[j] = d[j + 1] = d[j + 2] = y;
  }
  return im;
}
function loopCam(id) {
  if (id !== CAMID || !CAM) return;
  const v = $("#cv");
  if (!v) return;
  const again = () => {
    if (id !== CAMID || !CAM) return;
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => loopCam(id));
    else setTimeout(() => loopCam(id), 100);
  };
  const now = performance.now();
  if (!window.jsQR) {
    const z = $("#cs");
    if (z) z.textContent = "Lector QR no disponible: recarga la página o revisa tu conexión";
  }
  if (now - CAMLAST < 110 || v.readyState < 2 || !v.videoWidth || !window.jsQR || v.paused) {
    if (v.paused) v.play().catch(() => {});
    return again();
  }
  CAMLAST = now;
  try {
    const W = v.videoWidth,
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
      const s = Math.round(Math.min(W, H) * 0.8),
        sx = (W - s) >> 1,
        sy = (H - s) >> 1;
      im = camStretch(camGrab(v, sx, sy, s, s, 720));
      q = jsQR(im.data, im.width, im.height, { inversionAttempts: "attemptBoth" });
    }
    if (q && q.data) {
      CAMHIT = true;
      qrLeido(q.data);
    } else if (!CAMHIT && Date.now() - CAMT0 > 8000) {
      const m = $("#cs");
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
  const m = /#c=([a-z0-9]{16})/.exec(String(t));
  if (!m) {
    const z = $("#cs");
    if (z) z.textContent = "QR leído, pero no es un carnet de la academia";
    return;
  }
  const n = Date.now();
  if (m[1] === LASTQ && n - LASTT < 4000) return;
  LASTQ = m[1];
  LASTT = n;
  const e = $("#cs") || { textContent: "", classList: { add() {} } }, // el modal pudo cerrarse
    a = S.alu.find((x) => x.qt === m[1]);
  if (!a) {
    e.textContent = "QR no reconocido";
    return;
  }
  if (a.est !== "Activo" || !a.hor) {
    e.textContent = a.nom + " " + a.ape + ": inactivo o sin horario asignado";
    return;
  }
  const x = S.asis.find((x) => x.f === today() && x.t === "A" && x.ref === a.id && x.h === a.hor);
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
let QFIN = null;
function qrFotoAbrir() {
  if (!QFIN) {
    QFIN = document.createElement("input");
    QFIN.type = "file";
    QFIN.accept = "image/*";
    QFIN.setAttribute("capture", "environment");
    QFIN.className = "offscreen-file-input";
    QFIN.addEventListener("change", () => {
      const f = QFIN.files && QFIN.files[0];
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
      const u = URL.createObjectURL(f),
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
    const W = bmp.naturalWidth || bmp.width,
      H = bmp.naturalHeight || bmp.height;
    if ("BarcodeDetector" in window) {
      try {
        const d = new BarcodeDetector({ formats: ["qr_code"] }),
          r = await d.detect(bmp);
        if (r.length && r[0].rawValue) return r[0].rawValue;
      } catch (_) {}
    }
    if (!window.jsQR) return null;
    const c = document.createElement("canvas"),
      x = c.getContext("2d", { willReadFrequently: true });
    for (const [mw, st] of [
      [1600, 0],
      [900, 0],
      [500, 0],
      [1200, 1],
      [700, 1],
    ]) {
      const k = Math.min(1, mw / Math.max(W, H)),
        tw = Math.max(1, Math.round(W * k)),
        th = Math.max(1, Math.round(H * k));
      c.width = tw;
      c.height = th;
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = "high";
      x.drawImage(bmp, 0, 0, tw, th);
      let im = x.getImageData(0, 0, tw, th);
      if (st) im = camStretch(im);
      const q = jsQR(im.data, tw, th, { inversionAttempts: st ? "attemptBoth" : "dontInvert" });
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
  const cs = $("#cs");
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
