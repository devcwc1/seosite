# Orbit — Project Map

> **Living document.** Keep this updated as the project evolves — when files are
> added/moved/removed or a new area of tech is introduced, update the relevant
> table and the "Last updated" line below.

**Last updated:** 2026-08-18

**Mental model:** `lib/db/schema.ts` defines the data → `lib/products/*` and
`lib/storefront/*` operate on it → `app/(protected)/*` is the admin UI and
`app/api/*` is the HTTP layer → the `@orbit/next` package carries data to the
`storefront` app. Auth wraps everything under `app/(protected)/` via its
`layout.tsx`.

---

## Tech stack

| Area | Technology |
|------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Monorepo | npm workspaces — `apps/orbit-admin`, `apps/storefront`, `packages/@orbit/next` |
| Database | PostgreSQL 16 |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| UI | Tailwind CSS v4 + shadcn/ui (base-ui) |
| Auth | @node-rs/argon2 (hashing) + custom DB sessions |
| Validation | Zod |
| Logging | Pino (+ pino-pretty in dev) |
| API errors | RFC 7807 `application/problem+json` |
| Testing | Vitest |
| Containers | Docker Compose (postgres, orbit-admin, storefront, caddy) |
| Reverse proxy / TLS | Caddy |
| Ops | VPS hardening script (UFW, SSH, fail2ban) |

## Quick commands (run from repo root)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start orbit-admin dev server (localhost:3000) |
| `npm run dev:storefront` | Start storefront dev server |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed admin user + demo products |
| `npm run test` | Run tests across workspaces |
| `docker compose up -d postgres` | Start local Postgres |
| `docker compose up --build` | Build + run the full stack |

## Data model (`apps/orbit-admin/lib/db/schema.ts`)

`users` · `sessions` · `products` · `product_content` (title, short info,
description, images, categories, meta, reviews — versioned) ·
`product_content_revisions` · `audit_logs` · `settings` · `media`

---

## Root / Monorepo
| File | Purpose |
|------|---------|
| `package.json` | Workspace config + scripts (dev, db:*, test) |
| `package-lock.json` | Locked dependency tree |
| `.gitignore` / `.gitattributes` | Ignore rules; force LF on scripts/Dockerfiles |
| `.env` | Local, gitignored — Compose credentials |
| `.env.template` | Committed mock env template |
| `README.md` | Project overview |
| `PROJECT_MAP.md` | This file |

## Infrastructure & Deployment (Docker · Caddy · VPS)
| File | Purpose |
|------|---------|
| `docker-compose.yml` | postgres, orbit-admin, storefront, caddy (+ volumes) |
| `docker-compose.override.yml` | Local-dev overrides (publishes Postgres :5432) |
| `Caddyfile` | Reverse proxy + TLS routing |
| `.dockerignore` | Trims the build context |
| `apps/orbit-admin/Dockerfile` | Multi-stage build (Next standalone) — admin |
| `apps/storefront/Dockerfile` | Multi-stage build — storefront |
| `scripts/harden-vps.sh` | UFW, SSH, fail2ban hardening |

## orbit-admin — App config
| File | Purpose |
|------|---------|
| `apps/orbit-admin/next.config.ts` | `output: standalone`, tracing root |
| `apps/orbit-admin/tsconfig.json` | Strict TS config |
| `apps/orbit-admin/eslint.config.mjs` | ESLint config |
| `apps/orbit-admin/postcss.config.mjs`, `app/globals.css` | Tailwind v4 + theme tokens |
| `apps/orbit-admin/components.json` | shadcn/ui config |
| `apps/orbit-admin/lib/utils.ts` | `cn()` class-merge helper |
| `apps/orbit-admin/.env`, `.env.example` | Admin runtime env |
| `apps/orbit-admin/instrumentation.ts` | Runs boot migrations on start |

## orbit-admin — Database (Drizzle)
| File | Purpose |
|------|---------|
| `apps/orbit-admin/lib/db/schema.ts` | Single source of truth — tables + types |
| `apps/orbit-admin/lib/db/index.ts` | DB client (pg Pool + Drizzle) |
| `apps/orbit-admin/lib/db/migrate.ts` | Advisory-locked boot migration runner |
| `apps/orbit-admin/lib/db/migration-state.ts` | `isMigrationComplete` flag |
| `apps/orbit-admin/drizzle.config.ts` | drizzle-kit config |
| `apps/orbit-admin/drizzle/0000_init.sql` | Initial migration (7 tables) |
| `apps/orbit-admin/drizzle/0001_add_instock_meta_reviews.sql` | Adds in_stock, meta, reviews |
| `apps/orbit-admin/drizzle/0002_add_media.sql` | Adds `media` table (asset library) |
| `apps/orbit-admin/drizzle/meta/*` | Migration snapshots + journal |
| `apps/orbit-admin/scripts/seed.ts` | Seeds admin user + demo products |

## orbit-admin — Auth
| File | Purpose |
|------|---------|
| `apps/orbit-admin/lib/auth/password.ts` | argon2 hash/verify |
| `apps/orbit-admin/lib/auth/session.ts` | Sessions, cookie, MFA gate helper |
| `apps/orbit-admin/lib/auth/actions.ts` | Logout, MFA enrol/verify (stub) |
| `apps/orbit-admin/app/login/actions.ts` | `loginAction` |
| `apps/orbit-admin/app/login/page.tsx` | Login page (server) |
| `apps/orbit-admin/components/auth/login-form.tsx` | Login form (client) |
| `apps/orbit-admin/app/mfa/page.tsx`, `mfa/enroll/page.tsx` | MFA verify / enrol stubs |
| `apps/orbit-admin/app/(protected)/layout.tsx` | Auth guard for protected routes |

## orbit-admin — Products (CRUD)
| File | Purpose |
|------|---------|
| `apps/orbit-admin/lib/products/validation.ts` | Zod schema, payload types, `slugify` |
| `apps/orbit-admin/lib/products/mutations.ts` | create/update/delete/getForEdit (tx, revisions, audit) |
| `apps/orbit-admin/app/(protected)/products/actions.ts` | Server actions |
| `apps/orbit-admin/app/(protected)/products/page.tsx` | Product list (thumbnails, edit/delete) |
| `apps/orbit-admin/app/(protected)/products/new/page.tsx` | New product page |
| `apps/orbit-admin/app/(protected)/products/[id]/edit/page.tsx` | Edit product page |
| `apps/orbit-admin/components/products/product-form.tsx` | Shared form (details, pricing/stock, images, meta, reviews) |
| `apps/orbit-admin/components/products/delete-product-button.tsx` | Delete button (client) |

## orbit-admin — Users (management, admin-only)
| File | Purpose |
|------|---------|
| `apps/orbit-admin/lib/users/validation.ts` | Zod create/update schemas + payload types |
| `apps/orbit-admin/lib/users/mutations.ts` | list/create/update/delete + guards (last admin, self) |
| `apps/orbit-admin/app/(protected)/users/actions.ts` | Admin-only server actions |
| `apps/orbit-admin/app/(protected)/users/page.tsx` | User list (roles, MFA, edit/delete) |
| `apps/orbit-admin/app/(protected)/users/new/page.tsx` | Create user |
| `apps/orbit-admin/app/(protected)/users/[id]/edit/page.tsx` | Edit user (role, password reset, MFA reset) |
| `apps/orbit-admin/components/users/user-form.tsx` | Shared create/edit form |
| `apps/orbit-admin/components/users/delete-user-button.tsx` | Delete button (guards self) |
| `lib/auth/session.ts` → `isAdmin` / `requireAdminSession` | Role authorization helpers |

## orbit-admin — Media (asset library)
| File | Purpose |
|------|---------|
| `lib/db/schema.ts` → `media` | Asset table (filename, mime, size, alt, uploaded_by) |
| `apps/orbit-admin/lib/media/types.ts` | `MediaDTO` (client-safe wire shape) |
| `apps/orbit-admin/lib/media/mutations.ts` | createFromFile / list / delete (DB record + disk) |
| `apps/orbit-admin/lib/uploads.ts` | Low-level disk storage, allowed types, size cap |
| `apps/orbit-admin/app/api/media/route.ts` | `GET` list · `POST` upload |
| `apps/orbit-admin/app/api/media/[id]/route.ts` | `DELETE` asset (row + file) |
| `apps/orbit-admin/app/api/uploads/[name]/route.ts` | `GET` serve stored file |
| `apps/orbit-admin/app/(protected)/media/page.tsx` | Media library page |
| `apps/orbit-admin/components/media/media-library.tsx` | Browse / search / upload / delete UI |
| `apps/orbit-admin/components/media/media-picker.tsx` | Reusable picker dialog (used by product form) |
| `apps/orbit-admin/uploads/` | Stored files (runtime, gitignored, Docker volume) |

## orbit-admin — API routes & error handling
| File | Purpose |
|------|---------|
| `apps/orbit-admin/lib/http/problem.ts` | RFC 7807 `problem()` / `problemFor()` |
| `apps/orbit-admin/app/api/health/route.ts` | Readiness probe (503 → 200) |
| `apps/orbit-admin/app/api/storefront/products/route.ts` | Public product list API |
| `apps/orbit-admin/app/api/storefront/products/[slug]/route.ts` | Public product-by-slug API |
| `apps/orbit-admin/lib/storefront/products.ts` | Read model (published products) |
| `apps/orbit-admin/lib/storefront/mapper.ts` | Row → `@orbit/next` DTO mapper |

## orbit-admin — Logging & utils
| File | Purpose |
|------|---------|
| `apps/orbit-admin/lib/logger.ts` | Pino logger (pretty in dev, JSON in prod) |
| `apps/orbit-admin/lib/audit.ts` | `recordAudit()` → `audit_logs` |
| `apps/orbit-admin/lib/format.ts` | `formatPrice()` |

## orbit-admin — UI shell & pages
| File | Purpose |
|------|---------|
| `apps/orbit-admin/app/layout.tsx` | Root layout |
| `apps/orbit-admin/app/page.tsx` | `/` → redirects to `/dashboard` |
| `apps/orbit-admin/app/(protected)/dashboard/page.tsx` | Dashboard (stat counts) |
| `apps/orbit-admin/app/(protected)/users/page.tsx`, `settings/page.tsx` | Placeholders |
| `apps/orbit-admin/components/admin/admin-shell.tsx` | Sidebar + header + sign-out |
| `apps/orbit-admin/components/ui/*.tsx` | shadcn components (button, card, input, table, select, dialog, …) |

## orbit-admin — Tests (Vitest)
| File | Purpose |
|------|---------|
| `apps/orbit-admin/vitest.config.mts` | Vitest config |
| `apps/orbit-admin/lib/auth/password.test.ts` | argon2 hash/verify |
| `apps/orbit-admin/lib/db/schema.test.ts` | Schema column assertions |
| `apps/orbit-admin/lib/storefront/mapper.test.ts` | DTO mapping + in-stock logic |
| `apps/orbit-admin/lib/http/problem.test.ts` | RFC 7807 helper |

## @orbit/next (shared data SDK)
| File | Purpose |
|------|---------|
| `packages/orbit-next/src/index.ts` | `createOrbitClient`, DTOs, `OrbitApiError` |
| `packages/orbit-next/package.json`, `tsconfig.json` | Package config |

## storefront (public site)
| File | Purpose |
|------|---------|
| `apps/storefront/lib/orbit.ts` | Orbit client + `formatPrice`/`primaryImage` |
| `apps/storefront/app/page.tsx` | Catalog (lists products via `@orbit/next`) |
| `apps/storefront/app/products/[id]/page.tsx` | Product detail page |
| `apps/storefront/app/cart/page.tsx` | Cart placeholder |
| `apps/storefront/app/layout.tsx`, `globals.css` | Layout + styles |
| `apps/storefront/eslint.config.mjs` | Isolation rule — bans direct DB/ORM imports |
| `apps/storefront/next.config.ts` | Standalone + `transpilePackages: ["@orbit/next"]` |

---

## Status snapshot

**Working:** admin auth (login → MFA gate → dashboard → sign-out), product
create/edit/delete (revisions + audit), product list, user management
(admin-only, roles, password/MFA reset, self + last-admin guards), media
library (upload/browse/search/delete + picker), storefront read API, boot
migrations,
`/api/health` (admin), RFC 7807 API errors (admin), local Postgres.

**Known gaps:**
- Media library built but **not yet live-verified** (Docker engine was down when
  added — migration `0002` needs applying and a smoke test).
- Uploaded images use relative `/api/uploads` URLs the storefront can't render
  cross-origin yet (needs a public admin URL).
- Storefront has **no** Pino logger and **no** `/api/health` (T4 incomplete on
  storefront side).
- Not built: real TOTP MFA (stubbed), category editing, media
  reference-tracking (deleting in-use media breaks product images),
  role-based restriction of product editing (any signed-in user can edit).
- Full `docker compose up --build` not yet run end-to-end; no git remote.
