import { test, expect } from '@playwright/test';

test.describe('Subscription Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display subscription options on consumer profile', async ({ page }) => {
    // Login as consumer
    await page.goto('/auth/consumer');
    await page.fill('input[type="email"]', 'consumer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to profile
    await page.goto('/profile/consumer');
    
    // Wait for subscription section
    await page.waitForSelector('[data-testid="subscription-section"]', { timeout: 10000 });
    
    // Verify subscription options are visible
    await expect(page.locator('text=Subscription')).toBeVisible();
  });

  test('should show trial status for new users', async ({ page }) => {
    // Login as new consumer
    await page.goto('/auth/consumer');
    await page.fill('input[type="email"]', 'newconsumer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Check for trial banner
    await expect(page.locator('text=trial')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to subscription checkout', async ({ page }) => {
    // Login as consumer
    await page.goto('/auth/consumer');
    await page.fill('input[type="email"]', 'consumer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to profile
    await page.goto('/profile/consumer');
    
    // Click subscribe button
    await page.click('button:has-text("Subscribe")');
    
    // Should redirect to checkout or show subscription form
    await expect(page.locator('text=Plan')).toBeVisible({ timeout: 5000 });
  });

  test('should display subscription benefits', async ({ page }) => {
    // Visit consumer shop
    await page.goto('/consumer/shop');
    
    // Check for subscription messaging
    await expect(page.locator('text=premium').or(page.locator('text=subscription'))).toBeVisible({ timeout: 5000 });
  });
});
