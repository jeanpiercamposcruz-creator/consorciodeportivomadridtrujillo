import { expect, test } from '@playwright/test';

const url = process.env.ERP_URL;

test.describe('Coherencia del abono de hoy y el total pagado', () => {
  test.skip(!url, 'Requiere ERP_URL del Preview QA.');

  test('al editar inicia el abono de hoy en cero y sincroniza ambos importes', async ({ page }) => {
    const uid = '00000000-0000-4000-8000-000000000001';

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
          body: JSON.stringify({
            centros_costo: [],
            sedes: [{ id: 'SED-QA', nombre: 'Sede QA', direccion: '', contacto: '', tipo_alquiler: '', costo_mensual: 0, codigo_corto: 'QA', centro_costo_id: null, estado: 'Activo' }],
            deportes: [{ id: 'DEP-QA', nombre: 'Fútbol' }],
            contratos_alquiler: [],
            personal: [],
            personal_sedes: [],
            personal_certificaciones: [],
            horarios: [{ id: 'HOR-QA', sede_id: 'SED-QA', deporte_id: 'DEP-QA', categoria: 2014, estado: 'Activo', hora_inicio: '17:00', hora_fin: '18:00', dia_semana: 1 }],
            horario_profesores: [],
            alumnos: [{
              id: 'QA-ALU-01',
              nombres: 'QA',
              apellidos: 'PRUEBA',
              dni: '12345678',
              sexo: 'M',
              fecha_nacimiento: '2014-01-01',
              deporte_id: 'DEP-QA',
              sede_id: 'SED-QA',
              horario_id: 'HOR-QA',
              foto: null,
              seguro: null,
              apoderado: 'APODERADO QA',
              celular_apoderado: null,
              correo_apoderado: null,
              condicion: 'Ninguna',
              modalidad: 'Formativo',
              estado: 'Activo',
              costo_matricula: 50,
              costo_mensualidad: 90,
              meses: 2,
              monto_pagado: 100,
              fecha_registro: '2026-11-28',
              qr_token: null,
              doc_dni_frente: null,
              doc_dni_reverso: null,
              doc_seguro: null,
              doc_ficha: null,
              consentimiento_ley_29733: false,
              metodo_pago: 'Efectivo',
              monto_pagar_hoy: 0,
            }],
            cronograma_cuotas: [
              { id: 'QA-CUO-01', alumno_id: 'QA-ALU-01', numero_cuota: 1, fecha_vencimiento: '2026-12-01', monto: 90, monto_abonado: 50, saldo_pendiente: 40, estado: 'Parcial' },
              { id: 'QA-CUO-02', alumno_id: 'QA-ALU-01', numero_cuota: 2, fecha_vencimiento: '2027-01-01', monto: 90, monto_abonado: 0, saldo_pendiente: 90, estado: 'Pendiente' },
            ],
            asistencias: [],
            kits_ventas: [],
            caja_movimientos: [],
            ajustes: [{ id: 'fee', valor: 5 }],
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto(url!, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#lu')).toBeVisible();
    await page.locator('#lu').fill('adm@qa.invalid');
    await page.locator('#lp').fill('qa-only-password');
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    await page.getByRole('button', { name: 'Directorio de Alumnos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();

    await expect(page.locator('#m_pag')).toHaveValue('100');
    await expect(page.locator('#m_hoy')).toHaveValue('0');

    await page.locator('#m_hoy').fill('15');
    await expect(page.locator('#m_pag')).toHaveValue('115');

    await page.locator('#m_pag').fill('120');
    await expect(page.locator('#m_hoy')).toHaveValue('20');

    // La prueba solo modifica el formulario local y sale sin guardar.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });
});
