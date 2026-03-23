import { describe, it, expect } from "vitest"
import { computeReorder } from "./reorder-photos"

type TestPhoto = { id: string }

function photos(...ids: string[]): TestPhoto[] {
  return ids.map((id) => ({ id }))
}

function ids(result: TestPhoto[]): string[] {
  return result.map((p) => p.id)
}

describe("computeReorder", () => {
  describe("single photo drag", () => {
    it("moves a photo forward", () => {
      const result = computeReorder(
        photos("a", "b", "c", "d", "e"),
        new Set(["b"]),
        "b",
        "d"
      )
      expect(ids(result)).toEqual(["a", "c", "d", "b", "e"])
    })

    it("moves a photo backward", () => {
      const result = computeReorder(
        photos("a", "b", "c", "d", "e"),
        new Set(["d"]),
        "d",
        "b"
      )
      expect(ids(result)).toEqual(["a", "d", "b", "c", "e"])
    })

    it("moves a photo to the start", () => {
      const result = computeReorder(
        photos("a", "b", "c"),
        new Set(["c"]),
        "c",
        "a"
      )
      expect(ids(result)).toEqual(["c", "a", "b"])
    })

    it("moves a photo to the end", () => {
      const result = computeReorder(
        photos("a", "b", "c"),
        new Set(["a"]),
        "a",
        "c"
      )
      expect(ids(result)).toEqual(["b", "c", "a"])
    })

    it("returns unchanged array when dropped on self", () => {
      const original = photos("a", "b", "c")
      const result = computeReorder(original, new Set(["b"]), "b", "b")
      expect(result).toBe(original)
    })
  })

  describe("multi-photo drag", () => {
    it("moves a group forward", () => {
      const result = computeReorder(
        photos("a", "b", "c", "d", "e"),
        new Set(["a", "b"]),
        "a",
        "d"
      )
      expect(ids(result)).toEqual(["c", "d", "a", "b", "e"])
    })

    it("moves a group backward", () => {
      const result = computeReorder(
        photos("a", "b", "c", "d", "e"),
        new Set(["d", "e"]),
        "d",
        "b"
      )
      expect(ids(result)).toEqual(["a", "d", "e", "b", "c"])
    })

    it("moves a group to the start", () => {
      const result = computeReorder(
        photos("a", "b", "c", "d"),
        new Set(["c", "d"]),
        "c",
        "a"
      )
      expect(ids(result)).toEqual(["c", "d", "a", "b"])
    })

    it("moves a group to the end", () => {
      const result = computeReorder(
        photos("a", "b", "c", "d"),
        new Set(["a", "b"]),
        "a",
        "d"
      )
      expect(ids(result)).toEqual(["c", "d", "a", "b"])
    })

    it("preserves relative order of selected photos", () => {
      const result = computeReorder(
        photos("a", "b", "c", "d", "e"),
        new Set(["b", "d"]),
        "b",
        "e"
      )
      // b and d should maintain their relative order (b before d)
      const resultIds = ids(result)
      expect(resultIds.indexOf("b")).toBeLessThan(resultIds.indexOf("d"))
    })

    it("handles non-contiguous selection", () => {
      const result = computeReorder(
        photos("a", "b", "c", "d", "e"),
        new Set(["a", "c", "e"]),
        "a",
        "d"
      )
      // a, c, e removed → [b, d]. Insert after d → [b, d, a, c, e]
      expect(ids(result)).toEqual(["b", "d", "a", "c", "e"])
    })

    it("handles all photos selected", () => {
      const result = computeReorder(
        photos("a", "b", "c"),
        new Set(["a", "b", "c"]),
        "a",
        "c"
      )
      // All selected, remaining is empty, all inserted at 0
      expect(ids(result)).toEqual(["a", "b", "c"])
    })

    it("handles adjacent selected photos moving one position", () => {
      const result = computeReorder(
        photos("a", "b", "c", "d"),
        new Set(["b", "c"]),
        "b",
        "d"
      )
      expect(ids(result)).toEqual(["a", "d", "b", "c"])
    })
  })

  describe("active photo not in selection", () => {
    it("adds active photo to the dragged group", () => {
      // This happens when dragging an unselected photo — selection cleared,
      // so selectedIds is empty but activeId should still move
      const result = computeReorder(
        photos("a", "b", "c", "d"),
        new Set(),
        "b",
        "d"
      )
      expect(ids(result)).toEqual(["a", "c", "d", "b"])
    })
  })
})
