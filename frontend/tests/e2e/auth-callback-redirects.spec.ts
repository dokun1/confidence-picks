import { test, expect } from '@playwright/test'

// AuthCallback runs the OAuth handshake from an unauthenticated state. Hitting
// /auth/callback with no tokens in the query string must bounce the user to
// /login so they land on a usable screen. baseURL is configured in
// playwright.config.ts, so navigate with a relative path. The literal
// '/auth/callback' below is also what scripts/check-page-spec-coverage.mjs
// scans for to confirm route coverage.
test('auth callback redirects to login when tokens are missing', async ({ page }) => {
  await page.goto('/auth/callback')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
})
