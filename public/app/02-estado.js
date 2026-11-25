/* [ERP 02/18] 02-estado.js — Estado de la aplicación y datos semilla (sección 3). Código sin cambios respecto a script.js (líneas 111-300). */
/* ==================================================================
   3. ESTADO DE LA APLICACIÓN Y DATOS SEMILLA
   ================================================================== */
let S,
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
  AS = {},
  GM = today().slice(0, 7),
  EC = null,
  EK = null,
  SEDT = "s",
  PERT = "d",
  SQ = "",
  PQ = "",
  PFOTO = "",
  HFS = "",
  KE = null;
function seed() {
  const s = {
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
    cuotas: [],
  };
  const mk = (n, a, ap, dni, nac, h, seg, an, ac, pag) => ({
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
const nid = () => {
  const qaId = window.__ERP_QA_NEXT_ALUMNO_ID__;
  if (
    window.__ERP_CONFIG__?.supabaseUrl?.replace(/\\/+$/, "") === "https://yiredilknlwbzwvwlqyx.supabase.co" &&
    U?.rol === "ADM" &&
    /^QA-MAT-\\d{8}$/.test(String(qaId || "")) &&
    !S.alu.some((a) => a.id === qaId)
  ) {
    delete window.__ERP_QA_NEXT_ALUMNO_ID__;
    return qaId;
  }
  const p = String(Y).slice(2);
  return (
    p +
    String(
      Math.max(0, ...S.alu.filter((a) => a.id.startsWith(p)).map((a) => +a.id.slice(2))) + 1,
    ).padStart(4, "0")
  );
};
const age = (d) => {
  if (!RX.fecha.test(String(d || ""))) return "—"; // antes age("") devolvía 2026
  const [y, m, x] = d.split("-").map(Number),
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
