#!/usr/bin/env node
/**
 * Verifica la estructura modular de la aplicación (public/app/*.js).
 *
 *   node scripts/verificar-modulos.mjs                    # chequeos permanentes (úsalo antes de cada deploy)
 *   node scripts/verificar-modulos.mjs --contra-monolito  # además prueba que la unión de los módulos
 *                                                         # es idéntica a qa/originales/script.monolito.js
 *                                                         # (solo tiene sentido ANTES de editar los módulos)
 *
 * Chequeos permanentes:
 *   1. Numeración consecutiva NN-nombre.js (01, 02, 03...) sin huecos ni duplicados.
 *   2. Cada módulo tiene sintaxis válida por sí solo.
 *   3. La lista APP de app/components/ErpLoader.tsx coincide EXACTAMENTE (y en orden) con la carpeta.
 *   4. Solo el ÚLTIMO módulo llama a boot() (si no, la app arrancaría antes de cargar todo).
 *   5. No quedó un public/script.js suelto que el cargador ya no usa.
 * Código de salida: 0 = todo correcto, 1 = hay problemas.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "public/app");
const problemas = [];
const ok = (m) => console.log("✔ " + m);
const mal = (m) => { problemas.push(m); console.log("✖ " + m); };

if (!fs.existsSync(DIR)) { console.error("✖ No existe public/app (ejecuta el comando desde la raíz del proyecto)"); process.exit(1); }
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".js")).sort();

// 1) numeración
const bad = files.filter((f, i) => !f.startsWith(String(i + 1).padStart(2, "0") + "-"));
bad.length ? mal("Numeración no consecutiva en: " + bad.join(", ")) : ok(`${files.length} módulos con numeración consecutiva (01..${String(files.length).padStart(2, "0")})`);

// 2) sintaxis individual
const src = {};
for (const f of files) {
  src[f] = fs.readFileSync(path.join(DIR, f), "utf8");
  try { new vm.Script(src[f], { filename: f }); } catch (e) { mal(`Sintaxis inválida en ${f}: ${e.message}`); }
}
if (!problemas.length) ok("Cada módulo es sintácticamente válido por sí solo");

// 3) lista del cargador
const loader = fs.readFileSync(path.join(ROOT, "app/components/ErpLoader.tsx"), "utf8");
const m = /const APP = \[([\s\S]*?)\];/.exec(loader);
const lista = m ? [...m[1].matchAll(/"\/app\/([^"]+)"/g)].map((x) => x[1]) : [];
JSON.stringify(lista) === JSON.stringify(files)
  ? ok("La lista APP de ErpLoader.tsx coincide con la carpeta, en el mismo orden")
  : mal("La lista APP de ErpLoader.tsx NO coincide con public/app.\n   Cargador: " + lista.join(", ") + "\n   Carpeta : " + files.join(", "));

// 4) boot() solo en el último
const conBoot = files.filter((f) => /^boot\(\);/m.test(src[f]));
conBoot.length === 1 && conBoot[0] === files[files.length - 1]
  ? ok("boot() solo se invoca en el último módulo (" + files[files.length - 1] + ")")
  : mal("boot() debe invocarse únicamente en el último módulo; aparece en: " + (conBoot.join(", ") || "ninguno"));

// 5) sin monolito suelto
fs.existsSync(path.join(ROOT, "public/script.js"))
  ? mal("Existe public/script.js: el cargador ya no lo usa. Bórralo (la copia de referencia vive en qa/originales/).")
  : ok("No hay un public/script.js suelto");

// opcional) unión == monolito
if (process.argv.includes("--contra-monolito")) {
  const ref = path.join(ROOT, "qa/originales/script.monolito.js");
  const union = files.map((f) => src[f].replace(/^\/\* \[ERP \d+\/\d+\][^\n]*\r?\n/, "")).join("");
  const h = (s) => crypto.createHash("sha256").update(s).digest("hex");
  const refSrc = fs.readFileSync(ref, "utf8");
  union === refSrc
    ? ok("La unión de los módulos es IDÉNTICA al monolito original (sha256 " + h(union).slice(0, 16) + "…)")
    : mal("La unión de los módulos difiere del monolito original (esperado " + h(refSrc).slice(0, 16) + "…, obtenido " + h(union).slice(0, 16) + "…)");
}

console.log(problemas.length ? `\n${problemas.length} problema(s).` : "\nTodo correcto.");
process.exit(problemas.length ? 1 : 0);
