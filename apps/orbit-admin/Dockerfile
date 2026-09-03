# syntax=docker/dockerfile:1
#
# Multi-stage build for the orbit-admin Next.js app in an npm-workspaces
# monorepo. Build context MUST be the repo root (see docker-compose.yml).

########################## deps: install workspace deps #######################
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Copy only the manifests first for a cacheable install layer.
COPY package.json package-lock.json ./
COPY apps/orbit-admin/package.json ./apps/orbit-admin/package.json
COPY apps/storefront/package.json ./apps/storefront/package.json
COPY packages/orbit-next/package.json ./packages/orbit-next/package.json
RUN npm ci

########################## builder: compile standalone ########################
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# `next build` imports every route module to read its config; `lib/db` refuses to
# load without DATABASE_URL. Nothing connects during the build (all DB-backed
# routes are force-dynamic), so a placeholder is enough — the real URL is
# injected at runtime by compose.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w orbit-admin

########################## runner: minimal runtime ###########################
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone output (includes a pruned node_modules and workspace packages).
COPY --from=builder --chown=nextjs:nodejs /app/apps/orbit-admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/orbit-admin/.next/static ./apps/orbit-admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/orbit-admin/public ./apps/orbit-admin/public
# Migrations are read at runtime by the boot migration runner (./drizzle).
COPY --from=builder --chown=nextjs:nodejs /app/apps/orbit-admin/drizzle ./apps/orbit-admin/drizzle

# Media volume mount point (ORB-501): deliberately outside /app so originals
# never sit anywhere the server could execute or statically serve them.
ENV MEDIA_DIR=/srv/orbit-media
RUN mkdir -p /srv/orbit-media && chown -R nextjs:nodejs /srv/orbit-media

USER nextjs
EXPOSE 3000

# Server runs from the app dir so `migrationsFolder: './drizzle'` resolves.
WORKDIR /app/apps/orbit-admin
CMD ["node", "server.js"]
