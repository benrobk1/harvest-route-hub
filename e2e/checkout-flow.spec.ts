import { test, expect } from './support/playwright';

test.describe('Consumer Checkout Flow', () => {
  test('complete signup and shop flow', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Click on Consumer signup
    await page.getByText(/consumer/i).first().click();
    
    // Wait for auth page to load
    await expect(page).toHaveURL(/\/consumer\/auth/);
    
    // Fill signup form
    const testEmail = `test-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    
    // Submit form
    await page.getByRole('button', { name: /sign up/i }).click();
    
    // Should redirect to shop after signup
    await expect(page).toHaveURL(/\/consumer\/shop/, { timeout: 10000 });
    
    // Verify shop page loaded
    await expect(page.getByText(/shop/i)).toBeVisible();
  });

  test('add item to cart', async ({ page }) => {
    await page.goto('/consumer/shop');
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 5000 });
    
    // Click add to cart on first product
    await page.getByRole('button', { name: /add to cart/i }).first().click();
    
    // Verify cart updated
    await expect(page.getByText(/1/)).toBeVisible();
  });

  test('navigate to checkout', async ({ page }) => {
    await page.goto('/consumer/shop');
    
    // Open cart and proceed to checkout
    await page.getByRole('button', { name: /cart/i }).click();
    await page.getByRole('button', { name: /checkout/i }).click();
    
    // Should be on checkout page
    await expect(page).toHaveURL(/\/consumer\/checkout/);
    await expect(page.getByText(/delivery address/i)).toBeVisible();
  });
});
