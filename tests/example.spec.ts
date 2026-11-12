import { test, expect, Page } from '@playwright/test';

test.describe.serial('Pruebas funcionales del ERP Consorcio Deportivo', () => {
  let page: Page;

  // Se ejecuta UNA SOLA VEZ antes de todas las pruebas
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('https://consorciodeportivomadridtrujillo.vercel.app/');
    
    // Usuario con punto correcto
    await page.getByLabel('Usuario').fill('admin@cdmt.com');
    await page.locator('#lp').fill('fuerzagreen');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    // Esperar a que cargue el panel principal tras la autenticación
    await expect(page.getByText('Alumnos activos')).toBeVisible({ timeout: 20000 });
  });

  // Cerrar la página al finalizar el bloque de pruebas
  test.afterAll(async () => {
    await page.close();
  });

  test('Probar módulo de Alumnos activos', async () => {
    await expect(page.getByText('Alumnos activos')).toBeVisible();
  });

  test('Navegar al módulo de Sedes y Alquileres', async () => {
    await page.getByText('Sedes y Alquileres').click();
    // Aquí puedes añadir validaciones específicas de esta sección si lo deseas
  });

  test('Navegar al módulo de Personal y Planillas', async () => {
    await page.getByText('Personal y Planillas').click();
  });
});