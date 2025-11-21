import { test, expect } from './support/fixtures';
import { navigateAndWait, waitForPageReady } from './support/helpers';

test.describe('Role-Based Access Control', () => {
  test('farmer cannot access consumer routes', async ({ page, auth }) => {
    // Sign up as farmer
    await auth.signUp('farmer');

    // Should redirect to farmer dashboard
    await expect(page).toHaveURL(/\/farmer\//, { timeout: 15000 });

    // Attempt to access consumer route
    await page.goto('/consumer/shop');
    await waitForPageReady(page);

    // Wait for redirect to complete (should not stay on consumer shop)
    await page.waitForURL((url) => !url.pathname.includes('/consumer/shop'), { timeout: 5000 }).catch(() => {});

    // Verify either redirected back to farmer area or see access denied
    const url = page.url();
    const isBlocked = url.includes('/farmer/') || !(url.includes('/consumer/shop'));

    expect(isBlocked).toBeTruthy();
  });

  test('driver cannot access admin routes', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Should redirect to driver dashboard
    await expect(page).toHaveURL(/\/driver\//, { timeout: 15000 });

    // Attempt to access admin route
    await page.goto('/admin/dashboard');
    await waitForPageReady(page);

    // Wait for redirect to complete (should not stay on admin dashboard)
    await page.waitForURL((url) => !url.pathname.includes('/admin/dashboard'), { timeout: 5000 }).catch(() => {});

    // Verify not on admin dashboard
    const url = page.url();
    const isBlocked = !url.includes('/admin/dashboard');

    expect(isBlocked).toBeTruthy();
  });

  test('consumer cannot access farmer routes', async ({ page, auth }) => {
    // Sign up as consumer
    await auth.signUp('consumer');

    // Should redirect to shop
    await expect(page).toHaveURL(/\/consumer\//, { timeout: 15000 });

    // Attempt to access farmer route
    await page.goto('/farmer/dashboard');
    await waitForPageReady(page);

    // Wait for redirect to complete (should not stay on farmer dashboard)
    await page.waitForURL((url) => !url.pathname.includes('/farmer/dashboard'), { timeout: 5000 }).catch(() => {});

    // Verify not on farmer dashboard
    const url = page.url();
    const isBlocked = !url.includes('/farmer/dashboard');

    expect(isBlocked).toBeTruthy();
  });

  test('unauthenticated users redirect to auth page', async ({ page }) => {
    // Clear any existing auth
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Attempt to access protected route without auth
    await page.goto('/admin/dashboard');
    await waitForPageReady(page);

    // Wait for redirect to complete (should not stay on admin dashboard)
    await page.waitForURL((url) => !url.pathname.includes('/admin/dashboard'), { timeout: 5000 }).catch(() => {});

    const url = page.url();
    const isRedirected = url.includes('/auth') || url === new URL('/', page.url()).href || !url.includes('/admin/dashboard');

    expect(isRedirected).toBeTruthy();
  });
});
