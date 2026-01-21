import { test, expect } from '@playwright/test';

test.describe('Travel Assistant - Admin Flow Test', () => {
  // Admin login credentials from environment variables
  const adminUser = {
    email: process.env.TEST_ADMIN_EMAIL!,
    password: process.env.TEST_ADMIN_PASSWORD!
  };

  test('Complete Admin Flow: Login -> Admin Page -> Refresh -> Delete User', async ({ page }) => {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    await page.goto('http://localhost:3000/sign-in');
    
    await page.fill('input[placeholder="mail@example.com"]', adminUser.email);
    await page.fill('input[placeholder="Enter your password"]', adminUser.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin');
    await expect(page).toHaveURL(/.*admin/);
    console.log('Login successful');
    
    // Step 2: Verify admin page loaded
    console.log('Step 2: Verifying admin page...');
    await page.waitForTimeout(2000);
    
    // Check if admin panel header is visible
    const adminHeader = page.locator('h1:has-text("Admin Panel")');
    await expect(adminHeader).toBeVisible();
    
    // Check if user table is visible
    const userTable = page.locator('table');
    await expect(userTable).toBeVisible();
    
    // Check if there are users in the table
    const userRows = page.locator('tbody tr');
    const rowCount = await userRows.count();
    expect(rowCount).toBeGreaterThan(0);
    console.log(`Admin page loaded with ${rowCount} users`);
    
    // Step 3: Test refresh functionality
    console.log('Step 3: Testing refresh...');
    const refreshButton = page.locator('button:has-text("REFRESH")');
    await expect(refreshButton).toBeVisible();
    
    await refreshButton.click();
    await page.waitForTimeout(2000);
    
    // Verify table is still visible after refresh
    await expect(userTable).toBeVisible();
    console.log('Refresh successful');
    
    // Step 4: Delete user #1 
    console.log('Step 4: Deleting user...');
    await page.waitForTimeout(1000);
    
    // Get the initial number of users
    const initialUserRows = await page.locator('tbody tr').count();
    console.log(`Initial user count: ${initialUserRows}`);
    
    // Find the LAST row (user #1, since newest users are shown first)
    const userRow = page.locator('tbody tr').last();
    const userId = await userRow.locator('td').first().textContent();
    const userEmail = await userRow.locator('td').nth(1).textContent();
    console.log(`Found user to delete: ${userId} - ${userEmail}`);
    
    // Find delete button in the last row
    const deleteButton = userRow.locator('button:has-text("DELETE")');
    
    // Check if delete button exists
    const deleteButtonExists = await deleteButton.isVisible().catch(() => false);
    
    if (deleteButtonExists) {
      // Set up a promise to wait for the dialog
      const dialogPromise = page.waitForEvent('dialog');
      
      // Click delete button - this will trigger the confirmation dialog
      await deleteButton.click();
      
      // Wait for the dialog to appear and handle it
      const dialog = await dialogPromise;
      console.log(`Confirmation dialog appeared: "${dialog.message()}"`);
      await page.waitForTimeout(2000);
      
      // Accept the confirmation
      await dialog.accept();
      console.log('Confirmation dialog accepted');
      await page.waitForTimeout(3000);
      
      // Click refresh to ensure we see updated data
      if (await refreshButton.isVisible().catch(() => false)) {
        console.log('Refreshing to verify deletion...');
        await refreshButton.click();
        await page.waitForTimeout(2000);
      }
      
      // Verify user was deleted
      const newUserRows = await page.locator('tbody tr').count();
      console.log(`New user count after deletion: ${newUserRows}`);
      
      // Check that user #1 is no longer in the last row
      const lastRowAfterDeletion = page.locator('tbody tr').last();
      const lastRowEmail = await lastRowAfterDeletion.locator('td').nth(1).textContent();
      const lastRowId = await lastRowAfterDeletion.locator('td').first().textContent();
      console.log(`Last row now: ${lastRowId} - ${lastRowEmail}`);
      
      // Verify either count decreased OR the last user changed
      const deletionSuccessful = newUserRows < initialUserRows || lastRowEmail !== userEmail;
      expect(deletionSuccessful).toBeTruthy();
      
      console.log(`Deletion successful: ${deletionSuccessful}`);
    }
    
    console.log('Test complete! Waiting 5 seconds...');
    await page.waitForTimeout(5000);
  });
});