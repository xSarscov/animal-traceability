import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'production-smoke.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  workers: 1,
  use: {
    baseURL: process.env.DEPLOYMENT_URL ?? 'https://deployment-url-required.invalid',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
