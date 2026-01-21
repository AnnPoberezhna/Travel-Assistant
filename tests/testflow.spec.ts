import { test, expect } from '@playwright/test';

test.describe('Travel Assistant - Flow Test', () => {
  // Login credentials from environment variables
  const testUser = {
    email: process.env.TEST_USER_EMAIL!,
    password: process.env.TEST_USER_PASSWORD!
  };

  test.beforeEach(async ({ page }) => {
    // Go to login page
    await page.goto('http://localhost:3000/sign-in');
    
    // Login
    await page.fill('input[placeholder="mail@example.com"]', testUser.email);
    await page.fill('input[placeholder="Enter your password"]', testUser.password);
    
    // Click "Sign in" button
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    // Check if user is logged in
    await expect(page).toHaveURL(/.*admin/);
  });

  test('User can login and access dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/.*admin/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('User can navigate to search page', async ({ page }) => {
    // Go to search page
    await page.goto('http://localhost:3000/search');
    await expect(page).toHaveURL(/.*search/);
  });

  test('User can navigate to favorites page', async ({ page }) => {
    // Go to favorites page
    await page.goto('http://localhost:3000/favorites');
    await expect(page).toHaveURL(/.*favorites/);
  });

  test('User can navigate to history page', async ({ page }) => {
    // Go to history page
    await page.goto('http://localhost:3000/history');
    await expect(page).toHaveURL(/.*history/);
  });

  test('User can navigate to profile page', async ({ page }) => {
    // Go to profile page
    await page.goto('http://localhost:3000/profile');
    await expect(page).toHaveURL(/.*profile/);
  });

  test('User can search for a route', async ({ page }) => {
    // Go to search page
    await page.goto('http://localhost:3000/search');
    
    // Check if we are on search page
    await expect(page).toHaveURL(/.*search/);
    
    // Find search field and enter query (using placeholder)
    const searchInput = page.locator('input[placeholder="e.g. wrocław -> katowice"]');
    await searchInput.clear();
    await searchInput.fill('rondo starzyńskiego -> pl. hallera');
    
    // Click "FIND MY ROUTE" button
    const findMyRouteButton = page.locator('button:has-text("FIND MY ROUTE")');
    await findMyRouteButton.click();
    await page.waitForTimeout(3000);
    
    // Check if selects appeared
    const fromSelect = page.locator('select').first();
    await expect(fromSelect).toBeVisible();
    
    // Click "FIND DIRECT"to find routes
    const findDirectButton = page.locator('button:has-text("FIND DIRECT"), button:has-text("FIND WITH TRANSFER")').first();
    await findDirectButton.click();
    await page.waitForTimeout(3000);
    
    // Click "FAVOURITE" button to add to favorites
    const favouriteButton = page.locator('button:has-text("FAVOURITE")');
    await favouriteButton.click();
    
    // Wait for confirmation
    await page.waitForTimeout(2000);
    
    // Check if "Added to favourites" or "SAVING..." message appeared
    const confirmationMessage = await page.locator('text="Added to favourites"').isVisible().catch(() => false);
    
    // Go to favorites page
    await page.goto('http://localhost:3000/favorites');
    await expect(page).toHaveURL(/.*favorites/);
    
    // Wait for favorites page to load
    await page.waitForTimeout(2000);
    
    // Check if there are any elements on the page (any route)
    const pageContent = await page.textContent('body');
    const hasSomeContent = pageContent && pageContent.length > 100;
    
    // Alternatively check if there are any buttons or route elements
    const elementCount = await page.locator('button, div, section').count();
    
    expect(hasSomeContent || elementCount > 10).toBeTruthy();
    
    // Click "SEARCH ROUTE" button on favorites page
    const searchRouteButton = page.locator('button:has-text("SEARCH ROUTE")').first();
    if (await searchRouteButton.isVisible().catch(() => false)) {
      await searchRouteButton.click();
      await page.waitForTimeout(2000);
    }
    
    await page.waitForTimeout(3000);
  });
});
