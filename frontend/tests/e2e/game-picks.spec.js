import { test, expect } from '@playwright/test';
import { mockGames, createMockPicksResponse, createMockSavePicksResponse } from './fixtures/mockData.js';

test.describe('Game Picks Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - assume user is logged in
    await page.addInitScript(() => {
      window.localStorage.setItem('auth-token', 'mock-jwt-token');
      window.localStorage.setItem('user', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });

    // Mock API responses
    await page.route('**/api/groups/test-group/picks/closest*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          season: 2025,
          seasonType: 2,
          week: 1
        })
      });
    });

    await page.route('**/api/groups/test-group/picks?*', async route => {
      const url = new URL(route.request().url());
      const season = url.searchParams.get('season') || 2025;
      const seasonType = url.searchParams.get('seasonType') || 2;
      const week = url.searchParams.get('week') || 1;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createMockPicksResponse('test-group', season, seasonType, week))
      });
    });

    await page.route('**/api/groups/test-group/picks', async route => {
      if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockSavePicksResponse(requestBody.picks || []))
        });
      }
    });

    // Mock groups API for navigation
    await page.route('**/api/groups', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'test-group',
          name: 'Test Group',
          memberCount: 1
        }])
      });
    });
  });

  test('should display games for picking', async ({ page }) => {
    await page.goto('/groups/test-group');
    
    // Wait for games to load
    await expect(page.locator('[data-testid="game-pick-row"]')).toHaveCount(3);
    
    // Check that game information is displayed
    await expect(page.locator('[data-testid="team-name"]').first()).toContainText('Buffalo Bills');
    await expect(page.locator('[data-testid="team-name"]').nth(1)).toContainText('Miami Dolphins');
  });

  test('should allow selecting a team for a game', async ({ page }) => {
    await page.goto('/groups/test-group');
    
    // Wait for games to load
    await expect(page.locator('[data-testid="game-pick-row"]')).toHaveCount(3);
    
    // Click on away team for first game (Buffalo Bills)
    await page.click('[data-testid="pick-away-team"]:first-child');
    
    // Verify team is selected
    await expect(page.locator('[data-testid="pick-away-team"]:first-child')).toHaveClass(/selected/);
    
    // Click on home team for same game (should deselect away team)
    await page.click('[data-testid="pick-home-team"]:first-child');
    
    // Verify home team is now selected and away team is not
    await expect(page.locator('[data-testid="pick-home-team"]:first-child')).toHaveClass(/selected/);
    await expect(page.locator('[data-testid="pick-away-team"]:first-child')).not.toHaveClass(/selected/);
  });

  test('should allow setting confidence levels', async ({ page }) => {
    await page.goto('/groups/test-group');
    
    // Wait for games to load
    await expect(page.locator('[data-testid="game-pick-row"]')).toHaveCount(3);
    
    // Select a team first
    await page.click('[data-testid="pick-away-team"]:first-child');
    
    // Open confidence picker
    await page.click('[data-testid="confidence-picker"]:first-child');
    
    // Select confidence level (e.g., 5)
    await page.click('[data-testid="confidence-option"][data-value="5"]');
    
    // Verify confidence is set
    await expect(page.locator('[data-testid="confidence-display"]:first-child')).toContainText('5');
  });

  test('should validate that confidence levels are unique', async ({ page }) => {
    await page.goto('/groups/test-group');
    
    // Wait for games to load
    await expect(page.locator('[data-testid="game-pick-row"]')).toHaveCount(3);
    
    // Set first pick with confidence 5
    await page.click('[data-testid="pick-away-team"]:first-child');
    await page.click('[data-testid="confidence-picker"]:first-child');
    await page.click('[data-testid="confidence-option"][data-value="5"]');
    
    // Try to set second pick with same confidence
    await page.click('[data-testid="pick-home-team"]', { nth: 1 });
    await page.click('[data-testid="confidence-picker"]', { nth: 1 });
    
    // Confidence 5 should be disabled/unavailable
    await expect(page.locator('[data-testid="confidence-option"][data-value="5"]')).toHaveClass(/disabled/);
  });

  test('should save picks successfully', async ({ page }) => {
    await page.goto('/groups/test-group');
    
    // Wait for games to load
    await expect(page.locator('[data-testid="game-pick-row"]')).toHaveCount(3);
    
    // Make a complete pick (team + confidence)
    await page.click('[data-testid="pick-away-team"]:first-child');
    await page.click('[data-testid="confidence-picker"]:first-child');
    await page.click('[data-testid="confidence-option"][data-value="3"]');
    
    // Save picks
    await page.click('[data-testid="save-picks-button"]');
    
    // Verify save success message
    await expect(page.locator('[data-testid="save-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-success-message"]')).toContainText('Picks saved successfully');
  });

  test('should prevent picks for games that have already started', async ({ page }) => {
    // Mock a game that has started
    await page.route('**/api/groups/test-group/picks?*', async route => {
      const gamesWithStarted = mockGames.map((game, index) => 
        index === 0 ? { ...game, status: 'IN_PROGRESS', meta: { final: false, started: true } } : game
      );
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...createMockPicksResponse('test-group'),
          games: gamesWithStarted
        })
      });
    });

    await page.goto('/groups/test-group');
    
    // Wait for games to load
    await expect(page.locator('[data-testid="game-pick-row"]')).toHaveCount(3);
    
    // First game should be disabled for picking
    await expect(page.locator('[data-testid="pick-away-team"]:first-child')).toHaveClass(/disabled/);
    await expect(page.locator('[data-testid="pick-home-team"]:first-child')).toHaveClass(/disabled/);
    
    // Second game should still be pickable
    await expect(page.locator('[data-testid="pick-away-team"]').nth(1)).not.toHaveClass(/disabled/);
  });

  test('should clear picks when requested', async ({ page }) => {
    await page.goto('/groups/test-group');
    
    // Wait for games to load and make a pick
    await expect(page.locator('[data-testid="game-pick-row"]')).toHaveCount(3);
    await page.click('[data-testid="pick-away-team"]:first-child');
    await page.click('[data-testid="confidence-picker"]:first-child');
    await page.click('[data-testid="confidence-option"][data-value="3"]');
    
    // Verify pick is made
    await expect(page.locator('[data-testid="pick-away-team"]:first-child')).toHaveClass(/selected/);
    
    // Handle browser confirm dialog for clear picks
    page.on('dialog', dialog => dialog.accept());
    
    // Clear picks
    await page.click('[data-testid="clear-picks-button"]');
    
    // Verify picks are cleared
    await expect(page.locator('[data-testid="pick-away-team"]:first-child')).not.toHaveClass(/selected/);
    await expect(page.locator('[data-testid="confidence-display"]:first-child')).toContainText('—');
  });
});
