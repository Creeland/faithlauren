import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/dal";
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

  const group = await prisma.portfolioGroup.findUnique({
    where: { id },
    include: {
      portfolios: {
        include: {
          _count: { select: { photos: true } },
          photos: { where: {}, take: 1 },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!group) notFound();

  const ungroupedPortfolios = await prisma.portfolio.findMany({
    where: { groupId: null },
    include: {
      _count: { select: { photos: true } },
      photos: { where: {}, take: 1 },
    },
    orderBy: { title: "asc" },
  });

  const groupPortfolios = group.portfolios.map((p) => {
    const coverPhoto = p.coverPhotoId
      ? p.photos.find((photo) => photo.id === p.coverPhotoId)
      : null;
    return {
      id: p.id,
      title: p.title,
      coverPhotoUrl: coverPhoto?.url ?? null,
      photoCount: p._count.photos,
      sortOrder: p.sortOrder,
    };
  });

  const ungroupedItems = ungroupedPortfolios.map((p) => {
    const coverPhoto = p.coverPhotoId
      ? p.photos.find((photo) => photo.id === p.coverPhotoId)
      : null;
    return {
      id: p.id,
      title: p.title,
      coverPhotoUrl: coverPhoto?.url ?? null,
      photoCount: p._count.photos,
      sortOrder: p.sortOrder,
    };
  });

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
          portfolios={groupPortfolios}
          ungroupedPortfolios={ungroupedItems}
        />
      </div>
    </div>
  );
}
