import { test, expect } from '@playwright/test'

// AboutPage is static content. baseURL is configured in playwright.config.ts,
// so navigate with a relative path. The literal '/about' below is also what
// scripts/check-page-spec-coverage.mjs scans for to confirm route coverage.
test('about page renders heading and body copy', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()
  const firstParagraph = page.locator('p').first()
  await expect(firstParagraph).toBeVisible()
  await expect(firstParagraph).toContainText(/confidence/i)
})
