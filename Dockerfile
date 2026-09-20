# Self-hosted deployment image. NOT used by the schoolum.io Vercel
# deployment — Vercel builds directly from source and ignores this file
# entirely. This is only for `docker compose up` on a client's own server.
#
# Deliberately NOT using Next's "output: standalone" mode: that mode prunes
# node_modules down to only what the server bundle traces at build time,
# which is unreliable for a package like `prisma` that's invoked as a CLI
# (via npx) rather than imported — it can get pruned even though the
# container needs it to run migrations on startup. Copying the full
# production node_modules is a little larger on disk but far less likely
# to break for someone self-hosting this for the first time.

FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Prisma's query engine needs OpenSSL at both build and run time.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time-only placeholder DB URL — nothing in `next build` needs a real
# connection (the actual `prisma migrate deploy` runs at container startup,
# not here; see entrypoint.sh), but `prisma generate` and page prerendering
# both expect DATABASE_URL to be a syntactically valid Postgres URL.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npx next build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./entrypoint.sh"]
