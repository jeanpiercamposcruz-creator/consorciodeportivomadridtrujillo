#!/usr/bin/env node
/**
 * Paso opcional P5-a: autoaloja las librerías QR (sin CDN, sin terceros en producción).
 *   1) npm i qrcode-generator jsqr
 *   2) node scripts/vendorizar-qr.mjs
 * Copia los archivos a public/vendor/ y cambia ErpLoader.tsx y next.config.ts para usarlos.
 */
import fs from "node:fs";
import path from "node:path";
const R = process.cwd();
const copiar = (cands, destino) => {
  const src = cands.map((c) => path.join(R, c)).find((p) => fs.existsSync(p));
  if (!src) { console.error("✖ No encontré " + destino + ". ¿Corriste: npm i qrcode-generator jsqr ?"); process.exit(1); }
  fs.mkdirSync(path.join(R, "public/vendor"), { recursive: true });
  fs.copyFileSync(src, path.join(R, "public/vendor", destino));
  console.log("✔ " + destino + " ← " + path.relative(R, src));
};
copiar(["node_modules/qrcode-generator/qrcode.js", "node_modules/qrcode-generator/dist/qrcode.js"], "qrcode.min.js");
copiar(["node_modules/jsqr/dist/jsQR.js"], "jsQR.min.js");

const f = path.join(R, "app/components/ErpLoader.tsx");
let ld = fs.readFileSync(f, "utf8");
const re = /const LIBS = \[[\s\S]*?\];/;
if (!re.test(ld)) { console.error("✖ No encontré LIBS en ErpLoader.tsx"); process.exit(1); }
ld = ld.replace(re, 'const LIBS = ["/vendor/qrcode.min.js", "/vendor/jsQR.min.js"];');
fs.writeFileSync(f, ld);
console.log("✔ ErpLoader.tsx usa /vendor/*");

const n = path.join(R, "next.config.ts");
let nx = fs.readFileSync(n, "utf8");
const a = `"script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",`;
if (!nx.includes(a)) { console.error("✖ CSP: no encontré la línea script-src esperada (¿ya aplicado?)"); process.exit(1); }
fs.writeFileSync(n, nx.replace(a, `"script-src 'self' 'unsafe-inline'",`));
console.log("✔ CSP sin cdnjs\nAhora: npm run build y prueba el QR (generar carnet + escanear).");
