/* [ERP 15/18] 15-acciones.js — Acciones delegadas data-f y registros de eventos (sección 16). Código sin cambios respecto a script.js (líneas 3633-3863). */
/* ==================================================================
   16. ACCIONES DELEGADAS (data-f) Y REGISTROS DE EVENTOS
   ================================================================== */
const FN = {
  ...NEW_FN,
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
    const p = (PR || []).find((x) => x.id === i);
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
  kitEd: (i) => {
    const target = String(i ?? "").trim();
    if (!target) return;
    const k = S.kits.find(
      (x) =>
        String(x._id ?? "").trim() === target ||
        String(x.id ?? "").trim() === target ||
        String(x.code ?? "").trim() === target ||
        String(x.codigo ?? "").trim() === target
    );
    if (!k) return;
    KE = String(k._id ?? k.id ?? k.code ?? k.codigo ?? target).trim();
    KSEL = k.aid;
    KNUM = k.u ? +k.u : "";
    R();
  },
  delKit: (i) => delKit(i),
  cancelKit: () => {
    KE = null;
    KNUM = "";
    R();
  },
  verDoc: (i) => verDoc(i),
  cpUrl: () =>
    navigator.clipboard.writeText(base() + "#prereg").then(() => toast("Enlace copiado")),
  sedEd: (i) => {
    ES = i;
    R();
  },
  perEd: (i) => {
    EP = i;
    PERT = "d";
    PFOTO = (S.personal.find((p) => p.id === i) || {}).foto || "";
    R();
  },
  delSede: (i) => delSede(i),
  togP: (i) => togP(i),
  delHor: (i) => delHor(i),
  ed: (i) => ed(i),
  carnet: (i) => carnet(i),
  mkA: (t, r, k) => mkA(t, r, k === "1"),
  mkP: (r, k, z, b) => (k === "1" ? campoPay(r, b) : campoDebe(r, b)),
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
  kitPay: () => kitPay(),
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
const ON_INPUT = {
  ...NEW_IN,
  digits: (el) => {
    el.value = el.value.replace(/\D/g, "");
  },
  shirtDraw: () => shirtDraw(),
  kNumTyped: (el) => kNumTyped(el),
  ck: (el) => ck(el),
  cron: (el) => cronSync(el),
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
const ON_CHANGE = {
  ...NEW_CH,
  upHor: () => upHor(),
  restaurar: (el) => restaurar(el),
  setFee: (el) => {
    const fee = monto(el.value);
    if (fee === null) {
      toast("El pago de campo debe ser un importe válido no negativo, con máximo dos decimales.");
      el.value = String(S.fee ?? 5);
      return;
    }
    S.fee = fee;
    save();
    R(); // Refleja inmediatamente el nuevo estado de "Pagó" / "Sin costo".
  },
  preM: (el) => {
    PF.m = el.value;
    preF();
  },
  setGM: (el) => {
    GM = el.value;
    R();
  },
  setGMm: (el) => {
    GM = GM.slice(0, 5) + el.value;
    R();
  },
  setGMy: (el) => {
    GM = el.value + GM.slice(4);
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
const ON_KEYDOWN = {
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
  adjFoto: () => adjCamb("foto"),
  limpiarMat: () => go("mat"),
  carnetMat: () => (ED ? carnet(ED) : toast("Guarda la matrícula primero para generar el carnet")),
  gerMes: (i) => {
    GM = i;
    R();
  },
  gerRango: () => {
    GR = GR === "anio" ? "12m" : "anio";
    R();
  },
  adjVer: (k) => adjVer(k),
  adjCamb: (k) => adjCamb(k),
  adjDel: (k) => adjDel(k),
});

