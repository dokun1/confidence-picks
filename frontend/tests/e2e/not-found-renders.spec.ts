import { test, expect } from '@playwright/test'

// NotFoundPage is a friendly 404 with a link home. baseURL is configured in
// playwright.config.ts, so navigate with a relative path. The literal
// '/not-found' below is also what scripts/check-page-spec-coverage.mjs scans
// for to confirm route coverage.
test('not found page renders heading and home button', async ({ page }) => {
  await page.goto('/not-found')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  // Scope to the page's own button. The global navbar also exposes a home
  // button (aria-label "Confidence Picks home"), so a bare /home/i matches two
  // elements and trips strict mode. "Go home" is unique to NotFoundPage.
  const homeButton = page.getByRole('button', { name: 'Go home' })
  await expect(homeButton).toBeVisible()
  await homeButton.click()
  await expect(page).toHaveURL(/\/$/)
})
