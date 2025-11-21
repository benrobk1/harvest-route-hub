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
    const email = `test-${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;

    await this.page.goto(`/auth/${role}`);
    await this.page.waitForLoadState('networkidle');

    // Fill signup form
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);

    // Submit form
    await this.page.getByRole('button', { name: /sign up/i }).click();

    // Wait for navigation after signup
    await this.page.waitForURL(new RegExp(`/${role}/`), { timeout: 15000 });

    return { email, password };
  }

  /**
   * Login an existing user
   */
  async login(email: string, password: string, role: 'consumer' | 'farmer' | 'driver' | 'admin') {
    await this.page.goto(`/auth/${role}`);
    await this.page.waitForLoadState('networkidle');

    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);

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
