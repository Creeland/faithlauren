import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mockTransaction },
}));

import { persistOrder } from "./sortable";

function orderForm(order: unknown): FormData {
  const fd = new FormData();
  fd.set("order", JSON.stringify(order));
  return fd;
}

describe("persistOrder", () => {
  const delegate = { update: vi.fn().mockResolvedValue({}) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies every position through a single transaction", async () => {
    const order = [
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ];

    await persistOrder(delegate, orderForm(order));

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(delegate.update).toHaveBeenCalledTimes(3);
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { sortOrder: 1 },
    });
  });

  it("rejects a payload with missing fields", async () => {
    await expect(
      persistOrder(delegate, orderForm([{ id: "a" }])),
    ).rejects.toThrow();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects a payload that is not an array", async () => {
    await expect(
      persistOrder(delegate, orderForm({ id: "a", sortOrder: 0 })),
    ).rejects.toThrow();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects non-integer sort positions", async () => {
    await expect(
      persistOrder(delegate, orderForm([{ id: "a", sortOrder: 1.5 }])),
    ).rejects.toThrow();
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
