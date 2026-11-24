import { test, expect, type Page } from '@playwright/test';

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

    page = await browser.newPage();
    await page.goto(url);

    await page.getByLabel('Usuario').fill(usuario);
    await page.locator('#lp').fill(password);
    await page.getByRole('button', { name: /Iniciar/i }).click();

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

  test('Consultar pagos y verificar importes sin modificar registros', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await page.locator('button[data-f="perTab"][data-i="p"]').click();
    await expect(page.getByRole('heading', { name: 'Pagos y liquidaciones de la semana', exact: true })).toBeVisible();

    const tabla = page.locator('table').last();
    await expect(tabla.getByText('Pago semana (horas)', { exact: true })).toBeVisible();
    await expect(tabla.getByText('Sueldo fijo (mensual)', { exact: true })).toBeVisible();
    const filas = tabla.locator('tr');
    expect(await filas.count()).toBeGreaterThan(1);

    const importes = await filas.nth(1).locator('td').evaluateAll((celdas) =>
      celdas.slice(3).map((celda) => celda.textContent?.trim() || '')
    );
    expect(importes.length).toBeGreaterThanOrEqual(4);
    expect(importes.every((valor) => /^(S\/\s*)?-?[\d,.]+$/.test(valor))).toBeTruthy();
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
    await page.locator('#c_i').fill('2026-11-24');
    await page.locator('#c_f').fill('2026-11-24');
    await page.locator('#c_m').fill('100');
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

  test('Rechazar movimiento de caja sin monto válido', async () => {
    await page.getByText('Caja Chica y Finanzas', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Registrar movimiento', exact: true })).toBeVisible();

    await page.locator('#c_m').fill('');
    await page.getByRole('button', { name: 'Registrar movimiento', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Monto inválido');
    await expect(page.getByRole('button', { name: 'Registrar movimiento', exact: true })).toBeVisible();
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

});
