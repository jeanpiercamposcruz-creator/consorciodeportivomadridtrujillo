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
    await page.getByRole('button', { name: 'Directorio de Alumnos', exact: true }).click();
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

  test('Buscar alumnos sin modificar registros', async () => {
    // Volvemos al directorio desde el menú lateral; la búsqueda solo filtra la vista.
    await page.getByRole('button', { name: 'Directorio de Alumnos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    const filas = page.locator('#dt tbody tr');
    const buscador = page.getByPlaceholder('Ej. Luis, 71234567 o 260001', { exact: true });
    await expect(buscador).toHaveCount(1);
    await expect(buscador).toBeVisible();

    const cantidadInicial = await filas.count();
    expect(cantidadInicial).toBeGreaterThan(0);

    const erroresPagina: string[] = [];
    page.on('pageerror', (error) => erroresPagina.push(error.message));
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('[data-in="dirQ"]');
      const tabla = document.querySelector<HTMLElement>('#dt');
      const diag = { eventos: 0, mutaciones: 0, target: '', atributo: '', valor: '' };
      document.addEventListener('input', (event) => {
        diag.eventos++;
        diag.target = (event.target as HTMLElement)?.tagName || '';
        diag.atributo = (event.target as HTMLElement)?.getAttribute('data-in') || '';
        diag.valor = (event.target as HTMLInputElement)?.value || '';
      }, true);
      if (tabla) new MutationObserver(() => { diag.mutaciones++; })
        .observe(tabla, { childList: true, subtree: true });
      (window as typeof window & { __qaSearchDiagnostics?: typeof diag }).__qaSearchDiagnostics = diag;
      if (input) input.dataset.qaFound = 'yes';
    });

    await buscador.fill('QA_BUSQUEDA_SIN_RESULTADOS_938472');
    await expect(buscador).toHaveValue('QA_BUSQUEDA_SIN_RESULTADOS_938472');
    await page.waitForTimeout(150);
    const diagnostico = await page.evaluate(() => ({
      ...(window as typeof window & { __qaSearchDiagnostics?: {
        eventos: number; mutaciones: number; target: string; atributo: string; valor: string;
      } }).__qaSearchDiagnostics,
      inputEncontrado: document.querySelector('[data-in="dirQ"]')?.getAttribute('data-qa-found'),
      filas: document.querySelectorAll('#dt tbody tr').length,
    }));
    console.log('DIAGNÓSTICO BÚSQUEDA QA:', JSON.stringify({ diagnostico, erroresPagina }));
    await expect(filas).toHaveCount(0);

    await buscador.fill('');
    await expect(filas).toHaveCount(cantidadInicial);
    await expect(page.getByText('Buscar por nombre, DNI o código', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Sede')).toBeVisible();
    await expect(page.getByLabel('Deporte')).toBeVisible();
    await expect(page.getByLabel('Estado')).toBeVisible();
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
