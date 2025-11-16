import { describe, expect, it } from "vitest";
import { formatEstimatedTime } from "../orderHelpers";

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
