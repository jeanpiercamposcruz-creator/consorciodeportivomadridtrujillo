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

  test('Navegar al modulo de Personal y Planillas', async () => {
    // El menú y el encabezado pueden compartir el mismo texto.
    await page.getByText('Personal y Planillas', { exact: true }).first().click();

    await expect(
      page.getByRole('heading', { name: 'Personal y Planillas', exact: true })
    ).toBeVisible();
  });
});
