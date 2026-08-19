import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Users2, PlusCircle } from "lucide-react";
import { auth } from "@/server/auth";
import { listCharactersForUser } from "@/server/characters/repository";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = { title: "Characters" };

export default async function CharactersPage() {
  const session = await auth();
  const characters = await listCharactersForUser(session!.user.id);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Characters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable character identities that stay visually consistent across scenes and projects.
          </p>
        </div>
        <Button href="/characters/new">
          <PlusCircle className="h-4 w-4" /> New character
        </Button>
      </div>

      {characters.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Users2}
            title="No characters yet"
            description="Create a character once — appearance, hair, clothing and personality — and reuse it across any project."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {characters.map((c) => (
            <Link key={c.id} href={`/characters/${c.id}`}>
              <Card className="h-full p-4 transition-colors hover:border-brand-300">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                  {c.referenceImageUrl ? (
                    <Image src={c.referenceImageUrl} alt={c.name} width={200} height={200} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <Users2 className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <h3 className="mt-3 line-clamp-1 font-display text-sm font-semibold">{c.name}</h3>
                {c.appearance && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.appearance}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
