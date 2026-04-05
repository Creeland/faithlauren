"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const groupSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
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
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const slug = slugify(parsed.data.title);

  const existing = await prisma.portfolioGroup.findUnique({ where: { slug } });
  if (existing) {
    return { error: "A group with this name already exists" };
  }

  const maxSort = await prisma.portfolioGroup.aggregate({
    _max: { sortOrder: true },
  });

  await prisma.portfolioGroup.create({
    data: {
      title: parsed.data.title,
      slug,
      description: parsed.data.description,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

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
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await prisma.portfolioGroup.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
    },
  });

  revalidatePath(`/admin/portfolio-groups/${id}`);
  return undefined;
}

export async function deleteGroup(
  _prevState: GroupState,
  formData: FormData,
): Promise<GroupState> {
  await verifyAdmin();
  const id = formData.get("id") as string;

  const portfolioCount = await prisma.portfolio.count({
    where: { groupId: id },
  });

  if (portfolioCount > 0) {
    return {
      error:
        "Cannot delete a group that still contains portfolios. Remove all portfolios first.",
    };
  }

  const group = await prisma.portfolioGroup.findUnique({
    where: { id },
    select: { coverImageFileKey: true },
  });

  if (group?.coverImageFileKey) {
    await utapi.deleteFiles([group.coverImageFileKey]);
  }

  await prisma.portfolioGroup.delete({ where: { id } });

  redirect("/admin/portfolio-groups");
}

export async function reorderGroups(formData: FormData) {
  await verifyAdmin();
  const order = JSON.parse(formData.get("order") as string) as {
    id: string;
    sortOrder: number;
  }[];

  await Promise.all(
    order.map((item) =>
      prisma.portfolioGroup.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );

  revalidatePath("/admin/portfolio-groups");
}

export async function setGroupCoverImage(formData: FormData) {
  await verifyAdmin();
  const groupId = formData.get("groupId") as string;
  const url = formData.get("url") as string;
  const fileKey = formData.get("fileKey") as string;
  const aspectRatio = formData.get("aspectRatio") as string | null;

  const group = await prisma.portfolioGroup.findUnique({
    where: { id: groupId },
    select: { coverImageFileKey: true },
  });

  // Delete old cover image if replacing
  if (group?.coverImageFileKey && group.coverImageFileKey !== fileKey) {
    await utapi.deleteFiles([group.coverImageFileKey]);
  }

  await prisma.portfolioGroup.update({
    where: { id: groupId },
    data: {
      coverImageUrl: url,
      coverImageFileKey: fileKey,
      ...(aspectRatio && { aspectRatio }),
    },
  });

  revalidatePath(`/admin/portfolio-groups/${groupId}`);
  revalidatePath("/");
}

export async function assignPortfolioToGroup(formData: FormData) {
  await verifyAdmin();
  const portfolioId = formData.get("portfolioId") as string;
  const groupId = formData.get("groupId") as string;

  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { groupId },
  });

  revalidatePath("/admin/portfolios");
  revalidatePath(`/admin/portfolio-groups/${groupId}`);
}

export async function removePortfolioFromGroup(formData: FormData) {
  await verifyAdmin();
  const portfolioId = formData.get("portfolioId") as string;

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: { groupId: true },
  });

  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { groupId: null },
  });

  revalidatePath("/admin/portfolios");
  if (portfolio?.groupId) {
    revalidatePath(`/admin/portfolio-groups/${portfolio.groupId}`);
  }
}
