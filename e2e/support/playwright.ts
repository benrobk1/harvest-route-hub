/**
 * Shared Playwright test helpers that gracefully skip in environments
 * where the Playwright dependency is unavailable (such as offline CI).
 */
import type { TestType, Expect } from '@playwright/test';

// Define types for Playwright's test and expect
type PlaywrightTest = typeof import('@playwright/test').test;
type PlaywrightExpect = typeof import('@playwright/test').expect;

// Conditional types: use real Playwright types when available, fallback otherwise
let test: PlaywrightTest;
let expect: PlaywrightExpect;
let hasPlaywright = true;

try {
  const playwright = await import('@playwright/test');
  test = playwright.test;
  expect = playwright.expect;
} catch (error) {
  hasPlaywright = false;
  const bun = await import('bun:test');
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skipTest = (title: string, fn?: (...args: unknown[]) => unknown) => bun.test.skip(title, fn as any);
  const noop = () => {};

  // Use Proxy for cleaner stub implementation while maintaining type safety
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stubTest: any = new Proxy(
    (title: string, fn?: (...args: unknown[]) => unknown) => skipTest(title, fn),
    {
      get(target, prop) {
        if (prop === 'describe') {
          return Object.assign(noop, {
            skip: noop,
            only: noop,
            parallel: noop
          });
        }
        if (prop === 'step') {
          return async <T>(_: string, body: () => Promise<T> | T) => body();
        }
        if (prop === 'use') {
          return noop;
        }
        if (prop === 'beforeAll') {
          return (...args: Parameters<typeof bun.beforeAll>) => bun.beforeAll?.(...args);
        }
        if (prop === 'afterAll') {
          return (...args: Parameters<typeof bun.afterAll>) => bun.afterAll?.(...args);
        }
        if (prop === 'beforeEach') {
          return (...args: Parameters<typeof bun.beforeEach>) => bun.beforeEach?.(...args);
        }
        if (prop === 'afterEach') {
          return (...args: Parameters<typeof bun.afterEach>) => bun.afterEach?.(...args);
        }
        // Default: return skipTest for any unknown property
        return skipTest;
      }
    }
  );

  test = stubTest as PlaywrightTest;
  
  // Type the expect stub to match Playwright's expect interface
  expect = (() => {
    throw new Error('Playwright expect is unavailable in this environment.');
  }) as PlaywrightExpect;
}

export { test, expect, hasPlaywright };
