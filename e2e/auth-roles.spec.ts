import { test, expect } from './support/playwright';

test.describe('Role-Based Access Control', () => {
  test('farmer cannot access consumer routes', async ({ page }) => {
    await page.goto('/farmer/auth');
    
    const testEmail = `farmer-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    
    // Should redirect to farmer dashboard
    await expect(page).toHaveURL(/\/farmer\/dashboard/, { timeout: 10000 });
    
    // Attempt to access consumer route
    await page.goto('/consumer/shop');
    
    // Should be redirected back to farmer dashboard
    await expect(page).toHaveURL(/\/farmer\/dashboard/, { timeout: 5000 });
  });

  test('driver cannot access admin routes', async ({ page }) => {
    await page.goto('/driver/auth');
    
    const testEmail = `driver-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    
    // Should redirect to driver dashboard
    await expect(page).toHaveURL(/\/driver\/dashboard/, { timeout: 10000 });
    
    // Attempt to access admin route
    await page.goto('/admin/dashboard');
    
    // Should be redirected back to driver dashboard
    await expect(page).toHaveURL(/\/driver\/dashboard/, { timeout: 5000 });
  });

  test('consumer cannot access farmer routes', async ({ page }) => {
    await page.goto('/consumer/auth');
    
    const testEmail = `consumer-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    
    // Should redirect to shop
    await expect(page).toHaveURL(/\/consumer\/shop/, { timeout: 10000 });
    
    // Attempt to access farmer route
    await page.goto('/farmer/dashboard');
    
    // Should be redirected back to shop
    await expect(page).toHaveURL(/\/consumer\/shop/, { timeout: 5000 });
  });

  test('unauthenticated users redirect to home', async ({ page }) => {
    // Attempt to access protected route without auth
    await page.goto('/admin/dashboard');
    
    // Should redirect to home
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});
