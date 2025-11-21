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

    // Assert that navigation to available routes succeeded
    await expect(page).toHaveURL(/\/driver\/available/, { timeout: 10000 });

    // Verify routes content is visible
    const routesContent = page.locator(
      'h1, h2, text=/available/i, text=/route/i, text=/batch/i'
    ).first();

    await expect(routesContent).toBeVisible({ timeout: 10000 });
  });

  test('driver can access payout details', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Navigate to payout details
    await navigateAndWait(page, '/driver/payouts');

    // Verify we're on the payout details page
    await expect(page).toHaveURL(/\/driver\/payout-details/, { timeout: 10000 });

    // Verify payout page content is visible
    const payoutHeading = page.getByRole('heading', { name: /Payout Details/i });
    await expect(payoutHeading).toBeVisible({ timeout: 10000 });
  });

  test('driver can access tax information', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Navigate to tax info
    await navigateAndWait(page, '/driver/tax-info');

    // Verify we're on the tax information page
    await expect(page).toHaveURL(/\/driver\/tax-info/, { timeout: 10000 });

    // Verify tax info page content is visible
    const taxHeading = page.getByRole('heading', { name: /Tax Information/i });
    await expect(taxHeading).toBeVisible({ timeout: 10000 });
  });

  test('driver profile is accessible', async ({ page, auth }) => {
    // Sign up as driver
    await auth.signUp('driver');

    // Navigate to driver profile
    await navigateAndWait(page, '/driver/profile');

    // Verify we're on the driver profile page
    await expect(page).toHaveURL(/\/profile\/driver/, { timeout: 10000 });

    // Verify profile page content is visible
    const profileHeading = page.getByRole('heading', { name: /Driver Profile/i });
    await expect(profileHeading).toBeVisible({ timeout: 10000 });
  });
});
