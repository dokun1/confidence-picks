import { test, expect } from '@playwright/test'

// Public routes: reachable while unauthenticated. Each renders a stable
// heading. '/' renders HomePage's ported marketing landing, which leads with
// the 'Welcome to Confidence Picks!' <h1>. /auth/callback is intentionally
// excluded — it renders no stable heading, instead finalizing the OAuth
// handshake and redirecting (to /login when no tokens are present). /not-found
// is intentionally undeclared as its own route, so it falls through to the '*'
// catch-all and renders NotFoundPage's 'Not found' heading.
const publicRoutes: [string, string][] = [
  ['/', 'Welcome to Confidence Picks!'],
  ['/about', 'About'],
  ['/login', 'Login'],
  ['/not-found', 'Not found'],
]

// Protected routes: each redirects to /login when unauthenticated.
const protectedRoutes: string[] = [
  '/profile',
  '/groups',
  '/create-group',
  '/join-group',
  '/group-details',
  '/edit-group/test-id',
  '/games',
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
