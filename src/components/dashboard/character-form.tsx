"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Wand2, Upload, Users2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";

type Character = {
  id: string;
  name: string;
  ageCategory: string | null;
  genderPresentation: string | null;
  appearance: string | null;
  hair: string | null;
  clothing: string | null;
  accessories: string | null;
  personality: string | null;
  referenceImageUrl: string | null;
};

export function CharacterForm({ character }: { character?: Character }) {
  const router = useRouter();
  const isEdit = Boolean(character);
  const [loading, setLoading] = useState(false);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState(character?.referenceImageUrl ?? null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(
      Array.from(form.entries()).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? undefined : v])
    );

    try {
      const res = await fetch(isEdit ? `/api/characters/${character!.id}` : "/api/characters", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save character.");
      }
      const data = await res.json();
      if (isEdit) {
        router.refresh();
      } else {
        router.push(`/characters/${data.character.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function onGeneratePortrait() {
    if (!character) return;
    setPortraitLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${character.id}/generate-portrait`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not generate portrait.");
      }
      const data = await res.json();
      setReferenceImageUrl(data.character.referenceImageUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPortraitLoading(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!character || !e.target.files?.[0]) return;
    setUploadLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", e.target.files[0]);
    try {
      const res = await fetch(`/api/characters/${character.id}/upload-reference`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not upload image.");
      }
      const data = await res.json();
      setReferenceImageUrl(data.character.referenceImageUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploadLoading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="flex flex-col items-center gap-4 p-6 lg:col-span-1">
        <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-2xl bg-surface-muted">
          {referenceImageUrl ? (
            <Image src={referenceImageUrl} alt={character?.name ?? "Character"} width={160} height={160} className="h-full w-full object-cover" unoptimized />
          ) : (
            <Users2 className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
        {isEdit ? (
          <div className="flex w-full flex-col gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onGeneratePortrait} disabled={portraitLoading}>
              <Wand2 className="h-4 w-4" /> {portraitLoading ? "Generating…" : "Generate portrait"}
            </Button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border-strong bg-transparent px-4 py-2 text-sm font-medium hover:bg-surface-muted">
              <Upload className="h-4 w-4" /> {uploadLoading ? "Uploading…" : "Upload reference image"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onUpload} disabled={uploadLoading} />
            </label>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Save the character first to generate or upload a reference image.</p>
        )}
      </Card>

      <form onSubmit={onSubmit} className="space-y-6 lg:col-span-2">
        <Card className="p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={character?.name} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="ageCategory">Age category</Label>
              <Input id="ageCategory" name="ageCategory" defaultValue={character?.ageCategory ?? ""} placeholder="e.g. Young adult" maxLength={50} />
            </div>
            <div>
              <Label htmlFor="genderPresentation">Gender presentation</Label>
              <Input id="genderPresentation" name="genderPresentation" defaultValue={character?.genderPresentation ?? ""} maxLength={50} />
            </div>
            <div>
              <Label htmlFor="hair">Hair</Label>
              <Input id="hair" name="hair" defaultValue={character?.hair ?? ""} placeholder="e.g. Short, curly, auburn" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="clothing">Clothing</Label>
              <Input id="clothing" name="clothing" defaultValue={character?.clothing ?? ""} placeholder="e.g. Blue hoodie, jeans" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="accessories">Accessories</Label>
              <Input id="accessories" name="accessories" defaultValue={character?.accessories ?? ""} placeholder="e.g. Round glasses" maxLength={200} />
            </div>
          </div>
          <div className="mt-5">
            <Label htmlFor="appearance">Appearance</Label>
            <Textarea id="appearance" name="appearance" rows={3} defaultValue={character?.appearance ?? ""} maxLength={1000} placeholder="Overall look and build" />
          </div>
          <div className="mt-5">
            <Label htmlFor="personality">Personality</Label>
            <Textarea id="personality" name="personality" rows={3} defaultValue={character?.personality ?? ""} maxLength={1000} placeholder="How they act and speak" />
          </div>
        </Card>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Save changes" : "Create character"}
          </Button>
        </div>
      </form>
    </div>
  );
}
