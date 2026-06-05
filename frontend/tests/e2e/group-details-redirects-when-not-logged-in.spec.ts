import { test, expect } from '@playwright/test'

// GroupDetailsPage is the densest group page (tabs, member list, chat, invite
// links, leave/delete) and sits behind ProtectedRoute. Its deeper tab flows are
// intentionally covered by vitest (GroupDetailsPage.test.tsx) — the auth-setup
// cost of exercising them via e2e outweighs the value. This spec asserts only
// the protected-redirect contract: an unauthenticated visit to /group-details
// bounces to /login. The literal '/group-details' below is also what
// check-page-spec-coverage.mjs scans for to confirm route coverage.
test('group-details redirects to /login when unauthenticated', async ({ page }) => {
  await page.goto('/group-details')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
})
