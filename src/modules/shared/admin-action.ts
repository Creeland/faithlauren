import "server-only";
import type { z } from "zod";
import { verifyAdmin } from "@/lib/dal";

/**
 * Wrap a form-driven admin mutation with the two things every admin action must
 * do before it touches a domain module: verify the caller is an admin, then
 * parse the raw `FormData` into a typed, validated input.
 *
 * The returned function is shaped like a server action (`(formData) => ...`).
 * The handler receives the already-validated input and returns whatever the
 * caller needs (usually `void`). Auth runs first, exactly as the hand-written
 * actions did; a parse failure or a thrown `DomainError` propagates to the
 * caller — the drag-and-drop reorder UIs, for instance, rely on a throw to
 * revert their optimistic order.
 *
 * Validation stays colocated with the action (form-shaped input is a boundary
 * concern); modules only ever see typed inputs.
 */
export function adminAction<Schema extends z.ZodType, Result>(
  schema: Schema,
  handler: (input: z.output<Schema>) => Promise<Result>,
): (formData: FormData) => Promise<Result> {
  return async (formData: FormData) => {
    await verifyAdmin();
    const input = schema.parse(Object.fromEntries(formData));
    return handler(input);
  };
}
