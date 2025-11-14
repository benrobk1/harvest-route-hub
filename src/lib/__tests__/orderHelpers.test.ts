import { formatEstimatedTime } from "../orderHelpers";

const { describe, expect, it } = await (async () => {
  try {
    return await import("vitest");
  } catch {
    return await import("bun:test");
  }
})();

describe("formatEstimatedTime", () => {
  it("returns undefined when minutes is undefined", () => {
    expect(formatEstimatedTime(undefined)).toBeUndefined();
  });

  it("formats zero minutes as 0m", () => {
    expect(formatEstimatedTime(0)).toBe("0m");
  });

  it("formats minutes under an hour", () => {
    expect(formatEstimatedTime(45)).toBe("45m");
  });

  it("formats minutes over an hour", () => {
    expect(formatEstimatedTime(125)).toBe("2h 5m");
  });
});
