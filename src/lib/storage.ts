import "server-only";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

/**
 * Delete files from UploadThing storage. Accepts raw fileKey values straight
 * off database rows — null/undefined keys are skipped, and no request is made
 * when there is nothing to delete.
 */
export async function deleteStoredFiles(
  fileKeys: Array<string | null | undefined>,
) {
  const keys = fileKeys.filter((key): key is string => Boolean(key));
  if (keys.length > 0) {
    await utapi.deleteFiles(keys);
  }
}
