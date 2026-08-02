# Architecture

Why the app is built the way it is. The [README](../README.md) covers the layers
and folder layout; this covers the decisions behind them.

---

## The starting problem

The web application is a Next.js monolith. Its pages are React Server Components
that call Prisma directly, and every write goes through a **Server Action**.
There was no API a native client could use:

- **Server Actions are not an API.** They are dispatched over Next.js's internal
  RSC protocol using build-generated action ids. The protocol is unversioned,
  undocumented and free to change between releases. A native client calling it
  would break on a routine `next` upgrade.
- **Auth was browser-shaped.** NextAuth v5 sets a JWT in an httpOnly cookie
  through a redirect flow. There was no token endpoint.
- **The few real routes were not enough.** `/api/billing/[id]/pdf`,
  `/api/export/*` and the WhatsApp webhook cover documents and exports, not
  customers, entries, bills or payments.

So parity required *some* new server surface. The question was how much.

## Three options considered

**1. WebView / TWA wrapper.** A day of work, zero backend change. Rejected: the
brief explicitly asked for something that feels native rather than a wrapped web
app, and a WebView inherits the desktop layouts, the browser scroll, and no
native navigation.

**2. Reimplement the domain in the app.** Rejected outright. Bill generation,
oldest-first payment allocation and status derivation are the parts that decide
who has been paid. Two implementations would eventually disagree, and the
disagreement would be about money.

**3. A thin REST layer over the existing services.** Chosen.

## What "thin" means here

Each route handler does exactly four things:

```ts
export const POST = withAuth(async (req) => {
  const parsed = recordCollectionSchema.safeParse(await req.json());  // same schema
  if (!parsed.success) return fail("Validation failed", 422, …);
  return ok(await recordCollection(parsed.data));                     // same service
});
```

It authenticates, validates with **the Zod schema the Server Action already
uses**, calls **the service function the Server Action already calls**, and
serialises. No branching on business state, no arithmetic, no queries.

The measure of success: `git diff` on `src/lib/services/` shows one change — a
transaction timeout — and it is a bug fix, not a rule change.

### The consequence for the client

The app cannot compute a balance, decide a bill's status, or allocate a payment,
because it is never given the inputs to do so. `recordCollection` takes an amount
and returns which invoices it settled. That asymmetry is deliberate: it makes the
wrong thing hard to write.

---

## Authentication

The app gets an HS256 bearer token signed with the **same `AUTH_SECRET`** NextAuth
uses, carrying the same user id, issued only after the same bcrypt comparison the
credentials provider performs. One user table, one password rule, one definition
of "signed in" — only the transport differs.

**Stateless, by choice.** No tokens table was added, so the database schema and
its behaviour are untouched. The cost is that revocation is by expiry, which is
why access tokens last an hour and why every request re-reads the user: deleting
an account on the Settings page stops its devices at the next call.

**Implemented on `node:crypto`**, about 60 lines, rather than adding a JWT
library to a deployed production app for one use.

**Tokens live in the Android Keystore** via `expo-secure-store`, never in
AsyncStorage — which is a plaintext file readable on a rooted or backed-up
device.

---

## Data flow

```
screen → hook (React Query) → endpoint fn → HTTP client → API route → service → Prisma
```

Nothing skips a layer. A screen importing `endpoints.ts` directly would bypass
cache invalidation; a hook building a URL would put the API surface in two places.

### Cache invalidation mirrors `revalidatePath`

The web's Server Actions call `revalidatePath` for every page a mutation makes
stale. `invalidateMoney()` in `query-client.ts` invalidates the same set —
dashboard, customers, manager, billing, reports — because recording a payment
changes all of them. Getting this wrong shows a farmer a balance they have
already collected.

### Retry policy

`client.ts` retries transient failures with backoff, but **only `GET`**. A
replayed `POST` could record a payment twice. That is the one failure in this
domain that costs real money, so the client never risks it. React Query's own
retry is disabled to avoid 3 × 3 = 9 attempts on a dead connection.

---

## Dates

The single largest source of bugs in this domain, and the reason two files exist
that look like they duplicate the server.

Milk entries and bill periods are Postgres `@db.Date` — calendar days with no
time or zone. The server documents at length why it anchors them at **noon UTC**:
midnight sits exactly on the day boundary, so any offset can flip the day.

The app applies the same discipline from the other end:

- Calendar days cross the wire as `"YYYY-MM-DD"` strings, never instants
  (`src/lib/mobile/dto.ts` enforces this).
- `src/utils/format.ts` formats them **from their parts**. Passing one to
  `new Date()` would parse it as UTC midnight and render the previous day on any
  device west of UTC.
- `src/utils/date.ts` anchors at noon UTC for arithmetic and reads "today" in
  `Asia/Kolkata`, so a phone on the wrong timezone still agrees with the server
  about which day it is.

This is verified by test, not assumed: an entry saved for `2026-08-01` is read
back on `2026-08-01`.

---

## UI

### Why React Native Paper

Material Design 3 out of the box, actively maintained, and its component
vocabulary matches what Android users expect — ripples, FABs, snackbars, the
pill-shaped navigation indicator. Building these by hand would have produced
something that *looks* like Material without behaving like it.

The theme extends Paper's `MD3Theme` with a `dairy` palette (`milk`, `billed`,
`paid`, `due`, `settled`, `pending`, `partial`) so domain state has semantic
colours in one place rather than hex values scattered across screens.

### What changed from the web, and why

The web layouts are desktop-first: wide tables, five-across stat strips, inline
editable grids. None survive 360dp. Each was re-thought around what the screen is
*for*, not how it looked:

- **Daily entry** — a 3-column grid became a card per customer that expands.
  Collapsed rows show the recorded quantity; only one is open at a time so the
  keyboard never covers the row being edited.
- **Monthly view** — a customer × 31-day matrix became a customer list that opens
  one person's month as a calendar of tappable cells. Every capability is kept.
- **Customer manager** — a wide editable table became cards with an action sheet.
  Defaults to the **Owing** filter, because that is why the screen gets opened,
  and sorts oldest-and-largest debt first.
- **Dashboard** — reports became shortcuts. Each tile navigates to where you act
  on it.
- **Reports** — a 12-row table gained a bar chart, because a trend is what a
  table communicates worst on a small screen.

### Loading, empty and error states

Three components in `states.tsx`, used by all fourteen screens, so they are
identical everywhere. Skeletons are shaped like the content, not spinners: the
layout does not reflow when data lands, which is what makes loading feel fast.
Offline is distinguished from failure because the remedy differs — "turn your
data on" versus "try again".

---

## Files and documents

PDFs, CSVs and backups are downloaded to the cache directory and handed to
Android's share sheet. That is the whole mechanism, and it is why the app needs
no storage permission, no bundled PDF renderer and no file browser: the system
already offers Print, Save to Drive, WhatsApp and every viewer installed.

The one wrinkle: `File.downloadFileAsync` rejects on a non-2xx response and
writes nothing, so the server's actual message ("No bills generated for this
month yet.") is unrecoverable from the failure. `download.ts` re-fetches the URL
to read it — a second request, but only on the error path, and the difference
between an explanation and "download failed (404)".

---

## What was deliberately not built

- **An offline write queue.** Two phones editing the same day offline would need
  conflict resolution over the quantities bills are calculated from. Being told
  to wait is better than a silent wrong total.
- **A server-address setting.** Letting the client point the app at an arbitrary
  host would be a phishing vector for their dairy's credentials.
- **Push notifications.** No backend infrastructure exists, and adding it goes
  well beyond the presentation layer.
- **Client-side money arithmetic.** See above — the server is asked, never
  second-guessed.
