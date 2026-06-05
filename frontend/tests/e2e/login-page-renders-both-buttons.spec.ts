import { test, expect } from '@playwright/test'

// LoginPage offers two OAuth entry points. baseURL is configured in
// playwright.config.ts, so navigate with the relative '/login' path (also what
// scripts/check-page-spec-coverage.mjs scans for to confirm route coverage).
// Buttons are matched by accessible name: 'Google' for the styled native
// button, 'Apple' for the ported AppleSignInButton.
test('login page renders Google and Apple sign-in buttons', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Apple/ })).toBeVisible()
})
