import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAdminPhotoSelection } from "./use-admin-photo-selection"

const PHOTO_IDS = ["a", "b", "c", "d", "e"]
const NO_MOD = { metaKey: false, ctrlKey: false, shiftKey: false }
const CMD = { metaKey: true, ctrlKey: false, shiftKey: false }
const CTRL = { metaKey: false, ctrlKey: true, shiftKey: false }
const SHIFT = { metaKey: false, ctrlKey: false, shiftKey: true }
const CMD_SHIFT = { metaKey: true, ctrlKey: false, shiftKey: true }

function setup(ids = PHOTO_IDS) {
  return renderHook(() => useAdminPhotoSelection(ids))
}

describe("useAdminPhotoSelection", () => {
  describe("plain click", () => {
    it("selects one photo and deselects others", () => {
      const { result } = setup()

      act(() => result.current.handleClick("b", NO_MOD))
      expect([...result.current.selectedIds]).toEqual(["b"])

      act(() => result.current.handleClick("d", NO_MOD))
      expect([...result.current.selectedIds]).toEqual(["d"])
    })

    it("sets anchor to clicked photo", () => {
      const { result } = setup()

      act(() => result.current.handleClick("c", NO_MOD))
      expect(result.current.anchor).toBe("c")
    })
  })

  describe("Cmd+click (metaKey)", () => {
    it("toggles photo into selection", () => {
      const { result } = setup()

      act(() => result.current.handleClick("a", NO_MOD))
      act(() => result.current.handleClick("c", CMD))
      expect([...result.current.selectedIds].sort()).toEqual(["a", "c"])
    })

    it("toggles photo out of selection", () => {
      const { result } = setup()

      act(() => result.current.handleClick("a", NO_MOD))
      act(() => result.current.handleClick("c", CMD))
      act(() => result.current.handleClick("a", CMD))
      expect([...result.current.selectedIds]).toEqual(["c"])
    })

    it("updates anchor to toggled photo", () => {
      const { result } = setup()

      act(() => result.current.handleClick("a", NO_MOD))
      act(() => result.current.handleClick("c", CMD))
      expect(result.current.anchor).toBe("c")
    })
  })

  describe("Ctrl+click", () => {
    it("behaves the same as Cmd+click", () => {
      const { result } = setup()

      act(() => result.current.handleClick("a", NO_MOD))
      act(() => result.current.handleClick("c", CTRL))
      expect([...result.current.selectedIds].sort()).toEqual(["a", "c"])
    })
  })

  describe("Shift+click", () => {
    it("selects range from anchor to clicked photo (forward)", () => {
      const { result } = setup()

      act(() => result.current.handleClick("b", NO_MOD)) // anchor = b
      act(() => result.current.handleClick("d", SHIFT))
      expect([...result.current.selectedIds]).toEqual(["b", "c", "d"])
    })

    it("selects range from anchor to clicked photo (backward)", () => {
      const { result } = setup()

      act(() => result.current.handleClick("d", NO_MOD)) // anchor = d
      act(() => result.current.handleClick("b", SHIFT))
      expect([...result.current.selectedIds]).toEqual(["b", "c", "d"])
    })

    it("replaces previous selection with the range", () => {
      const { result } = setup()

      act(() => result.current.handleClick("a", NO_MOD))
      act(() => result.current.handleClick("e", CMD)) // a, e selected
      act(() => result.current.handleClick("b", SHIFT)) // anchor is e, range e..b = b,c,d,e
      expect([...result.current.selectedIds]).toEqual(["b", "c", "d", "e"])
    })

    it("falls back to plain click if no anchor exists", () => {
      const { result } = setup()

      act(() => result.current.handleClick("c", SHIFT))
      expect([...result.current.selectedIds]).toEqual(["c"])
      expect(result.current.anchor).toBe("c")
    })

    it("does not update anchor", () => {
      const { result } = setup()

      act(() => result.current.handleClick("b", NO_MOD))
      act(() => result.current.handleClick("d", SHIFT))
      expect(result.current.anchor).toBe("b")
    })

    it("allows extending range with subsequent shift+clicks", () => {
      const { result } = setup()

      act(() => result.current.handleClick("b", NO_MOD)) // anchor = b
      act(() => result.current.handleClick("c", SHIFT)) // b,c
      act(() => result.current.handleClick("e", SHIFT)) // anchor still b, so b,c,d,e
      expect([...result.current.selectedIds]).toEqual(["b", "c", "d", "e"])
    })
  })

  describe("Cmd+Shift+click", () => {
    it("adds range to existing selection", () => {
      const { result } = setup()

      act(() => result.current.handleClick("a", NO_MOD)) // select a, anchor = a
      act(() => result.current.handleClick("c", CMD_SHIFT)) // add range a..c to selection
      expect([...result.current.selectedIds]).toEqual(["a", "b", "c"])
    })

    it("preserves selections outside the range", () => {
      const { result } = setup()

      act(() => result.current.handleClick("a", NO_MOD)) // select a, anchor = a
      act(() => result.current.handleClick("e", CMD)) // toggle e, anchor = e
      act(() => result.current.handleClick("c", CMD_SHIFT)) // add range c..e, keep a
      expect([...result.current.selectedIds].sort()).toEqual(["a", "c", "d", "e"])
    })
  })

  describe("clearSelection", () => {
    it("clears all selected photos and anchor", () => {
      const { result } = setup()

      act(() => result.current.handleClick("a", NO_MOD))
      act(() => result.current.handleClick("c", CMD))
      act(() => result.current.clearSelection())
      expect(result.current.selectedIds.size).toBe(0)
      expect(result.current.anchor).toBeNull()
    })
  })

  describe("selectedCount", () => {
    it("reflects the number of selected photos", () => {
      const { result } = setup()

      expect(result.current.selectedCount).toBe(0)
      act(() => result.current.handleClick("a", NO_MOD))
      expect(result.current.selectedCount).toBe(1)
      act(() => result.current.handleClick("c", CMD))
      expect(result.current.selectedCount).toBe(2)
    })
  })
})
