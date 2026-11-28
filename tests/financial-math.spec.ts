import { expect, test } from '@playwright/test';

const url = process.env.ERP_URL;

type Cuota = { numero: number; abonado: number; saldo: number; estado: string };

test.describe('Lógica financiera de matrícula, cuotas y reversiones', () => {
  test.skip(!url, 'Requiere ERP_URL del Preview QA.');

  test.beforeEach(async ({ page }) => {
    await page.goto(url!, { waitUntil: 'networkidle' });
    await page.waitForFunction(() =>
      typeof (window as any).cronograma === 'function' &&
      typeof (window as any).distribuirAbonoMatricula === 'function' &&
      typeof (window as any).calcularReversionesCaja === 'function'
    );
  });

  test('distribuye S/100, S/190 y S/230 primero a matrícula y luego a cuotas', async ({ page }) => {
    const results = await page.evaluate(() => {
      const cron = (window as any).cronograma as (x: any) => any;
      return [100, 190, 230].map((pagado) => {
        const r = cron({ cm: 50, cmen: 90, mes: 2, pag: pagado, fecha: '2026-11-28' });
        return {
          matricula: r.matricula,
          cuotas: r.cuotas.map((q: any) => ({
            numero: q.n, abonado: q.a, saldo: q.s, estado: q.e,
          })),
        };
      });
    });

    expect(results[0]).toEqual({
      matricula: { m: 50, a: 50, s: 0 },
      cuotas: [
        { numero: 1, abonado: 50, saldo: 40, estado: 'Parcial' },
        { numero: 2, abonado: 0, saldo: 90, estado: 'Pendiente' },
      ],
    });
    expect(results[1].cuotas).toEqual([
      { numero: 1, abonado: 90, saldo: 0, estado: 'Pagada' },
      { numero: 2, abonado: 50, saldo: 40, estado: 'Parcial' },
    ]);
    expect(results[2].cuotas).toEqual([
      { numero: 1, abonado: 90, saldo: 0, estado: 'Pagada' },
      { numero: 2, abonado: 90, saldo: 0, estado: 'Pagada' },
    ]);
  });

  test('conserva el detalle de cada abono en orden y redondea a centavos', async ({ page }) => {
    const result = await page.evaluate(() => {
      const fn = (window as any).distribuirAbonoMatricula as
        (cm: number, cmen: number, meses: number, desde: number, hasta: number) => any[];
      return {
        primero: fn(50, 90, 2, 0, 100),
        segundo: fn(50, 90, 2, 100, 190),
        tercero: fn(50, 90, 2, 190, 230),
        centavos: fn(50, 90, 2, 0, 100.01),
        sinCambio: fn(50, 90, 2, 100, 100),
      };
    });

    expect(result.primero).toEqual([
      { destino: 'Matrícula', cuota: 0, monto: 50 },
      { destino: 'Cuota', cuota: 1, monto: 50 },
    ]);
    expect(result.segundo).toEqual([
      { destino: 'Cuota', cuota: 1, monto: 40 },
      { destino: 'Cuota', cuota: 2, monto: 50 },
    ]);
    expect(result.tercero).toEqual([{ destino: 'Cuota', cuota: 2, monto: 40 }]);
    expect(result.centavos).toEqual([
      { destino: 'Matrícula', cuota: 0, monto: 50 },
      { destino: 'Cuota', cuota: 1, monto: 50.01 },
    ]);
    expect(result.sinCambio).toEqual([]);
  });

  test('revierte primero el ingreso más reciente, respeta reversiones previas y no muta caja', async ({ page }) => {
    const result = await page.evaluate(() => {
      const fn = (window as any).calcularReversionesCaja as
        (caja: any[], alumnoId: string, importe: number) => any[];
      const caja = [
        { _id: 'ingreso-1', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 70 },
        { _id: 'ingreso-2', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 30 },
        { _id: 'reversa-previa', d: 'ALU-QA', t: 'E', k: 'reversion:ingreso-2', m: 20 },
      ];
      const before = JSON.stringify(caja);
      const parcial = fn(caja, 'ALU-QA', 40);
      const insuficiente = fn(caja, 'ALU-QA', 90);
      return { parcial, insuficiente, totalInsuficiente: insuficiente.reduce((s, x) => s + x.monto, 0), unchanged: JSON.stringify(caja) === before };
    });

    expect(result.parcial).toEqual([
      { originalId: 'ingreso-2', monto: 10 },
      { originalId: 'ingreso-1', monto: 30 },
    ]);
    expect(result.totalInsuficiente).toBe(80);
    expect(result.insuficiente.reduce((s, x) => s + x.monto, 0)).toBe(80);
    expect(result.unchanged).toBeTruthy();
  });
});
