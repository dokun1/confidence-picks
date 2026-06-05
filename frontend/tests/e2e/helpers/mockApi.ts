import type { Page } from '@playwright/test'

export async function setupApiMocks(page: Page): Promise<void> {
  await page.route('/api/**', async (route) => {
    await route.fulfill({ json: {} })
  })
}
