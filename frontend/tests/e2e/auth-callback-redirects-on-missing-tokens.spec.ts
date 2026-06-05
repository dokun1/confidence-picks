import { test, expect } from '@playwright/test'

// AuthCallback runs the OAuth handshake from an unauthenticated state. Hitting
// /auth/callback with no tokens in the query string must bounce the user to
// /login rather than leaving them stranded. The literal '/auth/callback' below
// is what scripts/check-page-spec-coverage.mjs scans for to confirm coverage.
test('auth callback redirects to login when tokens are missing', async ({ page }) => {
  await page.goto('/auth/callback')
  await expect(page).toHaveURL(/\/login$/)
})
