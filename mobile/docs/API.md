# Mobile API

The endpoints added to the Next.js project so a native client can reach the
application's data. They live under `src/app/api/mobile/**` in the parent
repository.

**These routes contain no business logic.** Each one authenticates, validates
with the same Zod schema the corresponding Server Action uses, calls the same
service function, and serialises the result. If a rule needs to change, it
changes in `src/lib/services/*` and both the website and the app follow.

---

## Conventions

**Base URL** — whatever `EXPO_PUBLIC_API_URL` is set to, e.g.
`https://your-app.netlify.app`.

**Authentication** — `Authorization: Bearer <accessToken>` on every route except
login and refresh. Tokens are HS256, signed with the same `AUTH_SECRET` NextAuth
uses, and carry the same user id. Access tokens last 1 hour; refresh tokens 60
days. The user is re-read from the database on every request, so deleting an
account stops its devices immediately.

**Response envelope** — every JSON endpoint returns the web app's own
`ActionResult<T>` type:

```jsonc
{ "success": true,  "data": { … } }
{ "success": false, "error": "Human-readable message", "fieldErrors": { "name": ["…"] } }
```

`error` is written for the user and is displayed verbatim by the app. The file
endpoints (PDF, CSV, JSON backup) return the file itself instead, and report
failures as JSON with the same shape.

**Status codes** — `401` session gone · `404` not found · `422` validation
failed (`fieldErrors` populated) · `400` refused for a business reason ·
`500` unexpected.

**Dates** — calendar days (`@db.Date` columns) are always `"YYYY-MM-DD"`.
Timestamps are full ISO strings. Prisma `Decimal` is always a JSON number.

---

## Authentication

| Method | Path | Delegates to | Notes |
|---|---|---|---|
| `POST` | `/api/mobile/auth/login` | `prisma.user` + `bcrypt.compare` | Same check as the NextAuth credentials provider. Returns token pair + user. |
| `POST` | `/api/mobile/auth/refresh` | — | Exchanges a refresh token for a new pair. |
| `GET` | `/api/mobile/auth/me` | — | Confirms a stored token on cold start. |

---

## Dashboard

| Method | Path | Delegates to |
|---|---|---|
| `GET` | `/api/mobile/dashboard` | `getDashboardData()` |

Returns `today` (in `Asia/Kolkata`), the seven dashboard stats, today's
customer/entry list, and pending bills — all computed by the same service the
web dashboard renders from, including its per-customer revenue rule.

---

## Customers

| Method | Path | Delegates to |
|---|---|---|
| `GET` | `/api/mobile/customers?search=&active=&archived=1` | `getCustomersWithStats()` |
| `POST` | `/api/mobile/customers` | `createCustomer()` — `createCustomerSchema` |
| `GET` | `/api/mobile/customers/[id]` | `getCustomerById()` |
| `PATCH` | `/api/mobile/customers/[id]` | `updateCustomer()` — `updateCustomerSchema` |
| `DELETE` | `/api/mobile/customers/[id]` | `deleteCustomer()` — **soft delete**, fully reversible |
| `GET` | `/api/mobile/customers/[id]/actions` | `getCustomerPaymentHistory()` |
| `POST` | `/api/mobile/customers/[id]/actions` | `{ action }`: `toggle-status` → `toggleCustomerStatus()` · `restore` → `restoreCustomer()` · `remind` → `sendPaymentReminder()` |

---

## Customer manager

| Method | Path | Delegates to |
|---|---|---|
| `GET` | `/api/mobile/customer-manager` | `getCustomersForManager()` + `getCollectionsByCustomer()` + `getSettings()` |
| `PATCH` | `/api/mobile/customer-manager` | `bulkUpdateCustomers()` — `bulkUpdateCustomersSchema` |

The whole batch is rejected if any row is invalid, exactly as
`bulkUpdateCustomersAction` does. Field errors come back keyed
`"<customerId>.<field>"` so the app can mark the offending input.

---

## Daily entry

| Method | Path | Delegates to |
|---|---|---|
| `GET` | `/api/mobile/daily-entry?date=` | `getDailyEntriesWithCustomers()` + `getSettings()` |
| `GET` | `/api/mobile/daily-entry?date=&copyPrevious=1` | `copyPreviousDay()` — read-only |
| `POST` | `/api/mobile/daily-entry` | `saveDailyEntries()` — `saveDailyEntriesSchema` |

The GET also returns the day's summary using each customer's effective price, so
"est. revenue" matches what bill generation produces.

---

## Monthly entry

| Method | Path | Delegates to |
|---|---|---|
| `GET` | `/api/mobile/monthly-entry?year=&month=` | `getMonthlyEntries()` |
| `POST` | `/api/mobile/monthly-entry` | `saveDailyEntries()`, grouped by date |

Milk quantities have exactly one write path, shared with the daily screen.

---

## Billing

| Method | Path | Delegates to |
|---|---|---|
| `GET` | `/api/mobile/billing?year=&month=` | `getCustomersWithBillsForPeriod()` |
| `POST` | `/api/mobile/billing` | `generateBillsForPeriod()` — `customerId` optional |
| `GET` | `/api/mobile/billing/[id]` | `getBillById()` |
| `POST` | `/api/mobile/billing/[id]` | `{ action }`: `mark-paid` → `markBillPaid()` · `send-whatsapp` → `sendBillViaWhatsApp()` |
| `POST` | `/api/mobile/billing/send-all` | `sendAllBillsWhatsApp()` — per-customer results |
| `GET` | `/api/mobile/billing/[id]/pdf` | `generatePdfBuffer()` — **returns a PDF** |
| `GET` | `/api/mobile/billing/print-all?year=&month=` | `generateBillsBatchPdfBuffer()` — **returns a PDF** |

Periods are always whole months, derived through `monthPeriod()`.

---

## Payments

| Method | Path | Delegates to |
|---|---|---|
| `POST` | `/api/mobile/payments` | `recordCollection()` — `recordCollectionSchema` |
| `PATCH` | `/api/mobile/payments/[id]` | `updateCollection()` — `updateCollectionSchema` |
| `DELETE` | `/api/mobile/payments/[id]` | `deleteCollection()` |

Allocation (oldest bill first, split into one `Payment` row per bill, overpayment
refused) and status recomputation all happen in `payment.service.ts`. The client
sends an amount and is told which invoices it settled.

---

## Statement (quick bill)

| Method | Path | Delegates to |
|---|---|---|
| `POST` | `/api/mobile/statement` `{action:"preview"}` | `previewCustomerStatement()` — creates nothing |
| `POST` | `/api/mobile/statement` `{action:"send"}` | `sendStatementViaWhatsApp()` |
| `GET` | `/api/mobile/statement/pdf?customerId=&months=&notes=` | `buildCustomerStatement()` + `generateStatementPdfBuffer()` — **returns a PDF** |

---

## Reports and exports

| Method | Path | Delegates to |
|---|---|---|
| `GET` | `/api/mobile/reports` | `getReportsData()` |
| `GET` | `/api/mobile/exports?kind=customers&period=` | `buildCustomersCsv()` — **returns CSV** |
| `GET` | `/api/mobile/exports?kind=backup-csv&type=&value=` | `buildBackupCsv()` — **returns CSV** |
| `GET` | `/api/mobile/exports?kind=backup-json` | `buildFullBackupJson()` — **returns JSON**, stamps `lastBackupAt` |

---

## Settings and users

| Method | Path | Delegates to |
|---|---|---|
| `GET` | `/api/mobile/settings` | `getSettings()` — token omitted, only `whatsappConfigured` |
| `PUT` | `/api/mobile/settings` | `updateSettings()` — `updateSettingsSchema`, AES-GCM token encryption |
| `GET` | `/api/mobile/users` | `getUsers()` |
| `POST` | `/api/mobile/users` | `createUser()` |
| `DELETE` | `/api/mobile/users/[id]` | `deleteUser()` — refuses self and last account |

---

## Changes made to the existing project

Adding this layer required four changes outside `src/app/api/mobile/**` and
`src/lib/mobile/**`. All are additive or refactors; no business rule changed.

1. **`src/middleware.ts`** — one branch letting `/api/mobile/*` through the
   cookie check. These routes are *not* public: every handler is wrapped in
   `withAuth()`, which verifies the bearer token and loads the user first.

2. **`src/lib/services/report.service.ts`** (new) — the Reports page's inline
   Prisma queries, lifted verbatim into a service. The page now reads from it,
   so the website and the app cannot report different numbers.

3. **`src/lib/services/export.service.ts`** (new) — the CSV/JSON builders,
   lifted verbatim out of the `/api/export/*` route handlers. Those routes are
   now thin wrappers, and both clients produce byte-identical files.

4. **`src/lib/services/billing.service.ts`** — a raised transaction deadline.
   See below.

### The bill-generation timeout

`generateBillsForPeriod` calls `generateInvoiceNumber` **inside** a Prisma
interactive transaction, and that helper scans the year's invoices plus a query
loop. Against a remote database this exceeds Prisma's 5-second default and the
whole batch is rolled back part-way through — no bills generated at all.

This was reproduced against the live database during testing:

```
Transaction API error: A commit cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 5874 ms passed …
```

It is a pre-existing bug that affects the website identically; it was not
introduced by the mobile layer. The fix raises the deadline
(`{ timeout: 120_000, maxWait: 15_000 }`) and changes nothing else — the work,
its ordering and its atomicity are untouched.

A deeper fix would move invoice-number generation out of the transaction, but
that changes how the uniqueness race is handled, which is a business-logic
change and out of scope here. **Recommended as a follow-up.**
