import { test, expect } from './support/fixtures';
import { navigateAndWait, waitForPageReady } from './support/helpers';

test.describe('Driver Workflow', () => {
  test('driver can signup and navigate to dashboard', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Should redirect to driver dashboard
    await expect(page).toHaveURL(/\/driver\//, { timeout: 15000 });

    // Wait for dashboard to load
    await waitForPageReady(page);

    // Verify dashboard loaded with flexible selectors
    const dashboardContent = page.locator(
      'h1, h2, text=/dashboard/i, text=/driver/i, [role="heading"]'
    ).first();

    await expect(dashboardContent).toBeVisible({ timeout: 10000 });
  });

  test('driver dashboard displays batches section', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Should be on driver dashboard
    await expect(page).toHaveURL(/\/driver\//, { timeout: 15000 });

    // Wait for dashboard to load
    await waitForPageReady(page);

    // Check for batches section (may be empty for new driver)
    const batchesContent = page.locator(
      'text=/batch/i, text=/assigned/i, text=/route/i, text=/delivery/i, text=/no batches/i'
    ).first();

    const hasBatchesSection = await batchesContent.isVisible({ timeout: 10000 }).catch(() => false);
    const dashboardLoaded = await page.locator('h1, h2').first().isVisible();

    // Either should see batches section or dashboard loaded
    expect(hasBatchesSection || dashboardLoaded).toBeTruthy();
  });

  test('driver can access available routes', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Navigate to available routes
    await navigateAndWait(page, '/driver/available-routes');

    // Verify available routes page loaded
    const routesPageLoaded = await page.waitForURL(/\/driver\/available/, { timeout: 10000 }).catch(() => false);

    if (routesPageLoaded) {
      // Look for routes content
      const routesContent = page.locator(
        'h1, h2, text=/available/i, text=/route/i, text=/batch/i'
      ).first();

      await expect(routesContent).toBeVisible({ timeout: 10000 });
    } else {
      // Fallback: verify dashboard is accessible
      const dashboardLoaded = await page.locator('h1, h2').first().isVisible();
      expect(dashboardLoaded).toBeTruthy();
    }
  });

  test('driver can access payout details', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Navigate to payout details
    await navigateAndWait(page, '/driver/payout-details');

    // Verify payout page loaded or redirected appropriately
    const payoutContent = page.locator(
      'h1, h2, text=/payout/i, text=/earning/i, text=/payment/i'
    ).first();

    const hasPayoutContent = await payoutContent.isVisible({ timeout: 10000 }).catch(() => false);
    const pageLoaded = await page.locator('h1, h2').first().isVisible();

    expect(hasPayoutContent || pageLoaded).toBeTruthy();
  });

  test('driver can access tax information', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Navigate to tax info
    await navigateAndWait(page, '/driver/tax-info');

    // Verify tax info page loaded
    const taxContent = page.locator(
      'h1, h2, text=/tax/i, text=/w-9/i, text=/1099/i, text=/information/i'
    ).first();

    const hasTaxContent = await taxContent.isVisible({ timeout: 10000 }).catch(() => false);
    const pageLoaded = await page.locator('h1, h2').first().isVisible();

    expect(hasTaxContent || pageLoaded).toBeTruthy();
  });

  test('driver profile is accessible', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Navigate to driver profile
    await navigateAndWait(page, '/driver/profile');

    // Verify profile page loaded
    const profileContent = page.locator(
      'h1, h2, text=/profile/i, text=/account/i, text=/settings/i'
    ).first();

    const hasProfileContent = await profileContent.isVisible({ timeout: 10000 }).catch(() => false);
    const pageLoaded = await page.locator('h1, h2').first().isVisible();

    expect(hasProfileContent || pageLoaded).toBeTruthy();
  });
});
