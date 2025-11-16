import { test, expect } from '@playwright/test';

test.describe('Admin Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to admin dashboard after login', async ({ page }) => {
    // Navigate to admin auth page
    await page.goto('/auth/admin');
    
    // Fill in login credentials
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('**/admin/dashboard');
    
    // Verify admin dashboard elements
    await expect(page.locator('h1')).toContainText('Admin Dashboard');
  });

  test('should approve pending user applications', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/admin');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to user approvals
    await page.goto('/admin/user-approvals');
    
    // Wait for pending applications to load
    await page.waitForSelector('[data-testid="user-application"]', { timeout: 10000 });
    
    // Click approve on first application
    await page.click('[data-testid="approve-user"]');
    
    // Verify success message
    await expect(page.locator('text=approved')).toBeVisible({ timeout: 5000 });
  });

  test('should manage product approvals', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/admin');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to product approvals
    await page.goto('/admin/product-approval');
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-item"]', { timeout: 10000 });
    
    // Approve a product
    await page.click('[data-testid="approve-product"]');
    
    // Verify approval
    await expect(page.locator('text=approved')).toBeVisible({ timeout: 5000 });
  });

  test('should view analytics and financials', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/admin');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to analytics
    await page.goto('/admin/analytics-financials');
    
    // Verify analytics elements
    await expect(page.locator('text=Revenue')).toBeVisible();
    await expect(page.locator('text=Orders')).toBeVisible();
  });

  test('should manage market configuration', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/admin');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to market config
    await page.goto('/admin/market-config');
    
    // Wait for form to load
    await page.waitForSelector('input[name="delivery_fee"]', { timeout: 10000 });
    
    // Update delivery fee
    await page.fill('input[name="delivery_fee"]', '10.00');
    
    // Save changes
    await page.click('button[type="submit"]');
    
    // Verify success
    await expect(page.locator('text=saved')).toBeVisible({ timeout: 5000 });
  });
});
