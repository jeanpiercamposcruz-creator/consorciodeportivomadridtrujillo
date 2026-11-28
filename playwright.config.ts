import { defineConfig, devices } from '@playwright/test';

const url = process.env.ERP_URL;

if (url) {
  let destino: URL;

  try {
    destino = new URL(url);
  } catch {
    throw new Error('ERP_URL no contiene una dirección válida.');
  }

  const esLocal =
    destino.hostname === 'localhost' ||
    destino.hostname === '127.0.0.1';

  // Acepta únicamente Preview HTTPS de este proyecto y propietario en Vercel.
  // El identificador de cada deployment cambia en cada commit.
  const esQA =
    /^consorciodeportivomadridtrujillo-[a-z0-9-]+-marget\.vercel\.app$/.test(
      destino.hostname
    );
  const supabaseQA =
    process.env.NEXT_PUBLIC_SUPABASE_URL ===
    'https://yiredilknlwbzwvwlqyx.supabase.co';

  if (esLocal && !supabaseQA) {
    throw new Error(
      'Bloqueado: las pruebas locales solo pueden conectarse al proyecto Supabase QA autorizado.'
    );
  }

  if (!esLocal && (!esQA || destino.protocol !== 'https:')) {
    throw new Error(
      'Bloqueado: las pruebas remotas solo pueden ejecutarse en el Preview HTTPS autorizado de QA.'
    );
  }
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  // Los reportes HTML/traces pueden incluir datos personales o tokens de sesión.
  // En CI conservamos únicamente el resultado textual de las pruebas.
  reporter: 'list',

  use: {
    trace: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
