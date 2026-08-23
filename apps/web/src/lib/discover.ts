import { prisma } from "@/lib/db";
import { getAssetDisplayUrl } from "@/lib/storage";

const publicationCardInclude = {
  project: { include: { posterAsset: true } },
  publishedBy: { select: { name: true } },
} as const;

// Mirrors @cinerra/domain's isPublicationPubliclyVisible — Prisma's `where`
// can't call a shared function, so the two must be kept in sync by hand.
const PUBLICLY_VISIBLE_WHERE = { visibility: "PUBLIC", moderationStatus: "APPROVED" } as const;

export interface DiscoverCardData {
  publicationId: string;
  projectId: string;
  title: string;
  visualStyle: string;
  ownerName: string;
  views: number;
  saves: number;
  posterUrl: string | null;
}

async function toCardData(publication: {
  id: string;
  views: number;
  saves: number;
  project: { id: string; title: string; visualStyle: string; posterAsset: { storageKey: string } | null };
  publishedBy: { name: string | null };
}): Promise<DiscoverCardData> {
  return {
    publicationId: publication.id,
    projectId: publication.project.id,
    title: publication.project.title,
    visualStyle: publication.project.visualStyle,
    ownerName: publication.publishedBy.name ?? "A Cinerra creator",
    views: publication.views,
    saves: publication.saves,
    posterUrl: publication.project.posterAsset ? await getAssetDisplayUrl(publication.project.posterAsset.storageKey) : null,
  };
}

/** Discover's "Popular" rail — most-viewed published-and-approved movies, saves as a tiebreaker. */
export async function listPopularPublications(limit: number): Promise<DiscoverCardData[]> {
  const publications = await prisma.publication.findMany({
    where: PUBLICLY_VISIBLE_WHERE,
    orderBy: [{ views: "desc" }, { saves: "desc" }],
    take: limit,
    include: publicationCardInclude,
  });
  return Promise.all(publications.map(toCardData));
}

/** Discover's "New Releases" rail — most recently published-and-approved movies. */
export async function listNewReleasePublications(limit: number): Promise<DiscoverCardData[]> {
  const publications = await prisma.publication.findMany({
    where: PUBLICLY_VISIBLE_WHERE,
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: publicationCardInclude,
  });
  return Promise.all(publications.map(toCardData));
}

/**
 * The current user's saved/favorited movies (My List, and the Projects
 * "Collection" tab). Not moderation-gated: a favorite can only be created
 * from the watch page, which is itself gated, so an already-saved item
 * staying visible here even if later rejected is a rare, low-stakes edge
 * case rather than a moderation bypass.
 */
export async function listUserFavorites(userId: string): Promise<DiscoverCardData[]> {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { publication: { include: publicationCardInclude } },
  });
  return Promise.all(favorites.map((f) => toCardData(f.publication)));
}
