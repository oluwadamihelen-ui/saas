import { prisma } from "@/lib/db";
import { ApplicationStatus, Prisma } from "@/generated/prisma/client";

export interface ApplicationFilters {
  search?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "featured" | "newest" | "popular" | "price_asc" | "price_desc";
  page?: number;
  pageSize?: number;
}

const PUBLISHED = ApplicationStatus.PUBLISHED;

export async function listPublishedApplications(filters: ApplicationFilters = {}) {
  const { search, categorySlug, sort = "featured", page = 1, pageSize = 12 } = filters;

  const where: Prisma.ApplicationWhereInput = {
    status: PUBLISHED,
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { shortDescription: { contains: search, mode: "insensitive" } },
            { technologyStack: { has: search } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ApplicationOrderByWithRelationInput =
    sort === "newest"
      ? { createdAt: "desc" }
      : sort === "featured"
        ? { featured: "desc" }
        : { createdAt: "desc" };

  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        pricing: { where: { type: "LICENSE", isActive: true }, take: 1 },
      },
    }),
    prisma.application.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getApplicationBySlug(slug: string) {
  return prisma.application.findFirst({
    where: { slug, status: PUBLISHED },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      features: { orderBy: { sortOrder: "asc" } },
      pricing: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, take: 10 },
      versions: { where: { isLatest: true }, take: 1, include: { deploymentSpecification: true, artifact: true } },
    },
  });
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { applications: { where: { status: PUBLISHED } } } } },
  });
}

export async function listFeaturedApplications(take = 6) {
  return prisma.application.findMany({
    where: { status: PUBLISHED, featured: true },
    take,
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      pricing: { where: { type: "LICENSE", isActive: true }, take: 1 },
    },
  });
}
