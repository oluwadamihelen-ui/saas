// Stub for the "server-only" package under vitest. The real package
// unconditionally throws when imported outside a Next.js bundle (webpack/
// turbopack recognize it as a special marker; plain Node/vitest doesn't) —
// confirmed empirically against tsx earlier in this project. Aliased in
// vitest.config.ts so tests can import real server-side modules unmodified
// instead of duplicating their logic the way prisma/seed has to.
export {};
