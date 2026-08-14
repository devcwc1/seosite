# syntax=docker/dockerfile:1
#
# Multi-stage build for the storefront Next.js app in an npm-workspaces
# monorepo. Build context MUST be the repo root (see docker-compose.yml).

########################## deps: install workspace deps #######################
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
COPY apps/orbit-admin/package.json ./apps/orbit-admin/package.json
COPY apps/storefront/package.json ./apps/storefront/package.json
COPY packages/orbit-next/package.json ./packages/orbit-next/package.json
RUN npm ci

########################## builder: compile standalone ########################
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w storefront

########################## runner: minimal runtime ###########################
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/public ./apps/storefront/public

USER nextjs
EXPOSE 3000

WORKDIR /app/apps/storefront
CMD ["node", "server.js"]
