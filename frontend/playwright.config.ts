import { defineConfig, devices } from '@playwright/test'

// API route mocking scaffold:
// In individual test files, intercept API calls with page.route():
//
//   await page.route('https://api.confidence-picks.com/**', async route => {
//     const json = { data: [] }
//     await route.fulfill({ json })
//   })
//
// Or use fixtures for shared mocks across a test suite.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
