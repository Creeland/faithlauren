import { z } from "zod";

// Shared shape for the `order` field submitted by the admin drag-and-drop
// reorder UIs (photos, portfolios, portfolio groups). The field arrives as a
// JSON string in a FormData payload, so it must be parsed and validated before
// it is trusted to drive prisma updates.
const reorderItemSchema = z.object({
  id: z.string().min(1),
  sortOrder: z.number().int(),
});

const reorderPayloadSchema = z.array(reorderItemSchema);

export type ReorderItem = z.infer<typeof reorderItemSchema>;

/**
 * Parse and validate the `order` field of a reorder FormData payload.
 *
 * Returns the validated array of `{ id, sortOrder }` items. Throws a single,
 * descriptive Error on malformed JSON or a shape mismatch instead of letting a
 * raw `JSON.parse` SyntaxError (or a downstream `.map` on a non-array) bubble
 * up as an unhandled error. The admin reorder UIs already catch a throw here
 * and revert their optimistic state, so a clean throw is the graceful outcome.
 */
export function parseReorderPayload(
  raw: FormDataEntryValue | null,
): ReorderItem[] {
  if (typeof raw !== "string") {
    throw new Error("Invalid reorder payload: missing 'order' field");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid reorder payload: not valid JSON");
  }

  const result = reorderPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      "Invalid reorder payload: expected an array of { id, sortOrder }",
    );
  }

  return result.data;
}
