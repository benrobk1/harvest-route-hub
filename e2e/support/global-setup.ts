import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup script that runs before all tests.
 * Verifies the application is reachable and performs readiness checks.
 * Individual tests handle their own user creation with unique emails.
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:8080';

  console.log('🚀 Starting global test setup...');
  console.log(`📍 Base URL: ${baseURL}`);

  // Launch a browser to verify app readiness
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for the app to be ready
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('✅ Application is accessible');

    // Note: In a real setup, you would:
    // 1. Connect to Supabase directly with service role key
    // 2. Create test users programmatically
    // 3. Seed test data (products, orders, etc.)
    //
    // For now, tests should handle their own user creation with unique emails
    console.log('ℹ️  Tests will create their own test users with unique emails');
    console.log('ℹ️  Consider implementing database seeding for consistent test data');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

  console.log('✅ Global setup completed successfully');
}

export default globalSetup;
