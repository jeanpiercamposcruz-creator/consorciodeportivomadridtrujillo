import { test, expect, type Page } from '@playwright/test';

const url = process.env.ERP_URL;

async function simularSesion(page: Page, rol: string) {
  const userId = rol === 'ADM'
    ? '00000000-0000-4000-8000-000000000001'
    : '00000000-0000-4000-8000-000000000099';
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
        body: JSON.stringify([{ rol }]),
      });
    }
    if (requestUrl.pathname.endsWith('/rpc/erp_obtener_lote')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          centros_costo: [], sedes: [], deportes: [], contratos_alquiler: [],
          personal: [], personal_sedes: [], personal_certificaciones: [],
          horarios: [], horario_profesores: [], alumnos: [], cronograma_cuotas: [],
          asistencias: [], kits_ventas: [], caja_movimientos: [], ajustes: [],
        }),
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

test.describe('Acceso exclusivo de administradores', () => {
  test.skip(!url, 'Requiere ERP_URL; CI lo apunta al servidor local QA.');

  test('ADM entra y conserva los módulos administrativos', async ({ page }) => {
    await simularSesion(page, 'ADM');
    await expect(page.getByRole('button', { name: 'Sedes y Alquileres', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dashboard Gerencial', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toma de Asistencias', exact: true })).toBeVisible();
  });

  for (const rol of ['REC', 'ENT', 'INVITADO']) {
    test(`rechaza el rol ${rol} aunque Auth emita un token válido`, async ({ page }) => {
      await simularSesion(page, rol);
      await expect(page.locator('#toast')).toContainText('no tiene permiso para entrar');
      await expect(page.locator('#lu')).toBeVisible();
    });
  }
});
