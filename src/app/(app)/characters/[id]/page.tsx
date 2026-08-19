import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/server/auth";
import { getCharacterForUser, CharacterNotFoundError } from "@/server/characters/repository";
import { CharacterForm } from "@/components/dashboard/character-form";
import { DeleteCharacterButton } from "@/components/dashboard/delete-character-button";

export const metadata: Metadata = { title: "Edit Character" };

export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  let character;
  try {
    character = await getCharacterForUser(session!.user.id, id);
  } catch (err) {
    if (err instanceof CharacterNotFoundError) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/characters" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to characters
        </Link>
        <DeleteCharacterButton characterId={character.id} />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold">{character.name}</h1>
      <div className="mt-8">
        <CharacterForm character={character} />
      </div>
    </div>
  );
}
