import { buildGalleryDownload, hasAccess } from "@/modules/gallery";
import {
  EmptyDownloadError,
  InvalidPhotoSelectionError,
} from "@/modules/shared/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Access check: a gallery that is missing or not unlocked is rejected here.
  if (!(await hasAccess(slug))) {
    return new Response("Unauthorized", { status: 401 });
  }

  // A `photoIds` query param selects a subset; its absence means the full
  // gallery. An empty string is treated as absent (full gallery), matching the
  // client, while a present-but-emptying value flows through as a selection.
  const photoIdsParam = new URL(request.url).searchParams.get("photoIds");
  const selection = photoIdsParam
    ? photoIdsParam.split(",").filter(Boolean)
    : undefined;

  try {
    const download = await buildGalleryDownload(slug, selection);
    if (!download) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(download.stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${download.filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof InvalidPhotoSelectionError) {
      return new Response("Invalid photo ID", { status: 400 });
    }
    if (err instanceof EmptyDownloadError) {
      return new Response("No photos to download", { status: 404 });
    }
    throw err;
  }
}
