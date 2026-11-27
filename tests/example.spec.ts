import { test, expect, type Page } from '@playwright/test';
import { randomInt, randomUUID } from 'node:crypto';

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

    const diagnosticos: string[] = [];
    page = await browser.newPage();
    page.on('pageerror', (e) => diagnosticos.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') diagnosticos.push('console: ' + m.text());
    });
    page.on('requestfailed', (r) =>
      diagnosticos.push('request: ' + r.url() + ' -> ' + (r.failure()?.errorText || 'falló'))
    );
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const app = document.querySelector('#app');
      const texto = app?.textContent || '';
      return texto.includes('Usuario') || texto.includes('No se pudo cargar') ||
        texto.includes('Error de configuración');
    }, null, { timeout: 30000 });

    const inicio = await page.locator('#app').innerText();
    if (!inicio.includes('Usuario')) {
      throw new Error('El ERP no terminó de iniciar. Pantalla: ' + inicio +
        '. Diagnóstico: ' + diagnosticos.join(' | '));
    }

    await page.locator('#lu').fill(usuario);
    await page.locator('#lp').fill(password);
    await page.getByRole('button', { name: /Iniciar sesión/i }).click();

    await expect(page.getByText('Alumnos activos'))
      .toBeVisible({ timeout: 20000 });
  });

  test.afterAll(async () => {
    await page?.close();
  });

  const cerrarDialogoResidual = async () => {
    const dialogo = page.getByRole('dialog');
    if (!(await dialogo.isVisible().catch(() => false))) return;
    const cerrar = dialogo.getByRole('button', { name: 'Cerrar', exact: true });
    if (await cerrar.isVisible().catch(() => false)) {
      await cerrar.click();
      await expect(dialogo).toBeHidden({ timeout: 5000 });
    }
  };

  // La navegación es idempotente: varias pruebas consecutivas pueden dejar
  // el ERP ya situado en el directorio, sin que exista un botón de navegación.
  const irDirectorio = async () => {
    const encabezado = page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true });
    if (!(await encabezado.isVisible().catch(() => false))) {
      // En un formulario el acceso lateral puede estar deshabilitado; prioriza
      // el botón visible de cancelar/salir y usa el menú solo si está habilitado.
      const salir = page.locator('button[data-i="dir"][data-f="go"]:visible').first();
      if (await salir.isVisible().catch(() => false) && await salir.isEnabled()) {
        await salir.click();
      } else {
        const acceso = page.locator('button[data-i="dir"][data-f="nav"]:visible').first();
        await expect(acceso).toBeVisible({ timeout: 10000 });
        await expect(acceso).toBeEnabled({ timeout: 10000 });
        await acceso.click();
      }
    }
    await expect(encabezado).toBeVisible({ timeout: 10000 });
  };

  test.beforeEach(async () => {
    await cerrarDialogoResidual();
  });

  test.afterEach(async () => {
    await cerrarDialogoResidual();
  });


  test('Probar modulo de Alumnos activos', async () => {
    await expect(page.getByText('Alumnos activos')).toBeVisible();
  });

  test('Validar formulario de nueva matrícula sin guardar datos', async () => {
    // El inicio es el dashboard. Entramos al módulo Directorio de Alumnos desde su acceso directo.
    await irDirectorio();
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

  test('Persistir matrícula, distribución de abonos y Caja en Supabase QA', async () => {
    test.setTimeout(90000);
    const dni = String(randomInt(10_000_000, 99_999_999));
    type ResultadoMatriculaQA = {
      alumno: { id: string; monto_pagado: number | string };
      cuotas: Array<{ numero_cuota: number; monto: number | string; monto_abonado: number | string; saldo_pendiente: number | string; estado: string }>;
      caja: { tipo: string; monto: number | string; origen: string };
      allocation: Array<{ destino: string; cuota: number; monto: number }>;
      restored: { pagado: number | string; cuotas: Array<{ n: number; abonado: number; saldo: number; estado: string }>; caja: Array<{ monto: number }> };
    };
    type HerramientaMatriculaQA = {
      prepararIdMatricula: (dni: string) => Promise<string>;
      verificarMatriculaCompleta: (dni: string) => Promise<ResultadoMatriculaQA>;
      cleanupMatricula: (dni: string) => Promise<{ removed: boolean }>;
    };
    try {
      const preparado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaMatriculaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está habilitada la herramienta de matrícula en Supabase QA.');
        return api.prepararIdMatricula(d);
      }, dni);
      expect(preparado).toBe('RPC');

      await irDirectorio();
      await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
      await page.getByRole('button', { name: /Nueva matrícula/i }).click();
      await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

      const anioNacimiento = new Date().getFullYear() - 10;
      await page.locator('#m_nom').fill('QA');
      await page.locator('#m_ape').fill('Persistencia');
      await page.locator('#m_dni').fill(dni);
      await page.locator('#m_nac').fill(anioNacimiento + '-06-15');
      await page.locator('#m_cm').fill('50');
      await page.locator('#m_cmen').fill('90');
      await page.locator('#m_mes').fill('2');
      await page.locator('#m_pag').fill('230');
      await page.locator('button[data-f="matPay"]').evaluate((element) => {
        const button = element as HTMLButtonElement;
        // Simula dos eventos de clic seguidos incluso si el primer evento ya deshabilitó el botón.
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await expect(page.locator('#toast')).toContainText('Matrícula guardada', { timeout: 20000 });

      const verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaMatriculaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de matrícula QA.');
        return api.verificarMatriculaCompleta(d);
      }, dni);
      expect(Number(verificado.alumno.monto_pagado)).toBe(230);
      expect(verificado.cuotas).toHaveLength(2);
      expect(verificado.cuotas.every((x) =>
        Number(x.monto) === 90 && Number(x.monto_abonado) === 90 &&
        Number(x.saldo_pendiente) === 0 && x.estado === 'Pagada'
      )).toBeTruthy();
      expect(verificado.caja.tipo).toBe('I');
      expect(Number(verificado.caja.monto)).toBe(230);
      expect(verificado.allocation).toEqual([
        { destino: 'Matrícula', cuota: 0, monto: 50 },
        { destino: 'Cuota', cuota: 1, monto: 90 },
        { destino: 'Cuota', cuota: 2, monto: 90 },
      ]);
      expect(Number(verificado.restored.pagado)).toBe(230);
      expect(verificado.restored.cuotas).toHaveLength(2);
      expect(verificado.restored.caja).toHaveLength(1);
    } finally {
      const limpieza = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaMatriculaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de matrícula QA.');
        return api.cleanupMatricula(d);
      }, dni);
      expect(limpieza.removed).toBe(true);
    }
  });

  test('Rechazar nombres inválidos sin guardar matrícula', async () => {
    await irDirectorio();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Nueva matrícula/i }).click();

    await page.locator('#m_nom').fill('123');
    await page.locator('#m_ape').fill('Prueba QA');
    await page.getByRole('button', { name: 'Guardar matrícula' }).click();

    await expect(page.locator('#toast')).toContainText('Nombres o apellidos inválidos');
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();
    await expect(page.locator('#m_nom')).toHaveValue('123');

    // Salimos sin guardar: la prueba no crea ni modifica alumnos.
    await irDirectorio();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });


  test('Rechazar fecha de nacimiento fuera de rango y monto de matrícula inválido', async () => {
    await irDirectorio();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Nueva matrícula/i }).click();
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    await page.locator('#m_nom').fill('Prueba');
    await page.locator('#m_ape').fill('QA');
    await page.locator('#m_nac').fill('1900-01-01');
    await page.getByRole('button', { name: 'Guardar matrícula', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Fecha de nacimiento fuera del rango');
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    await page.locator('#m_nac').fill('2016-01-01');
    await page.locator('#m_cm').fill('100000');
    await page.getByRole('button', { name: 'Guardar matrícula', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Monto inválido');
    await expect(page.locator('#m_cm')).toHaveValue('100000');

    // Un abono diario negativo nunca debe reducir el total pagado ni disparar una reversión.
    await page.locator('#m_cm').fill('50');
    await page.locator('#m_hoy').fill('-10');
    await expect(page.locator('#m_hoy')).toHaveValue('0');
    await expect(page.locator('#m_pag')).toHaveValue('0');
    await expect(page.locator('#toast')).toContainText('El monto a pagar hoy no puede ser negativo');

    // Cancelar descarta los datos inválidos; no se crea una matrícula ni un movimiento de caja.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });

  test('Rechazar DNI duplicado sin guardar matrícula', async () => {
    await irDirectorio();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    const dniExistente = await page.locator('#dt table tr').evaluateAll((rows) => {
      for (const row of rows.slice(1)) {
        const dni = row.querySelectorAll('td')[2]?.textContent?.trim() || '';
        if (/^\d{8}$/.test(dni)) return dni;
      }
      return '';
    });
    expect(dniExistente).toMatch(/^\d{8}$/);

    await page.getByRole('button', { name: /Nueva matrícula/i }).click();
    await page.locator('#m_nom').fill('Prueba');
    await page.locator('#m_ape').fill('QA');
    await page.locator('#m_dni').fill(dniExistente);
    await page.locator('#m_nac').fill('2011-06-15');
    await page.getByRole('button', { name: 'Guardar matrícula' }).click();

    await expect(page.locator('#toast')).toContainText('Ese DNI ya está registrado');
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    // Cancelar sale del formulario; no se crea ni modifica ningún registro.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });

  test('Filtrar alumnos por estado y restablecer filtros', async () => {
    await irDirectorio();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    const filas = page.locator('#dt table tr');
    const cantidadInicial = await filas.count();
    await page.getByLabel('Estado').selectOption('Activo');

    const estadosVisibles = await filas.evaluateAll((rows) =>
      rows.slice(1).map((row) => row.querySelectorAll('td')[7]?.textContent?.trim() || '')
        .filter(Boolean)
    );
    expect(estadosVisibles.length).toBeGreaterThan(0);
    expect(estadosVisibles.every((estado) => estado === 'Activo')).toBeTruthy();

    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(page.getByLabel('Estado')).toHaveValue('');
    await expect(filas).toHaveCount(cantidadInicial);
  });

  test('Buscar alumnos sin modificar registros', async () => {
    // Volvemos al directorio desde el menú lateral; la búsqueda solo filtra la vista.
    await irDirectorio();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    // La función tbl() coloca también el encabezado dentro de tbody; contamos todas las filas.
    const filasTabla = page.locator('#dt table tr');
    const buscador = page.getByPlaceholder('Ej. Luis, 71234567 o 260001', { exact: true });
    await expect(buscador).toHaveCount(1);
    await expect(buscador).toBeVisible();

    const cantidadInicial = await filasTabla.count();
    expect(cantidadInicial).toBeGreaterThan(2);

    await buscador.fill('QA_BUSQUEDA_SIN_RESULTADOS_938472');
    await expect(buscador).toHaveValue('QA_BUSQUEDA_SIN_RESULTADOS_938472');
    // Dos filas esperadas: encabezado y mensaje "Sin registros todavía".
    await expect(filasTabla).toHaveCount(2);
    await expect(page.getByText('Sin registros todavía.', { exact: true })).toBeVisible();

    await buscador.fill('');
    await expect(filasTabla).toHaveCount(cantidadInicial);
    await expect(page.getByText('Buscar por nombre, DNI o código', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Sede')).toBeVisible();
    await expect(page.getByLabel('Deporte')).toBeVisible();
    await expect(page.getByLabel('Estado')).toBeVisible();
  });

  test('Abrir ficha de alumno y cancelar sin guardar cambios', async () => {
    const encabezadoDirectorio = page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true });
    if (!(await encabezadoDirectorio.isVisible())) {
      await irDirectorio();
    }
    await expect(encabezadoDirectorio).toBeVisible();

    const primeraFila = page.locator('#dt table tr').nth(1);
    const codigo = (await primeraFila.locator('td').first().innerText()).trim();
    expect(codigo).not.toBe('');
    await primeraFila.getByRole('button', { name: 'Abrir', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Ficha ' + codigo, exact: false })).toBeVisible();
    await expect(page.locator('#m_nom')).toBeVisible();
    await expect(page.locator('#m_nom')).not.toHaveValue('');
    await expect(page.locator('#m_ape')).toBeVisible();
    await expect(page.locator('#m_ape')).not.toHaveValue('');
    await expect(page.locator('#m_dni')).toBeVisible();
    await expect(page.locator('#m_sed')).toBeVisible();
    await expect(page.locator('#m_dep')).toBeVisible();

    // Cancelar vuelve al directorio; no se pulsa Guardar matrícula.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });

  test('Navegar al modulo de Sedes y Alquileres', async () => {
    // El menú y el encabezado pueden compartir el mismo texto.
    // Selecciona la primera coincidencia para navegar y valida el encabezado por rol.
    await page.getByText('Sedes y Alquileres', { exact: true }).first().click();

    await expect(
      page.getByRole('heading', { name: 'Sedes y Alquileres', exact: true })
    ).toBeVisible();
  });

  test('Consultar sedes, buscar y revisar pestañas sin modificar datos', async () => {
    await page.getByText('Sedes y Alquileres', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Sedes y Alquileres', exact: true })).toBeVisible();

    const buscador = page.getByPlaceholder('Buscar por código, nombre o dirección...', { exact: true });
    const filas = page.locator('#sed_t table tr');
    await expect(buscador).toBeVisible();
    const cantidadInicial = await filas.count();
    expect(cantidadInicial).toBeGreaterThan(2);

    await buscador.fill('QA_SEDE_INEXISTENTE_9342');
    await expect(filas).toHaveCount(2);
    await expect(page.getByText('Sin registros todavía.', { exact: true })).toBeVisible();

    await buscador.fill('');
    await expect(filas).toHaveCount(cantidadInicial);

    await page.locator('button[data-f="sedTab"][data-i="c"]').click();
    await expect(page.getByRole('heading', { name: 'Nuevo contrato de alquiler', exact: true })).toBeVisible();

    await page.locator('button[data-f="sedTab"][data-i="k"]').click();
    await expect(page.getByRole('heading', { name: 'Nuevo centro de costo', exact: true })).toBeVisible();
  });

  test('Consultar personal, buscar y revisar pestañas sin modificar datos', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();

    const buscador = page.getByPlaceholder('Buscar por DNI, nombre, cargo o especialidad...', { exact: true });
    const filas = page.locator('#per_t table tr');
    await expect(buscador).toBeVisible();
    const cantidadInicial = await filas.count();
    expect(cantidadInicial).toBeGreaterThan(2);

    await buscador.fill('QA_PERSONAL_INEXISTENTE_9342');
    await expect(filas).toHaveCount(2);
    await expect(page.getByText('Sin registros todavía.', { exact: true })).toBeVisible();

    await buscador.fill('');
    await expect(filas).toHaveCount(cantidadInicial);

    await page.locator('button[data-f="perTab"][data-i="c"]').click();
    await expect(page.getByRole('heading', { name: 'Contratos del personal', exact: true })).toBeVisible();

    await page.locator('button[data-f="perTab"][data-i="p"]').click();
    await expect(page.getByRole('heading', { name: 'Pagos y liquidaciones de la semana', exact: true })).toBeVisible();
  });

  test('Crear, editar y recuperar contrato del personal desde Supabase QA', async () => {
    type ContratoEsperadoQA = {
      tipo: string;
      inicio: string;
      fin: string;
      precio: number;
      sueldo: number;
      jornada: string;
    };
    type DatosAsignacionPersonalQA = {
      personalId: string;
      sedeId: string;
      horarioId: string;
      horarioTemporalId: string;
      diaSemana: number;
      grupo: string;
      fecha: string;
      tarifa: number;
      horasHorario: number;
      sedeLinkId: string;
      horarioLinkId: string;
      asistenciaId: string;
    };
    type HerramientasContratoQA = {
      prepararPersonalContratoQA: (dni: string) => Promise<{ dni: string; preparado: boolean }>;
      verificarPersonalContratoQA: (
        dni: string,
        esperado: ContratoEsperadoQA
      ) => Promise<{ id: string; database: Record<string, unknown>; restored: Record<string, unknown> }>;
      asignarHorarioPersonalQA: (dni: string) => Promise<DatosAsignacionPersonalQA>;
      verificarAsistenciaPersonalQA: (
        datos: DatosAsignacionPersonalQA,
        asistio: boolean,
        recargar?: boolean
      ) => Promise<{ database: Record<string, unknown>; restored: Record<string, unknown> }>;
      cleanupPersonalContratoQA: (
        dni: string,
        extras?: DatosAsignacionPersonalQA | null
      ) => Promise<{ removed: boolean }>;
    };

    test.setTimeout(120000);
    const dni = String(randomInt(10000000, 99999999));
    const fechaInicio = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
    }).format(new Date());
    await page.evaluate(async (d) => {
      const api = (window as unknown as {
        __ERP_QA_PERSISTENCIA__?: HerramientasContratoQA;
      }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No están disponibles las herramientas QA de contratos.');
      return api.prepararPersonalContratoQA(d);
    }, dni);

    let asignacion: DatosAsignacionPersonalQA | null = null;
    try {
      await page.getByText('Personal y Planillas', { exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
      await page.locator('button[data-f="perTab"][data-i="d"]').click();
      await expect(page.locator('#p_d')).toBeVisible();

      await page.locator('#p_d').fill(dni);
      await page.locator('#p_n').fill('QA Contrato Temporal');
      await page.locator('#p_r').selectOption('ENT');
      await page.locator('#p_tc').selectOption('Planilla');
      await page.locator('#p_fi').fill(fechaInicio);
      await page.locator('#p_ff').fill('2030-12-31');
      await page.locator('#p_sf').fill('250.00');
      await page.locator('#p_p').fill('32.50');
      await page.locator('#p_j').selectOption('Tiempo parcial');
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Personal guardado');

      const inicial: ContratoEsperadoQA = {
        tipo: 'Planilla',
        inicio: fechaInicio,
        fin: '2030-12-31',
        precio: 32.5,
        sueldo: 250,
        jornada: 'Tiempo parcial',
      };
      const creado = await page.evaluate(async ({ d, esperado }) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientasContratoQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de contrato QA.');
        return api.verificarPersonalContratoQA(d, esperado);
      }, { d: dni, esperado: inicial });
      expect(creado.database.tipo_contrato).toBe('Planilla');
      expect(Number(creado.database.precio_hora)).toBe(32.5);
      expect(Number(creado.database.sueldo_fijo)).toBe(250);
      const personalId = String(creado.database.id);
      expect(personalId).toMatch(/^PER-ENT-/);

      await page.locator('#p_ff').fill('2031-12-31');
      await page.locator('#p_p').fill('34.75');
      await page.locator('#p_sf').fill('275.50');
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Personal actualizado');

      const actualizado: ContratoEsperadoQA = {
        ...inicial,
        fin: '2031-12-31',
        precio: 34.75,
        sueldo: 275.5,
      };
      const recuperado = await page.evaluate(async ({ d, esperado }) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientasContratoQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación del contrato actualizado.');
        return api.verificarPersonalContratoQA(d, esperado);
      }, { d: dni, esperado: actualizado });
      expect(recuperado.database.fecha_fin).toBe('2031-12-31');
      expect(Number(recuperado.database.precio_hora)).toBe(34.75);
      expect(Number(recuperado.database.sueldo_fijo)).toBe(275.5);

      await page.locator('button[data-f="perTab"][data-i="c"]').click();
      const filaContrato = page.locator('table').last().locator('tr')
        .filter({ hasText: personalId });
      await expect(filaContrato).toHaveCount(1);
      await expect(filaContrato).toContainText('2031-12-31');
      await expect(filaContrato).toContainText('34.75');
      await expect(filaContrato).toContainText('275.50');

      await page.locator('button[data-f="perTab"][data-i="p"]').click();
      const filaPago = page.locator('table').last().locator('tr')
        .filter({ hasText: personalId });
      await expect(filaPago).toHaveCount(1);
      await expect(filaPago).toContainText('34.75');
      await expect(filaPago).toContainText('275.50');

      asignacion = await page.evaluate(async (d) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientasContratoQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la asignación QA de horario.');
        return api.asignarHorarioPersonalQA(d);
      }, dni);

      await page.getByText('Toma de Asistencias', { exact: true }).first().click();
      await page.locator('select[data-ch="setA"][data-i="s"]').selectOption(asignacion.sedeId);
      await page.locator('select[data-ch="setA"][data-i="g"]').selectOption(asignacion.grupo);
      await page.locator('select[data-ch="setA"][data-i="h"]').selectOption(asignacion.horarioId);
      await page.locator('select[data-ch="setA"][data-i="t"]').selectOption('P');
      const marcarAsistencia = page.locator(
        `button[data-f="mkA"][data-i="P"][data-j="${asignacion.personalId}"][data-k="1"]`,
      );
      await expect(marcarAsistencia).toBeVisible();
      await marcarAsistencia.click();

      const asistenciaPersonal = await page.evaluate(async (d) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientasContratoQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de asistencia del personal.');
        return api.verificarAsistenciaPersonalQA(d, true, true);
      }, asignacion);
      expect(asistenciaPersonal.database.tipo).toBe('P');
      expect(asistenciaPersonal.database.asistio).toBe(true);

      await page.getByText('Personal y Planillas', { exact: true }).first().click();
      await page.locator('button[data-f="perTab"][data-i="p"]').click();
      const filaPagoAsistencia = page.locator('table').last().locator('tr')
        .filter({ hasText: personalId });
      await expect(filaPagoAsistencia).toHaveCount(1);
      const celdasPago = await filaPagoAsistencia.locator('td').allTextContents();
      const numero = (valor: string) => Number(valor.replace(/[^\d.-]/g, ''));
      const tarifa = numero(celdasPago[3] || '');
      const horas = numero(celdasPago[4] || '');
      const pago = numero(celdasPago[5] || '');
      const sueldo = numero(celdasPago[6] || '');
      expect(tarifa).toBeCloseTo(34.75, 2);
      expect(horas).toBeGreaterThan(0);
      expect(pago).toBeCloseTo(horas * tarifa, 2);
      expect(sueldo).toBeCloseTo(275.5, 2);
    } finally {
      const limpieza = await page.evaluate(async ({ d, extras }) => {
        const api = (window as unknown as {
          __ERP_QA_PERSISTENCIA__?: HerramientasContratoQA;
        }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza del contrato QA.');
        return api.cleanupPersonalContratoQA(d, extras);
      }, { d: dni, extras: asignacion });
      expect(limpieza.removed).toBe(true);
    }
  });

  test('Rechazar contrato con fecha de fin anterior al inicio sin guardar cambios', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
    await page.locator('button[data-f="perTab"][data-i="c"]').click();
    await expect(page.getByRole('heading', { name: 'Contratos del personal', exact: true })).toBeVisible();

    const filas = page.locator('table tr');
    expect(await filas.count()).toBeGreaterThan(1);
    await filas.nth(1).getByRole('button', { name: 'Modificar', exact: true }).click();

    await expect(page.locator('#p_fi')).toBeVisible();
    await expect(page.locator('#p_ff')).toBeVisible();
    // La fila elegida puede ser un registro histórico incompleto; fijamos un tipo
    // válido para que esta prueba aísle exclusivamente la validación del rango de fechas.
    await page.locator('#p_tc').selectOption('Planilla');
    await page.locator('#p_fi').fill('2026-11-24');
    await page.locator('#p_ff').fill('2026-11-23');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

    await expect(page.locator('#toast')).toContainText('La fecha de fin no puede ser anterior al inicio');
    await expect(page.locator('#p_fi')).toHaveValue('2026-11-24');
    await expect(page.locator('#p_ff')).toHaveValue('2026-11-23');
    await expect(page.getByRole('heading', { name: /Modificar PER-/ })).toBeVisible();

    // Cancelar descarta los valores inválidos; no se persiste ningún cambio.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
  });


  test('Rechazar tarifa o sueldo fijo inválido en contrato del personal', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
    await page.locator('button[data-f="perTab"][data-i="d"]').click();

    const fila = page.locator('table tr').nth(1);
    await expect(fila).toBeVisible();
    await fila.getByRole('button', { name: 'Modificar', exact: true }).click();
    await expect(page.locator('#p_p')).toBeVisible();
    await expect(page.locator('#p_sf')).toBeVisible();

    await page.locator('#p_p').fill('-1');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Tarifa o sueldo fijo inválido');
    await expect(page.locator('#p_p')).toHaveValue('-1');

    for (const importe of ['100000', '1.234']) {
      await page.locator('#p_p').fill(importe);
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Tarifa o sueldo fijo inválido');
      await expect(page.locator('#p_p')).toHaveValue(importe);
    }

    // Cancelar descarta los valores inválidos; no se actualiza el contrato existente.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
  });

  test('Consultar pagos y verificar importes sin modificar registros', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await page.locator('button[data-f="perTab"][data-i="p"]').click();
    await expect(page.getByRole('heading', { name: 'Pagos y liquidaciones de la semana', exact: true })).toBeVisible();

    const tabla = page.locator('table').last();
    await expect(tabla.getByText('Pago semana (horas)', { exact: true })).toBeVisible();
    await expect(tabla.getByText('Sueldo fijo (mensual)', { exact: true })).toBeVisible();
    const filas = tabla.locator('tr');
    expect(await filas.count()).toBeGreaterThan(1);

    const datosPago = await filas.evaluateAll((rows) =>
      rows.slice(1).map((row) =>
        Array.from(row.querySelectorAll('td')).slice(3, 6).map((cell) => cell.textContent?.trim() || '')
      )
    );
    expect(datosPago.length).toBeGreaterThan(0);
    const numero = (valor: string) => Number(valor.replace(/[^\d.-]/g, ''));
    for (const [tarifaTexto, horasTexto, pagoTexto] of datosPago) {
      const tarifa = numero(tarifaTexto);
      const horas = numero(horasTexto);
      const pago = numero(pagoTexto);
      expect(Number.isFinite(tarifa)).toBeTruthy();
      expect(Number.isFinite(horas)).toBeTruthy();
      expect(Number.isFinite(pago)).toBeTruthy();
      expect(Math.abs(pago - Math.round(tarifa * horas * 100) / 100)).toBeLessThanOrEqual(0.011);
    }
    await expect(page.getByText(/Total pago por horas de la semana:/)).toBeVisible();
    await expect(page.getByText(/Sueldos fijos mensuales:/)).toBeVisible();
  });


  test('Rechazar contrato de alquiler con fechas inválidas y enlace inseguro', async () => {
    await page.getByText('Sedes y Alquileres', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Sedes y Alquileres', exact: true })).toBeVisible();
    await page.locator('button[data-f="sedTab"][data-i="c"]').click();
    await expect(page.getByRole('heading', { name: 'Nuevo contrato de alquiler', exact: true })).toBeVisible();

    await expect(page.locator('#c_s')).toBeVisible();
    expect(await page.locator('#c_s option').count()).toBeGreaterThan(0);
    const fechas = await page.evaluate(() => {
      const iso = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
      };
      const inicio = new Date();
      inicio.setDate(inicio.getDate() + 1);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 1);
      return { inicio: iso(inicio), fin: iso(fin) };
    });

    await page.locator('#c_i').fill('');
    await page.locator('#c_f').fill('');
    await page.locator('#c_m').fill('100');
    await page.getByRole('button', { name: 'Guardar contrato', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Las fechas de inicio y fin son obligatorias');

    await page.locator('#c_i').fill(fechas.inicio);
    await page.locator('#c_f').fill(fechas.fin);
    await page.locator('#c_m').fill('0');
    await page.getByRole('button', { name: 'Guardar contrato', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Monto mensual inválido');

    for (const importe of ['100000', '100.001']) {
      await page.locator('#c_m').fill(importe);
      await page.getByRole('button', { name: 'Guardar contrato', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Monto mensual inválido');
      await expect(page.locator('#c_m')).toHaveValue(importe);
    }

    await page.locator('#c_m').fill('100');
    await page.locator('#c_i').fill(fechas.inicio);
    await page.locator('#c_f').fill(fechas.inicio);
    await page.getByRole('button', { name: 'Guardar contrato', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('La fecha de fin debe ser posterior al inicio');
    await expect(page.getByRole('heading', { name: 'Nuevo contrato de alquiler', exact: true })).toBeVisible();

    await page.locator('#c_i').fill(fechas.inicio);
    await page.locator('#c_f').fill(fechas.fin);
    await page.locator('#c_u').fill('javascript:alert(1)');
    await expect(page.locator('#c_i')).toHaveValue(fechas.inicio);
    await expect(page.locator('#c_f')).toHaveValue(fechas.fin);
    await page.getByRole('button', { name: 'Guardar contrato', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('El enlace debe empezar con http:// o https://');
    await expect(page.locator('#c_u')).toHaveValue('javascript:alert(1)');
  });

  test('Rechazar código inválido de centro de costo sin guardar', async () => {
    await page.getByText('Sedes y Alquileres', { exact: true }).first().click();
    await page.locator('button[data-f="sedTab"][data-i="k"]').click();
    await expect(page.getByRole('heading', { name: 'Nuevo centro de costo', exact: true })).toBeVisible();

    await page.locator('#k_c').fill('X');
    await page.locator('#k_n').fill('Centro QA temporal');
    await page.getByRole('button', { name: 'Guardar centro de costo', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Código: 2 a 12 letras, números o guiones');
    await expect(page.locator('#k_c')).toHaveValue('X');
    await expect(page.getByRole('heading', { name: 'Nuevo centro de costo', exact: true })).toBeVisible();
  });


  test('Rechazar horarios incompletos o con horas inválidas sin guardar', async () => {
    await page.getByText('Horarios y Categorías', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();

    await expect(page.locator('#h_s')).toBeVisible();
    await expect(page.locator('#h_d')).toBeVisible();
    expect(await page.locator('#h_s option').count()).toBeGreaterThan(0);
    expect(await page.locator('#h_d option').count()).toBeGreaterThan(0);
    expect(await page.locator('#h_c input[type="checkbox"]').count()).toBeGreaterThan(0);

    const guardar = page.getByRole('button', { name: 'Guardar horario', exact: true });
    await guardar.click();
    await expect(page.locator('#toast')).toContainText('Elige al menos una categoría');

    await page.locator('#h_c input[type="checkbox"]').first().check();
    await guardar.click();
    await expect(page.locator('#toast')).toContainText('Elige al menos un día');

    await page.locator('.h_dia').first().check();
    await page.locator('#h_i').fill('18:00');
    await page.locator('#h_f').fill('18:00');
    await guardar.click();
    await expect(page.locator('#toast')).toContainText('La hora de fin debe ser posterior');

    await page.locator('#h_i').fill('16:00');
    await page.locator('#h_f').fill('18:00');
    await guardar.click();
    await expect(page.locator('#toast')).toContainText('Asigna al menos un profesor');
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();
  });


  test('Persistir, recuperar, revertir y volver a pagar asistencia de campo en Supabase QA', async () => {
    type DatosAsistenciaQA = {
      alumnoId: string;
      alumnoDni: string;
      horarioId: string;
      sedeId: string;
      grupo: string;
      fecha: string;
      fee: number;
      feeOriginal: number;
      asistenciaId: string;
      cajaId: string;
    };
    type ResultadoAsistenciaQA = {
      asistencia: { asistio: boolean; pago_campo: boolean | null; pago_campo_movimiento_id: string | null };
      caja: Array<{ id: string; monto: number | string; origen: string }>;
      reversion: Array<{ id: string; monto: number | string; origen: string }>;
      currentCajaId: string | null;
      restored: { asistio: boolean; pagoCampo: boolean | undefined; caja: number; currentCajaId: string | null };
    };
    type HerramientaAsistenciaQA = {
      prepararAsistenciaQA: () => Promise<DatosAsistenciaQA>;
      verificarAsistenciaQA: (
        datos: DatosAsistenciaQA,
        asistio: boolean,
        pagoCampo: boolean | null,
        recargar?: boolean
      ) => Promise<ResultadoAsistenciaQA>;
      cleanupAsistenciaQA: (datos: DatosAsistenciaQA) => Promise<{ removed: boolean; feeRestored: number }>;
    };

    test.setTimeout(120000);
    const dialogo = page.getByRole('dialog');
    const cerrarComprobante = async () => {
      if (await dialogo.isVisible().catch(() => false)) {
        const cerrar = dialogo.getByRole('button', { name: 'Cerrar', exact: true });
        await expect(cerrar).toBeVisible();
        await cerrar.click();
        await expect(dialogo).toBeHidden();
      }
    };
    await cerrarComprobante();
    // Prueba negativa: un identificador que no sea inequívocamente QA debe
    // rechazarse antes de consultar o borrar cualquier registro.
    const rechazoLimpiezaReal = await page.evaluate(async () => {
      const api = (window as unknown as {
        __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA;
      }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No está habilitada la limpieza QA.');
      try {
        await api.cleanupAsistenciaQA({
          alumnoId: 'REAL-STUDENT-NO-DELETE',
          alumnoDni: '12345678',
          horarioId: 'NO-TOCAR',
          sedeId: 'NO-TOCAR',
          grupo: 'NO-TOCAR|0',
          fecha: '2026-11-27',
          fee: 5,
          feeOriginal: 5,
          asistenciaId: '00000000-0000-4000-8000-000000000001',
          cajaId: '00000000-0000-4000-8000-000000000002',
        });
        return '';
      } catch (error) {
        return String(error);
      }
    });
    expect(rechazoLimpiezaReal).toContain('IDs temporales de asistencia o tarifa original inválidos');

    const datos = await page.evaluate(async () => {
      const api = (window as unknown as {
        __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA;
      }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No está habilitada la prueba de asistencia en Supabase QA.');
      return api.prepararAsistenciaQA();
    });
    try {
      await page.getByText('Toma de Asistencias', { exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'Toma de Asistencias', exact: true })).toBeVisible();
      await page.locator('select[data-ch="setA"][data-i="s"]').selectOption(datos.sedeId);
      await page.locator('select[data-ch="setA"][data-i="g"]').selectOption(datos.grupo);
      await page.locator('select[data-ch="setA"][data-i="h"]').selectOption(datos.horarioId);
      await page.locator('select[data-ch="setA"][data-i="t"]').selectOption('A');

      const asistio = page.locator(
        'button[data-f="mkA"][data-i="A"][data-j="' + datos.alumnoId + '"][data-k="1"]'
      );
      const pago = page.locator('button[data-f="mkP"][data-i="' + datos.alumnoId + '"][data-j="1"]');
      const debe = page.locator('button[data-f="mkP"][data-i="' + datos.alumnoId + '"][data-j="0"]');
      const tarifaCampo = page.locator('input[data-ch="setFee"]');

      await expect(asistio).toBeVisible();
      await asistio.click();
      let verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de asistencia QA.');
        return api.verificarAsistenciaQA(d, true, null);
      }, datos);
      expect(verificado.asistencia.asistio).toBe(true);
      expect(verificado.asistencia.pago_campo).toBeNull();

      // Primero se prueba la tarifa cero: liquida la asistencia sin inventar un ingreso de Caja.
      if (datos.fee !== 0) {
        await tarifaCampo.fill('0');
        await tarifaCampo.press('Tab');
      }
      datos.fee = 0;
      await expect(pago).toHaveText('Sin costo');
      await pago.click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación del estado sin costo.');
        return api.verificarAsistenciaQA(d, true, true);
      }, datos);
      expect(verificado.caja).toHaveLength(0);
      expect(verificado.reversion).toHaveLength(0);
      expect(verificado.currentCajaId).toBeNull();

      await debe.click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación del estado pendiente.');
        return api.verificarAsistenciaQA(d, true, false);
      }, datos);
      expect(verificado.caja).toHaveLength(0);

      // Se configura una tarifa temporal positiva para probar ingreso, reversión y re-pago reales.
      await tarifaCampo.fill('5');
      await tarifaCampo.press('Tab');
      datos.fee = 5;
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de la tarifa temporal.');
        return api.verificarAsistenciaQA(d, true, false, true);
      }, datos);
      expect(verificado.caja).toHaveLength(0);

      await tarifaCampo.fill('-1');
      await tarifaCampo.press('Tab');
      await expect(page.locator('#toast')).toContainText('importe válido no negativo');
      await expect(tarifaCampo).toHaveValue('5');

      await pago.click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación del pago QA.');
        return api.verificarAsistenciaQA(d, true, true);
      }, datos);
      expect(verificado.caja).toHaveLength(1);
      expect(verificado.reversion).toHaveLength(0);
      expect(verificado.currentCajaId).toBe(datos.cajaId);
      expect(Number(verificado.caja[0].monto)).toBe(5);
      // El pago abre el comprobante modal; cerrarlo antes de interactuar con la tabla.
      await cerrarComprobante();

      await debe.click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de reversión QA.');
        return api.verificarAsistenciaQA(d, true, false);
      }, datos);
      expect(verificado.caja).toHaveLength(1);
      expect(verificado.reversion).toHaveLength(1);
      expect(verificado.reversion[0].origen).toBe('reversion-campo:' + datos.cajaId);
      expect(Number(verificado.reversion[0].monto)).toBe(5);
      expect(verificado.currentCajaId).toBeNull();

      // Un nuevo pago crea otro ingreso y conserva el primero junto con su reversión.
      await pago.click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación del re-pago QA.');
        return api.verificarAsistenciaQA(d, true, true);
      }, datos);
      expect(verificado.caja).toHaveLength(2);
      expect(verificado.reversion).toHaveLength(1);
      expect(verificado.currentCajaId).not.toBe(datos.cajaId);
      expect(verificado.restored.caja).toBe(3);
      await cerrarComprobante();

      await debe.click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de la segunda reversión QA.');
        return api.verificarAsistenciaQA(d, true, false);
      }, datos);
      expect(verificado.caja).toHaveLength(2);
      expect(verificado.reversion).toHaveLength(2);
      expect(verificado.restored.caja).toBe(4);

      await page.locator(
        'button[data-f="mkA"][data-i="A"][data-j="' + datos.alumnoId + '"][data-k="0"]'
      ).click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación del cambio de asistencia QA.');
        return api.verificarAsistenciaQA(d, false, false);
      }, datos);
      expect(verificado.asistencia.asistio).toBe(false);

      await asistio.click();
      verificado = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación final de asistencia QA.');
        return api.verificarAsistenciaQA(d, true, false, true);
      }, datos);
      expect(verificado.asistencia.asistio).toBe(true);
      expect(verificado.asistencia.pago_campo).toBe(false);
    } finally {
      const limpieza = await page.evaluate(async (d) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAsistenciaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza de asistencia QA.');
        return api.cleanupAsistenciaQA(d);
      }, datos);
      expect(limpieza.removed).toBe(true);
      expect(limpieza.feeRestored).toBe(datos.feeOriginal);
    }
  });

  test('Consultar filtros de asistencia sin marcar ni registrar pagos', async () => {
    await page.getByText('Toma de Asistencias', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Toma de Asistencias', exact: true })).toBeVisible();

    const sede = page.locator('select[data-ch="setA"][data-i="s"]');
    await expect(sede).toBeVisible();
    expect(await sede.locator('option').count()).toBeGreaterThan(1);
    await sede.selectOption({ index: 1 });

    const grupo = page.locator('select[data-ch="setA"][data-i="g"]');
    await expect(grupo).toBeVisible();
    expect(await grupo.locator('option').count()).toBeGreaterThan(1);
    await grupo.selectOption({ index: 1 });

    const hora = page.locator('select[data-ch="setA"][data-i="h"]');
    await expect(hora).toBeVisible();
    expect(await hora.locator('option').count()).toBeGreaterThan(1);
    await hora.selectOption({ index: 1 });

    const tipo = page.locator('select[data-ch="setA"][data-i="t"]');
    await expect(tipo).toBeVisible();
    await tipo.selectOption('A');

    await expect(page.getByText('Completa los 4 filtros para ver la lista.', { exact: true })).toHaveCount(0);
    await expect(page.locator('table')).toBeVisible();

    // Cambiar la sede debe limpiar los filtros dependientes y evitar una lista desactualizada.
    if (await sede.locator('option').count() > 2) {
      await sede.selectOption({ index: 2 });
      await expect(grupo).toHaveValue('');
      await expect(hora).toHaveValue('');
      await expect(page.getByText('Completa los 4 filtros para ver la lista.', { exact: true })).toBeVisible();
    }

    // Esta consulta solo cambia filtros; no pulsa Asistió, Faltó, Pagó ni Debe.
  });


  test('Rechazar venta de indumentaria sin alumno seleccionado', async () => {
    await page.getByText('Ventas de Indumentaria', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();

    await expect(page.locator('#k_a')).toHaveValue('');
    await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Elige un alumno');
    await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();
  });


  test('Rechazar venta con precio o costo fuera de rango sin registrar', async () => {
    await page.getByText('Ventas de Indumentaria', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();

    await irDirectorio();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    const codigoAlumno = (await page.locator('#dt table tr').nth(1).locator('td').first().innerText()).trim();

    await page.getByText('Ventas de Indumentaria', { exact: true }).first().click();
    await page.locator('#k_q').fill(codigoAlumno);
    const resultado = page.locator('#k_res button').first();
    await expect(resultado).toBeVisible();
    await resultado.click();
    await expect(page.locator('#k_a')).toHaveValue(codigoAlumno);

    await page.locator('#k_pr').fill('100000');
    await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Precio o costo inválido');
    await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();
    // La validación termina antes de insertar la venta o su ingreso automático en caja.
  });

  test('No mostrar éxito ni conservar una venta cuando Supabase rechaza su persistencia', async () => {
    const id = 'QA-KIT-' + randomInt(1_000_000_000_000, 9_999_999_999_999);
    type HerramientaKit = {
      prepararIdKit: (id: string) => Promise<string>;
      verificarAusenciaKit: (id: string) => Promise<{ kits: number; caja: number }>;
      cleanupKit: (id: string) => Promise<{ removed: boolean }>;
    };
    try {
      await irDirectorio();
      await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
      const codigoAlumno = (await page.locator('#dt table tr').nth(1).locator('td').first().innerText()).trim();

      await page.getByText('Ventas de Indumentaria', { exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();
      const preparado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está habilitada la preparación de ventas QA.');
        return api.prepararIdKit(idPrueba);
      }, id);
      expect(preparado).toBe(id);

      await page.locator('#k_q').fill(codigoAlumno);
      const resultado = page.locator('#k_res button').first();
      await expect(resultado).toBeVisible();
      await resultado.click();
      await page.locator('#k_pr').fill('75');
      await page.locator('#k_c').fill('35');

      const rpcPath = '**/rest/v1/rpc/erp_persistir_lote';
      let intentos = 0;
      const bloquear = async (route: import('@playwright/test').Route) => {
        intentos++;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'QA500', message: 'Fallo inducido de persistencia QA' }),
        });
      };
      await page.route(rpcPath, bloquear);
      try {
        await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
        await expect(page.locator('#toast')).toContainText('No se pudo guardar');
        expect(intentos).toBe(1);
        await expect(page.locator('#toast')).not.toContainText('Venta registrada');

        const estado = await page.evaluate(async (idPrueba) => {
          const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
          if (!api) throw new Error('No está habilitada la verificación autenticada de ventas QA.');
          return api.verificarAusenciaKit(idPrueba);
        }, id);
        expect(estado).toEqual({ kits: 0, caja: 0 });
      } finally {
        await page.unroute(rpcPath, bloquear);
      }
    } finally {
      const limpieza = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de la venta QA.');
        return api.cleanupKit(idPrueba);
      }, id);
      expect(limpieza.removed).toBeTruthy();
    }
  });

  test('Personal excluye asistencias futuras de las horas semanales', async () => {
    type DiagnosticoPersonalQA = {
      probarHorasFuturasQA: () => { hoy: string; fecha: string; diferencia: number };
    };
    const resultado = await page.evaluate(() => {
      const api = (window as unknown as { __ERP_QA_PERSONAL__?: DiagnosticoPersonalQA }).__ERP_QA_PERSONAL__;
      if (!api) throw new Error('No está habilitada la prueba de horas semanales QA.');
      return api.probarHorasFuturasQA();
    });
    expect(resultado.fecha > resultado.hoy).toBeTruthy();
    expect(resultado.diferencia).toBeCloseTo(0, 2);
  });

  test('Dashboard gerencial excluye asistencias futuras de planilla', async () => {
    type DiagnosticoGerencialQA = {
      probarPlanillaFuturaQA: () => { hoy: string; fecha: string; diferencia: number };
    };
    const resultado = await page.evaluate(() => {
      const api = (window as unknown as { __ERP_QA_GERENCIAL__?: DiagnosticoGerencialQA }).__ERP_QA_GERENCIAL__;
      if (!api) throw new Error('No está habilitada la prueba gerencial QA.');
      return api.probarPlanillaFuturaQA();
    });
    expect(resultado.fecha > resultado.hoy).toBeTruthy();
    expect(resultado.diferencia).toBeCloseTo(0, 2);
  });

  test('Dashboard excluye asistencias futuras del cálculo de planilla', async () => {
    type DiagnosticoDashboardQA = {
      probarAsistenciaFuturaQA: () => { hoy: string; fecha: string; antes: number; despues: number; diferencia: number };
    };
    const resultado = await page.evaluate(() => {
      const api = (window as unknown as { __ERP_QA_DASHBOARD__?: DiagnosticoDashboardQA }).__ERP_QA_DASHBOARD__;
      if (!api) throw new Error('No está habilitada la prueba de cálculo del dashboard QA.');
      return api.probarAsistenciaFuturaQA();
    });
    expect(resultado.fecha > resultado.hoy).toBeTruthy();
    expect(resultado.diferencia).toBeCloseTo(0, 2);
  });

  test('Dashboard no duplica alquiler ni planilla dentro de otros egresos', async () => {
    type HerramientaDashboard = {
      probarDashboardSinDobleConteo: () => Promise<{ deltaOtrosEgresos: number; deltaUtilidad: number }>;
    };
    const resultado = await page.evaluate(async () => {
      const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaDashboard }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No está disponible la prueba financiera QA.');
      return api.probarDashboardSinDobleConteo();
    });
    expect(resultado.deltaOtrosEgresos).toBe(50);
    expect(resultado.deltaUtilidad).toBe(-50);
  });


  test('Revertir todas las tablas cuando falla una escritura del lote ERP', async () => {
    type HerramientaAtomica = {
      probarRollbackLote: () => Promise<{ rejected: boolean; rollback: boolean; residual: number }>;
    };
    const resultado = await page.evaluate(async () => {
      const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaAtomica }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No está disponible la prueba de atomicidad QA.');
      return api.probarRollbackLote();
    });
    expect(resultado.rejected).toBeTruthy();
    expect(resultado.rollback).toBeTruthy();
    expect(resultado.residual).toBe(0);
  });


  test('Mantener la trazabilidad de Caja al crear, editar y anular una venta de indumentaria', async () => {
    const id = 'QA-KIT-' + randomInt(1_000_000_000_000, 9_999_999_999_999);
    type ResultadoKit = {
      database: {
        kits: Array<{ id: string; precio_publico: string | number; alumno_id: string; estado: string }>;
        caja: Array<{ id: string; origen: string; monto: string | number; detalle: string; tipo: string; concepto: string }>;
        reversas: Array<{ id: string; origen: string; monto: string | number; detalle: string; tipo: string; concepto: string }>;
      };
      restored: {
        kit: { id: string; pr: string | number; aid: string; est: string } | null;
        caja: Array<{ id: string; m: string | number; d: string; k: string; t: string }>;
        reversas: Array<{ id: string; m: string | number; d: string; k: string; t: string }>;
      };
    };
    type HerramientaKit = {
      prepararIdKit: (id: string) => Promise<string>;
      verificarKitCaja: (id: string) => Promise<ResultadoKit>;
      cleanupKit: (id: string) => Promise<{ removed: boolean }>;
    };
    try {
      await irDirectorio();
      await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
      const codigoAlumno = (await page.locator('#dt table tr').nth(1).locator('td').first().innerText()).trim();

      await page.getByText('Ventas de Indumentaria', { exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();
      const preparado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está habilitada la prueba de ventas en Supabase QA.');
        return api.prepararIdKit(idPrueba);
      }, id);
      expect(preparado).toBe(id);

      await page.locator('#k_q').fill(codigoAlumno);
      const resultado = page.locator('#k_res button').first();
      await expect(resultado).toBeVisible();
      await resultado.click();
      await expect(page.locator('#k_a')).toHaveValue(codigoAlumno);
      await page.locator('#k_pr').fill('75');
      await page.locator('#k_c').fill('35');
      await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Venta registrada');

      let verificado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de venta QA.');
        return api.verificarKitCaja(idPrueba);
      }, id);
      expect(verificado.database.kits).toHaveLength(1);
      expect(verificado.database.caja).toHaveLength(1);
      expect(Number(verificado.database.caja[0].monto)).toBe(75);
      expect(verificado.restored.caja).toHaveLength(1);

      await page.locator('button[data-f="kitEd"][data-i="' + id + '"]').click();
      await expect(page.getByRole('heading', { name: 'Editar venta', exact: true })).toBeVisible();
      await page.locator('#k_pr').fill('85');
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Venta actualizada');

      verificado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de venta QA.');
        return api.verificarKitCaja(idPrueba);
      }, id);
      expect(verificado.database.kits).toHaveLength(1);
      expect(verificado.database.caja).toHaveLength(1);
      expect(Number(verificado.database.caja[0].monto)).toBe(85);

      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('button[data-f="delKit"][data-i="' + id + '"]').click();
      await expect(page.locator('#toast')).toContainText('Venta anulada y reversión registrada en Caja');
      verificado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación de venta QA.');
        return api.verificarKitCaja(idPrueba);
      }, id);
      expect(verificado.database.kits).toHaveLength(1);
      expect(verificado.database.kits[0].estado).toBe('Anulada');
      expect(verificado.database.caja).toHaveLength(1);
      expect(verificado.database.reversas).toHaveLength(1);
      expect(verificado.database.caja[0].tipo).toBe('I');
      expect(verificado.database.reversas[0].tipo).toBe('E');
      expect(Number(verificado.database.reversas[0].monto)).toBe(85);
      expect(verificado.restored.kit?.est).toBe('Anulada');
      expect(verificado.restored.caja).toHaveLength(1);
      expect(verificado.restored.reversas).toHaveLength(1);
    } finally {
      const limpieza = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaKit }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de la venta QA.');
        return api.cleanupKit(idPrueba);
      }, id);
      expect(limpieza.removed).toBeTruthy();
    }
  });


  test('Bloquear dos ventas simultáneas del mismo número de camiseta en categorías competitivas próximas', async () => {
    type HerramientaCamiseta = {
      probarNumeroCamisetaConcurrente: () => Promise<{ aceptados: number; rechazados: number; persistidos: number }>;
    };
    const resultado = await page.evaluate(async () => {
      const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaCamiseta }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No está disponible la prueba de concurrencia de camisetas QA.');
      return api.probarNumeroCamisetaConcurrente();
    });
    expect(resultado.aceptados).toBe(1);
    expect(resultado.rechazados).toBe(1);
    expect(resultado.persistidos).toBe(1);
  });

  test('Rechazar movimiento de caja sin monto válido', async () => {
    await page.getByText('Caja Chica y Finanzas', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Registrar movimiento', exact: true })).toBeVisible();

    const registrar = page.getByRole('button', { name: 'Registrar movimiento', exact: true });
    await page.locator('#c_c').selectOption('Otros');
    for (const monto of ['', '0', '-1', '100000']) {
      await page.locator('#c_m').fill(monto);
      await registrar.click();
      await expect(page.locator('#toast')).toContainText('Monto inválido');
      await expect(registrar).toBeVisible();
    }

    await page.locator('#c_m').fill('10');
    await page.locator('#c_c').selectOption('');
    await registrar.click();
    await expect(page.locator('#toast')).toContainText('Concepto obligatorio');

    // Todas las entradas se rechazan antes de añadir un movimiento a caja.
  });


  test('Bloquear el doble clic al registrar un egreso manual de Caja', async () => {
    type HerramientaCajaQA = {
      verificarEgresoCajaQA: (detalle: string) => Promise<number>;
      cleanupEgresoCajaQA: (detalle: string) => Promise<{ removed: boolean; count: number }>;
    };
    const detalle = 'QA-DOBLE-CAJA-' + randomUUID();
    await page.getByText('Caja Chica y Finanzas', { exact: true }).first().click();
    await page.locator('#c_t').selectOption('E');
    await page.locator('#c_c').selectOption('Otros');
    await page.locator('#c_d').fill(detalle);
    await page.locator('#c_m').fill('1.23');

    try {
      const registrar = page.getByRole('button', { name: 'Registrar movimiento', exact: true });
      await registrar.click();
      await expect(registrar).toBeVisible();
      await registrar.click();

      await expect.poll(async () => page.evaluate(async (marcador) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaCajaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación autenticada de Caja QA.');
        return api.verificarEgresoCajaQA(marcador);
      }, detalle), { timeout: 15000 }).toBe(1);
    } finally {
      const limpieza = await page.evaluate(async (marcador) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaCajaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza autenticada de Caja QA.');
        return api.cleanupEgresoCajaQA(marcador);
      }, detalle);
      expect(limpieza.removed).toBeTruthy();
    }
  });

  test('Consultar dashboard gerencial y cambiar periodo sin modificar datos', async () => {
    await page.getByText('Dashboard Gerencial', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Dashboard Gerencial', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Balance de utilidad por sede', exact: true })).toBeVisible();

    const mes = page.locator('select[data-ch="setGMm"]');
    const anio = page.locator('select[data-ch="setGMy"]');
    await expect(mes).toBeVisible();
    await expect(anio).toBeVisible();
    await mes.selectOption('10');
    await expect(page.getByText(/Utilidad neta total del mes:/)).toBeVisible();
    const opcionesAnio = await anio.locator('option').count();
    if (opcionesAnio > 1) {
      await anio.selectOption({ index: 1 });
    } else {
      await expect(anio).toHaveValue(await anio.inputValue());
    }

    await expect(page.getByRole('heading', { name: 'Utilidad neta por mes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Matrículas registradas por mes' })).toBeVisible();
    await expect(page.getByText(/Balance de utilidad por sede/)).toBeVisible();
  });


  test('Consultar pre-registros y filtrar sin aceptar ni eliminar solicitudes', async () => {
    await page.getByRole('button', { name: /PRE-REGISTRO/ }).click();
    const buscador = page.getByPlaceholder('Nombre, DNI o apoderado', { exact: true });
    await expect(buscador).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeVisible();

    const filas = page.locator('#pt table tr');
    await buscador.fill('QA_PRE_REGISTRO_INEXISTENTE_938472');
    await expect(filas).toHaveCount(2);
    await expect(page.getByText('Sin registros todavía.', { exact: true })).toBeVisible();

    await buscador.fill('');
    const modalidad = page.locator('select[data-ch="preM"]');
    await expect(modalidad).toBeVisible();
    await modalidad.selectOption('Virtual');
    await expect(filas.first()).toBeVisible();

    // No se pulsan Aceptar ni Eliminar; solo se consulta y filtra la lista.
    await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeVisible();
  });



  test('Rechazar deporte con código inválido o repetido sin guardar', async () => {
    await page.getByText('Horarios y Categorías', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();

    await page.locator('#d_n').fill('Deporte QA');
    await page.locator('#d_c').fill('AB');
    await page.getByRole('button', { name: 'Agregar deporte', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Nombre y código de 3 letras');

    const codigoExistente = (await page.locator('#h_d option').nth(1).getAttribute('value')) || '';
    await page.locator('#d_c').fill(codigoExistente.replace(/^DEP-/, ''));
    await page.getByRole('button', { name: 'Agregar deporte', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Código repetido');
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();
    // Los dos intentos se detienen antes de añadir un deporte al catálogo.
  });


  test('Rechazar certificación del personal sin nombre', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();
    await page.locator('button[data-f="perTab"][data-i="d"]').click();

    const fila = page.locator('table tr').nth(1);
    await fila.getByRole('button', { name: 'Modificar', exact: true }).click();
    await expect(page.locator('#pc_c')).toBeVisible();
    await expect(page.locator('#pc_e')).toBeVisible();
    await expect(page.locator('#pc_v')).toBeVisible();

    await page.locator('#pc_c').fill('');
    await page.locator('#pc_e').fill('Entidad QA');
    await page.locator('#pc_v').fill('2027-12-31');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Ingresa la certificación');
    await expect(page.locator('#pc_c')).toBeVisible();
    // La certificación incompleta no se agrega al expediente del personal.
  });


  test('Rechazar archivos adjuntos con formato no permitido o tamaño excesivo', async () => {
    await irDirectorio();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Nueva matrícula/i }).click();
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    await page.locator('#ad_b').click();
    const chooserTipo = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Subir', exact: true }).first().click();
    await (await chooserTipo).setFiles({
      name: 'archivo-no-permitido.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('contenido QA'),
    });
    await expect(page.locator('#toast')).toContainText('Solo JPG, PNG o PDF de hasta 5 MB');

    const chooserTamano = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Subir', exact: true }).first().click();
    await (await chooserTamano).setFiles({
      name: 'archivo-excesivo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(5_000_001),
    });
    await expect(page.locator('#toast')).toContainText('Solo JPG, PNG o PDF de hasta 5 MB');
    await expect(page.locator('#ad_b')).toContainText('0/4');
    // No se seleccionó un archivo válido ni se guardó la matrícula.
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.locator('#mod')).not.toHaveClass(/o/);
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();
  });

  test('Abrir directamente Matrículas y Alumnos y revisar formulario sin guardar', async () => {
    await page.getByText('Matrículas y Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Matrículas y Alumnos', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Nueva matrícula/ })).toBeVisible();

    await expect(page.locator('#m_nom')).toBeVisible();
    await expect(page.locator('#m_ape')).toBeVisible();
    await expect(page.locator('#m_dni')).toBeVisible();
    await expect(page.locator('#m_dep')).toBeVisible();
    await expect(page.locator('#m_sed')).toBeVisible();

    // Solo se inspecciona el formulario; no se pulsa Guardar matrícula.
  });


  test('Verificar consistencia de ingresos y egresos entre Caja y Dashboard Gerencial', async () => {
    const ahora = new Date();
    const anio = String(ahora.getFullYear());
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');

    // Consultamos Caja por sede y acumulamos solo movimientos del mes actual.
    await page.getByText('Caja Chica y Finanzas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Caja Chica y Finanzas', exact: true })).toBeVisible();

    const selectorSede = page.locator('select[data-ch="asCs"]');
    await expect(selectorSede).toBeVisible();
    const sedes = await selectorSede.locator('option').evaluateAll((options) => {
      const elementos = options as HTMLOptionElement[];
      return elementos
        .filter((option) => option.value)
        .map((option) => ({ id: option.value, nombre: option.textContent?.trim() || '' }));
    });
    expect(sedes.length).toBeGreaterThan(0);

    const totalesCaja = new Map<string, { ingresos: number; egresos: number }>();
    const numero = (texto: string) => Number(texto.replace(/[^\d.-]/g, ''));

    for (const sede of sedes) {
      await selectorSede.selectOption(sede.id);
      const filas = await page.locator('table').last().locator('tr').evaluateAll((rows) =>
        rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
      );
      let ingresos = 0;
      let egresos = 0;
      for (const fila of filas) {
        if (!fila[0]?.startsWith(anio + '-' + mes)) continue;
        // Caja ahora incluye la columna Trazabilidad antes del importe.
        const monto = numero(fila[5] || '');
        if (fila[1] === 'Ingreso') ingresos += monto;
        if (fila[1] === 'Egreso') egresos += monto;
      }
      totalesCaja.set(sede.nombre, { ingresos, egresos });
    }

    // El Dashboard calcula esos mismos importes desde caja_movimientos.
    await page.getByText('Dashboard Gerencial', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Dashboard Gerencial', exact: true })).toBeVisible();
    await page.locator('select[data-ch="setGMm"]').selectOption(mes);
    await page.locator('select[data-ch="setGMy"]').selectOption(anio);

    const tablaBalance = page.locator('table').filter({
      has: page.getByRole('columnheader', { name: 'Ingresos', exact: true }),
    }).first();
    await expect(tablaBalance).toBeVisible();
    const balance = await tablaBalance.locator('tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    expect(balance.length).toBeGreaterThan(0);

    for (const fila of balance) {
      const sede = fila[0];
      const caja = totalesCaja.get(sede);
      expect(caja, 'La sede del Dashboard debe existir en el selector de Caja: ' + sede).toBeDefined();
      expect(Math.abs(numero(fila[1] || '') - caja!.ingresos)).toBeLessThanOrEqual(0.011);
      expect(Math.abs(numero(fila[5] || '') - caja!.egresos)).toBeLessThanOrEqual(0.011);
    }
    // Solo se cambiaron filtros de consulta; no se creó ni modificó ningún movimiento.
  });


  test('Verificar que los horarios activos estén vinculados a entrenadores activos', async () => {
    await page.getByText('Personal y Planillas', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Personal y Planillas', exact: true })).toBeVisible();

    const personalRows = await page.locator('#per_t table tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    const entrenadoresActivos = new Set(
      personalRows
        .filter((row) => row[3] === 'ENT' && row[8] === 'Activo')
        .map((row) => row[2])
    );

    await page.getByText('Horarios y Categorías', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Horarios y Categorías', exact: true })).toBeVisible();
    const horarioRows = await page.locator('table').last().locator('tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    const horariosActivos = horarioRows.filter((row) => row[7] === 'Activo');
    expect(horariosActivos.length).toBeGreaterThan(0);

    for (const horario of horariosActivos) {
      const profesores = (horario[6] || '').split(',').map((nombre) => nombre.trim()).filter(Boolean);
      expect(profesores.length, 'El horario ' + horario[0] + ' debe tener entrenador asignado').toBeGreaterThan(0);
      for (const profesor of profesores) {
        expect(
          entrenadoresActivos.has(profesor),
          'El entrenador "' + profesor + '" del horario ' + horario[0] + ' debe existir y estar activo en Personal'
        ).toBeTruthy();
      }
    }
  });

  test('Verificar que la lista de asistencia solo incluya alumnos activos del grupo y sede seleccionados', async () => {
    await page.getByText('Directorio de Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    const directorio = await page.locator('table').last().locator('tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    const alumnosActivos = new Map(
      directorio
        .filter((row) => row[7] === 'Activo')
        .map((row) => [row[1].replace(/\\s+/g, ' ').trim(), { sede: row[3], deporte: row[4], categoria: row[5] }])
    );

    await page.getByText('Toma de Asistencias', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Toma de Asistencias', exact: true })).toBeVisible();

    const sede = page.locator('select[data-ch="setA"][data-i="s"]');
    await expect(sede).toBeVisible();
    const sedesDisponibles = await sede.locator('option').count();
    expect(sedesDisponibles).toBeGreaterThan(1);
    await sede.selectOption({ index: 1 });
    const sedeNombre = (await sede.locator('option:checked').textContent())?.trim() || '';

    const grupo = page.locator('select[data-ch="setA"][data-i="g"]');
    await expect(grupo).toBeVisible();
    expect(await grupo.locator('option').count()).toBeGreaterThan(1);
    await grupo.selectOption({ index: 1 });
    const grupoValor = await grupo.inputValue();
    const [deporteId, categoria] = grupoValor.split('|');

    const deportes = await page.getByText('Directorio de Alumnos', { exact: true }).count();
    expect(deportes).toBeGreaterThanOrEqual(0);
    const nombreDeporte = (await grupo.locator('option:checked').textContent())?.trim() || '';

    const hora = page.locator('select[data-ch="setA"][data-i="h"]');
    await expect(hora).toBeVisible();
    expect(await hora.locator('option').count()).toBeGreaterThan(1);
    await hora.selectOption({ index: 1 });
    await page.locator('select[data-ch="setA"][data-i="t"]').selectOption('A');

    const filasAsistencia = await page.locator('table').last().locator('tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => row.querySelector('td')?.textContent?.replace(/\\s+/g, ' ').trim() || '')
    );
    for (const nombre of filasAsistencia) {
      const alumno = alumnosActivos.get(nombre);
      expect(alumno, 'El alumno "' + nombre + '" debe existir y estar activo en el Directorio').toBeDefined();
      expect(alumno!.sede, 'La sede del alumno "' + nombre + '" debe coincidir con la seleccionada').toBe(sedeNombre);
      expect(alumno!.deporte, 'El deporte del alumno "' + nombre + '" debe coincidir con el grupo ' + nombreDeporte + ' (' + deporteId + ')').toContain(nombreDeporte.split(' ')[0]);
      expect(alumno!.categoria, 'La categoría del alumno "' + nombre + '" debe coincidir con el grupo seleccionado').toBe(categoria);
    }
    // La prueba solo consulta el directorio y la lista; no marca asistencia ni pagos.
  });


  test('Verificar importes y estados del cronograma frente a matrícula y pagos', async () => {
    await page.getByText('Directorio de Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();

    const primeraFila = page.locator('#dt table tr').nth(1);
    const codigo = (await primeraFila.locator('td').first().innerText()).trim();
    expect(codigo).not.toBe('');
    await primeraFila.getByRole('button', { name: 'Abrir', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ficha ' + codigo, exact: false })).toBeVisible();

    const matricula = Number(await page.locator('#m_cm').inputValue());
    const mensualidad = Number(await page.locator('#m_cmen').inputValue());
    const meses = Number(await page.locator('#m_mes').inputValue());
    const pagado = Number(await page.locator('#m_pag').inputValue());
    for (const valor of [matricula, mensualidad, meses, pagado]) {
      expect(Number.isFinite(valor)).toBeTruthy();
      expect(valor).toBeGreaterThanOrEqual(0);
    }

    // Sincroniza el cronograma con los valores ya cargados en la ficha.
    // El formulario usa delegación de eventos input para recalcular la vista previa.
    for (const selector of ['#m_cm', '#m_cmen', '#m_mes', '#m_pag']) {
      await page.locator(selector).dispatchEvent('input');
    }
    const filas = page.locator('#cron_t table tr');
    const datos = await filas.evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    const mesesEsperados = Math.min(36, Math.max(0, Math.trunc(meses)));
    expect(datos).toHaveLength(mesesEsperados);

    const numero = (texto: string) => Number(texto.replace(/[^\d.-]/g, ''));
    let saldoAplicable = Math.max(0, pagado - matricula);
    let totalCuotas = 0;
    let cuotasPagadas = 0;

    for (const [indice, fila] of datos.entries()) {
      expect(fila[0]).toBe(String(indice + 1));
      expect(Math.abs(numero(fila[2]) - mensualidad)).toBeLessThanOrEqual(0.011);
      const abonadoEsperado = Math.min(mensualidad, saldoAplicable);
      const saldoEsperado = Math.max(0, mensualidad - abonadoEsperado);
      expect(Math.abs(numero(fila[3]) - abonadoEsperado)).toBeLessThanOrEqual(0.011);
      expect(Math.abs(numero(fila[4]) - saldoEsperado)).toBeLessThanOrEqual(0.011);
      totalCuotas += numero(fila[2]);
      saldoAplicable = Math.round((saldoAplicable - abonadoEsperado) * 100) / 100;
      if (saldoEsperado <= 0.009) {
        cuotasPagadas++;
        expect(fila[5]).toBe('Pagada');
      } else if (abonadoEsperado > 0.009) {
        expect(fila[5]).toBe('Parcial');
      } else {
        expect(['Pendiente', 'Vencida']).toContain(fila[5]);
      }
    }

    const totalProyectado = matricula + totalCuotas;
    const resumen = await page.locator('#cron_t').innerText();
    expect(resumen).toContain('Monto total proyectado:');
    expect(Math.abs(totalProyectado - (matricula + mensualidad * mesesEsperados))).toBeLessThanOrEqual(0.011);
    expect(cuotasPagadas).toBeLessThanOrEqual(mesesEsperados);

    // No se modifica ningún campo ni se guarda la ficha; solo se contrasta el cronograma visible.
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });

  test('Distribuir abonos parciales primero a matrícula y luego a cuotas sin guardar', async () => {
    await page.getByText('Directorio de Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
    const primeraFila = page.locator('#dt table tr').nth(1);
    await primeraFila.getByRole('button', { name: 'Abrir', exact: true }).click();
    await expect(page.locator('#m_pag')).toBeVisible();

    await page.locator('#m_cm').fill('50');
    await page.locator('#m_cmen').fill('90');
    await page.locator('#m_mes').fill('2');
    await page.locator('#m_pag').fill('100');
    for (const selector of ['#m_cm', '#m_cmen', '#m_mes', '#m_pag']) {
      await page.locator(selector).dispatchEvent('input');
    }

    const datos = await page.locator('#cron_t table tr').evaluateAll((rows) =>
      rows.slice(1).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || ''))
    );
    expect(datos).toHaveLength(2);
    expect(datos[0][2]).toContain('90');
    expect(datos[0][3]).toContain('50');
    expect(datos[0][4]).toContain('40');
    expect(datos[0][5]).toBe('Parcial');
    expect(datos[1][3]).toContain('0');
    expect(datos[1][4]).toContain('90');
    expect(datos[1][5]).toBe('Pendiente');
    await expect(page.locator('#cron_t')).toContainText('Matrícula:');
    await expect(page.locator('#cron_t')).toContainText('Saldo:');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  });

  test('Calcular reversiones parciales FIFO sin mutar ingresos ni exceder el saldo original', async () => {
    const resultado = await page.evaluate(() => {
      type Movimiento = { _id?: string; d: string; t: string; c: string; m: number; k?: string };
      const fn = (window as unknown as {
        calcularReversionesCaja: (caja: Movimiento[], id: string, importe: number) => { originalId: string; monto: number }[];
      }).calcularReversionesCaja;
      const movimientos: Movimiento[] = [
        { _id: 'ingreso-1', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 70 },
        { _id: 'ingreso-2', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 30 },
      ];
      const primera = fn(movimientos, 'ALU-QA', 40);
      primera.forEach((x) => movimientos.push({
        _id: 'egreso-' + movimientos.length, d: 'ALU-QA', t: 'E',
        c: 'Reversión de pago de matrícula', m: x.monto, k: 'reversion:' + x.originalId,
      }));
      const segunda = fn(movimientos, 'ALU-QA', 50);
      segunda.forEach((x) => movimientos.push({
        _id: 'egreso-' + movimientos.length, d: 'ALU-QA', t: 'E',
        c: 'Reversión de pago de matrícula', m: x.monto, k: 'reversion:' + x.originalId,
      }));
      const insuficiente = fn(movimientos, 'ALU-QA', 100);
      return {
        primera, segunda, insuficiente,
        originales: movimientos.filter((x) => x.t === 'I'),
        egresos: movimientos.filter((x) => x.t === 'E'),
      };
    });
    expect(resultado.primera).toEqual([
      { originalId: 'ingreso-2', monto: 30 },
      { originalId: 'ingreso-1', monto: 10 },
    ]);
    expect(resultado.segunda).toEqual([{ originalId: 'ingreso-1', monto: 50 }]);
    expect(resultado.insuficiente.reduce((s, x) => s + x.monto, 0)).toBe(10);
    expect(resultado.insuficiente.every((x) => x.monto > 0 && x.originalId)).toBeTruthy();
    expect(resultado.originales).toEqual([
      { _id: 'ingreso-1', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 70 },
      { _id: 'ingreso-2', d: 'ALU-QA', t: 'I', c: 'Matrícula / mensualidad', m: 30 },
    ]);
    expect(resultado.egresos.reduce((s, x) => s + x.m, 0)).toBe(90);
  });



  test('Registrar trazabilidad de cada abono por matrícula y cuota en orden', async () => {
    const resultado = await page.evaluate(() => {
      const fn = (window as unknown as {
        distribuirAbonoMatricula: (cm: number, cmen: number, meses: number, desde: number, hasta: number) =>
          { destino: string; cuota: number; monto: number }[];
      }).distribuirAbonoMatricula;
      return {
        primero: fn(50, 90, 2, 0, 100),
        segundo: fn(50, 90, 2, 100, 190),
        tercero: fn(50, 90, 2, 190, 230),
      };
    });
    expect(resultado.primero).toEqual([
      { destino: 'Matrícula', cuota: 0, monto: 50 },
      { destino: 'Cuota', cuota: 1, monto: 50 },
    ]);
    expect(resultado.segundo).toEqual([
      { destino: 'Cuota', cuota: 1, monto: 40 },
      { destino: 'Cuota', cuota: 2, monto: 50 },
    ]);
    expect(resultado.tercero).toEqual([
      { destino: 'Cuota', cuota: 2, monto: 40 },
    ]);
    for (const [desde, hasta, tramos] of [
      [0, 100, resultado.primero],
      [100, 190, resultado.segundo],
      [190, 230, resultado.tercero],
    ] as const) {
      expect(tramos.reduce((s, x) => s + x.monto, 0)).toBe(hasta - desde);
    }
  });


  test('Reconocer ingresos con aplicación codificada y mostrar su trazabilidad en Caja', async () => {
    const resultado = await page.evaluate(() => {
      const cajaAuditoriaFn = (window as unknown as {
        cajaAuditoria: (movimiento: { k: string }) => string;
      }).cajaAuditoria;
      const reversasFn = (window as unknown as {
        calcularReversionesCaja: (
          caja: { _id: string; d: string; t: string; c: string; m: number; k: string }[],
          id: string,
          importe: number
        ) => { originalId: string; monto: number }[];
      }).calcularReversionesCaja;
      const aplicacion = encodeURIComponent(JSON.stringify([
        { destino: 'Matrícula', cuota: 0, monto: 50 },
        { destino: 'Cuota', cuota: 1, monto: 50 },
      ]));
      const ingreso = {
        _id: 'ingreso-auditado',
        d: 'ALU-QA',
        t: 'I',
        c: 'Abono matrícula',
        m: 100,
        k: 'matricula:ALU-QA|aplicacion:' + aplicacion,
      };
      return {
        detalle: cajaAuditoriaFn(ingreso),
        reversa: reversasFn([ingreso], 'ALU-QA', 25),
      };
    });
    expect(resultado.detalle).toContain('Matrícula');
    expect(resultado.detalle).toContain('Cuota 1');
    expect(resultado.reversa).toEqual([{ originalId: 'ingreso-auditado', monto: 25 }]);
  });

  test('Completar una matrícula con pago inicial y conciliar ficha, cuotas y Caja en Supabase QA', async () => {
    const dni = String(randomInt(10_000_000, 99_999_999));
    type Cuota = { numero_cuota: number; monto: string | number; monto_abonado: string | number; saldo_pendiente: string | number; estado: string };
    type Resultado = {
      id: string;
      alumno: { monto_pagado: string | number; costo_matricula: string | number; costo_mensualidad: string | number; meses: number };
      cuotas: Cuota[];
      caja: { monto: string | number; origen: string };
      allocation: Array<{ destino: string; cuota: number; monto: number }>;
      restored: { pagado: string | number; cuotas: Array<{ n: number; monto: number; abonado: number; saldo: number; estado: string }>; caja: Array<{ monto: number; origen: string }> };
    };
    type HerramientaQA = {
      prepararIdMatricula: (dni: string) => Promise<string>;
      verificarMatriculaCompleta: (dni: string) => Promise<Resultado>;
      forzarGeneracionCarnetQA: (dni: string) => Promise<{ id: string }>;
      consultarTokenCarnetQA: (dni: string) => Promise<string | null>;
      cleanupMatricula: (dni: string) => Promise<{ removed: boolean; id?: string }>;
    };
    try {
      await irDirectorio();
      await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
      await page.getByRole('button', { name: /Nueva matrícula/i }).click();
      await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

      await page.locator('#m_nom').fill('QA');
      await page.locator('#m_ape').fill('Persistencia');
      await page.locator('#m_dni').fill(dni);
      await page.locator('#m_sex').selectOption('M');
      await page.locator('#m_nac').fill('2014-06-15');
      await page.locator('#m_cm').fill('50');
      await page.locator('#m_cmen').fill('90');
      await page.locator('#m_mes').fill('2');
      await page.locator('#m_pag').fill('230');
      await expect(page.locator('#cron_t')).toContainText('Pagada');
      const idPreparado = await page.evaluate(async (dniPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la preparación de identificador QA');
        return api.prepararIdMatricula(dniPrueba);
      }, dni);
      expect(idPreparado).toBe('RPC');
      await page.getByRole('button', { name: 'Guardar matrícula', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('Matrícula guardada', { timeout: 15000 });

      const resultado = await page.evaluate(async (dniPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la verificación integral de matrícula en Supabase QA');
        return api.verificarMatriculaCompleta(dniPrueba);
      }, dni);

      expect(resultado.id).toMatch(new RegExp('^' + new Date().getFullYear().toString().slice(-2) + '[0-9]{4}$'));
      expect(Number(resultado.alumno.costo_matricula)).toBe(50);
      expect(Number(resultado.alumno.costo_mensualidad)).toBe(90);
      expect(resultado.alumno.meses).toBe(2);
      expect(Number(resultado.alumno.monto_pagado)).toBe(230);
      expect(resultado.cuotas).toHaveLength(2);
      expect(resultado.cuotas.map((x) => [Number(x.monto), Number(x.monto_abonado), Number(x.saldo_pendiente), x.estado]))
        .toEqual([[90, 90, 0, 'Pagada'], [90, 90, 0, 'Pagada']]);
      expect(Number(resultado.caja.monto)).toBe(230);
      expect(resultado.allocation).toEqual([
        { destino: 'Matrícula', cuota: 0, monto: 50 },
        { destino: 'Cuota', cuota: 1, monto: 90 },
        { destino: 'Cuota', cuota: 2, monto: 90 },
      ]);
      expect(Number(resultado.restored.pagado)).toBe(230);
      expect(resultado.restored.cuotas).toHaveLength(2);
      expect(resultado.restored.caja).toHaveLength(1);
      expect(Number(resultado.restored.caja[0].monto)).toBe(230);

      // El carnet no debe aparecer hasta que Supabase confirme el qr_token.
      const cerrarCarnet = page.getByRole('button', { name: 'Cerrar', exact: true });
      if (await cerrarCarnet.isVisible().catch(() => false)) await cerrarCarnet.click();

      let liberarRpc: (() => void) | undefined;
      const rpcGate = new Promise<void>((resolve) => { liberarRpc = resolve; });
      const rpcPath = '**/rest/v1/rpc/erp_persistir_lote';
      await page.route(rpcPath, async (route) => {
        await rpcGate;
        await route.continue();
      });
      try {
        const rpcPendiente = page.waitForRequest((request) =>
          request.url().includes('/rest/v1/rpc/erp_persistir_lote')
        );
        await page.evaluate(async (dniPrueba) => {
          const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
          if (!api) throw new Error('No está habilitada la prueba autenticada de carnet QA.');
          return api.forzarGeneracionCarnetQA(dniPrueba);
        }, dni);
        await rpcPendiente;
        await expect(cerrarCarnet).toBeHidden();
        liberarRpc?.();
        await expect(cerrarCarnet).toBeVisible({ timeout: 15000 });

        const tokenQR = await page.evaluate(async (dniPrueba) => {
          const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
          if (!api) throw new Error('No está habilitada la consulta autenticada de carnet QA.');
          return api.consultarTokenCarnetQA(dniPrueba);
        }, dni);
        if (!tokenQR) throw new Error('Supabase no persistió el token QR del alumno temporal.');
        expect(tokenQR).toMatch(/^[a-z0-9]{16}$/);

        // El endpoint público solo debe exponer los campos deliberados del carnet.
        const accesoPublico = await page.evaluate(async (tokenValido) => {
          const config = (window as unknown as {
            __ERP_CONFIG__?: { supabaseUrl: string; supabaseKey: string };
          }).__ERP_CONFIG__;
          if (!config) throw new Error('No se cargó la configuración pública de Supabase QA.');
          const endpoint = config.supabaseUrl.replace(/\/+$/, '');
          const headers = {
            apikey: config.supabaseKey,
            Authorization: 'Bearer ' + config.supabaseKey,
            'Content-Type': 'application/json',
          };
          const consultarCarnet = async (t: string) => {
            const response = await fetch(endpoint + '/rest/v1/rpc/carnet_publico', {
              method: 'POST', headers, body: JSON.stringify({ t }),
            });
            return { status: response.status, rows: await response.json() };
          };
          const tokenInexistente = Array.from(
            crypto.getRandomValues(new Uint8Array(16)),
            (b) => (b % 36).toString(36),
          ).join('');
          const [valido, invalido, malformado, directorio] = await Promise.all([
            consultarCarnet(tokenValido),
            consultarCarnet(tokenInexistente),
            consultarCarnet('token-corto'),
            fetch(endpoint + '/rest/v1/alumnos?select=id,nombres&limit=1', {
              headers: { apikey: config.supabaseKey, Authorization: 'Bearer ' + config.supabaseKey },
            }).then(async (response) => ({ status: response.status, rows: await response.json().catch(() => null) })),
          ]);
          return { valido, invalido, malformado, directorio };
        }, tokenQR);
        expect(accesoPublico.valido.status).toBe(200);
        expect(accesoPublico.valido.rows).toHaveLength(1);
        expect(accesoPublico.valido.rows[0]).toMatchObject({
          nombres: 'QA',
          apellidos: 'Persistencia',
          estado: 'Activo',
        });
        expect(Object.keys(accesoPublico.valido.rows[0]).sort()).toEqual([
          'apellidos', 'categoria', 'codigo', 'deporte', 'estado', 'foto', 'nombres', 'sede',
        ]);
        expect(accesoPublico.invalido.status).toBe(200);
        expect(accesoPublico.invalido.rows).toEqual([]);
        expect(accesoPublico.malformado.status).toBe(200);
        expect(accesoPublico.malformado.rows).toEqual([]);
        expect([401, 403]).toContain(accesoPublico.directorio.status);

        await cerrarCarnet.click();
      } finally {
        liberarRpc?.();
        await page.unroute(rpcPath);
      }
    } finally {
      const limpieza = await page.evaluate(async (dniPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de matrícula QA');
        return api.cleanupMatricula(dniPrueba);
      }, dni);
      expect(limpieza.removed).toBeTruthy();
      // Guardar una matrícula con pago abre el comprobante; cerrarlo evita
      // que el diálogo bloquee las pruebas seriales siguientes.
      const cerrarComprobante = page.getByRole('button', { name: 'Cerrar', exact: true });
      if (await cerrarComprobante.isVisible().catch(() => false)) {
        await cerrarComprobante.click();
      }
    }
  });

  test('No mostrar éxito ni conservar matrícula si Supabase rechaza la persistencia', async () => {
    const dni = String(randomInt(10_000_000, 99_999_999));
    type HerramientaQA = {
      prepararIdMatricula: (dni: string) => Promise<string>;
      verificarAusenciaMatriculaQA: (dni: string) => Promise<number>;
      cleanupMatricula: (dni: string) => Promise<{ removed: boolean; id?: string }>;
    };
    try {
      await irDirectorio();
      await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
      await page.getByRole('button', { name: /Nueva matrícula/i }).click();
      await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

      await page.locator('#m_nom').fill('QA');
      await page.locator('#m_ape').fill('Fallo Persistencia');
      await page.locator('#m_dni').fill(dni);
      await page.locator('#m_sex').selectOption('M');
      await page.locator('#m_nac').fill('2014-06-15');
      await page.locator('#m_cm').fill('50');
      await page.locator('#m_cmen').fill('90');
      await page.locator('#m_mes').fill('2');
      await page.locator('#m_pag').fill('50');

      const preparado = await page.evaluate(async (dniPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está habilitada la preparación de matrícula QA.');
        return api.prepararIdMatricula(dniPrueba);
      }, dni);
      expect(preparado).toBe('RPC');

      const rpcPath = '**/rest/v1/rpc/erp_persistir_lote';
      let intentos = 0;
      const bloquear = async (route: import('@playwright/test').Route) => {
        intentos++;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'QA500', message: 'Fallo inducido de matrícula QA' }),
        });
      };
      await page.route(rpcPath, bloquear);
      try {
        await page.getByRole('button', { name: 'Guardar matrícula', exact: true }).click();
        await expect(page.locator('#toast')).toContainText('No se pudo guardar');
        expect(intentos).toBe(1);
        await expect(page.locator('#toast')).not.toContainText('Matrícula guardada');

        const filas = await page.evaluate(async (dniPrueba) => {
          const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
          if (!api) throw new Error('No está habilitada la verificación autenticada de matrícula QA.');
          return api.verificarAusenciaMatriculaQA(dniPrueba);
        }, dni);
        expect(filas).toBe(0);
        await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();
      } finally {
        await page.unroute(rpcPath, bloquear);
      }
    } finally {
      const limpieza = await page.evaluate(async (dniPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de matrícula QA.');
        return api.cleanupMatricula(dniPrueba);
      }, dni);
      expect(limpieza.removed).toBeTruthy();
    }
  });

  test('Rechazar actualizaciones de alumnos desde clientes sin snapshot financiero', async () => {
    test.setTimeout(120000);
    type ContextoSnapshotQA = {
      obtenerContextoRpcQA: () => { url: string; apikey: string; accessToken: string };
    };
    const contexto = await page.evaluate(() => {
      const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: ContextoSnapshotQA }).__ERP_QA_PERSISTENCIA__;
      if (!api) throw new Error('No está habilitada la prueba de snapshot financiero QA.');
      return api.obtenerContextoRpcQA();
    });
    const payload = {
      p_payload: [{
        name: 'alumnos',
        insert: [],
        update: [{ id: 'QA-CLIENTE-ANTIGUO-TEST' }],
        delete: [],
      }],
    };
    let respuesta: import('@playwright/test').APIResponse | null = null;
    let ultimoError: unknown = null;
    // Usar APIRequestContext evita el AbortController/CORS del navegador.
    // La función SQL es rápida; el payload es no mutante y se puede reintentar.
    for (let intento = 1; intento <= 3; intento++) {
      try {
        respuesta = await page.request.post(
          contexto.url + '/rest/v1/rpc/erp_persistir_lote',
          {
            data: payload,
            timeout: 15000,
            headers: {
              apikey: contexto.apikey,
              Authorization: 'Bearer ' + contexto.accessToken,
              Prefer: 'return=minimal',
            },
          },
        );
        break;
      } catch (error) {
        ultimoError = error;
        if (intento === 3) break;
        await new Promise((resolve) => setTimeout(resolve, 250 * intento));
      }
    }
    if (!respuesta) throw new Error('La RPC de snapshot no respondió tras 3 intentos: ' + String(ultimoError));
    expect(respuesta.status()).toBe(409);
    expect(await respuesta.text()).toMatch(/40001|desactualizada|snapshot/i);
  });

  test('Persistir y recuperar el ingreso de matrícula y su distribución en Caja desde Supabase QA', async () => {
    const id = 'QA-PERSIST-CAJA-' + randomUUID();
    type Tramo = { destino: string; cuota: number; monto: number };
    type Resultado = {
      database: { id: string; detalle: string; monto: string | number; origen: string };
      restored: { id: string; d: string; m: string | number; k: string };
      allocation: Tramo[];
    };
    type HerramientaQA = {
      roundTripCaja: (id: string) => Promise<Resultado>;
      cleanupCaja: (id: string) => Promise<{ removed: boolean }>;
    };
    try {
      const resultado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('La prueba de Caja no está habilitada en este proyecto Supabase QA');
        return api.roundTripCaja(idPrueba);
      }, id);

      expect(resultado.database.id).toBe(id);
      expect(resultado.database.detalle).toBe('QA-ABONO');
      expect(Number(resultado.database.monto)).toBe(230);
      expect(resultado.database.origen).toContain('matricula:QA-ABONO|aplicacion:');
      expect(resultado.restored.id).toBe(id);
      expect(resultado.restored.d).toBe('QA-ABONO');
      expect(Number(resultado.restored.m)).toBe(230);
      expect(resultado.restored.k).toBe(resultado.database.origen);
      expect(resultado.allocation).toEqual([
        { destino: 'Matrícula', cuota: 0, monto: 50 },
        { destino: 'Cuota', cuota: 1, monto: 90 },
        { destino: 'Cuota', cuota: 2, monto: 90 },
      ]);
      const encoded = resultado.database.origen.split('|aplicacion:')[1];
      expect(JSON.parse(decodeURIComponent(encoded))).toEqual(resultado.allocation);
    } finally {
      const limpieza = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de movimientos QA');
        return api.cleanupCaja(idPrueba);
      }, id);
      expect(limpieza.removed).toBeTruthy();
    }
  });

  test('Bloquear modificaciones directas de movimientos ya registrados en Caja', async () => {
    const id = 'QA-PERSIST-CAJA-' + randomUUID();
    type Contexto = { url: string; apikey: string; accessToken: string };
    type HerramientaQA = {
      roundTripCaja: (id: string) => Promise<unknown>;
      cleanupCaja: (id: string) => Promise<{ removed: boolean }>;
      obtenerContextoRpcQA: () => Contexto;
    };
    try {
      await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está habilitada la preparación de Caja QA.');
        return api.roundTripCaja(idPrueba);
      }, id);

      const contexto = await page.evaluate(() => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está habilitado el contexto de sesión QA.');
        return api.obtenerContextoRpcQA();
      });
      const ruta = contexto.url + '/rest/v1/caja_movimientos?id=eq.' + encodeURIComponent(id);
      const headers = {
        apikey: contexto.apikey,
        Authorization: 'Bearer ' + contexto.accessToken,
        Prefer: 'return=minimal',
      };
      const respuesta = await page.request.patch(ruta, {
        data: { monto: 231 },
        timeout: 15000,
        headers,
      });
      expect(respuesta.status()).toBe(409);
      expect(await respuesta.text()).toMatch(/23514|inmutables|reversión/i);

      const verificacion = await page.request.get(ruta + '&select=id,monto', { headers, timeout: 15000 });
      expect(verificacion.status()).toBe(200);
      const filas = await verificacion.json();
      expect(filas).toHaveLength(1);
      expect(Number(filas[0].monto)).toBe(230);
    } finally {
      const limpieza = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de Caja QA.');
        return api.cleanupCaja(idPrueba);
      }, id);
      expect(limpieza.removed).toBeTruthy();
    }
  });

  test('Persistir y recuperar monto_abonado y saldo_pendiente mediante el ERP y Supabase QA', async () => {
    const id = 'QA-PERSIST-CUOTA-' + randomUUID();
    type Resultado = {
      database: { monto: string | number; monto_abonado: string | number; saldo_pendiente: string | number; estado: string };
      restored: { m: string | number; a: string | number; s: string | number; e: string };
    };
    type HerramientaQA = {
      roundTripCuota: (id: string) => Promise<Resultado>;
      cleanupCuota: (id: string) => Promise<{ removed: boolean }>;
    };
    try {
      const resultado = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('El helper de persistencia no está habilitado en este proyecto Supabase QA');
        return api.roundTripCuota(idPrueba);
      }, id);

      expect(Number(resultado.database.monto)).toBe(90);
      expect(Number(resultado.database.monto_abonado)).toBe(50);
      expect(Number(resultado.database.saldo_pendiente)).toBe(40);
      expect(resultado.database.estado).toBe('Parcial');
      expect(Number(resultado.restored.m)).toBe(90);
      expect(Number(resultado.restored.a)).toBe(50);
      expect(Number(resultado.restored.s)).toBe(40);
      expect(resultado.restored.e).toBe('Parcial');
    } finally {
      const limpieza = await page.evaluate(async (idPrueba) => {
        const api = (window as unknown as { __ERP_QA_PERSISTENCIA__?: HerramientaQA }).__ERP_QA_PERSISTENCIA__;
        if (!api) throw new Error('No está disponible la limpieza aislada de registros QA');
        return api.cleanupCuota(idPrueba);
      }, id);
      expect(limpieza.removed).toBeTruthy();
    }
  });


  test('Rechazar matrícula con horario de otra sede o deporte antes de persistir', async () => {
    await page.getByText('Matrículas y Alumnos', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Matrículas y Alumnos', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Nueva matrícula/i })).toBeVisible();

    await page.locator('#m_nom').fill('QA');
    await page.locator('#m_ape').fill('Prueba de integridad');
    await page.locator('#m_nac').fill('2012-01-15');
    await page.locator('#m_sex').selectOption('M');
    await page.locator('#m_mod').selectOption('Formativo');
    await page.locator('#m_con').selectOption('Ninguna');
    await page.locator('#m_est').selectOption('Activo');
    await page.locator('#m_dep').selectOption('DEP-FUT');
    await page.locator('#m_sed').selectOption('SED-CSJ');

    // HOR-0002 existe en QA, pero pertenece a SED-EST / DEP-VOL.
    // Se inyecta como opción para simular una selección manipulada del navegador.
    await page.locator('#m_hor').evaluate((node) => {
      (node as HTMLSelectElement).add(new Option('QA: horario incompatible', 'HOR-0002'));
    });
    await page.locator('#m_hor').selectOption('HOR-0002');

    let intentoDeEscritura = false;
    const bloquearEscritura = async (route: import('@playwright/test').Route) => {
      if (route.request().method() !== 'GET') {
        intentoDeEscritura = true;
        await route.abort();
      } else {
        await route.continue();
      }
    };
    await page.route('**/rest/v1/alumnos**', bloquearEscritura);
    try {
      await page.getByRole('button', { name: 'Guardar matrícula', exact: true }).click();
      await expect(page.locator('#toast')).toContainText('El horario seleccionado no corresponde');
      expect(intentoDeEscritura, 'La validación debe bloquear la operación antes de llamar a Supabase').toBeFalsy();
    } finally {
      await page.unroute('**/rest/v1/alumnos**', bloquearEscritura);
    }

    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    // Cancelar la ficha vuelve al directorio, no al panel de Matrículas.
    await expect(page.getByRole('heading', { name: 'Directorio de Alumnos', exact: true })).toBeVisible();
  });


});
