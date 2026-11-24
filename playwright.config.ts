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

  const esQA =
    destino.hostname ===
    'consorciodeportivomadridtrujillo-ao.vercel.app';

  if (!esLocal && (!esQA || destino.protocol !== 'https:')) {
    throw new Error(
      'Bloqueado: las pruebas solo pueden ejecutarse en localhost o en QA mediante HTTPS.'
    );
  }
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});