import { test, expect, type Page } from '@playwright/test';

const url = process.env.ERP_URL;

type Role = 'ADM' | 'REC' | 'ENT';

const ids = {
  ADM: '00000000-0000-4000-8000-000000000001',
  REC: '00000000-0000-4000-8000-000000000002',
  ENT: '00000000-0000-4000-8000-000000000003',
};

function loteQA(rol: string) {
  const personal = [
    { id: 'PER-ENT-01', nombres: 'Entrenador QA', rol: 'ENT', especialidad: 'Fútbol', activo: 1, foto: null },
    { id: 'PER-ENT-02', nombres: 'Otro Entrenador', rol: 'ENT', especialidad: 'Fútbol', activo: 1, foto: null },
  ];
  const horarios = rol === 'ENT' ? [
    { id: 'HOR-ENT-OWN', sede_id: 'SED-ENT', deporte_id: 'DEP-FUT', categoria: 2014, hora_inicio: '16:00', hora_fin: '17:00', dia_semana: 'Lunes', estado: 'Activo' },
    { id: 'HOR-ENT-OTHER', sede_id: 'SED-ENT', deporte_id: 'DEP-FUT', categoria: 2014, hora_inicio: '17:00', hora_fin: '18:00', dia_semana: 'Lunes', estado: 'Activo' },
  ] : [];
  const horarioProfesores = rol === 'ENT' ? [
    { id: 'HOR-ENT-OWN|PER-ENT-01', horario_id: 'HOR-ENT-OWN', personal_id: 'PER-ENT-01' },
    { id: 'HOR-ENT-OTHER|PER-ENT-02', horario_id: 'HOR-ENT-OTHER', personal_id: 'PER-ENT-02' },
  ] : [];
  return {
    centros_costo: [],
    sedes: rol === 'ENT' ? [
      { id: 'SED-ENT', nombre: 'Sede Entrenador QA', direccion: '', contacto: '', tipo_alquiler: 'Mensual', costo_mensual: 0, codigo_corto: 'ENT', centro_costo_id: null, estado: 'Activo' },
    ] : [],
    deportes: rol === 'ENT' ? [{ id: 'DEP-FUT', nombre: 'Fútbol' }] : [],
    contratos_alquiler: [],
    personal,
    personal_sedes: [],
    personal_certificaciones: [],
    horarios,
    horario_profesores: horarioProfesores,
    alumnos: [],
    cronograma_cuotas: [],
    asistencias: [],
    kits_ventas: [],
    caja_movimientos: [],
    ajustes: [{ id: 'fee', valor: 5 }],
  };
}

async function simularSesion(page: Page, rol: string, personalId: string | null = null) {
  const userId = ids[rol as Role] || '00000000-0000-4000-8000-000000000099';
  await page.route('**/auth/v1/token*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'qa-access-token',
        refresh_token: 'qa-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: userId, email: rol.toLowerCase() + '@qa.invalid' },
      }),
    });
  });
  await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/rest/v1/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/perfiles')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ rol, personal_id: personalId }]),
      });
    }
    if (requestUrl.pathname.endsWith('/personal')) {
      const id = requestUrl.searchParams.get('id');
      const rows = rol === 'ENT' && id === 'eq.' + personalId
        ? [{ id: personalId, nombres: 'Entrenador QA' }]
        : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (requestUrl.pathname.endsWith('/rpc/erp_obtener_lote')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(loteQA(rol)),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto(url!, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lu')).toBeVisible();
  await page.locator('#lu').fill(rol.toLowerCase() + '@qa.invalid');
  await page.locator('#lp').fill('qa-only-password');
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();
}

test.describe('Autorización de perfiles por rol', () => {
  test.skip(!url, 'Requiere ERP_URL; CI lo apunta al servidor local QA.');

  test('ADM conserva los módulos administrativos', async ({ page }) => {
    await simularSesion(page, 'ADM');
    await expect(page.getByRole('button', { name: 'Sedes y Alquileres', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dashboard Gerencial', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toma de Asistencias', exact: true })).toBeVisible();
  });

  test('REC entra con permisos de recepción sin obtener módulos administrativos', async ({ page }) => {
    await simularSesion(page, 'REC');
    await expect(page.getByRole('button', { name: 'Matrículas y Alumnos', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toma de Asistencias', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ventas de Indumentaria', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Caja Chica y Finanzas', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sedes y Alquileres', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Personal y Planillas', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dashboard Gerencial', exact: true })).toHaveCount(0);
  });

  test('ENT queda limitado a sus horarios y a su propio personal', async ({ page }) => {
    await simularSesion(page, 'ENT', 'PER-ENT-01');
    await expect(page.getByRole('button', { name: 'Toma de Asistencias', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Matrículas y Alumnos', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Caja Chica y Finanzas', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Toma de Asistencias', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Toma de Asistencias', exact: true })).toBeVisible();
    await page.locator('select[data-i="s"]').selectOption('SED-ENT');
    await page.locator('select[data-i="g"]').selectOption('DEP-FUT|2014');
    const horariosVisibles = await page.locator('select[data-i="h"] option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
    );
    expect(horariosVisibles).toEqual(['HOR-ENT-OWN']);
  });

  test('rechaza perfiles de entrenador sin vínculo de personal', async ({ page }) => {
    await simularSesion(page, 'ENT', null);
    await expect(page.locator('#toast')).toContainText('no está vinculado a un registro de personal');
    await expect(page.locator('#lu')).toBeVisible();
  });

  test('rechaza roles no autorizados aunque Auth emita un token', async ({ page }) => {
    await simularSesion(page, 'INVITADO');
    await expect(page.locator('#toast')).toContainText('no tiene permiso para entrar');
    await expect(page.locator('#lu')).toBeVisible();
  });
});
