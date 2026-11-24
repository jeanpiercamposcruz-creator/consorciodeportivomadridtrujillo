# Aplicación modular (public/app/)

`public/script.js` (4.390 líneas) se dividió en **18 módulos** dentro de `public/app/`, sin cambiar ni una línea de código:
la unión de los módulos es idéntica, byte a byte, al archivo original (copia de referencia en
`qa/originales/script.monolito.js`).

## Cómo funciona

No son módulos ES (`import`/`export`): son **un solo programa partido en archivos** que comparten el ámbito global,
igual que antes. Por eso el **orden importa**: un `const`/`let` no puede usarse antes de declararse.
`app/components/ErpLoader.tsx` los carga en el orden de su lista `APP`:

| # | Archivo | Contenido (secciones del script original) |
|---|---|---|
| 01 | config | Configuración, DOM, utilidades y validación (1-2) |
| 02 | estado | Estado y datos semilla (3) |
| 03 | datos-supabase | Login, sincronización y respaldo (4) |
| 04 | adjuntos | Foto + documentos del alumno (5) |
| 05 | preregistro-kits | Pre-registro y kits (6-7) |
| 06 | camara-qr | Cámara y lector QR (8) |
| 07 | publico | Carnet público y formulario de pre-registro (9) |
| 08 | sesion-navegacion | Menú lateral, restauración y sesión (10) |
| 09 | ui-helpers | Helpers, íconos, módulos y enrutador (11-12) |
| 10 | login-dashboard | Login, render principal y dashboard (13-14) |
| 11-14 | vistas-* | Vistas: base, sedes, personal, horarios y resto |
| 15 | acciones | Acciones `data-f` (16) |
| 16 | animaciones | Animaciones (17) |
| 17 | listeners | Event listeners (18) |
| 18 | arranque | `initBackgroundVideo()` y `boot()` (19) |

El cargador comprueba que **todos existan antes de ejecutar el primero** y, si un módulo lanza un error al
cargarse, **no ejecuta el último** (el que llama a `boot()`): igual que con un solo archivo, la app no arranca a medias.

## Reglas para seguir trabajando

1. **Editar un módulo existente**: libre. Es lo que se buscaba (cambios pequeños y localizados).
2. **Mover código entre módulos**: respeta el orden. Una función puede llamarse desde otro módulo si se *ejecuta* después
   de cargar todo; pero una sentencia que se ejecuta al cargar (`const X = f()`) solo puede usar lo declarado en módulos anteriores.
3. **Añadir un módulo**: numéralo (`19-...`), añádelo a `APP` en `ErpLoader.tsx` y mantén `boot()` solo en el último.
4. **Antes de cada deploy**: `npm run verificar:modulos`
   (numeración, sintaxis, lista del cargador, `boot()` solo al final, sin `script.js` suelto).
5. **Pruebas negativas**: `node qa/fuzz-harness.mjs` ejecuta ahora los módulos en orden (acepta también un archivo suelto).

## Qué se verificó al dividir

- Unión de módulos == monolito (SHA-256 idéntico) y cada módulo es válido por sí solo.
- `qa/fuzz-harness.mjs`: 23/27 antes y 23/27 después, con el mismo detalle en los 27 casos
  (los 4 pendientes son los de siempre: P3-d, P4-b, P5-d, P5-h).
- Navegador real, con el cargador real (`ErpLoader.tsx`) y Supabase simulado, monolito vs. módulos:
  1.983 elementos de 10 pantallas con estilos calculados idénticos; 258 interacciones (botones, selectores, campos)
  con el mismo estado final; mismas lecturas y las mismas escrituras a la base de datos, en el mismo orden.
- Fallos del cargador: módulo faltante (no ejecuta nada), módulo con error (no llama a `boot()`),
  doble ejecución del efecto (se carga una sola vez).

## Notas

- `qa/generar-endurecido.mjs` es histórico: leía `public/script.js` para generar el endurecimiento, que **ya está aplicado**.
  No lo vuelvas a ejecutar sobre la estructura modular.
- Costo: 18 archivos en vez de 1. Vercel los sirve por HTTP/2 y se descargan en paralelo.
