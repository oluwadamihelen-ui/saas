import { prisma } from "@/lib/db";
import { getAssetDisplayUrl } from "@/lib/storage";

const publicationCardInclude = {
  project: { include: { posterAsset: true } },
  publishedBy: { select: { name: true } },
} as const;

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

/** Discover's "Popular" rail — most-viewed published movies, saves as a tiebreaker. */
export async function listPopularPublications(limit: number): Promise<DiscoverCardData[]> {
  const publications = await prisma.publication.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: [{ views: "desc" }, { saves: "desc" }],
    take: limit,
    include: publicationCardInclude,
  });
  return Promise.all(publications.map(toCardData));
}

/** Discover's "New Releases" rail — most recently published movies. */
export async function listNewReleasePublications(limit: number): Promise<DiscoverCardData[]> {
  const publications = await prisma.publication.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: publicationCardInclude,
  });
  return Promise.all(publications.map(toCardData));
}

/** The current user's saved/favorited movies (My List, and the Projects "Collection" tab). */
export async function listUserFavorites(userId: string): Promise<DiscoverCardData[]> {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { publication: { include: publicationCardInclude } },
  });
  return Promise.all(favorites.map((f) => toCardData(f.publication)));
}
