import { describe, it, expect } from "bun:test";
import { maskEmail, truncateMessage } from "../utils.ts";

describe("utils", () => {
  describe("maskEmail", () => {
    it("masks a normal email address correctly", () => {
      expect(maskEmail("user@example.com")).toBe("u****r@example.com");
    });

    it("masks a short email address", () => {
      expect(maskEmail("ab@example.com")).toBe("a****b@example.com");
    });

    it("masks a single character local part", () => {
      expect(maskEmail("a@example.com")).toBe("a****@example.com");
    });

    it("handles empty string", () => {
      expect(maskEmail("")).toBe("");
    });

    it("handles invalid email format", () => {
      expect(maskEmail("notanemail")).toBe("n****l");
    });

    it("masks a long email address", () => {
      expect(maskEmail("verylongemailaddress@example.com")).toBe(
        "v****s@example.com",
      );
    });
  });

  describe("truncateMessage", () => {
    it("truncates a long message", () => {
      expect(truncateMessage("This is a very long message", 10)).toBe(
        "This is a ...",
      );
    });

    it("does not truncate a short message", () => {
      expect(truncateMessage("Short", 10)).toBe("Short");
    });

    it("handles exact length message", () => {
      expect(truncateMessage("Exactly 20 character", 20)).toBe(
        "Exactly 20 character",
      );
    });

    it("handles empty string", () => {
      expect(truncateMessage("")).toBe("");
    });

    it("uses default maxLength of 20", () => {
      expect(truncateMessage("This is a message that is longer than 20")).toBe(
        "This is a message th...",
      );
    });

    it("truncates to custom length", () => {
      expect(truncateMessage("Hello World", 5)).toBe("Hello...");
    });
  });
});
