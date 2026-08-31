import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? '50%' : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: 'results.json' }],
    ['./scripts/e2e-report/steps-reporter.mjs', { outputFile: 'steps.json' }],
    ['html', { open: 'never' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: { mode: 'retain-on-failure', size: { width: 1280, height: 720 } },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    // false in CI: a fresh runner never has a real dev server already listening, so
    // reusing one there would only mask a webServer startup failure. true locally,
    // where reusing your own `pnpm dev` avoids double-booting during iteration.
    reuseExistingServer: !process.env.CI,
  },
})
