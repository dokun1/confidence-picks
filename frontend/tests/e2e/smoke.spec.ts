import { test, expect } from '@playwright/test'

// Public routes: reachable while unauthenticated. Each renders its placeholder
// heading. /auth/callback is public because OAuth runs from an unauthenticated
// state. /not-found is intentionally undeclared as its own route, so it falls
// through to the '*' catch-all and renders NotFoundPage's 'Not found' heading.
const publicRoutes: [string, string][] = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/login', 'Login'],
  ['/auth/callback', 'Auth Callback'],
  ['/not-found', 'Not found'],
]

// Protected routes: each redirects to /login when unauthenticated.
const protectedRoutes: string[] = [
  '/profile',
  '/groups',
  '/create-group',
  '/join-group',
  '/group-details',
  '/edit-group',
  '/games',
  '/invite',
]

test('home page renders title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Confidence Picks/)
})

for (const [path, heading] of publicRoutes) {
  test(`public route ${path} renders its heading`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  })
}

for (const path of protectedRoutes) {
  test(`protected route ${path} redirects to /login when unauthenticated`, async ({ page }) => {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
  })
}
