import { test, expect } from '@playwright/test'

// The groups page (/groups) keeps its search + filter bar pinned to the top of
// the viewport while the list of group cards scrolls beneath it — the same
// sticky behavior the World Cup picks page uses (see
// world-cup-sticky-filters.spec.ts). We seed a long list of groups so the page
// is taller than the viewport and actually scrolls. The literal '/groups' below
// is what check-page-spec-coverage.mjs scans for to confirm route coverage.

// 24 groups, enough to push the page well past the fold. One is named "Wales
// Watchers" so a search can narrow the list to a single result.
const groups = Array.from({ length: 24 }, (_, i) => ({
  id: `g${i}`,
  name: i === 20 ? 'Wales Watchers' : `Group ${String(i).padStart(2, '0')}`,
  identifier: `group-${i}`,
  description: 'Weekly confidence picks',
  memberCount: 4 + i,
  isOwner: i % 2 === 0,
  userRole: i % 2 === 0 ? 'admin' : 'member',
  createdAt: '2026-01-15T00:00:00.000Z',
  poolType: 'nfl_weekly',
}))

async function seed(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.evaluate(() => {
    const payload = { userId: 1, email: 'ada@example.com', name: 'Ada Lovelace', pictureUrl: null, exp: 9999999999 }
    localStorage.setItem('accessToken', `header.${btoa(JSON.stringify(payload))}.sig`)
  })
  await page.route('**/api/groups/my-groups', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(groups) })
  })
  await page.goto('/groups')
  await expect(page.getByRole('heading', { name: 'My Groups' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Group 00' })).toBeVisible()
}

test('the search and filter bar stays pinned to the top while the list scrolls', async ({ page }) => {
  await seed(page)

  const search = page.getByPlaceholder('Search groups…')
  await expect(search).toBeInViewport()

  // Scroll deep into the list — the last cards sit well below the fold.
  await page.getByRole('heading', { name: 'Wales Watchers' }).scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 1200)

  // The bar remains pinned: still in the viewport, and near its top edge.
  await expect(search).toBeInViewport()
  await expect(page.getByRole('button', { name: /filters/i })).toBeInViewport()
  const box = await search.boundingBox()
  expect(box!.y).toBeLessThan(160)
})

test('the pinned search bar still filters the list while scrolled', async ({ page }) => {
  await seed(page)

  // Scroll to the bottom so the bar is doing the pinning work, then search from
  // it — the bar is reachable because it is stuck to the top.
  await page.mouse.wheel(0, 6000)
  await page.getByPlaceholder('Search groups…').fill('Wales')

  await expect(page.getByRole('heading', { name: 'Wales Watchers' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Group 00' })).toBeHidden()
})
