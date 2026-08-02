# Testing

What was verified, how, and what was not.

---

## Backend — mobile API

An end-to-end suite exercised every write path against the **real database**, then
removed everything it created. **52 assertions, all passing.**

It ran through HTTP against a live `next dev`, not against mocks, so it covers
the middleware, the auth guard, Zod validation, the service layer, Prisma and
Postgres together.

### Covered

| Area | Assertions |
|---|---|
| **Auth** | Unauthenticated request → 401 · wrong password → 401 with a non-enumerating message · valid login → token pair · tampered token → 401 · `/auth/me` round trip |
| **Customers** | Create → 201 · phone normalised to E.164 (`9876543210` → `+919876543210`) · `pricePerLiter` returned as a number, not a Decimal string · `startDate` returned as a calendar day · name under 2 chars → 422 with `fieldErrors` · malformed phone → 422 |
| **Daily entry** | Save → read back on the *same* calendar day (the timezone bug the web documents) · quantities preserved exactly · summary revenue uses the customer's own rate (3.5 L × ₹50 = ₹175) · copy-previous-day returns yesterday's figures · clearing all values deletes the row rather than storing zeros |
| **Billing** | Generate → exactly one bill · amount = litres × rate · invoice number matches `INV-YYYY-MM-NNN` · period is the whole month · **re-generating keeps the same invoice number and creates no duplicate** |
| **Payments** | Overpayment refused, with the real outstanding figure in the message · partial collection allocated to the correct invoice · remaining balance correct · bill → `PARTIALLY_PAID` · settling the rest → `PAID` · **deleting a payment re-derives the bill back to `PARTIALLY_PAID`** |
| **Statement** | Preview returns the right amount per month · months with no milk reported as `emptyMonths` · **preview creates no bills** |
| **PDF** | 200 with `application/pdf` · body starts with `%PDF-` · non-trivial size |
| **Exports** | Customer CSV contains the customer and the expected header row |
| **Archive** | Archive → hidden from the live list, present in the archive, **bills retained in the database** · restore → back in the live list |
| **Bulk edit** | Valid patch applied · negative rate → 422 keyed `<customerId>.pricePerLiter` · **a rejected batch changes nothing** |
| **Users** | Deleting your own account refused, with the reason |

### Reproducing it

The script lives outside the repo (it is a one-off harness, not a suite the
project maintains). To re-run it, start `npm run dev` in the parent project,
obtain a token from `/api/mobile/auth/login`, and drive the endpoints — the table
above is the checklist.

### Bug found and fixed

Bill generation failed intermittently against the remote database:

```
Transaction API error: A commit cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 5874 ms passed …
```

`generateBillsForPeriod` runs `generateInvoiceNumber` inside a Prisma interactive
transaction, and that helper scans the year's invoices. Over network latency it
exceeds the 5-second default and the whole batch rolls back — no bills at all.
**This is pre-existing and affects the website identically.** Fixed by raising
the deadline; see [`API.md`](./API.md#the-bill-generation-timeout).

---

## Backend — no regression to the website

After the refactors (Reports and the export builders moved into services):

- `npx tsc --noEmit` — clean
- `npx eslint` — clean
- `npm run build` — succeeds, all 17 mobile routes registered
- Every authenticated page rendered over HTTP: `/dashboard`, `/customers`,
  `/billing`, `/daily-entry`, `/monthly-entry`, `/quick-bill`,
  `/customer-manager`, `/settings`, `/reports` — all **200**
- `/reports` verified to still contain all four tabs and the all-time stats
- `/api/export/customers`, `/api/export/backup?type=month`,
  `/api/export/backup?type=all` — all **200** with correct headers and content

---

## Mobile app

| Check | Result |
|---|---|
| `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) | clean |
| `eslint` incl. React Compiler rules | clean |
| Metro production bundle, Android | 1942 modules, no errors |
| Icon font bundled | `MaterialCommunityIcons.ttf`, 1.3 MB |
| `expo prebuild` | native project generated |
| Gradle `assembleDebug` | APK produced |

### Issues found and fixed during review

1. **Paper icons would not have rendered at all.** `@expo/vector-icons` was not
   installed, so React Native Paper's icon loader would have fallen through to
   its no-op fallback and logged a warning per icon. The bundle succeeded either
   way — only checking the bundled assets caught it.

2. **A ref read during render** in the daily entry screen. The baseline used to
   decide which rows had changed lived in a `useRef` and was read inside a
   `useMemo`. Refs are not reactive, so an edit could compare against a stale
   baseline and a changed row could be missed on save — a silently lost entry.
   Replaced with a value derived from the query data.

3. **Three `setState`-in-effect patterns** (daily entry, monthly, settings).
   Each rendered one frame of stale state before correcting itself — visibly, on
   a slow phone, the previous day's quantities under the new date. Converted to
   the documented render-phase state adjustment.

4. **`Date.now()` called during render** in the backup staleness badge. Captured
   once at mount instead.

---

## Not tested

Stated plainly rather than implied.

1. **No on-device run.** No Android phone or emulator was attached to this
   machine, so the app was verified by typecheck, lint, bundle and APK build, not
   by being launched. Screens, navigation and gestures are unexercised at
   runtime. **This is the largest gap**, and the first thing to do with the APK is
   walk through each screen.

2. **No automated UI tests.** No Detox or Maestro suite exists.

3. **WhatsApp sending was not exercised end to end.** Green API is not configured
   on this database, and sending test messages to real numbers is not something
   to do unasked. The code paths are the same service functions the website uses
   and are unchanged; what is untested is the *app's* handling of their success
   and failure responses.

4. **Rotation and screen sizes were not observed.** Layouts use flex, percentage
   widths and safe-area insets throughout, and no fixed pixel widths that would
   clip — but that is design intent, not observation.

5. **Slow-network and offline behaviour is unobserved.** Retry, timeout and the
   offline banner are implemented and unit-reasoned, not measured against a
   throttled connection.

6. **The release APK is signed with a debug key** until a keystore is configured.
   The build warns loudly when this happens. See
   [`README.md`](../README.md#release-signing).

---

## Suggested acceptance walkthrough

With the APK installed and pointed at a server with real data:

1. Sign in; force-quit and reopen — it should go straight to the dashboard.
2. Daily entry: record a few customers, save, pull to refresh, confirm the
   figures match the website for the same day.
3. Copy yesterday, then clear one customer, save; confirm that entry disappears
   rather than becoming zero.
4. Billing: generate the month, open a bill, share the PDF, check it opens in a
   PDF viewer and reads correctly (including Devanagari).
5. Manager: record a part payment, confirm the allocation message names the right
   invoice and the balance matches the website.
6. Delete that payment; confirm the bill returns to unpaid on both the app and
   the website.
7. Turn off mobile data mid-session; confirm the offline banner appears and the
   error states explain themselves.
8. Reports → Backup: create a backup, confirm the share sheet appears and the
   "last backup" badge updates.
