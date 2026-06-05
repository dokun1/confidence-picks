import { test, expect } from '@playwright/test'

// NotFoundPage is a friendly 404 with a link home. baseURL is configured in
// playwright.config.ts, so navigate with a relative path. The literal
// '/not-found' below is also what scripts/check-page-spec-coverage.mjs scans
// for to confirm route coverage.
test('not found page renders heading and home button', async ({ page }) => {
  await page.goto('/not-found')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  const homeButton = page.getByRole('button', { name: /home/i })
  await expect(homeButton).toBeVisible()
  await homeButton.click()
  await expect(page).toHaveURL(/\/$/)
})
