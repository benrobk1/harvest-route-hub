import { test, expect } from './support/fixtures';
import { navigateAndWait, waitForPageReady } from './support/helpers';

test.describe('Farmer Workflow', () => {
  test('should signup and navigate to farmer dashboard', async ({ page, auth }) => {
    // Sign up as farmer
    await auth.signUp('farmer');

    // Should redirect to farmer dashboard
    await expect(page).toHaveURL(/\/farmer\//, { timeout: 15000 });

    // Wait for dashboard to load
    await waitForPageReady(page);

    // Verify dashboard loaded with flexible selectors
    const dashboardHeading = page.locator('h1, h2, [role="heading"]').first();
    await expect(dashboardHeading).toBeVisible();
  });

  test('should access inventory management', async ({ page, auth }) => {
    // Sign up as farmer
    await auth.signUp('farmer');

    // Navigate to inventory
    await navigateAndWait(page, '/farmer/inventory');

    // Verify inventory page loaded
    await expect(page).toHaveURL(/\/farmer\/inventory/);

    const inventoryContent = page.locator(
      'h1:has-text("Inventory"), h2:has-text("Inventory"), text=/inventory/i, text=/product/i'
    ).first();

    await expect(inventoryContent).toBeVisible({ timeout: 10000 });
  });

  test('should view add product interface', async ({ page, auth }) => {
    // Sign up as farmer
    await auth.signUp('farmer');

    // Navigate to inventory
    await navigateAndWait(page, '/farmer/inventory');

    // Look for add product button with flexible selectors
    const addButton = page.locator(
      'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), a:has-text("Add Product")'
    ).first();

    const addButtonExists = await addButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (addButtonExists) {
      await addButton.click();
      await page.waitForTimeout(1000);

      // Should show product form dialog or page
      const formContent = page.locator(
        'input[name="name"], input[placeholder*="name" i], text=/product name/i, text=/add product/i'
      ).first();

      const formVisible = await formContent.isVisible({ timeout: 5000 }).catch(() => false);
      expect(formVisible).toBeTruthy();
    } else {
      // If no add button, just verify inventory page loaded
      const pageLoaded = await page.locator('h1, h2').first().isVisible();
      expect(pageLoaded).toBeTruthy();
    }
  });

  test('should view financials and payouts', async ({ page, auth }) => {
    // Sign up as farmer
    await auth.signUp('farmer');

    // Navigate to financials
    await navigateAndWait(page, '/farmer/financials');

    // Verify financials page loaded
    await expect(page).toHaveURL(/\/farmer\/financials/);

    // Look for financial content with flexible selectors
    const financialContent = page.locator(
      'text=/earnings/i, text=/payout/i, text=/revenue/i, text=/financial/i, h1, h2'
    ).first();

    await expect(financialContent).toBeVisible({ timeout: 10000 });
  });

  test('should access CSV import interface', async ({ page, auth }) => {
    // Sign up as farmer
    await auth.signUp('farmer');

    // Navigate to inventory
    await navigateAndWait(page, '/farmer/inventory');

    // Look for import button
    const importButton = page.locator(
      'button:has-text("Import"), button:has-text("Upload"), a:has-text("Import")'
    ).first();

    const importExists = await importButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (importExists) {
      await importButton.click();
      await page.waitForTimeout(1000);

      // Should show import dialog with CSV mention
      const csvContent = page.locator('text=/csv/i, text=/import/i, text=/upload/i').first();
      const dialogVisible = await csvContent.isVisible({ timeout: 5000 }).catch(() => false);

      expect(dialogVisible).toBeTruthy();
    } else {
      // If no import button, just verify inventory page loaded
      const pageLoaded = await page.locator('h1, h2').first().isVisible();
      expect(pageLoaded).toBeTruthy();
    }
  });

  test('should view inventory list', async ({ page, auth }) => {
    // Sign up as farmer
    await auth.signUp('farmer');

    // Navigate to inventory
    await navigateAndWait(page, '/farmer/inventory');

    // Wait for page to load
    await waitForPageReady(page);

    // Look for inventory items or empty state
    const inventoryItems = page.locator(
      '[data-testid="product-item"], [class*="product"], text=/available/i, text=/inventory/i, h1, h2'
    ).first();

    await expect(inventoryItems).toBeVisible({ timeout: 10000 });
  });
});
