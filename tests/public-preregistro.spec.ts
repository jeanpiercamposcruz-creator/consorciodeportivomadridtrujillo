import { test, expect } from '@playwright/test';

const url = process.env.ERP_URL;

test.skip(!url, 'La prueba pública requiere ERP_URL del Preview QA.');

test('limpia los documentos subidos si falla el guardado del pre-registro', async ({ browser }) => {
  const page = await browser.newPage();
  let uploadedPath = '';
  let uploadStatus = 0;

  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().includes('/storage/v1/object/documentos/')
    ) {
      const pathname = new URL(request.url()).pathname;
      uploadedPath = decodeURIComponent(
        pathname.split('/storage/v1/object/documentos/')[1] || '',
      );
    }
  });

  page.on('response', (response) => {
    if (
      response.request().method() === 'POST' &&
      response.url().includes('/storage/v1/object/documentos/')
    ) {
      uploadStatus = response.status();
    }
  });

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
    await expect(page.locator('#pp_dp option[value="DEP-FUT"]')).toHaveCount(1);
    await expect(page.locator('#pp_sd option[value="SED-CAN"]')).toHaveCount(1);

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

    const cleanupResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/functions/v1/preregistro-cleanup') &&
        response.request().method() === 'POST',
      { timeout: 20000 },
    );

    await page.getByRole('button', { name: 'Enviar pre-registro' }).click();

    const cleanupResponse = await cleanupResponsePromise;
    expect(uploadedPath).toMatch(/^preregistro\/[a-f0-9]{32}\/dni-\d{10,13}\.jpg$/);
    expect(uploadStatus).toBe(200);
    expect(cleanupResponse.status()).toBe(200);
    expect(await cleanupResponse.json()).toEqual({ deleted: 1 });
    await expect(page.locator('#toast')).toContainText('No se pudo enviar');
  } finally {
    await page.close();
  }
});


test('exige JWT y rechaza archivos fuera del patrón de pre-registro', async ({ browser }) => {
  const page = await browser.newPage();

  try {
    await page.goto(new URL('#prereg', url).toString(), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Pre-registro de alumno' })).toBeVisible();

    const result = await page.evaluate(async () => {
      const config = (
        window as unknown as {
          __ERP_CONFIG__?: { supabaseUrl: string; supabaseKey: string };
        }
      ).__ERP_CONFIG__;
      if (!config) throw new Error('No se cargó la configuración pública de Supabase');

      const endpoint = config.supabaseUrl.replace(/\/+$/, '') +
        '/functions/v1/preregistro-cleanup';
      const body = JSON.stringify({
        prefixes: ['preregistro/' + 'a'.repeat(32) + '/private.txt'],
      });

      const sinJwt = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const rutaNoPermitida = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: config.supabaseKey,
          Authorization: 'Bearer ' + config.supabaseKey,
          'Content-Type': 'application/json',
        },
        body,
      });

      return { sinJwt: sinJwt.status, rutaNoPermitida: rutaNoPermitida.status };
    });

    expect(result.sinJwt).toBe(401);
    expect(result.rutaNoPermitida).toBe(400);
  } finally {
    await page.close();
  }
});
