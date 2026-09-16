# Moving this Orbit install to another machine

Three things live only on the machine Orbit was built on, and none of them are
in git:

| | Where it is | Why it cannot be rebuilt |
|---|---|---|
| The repository | `D:\nextJS\seosites` | There is **no git remote**. This checkout is the only copy. |
| The database | Docker volume `orbit_pgdata` | Products, categories, orders, the admin user, media rows. |
| Uploaded media | `apps/orbit-admin/media/` | Content-addressed files the `media_assets` rows point at. |

Plus the three gitignored `.env` files, without which the stack will not start.

Everything else — Docker images, `node_modules` — is rebuilt on the far side
from files that *are* in git. Don't copy them; they're bulky and tied to this
machine's architecture.

### Unmerged work

The bundle carries every branch, but a clone checks out one. `branches.txt`
in the transfer directory lists them with their commits. At the time of
writing the stack is:

```
main
└── orb-106-design-system      design system + app shell
    ├── rich-text-html-source  headings + HTML source view
    └── orb-505-media-library  media library
```

After cloning, `git branch -a` shows them all; `git checkout <name>` moves
between them.

## On this machine

First, make sure the media volume and the database agree — a dump whose rows
point at files that are not in the archive is worse than either half alone:

```bash
npm run media:sweep -w orbit-admin
```

That lists files nothing references. It changes nothing without `--delete`.

Then:

```bash
bash scripts/export-state.sh
```

Writes `../orbit-transfer-<timestamp>/`. Copy that directory across by any
means you like.

> **The `secrets/` folder holds plaintext credentials** — database password,
> `ORBIT_WRITE_TOKEN`, the seeded admin password. Treat the transfer directory
> the way you'd treat those secrets themselves: don't put it in cloud storage
> or email it, and delete it from both machines once the move is done.

## On the new machine

Needs Docker, Node 20+, and git. Then, from inside the copied directory:

```bash
bash import-state.sh /path/to/seosites
```

It clones the repo from the bundle, restores the `.env` files, runs `npm ci`,
starts Postgres, restores the dump (asking first — this step is destructive),
and unpacks the media. Afterwards `npm run dev` should come up with all your
data.

## Things to check afterwards

- **`DATABASE_URL`** in `apps/orbit-admin/.env` says `localhost:5432`. Correct
  it if the new machine reaches Postgres differently.
- **`ORBIT_WRITE_TOKEN`** must be byte-identical in `apps/orbit-admin/.env` and
  `apps/storefront/.env`, or the storefront's order intake is refused.
- **Paths in `apps/orbit-admin/.env.example`** mention `D:/nextJS/...`. Only a
  comment, but it will read wrong on a Linux box.
- **Media**: open a product with an image. A 404 there means the media archive
  didn't land where `MEDIA_DIR` resolves to.

## What about the containers?

You do not move them. `docker compose up -d --build` on the far side pulls
`postgres:16-alpine` and `caddy:2-alpine` and builds the two app images from
the Dockerfiles in the repo. That needs internet on the target machine, and
takes a few minutes.

If the target has no internet, export the images as well:

```bash
docker save postgres:16-alpine caddy:2-alpine orbit-orbit-admin   | gzip > orbit-images.tar.gz          # about 700 MB
```

and load them there with `docker load < orbit-images.tar.gz`. Only do this if
you have to: a saved image is built for one CPU architecture, so an image
saved on x86 will not run on an ARM machine, while a rebuild just works.

## Why a dump and not a copy of the volume

A Postgres data directory is tied to the server major version, the CPU
architecture and the endianness of the machine that wrote it. Copying
`orbit_pgdata` to a different machine works right up until one of those
differs, and then it fails in ways that look like corruption. `pg_dump -Fc`
restores onto any Postgres 16, anywhere.
