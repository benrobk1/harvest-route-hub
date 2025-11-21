import { test as base, expect, Page } from '@playwright/test';

/**
 * Authentication helper functions
 */
export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Sign up a new user with a unique email
   */
  async signUp(role: 'consumer' | 'farmer' | 'driver' | 'admin', password = 'TestPassword123!') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const email = `test-${role}-${timestamp}-${random}@example.com`;

    await this.page.goto(`/auth/${role}`);
    await this.page.waitForLoadState('networkidle');

    // Wait for form to be visible
    await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });

    // Fill common fields
    await this.page.fill('input[type="email"], input[name="email"]', email);
    await this.page.fill('input[name="password"], input[type="password"]:not([name="confirmPassword"])', password);

    // Fill confirm password if it exists
    const confirmPasswordField = this.page.locator('input[name="confirmPassword"], input[placeholder*="Confirm" i]');
    const hasConfirmPassword = await confirmPasswordField.isVisible().catch(() => false);
    if (hasConfirmPassword) {
      await confirmPasswordField.fill(password);
    }

    // Fill role-specific required fields
    await this.fillRoleSpecificFields(role);

    // Submit form
    const submitButton = this.page.locator(
      'button[type="submit"], button:has-text("Sign Up"), button:has-text("Create Account")'
    ).first();
    await submitButton.click();

    // Wait for navigation after signup with longer timeout
    await this.page.waitForURL(new RegExp(`/${role}/`), { timeout: 30000 });

    return { email, password };
  }

  /**
   * Fill role-specific required fields
   */
  private async fillRoleSpecificFields(role: string) {
    // Full name field (common to most roles)
    const fullNameField = this.page.locator('input[name="fullName"], input[placeholder*="full name" i]');
    if (await fullNameField.isVisible().catch(() => false)) {
      await fullNameField.fill(`Test ${role.charAt(0).toUpperCase() + role.slice(1)} User`);
    }

    // Phone field
    const phoneField = this.page.locator('input[name="phone"], input[type="tel"]');
    if (await phoneField.isVisible().catch(() => false)) {
      await phoneField.fill('555-123-4567');
    }

    // Address fields (for consumer)
    if (role === 'consumer') {
      const streetField = this.page.locator('input[name="street"]');
      if (await streetField.isVisible().catch(() => false)) {
        await streetField.fill('123 Test Street');
      }

      const cityField = this.page.locator('input[name="city"]');
      if (await cityField.isVisible().catch(() => false)) {
        await cityField.fill('Test City');
      }

      const stateField = this.page.locator('input[name="state"], select[name="state"]');
      if (await stateField.isVisible().catch(() => false)) {
        const tagName = await stateField.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          await stateField.selectOption({ index: 1 });
        } else {
          await stateField.fill('CA');
        }
      }

      const zipField = this.page.locator('input[name="zipCode"], input[name="zip"]');
      if (await zipField.isVisible().catch(() => false)) {
        await zipField.fill('90210');
      }

      // Acquisition channel if exists
      const acquisitionField = this.page.locator('select[name="acquisitionChannel"], input[name="acquisitionChannel"]');
      if (await acquisitionField.isVisible().catch(() => false)) {
        const tagName = await acquisitionField.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          await acquisitionField.selectOption({ index: 1 });
        }
      }
    }

    // Farm-specific fields
    if (role === 'farmer') {
      const farmNameField = this.page.locator('input[name="farmName"], input[placeholder*="farm name" i]');
      if (await farmNameField.isVisible().catch(() => false)) {
        await farmNameField.fill('Test Farm');
      }

      const farmAddressField = this.page.locator('input[name="farmAddress"]');
      if (await farmAddressField.isVisible().catch(() => false)) {
        await farmAddressField.fill('456 Farm Road, Test City, CA 90210');
      }
    }
  }

  /**
   * Login an existing user
   */
  async login(email: string, password: string, role: 'consumer' | 'farmer' | 'driver' | 'admin') {
    await this.page.goto(`/auth/${role}`);
    await this.page.waitForLoadState('networkidle');

    // Wait for login form
    await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });

    await this.page.fill('input[type="email"], input[name="email"]', email);
    await this.page.fill('input[name="password"], input[type="password"]', password);

    await this.page.getByRole('button', { name: /sign in|log in/i }).click();

    // Wait for successful login redirect
    await this.page.waitForURL(new RegExp(`/${role}/`), { timeout: 15000 });
  }

  /**
   * Logout the current user
   */
  async logout() {
    // Navigate to home or logout endpoint
    await this.page.goto('/');
    // Add logout logic here when implemented
  }
}

/**
 * Extended test fixture with authentication helper
 */
export const test = base.extend<{ auth: AuthHelper }>({
  auth: async ({ page }, use) => {
    const auth = new AuthHelper(page);
    await use(auth);
  },
});

export { expect };
