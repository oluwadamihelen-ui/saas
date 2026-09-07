"use client";

import * as React from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedImage {
  id: string;
  url: string;
  uploading: boolean;
  error?: string;
}

/**
 * Replaces a raw "paste image URLs" textarea with an actual upload flow --
 * files go to POST /api/admin/uploads (writes under public/uploads/,
 * admin-only). The uploaded URLs are kept in sync onto a hidden input
 * (`name`) as a newline-separated list, matching the exact wire format the
 * server action already expects from ApplicationForm/actions.ts, so
 * nothing downstream of the form submission needed to change.
 */
export function ImageUploadField({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [images, setImages] = React.useState<UploadedImage[]>(() =>
    (defaultValue ?? "")
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ id: url, url, uploading: false }))
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  const hiddenValue = images
    .filter((img) => !img.uploading && !img.error)
    .map((img) => img.url)
    .join("\n");

  async function uploadFile(file: File) {
    const id = `${file.name}-${Date.now()}-${Math.random()}`;
    const previewUrl = URL.createObjectURL(file);
    setImages((prev) => [...prev, { id, url: previewUrl, uploading: true }]);

    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setImages((prev) => prev.map((img) => (img.id === id ? { ...img, uploading: false, error: data.error ?? "Upload failed." } : img)));
        return;
      }
      setImages((prev) => prev.map((img) => (img.id === id ? { id, url: data.url!, uploading: false } : img)));
      URL.revokeObjectURL(previewUrl);
    } catch {
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, uploading: false, error: "Upload failed. Check your connection." } : img)));
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach((file) => uploadFile(file));
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={hiddenValue} />
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-video overflow-hidden rounded-md border border-border bg-muted-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- locally-uploaded/blob preview URLs, not remote images next/image can optimize */}
              <img src={img.url} alt="Screenshot" className={cn("h-full w-full object-cover", img.uploading && "opacity-50")} />
              {img.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
              {img.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-danger/80 p-2 text-center text-xs text-white">{img.error}</div>
              )}
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                aria-label="Remove screenshot"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Upload className="h-4 w-4" />
        Add screenshots (PNG, JPEG, WEBP, or GIF — up to 5MB each)
      </button>
    </div>
  );
}
