# seosites

A monorepo containing two Next.js 15 (App Router) applications:

| App | Path | Purpose |
| --- | --- | --- |
| `orbit-admin` | `apps/orbit-admin` | Admin dashboard: product management, users, auth (MFA), audit logging. |
| `storefront` | `apps/storefront` | Public-facing storefront. |

## Stack

- **Next.js 15** (App Router) + **React 19**, strict TypeScript
- **Tailwind CSS** + **shadcn/ui** (admin)
- **Drizzle ORM** targeting **PostgreSQL** (admin)
- **Pino** structured logging, **@node-rs/argon2** password hashing
- **Vitest** for unit tests
- **npm workspaces** for the monorepo

## Getting started

```bash
npm install
```

Copy the admin env template and set your database URL:

```bash
cp apps/orbit-admin/.env.example apps/orbit-admin/.env
```

### Common scripts (run from repo root)

```bash
npm run dev:admin         # start orbit-admin
npm run dev:storefront    # start storefront
npm run db:generate       # generate Drizzle SQL migrations
npm run db:migrate        # apply migrations to the database
npm run db:seed           # seed the initial admin user
npm run test              # run tests across workspaces
```

## Database

The admin app owns the schema (`apps/orbit-admin/lib/db/schema.ts`).
Migrations live in `apps/orbit-admin/drizzle/`.
