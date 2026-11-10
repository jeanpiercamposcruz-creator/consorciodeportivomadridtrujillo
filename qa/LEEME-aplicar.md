# Qué ya está aplicado y qué falta

YA APLICADO en este proyecto (public/script.js y app/components/ErpLoader.tsx):
P1 pull() atómico · P2 timeouts, refresh único, save() a prueba de excepciones, recibo solo con guardado confirmado
P3 validadores estrictos, fechas reales, today() en hora local · P4-a/c/d/e · P5-b/c/e/f/g
Originales respaldados en qa/originales/.

PENDIENTE (en este orden):
1. npm i qrcode-generator jsqr && node scripts/vendorizar-qr.mjs   (P5-a: sin CDN; luego prueba QR)
2. Ejecutar qa/supabase-blindaje.sql en un BRANCH de Supabase, no en producción (plantilla NO probada)
3. Decisiones tuyas: P4-b (regla contable), P3-d (money con NaN), P5-d (CSP con nonces), P5-h (CAPTCHA en servidor)
4. Migrar fechas históricas guardadas en UTC después de las 19:00; rotar token del carnet
5. Probar a mano en staging: login, matrícula, pago, QR. Luego: node qa/fuzz-harness.mjs
