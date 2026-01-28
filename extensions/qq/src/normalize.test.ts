/**
 * QQ Target ID Normalization Tests
 */

import { describe, expect, it } from "vitest";
import {
  formatQQTarget,
  groupTarget,
  looksLikeQQTargetId,
  normalizeQQMessagingTarget,
  parseQQTarget,
  privateTarget,
} from "./normalize.js";

describe("normalizeQQMessagingTarget", () => {
  describe("private targets", () => {
    it("normalizes plain QQ number", () => {
      expect(normalizeQQMessagingTarget("12345")).toBe("qq:12345");
      expect(normalizeQQMessagingTarget("12345678901")).toBe("qq:12345678901");
    });

    it("normalizes qq: prefixed number", () => {
      expect(normalizeQQMessagingTarget("qq:12345")).toBe("qq:12345");
      expect(normalizeQQMessagingTarget("QQ:12345")).toBe("qq:12345");
    });

    it("handles whitespace", () => {
      expect(normalizeQQMessagingTarget("  12345  ")).toBe("qq:12345");
      expect(normalizeQQMessagingTarget("  qq:12345  ")).toBe("qq:12345");
    });
  });

  describe("group targets", () => {
    it("normalizes group: prefixed number", () => {
      expect(normalizeQQMessagingTarget("group:12345")).toBe("qq:group:12345");
      expect(normalizeQQMessagingTarget("GROUP:12345")).toBe("qq:group:12345");
    });

    it("normalizes qq:group: prefixed number", () => {
      expect(normalizeQQMessagingTarget("qq:group:12345")).toBe("qq:group:12345");
      expect(normalizeQQMessagingTarget("QQ:GROUP:12345")).toBe("qq:group:12345");
    });
  });

  describe("invalid inputs", () => {
    it("returns undefined for empty input", () => {
      expect(normalizeQQMessagingTarget("")).toBeUndefined();
      expect(normalizeQQMessagingTarget("   ")).toBeUndefined();
    });

    it("returns undefined for too short numbers", () => {
      expect(normalizeQQMessagingTarget("1234")).toBeUndefined();
      expect(normalizeQQMessagingTarget("qq:1234")).toBeUndefined();
    });

    it("returns undefined for too long numbers", () => {
      expect(normalizeQQMessagingTarget("123456789012")).toBeUndefined();
    });

    it("returns undefined for non-numeric values", () => {
      expect(normalizeQQMessagingTarget("abc")).toBeUndefined();
      expect(normalizeQQMessagingTarget("qq:abc")).toBeUndefined();
      expect(normalizeQQMessagingTarget("12345abc")).toBeUndefined();
    });
  });
});

describe("looksLikeQQTargetId", () => {
  it("returns true for valid QQ numbers", () => {
    expect(looksLikeQQTargetId("12345")).toBe(true);
    expect(looksLikeQQTargetId("12345678901")).toBe(true);
  });

  it("returns true for qq: prefixed", () => {
    expect(looksLikeQQTargetId("qq:12345")).toBe(true);
    expect(looksLikeQQTargetId("QQ:anything")).toBe(true);
  });

  it("returns true for group: prefixed", () => {
    expect(looksLikeQQTargetId("group:12345")).toBe(true);
    expect(looksLikeQQTargetId("GROUP:anything")).toBe(true);
  });

  it("returns false for empty input", () => {
    expect(looksLikeQQTargetId("")).toBe(false);
    expect(looksLikeQQTargetId("   ")).toBe(false);
  });

  it("returns false for invalid formats", () => {
    expect(looksLikeQQTargetId("1234")).toBe(false);
    expect(looksLikeQQTargetId("abc")).toBe(false);
    expect(looksLikeQQTargetId("telegram:12345")).toBe(false);
  });
});

describe("parseQQTarget", () => {
  it("parses private targets", () => {
    expect(parseQQTarget("qq:12345")).toEqual({ type: "private", id: 12345 });
    expect(parseQQTarget("qq:12345678901")).toEqual({ type: "private", id: 12345678901 });
  });

  it("parses group targets", () => {
    expect(parseQQTarget("qq:group:12345")).toEqual({ type: "group", id: 12345 });
    expect(parseQQTarget("qq:group:12345678901")).toEqual({ type: "group", id: 12345678901 });
  });

  it("returns undefined for invalid inputs", () => {
    expect(parseQQTarget("")).toBeUndefined();
    expect(parseQQTarget("12345")).toBeUndefined();
    expect(parseQQTarget("qq:")).toBeUndefined();
    expect(parseQQTarget("qq:abc")).toBeUndefined();
    expect(parseQQTarget("qq:-1")).toBeUndefined();
    expect(parseQQTarget("qq:0")).toBeUndefined();
  });
});

describe("formatQQTarget", () => {
  it("formats private targets", () => {
    expect(formatQQTarget({ type: "private", id: 12345 })).toBe("qq:12345");
  });

  it("formats group targets", () => {
    expect(formatQQTarget({ type: "group", id: 12345 })).toBe("qq:group:12345");
  });
});

describe("helper functions", () => {
  it("privateTarget creates private target string", () => {
    expect(privateTarget(12345)).toBe("qq:12345");
    expect(privateTarget(12345678901)).toBe("qq:12345678901");
  });

  it("groupTarget creates group target string", () => {
    expect(groupTarget(12345)).toBe("qq:group:12345");
    expect(groupTarget(12345678901)).toBe("qq:group:12345678901");
  });
});
