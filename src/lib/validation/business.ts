import { z } from "zod";

export const BUSINESS_CATEGORIES = [
  "Food",
  "Fashion",
  "Beauty",
  "Electronics",
  "Retail",
  "Services",
  "Health & wellness",
  "Home",
  "Digital products",
  "Other",
] as const;

export const createBusinessSchema = z.object({
  name: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  country: z.string().default("Nigeria"),
  currency: z.string().default("NGN"),
  category: z.enum(BUSINESS_CATEGORIES),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export const productSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  price: z.coerce.number().nonnegative(),
  costPrice: z.coerce.number().nonnegative().optional().nullable(),
  sku: z.string().max(60).optional().nullable(),
  stockQuantity: z.coerce.number().int().nonnegative().default(0),
  lowStockThreshold: z.coerce.number().int().nonnegative().default(10),
  categoryName: z.string().max(80).optional().nullable(),
  // Either a hosted image URL or a client-resized data: URL (see
  // lib/image-resize.ts) — capped well above what a compressed ~800px
  // JPEG needs, as a sanity bound rather than a real storage limit.
  primaryImageUrl: z.string().max(2_000_000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;
