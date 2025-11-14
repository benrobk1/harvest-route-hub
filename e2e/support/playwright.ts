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

  const stubTest: any = (title: string, fn?: (...args: any[]) => unknown) => skipTest(title, fn);
  stubTest.skip = skipTest;
  stubTest.only = skipTest;
  stubTest.fixme = skipTest;
  const noop = () => {};
  stubTest.describe = Object.assign(noop, {
    skip: noop,
    only: noop,
    parallel: noop
  });
  stubTest.step = async <T>(_: string, body: () => Promise<T> | T) => body();
  stubTest.use = () => {};
  stubTest.beforeAll = (...args: Parameters<typeof bun.beforeAll>) => bun.beforeAll?.(...args);
  stubTest.afterAll = (...args: Parameters<typeof bun.afterAll>) => bun.afterAll?.(...args);
  stubTest.beforeEach = (...args: Parameters<typeof bun.beforeEach>) => bun.beforeEach?.(...args);
  stubTest.afterEach = (...args: Parameters<typeof bun.afterEach>) => bun.afterEach?.(...args);

  test = stubTest;
  expect = () => {
    throw new Error('Playwright expect is unavailable in this environment.');
  };
}

export { test, expect, hasPlaywright };
