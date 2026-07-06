import { notFound } from "next/navigation";
import { verifyAdmin } from "@/lib/dal";
import { getGroupForEdit, listUngroupedPortfolios } from "@/modules/portfolio";
import { EditGroupForm } from "./edit-form";
import { DeleteGroupButton } from "./delete-group-button";
import { GroupCoverUploader } from "./cover-uploader";
import { GroupPortfolios } from "./group-portfolios";

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyAdmin();
  const { id } = await params;

  const group = await getGroupForEdit(id);

  if (!group) notFound();

  const ungroupedItems = await listUngroupedPortfolios();

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
        <h2 className="text-lg font-light tracking-tight mb-4">Portfolios</h2>
        <GroupPortfolios
          groupId={group.id}
          portfolios={group.portfolios}
          ungroupedPortfolios={ungroupedItems}
        />
      </div>
    </div>
  );
}
