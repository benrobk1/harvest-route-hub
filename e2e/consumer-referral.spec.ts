import { test, expect } from '@playwright/test';

test.describe('Consumer Referral System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display referral code on consumer profile', async ({ page }) => {
    // Login as consumer
    await page.goto('/auth/consumer');
    await page.fill('input[type="email"]', 'consumer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to profile
    await page.goto('/profile/consumer');
    
    // Wait for referral code to load
    await page.waitForSelector('[data-testid="referral-code"]', { timeout: 10000 });
    
    // Verify referral code is displayed
    const referralCode = await page.locator('[data-testid="referral-code"]').textContent();
    expect(referralCode).toBeTruthy();
    expect(referralCode).toMatch(/BH[A-Z0-9]{8}/);
  });

  test('should show referral banner to new users', async ({ page }) => {
    // Visit shop as new user (without login)
    await page.goto('/consumer/shop');
    
    // Should see referral banner
    await expect(page.locator('text=referral')).toBeVisible({ timeout: 5000 });
  });

  test('should track referral signups', async ({ page }) => {
    // Login as consumer with referrals
    await page.goto('/auth/consumer');
    await page.fill('input[type="email"]', 'consumer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to profile
    await page.goto('/profile/consumer');
    
    // Check for referral stats
    await expect(page.locator('text=Referrals')).toBeVisible();
  });

  test('should display credits earned from referrals', async ({ page }) => {
    // Login as consumer
    await page.goto('/auth/consumer');
    await page.fill('input[type="email"]', 'consumer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to profile
    await page.goto('/profile/consumer');
    
    // Wait for credits display
    await page.waitForSelector('[data-testid="credits-balance"]', { timeout: 10000 });
    
    // Verify credits are shown
    await expect(page.locator('[data-testid="credits-balance"]')).toBeVisible();
  });
});
