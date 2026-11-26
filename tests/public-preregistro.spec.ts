import { test, expect } from '@playwright/test';

const url = process.env.ERP_URL;

test.skip(!url, 'La prueba pública requiere ERP_URL del Preview QA.');

test('limpia los documentos subidos si falla el guardado del pre-registro', async ({ browser }) => {
  const page = await browser.newPage();
  let uploadedPath = '';
  let deletedPaths: string[] = [];

  await page.route('**/rest/v1/catalogo_publico*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { tipo: 'D', id: 'DEP-FUT', nombre: 'Fútbol' },
        { tipo: 'S', id: 'SED-CAN', nombre: 'La Canchita' },
      ]),
    }),
  );

  await page.route('**/storage/v1/object/documentos/**', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const pathname = new URL(route.request().url()).pathname;
    uploadedPath = decodeURIComponent(pathname.split('/storage/v1/object/documentos/')[1] || '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/storage/v1/object/documentos', async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    const body = route.request().postDataJSON() as { prefixes?: string[] };
    deletedPaths = body.prefixes || [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/rest/v1/preregistros*', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Fallo simulado de persistencia QA' }),
    });
  });

  try {
    await page.goto(new URL('#prereg', url).toString(), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Pre-registro de alumno' })).toBeVisible();

    await page.locator('#pp_m').selectOption('Presencial');
    await page.locator('#pp_n').fill('QA TEMPORAL');
    await page.locator('#pp_a').fill('PRUEBA');
    await page.locator('#pp_d').fill('12345678');
    await page.locator('#pp_s').selectOption('M');
    await page.locator('#pp_f').fill('2016-01-01');
    await page.locator('#pp_dp').selectOption('DEP-FUT');
    await page.locator('#pp_sd').selectOption('SED-CAN');
    await page.locator('#pp_ap').fill('QA APODERADO');
    await page.locator('#pp_c').fill('987654321');
    await page.locator('#pp_e').fill('qa@example.com');
    await page.locator('#pp_dn').setInputFiles({
      name: 'dni-qa.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('contenido de prueba QA'),
    });

    await page.getByRole('button', { name: 'Enviar pre-registro' }).click();
    await expect.poll(() => deletedPaths.length).toBe(1);
    expect(uploadedPath).toMatch(/^preregistro\/[a-z0-9]+\/dni-\d+\.jpg$/);
    expect(deletedPaths).toEqual([uploadedPath]);
    await expect(page.locator('#toast')).toContainText('No se pudo enviar');
  } finally {
    await page.close();
  }
});
