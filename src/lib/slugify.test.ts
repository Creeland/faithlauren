import { describe, it, expect } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Wedding Photos")).toBe("wedding-photos");
  });

  it("collapses runs of non-alphanumerics into one hyphen", () => {
    expect(slugify("Emma & Sam — 2026!")).toBe("emma-sam-2026");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  ...Portraits...  ")).toBe("portraits");
  });

  it("returns empty string when nothing survives", () => {
    expect(slugify("!!!")).toBe("");
  });
});
