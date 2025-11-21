import { test, expect } from './support/fixtures';
import { navigateAndWait, waitForPageReady } from './support/helpers';

test.describe('Admin Workflow', () => {
  test('should signup and navigate to admin dashboard', async ({ page, auth }) => {
    // Sign up as admin
    await auth.signUp('admin');

    // Should redirect to admin dashboard
    await expect(page).toHaveURL(/\/admin\//, { timeout: 15000 });

    // Wait for dashboard to load
    await waitForPageReady(page);

    // Verify dashboard loaded
    const dashboardHeading = page.locator('h1, h2, [role="heading"]').first();
    await expect(dashboardHeading).toBeVisible();
  });

  test('should access user approvals page', async ({ page, auth }) => {
    // Sign up as admin
    await auth.signUp('admin');

    // Navigate to user approvals
    await navigateAndWait(page, '/admin/approvals');

    // Verify user approvals page loaded
    await expect(page).toHaveURL(/\/admin\/approvals/);

    // Look for user approval content with flexible selectors
    const approvalsContent = page.locator(
      'h1:has-text("User"), h2:has-text("Approval"), text=/approval/i, text=/pending/i, text=/user/i'
    ).first();

    // Wait for content or empty state
    const contentVisible = await approvalsContent.isVisible({ timeout: 10000 }).catch(() => false);
    const pageHeading = await page.locator('h1, h2').first().isVisible();

    expect(contentVisible || pageHeading).toBeTruthy();
  });

  test('should access product approval page', async ({ page, auth }) => {
    // Sign up as admin
    await auth.signUp('admin');

    // Navigate to product approvals
    await navigateAndWait(page, '/admin/products');

    // Verify product approval page loaded
    await expect(page).toHaveURL(/\/admin\/products/);

    // Look for product approval content
    const productContent = page.locator(
      'h1, h2, text=/product/i, text=/approval/i, text=/pending/i'
    ).first();

    await expect(productContent).toBeVisible({ timeout: 10000 });
  });

  test('should view analytics and financials', async ({ page, auth }) => {
    // Sign up as admin
    await auth.signUp('admin');

    // Navigate to analytics
    await navigateAndWait(page, '/admin/analytics-financials');

    // Verify analytics page loaded
    await expect(page).toHaveURL(/\/admin\/analytics/);

    // Look for analytics content with flexible selectors
    const analyticsContent = page.locator(
      'text=/revenue/i, text=/orders/i, text=/analytics/i, text=/financial/i, h1, h2'
    ).first();

    await expect(analyticsContent).toBeVisible({ timeout: 10000 });
  });

  test('should access market configuration', async ({ page, auth }) => {
    // Sign up as admin
    await auth.signUp('admin');

    // Navigate to market config
    await navigateAndWait(page, '/admin/market-config');

    // Verify market config page loaded
    await expect(page).toHaveURL(/\/admin\/market-config/);

    // Look for config form with flexible selectors
    const configContent = page.locator(
      'input, select, textarea, h1, h2, text=/config/i, text=/settings/i, text=/market/i'
    ).first();

    await expect(configContent).toBeVisible({ timeout: 10000 });
  });

  test('should access monitoring page', async ({ page, auth }) => {
    // Sign up as admin
    await auth.signUp('admin');

    // Navigate to monitoring
    await navigateAndWait(page, '/admin/monitoring');

    // Verify monitoring page loaded
    await expect(page).toHaveURL(/\/admin\/monitoring/);

    // Look for monitoring content
    const monitoringContent = page.locator(
      'h1, h2, text=/monitor/i, text=/system/i, text=/health/i'
    ).first();

    await expect(monitoringContent).toBeVisible({ timeout: 10000 });
  });

  test('should access admin roles management', async ({ page, auth }) => {
    // Sign up as admin
    await auth.signUp('admin');

    // Navigate to admin roles
    await navigateAndWait(page, '/admin/roles');

    // Verify admin roles page loaded
    await expect(page).toHaveURL(/\/admin\/roles/);

    // Look for roles content
    const rolesContent = page.locator(
      'h1, h2, text=/role/i, text=/admin/i, text=/permission/i'
    ).first();

    await expect(rolesContent).toBeVisible({ timeout: 10000 });
  });
});
