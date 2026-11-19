
import { test, expect, Page } from '@playwright/test';

test.describe.serial('Pruebas funcionales del ERP Consorcio Deportivo', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const url = process.env.ERP_URL;
    const usuario = process.env.ERP_USER;
    const password = process.env.ERP_PASSWORD;

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

  test('Navegar al modulo de Sedes y Alquileres', async () => {
    await page.getByText('Sedes y Alquileres').click();

    await expect(page.getByText('Sedes y Alquileres'))
      .toBeVisible();
  });

  test('Navegar al modulo de Personal y Planillas', async () => {
    await page.getByText('Personal y Planillas').click();

    await expect(page.getByText('Personal y Planillas'))
      .toBeVisible();
  });
});
