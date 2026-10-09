import { defineConfig, devices } from '@playwright/test';

// Set E2E_BASE_URL to test against a server that is already running (e.g. `npm run dev`).
const externalUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: externalUrl ?? 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
  webServer: externalUrl ? undefined : {
    command: 'PORT=3100 ALLOWED_ORIGINS=http://localhost:3100 npm run demo',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { DATABASE_URL: '' },
  },
});
