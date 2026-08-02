# Dairy Billing

Milk delivery tracking, billing and WhatsApp invoicing for a dairy farm.

Two applications, one backend, one set of business rules:

| | What | Where |
|---|---|---|
| **Web** | Next.js 16 app — the full system | this repository |
| **Android** | Native app for daily use in the field | [`mobile/`](./mobile) |

The Android app does not reimplement anything. It calls `/api/mobile/*`, which
are thin wrappers over the same services the website uses. A billing rule
changes in one place and both follow.

> **This repository is public.** No credentials, connection strings or secrets
> appear anywhere in it. Every value lives in Netlify's environment variables or
> in a local `.env`, which is gitignored. See
> [Where the secrets live](#where-the-secrets-live).

---

## Environments

Two independent Netlify sites. Each has **its own database and its own
environment variables** — nothing is shared.

| | URL | Database | Purpose |
|---|---|---|---|
| **Production** | https://starlit-biscuit-dbe6ae.netlify.app | production (Neon) | The client's real data. ~50 customers, ~5,100 delivery records. |
| **Development** | https://beautiful-sprite-a18e5b.netlify.app | development (Neon) | Safe to break. Test here. |

Both build from this repository. `main` and `develop` are kept level.

### Telling them apart reliably

The two sites deliberately do **not** share `AUTH_SECRET`. A login session or an
Android bearer token issued by one is rejected by the other. That is a stronger
check than reading the hostname, and it is worth using before you do anything
destructive:

```bash
# Is the mobile API deployed on each site?
for s in starlit-biscuit-dbe6ae beautiful-sprite-a18e5b; do
  echo -n "$s: "
  curl -s -X POST "https://$s.netlify.app/api/mobile/auth/login" \
    -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"probe123"}'
  echo
done
```

| Response | Meaning |
|---|---|
| `{"success":false,"error":"Invalid email or password."}` | Deployed and healthy — correctly refusing a bad credential |
| `{"error":"Unauthorized"}` | **Not deployed** — the middleware is rejecting the path before the route exists |

---

## Accounts

Passwords are **not** recorded here or anywhere in this repository.

| Environment | Who signs in | Password |
|---|---|---|
| Production | The farm owner's account, created in the production database | Held by the client. Not in this repo, not known to developers. |
| Development | A seeded admin account (`admin@dairy.local`) plus any test users | In your local `.env` as `ADMIN_PASSWORD` |

Additional users are created **in the app** — Settings → Users → Add. There is
no sign-up page and no password reset; both are deliberate for a private,
single-farm system. The same account works on the website and in the Android
app, because both check the same `users` table with the same bcrypt comparison.

To recover a locked-out production account you must reset the hash directly in
the database — there is no email flow.

---

## Where the secrets live

| Secret | Local | Deployed |
|---|---|---|
| `DATABASE_URL` | `.env` (gitignored) | Netlify → Site configuration → Environment variables |
| `AUTH_SECRET` | `.env` | Netlify, **different value per site** |
| `ENCRYPTION_KEY` | `.env` | Netlify — see the warning below |
| `ADMIN_PASSWORD` | `.env`, used only by `db:seed` | not needed |
| `WHATSAPP_VERIFY_TOKEN` | `.env` | Netlify |
| Android signing keystore | `mobile/keystores/` (gitignored) | nowhere — back it up yourself |

Copy [`.env.example`](./.env.example) to `.env` and fill it in. The template
documents what each variable is for.

> **`ENCRYPTION_KEY` must never change once set.** The Green API access token is
> stored AES-GCM encrypted in the `settings` table. Change the key and that
> token becomes undecryptable — WhatsApp sending fails and nothing else does, so
> it is easy to miss. Re-entering the token in Settings is the only fix.

> **`AUTH_SECRET` signs Android bearer tokens too**, not just web sessions.
> Changing it signs out every phone as well as every browser.

---

## Running locally

```bash
npm install
cp .env.example .env      # then fill in the values
npm run db:push           # sync schema (development database only)
npm run db:seed           # create the admin user and default settings
npm run dev               # http://localhost:3000
```

**Point `.env` at the development database.** With it aimed at production,
`localhost` writes to the client's real books — and so does the Android debug
build, which targets your machine.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:push` | Push schema without a migration (development only) |
| `npm run db:seed` | Seed admin user and default settings |
| `npm run db:studio` | Prisma Studio |
| `npm run db:restore <file.json>` | Restore from a full JSON backup |

---

## Database

PostgreSQL on Neon, accessed through Prisma 7 with the `pg` driver adapter.

Six tables: `users`, `customers`, `daily_milk_entries`, `bills`, `payments`,
`settings`. Schema in [`prisma/schema.prisma`](./prisma/schema.prisma).

### Migrations

Both databases are now under migration control and in sync with the schema.
Check before deploying anything schema-related:

```bash
npx prisma migrate status          # uses whatever DATABASE_URL is set
npx prisma migrate deploy          # apply pending migrations
```

The production database was originally created outside Prisma Migrate and was
baselined on 2026-08-02, after which three columns were added to bring it in
line with the code: `customers.deleted_at`, `customers.last_reminded_at`, and
`settings.last_backup_at`. All additive, no data touched.

### Backups

There are two kinds of export, and only one of them is a backup:

| Export | Restores the database? |
|---|---|
| **Full JSON** (`/api/export/backup/json`, or Reports → Backup) | **Yes** — `npm run db:restore <file>` |
| CSV exports | No. Human-readable reports only. |

Only the JSON export stamps `settings.lastBackupAt`, which drives the staleness
badge on the Reports screen. Counting a CSV would make that badge lie about how
protected the data actually is.

Take a JSON backup before any schema change. Backups land in `backups/`, which
is gitignored because they contain password hashes and the WhatsApp token.

---

## Features

- **Daily entry** — morning/evening split or single total, per-customer L/ml
  units, quick-add amounts, copy-yesterday, bulk save
- **Monthly view** — the whole month as a customer × day grid
- **Customers** — add, edit, activate/deactivate, archive (soft delete, fully
  reversible), restore, CSV export
- **Customer manager** — dues, ageing, cash collection, payment ledger,
  WhatsApp reminders, inline bulk editing
- **Billing** — monthly generation with stable invoice numbers, per-customer or
  whole-month, print-all to a single PDF, bulk WhatsApp send with per-customer
  results
- **Quick bill** — one customer across several months as a consolidated
  statement, previewed before anything is created
- **Payments** — collections settle oldest bill first, splitting across bills as
  needed; overpayment refused; bill status always re-derived from the payments
  that actually exist
- **PDF invoices** — server-rendered A4, Hindi/Devanagari supported
- **WhatsApp** — Green API; bills as PDF, reminders as Hindi text
- **Reports** — all-time totals, 12-month trend, top customers, recent payments,
  backup and export
- **Settings** — farm details, global rate, entry mode, Green API credentials,
  user management

### Business rules worth knowing

These live in `src/lib/services/` and are shared by both applications:

- A billing period is always the 1st to the last day of a month
- Effective rate = the customer's own `pricePerLiter`, else the global rate
- Archived customers are excluded from billing, dashboards, reports and exports,
  but nothing is deleted and everything is restorable
- Calendar dates are stored as `@db.Date` and anchored at **noon UTC**; "today"
  is read in `Asia/Kolkata`, never from the server clock. This is why a bill
  period shows the same day regardless of where the server or phone happens to
  be. See the comments in `src/lib/utils/date.ts`.

---

## Architecture

```
Browser ──────────────► Next.js App Router
                         Server Components + Server Actions
                                    │
Android app ──────────► /api/mobile/*  (thin REST wrappers)
   HTTPS + Bearer                  │
                                    ▼
                        src/lib/services/*   ← all business logic
                                    │ Prisma
                              PostgreSQL (Neon)
```

- **Web** authenticates with NextAuth v5 — credentials, JWT in an httpOnly cookie
- **Android** authenticates with an HS256 bearer token signed with the same
  `AUTH_SECRET`, issued only after the same bcrypt check. One user table, one
  password rule; only the transport differs.
- Every `/api/mobile/*` route except login and refresh is wrapped in `withAuth()`,
  which verifies the token and loads the user before any handler runs

| Path | Contains |
|---|---|
| `src/app/(dashboard)/` | Web pages |
| `src/app/api/mobile/` | REST API for the Android app |
| `src/lib/services/` | **All business logic** |
| `src/lib/actions/` | Server Actions (web writes) |
| `src/lib/schemas/` | Zod validation, shared by both |
| `src/lib/mobile/` | Bearer tokens, DTOs, route guard |
| `mobile/` | The Android app |

---

## Deployment

Netlify builds both sites from this repository via `@netlify/plugin-nextjs`.
Pushing to the tracked branch triggers a build.

Security headers are declared in **both** `next.config.ts` and `netlify.toml`
and must stay in sync — when they disagree the browser takes the stricter one.
`X-Frame-Options` is `SAMEORIGIN` rather than `DENY` so the app can preview its
own bill PDFs in an iframe.

### After deploying

```bash
curl -s -X POST https://<site>.netlify.app/api/mobile/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"probe123"}'
```

`{"success":false,...}` means healthy. `{"error":"Unauthorized"}` means the
build did not pick up the mobile routes.

---

## Android app

Full documentation in [`mobile/README.md`](./mobile/README.md).

- Expo SDK 57 / React Native 0.86, Material Design 3, light and dark
- Package `com.dairybilling.app`, distributed as an APK — not on Google Play
- The server URL is **compiled in at build time**, so a build aimed at
  development can never reach production. Two APKs are maintained accordingly.
- `npm run verify:apk` reads the URL back out of a built APK, so you can prove
  which environment it targets instead of trusting the filename

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=https://starlit-biscuit-dbe6ae.netlify.app npm run apk:release
npm run verify:apk
```

The release signing keystore lives in `mobile/keystores/` and is **gitignored**.
If it is lost, no future update will install over an APK already on a phone —
back it up somewhere durable.

Further reading:
[architecture](./mobile/docs/ARCHITECTURE.md) ·
[feature map](./mobile/docs/FEATURE-MAP.md) ·
[API surface](./mobile/docs/API.md) ·
[testing notes](./mobile/docs/TESTING.md)

---

## Troubleshooting

**Every page throws a Server Components error after a deploy.** Usually the
database schema is behind the code. Run `npx prisma migrate status` against that
environment's `DATABASE_URL`. The real error and its digest are in Netlify →
Logs → Functions; the message is stripped from production builds by design.

**Mobile login always fails.** Either the mobile routes are not deployed (see
the curl check above), or `AUTH_SECRET` is unset on that site — without it, token
signing throws and login returns a 500.

**WhatsApp sending fails, everything else works.** `ENCRYPTION_KEY` no longer
matches the key that encrypted the stored Green API token. Re-enter the token in
Settings.

**Bill generation times out or produces nothing.** Generating a month runs one
aggregate and one upsert per customer inside a single transaction, plus an
invoice-number scan for each new bill. The transaction deadline is raised to
120s in `billing.service.ts` for exactly this reason; if it is still hit, the
database is unreachable rather than slow.

**The app shows the wrong customers.** Check which database that environment
points at — the two sites look identical and hold completely different data.

---

## Tech stack

Next.js 16 · React 19 · TypeScript · PostgreSQL (Neon) · Prisma 7 ·
NextAuth v5 · Tailwind CSS v4 · Radix UI · `@react-pdf/renderer` · Zod ·
Green API · React Native 0.86 / Expo SDK 57 · React Native Paper · TanStack Query
