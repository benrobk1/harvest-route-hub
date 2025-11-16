import { test, expect } from '@playwright/test';

test.describe('Farmer Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should login and navigate to farmer dashboard', async ({ page }) => {
    // Navigate to farmer auth
    await page.goto('/auth/farmer');
    
    // Fill credentials
    await page.fill('input[type="email"]', 'farmer@test.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('**/farmer/dashboard');
    
    // Verify dashboard
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should add a new product', async ({ page }) => {
    // Login
    await page.goto('/auth/farmer');
    await page.fill('input[type="email"]', 'farmer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to inventory
    await page.goto('/farmer/inventory');
    
    // Click add product
    await page.click('button:has-text("Add Product")');
    
    // Fill product form
    await page.fill('input[name="name"]', 'Fresh Tomatoes');
    await page.fill('textarea[name="description"]', 'Organic heirloom tomatoes');
    await page.fill('input[name="price"]', '5.99');
    await page.fill('input[name="available_quantity"]', '50');
    await page.selectOption('select[name="unit"]', 'lb');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify success
    await expect(page.locator('text=Fresh Tomatoes')).toBeVisible({ timeout: 5000 });
  });

  test('should view financials and payouts', async ({ page }) => {
    // Login
    await page.goto('/auth/farmer');
    await page.fill('input[type="email"]', 'farmer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to financials
    await page.goto('/farmer/financials');
    
    // Verify financial elements
    await expect(page.locator('text=Total Earnings')).toBeVisible();
    await expect(page.locator('text=Pending Payout')).toBeVisible();
  });

  test('should bulk import products via CSV', async ({ page }) => {
    // Login
    await page.goto('/auth/farmer');
    await page.fill('input[type="email"]', 'farmer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to inventory
    await page.goto('/farmer/inventory');
    
    // Click import button
    await page.click('button:has-text("Import")');
    
    // Verify import dialog
    await expect(page.locator('text=CSV')).toBeVisible();
  });

  test('should view weekly inventory review', async ({ page }) => {
    // Login
    await page.goto('/auth/farmer');
    await page.fill('input[type="email"]', 'farmer@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to inventory
    await page.goto('/farmer/inventory');
    
    // Wait for inventory to load
    await page.waitForSelector('[data-testid="product-item"]', { timeout: 10000 });
    
    // Verify inventory elements
    await expect(page.locator('text=Available')).toBeVisible();
  });
});
