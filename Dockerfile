# syntax=docker/dockerfile:1
#
# Builds one image used for both of BridgeCodes' always-on production
# processes: the Next.js web app and the background worker (deployment
# pipeline + domain/hosting renewal + uptime sweeps). They're the same
# image rather than two separately-trimmed ones because the worker runs
# its TypeScript sources directly through tsx (`npm run worker`, same as
# local dev) instead of a compiled bundle, so it needs the same
# devDependencies (tsx, typescript) and full source tree the web build
# already produces -- a second "runtime-only" image would just duplicate
# that. docker-compose.yml runs this image twice: once as-is for the web
# app (`npm start`), once with `command: npm run worker` for the worker.

# ---- deps: install once, shared by the build stage -----------------------
FROM node:22-alpine AS deps
WORKDIR /app
# openssl is required by Prisma's query engine on musl (alpine); libc6-compat
# covers native addons (e.g. ssh2's optional crypto binding) that expect glibc
# shims.
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the Next.js app and generate the Prisma client -------
FROM deps AS builder
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runtime ---------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
