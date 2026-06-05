import { test, expect } from '@playwright/test'

// ProfilePage reads the current user from AuthContext (no fetch) and sits behind
// ProtectedRoute, so we seed a valid, unexpired JWT-shaped accessToken in
// localStorage before navigating — AuthProvider derives the user from the token
// on init. The token's payload is standard-base64 (btoa) so AuthService.getUser's
// atob(...) decodes it. The literal '/profile' is also what
// check-page-spec-coverage.mjs scans for to confirm route coverage.
test('profile page shows the signed-in user', async ({ page }) => {
  // Visit the app first so localStorage is writable for this origin.
  await page.goto('/login')

  await page.evaluate(() => {
    const payload = {
      userId: 1,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      pictureUrl: null,
      exp: 9999999999, // far-future so the token never reads as expired
    }
    const token = `header.${btoa(JSON.stringify(payload))}.sig`
    localStorage.setItem('accessToken', token)
  })

  await page.goto('/profile')

  // The signed-in name also renders in the nav user menu, so scope the profile
  // assertions to <main> to avoid a strict-mode multiple-match violation.
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'My Profile' })).toBeVisible()
  await expect(main.getByText('Ada Lovelace')).toBeVisible()
  await expect(main.getByText('ada@example.com')).toBeVisible()
})
