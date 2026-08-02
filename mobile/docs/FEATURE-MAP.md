# Feature map — web → Android

Every feature of the web application and where it lives in the app. The goal was
100% functional parity: nothing was dropped, and nothing new was invented that
the web cannot do.

The **Changed** column describes presentation only. Where a rule is involved, it
is the same server-side rule in both places.

---

## Authentication

| Web | Android | Changed |
|---|---|---|
| `/login` — NextAuth credentials, JWT cookie | `app/login.tsx` — same credentials, bearer token | Transport only. Same user table, same bcrypt check, same accounts. |
| Session persists via cookie | Token in Android Keystore, auto-refreshed | Sign-in survives restarts for 60 days without storing the password. |
| Middleware redirects to `/login` | `app/(app)/_layout.tsx` guard | A token expiring mid-use bounces to login from wherever you are. |
| Sign out (header) | More → Sign out | Confirmed, and clears the query cache so no data survives the session. |

---

## Dashboard

| Web | Android | Changed |
|---|---|---|
| Five-across stat strip | Four 2×2 tiles: today's milk, est. revenue, month, outstanding | Five columns are unreadable at 360dp. Each tile is now a shortcut to where you act on it. |
| Today's customer table | "Entry not finished" card naming who is missing | The list is only useful as a prompt, so it became one. |
| Pending bills table | Unpaid bills list → tap for the bill | — |
| `AutoRefresh` component | Pull to refresh + refetch on reconnect | Native gesture instead of a polling widget. |
| — | Shortcut row: Billing / Quick bill / Reports | Navigation aid only; no new capability. |

---

## Daily entry

| Web | Android | Changed |
|---|---|---|
| Date navigator | `DateNavigator` — arrows + tappable month grid | Prev/next is one thumb tap; the calendar is still there for jumping. |
| Wide grid, row per customer | Card per customer; tap to expand fields | A 3-column grid does not fit a phone. Collapsed rows show the recorded quantity. |
| Split (morning/evening) or single mode | Same, driven by the same `entryMode` setting | — |
| Quick-add buttons (0.5–5 L) | Same amounts as chips, with a morning/evening target toggle | — |
| Per-customer L/ml unit toggle (localStorage) | Same, in AsyncStorage | Stored value is always litres, as on the web. |
| Copy previous day | Overflow menu → Copy yesterday | Fills the drafts unsaved, so it can be corrected first — same as the web. |
| Clear all | Overflow menu → Clear all | — |
| Search customers | Search field, shown when the list is long enough to need it | — |
| Bulk save, dirty tracking | Save bar appears only when something changed, with the count | Edited rows are outlined so you can see what will be saved. |
| Summary cards (milk / customers / revenue) | Summary pills, computed live from the drafts | Totals move as you type instead of after saving. |

---

## Monthly view

| Web | Android | Changed |
|---|---|---|
| Customer × day matrix | Customer list → tap → that customer's month as a calendar of day cells | A 31-column table is unusable on a phone. Every capability is kept: see any day, correct any day. |
| Inline cell editing | Tap a day cell → quantity dialog | — |
| Batch save | Staged edits, one save for the whole month | Same batching, same endpoint. |
| Month navigation | `MonthNavigator` | — |
| — | Per-customer month totals and recorded-day counts | Derived from data already fetched. |

---

## Customers

| Web | Android | Changed |
|---|---|---|
| List with search + active filter | `(tabs)/customers.tsx` — All / Active / Archived chips + search | Three tabs became three chips over one list. |
| Archived customers view | "Archived" chip | — |
| Customer detail page | `customer/[id]/index.tsx` | Reordered: dues first, then contact, bills, payments, deliveries. |
| Add customer | `customer/new.tsx` | Shared form component with edit. |
| Edit customer | `customer/[id]/edit.tsx` | — |
| Activate / deactivate | Detail → overflow menu | — |
| Archive (soft delete) | Detail → overflow → confirmed dialog | Dialog states that nothing is deleted and it is reversible. |
| Restore archived | Detail → overflow (archived only) | — |
| Export customers CSV | Reports → Backup tab | Consolidated with the other exports. |
| — | Call / WhatsApp buttons on the detail screen | Uses the phone number already stored; opens the system dialer/WhatsApp. |

---

## Customer manager

| Web | Android | Changed |
|---|---|---|
| Editable table of all customers | `manager.tsx` — card per customer, tap for actions | — |
| Status + payment-standing filters | All / Owing / Settled / Inactive chips | Defaults to **Owing**, which is why the screen gets opened. |
| Inline edit staged, then bulk save | "Quick edit" dialog, saved through the same bulk endpoint | Per-customer save fits a phone better; the endpoint and validation are unchanged. |
| Collect payment dialog | "Record a collection" dialog | Amount pre-filled with the balance. Allocation is done server-side and reported back by invoice. |
| Payment ledger per customer | "Payment ledger" dialog | — |
| Delete a payment | Ledger → Delete, confirmed | Dialog explains the bill returns to unpaid. |
| WhatsApp payment reminder | "Send WhatsApp reminder" | Disabled with a reason when there is no phone number or nothing owed. |
| Days-overdue / standing badges | Same, on each card; debts >30 days flagged | Rows sort oldest-and-largest debt first when filtered to Owing. |
| — | Total outstanding banner | Sum of data already on screen. |

---

## Billing

| Web | Android | Changed |
|---|---|---|
| Month picker | `MonthNavigator` | — |
| Generate bills for the month | Primary button | — |
| Generate for one customer | Handled by the same endpoint (`customerId` optional) | Reachable via Quick bill. |
| Print all → one PDF | More → Print / share all | Goes to the Android share sheet: print, save, or forward. |
| Send all on WhatsApp | More → Send all, confirmed | Confirmation states the count and that messages cannot be recalled. |
| Per-customer failure list | Scrollable result dialog | Partial failure is the normal outcome; it is always shown. |
| Summary stats | Four tiles | — |
| Customer/bill list with search | Same | Rows without a bill are shown and explained. |
| Bill detail page | `bill/[id].tsx` | Leads with what is still **due**, not the gross total. |
| Bill PDF preview / download | Share PDF → system viewer | Android renders it better than an in-app viewer would. |
| Mark paid dialog | "Record payment", pre-filled with the balance | Client blocks overpayment early; the server still enforces it. |
| Send single bill on WhatsApp | "Send", confirmed | — |

---

## Quick bill

| Web | Android | Changed |
|---|---|---|
| Customer search + select | Searchable picker dialog | — |
| Month range picker | Month chips, multi-select (last 12) | Multi-select is clearer than a range for "which months am I billing". |
| Live preview (read-only) | "Work out the total" → per-month breakdown | Still creates no bills, as on the web. |
| Empty months reported | Same, as a note rather than ₹0 rows | — |
| Notes field | Same | — |
| Print / save statement PDF | Share via system sheet | — |
| Send statement on WhatsApp | Same, confirmed | Confirmation notes the caption is in Hindi and that bills get created. |

---

## Reports

| Web | Android | Changed |
|---|---|---|
| All-time stat strip (5) | Four tiles, pinned above the tabs | — |
| Monthly summary tab | Months tab — bar chart + table | A 12-row table reads poorly small; the chart shows the trend at a glance. |
| Top customers tab | Top tab, with medal ranks | — |
| Recent payments tab | Paid tab | — |
| Backup & export tab | Backup tab | — |
| Last-backup staleness badge | Same, colour-coded, >7d warns and >30d alarms | — |
| Full JSON backup | Primary action | Only export that can restore, and the only one that stamps `lastBackupAt`. |
| Customers CSV | Secondary | Labelled as a report, not a backup. |
| Period CSV (month / week / all) | Secondary, with period chips | Weekly export folded into the period selector. |

---

## Settings

| Web | Android | Changed |
|---|---|---|
| Farm name / address / phone | Same | — |
| Global rate per litre | Same | — |
| Billing cycle (monthly) | Shown as a fixed note | It has one possible value; a disabled dropdown would be noise. |
| Entry mode (split / single) | Segmented control | — |
| WhatsApp Green API config | Same, with a connected/not-set-up banner | The stored token is never sent to the device; blank leaves it unchanged. |
| User list | Same | — |
| Add user | Dialog | — |
| Delete user | Confirmed dialog | Same two guards: not yourself, not the last account. |

---

## Not present in the app

Nothing from the web application is missing.

The web keeps two capabilities that are intentionally *server-side only* and were
never UI features: `permanentlyDeleteCustomer` (admin-only, wired to no button on
the web either) and the Green API delivery-receipt webhook (`/api/webhooks/whatsapp`),
which is called by Green API, not by a person.
