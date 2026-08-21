import { z } from "zod";

export { hashPassword, verifyPassword } from "./password.js";

/**
 * Central environment schema. Every variable actually consumed by the
 * application is declared here — nothing speculative (spec §71).
 *
 * Required vs optional matters: infrastructure (DB/Redis/storage/auth) is
 * required to boot at all. AI provider keys, Stripe, and OAuth are optional
 * — their absence must degrade to an honest "not configured" state (spec §81),
 * never a crash and never a fake success.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  // --- Database ---
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // --- Queue ---
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // --- Object storage (S3-compatible: AWS S3, Cloudflare R2, MinIO) ---
  STORAGE_ENDPOINT: z.string().min(1).optional(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().min(1, "STORAGE_BUCKET is required"),
  STORAGE_ACCESS_KEY_ID: z.string().min(1, "STORAGE_ACCESS_KEY_ID is required"),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1, "STORAGE_SECRET_ACCESS_KEY is required"),
  STORAGE_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(), // CDN in front of the bucket

  // --- Auth ---
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // --- Billing (Stripe) ---
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // --- AI providers (all optional — router degrades honestly if unset) ---
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parses and validates process.env once per process, caching the result. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example for the full list of variables.`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests: reset the cache so a fresh env can be loaded. */
export function resetEnvCacheForTests(): void {
  cached = null;
}

export const isProviderConfigured = {
  anthropic: (env: Env) => Boolean(env.ANTHROPIC_API_KEY),
  openai: (env: Env) => Boolean(env.OPENAI_API_KEY),
  runway: (env: Env) => Boolean(env.RUNWAY_API_KEY),
  elevenlabs: (env: Env) => Boolean(env.ELEVENLABS_API_KEY),
  stripe: (env: Env) => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
  googleOAuth: (env: Env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
};
