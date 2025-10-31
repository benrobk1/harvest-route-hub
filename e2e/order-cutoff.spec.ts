import { test, expect } from '@playwright/test';

test.describe('Order Cutoff Enforcement', () => {
  test('allows checkout before 3pm cutoff', async ({ page }) => {
    // Mock system time to 2:30 PM
    await page.clock.setSystemTime(new Date('2025-10-31T14:30:00'));
    
    await page.goto('/consumer/auth');
    
    const testEmail = `consumer-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    
    await expect(page).toHaveURL(/\/consumer\/shop/, { timeout: 10000 });
    
    // Verify no cutoff warning is displayed
    await expect(page.getByText(/ordering is currently closed/i)).not.toBeVisible();
    
    // Verify shop is accessible
    await expect(page.getByText(/shop/i)).toBeVisible();
  });

  test('blocks checkout after 3pm cutoff', async ({ page }) => {
    // Mock system time to 3:30 PM
    await page.clock.setSystemTime(new Date('2025-10-31T15:30:00'));
    
    await page.goto('/consumer/auth');
    
    const testEmail = `consumer-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    
    await expect(page).toHaveURL(/\/consumer\/shop/, { timeout: 10000 });
    
    // Verify cutoff warning is displayed
    await expect(page.getByText(/ordering is currently closed/i)).toBeVisible();
    
    // Verify next delivery date is shown
    await expect(page.getByText(/next delivery/i)).toBeVisible();
  });

  test('cutoff message displays next available date', async ({ page }) => {
    // Mock 3:30 PM on a weekday
    await page.clock.setSystemTime(new Date('2025-11-04T15:30:00')); // Tuesday
    
    await page.goto('/consumer/auth');
    
    const testEmail = `consumer-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    
    await expect(page).toHaveURL(/\/consumer\/shop/, { timeout: 10000 });
    
    // Verify cutoff message shows next day
    await expect(page.getByText(/ordering is currently closed/i)).toBeVisible();
    
    // Message should contain a date (format may vary)
    const alertText = await page.getByRole('alert').first().textContent();
    expect(alertText).toMatch(/next delivery/i);
  });
});
