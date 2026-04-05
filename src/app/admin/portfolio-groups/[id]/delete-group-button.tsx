"use client";

import { useActionState } from "react";
import { deleteGroup, type GroupState } from "@/app/actions/portfolio-group";

export function DeleteGroupButton({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState<GroupState, FormData>(
    deleteGroup,
    undefined,
  );

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="id" value={groupId} />
        <button
          type="submit"
          disabled={pending}
          className="text-sm text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
          onClick={(e) => {
            if (!confirm("Delete this portfolio group?")) {
              e.preventDefault();
            }
          }}
        >
          {pending ? "Deleting..." : "Delete Group"}
        </button>
      </form>
      {state?.error && (
        <p className="text-red-600 text-xs mt-1">{state.error}</p>
      )}
    </div>
  );
}
