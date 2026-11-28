import { expect, test } from '@playwright/test';

const url = process.env.ERP_URL;

test.describe('Edición de personal legado sin alterar contrato', () => {
  test.skip(!url, 'Requiere ERP_URL del Preview QA.');

  test('permite cambiar teléfono y conserva nulos contractuales del registro legado', async ({ page }) => {
    const uid = '00000000-0000-4000-8000-000000000001';
    const lote: Record<string, any> = {
      centros_costo: [],
      sedes: [],
      deportes: [],
      contratos_alquiler: [],
      personal: [{
        id: 'PER-REC-0001',
        nombres: 'Caja Principal',
        dni: '00000002',
        telefono: null,
        especialidad: 'Recepción',
        rol: 'REC',
        precio_hora: 0,
        activo: 1,
        correo: null,
        fecha_fin: null,
        fecha_inicio: null,
        foto: null,
        jornada: null,
        permite_varias_sedes: false,
        sueldo_fijo: null,
        tipo_contrato: null,
      }],
      personal_sedes: [],
      personal_certificaciones: [],
      horarios: [],
      horario_profesores: [],
      alumnos: [],
      cronograma_cuotas: [],
      asistencias: [],
      kits_ventas: [],
      caja_movimientos: [],
      ajustes: [],
    };
    let payloadGuardado: any = null;

    await page.route('**/auth/v1/token*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'qa-access-token',
          refresh_token: 'qa-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          user: { id: uid, email: 'adm@qa.invalid' },
        }),
      });
    });
    await page.route('**/auth/v1/logout*', (route) =>
      route.fulfill({ status: 204, body: '' }),
    );
    await page.route('**/rest/v1/**', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.endsWith('/perfiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ rol: 'ADM' }]),
        });
      }
      if (requestUrl.pathname.endsWith('/rpc/erp_obtener_lote')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(lote),
        });
      }
      if (requestUrl.pathname.endsWith('/rpc/erp_persistir_lote')) {
        payloadGuardado = route.request().postDataJSON()?.p_payload;
        const personal = payloadGuardado?.find((x: any) => x.name === 'personal');
        const row = personal?.update?.find((x: any) => x.id === 'PER-REC-0001');
        if (row) { const target = lote.personal.find((x: any) => x.id === row.id); if (target) target.telefono = row.telefono; }
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto(url!, { waitUntil: 'domcontentloaded' });
    await page.locator('#lu').fill('adm@qa.invalid');
    await page.locator('#lp').fill('qa-only-password');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    await page.getByRole('button', { name: 'Personal y Planillas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
    const legacyRow = page.getByRole('row').filter({ hasText: 'PER-REC-0001' });
    await expect(legacyRow).toBeVisible();
    await legacyRow.getByRole('button', { name: 'Modificar', exact: true }).click();

    await expect(page.locator('#p_tc')).toHaveValue('');
    await expect(page.locator('#p_fi')).toHaveValue('');
    await page.locator('#p_t').fill('999888777');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

    await expect(page.getByText('Personal actualizado', { exact: true })).toBeVisible();
    expect(payloadGuardado).toBeTruthy();
    const row = payloadGuardado.find((x: any) => x.name === 'personal').update.find((x: any) => x.id === 'PER-REC-0001');
    expect(row.telefono).toBe('999888777');
    expect(row.tipo_contrato).toBeNull();
    expect(row.fecha_inicio).toBeNull();
    expect(row.fecha_fin).toBeNull();
  });
});
