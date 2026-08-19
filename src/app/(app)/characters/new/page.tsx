import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CharacterForm } from "@/components/dashboard/character-form";

export const metadata: Metadata = { title: "New Character" };

export default function NewCharacterPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/characters" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to characters
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">New character</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Define a reusable identity — Storyloom applies it consistently across every scene it appears in.
      </p>
      <div className="mt-8">
        <CharacterForm />
      </div>
    </div>
  );
}
