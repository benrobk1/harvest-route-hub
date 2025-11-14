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
  const skipTest = (title: string, fn?: (...args: any[]) => unknown) => bun.test.skip(title, fn as any);

  // Type the stub to match Playwright's test interface as closely as possible
  const stubTest = ((title: string, fn?: (...args: any[]) => unknown) => skipTest(title, fn)) as PlaywrightTest;
  
  // Assign properties to match Playwright test API
  (stubTest as any).skip = skipTest;
  (stubTest as any).only = skipTest;
  (stubTest as any).fixme = skipTest;
  
  const noop = () => {};
  (stubTest as any).describe = Object.assign(noop, {
    skip: noop,
    only: noop,
    parallel: noop
  });
  
  (stubTest as any).step = async <T>(_: string, body: () => Promise<T> | T) => body();
  (stubTest as any).use = () => {};
  (stubTest as any).beforeAll = (...args: Parameters<typeof bun.beforeAll>) => bun.beforeAll?.(...args);
  (stubTest as any).afterAll = (...args: Parameters<typeof bun.afterAll>) => bun.afterAll?.(...args);
  (stubTest as any).beforeEach = (...args: Parameters<typeof bun.beforeEach>) => bun.beforeEach?.(...args);
  (stubTest as any).afterEach = (...args: Parameters<typeof bun.afterEach>) => bun.afterEach?.(...args);

  test = stubTest;
  
  // Type the expect stub to match Playwright's expect interface
  expect = (() => {
    throw new Error('Playwright expect is unavailable in this environment.');
  }) as PlaywrightExpect;
}

export { test, expect, hasPlaywright };
