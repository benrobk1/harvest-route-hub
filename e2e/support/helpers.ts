import { Page, expect } from '@playwright/test';

/**
 * Wait for network to be idle and any loading indicators to disappear
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  // Wait for common loading indicators to disappear
  await page.waitForSelector('[data-loading="true"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
  await page.waitForSelector('.loading', { state: 'hidden', timeout: 5000 }).catch(() => {});
}

/**
 * Fill a form field by label text
 */
export async function fillByLabel(page: Page, labelText: string, value: string) {
  const input = page.locator(`label:has-text("${labelText}") + input, label:has-text("${labelText}") input`);
  await input.fill(value);
}

/**
 * Navigate and wait for the page to be fully loaded
 */
export async function navigateAndWait(page: Page, url: string) {
  await page.goto(url);
  await waitForPageReady(page);
}

/**
 * Click a button and wait for navigation
 */
export async function clickAndWaitForNavigation(page: Page, selector: string) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }),
    page.click(selector),
  ]);
}

/**
 * Add a product to cart in consumer shop
 */
export async function addProductToCart(page: Page, productName?: string) {
  await navigateAndWait(page, '/consumer/shop');

  if (productName) {
    // Find and click add to cart for specific product
    const productCard = page.locator(`[data-testid="product-card"]:has-text("${productName}")`);
    await productCard.locator('button:has-text("Add to Cart")').click();
  } else {
    // Click first available add to cart button
    await page.locator('button:has-text("Add to Cart")').first().click();
  }

  // Wait for cart to update
  await page.waitForTimeout(500);
}

/**
 * Navigate to checkout
 */
export async function goToCheckout(page: Page) {
  await page.getByRole('button', { name: /cart/i }).click();
  await page.getByRole('button', { name: /checkout/i }).click();
  await waitForPageReady(page);
}

/**
 * Fill delivery address form
 */
export async function fillDeliveryAddress(page: Page, address: {
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  await page.fill('input[name="street"]', address.street);
  await page.fill('input[name="city"]', address.city);
  await page.fill('input[name="state"]', address.state);
  await page.fill('input[name="zip"]', address.zip);
}

/**
 * Wait for toast notification and verify message
 */
export async function expectToast(page: Page, message: string | RegExp, type: 'success' | 'error' | 'info' = 'success') {
  const toast = page.locator(`[role="status"], [data-testid="toast"], .toast`);
  await expect(toast).toBeVisible({ timeout: 5000 });

  if (typeof message === 'string') {
    await expect(toast).toContainText(message);
  } else {
    await expect(toast).toContainText(message);
  }
}

/**
 * Mock system time for date-dependent tests
 */
export async function mockSystemTime(page: Page, date: Date) {
  await page.addInitScript(`{
    Date.now = () => ${date.getTime()};
    const OriginalDate = Date;
    Date = class extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) {
          super(${date.getTime()});
        } else {
          super(...args);
        }
      }
    };
  }`);
}

/**
 * Generate unique test email
 */
export function generateTestEmail(role: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `test-${role}-${timestamp}-${random}@example.com`;
}

/**
 * Wait for element and verify visibility with custom timeout
 */
export async function waitAndExpectVisible(page: Page, selector: string, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
  await expect(page.locator(selector)).toBeVisible();
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Select option by label or value
 */
export async function selectOption(page: Page, selectSelector: string, optionValue: string) {
  await page.selectOption(selectSelector, optionValue);
}

/**
 * Upload file to input
 */
export async function uploadFile(page: Page, inputSelector: string, filePath: string) {
  await page.setInputFiles(inputSelector, filePath);
}

/**
 * Clear browser storage (localStorage, sessionStorage, cookies)
 */
export async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}
