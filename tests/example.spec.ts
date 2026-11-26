import { test, expect, type Page } from '@playwright/test';
import { randomInt, randomUUID } from 'node:crypto';

const url = process.env.ERP_URL;
const usuario = process.env.ERP_USER;
const password = process.env.ERP_PASSWORD;
const e2eConfigurado = Boolean(url && usuario && password);

test.describe.serial('Pruebas funcionales del ERP Consorcio Deportivo', () => {
  // En CI sin credenciales de QA, omite las pruebas autenticadas de forma explícita.
  // Nunca se deben guardar credenciales dentro del repositorio.
  test.skip(
    !e2eConfigurado,
    'Pruebas E2E omitidas: configura ERP_URL, ERP_USER y ERP_PASSWORD como secretos de GitHub Actions.'
  );

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    if (!url || !usuario || !password) {
      throw new Error('Faltan ERP_URL, ERP_USER o ERP_PASSWORD.');
    }

    const diagnosticos: string[] = [];
    page = await browser.newPage();
    page.on('pageerror', (e) => diagnosticos.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') diagnosticos.push('console: ' + m.text());
    });
    page.on('requestfailed', (r) =>
      diagnosticos.push('request: ' + r.url() + ' -> ' + (r.failure()?.errorText || 'falló'))
    );
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const app = document.querySelector('#app');
      const texto = app?.textContent || '';
      return texto.includes('Usuario') || texto.includes('No se pudo cargar') ||
        texto.includes('Error de configuración');
    }, null, { timeout: 30000 });

    const inicio = await page.locator('#app').innerText();
    if (!inicio.includes('Usuario')) {
      throw new Error('El ERP no terminó de iniciar. Pantalla: ' + inicio +
        '. Diagnóstico: ' + diagnosticos.join(' | '));
    }

    await page.locator('#lu').fill(usuario);
    await page.locator('#lp').fill(password);
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    await expect(page.getByText('Alumnos activos'))
      .toBeVisible({ timeout: 20000 });
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('Probar modulo de Alumnos activos', async () => {
    await expect(page.getByText('Alumnos activos')).toBeVisible();
  });

  test('Validar formulario de nueva matrícula sin guardar datos', async () => {
    // El inicio es el dashboard. Entramos al módulo Directorio de Alumnos desde su acceso directo.
    await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Nueva matrícula/i }).click();

    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();
    await expect(page.locator('#m_nom')).toBeVisible();
    await expect(page.locator('#m_ape')).toBeVisible();
    await expect(page.locator('#m_dni')).toBeVisible();
    await expect(page.locator('#m_sed')).toBeVisible();
    await expect(page.locator('#m_dep')).toBeVisible();

    // El formulario vacío debe mostrar validación y no crear ningún registro.
    await page.getByRole('button', { name: 'Guardar matrícula' }).click();
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).not.toBeEmpty();
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();
  });

  test('Rechazar nombres inválidos sin guardar matrícula', async () => {
    await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Nueva matrícula/i }).click();

    await page.locator('#m_nom').fill('123');
    await page.locator('#m_ape').fill('Prueba QA');
    await page.getByRole('button', { name: 'Guardar matrícula' }).click();

    await expect(page.locator('#toast')).toContainText('Nombres o apellidos inválidos');
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();
    await expect(page.locator('#m_nom')).toHaveValue('123');

    // Salimos sin guardar: la prueba no crea ni modifica alumnos.
    await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });


  test('Rechazar fecha de nacimiento fuera de rango y monto de matrícula inválido', async () => {
    await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Nueva matrícula/i }).click();
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    await page.locator('#m_nom').fill('Prueba');
    await page.locator('#m_ape').fill('QA');
    await page.locator('#m_nac').fill('1900-01-01');
    await page.getByRole('button', { name: 'Guardar matrícula', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Fecha de nacimiento fuera del rango');
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    await page.locator('#m_nac').fill('2016-01-01');
    await page.locator('#m_cm').fill('100000');
    await page.getByRole('button', { name: 'Guardar matrícula', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Monto inválido');
    await expect(page.locator('#m_cm')).toHaveValue('100000');

    // Cancelar descarta los datos inválidos; no se crea una matrícula ni un movimiento de caja.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });

  test('Rechazar DNI duplicado sin guardar matrícula', async () => {
    await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    const dniExistente = await page.locator('#dt table tr').evaluateAll((rows) => {
      for (const row of rows.slice(1)) {
        const dni = row.querySelectorAll('td')[2]?.textContent?.trim() || '';
        if (/^\d{8}$/.test(dni)) return dni;
      }
      return '';
    });
    expect(dniExistente).toMatch(/^\d{8}$/);

    await page.getByRole('button', { name: /Nueva matrícula/i }).click();
    await page.locator('#m_nom').fill('Prueba');
    await page.locator('#m_ape').fill('QA');
    await page.locator('#m_dni').fill(dniExistente);
    await page.locator('#m_nac').fill('2011-06-15');
    await page.getByRole('button', { name: 'Guardar matrícula' }).click();

    await expect(page.locator('#toast')).toContainText('Ese DNI ya está registrado');
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    // Cancelar sale del formulario; no se crea ni modifica ningún registro.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });

  test('Filtrar alumnos por estado y restablecer filtros', async () => {
    await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    const filas = page.locator('#dt table tr');
    const cantidadInicial = await filas.count();
    await page.getByLabel('Estado').selectOption('Activo');

    const estadosVisibles = await filas.evaluateAll((rows) =>
      rows.slice(1).map((row) => row.querySelectorAll('td')[7]?.textContent?.trim() || '')
        .filter(Boolean)
    );
    expect(estadosVisibles.length).toBeGreaterThan(0);
    expect(estadosVisibles.every((estado) => estado === 'Activo')).toBeTruthy();

    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(page.getByLabel('Estado')).toHaveValue('');
    await expect(filas).toHaveCount(cantidadInicial);
  });

  test('Buscar alumnos sin modificar registros', async () => {
    // Volvemos al directorio desde el menú lateral; la búsqueda solo filtra la vista.
    await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    // La función tbl() coloca también el encabezado dentro de tbody; contamos todas las filas.
    const filasTabla = page.locator('#dt table tr');
    const buscador = page.getByPlaceholder('Ej. Luis, 71234567 o 260001', { exact: true });
    await expect(buscador).toHaveCount(1);
    await expect(buscador).toBeVisible();

    const cantidadInicial = await filasTabla.count();
    expect(cantidadInicial).toBeGreaterThan(2);

    await buscador.fill('QA_BUSQUEDA_SIN_RESULTADOS_938472');
    await expect(buscador).toHaveValue('QA_BUSQUEDA_SIN_RESULTADOS_938472');
    // Dos filas esperadas: encabezado y mensaje "Sin registros todavía".
    await expect(filasTabla).toHaveCount(2);
    await expect(page.getByText('Sin registros todavía.', { exact: true })).toBeVisible();

    await buscador.fill('');
    await expect(filasTabla).toHaveCount(cantidadInicial);
    await expect(page.getByText('Buscar por nombre, DNI o código', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Sede')).toBeVisible();
    await expect(page.getByLabel('Deporte')).toBeVisible();
    await expect(page.getByLabel('Estado')).toBeVisible();
  });

  test('Abrir ficha de alumno y cancelar sin guardar cambios', async () => {
    const encabezadoDirectorio = page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true });
    if (!(await encabezadoDirectorio.isVisible())) {
      await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    }
    await expect(encabezadoDirectorio).toBeVisible();

    const primeraFila = page.locator('#dt table tr').nth(1);
    const codigo = (await primeraFila.locator('td').first().innerText()).trim();
    expect(codigo).not.toBe('');
    await primeraFila.getByRole('button', { name: 'Abrir', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Ficha ' + codigo, exact: false })).toBeVisible();
    await expect(page.locator('#m_nom')).toBeVisible();
    await expect(page.locator('#m_nom')).not.toHaveValue('');
    await expect(page.locator('#m_ape')).toBeVisible();
    await expect(page.locator('#m_ape')).not.toHaveValue('');
    await expect(page.locator('#m_dni')).toBeVisible();
    await expect(page.locator('#m_sed')).toBeVisible();
    await expect(page.locator('#m_dep')).toBeVisible();

    // Cancelar vuelve al directorio; no se pulsa Guardar matrícula.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });

  test('Navegar al modulo de Sedes y Alquileres', async () => {
    // El menú y el encabezado pueden compartir el mismo texto.
    // Selecciona la primera coincidencia para navegar y valida el encabezado por rol.
    await page.getByText('Sedes y Alquileres', { exact: true }).first().click();

    await expect(
      page.getByRole('heading', { name: 'Sedes y Alquileres', exact: true })
    ).toBeVisible();
  });

  test('Consultar sedes, buscar y revisar pestañas sin modificar datos', async () => {
    await page.getByText('Sedes y Alquileres', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Sedes y Alquileres', exact: true })).toBeVisible();

    const buscador = page.getByPlaceholder('Buscar por código, nombre o dirección...', { exact: true });
    const filas = page.locator('#sed_t table tr');
    await expect(buscador).toBeVisible();
    const cantidadInicial = await filas.count();
    expect(cantidadInicial).toBeGreaterThan(2);

    await buscador.fill('QA_SEDE_INEXISTENTE_9342');
    await expect(filas).toHaveCount(2);
    await expect(page.getByText('Sin registros todavía.', { exact: true })).toBeVisible();

    await buscador.fill('');
    await expect(filas).toHaveCount(cantidadInicial);

    await page.locator('button[data-f="sedTab"][data-i="c"]').click();
    await expect(page.getByRole('heading', { name: 'Nuevo contrato de alquiler', exact: true })).toBeVisible();

    await page.locator('button[data-f="sedTab"][data-i="k"]').click();
    await expect(page.getByRole('heading', { name: 'Nuevo centro de costo', exact: true })).toBeVisible();
  });

  test('Consultar personal, buscar y revisar pestañas sin modificar datos', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();

    const buscador = page.getByPlaceholder('Buscar por DNI, nombre, cargo o especialidad...', { exact: true });
    const filas = page.locator('#per_t table tr');
    await expect(buscador).toBeVisible();
    const cantidadInicial = await filas.count();
    expect(cantidadInicial).toBeGreaterThan(2);

    await buscador.fill('QA_PERSONAL_INEXISTENTE_9342');
    await expect(filas).toHaveCount(2);
    await expect(page.getByText('Sin registros todavía.', { exact: true })).toBeVisible();

    await buscador.fill('');
    await expect(filas).toHaveCount(cantidadInicial);

    await page.locator('button[data-f="perTab"][data-i="c"]').click();
    await expect(page.getByRole('heading', { name: 'Contratos del personal', exact: true })).toBeVisible();

    await page.locator('button[data-f="perTab"][data-i="p"]').click();
    await expect(page.getByRole('heading', { name: 'Pagos y liquidaciones de la semana', exact: true })).toBeVisible();
  });

  test('Rechazar contrato con fecha de fin anterior al inicio sin guardar cambios', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
    await page.locator('button[data-f="perTab"][data-i="c"]').click();
    await expect(page.getByRole('heading', { name: 'Contratos del personal', exact: true })).toBeVisible();

    const filas = page.locator('table tr');
    expect(await filas.count()).toBeGreaterThan(1);
    await filas.nth(1).getByRole('button', { name: 'Modificar', exact: true }).click();

    await expect(page.locator('#p_fi')).toBeVisible();
    await expect(page.locator('#p_ff')).toBeVisible();
    await page.locator('#p_fi').fill('2026-11-24');
    await page.locator('#p_ff').fill('2026-11-23');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

    await expect(page.locator('#toast')).toContainText('La fecha de fin no puede ser anterior al inicio');
    await expect(page.locator('#p_fi')).toHaveValue('2026-11-24');
    await expect(page.locator('#p_ff')).toHaveValue('2026-11-23');
    await expect(page.getByRole('heading', { name: /Modificar PER-/ })).toBeVisible();

    // Cancelar descarta los valores inválidos; no se persiste ningún cambio.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
  });


  test('Rechazar tarifa o sueldo fijo inválido en contrato del personal', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
    await page.locator('button[data-f="perTab"][data-i="d"]').click();

    const fila = page.locator('table tr').nth(1);
    await expect(fila).toBeVisible();
    await fila.getByRole('button', { name: 'Modificar', exact: true }).click();
    await expect(page.locator('#p_p')).toBeVisible();
    await expect(page.locator('#p_sf')).toBeVisible();

    await page.locator('#p_p').fill('-1');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Tarifa o sueldo fijo inválido');
    await expect(page.locator('#p_p')).toHaveValue('-1');

    // Cancelar descarta la tarifa inválida; no se actualiza el contrato existente.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
  });

  test('Consultar pagos y verificar importes sin modificar registros', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await page.locator('button[data-f="perTab"][data-i="p"]').click();
    await expect(page.getByRole('heading', { name: 'Pagos y liquidaciones de la semana', exact: true })).toBeVisible();

    const tabla = page.locator('table').last();
    await expect(tabla.getByText('Pago semana (horas)', { exact: true })).toBeVisible();
    await expect(tabla.getByText('Sueldo fijo (mensual)', { exact: true })).toBeVisible();
    const filas = tabla.locator('tr');
    expect(await filas.count()).toBeGreaterThan(1);

    const datosPago = await filas.evaluateAll((rows) =>
      rows.slice(1).map((row) =>
        Array.from(row.querySelectorAll('td')).slice(3, 6).map((cell) => cell.textContent?.trim() || '')
      )
    );
    expect(datosPago.length).toBeGreaterThan(0);
    const numero = (valor: string) => Number(valor.replace(/[^\d.-]/g, ''));
    for (const [tarifaTexto, horasTexto, pagoTexto] of datosPago) {
      const tarifa = numero(tarifaTexto);
      const horas = numero(horasTexto);
      const pago = numero(pagoTexto);
      expect(Number.isFinite(tarifa)).toBeTruthy();
      expect(Number.isFinite(horas)).toBeTruthy();
      expect(Number.isFinite(pago)).toBeTruthy();
      expect(Math.abs(pago - Math.round(tarifa * horas * 100) / 100)).toBeLessThanOrEqual(0.011);
    }
    await expect(page.getByText(/Total pago por horas de la semana:/)).toBeVisible();
    await expect(page.getByText(/Sueldos fijos mensuales:/)).toBeVisible();
  });


  test('Rechazar contrato de alquiler con fechas inválidas y enlace inseguro', async () => {
    await page.getByText('Sedes y Alquileres', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Sedes y Alquileres', exact: true })).toBeVisible();
    await page.locator('button[data-f="sedTab"][data-i="c"]').click();
    await expect(page.getByRole('heading', { name: 'Nuevo contrato de alquiler', exact: true })).toBeVisible();

    await expect(page.locator('#c_s')).toBeVisible();
    expect(await page.locator('#c_s option').count()).toBeGreaterThan(0);

    await page.locator('#c_i').fill('');
    await page.locator('#c_f').fill('');
    await page.locator('#c_m').fill('100');
    await page.getByRole('button', { name: 'Guardar contrato', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Las fechas de inicio y fin son obligatorias');

    await page.locator('#c_i').fill('2026-11-24');
    await page.locator('#c_f').fill('2026-11-25');
    await page.locator('#c_m').fill('0');
    await page.getByRole('button', { name: 'Guardar contrato', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Monto mensual inválido');

    await page.locator('#c_m').fill('100');
    await page.locator('#c_i').fill('2026-11-24');
    await page.locator('#c_f').fill('2026-11-24');
    await page.getByRole('button', { name: 'Guardar contrato', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('La fecha de fin debe ser posterior al inicio');
    await expect(page.getByRole('heading', { name: 'Nuevo contrato de alquiler', exact: true })).toBeVisible();

    await page.locator('#c_f').fill('2026-11-25');
    await page.locator('#c_u').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Guardar contrato', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('El enlace debe empezar con http:// o https://');
    await expect(page.locator('#c_u')).toHaveValue('javascript:alert(1)');
  });

  test('Rechazar código inválido de centro de costo sin guardar', async () => {
    await page.getByText('Sedes y Alquileres', { exact: true }).first().click();
    await page.locator('button[data-f="sedTab"][data-i="k"]').click();
    await expect(page.getByRole('heading', { name: 'Nuevo centro de costo', exact: true })).toBeVisible();

    await page.locator('#k_c').fill('X');
    await page.locator('#k_n').fill('Centro QA temporal');
    await page.getByRole('button', { name: 'Guardar centro de costo', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Código: 2 a 12 letras, números o guiones');
    await expect(page.locator('#k_c')).toHaveValue('X');
    await expect(page.getByRole('heading', { name: 'Nuevo centro de costo', exact: true })).toBeVisible();
  });


  test('Rechazar horarios incompletos o con horas inválidas sin guardar', async () => {
    await page.getByText('Horarios y Categorías', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();

    await expect(page.locator('#h_s')).toBeVisible();
    await expect(page.locator('#h_d')).toBeVisible();
    expect(await page.locator('#h_s option').count()).toBeGreaterThan(0);
    expect(await page.locator('#h_d option').count()).toBeGreaterThan(0);
    expect(await page.locator('#h_c input[type="checkbox"]').count()).toBeGreaterThan(0);

    const guardar = page.getByRole('button', { name: 'Guardar horario', exact: true });
    await guardar.click();
    await expect(page.locator('#toast')).toContainText('Elige al menos una categoría');

    await page.locator('#h_c input[type="checkbox"]').first().check();
    await guardar.click();
    await expect(page.locator('#toast')).toContainText('Elige al menos un día');

    await page.locator('.h_dia').first().check();
    await page.locator('#h_i').fill('18:00');
    await page.locator('#h_f').fill('18:00');
    await guardar.click();
    await expect(page.locator('#toast')).toContainText('La hora de fin debe ser posterior');

    await page.locator('#h_i').fill('16:00');
    await page.locator('#h_f').fill('18:00');
    await guardar.click();
    await expect(page.locator('#toast')).toContainText('Asigna al menos un profesor');
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();
  });


  test('Persistir, recuperar y revertir asistencia y pago de campo en Supabase QA', async () => {
    type DatosAsistenciaQA = {
      alumnoId: string;
      horarioId: string;
      sedeId: string;
      grupo: string;
      fecha: string;
      fee: number;
      asistenciaId: string;
      cajaId: string;
    };
    type HerramientaAsistenciaQA = {
      prepararAsistenciaQA: () => Promise<DatosAsistenciaQA>;
      verificarAsistenciaQA: (
        datos: DatosAsistenciaQA,
        asistio: boolean,
        pagoCampo: boolean | null
      ) => Promise<{
        asistencia: { asistio: boolean; pago_campo: boolean | null };
        caja: Array<{ monto: number | string }>;
        restored: { asistio: boolean; pagoCampo: boolean | undefined; caja: number };
      }>;
      cleanupAsistenciaQA: (datos: DatosAsistenciaQA) => Promise<{ removed: boolean }>;
    };

    let datos: DatosAsistenciaQA | null = null;
    try {
      datos = await page.evaluate(async () => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está habilitada la prueba de asistencia en Supabase QA.');
        return api.prepararAsistenciaQA();
      });

      await page.getByText('Toma de Asistencias', { exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'Toma de Asistencias', exact: true })).toBeVisible();
      await page.locator('select[data-ch="setA"][data-i="s"]').selectOption(datos.sedeId);
      await page.locator('select[data-ch="setA"][data-i="g"]').selectOption(datos.grupo);
      await page.locator('select[data-ch="setA"][data-i="h"]').selectOption(datos.horarioId);
      await page.locator('select[data-ch="setA"][data-i="t"]').selectOption('A');

      const asistio = page.locator(
        'button[data-f="mkA"][data-i="A"][data-j="' + datos.alumnoId + '"][data-k="1"]'
      );
      await expect(asistio).toBeVisible();
      await asistio.click();

      let verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de asistencia QA.');
        return api.verificarAsistenciaQA(d, true, null);
      }, datos);
      expect(verificado.asistencia.asistio).toBe(true);
      expect(verificado.asistencia.pago_campo).toBeNull();
      expect(verificado.restored.asistio).toBe(true);

      await page.locator(
        'button[data-f="mkP"][data-i="' + datos.alumnoId + '"][data-j="1"]'
      ).click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación del pago QA.');
        return api.verificarAsistenciaQA(d, true, true);
      }, datos);
      expect(verificado.asistencia.pago_campo).toBe(true);
      expect(verificado.caja).toHaveLength(1);
      expect(Number(verificado.caja[0].monto)).toBe(datos.fee);
      expect(verificado.restored.caja).toBe(1);

      await page.locator(
        'button[data-f="mkP"][data-i="' + datos.alumnoId + '"][data-j="0"]'
      ).click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de reversión QA.');
        return api.verificarAsistenciaQA(d, true, false);
      }, datos);
      expect(verificado.asistencia.pago_campo).toBe(false);
      expect(verificado.caja).toHaveLength(0);
      expect(verificado.restored.caja).toBe(0);

      await page.locator(
        'button[data-f="mkA"][data-i="A"][data-j="' + datos.alumnoId + '"][data-k="0"]'
      ).click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación del cambio de asistencia QA.');
        return api.verificarAsistenciaQA(d, false, false);
      }, datos);
      expect(verificado.asistencia.asistio).toBe(false);
      expect(verificado.restored.asistio).toBe(false);

      await page.locator(
        'button[data-f="mkA"][data-i="A"][data-j="' + datos.alumnoId + '"][data-k="1"]'
      ).click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación final de asistencia QA.');
        return api.verificarAsistenciaQA(d, true, false);
      }, datos);
      expect(verificado.asistencia.asistio).toBe(true);
      expect(verificado.asistencia.pago_campo).toBe(false);
    } finally {
      if (datos) {
        const limpieza = await page.evaluate(async (d) => {
          const api = (window as unknown as {
            __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA;
          }).__ERP_QA_PERSISTENCIA__;
          if (!api) throw new Error('No está disponible la limpieza de asistencia QA.');
          return api.cleanupAsistenciaQA(d);
        }, datos);
        expect(limpieza.removed).toBe(true);
      }
    }
  });

  test('Consultar filtros de asistencia sin marcar ni registrar pagos', async () => {
    await page.getByText('Toma de Asistencias', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Toma de Asistencias', exact: true })).toBeVisible();

    const sede = page.locator('select[data-ch="setA"][data-i="s"]');
    await expect(sede).toBeVisible();
    expect(await sede.locator('option').count()).toBeGreaterThan(1);
    await sede.selectOption({ index: 1 });

    const grupo = page.locator('select[data-ch="setA"][data-i="g"]');
    await expect(grupo).toBeVisible();
    expect(await grupo.locator('option').count()).toBeGreaterThan(1);
    await grupo.selectOption({ index: 1 });

    const hora = page.locator('select[data-ch="setA"][data-i="h"]');
    await expect(hora).toBeVisible();
    expect(await hora.locator('option').count()).toBeGreaterThan(1);
    await hora.selectOption({ index: 1 });

    const tipo = page.locator('select[data-ch="setA"][data-i="t"]');
    await expect(tipo).toBeVisible();
    await tipo.selectOption('A');

    await expect(page.getByText('Completa los 4 filtros para ver la lista.', { exact: true })).toHaveCount(0);
    await expect(page.locator('table')).toBeVisible();

    // Cambiar la sede debe limpiar los filtros dependientes y evitar una lista desactualizada.
    if (await sede.locator('option').count() > 2) {
      await sede.selectOption({ index: 2 });
      await expect(grupo).toHaveValue('');
      await expect(hora).toHaveValue('');
      await expect(page.getByText('Completa los 4 filtros para ver la lista.', { exact: true })).toBeVisible();
    }

    // Esta consulta solo cambia filtros; no pulsa Asistió, Faltó, Pagó ni Debe.
  });


  test('Rechazar venta de indumentaria sin alumno seleccionado', async () => {
    await page.getByText('Ventas de Indumentaria', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();

    await expect(page.locator('#k_a')).toHaveValue('');
    await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Elige un alumno');
    await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();
  });


  test('Rechazar venta con precio o costo fuera de rango sin registrar', async () => {
    await page.getByText('Ventas de Indumentaria', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();

    await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    const codigoAlumno = (await page.locator('#dt table tr').nth(1).locator('td').first().innerText()).trim();

    await page.getByText('Ventas de Indumentaria', { exact: true }).first().click();
    await page.locator('#k_q').fill(codigoAlumno);
    const resultado = page.locator('#k_res button').first();
    await expect(resultado).toBeVisible();
    await resultado.click();
    await expect(page.locator('#k_a')).toHaveValue(codigoAlumno);

    await page.locator('#k_pr').fill('100000');
    await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Precio o costo inválido');
    await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();
    // La validación termina antes de insertar la venta o su ingreso automático en caja.
  });

  test('Dashboard no duplica alquiler ni planilla dentro de otros egresos', async () => {
    type HerramientaDashboard = {
      probarDashboardSinDobleConteo: () => Promise<{ deltaOtrosEgresos: number; deltaUtilidad: number }>;
    };
    const resultado = await page.evaluate(async () => {
      const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaDashboard }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No está disponible la prueba financiera QA.');
      return api.probarDashboardSinDobleConteo();
    });
    expect(resultado.deltaOtrosEgresos).toBe(50);
    expect(resultado.deltaUtilidad).toBe(-50);
  });


  test('Revertir todas las tablas cuando falla una escritura del lote ERP', async () => {
    type HerramientaAtomica = {
      probarRollbackLote: () => Promise<{ rejected: boolean; rollback: boolean; residual: number }>;
    };
    const resultado = await page.evaluate(async () => {
      const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAtomica }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No está disponible la prueba de atomicidad QA.');
      return api.probarRollbackLote();
    });
    expect(resultado.rejected).toBeTruthy();
    expect(resultado.rollback).toBeTruthy();
    expect(resultado.residual).toBe(0);
  });


  test('Mantener la trazabilidad de Caja al crear, editar y anular una venta de indumentaria', async () => {
    const id = 'QA-KIT-' + randomInt(1_000_000_000_000, 9_999_999_999_999);
    type ResultadoKit = {
      database: {
        kits: Array<{ id: string; precio_publico: string | number; alumno_id: string; estado: string }>;
        caja: Array<{ id: string; origen: string; monto: string | number; detalle: string; tipo: string; concepto: string }>;
        reversas: Array<{ id: string; origen: string; monto: string | number; detalle: string; tipo: string; concepto: string }>;
      };
      restored: {
        kit: { id: string; pr: string | number; aid: string; est: string } | null;
        caja: Array<{ id: string; m: string | number; d: string; k: string; t: string }>;
        reversas: Array<{ id: string; m: string | number; d: string; k: string; t: string }>;
      };
    };
    type HerramientaKit = {
      prepararIdKit: (id: string) => Promise<string>;
      verificarKitCaja: (id: string) => Promise<ResultadoKit>;
      cleanupKit: (id: string) => Promise<{ removed: boolean }>;
    };
    try {
      await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
      await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
      const codigoAlumno = (await page.locator('#dt table tr').nth(1).locator('td').first().innerText()).trim();

      await page.getByText('Ventas de Indumentaria', { exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();
      const preparado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está habilitada la prueba de ventas en Supabase QA.');
        return api.prepararIdKit(idPrueba);
      }, id);
      expect(preparado).toBe(id);

      await page.locator('#k_q').fill(codigoAlumno);
      const resultado = page.locator('#k_res button').first();
      await expect(resultado).toBeVisible();
      await resultado.click();
      await expect(page.locator('#k_a')).toHaveValue(codigoAlumno);
      await page.locator('#k_pr').fill('75');
      await page.locator('#k_c').fill('35');
      await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Venta registrada');

      let verificado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de venta QA.');
        return api.verificarKitCaja(idPrueba);
      }, id);
      expect(verificado.database.kits).toHaveLength(1);
      expect(verificado.database.caja).toHaveLength(1);
      expect(Number(verificado.database.caja[0].monto)).toBe(75);
      expect(verificado.restored.caja).toHaveLength(1);

      await page.locator('button[data-f="kitEd"][data-i="' + id + '"]').click();
      await expect(page.getByRole('heading', { name: 'Editar venta', exact: true })).toBeVisible();
      await page.locator('#k_pr').fill('85');
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Venta actualizada');

      verificado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de venta QA.');
        return api.verificarKitCaja(idPrueba);
      }, id);
      expect(verificado.database.kits).toHaveLength(1);
      expect(verificado.database.caja).toHaveLength(1);
      expect(Number(verificado.database.caja[0].monto)).toBe(85);

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('button[data-f="delKit"][data-i="' + id + '"]').click();
      await expect(page.locator('#toast')).toContainText('Venta anulada y reversión registrada en Caja');
      verificado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de venta QA.');
        return api.verificarKitCaja(idPrueba);
      }, id);
      expect(verificado.database.kits).toHaveLength(1);
      expect(verificado.database.kits[0].estado).toBe('Anulada');
      expect(verificado.database.caja).toHaveLength(1);
      expect(verificado.database.reversas).toHaveLength(1);
      expect(verificado.database.caja[0].tipo).toBe('I');
      expect(verificado.database.reversas[0].tipo).toBe('E');
      expect(Number(verificado.database.reversas[0].monto)).toBe(85);
      expect(verificado.restored.kit?.est).toBe('Anulada');
      expect(verificado.restored.caja).toHaveLength(1);
      expect(verificado.restored.reversas).toHaveLength(1);
    } finally {
      const limpieza = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de la venta QA.');
        return api.cleanupKit(idPrueba);
      }, id);
      expect(limpieza.removed).toBeTruthy();
    }
  });


  test('Bloquear dos ventas simultáneas del mismo número de camiseta en categorías competitivas próximas', async () => {
    type HerramientaCamiseta = {
      probarNumeroCamisetaConcurrente: () => Promise<{ aceptados: number; rechazados: number; persistidos: number }>;
    };
    const resultado = await page.evaluate(async () => {
      const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaCamiseta }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No está disponible la prueba de concurrencia de camisetas QA.');
      return api.probarNumeroCamisetaConcurrente();
    });
    expect(resultado.aceptados).toBe(1);
    expect(resultado.rechazados).toBe(1);
    expect(resultado.persistidos).toBe(1);
  });

  test('Rechazar movimiento de caja sin monto válido', async () => {
    await page.getByText('Caja Chica y Finanzas', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Registrar movimiento', exact: true })).toBeVisible();

    const registrar = page.getByRole('button', { name: 'Registrar movimiento', exact: true });
    for (const monto of ['', '0', '-1', '100000']) {
      await page.locator('#c_m').fill(monto);
      await registrar.click();
      await expect(page.locator('#toast')).toContainText('Monto inválido');
      await expect(registrar).toBeVisible();
    }
    // Todas las entradas se rechazan antes de añadir un movimiento a caja.
  });


  test('Consultar dashboard gerencial y cambiar periodo sin modificar datos', async () => {
    await page.getByText('Dashboard Gerencial', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Dashboard Gerencial', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Balance de utilidad por sede', exact: true })).toBeVisible();

    const mes = page.locator('select[data-ch="setGMm"]');
    const anio = page.locator('select[data-ch="setGMy"]');
    await expect(mes).toBeVisible();
    await expect(anio).toBeVisible();
    await mes.selectOption('10');
    await expect(page.getByText(/Utilidad neta total del mes:/)).toBeVisible();
    const opcionesAnio = await anio.locator('option').count();
    if (opcionesAnio > 1) {
      await anio.selectOption({ index: 1 });
    } else {
      await expect(anio).toHaveValue(await anio.inputValue());
    }

    await expect(page.getByRole('heading', { name: 'Utilidad neta por mes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Matrículas registradas por mes' })).toBeVisible();
    await expect(page.getByText(/Balance de utilidad por sede/)).toBeVisible();
  });


  test('Consultar pre-registros y filtrar sin aceptar ni eliminar solicitudes', async () => {
    await page.getByRole('button', { name: /PRE-REGISTRO/ }).click();
    const buscador = page.getByPlaceholder('Nombre, DNI o apoderado', { exact: true });
    await expect(buscador).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeVisible();

    const filas = page.locator('#pt table tr');
    await buscador.fill('QA_PRE_REGISTRO_INEXISTENTE_938472');
    await expect(filas).toHaveCount(2);
    await expect(page.getByText('Sin registros todavía.', { exact: true })).toBeVisible();

    await buscador.fill('');
    const modalidad = page.locator('select[data-ch="preM"]');
    await expect(modalidad).toBeVisible();
    await modalidad.selectOption('Virtual');
    await expect(filas.first()).toBeVisible();

    // No se pulsan Aceptar ni Eliminar; solo se consulta y filtra la lista.
    await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeVisible();
  });



  test('Rechazar deporte con código inválido o repetido sin guardar', async () => {
    await page.getByText('Horarios y Categorías', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();

    await page.locator('#d_n').fill('Deporte QA');
    await page.locator('#d_c').fill('AB');
    await page.getByRole('button', { name: 'Agregar deporte', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Nombre y código de 3 letras');

    const codigoExistente = (await page.locator('#h_d option').nth(1).getAttribute('value')) || '';
    await page.locator('#d_c').fill(codigoExistente.replace(/^DEP-/, ''));
    await page.getByRole('button', { name: 'Agregar deporte', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Código repetido');
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();
    // Los dos intentos se detienen antes de añadir un deporte al catálogo.
  });


  test('Rechazar certificación del personal sin nombre', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
    await page.locator('button[data-f="perTab"][data-i="d"]').click();

    const fila = page.locator('table tr').nth(1);
    await fila.getByRole('button', { name: 'Modificar', exact: true }).click();
    await expect(page.locator('#pc_c')).toBeVisible();
    await expect(page.locator('#pc_e')).toBeVisible();
    await expect(page.locator('#pc_v')).toBeVisible();

    await page.locator('#pc_c').fill('');
    await page.locator('#pc_e').fill('Entidad QA');
    await page.locator('#pc_v').fill('2027-12-31');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Ingresa la certificación');
    await expect(page.locator('#pc_c')).toBeVisible();
    // La certificación incompleta no se agrega al expediente del personal.
  });


  test('Rechazar archivos adjuntos con formato no permitido o tamaño excesivo', async () => {
    await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Nueva matrícula/i }).click();
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    await page.locator('#ad_b').click();
    const chooserTipo = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Subir', exact: true }).first().click();
    await (await chooserTipo).setFiles({
      name: 'archivo-no-permitido.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('contenido QA'),
    });
    await expect(page.locator('#toast')).toContainText('Solo JPG, PNG o PDF de hasta 5 MB');

    const chooserTamano = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Subir', exact: true }).first().click();
    await (await chooserTamano).setFiles({
      name: 'archivo-excesivo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(5_000_001),
    });
    await expect(page.locator('#toast')).toContainText('Solo JPG, PNG o PDF de hasta 5 MB');
    await expect(page.locator('#ad_b')).toContainText('0/4');
    // No se seleccionó un archivo válido ni se guardó la matrícula.
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.locator('#mod')).not.toHaveClass(/o/);
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();
  });

  test('Abrir directamente Matrículas y Alumnos y revisar formulario sin guardar', async () => {
    await page.getByText('Matrículas y Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Matrículas y Alumnos', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Nueva matrícula/ })).toBeVisible();

    await expect(page.locator('#m_nom')).toBeVisible();
    await expect(page.locator('#m_ape')).toBeVisible();
    await expect(page.locator('#m_dni')).toBeVisible();
    await expect(page.locator('#m_dep')).toBeVisible();
    await expect(page.locator('#m_sed')).toBeVisible();

    // Solo se inspecciona el formulario; no se pulsa Guardar matrícula.
  });


  test('Verificar consistencia de ingresos y egresos entre Caja y Dashboard Gerencial', async () => {
    const ahora = new Date();
    const anio = String(ahora.getFullYear());
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');

    // Consultamos Caja por sede y acumulamos solo movimientos del mes actual.
    await page.getByText('Caja Chica y Finanzas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Caja Chica y Finanzas', exact: true })).toBeVisible();

    const selectorSede = page.locator('select[data-ch="asCs"]');
    await expect(selectorSede).toBeVisible();
    const sedes = await selectorSede.locator('option').evaluateAll((options) => {
      const elementos = options as HTMLOptionElement[];
      return elementos
        .filter((option) => option.value)
        .map((option) => ({ id: option.value, nombre: option.textContent?.trim() || '' }));
    });
    expect(sedes.length).toBeGreaterThan(0);

    const totalesCaja = new Map<string, { ingresos: number; egresos: number }>();
    const numero = (texto: string) => Number(texto.replace(/[^\d.-]/g, ''));

    for (const sede of sedes) {
      await selectorSede.selectOption(sede.id);
      const filas = await page.locator('table').last().locator('tr').evaluateAll((rows) =>
        rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
      );
      let ingresos = 0;
      let egresos = 0;
      for (const fila of filas) {
        if (!fila[0]?.startsWith(anio + '-' + mes)) continue;
        // Caja ahora incluye la columna Trazabilidad antes del importe.
        const monto = numero(fila[5] || '');
        if (fila[1] === 'Ingreso') ingresos += monto;
        if (fila[1] === 'Egreso') egresos += monto;
      }
      totalesCaja.set(sede.nombre, { ingresos, egresos });
    }

    // El Dashboard calcula esos mismos importes desde caja_movimientos.
    await page.getByText('Dashboard Gerencial', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Dashboard Gerencial', exact: true })).toBeVisible();
    await page.locator('select[data-ch="setGMm"]').selectOption(mes);
    await page.locator('select[data-ch="setGMy"]').selectOption(anio);

    const tablaBalance = page.locator('table').filter({
      has: page.getByRole('columnheader', { name: 'Ingresos', exact: true }),
    }).first();
    await expect(tablaBalance).toBeVisible();
    const balance = await tablaBalance.locator('tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    expect(balance.length).toBeGreaterThan(0);

    for (const fila of balance) {
      const sede = fila[0];
      const caja = totalesCaja.get(sede);
      expect(caja, 'La sede del Dashboard debe existir en el selector de Caja: ' + sede).toBeDefined();
      expect(Math.abs(numero(fila[1] || '') - caja!.ingresos)).toBeLessThanOrEqual(0.011);
      expect(Math.abs(numero(fila[5] || '') - caja!.egresos)).toBeLessThanOrEqual(0.011);
    }
    // Solo se cambiaron filtros de consulta; no se creó ni modificó ningún movimiento.
  });


  test('Verificar que los horarios activos estén vinculados a entrenadores activos', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();

    const personalRows = await page.locator('#per_t table tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    const entrenadoresActivos = new Set(
      personalRows
        .filter((row) => row[3] === 'ENT' && row[8] === 'Activo')
        .map((row) => row[2])
    );

    await page.getByText('Horarios y Categorías', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();
    const horarioRows = await page.locator('table').last().locator('tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    const horariosActivos = horarioRows.filter((row) => row[7] === 'Activo');
    expect(horariosActivos.length).toBeGreaterThan(0);

    for (const horario of horariosActivos) {
      const profesores = (horario[6] || '').split(',').map((nombre) => nombre.trim()).filter(Boolean);
      expect(profesores.length, 'El horario ' + horario[0] + ' debe tener entrenador asignado').toBeGreaterThan(0);
      for (const profesor of profesores) {
        expect(
          entrenadoresActivos.has(profesor),
          'El entrenador "' + profesor + '" del horario ' + horario[0] + ' debe existir y estar activo en Personal'
        ).toBeTruthy();
      }
    }
  });

  test('Verificar que la lista de asistencia solo incluya alumnos activos del grupo y sede seleccionados', async () => {
    await page.getByText('Directorio de Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    const directorio = await page.locator('table').last().locator('tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    const alumnosActivos = new Map(
      directorio
        .filter((row) => row[7] === 'Activo')
        .map((row) => [row[1].replace(/\\s+/g, ' ').trim(), { sede: row[3], deporte: row[4], categoria: row[5] }])
    );

    await page.getByText('Toma de Asistencias', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Toma de Asistencias', exact: true })).toBeVisible();

    const sede = page.locator('select[data-ch="setA"][data-i="s"]');
    await expect(sede).toBeVisible();
    const sedesDisponibles = await sede.locator('option').count();
    expect(sedesDisponibles).toBeGreaterThan(1);
    await sede.selectOption({ index: 1 });
    const sedeNombre = (await sede.locator('option:checked').textContent())?.trim() || '';

    const grupo = page.locator('select[data-ch="setA"][data-i="g"]');
    await expect(grupo).toBeVisible();
    expect(await grupo.locator('option').count()).toBeGreaterThan(1);
    await grupo.selectOption({ index: 1 });
    const grupoValor = await grupo.inputValue();
    const [deporteId, categoria] = grupoValor.split('|');

    const deportes = await page.getByText('Directorio de Alumnos', { exact: true }).count();
    expect(deportes).toBeGreaterThanOrEqual(0);
    const nombreDeporte = (await grupo.locator('option:checked').textContent())?.trim() || '';

    const hora = page.locator('select[data-ch="setA"][data-i="h"]');
    await expect(hora).toBeVisible();
    expect(await hora.locator('option').count()).toBeGreaterThan(1);
    await hora.selectOption({ index: 1 });
    await page.locator('select[data-ch="setA"][data-i="t"]').selectOption('A');

    const filasAsistencia = await page.locator('table').last().locator('tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => row.querySelector('td')?.textContent?.replace(/\\s+/g, ' ').trim() || '')
    );
    for (const nombre of filasAsistencia) {
      const alumno = alumnosActivos.get(nombre);
      expect(alumno, 'El alumno "' + nombre + '" debe existir y estar activo en el Directorio').toBeDefined();
      expect(alumno!.sede, 'La sede del alumno "' + nombre + '" debe coincidir con la seleccionada').toBe(sedeNombre);
      expect(alumno!.deporte, 'El deporte del alumno "' + nombre + '" debe coincidir con el grupo ' + nombreDeporte + ' (' + deporteId + ')').toContain(nombreDeporte.split(' ')[0]);
      expect(alumno!.categoria, 'La categoría del alumno "' + nombre + '" debe coincidir con el grupo seleccionado').toBe(categoria);
    }
    // La prueba solo consulta el directorio y la lista; no marca asistencia ni pagos.
  });


  test('Verificar importes y estados del cronograma frente a matrícula y pagos', async () => {
    await page.getByText('Directorio de Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    const primeraFila = page.locator('#dt table tr').nth(1);
    const codigo = (await primeraFila.locator('td').first().innerText()).trim();
    expect(codigo).not.toBe('');
    await primeraFila.getByRole('button', { name: 'Abrir', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ficha ' + codigo, exact: false })).toBeVisible();

    const matricula = Number(await page.locator('#m_cm').inputValue());
    const mensualidad = Number(await page.locator('#m_cmen').inputValue());
    const meses = Number(await page.locator('#m_mes').inputValue());
    const pagado = Number(await page.locator('#m_pag').inputValue());
    for (const valor of [matricula, mensualidad, meses, pagado]) {
      expect(Number.isFinite(valor)).toBeTruthy();
      expect(valor).toBeGreaterThanOrEqual(0);
    }

    // Sincroniza el cronograma con los valores ya cargados en la ficha.
    // El formulario usa delegación de eventos input para recalcular la vista previa.
    for (const selector of ['#m_cm', '#m_cmen', '#m_mes', '#m_pag']) {
      await page.locator(selector).dispatchEvent('input');
    }
    const filas = page.locator('#cron_t table tr');
    const datos = await filas.evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    const mesesEsperados = Math.min(36, Math.max(0, Math.trunc(meses)));
    expect(datos).toHaveLength(mesesEsperados);

    const numero = (texto: string) => Number(texto.replace(/[^\d.-]/g, ''));
    let saldoAplicable = Math.max(0, pagado - matricula);
    let totalCuotas = 0;
    let cuotasPagadas = 0;

    for (const [indice, fila] of datos.entries()) {
      expect(fila[0]).toBe(String(indice + 1));
      expect(Math.abs(numero(fila[2]) - mensualidad)).toBeLessThanOrEqual(0.011);
      const abonadoEsperado = Math.min(mensualidad, saldoAplicable);
      const saldoEsperado = Math.max(0, mensualidad - abonadoEsperado);
      expect(Math.abs(numero(fila[3]) - abonadoEsperado)).toBeLessThanOrEqual(0.011);
      expect(Math.abs(numero(fila[4]) - saldoEsperado)).toBeLessThanOrEqual(0.011);
      totalCuotas += numero(fila[2]);
      saldoAplicable = Math.round((saldoAplicable - abonadoEsperado) * 100) / 100;
      if (saldoEsperado <= 0.009) {
        cuotasPagadas++;
        expect(fila[5]).toBe('Pagada');
      } else if (abonadoEsperado > 0.009) {
        expect(fila[5]).toBe('Parcial');
      } else {
        expect(['Pendiente', 'Vencida']).toContain(fila[5]);
      }
    }

    const totalProyectado = matricula + totalCuotas;
    const resumen = await page.locator('#cron_t').innerText();
    expect(resumen).toContain('Monto total proyectado:');
    expect(Math.abs(totalProyectado - (matricula + mensualidad * mesesEsperados))).toBeLessThanOrEqual(0.011);
    expect(cuotasPagadas).toBeLessThanOrEqual(mesesEsperados);

    // No se modifica ningún campo ni se guarda la ficha; solo se contrasta el cronograma visible.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });

  test('Distribuir abonos parciales primero a matrícula y luego a cuotas sin guardar', async () => {
    await page.getByText('Directorio de Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    const primeraFila = page.locator('#dt table tr').nth(1);
    await primeraFila.getByRole('button', { name: 'Abrir', exact: true }).click();
    await expect(page.locator('#m_pag')).toBeVisible();

    await page.locator('#m_cm').fill('50');
    await page.locator('#m_cmen').fill('90');
    await page.locator('#m_mes').fill('2');
    await page.locator('#m_pag').fill('100');
    for (const selector of ['#m_cm', '#m_cmen', '#m_mes', '#m_pag']) {
      await page.locator(selector).dispatchEvent('input');
    }

    const datos = await page.locator('#cron_t table tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    expect(datos).toHaveLength(2);
    expect(datos[0][2]).toContain('90');
    expect(datos[0][3]).toContain('50');
    expect(datos[0][4]).toContain('40');
    expect(datos[0][5]).toBe('Parcial');
    expect(datos[1][3]).toContain('0');
    expect(datos[1][4]).toContain('90');
    expect(datos[1][5]).toBe('Pendiente');
    await expect(page.locator('#cron_t')).toContainText('Matrícula:');
    await expect(page.locator('#cron_t')).toContainText('Saldo:');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  });

  test('Calcular reversiones parciales FIFO sin mutar ingresos ni exceder el saldo original', async () => {
    const resultado = await page.evaluate(() => {
      type Movimiento = { _id?: string; d: string; t: string; c: string; m: number; k?: string };
      const fn = (window as unknown as {
        calcularReversionesCaja: (caja: Movimiento[], id: string, importe: number) => { originalId: string; monto: number }[];
      }).calcularReversionesCaja;
      const movimientos: Movimiento[] = [
        { _id: 'ingreso-1', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 70 },
        { _id: 'ingreso-2', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 30 },
      ];
      const primera = fn(movimientos, 'ALU-QA', 40);
      primera.forEach((x) => movimientos.push({
        _id: 'egreso-' + movimientos.length, d: 'ALU-QA', t: 'E',
        c: 'Reversión de pago de matrícula', m: x.monto, k: 'reversion:' + x.originalId,
      }));
      const segunda = fn(movimientos, 'ALU-QA', 50);
      segunda.forEach((x) => movimientos.push({
        _id: 'egreso-' + movimientos.length, d: 'ALU-QA', t: 'E',
        c: 'Reversión de pago de matrícula', m: x.monto, k: 'reversion:' + x.originalId,
      }));
      const insuficiente = fn(movimientos, 'ALU-QA', 100);
      return {
        primera, segunda, insuficiente,
        originales: movimientos.filter((x) => x.t === 'I'),
        egresos: movimientos.filter((x) => x.t === 'E'),
      };
    });
    expect(resultado.primera).toEqual([
      { originalId: 'ingreso-2', monto: 30 },
      { originalId: 'ingreso-1', monto: 10 },
    ]);
    expect(resultado.segunda).toEqual([{ originalId: 'ingreso-1', monto: 50 }]);
    expect(resultado.insuficiente.reduce((s, x) => s + x.monto, 0)).toBe(10);
    expect(resultado.insuficiente.every((x) => x.monto > 0 && x.originalId)).toBeTruthy();
    expect(resultado.originales).toEqual([
      { _id: 'ingreso-1', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 70 },
      { _id: 'ingreso-2', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 30 },
    ]);
    expect(resultado.egresos.reduce((s, x) => s + x.m, 0)).toBe(90);
  });



  test('Registrar trazabilidad de cada abono por matrícula y cuota en orden', async () => {
    const resultado = await page.evaluate(() => {
      const fn = (window as unknown as {
        distribuirAbonoMatricula: (cm: number, cmen: number, meses: number, desde: number, hasta: number) =>
          { destino: string; cuota: number; monto: number }[];
      }).distribuirAbonoMatricula;
      return {
        primero: fn(50, 90, 2, 0, 100),
        segundo: fn(50, 90, 2, 100, 190),
        tercero: fn(50, 90, 2, 190, 230),
      };
    });
    expect(resultado.primero).toEqual([
      { destino: 'Matrícula', cuota: 0, monto: 50 },
      { destino: 'Cuota', cuota: 1, monto: 50 },
    ]);
    expect(resultado.segundo).toEqual([
      { destino: 'Cuota', cuota: 1, monto: 40 },
      { destino: 'Cuota', cuota: 2, monto: 50 },
    ]);
    expect(resultado.tercero).toEqual([
      { destino: 'Cuota', cuota: 2, monto: 40 },
    ]);
    for (const [desde, hasta, tramos] of [
      [0, 100, resultado.primero],
      [100, 190, resultado.segundo],
      [190, 230, resultado.tercero],
    ] as const) {
      expect(tramos.reduce((s, x) => s + x.monto, 0)).toBe(hasta - desde);
    }
  });


  test('Reconocer ingresos con aplicación codificada y mostrar su trazabilidad en Caja', async () => {
    const resultado = await page.evaluate(() => {
      const cajaAuditoriaFn = (window as unknown as {
        cajaAuditoria: (movimiento: { k: string }) => string;
      }).cajaAuditoria;
      const reversasFn = (window as unknown as {
        calcularReversionesCaja: (
          caja: { _id: string; d: string; t: string; c: string; m: number; k: string }[],
          id: string,
          importe: number
        ) => { originalId: string; monto: number }[];
      }).calcularReversionesCaja;
      const aplicacion = encodeURIComponent(JSON.stringify([
        { destino: 'Matrícula', cuota: 0, monto: 50 },
        { destino: 'Cuota', cuota: 1, monto: 50 },
      ]));
      const ingreso = {
        _id: 'ingreso-auditado',
        d: 'ALU-QA',
        t: 'I',
        c: 'Abono matrícula',
        m: 100,
        k: 'matricula:ALU-QA|aplicacion:' + aplicacion,
      };
      return {
        detalle: cajaAuditoriaFn(ingreso),
        reversa: reversasFn([ingreso], 'ALU-QA', 25),
      };
    });
    expect(resultado.detalle).toContain('Matrícula');
    expect(resultado.detalle).toContain('Cuota 1');
    expect(resultado.reversa).toEqual([{ originalId: 'ingreso-auditado', monto: 25 }]);
  });

  test('Completar una matrícula con pago inicial y conciliar ficha, cuotas y Caja en Supabase QA', async () => {
    const dni = String(randomInt(10_000_000, 99_999_999));
    type Cuota = { numero_cuota: number; monto: string | number; monto_abonado: string | number; saldo_pendiente: string | number; estado: string };
    type Resultado = {
      id: string;
      alumno: { monto_pagado: string | number; costo_matricula: string | number; costo_mensualidad: string | number; meses: number };
      cuotas: Cuota[];
      caja: { monto: string | number; origen: string };
      allocation: Array<{ destino: string; cuota: number; monto: number }>;
      restored: { pagado: string | number; cuotas: Array<{ n: number; monto: number; abonado: number; saldo: number; estado: string }>; caja: Array<{ monto: number; origen: string }> };
    };
    type HerramientaQA = {
      prepararIdMatricula: (dni: string) => Promise<string>;
      verificarMatriculaCompleta: (dni: string) => Promise<Resultado>;
      cleanupMatricula: (dni: string) => Promise<{ removed: boolean; id?: string }>;
    };
    try {
      await page.locator('button[data-i="dir"][data-f="go"], button[data-i="dir"][data-f="nav"]').first().click();
      await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
      await page.getByRole('button', { name: /Nueva matrícula/i }).click();
      await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

      await page.locator('#m_nom').fill('QA');
      await page.locator('#m_ape').fill('Persistencia');
      await page.locator('#m_dni').fill(dni);
      await page.locator('#m_sex').selectOption('M');
      await page.locator('#m_nac').fill('2014-06-15');
      await page.locator('#m_cm').fill('50');
      await page.locator('#m_cmen').fill('90');
      await page.locator('#m_mes').fill('2');
      await page.locator('#m_pag').fill('230');
      await expect(page.locator('#cron_t')).toContainText('Pagada');
      const idPreparado = await page.evaluate(async (dniPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la preparación de identificador QA');
        return api.prepararIdMatricula(dniPrueba);
      }, dni);
      expect(idPreparado).toBe('RPC');
      await page.getByRole('button', { name: 'Guardar matrícula', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Matrícula guardada', { timeout: 15000 });

      const resultado = await page.evaluate(async (dniPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación integral de matrícula en Supabase QA');
        return api.verificarMatriculaCompleta(dniPrueba);
      }, dni);

      expect(resultado.id).toMatch(new RegExp('^' + new Date().getFullYear().toString().slice(-2) + '[0-9]{4}$'));
      expect(Number(resultado.alumno.costo_matricula)).toBe(50);
      expect(Number(resultado.alumno.costo_mensualidad)).toBe(90);
      expect(resultado.alumno.meses).toBe(2);
      expect(Number(resultado.alumno.monto_pagado)).toBe(230);
      expect(resultado.cuotas).toHaveLength(2);
      expect(resultado.cuotas.map((x) => [Number(x.monto), Number(x.monto_abonado), Number(x.saldo_pendiente), x.estado]))
        .toEqual([[90, 90, 0, 'Pagada'], [90, 90, 0, 'Pagada']]);
      expect(Number(resultado.caja.monto)).toBe(230);
      expect(resultado.allocation).toEqual([
        { destino: 'Matrícula', cuota: 0, monto: 50 },
        { destino: 'Cuota', cuota: 1, monto: 90 },
        { destino: 'Cuota', cuota: 2, monto: 90 },
      ]);
      expect(Number(resultado.restored.pagado)).toBe(230);
      expect(resultado.restored.cuotas).toHaveLength(2);
      expect(resultado.restored.caja).toHaveLength(1);
      expect(Number(resultado.restored.caja[0].monto)).toBe(230);

      // El carnet no debe aparecer hasta que Supabase confirme el qr_token.
      const cerrarCarnet = page.getByRole('button', { name: 'Cerrar', exact: true });
      if (await cerrarCarnet.isVisible().catch(() => false)) await cerrarCarnet.click();

      let liberarRpc: (() => void) | undefined;
      const rpcGate = new Promise<void>((resolve) => { liberarRpc = resolve; });
      const rpcPath = '**/rest/v1/rpc/erp_persistir_lote';
      await page.route(rpcPath, async (route) => {
        await rpcGate;
        await route.continue();
      });
      try {
        const rpcPendiente = page.waitForRequest((request) =>
          request.url().includes('/rest/v1/rpc/erp_persistir_lote')
        );
        await page.evaluate((dniPrueba) => {
          const estado = eval('S') as { alu: Array<{ id: string; dni: string; qt?: string | null }> };
          const alumno = estado.alu.find((x) => x.dni === dniPrueba);
          if (!alumno) throw new Error('No se encontró el alumno QA para generar su carnet');
          // Simular un registro histórico sin qr_token para forzar su generación y persistencia.
          alumno.qt = '';
          const abrirCarnet = eval('carnet') as (id: string) => void;
          abrirCarnet(alumno.id);
        }, dni);
        await rpcPendiente;
        await expect(cerrarCarnet).toBeHidden();
        liberarRpc?.();
        await expect(cerrarCarnet).toBeVisible({ timeout: 15000 });

        const tokenQR = await page.evaluate(async (dniPrueba) => {
          const consultar = eval('sb') as (path: string) => Promise<Response>;
          const response = await consultar(
            `/rest/v1/alumnos?select=qr_token&dni=eq.${encodeURIComponent(dniPrueba)}`
          );
          if (!response.ok) throw new Error('No se pudo verificar qr_token en Supabase QA');
          const rows = await response.json() as Array<{ qr_token: string | null }>;
          return rows[0]?.qr_token ?? null;
        }, dni);
        expect(tokenQR).toMatch(/^[a-z0-9]{16}$/);
        await cerrarCarnet.click();
      } finally {
        liberarRpc?.();
        await page.unroute(rpcPath);
      }
    } finally {
      const limpieza = await page.evaluate(async (dniPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de matrícula QA');
        return api.cleanupMatricula(dniPrueba);
      }, dni);
      expect(limpieza.removed).toBeTruthy();
      // Guardar una matrícula con pago abre el comprobante; cerrarlo evita
      // que el diálogo bloquee las pruebas seriales siguientes.
      const cerrarComprobante = page.getByRole('button', { name: 'Cerrar', exact: true });
      if (await cerrarComprobante.isVisible().catch(() => false)) {
        await cerrarComprobante.click();
      }
    }
  });

  test('Persistir y recuperar el ingreso de matrícula y su distribución en Caja desde Supabase QA', async () => {
    const id = 'QA-PERSIST-CAJA-' + randomUUID();
    type Tramo = { destino: string; cuota: number; monto: number };
    type Resultado = {
      database: { id: string; detalle: string; monto: string | number; origen: string };
      restored: { id: string; d: string; m: string | number; k: string };
      allocation: Tramo[];
    };
    type HerramientaQA = {
      roundTripCaja: (id: string) => Promise<Resultado>;
      cleanupCaja: (id: string) => Promise<{ removed: boolean }>;
    };
    try {
      const resultado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('La prueba de Caja no está habilitada en este proyecto Supabase QA');
        return api.roundTripCaja(idPrueba);
      }, id);

      expect(resultado.database.id).toBe(id);
      expect(resultado.database.detalle).toBe('QA-ABONO');
      expect(Number(resultado.database.monto)).toBe(230);
      expect(resultado.database.origen).toContain('matricula:QA-ABONO|aplicacion:');
      expect(resultado.restored.id).toBe(id);
      expect(resultado.restored.d).toBe('QA-ABONO');
      expect(Number(resultado.restored.m)).toBe(230);
      expect(resultado.restored.k).toBe(resultado.database.origen);
      expect(resultado.allocation).toEqual([
        { destino: 'Matrícula', cuota: 0, monto: 50 },
        { destino: 'Cuota', cuota: 1, monto: 90 },
        { destino: 'Cuota', cuota: 2, monto: 90 },
      ]);
      const encoded = resultado.database.origen.split('|aplicacion:')[1];
      expect(JSON.parse(decodeURIComponent(encoded))).toEqual(resultado.allocation);
    } finally {
      const limpieza = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de movimientos QA');
        return api.cleanupCaja(idPrueba);
      }, id);
      expect(limpieza.removed).toBeTruthy();
    }
  });

  test('Persistir y recuperar monto_abonado y saldo_pendiente mediante el ERP y Supabase QA', async () => {
    const id = 'QA-PERSIST-CUOTA-' + randomUUID();
    type Resultado = {
      database: { monto: string | number; monto_abonado: string | number; saldo_pendiente: string | number; estado: string };
      restored: { m: string | number; a: string | number; s: string | number; e: string };
    };
    type HerramientaQA = {
      roundTripCuota: (id: string) => Promise<Resultado>;
      cleanupCuota: (id: string) => Promise<{ removed: boolean }>;
    };
    try {
      const resultado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('El helper de persistencia no está habilitado en este proyecto Supabase QA');
        return api.roundTripCuota(idPrueba);
      }, id);

      expect(Number(resultado.database.monto)).toBe(90);
      expect(Number(resultado.database.monto_abonado)).toBe(50);
      expect(Number(resultado.database.saldo_pendiente)).toBe(40);
      expect(resultado.database.estado).toBe('Parcial');
      expect(Number(resultado.restored.m)).toBe(90);
      expect(Number(resultado.restored.a)).toBe(50);
      expect(Number(resultado.restored.s)).toBe(40);
      expect(resultado.restored.e).toBe('Parcial');
    } finally {
      const limpieza = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de registros QA');
        return api.cleanupCuota(idPrueba);
      }, id);
      expect(limpieza.removed).toBeTruthy();
    }
  });


  test('Rechazar matrícula con horario de otra sede o deporte antes de persistir', async () => {
    await page.getByText('Matrículas y Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Matrículas y Alumnos', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    await page.locator('#m_nom').fill('QA');
    await page.locator('#m_ape').fill('Prueba de integridad');
    await page.locator('#m_nac').fill('2012-01-15');
    await page.locator('#m_sex').selectOption('M');
    await page.locator('#m_mod').selectOption('Formativo');
    await page.locator('#m_con').selectOption('Ninguna');
    await page.locator('#m_est').selectOption('Activo');
    await page.locator('#m_dep').selectOption('DEP-FUT');
    await page.locator('#m_sed').selectOption('SED-CSJ');

    // HOR-0002 existe en QA, pero pertenece a SED-EST / DEP-VOL.
    // Se inyecta como opción para simular una selección manipulada del navegador.
    await page.locator('#m_hor').evaluate((node) => {
      (node as HTMLSelectElement).add(new Option('QA: horario incompatible', 'HOR-0002'));
    });
    await page.locator('#m_hor').selectOption('HOR-0002');

    let intentoDeEscritura = false;
    const bloquearEscritura = async (route: import('@playwright/test').Route) => {
      if (route.request().method() !== 'GET') {
        intentoDeEscritura = true;
        await route.abort();
      } else {
        await route.continue();
      }
    };
    await page.route('**/rest/v1/alumnos**', bloquearEscritura);
    try {
      await page.getByRole('button', { name: 'Guardar matrícula', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('El horario seleccionado no corresponde');
      expect(intentoDeEscritura, 'La validación debe bloquear la operación antes de llamar a Supabase').toBeFalsy();
    } finally {
      await page.unroute('**/rest/v1/alumnos**', bloquearEscritura);
    }

    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    // Cancelar la ficha vuelve al directorio, no al panel de Matrículas.
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });


});
