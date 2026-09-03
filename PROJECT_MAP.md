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
`product_content_revisions` · `audit_logs` · `settings` · `media` ·
`media_assets` (ORB-501: sha256-deduped, content-addressed) · `product_media`
(product↔asset gallery)

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
| `apps/orbit-admin/drizzle/0003_add_media_assets.sql` | ORB-501: `media_assets` + `product_media` |
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

## orbit-admin — Hardened media intake (ORB-501)
| File | Purpose |
|------|---------|
| `apps/orbit-admin/lib/media/constants.ts` | Allowlist + bounds as code constants (15 MB, 200–8000px) |
| `apps/orbit-admin/lib/media/sniff.ts` | Magic-byte MIME sniffing (JPEG/PNG/WebP/AVIF; SVG flagged) |
| `apps/orbit-admin/lib/media/errors.ts` | Typed `UploadError` (code + HTTP status) |
| `apps/orbit-admin/lib/media/storage.ts` | Content-addressed atomic tmp→rename write (media volume) |
| `apps/orbit-admin/lib/media/process.ts` | Pipeline: sniff → dedupe → sharp validate/re-encode → store |
| `apps/orbit-admin/lib/media/assets.ts` | Asset DTO/list/delete (in-use guarded) + product_media links |
| `apps/orbit-admin/app/api/v1/media/upload/route.ts` | `POST` hardened upload (T1) |
| `apps/orbit-admin/app/api/v1/media/file/[id]/route.ts` | `GET` serve asset (nosniff) |
| `apps/orbit-admin/lib/media/sniff.test.ts` | Sniffer unit tests |
| `apps/orbit-admin/lib/media/upload.security.test.ts` | Security suite (T4): polyglots, mismatch, oversize, bombs, dedupe, payload-strip |
| `apps/orbit-admin/lib/products/gallery.test.ts` | Gallery round-trip: edit-form prefill + resubmit keeps `product_media` |

## orbit-admin — Media library UI
| File | Purpose |
|------|---------|
| `lib/db/schema.ts` → `media_assets` | Hardened asset table (sha256 unique index, storage_key, dimensions) |
| `lib/db/schema.ts` → `media` | **Deprecated** pre-ORB-501 table — kept only for existing rows, pending a drop migration |
| `apps/orbit-admin/lib/media/types.ts` | `MediaAssetDTO` / `ProductMediaItemDTO` wire shapes |
| `apps/orbit-admin/app/api/v1/media/route.ts` | `GET` list (library + picker) |
| `apps/orbit-admin/app/api/v1/media/[id]/route.ts` | `DELETE` asset (409 while used by a product) |
| `apps/orbit-admin/app/(protected)/media/page.tsx` | Media library page |
| `apps/orbit-admin/components/media/upload-media.ts` | XHR upload client (progress events) |
| `apps/orbit-admin/components/media/media-library.tsx` | Browse / search / upload / delete UI |
| `apps/orbit-admin/components/media/media-picker.tsx` | Reusable picker dialog (used by the product form) |
| `apps/orbit-admin/media/` | Media volume root — `MEDIA_DIR`, `/srv/orbit-media` in Docker (gitignored) |

## orbit-admin — API routes & error handling
| File | Purpose |
|------|---------|
| `apps/orbit-admin/lib/http/problem.ts` | RFC 7807 `problem()` / `problemFor()` |
| `apps/orbit-admin/app/api/health/route.ts` | Readiness probe (503 → 200) |
| `apps/orbit-admin/app/api/storefront/products/route.ts` | Public product list API |
| `apps/orbit-admin/app/api/storefront/products/[slug]/route.ts` | Public product-by-slug API |
| `apps/orbit-admin/lib/storefront/products.ts` | Read model (published products + `product_media` galleries) |
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
create/edit/delete (revisions + audit; the gallery is now prefilled on edit and
survives a resubmit), product list, user management (admin-only, roles,
password/MFA reset, self + last-admin guards), media library
(upload/browse/search/delete + picker), storefront read API, boot migrations,
`/api/health` (admin), RFC 7807 API errors (admin), local Postgres.
**ORB-501 hardened media intake** is complete and wired into the UI: sniff →
type/extension agreement → dimension bounds → sharp re-encode → sha256 dedupe →
atomic content-addressed write, with an XHR progress UI in the library and
picker. The legacy unhardened `POST /api/media`, `/api/uploads/[name]` and
`lib/uploads.ts` are **removed**, so the hardened endpoint is the only intake
path. The public storefront read model sources galleries from `product_media`
too, so admin edits keep showing up on the storefront. Verified against a live
Postgres: 39 tests green, `tsc --noEmit` clean, `next build` clean.

**Known gaps:**
- No **E2E** harness (no Playwright) — ORB-501's QA note asks for an
  editor-driven upload test. The admin UI has also not had a browser smoke test
  (it needs a human to sign in).
- Caddy does not serve the media volume yet (**ORB-103**); assets stream through
  `/api/v1/media/file/[id]`, which sets `nosniff` + immutable caching.
- The deprecated `media` table and the old `uploads` Docker volume still hold
  legacy rows/files; a drop migration + volume prune is the follow-up.
- Storefront can't render `/api/v1/media/file/...` URLs cross-origin yet (needs
  a public admin URL).
- Storefront has **no** Pino logger and **no** `/api/health` (T4 incomplete on
  storefront side).
- Not built: real TOTP MFA (stubbed), category editing,
  role-based restriction of product editing (any signed-in user can edit).
- Full `docker compose up --build` not yet run end-to-end; no git remote.
