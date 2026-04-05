import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
import { EditGroupForm } from "./edit-form";
import { DeleteGroupButton } from "./delete-group-button";
import { GroupCoverUploader } from "./cover-uploader";

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyAdmin();
  const { id } = await params;

  const group = await prisma.portfolioGroup.findUnique({
    where: { id },
    include: { _count: { select: { portfolios: true } } },
  });

  if (!group) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-tight">{group.title}</h1>
        <DeleteGroupButton groupId={group.id} />
      </div>

      <EditGroupForm group={group} />

      <div className="mt-10">
        <h2 className="text-lg font-light tracking-tight mb-4">Cover Image</h2>
        <GroupCoverUploader
          groupId={group.id}
          coverImageUrl={group.coverImageUrl}
          aspectRatio={group.aspectRatio}
        />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-light tracking-tight mb-2">Portfolios</h2>
        <p className="text-sm text-stone-500">
          {group._count.portfolios} portfolio
          {group._count.portfolios !== 1 ? "s" : ""} in this group. Manage
          portfolio assignments from the{" "}
          <a href="/admin/portfolios" className="text-accent hover:underline">
            Portfolios
          </a>{" "}
          page.
        </p>
      </div>
    </div>
  );
}
