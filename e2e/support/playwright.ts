/**
 * Shared Playwright test helpers that gracefully skip in environments
 * where the Playwright dependency is unavailable (such as offline CI).
 */
let test: any;
let expect: any;
let hasPlaywright = true;

try {
  const playwright = await import('@playwright/test');
  test = playwright.test;
  expect = playwright.expect;
} catch (error) {
  hasPlaywright = false;
  const bun = await import('bun:test');
  const skipTest = (title: string, fn?: (...args: any[]) => unknown) => bun.test.skip(title, fn as any);
  const noop = () => {};

  const stubTest: any = new Proxy(
    (title: string, fn?: (...args: any[]) => unknown) => skipTest(title, fn),
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

  test = stubTest;
  expect = () => {
    throw new Error('Playwright expect is unavailable in this environment.');
  };
}

export { test, expect, hasPlaywright };
