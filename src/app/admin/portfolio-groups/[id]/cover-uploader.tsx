"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing";
import { setGroupCoverImage } from "@/app/actions/portfolio-group";

const ASPECT_RATIOS = [
  { value: "aspect-3/4", label: "3:4" },
  { value: "aspect-2/3", label: "2:3" },
  { value: "aspect-4/5", label: "4:5" },
];

export function GroupCoverUploader({
  groupId,
  coverImageUrl,
  aspectRatio,
}: {
  groupId: string;
  coverImageUrl: string | null;
  aspectRatio: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState(aspectRatio);

  const { startUpload } = useUploadThing("groupCoverImage");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await startUpload([file], { groupId });
      if (!result || result.length === 0) {
        toast.error("Upload failed");
        return;
      }

      const uploaded = result[0];
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("url", uploaded.ufsUrl);
      fd.set("fileKey", uploaded.key);
      fd.set("aspectRatio", selectedRatio);
      await setGroupCoverImage(fd);

      toast.success("Cover image updated");
      router.refresh();
    } catch {
      toast.error("Failed to upload cover image");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRatioChange(ratio: string) {
    setSelectedRatio(ratio);

    if (coverImageUrl) {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("url", coverImageUrl);
      fd.set("fileKey", "");
      fd.set("aspectRatio", ratio);
      await setGroupCoverImage(fd);
      toast.success("Aspect ratio updated");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm text-stone-600 mb-1.5">
          Aspect Ratio
        </label>
        <div className="flex gap-2">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => handleRatioChange(r.value)}
              className={`px-4 py-2 text-sm border transition-colors ${
                selectedRatio === r.value
                  ? "border-accent bg-accent text-white"
                  : "border-stone-300 hover:border-accent"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {coverImageUrl && (
        <div
          className={`relative w-48 ${selectedRatio} bg-stone-100 overflow-hidden`}
        >
          <Image
            src={coverImageUrl}
            alt="Cover image"
            fill
            sizes="192px"
            className="object-cover"
          />
        </div>
      )}

      <label className="inline-block cursor-pointer border border-dashed border-stone-300 px-6 py-3 text-sm text-stone-500 hover:border-accent hover:text-accent transition-colors">
        {uploading
          ? "Uploading..."
          : coverImageUrl
            ? "Replace Cover Image"
            : "Upload Cover Image"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      </label>
    </div>
  );
}
