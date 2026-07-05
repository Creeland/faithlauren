import { describe, it, expect } from "vitest";
import { parseReorderPayload } from "./reorder";

describe("parseReorderPayload", () => {
  it("parses a valid array of { id, sortOrder }", () => {
    const raw = JSON.stringify([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
    ]);
    expect(parseReorderPayload(raw)).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
    ]);
  });

  it("accepts an empty array", () => {
    expect(parseReorderPayload("[]")).toEqual([]);
  });

  it("throws when the field is missing (null)", () => {
    expect(() => parseReorderPayload(null)).toThrow(/missing 'order'/);
  });

  it("throws when the field is a File, not a string", () => {
    const file = new File(["x"], "x.txt");
    expect(() => parseReorderPayload(file)).toThrow(/missing 'order'/);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseReorderPayload("{not json")).toThrow(/not valid JSON/);
  });

  it("throws when the payload is not an array", () => {
    expect(() =>
      parseReorderPayload(JSON.stringify({ id: "a", sortOrder: 0 })),
    ).toThrow(/expected an array/);
  });

  it("throws when an item is missing sortOrder", () => {
    expect(() => parseReorderPayload(JSON.stringify([{ id: "a" }]))).toThrow(
      /expected an array/,
    );
  });

  it("throws when sortOrder is not a number", () => {
    expect(() =>
      parseReorderPayload(JSON.stringify([{ id: "a", sortOrder: "1" }])),
    ).toThrow(/expected an array/);
  });

  it("throws when sortOrder is a non-integer", () => {
    expect(() =>
      parseReorderPayload(JSON.stringify([{ id: "a", sortOrder: 1.5 }])),
    ).toThrow(/expected an array/);
  });

  it("throws when id is an empty string", () => {
    expect(() =>
      parseReorderPayload(JSON.stringify([{ id: "", sortOrder: 0 }])),
    ).toThrow(/expected an array/);
  });
});
