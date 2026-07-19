"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/dal";
import { parseReorderPayload } from "@/lib/reorder";
import { adminAction } from "@/modules/shared/admin-action";
import {
  DuplicateSlugError,
  GroupNotEmptyError,
} from "@/modules/shared/errors";
import * as portfolioModule from "@/modules/portfolio";

const groupSchema = z.object({
  title: z.string().min(1, "Title is required"),
  // An emptied textarea clears the stored description (null), rather than
  // being dropped and leaving stale text behind.
  description: z
    .string()
    .nullable()
    .transform((value) => value?.trim() || null),
});

export type GroupState =
  | {
      error?: string;
      errors?: Record<string, string[]>;
    }
  | undefined;

export async function createGroup(
  _prevState: GroupState,
  formData: FormData,
): Promise<GroupState> {
  await verifyAdmin();

  const parsed = groupSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") as string | null,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await portfolioModule.createGroup(parsed.data);
  } catch (error) {
    if (error instanceof DuplicateSlugError) {
      return { error: "A group with this name already exists" };
    }
    throw error;
  }

  redirect("/admin/portfolio-groups");
}

export async function updateGroup(
  _prevState: GroupState,
  formData: FormData,
): Promise<GroupState> {
  await verifyAdmin();

  const id = formData.get("id") as string;
  const parsed = groupSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") as string | null,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await portfolioModule.updateGroup(id, parsed.data);
  return undefined;
}

export async function deleteGroup(
  _prevState: GroupState,
  formData: FormData,
): Promise<GroupState> {
  await verifyAdmin();
  const id = formData.get("id") as string;

  try {
    await portfolioModule.deleteGroup(id);
  } catch (error) {
    if (error instanceof GroupNotEmptyError) {
      return {
        error:
          "Cannot delete a group that still contains portfolios. Remove all portfolios first.",
      };
    }
    throw error;
  }

  redirect("/admin/portfolio-groups");
}

export const reorderGroups = adminAction(
  z.object({ order: z.string() }),
  ({ order }) => portfolioModule.reorderGroups(parseReorderPayload(order)),
);

export const setGroupCoverImage = adminAction(
  z.object({
    groupId: z.string(),
    url: z.string(),
    fileKey: z.string(),
    aspectRatio: z.string().optional(),
  }),
  ({ groupId, url, fileKey, aspectRatio }) =>
    portfolioModule.setGroupCover(groupId, { url, fileKey, aspectRatio }),
);

export const assignPortfolioToGroup = adminAction(
  z.object({ portfolioId: z.string(), groupId: z.string() }),
  ({ portfolioId, groupId }) =>
    portfolioModule.assignPortfolioToGroup(portfolioId, groupId),
);

export const removePortfolioFromGroup = adminAction(
  z.object({ portfolioId: z.string() }),
  ({ portfolioId }) => portfolioModule.removePortfolioFromGroup(portfolioId),
);
