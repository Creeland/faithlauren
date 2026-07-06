"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/dal";
import { parseReorderPayload } from "@/lib/reorder";
import { adminAction } from "@/modules/shared/admin-action";
import { DuplicateSlugError } from "@/modules/shared/errors";
import * as portfolioModule from "@/modules/portfolio";

const portfolioSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

export type PortfolioState =
  | {
      error?: string;
      errors?: Record<string, string[]>;
    }
  | undefined;

export async function createPortfolio(
  _prevState: PortfolioState,
  formData: FormData,
): Promise<PortfolioState> {
  await verifyAdmin();

  const parsed = portfolioSchema.safeParse({
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await portfolioModule.createPortfolio(parsed.data);
  } catch (error) {
    if (error instanceof DuplicateSlugError) {
      return { error: "A portfolio with this name already exists" };
    }
    throw error;
  }

  redirect("/admin/portfolios");
}

export async function updatePortfolio(
  _prevState: PortfolioState,
  formData: FormData,
): Promise<PortfolioState> {
  await verifyAdmin();

  const id = formData.get("id") as string;
  const parsed = portfolioSchema.safeParse({
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await portfolioModule.updatePortfolio(id, parsed.data);
  return undefined;
}

export const deletePortfolio = adminAction(
  z.object({ id: z.string() }),
  async ({ id }) => {
    await portfolioModule.deletePortfolio(id);
    redirect("/admin/portfolios");
  },
);

export const reorderPortfolios = adminAction(
  z.object({ order: z.string() }),
  ({ order }) => portfolioModule.reorderPortfolios(parseReorderPayload(order)),
);

// Cover-photo selection is a distinct concern from the portfolio CRUD lifecycle,
// but it too now goes through the module; the action is a thin adminAction shell.
export const setCoverPhoto = adminAction(
  z.object({
    portfolioId: z.string(),
    photoId: z.string(),
    aspectRatio: z.string().optional(),
  }),
  ({ portfolioId, photoId, aspectRatio }) =>
    portfolioModule.setCoverPhoto(portfolioId, photoId, aspectRatio),
);
