# Dairy Billing — Android app

A native Android client for the existing Dairy Billing web application. It talks
to the same server, the same database and the same business logic; only the
presentation layer is new.

- **Framework:** React Native 0.86 via Expo SDK 57, TypeScript
- **UI:** React Native Paper (Material Design 3), light and dark
- **Data:** TanStack Query over a typed REST client
- **Auth:** bearer tokens in the Android Keystore (`expo-secure-store`)
- **Package:** `com.dairybilling.app`
- **Distribution:** APK, installed directly. Not published to Google Play.

---

## Quick start

```bash
cd mobile
npm install
cp .env.example .env        # set EXPO_PUBLIC_API_URL
npm start                   # Expo dev server
```

Then either press `a` to launch on a connected device/emulator, or build an APK
(below).

---

## Configuration

The app has exactly one setting: the address of the Dairy Billing site that
serves `/api/mobile/*`.

| Variable | Required | Example |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | yes | `https://your-app.netlify.app` |

It is **inlined at build time**, so the APK you hand the client must be built
with the production URL already set. Changing it later means rebuilding.

> **Gradle does not track `.env`.** Editing the URL and re-running
> `assembleRelease` directly will leave the *previous* URL compiled in and still
> report `BUILD SUCCESSFUL` — a correctly signed APK pointing at the wrong
> server. `npm run apk:release` clears the JS bundle first so this cannot
> happen; always use it rather than calling Gradle by hand. Then confirm:
>
> ```bash
> npm run verify:apk
> ```
>
> which fails loudly on a stale URL, a debug-signed release, or a public host
> configured over plain HTTP.

```bash
# Production build
EXPO_PUBLIC_API_URL=https://your-app.netlify.app npm run apk:release

# Local testing — use your machine's LAN IP, never localhost.
# On a phone, "localhost" is the phone itself.
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npm run apk:debug
```

`src/config/env.ts` validates this at startup. A build with a missing URL, or one
pointing at a **public** host over plain `http://`, refuses to start and says
why — shipping an APK that sends the dairy's password and customer data
unencrypted is not a failure worth discovering in the field. Plain HTTP is
allowed only for private LAN addresses during development.

---

## Deploying the backend first

The app is useless until the server it talks to serves `/api/mobile/*`. Those
routes were added to the parent Next.js project and must be deployed before the
APK will do anything except fail to sign in.

**Check whether they are live:**

```bash
curl -s -X POST https://beautiful-sprite-a18e5b.netlify.app/api/mobile/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"probe123"}'
```

| Response | Meaning |
|---|---|
| `{"error":"Unauthorized"}` | **Not deployed.** The old middleware is rejecting the path before the route exists. |
| `{"success":false,"error":"Invalid email or password."}` | **Deployed and working.** That is the new route correctly refusing a bad credential. |

**To deploy:** merge the `develop` changes and let Netlify build. The relevant
files are `src/app/api/mobile/**`, `src/lib/mobile/**`,
`src/lib/services/{report,export}.service.ts`, and the modified `src/middleware.ts`,
`src/app/api/export/*` and `src/lib/services/billing.service.ts`.

**Required environment variables on Netlify.** All of these already exist for the
website; the mobile layer adds none, but it *depends* on two:

| Variable | Used for |
|---|---|
| `AUTH_SECRET` | Signs mobile bearer tokens — the same secret NextAuth uses. **Without it, every mobile login returns a 500.** |
| `DATABASE_URL` | As before |
| `ENCRYPTION_KEY` | Decrypting the Green API token when the app sends a bill |

---

## Building the APK

> **The release APK is built against `https://beautiful-sprite-a18e5b.netlify.app`.**
> It will show "Invalid email or password" on every login attempt until the
> `/api/mobile/*` routes are **deployed to that site** — they exist only in the
> working tree until you merge and let Netlify build. See
> [Deploying the backend](#deploying-the-backend-first) below.

### Prerequisites

- **JDK 17** — `brew install openjdk@17`
- **Android SDK** — `brew install --cask android-commandlinetools`, then:
  ```bash
  export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
  yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses
  sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-35" "build-tools;35.0.0"
  ```

Set these in the shell you build from:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export ANDROID_SDK_ROOT=$ANDROID_HOME
```

### Generate the native project

`android/` is generated, not hand-written, and is git-ignored. Recreate it after
cloning or after changing `app.config.ts`:

```bash
npm run prebuild            # expo prebuild --platform android --clean
```

### Debug APK

For testing. Signed with Android's shared debug key, so it installs on any
device but must never be given to the client.

```bash
npm run apk:debug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

### Release APK

For the client. Requires a signing keystore — see the next section.

```bash
npm run apk:release
# → android/app/build/outputs/apk/release/app-release.apk   (~57 MB)
```

The build ships only the ABIs real devices use (`armeabi-v7a`, `arm64-v8a`).
The emulator-only `x86`/`x86_64` slices add ~43 MB to a file that gets sent by
hand, so they are excluded in `plugins/with-release-signing.js`. Add them back
there if you need to run a release build on an emulator.

### Installing on the client's phone

1. Send them the `.apk` (WhatsApp, Drive, email, cable — anything).
2. On the phone, open it. Android will ask to allow installs from that source:
   **Settings → Apps → Special access → Install unknown apps**.
3. Tap Install, then open **Dairy Billing** and sign in with the same email and
   password they use on the website.

No Play Store account, no developer mode, no `adb` needed.

---

## Release signing

The keystore is what makes an update recognisable as the *same* app. **If it is
lost, the client must uninstall and reinstall to take any future update, losing
nothing but requiring a fresh sign-in — but it cannot be regenerated.** Back it
up somewhere durable and out of the repository.

Create one once:

```bash
mkdir -p keystores
keytool -genkeypair -v \
  -keystore keystores/dairy-release.jks \
  -alias dairy \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then put the credentials in `android/gradle.properties` (git-ignored along with
the rest of `android/`), or export them as environment variables:

```properties
DAIRY_UPLOAD_STORE_FILE=/absolute/path/to/keystores/dairy-release.jks
DAIRY_UPLOAD_KEY_ALIAS=dairy
DAIRY_UPLOAD_STORE_PASSWORD=…
DAIRY_UPLOAD_KEY_PASSWORD=…
```

`android/app/build.gradle` picks these up automatically. Without them, a release
build falls back to the debug key and prints a warning — usable for testing,
never for the client.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Android app (this project)                 │
│  screens → hooks → endpoints → HTTP client  │
└────────────────────┬────────────────────────┘
                     │ HTTPS + Bearer token
┌────────────────────▼────────────────────────┐
│  Next.js app  /api/mobile/*                 │
│  thin route handlers — no business logic    │
└────────────────────┬────────────────────────┘
┌────────────────────▼────────────────────────┐
│  src/lib/services/*  ← unchanged            │
│  billing · payments · statements · WhatsApp │
└────────────────────┬────────────────────────┘
                     │ Prisma
              ┌──────▼──────┐
              │ PostgreSQL  │
              └─────────────┘
```

**Every business rule stayed on the server.** The mobile API routes validate with
the *same* Zod schemas the Server Actions use and call the *same* service
functions. The app knows how to display a bill; it does not know how a bill is
calculated, how a payment is allocated across invoices, or when a customer may
be billed. That was the point — two implementations of "settle the oldest bill
first" would eventually disagree, and the disagreement would be about money.

### Layers

| Layer | Location | Responsibility |
|---|---|---|
| Routes | `app/` | expo-router file-based navigation; screens only |
| Hooks | `src/hooks/queries.ts` | React Query wrappers + cache invalidation |
| Endpoints | `src/api/endpoints.ts` | Typed function per API call; the only place URLs live |
| Client | `src/api/client.ts` | Auth header, timeout, retry, token refresh, error mapping |
| Auth | `src/auth/` | Session lifecycle, Keystore persistence |
| Design system | `src/theme/`, `src/components/` | MD3 theme, spacing scale, shared UI |
| Utilities | `src/utils/` | Formatting and calendar-date maths, ported from the web |

### Folder structure

```
mobile/
├── app/                          # routes (expo-router)
│   ├── _layout.tsx               # providers: gesture → safe area → Paper → query → auth → feedback
│   ├── index.tsx                 # boot: restore session, redirect
│   ├── login.tsx
│   └── (app)/                    # everything below requires a session
│       ├── _layout.tsx           # auth guard + stack
│       ├── (tabs)/               # dashboard · entry · billing · customers · more
│       ├── customer/[id]/        # detail + edit
│       ├── bill/[id].tsx
│       ├── manager.tsx           # dues, collections, reminders
│       ├── monthly.tsx
│       ├── quick-bill.tsx
│       ├── reports.tsx
│       └── settings.tsx
├── src/
│   ├── api/                      # client, endpoints, types, errors, query cache
│   ├── auth/                     # context + Keystore token store
│   ├── components/               # design system + shared screens states
│   ├── config/env.ts             # build-time configuration + validation
│   ├── hooks/                    # data hooks, network monitor
│   ├── theme/                    # MD3 light/dark, spacing, radii
│   └── utils/                    # format, date, download, preferences
├── scripts/generate-icons.mjs    # regenerates the icon set from code
└── app.config.ts
```

### Design decisions worth knowing

**Dates never become `Date` objects for display.** Every calendar day crosses the
wire as `"YYYY-MM-DD"` and is formatted from its parts. Parsing it into a `Date`
would render the previous day on any device west of UTC — the same bug the web
app documents at length in `src/lib/utils/format.ts`. `src/utils/date.ts`
anchors at noon UTC for arithmetic, and reads "today" in `Asia/Kolkata` so the
phone and the server always agree on which day it is.

**Only GET requests are retried.** Replaying a POST that may already have been
applied could record a payment twice. That is the one failure in this domain
that costs real money, so the client never risks it.

**Money errors are shown verbatim.** The services write refusals for a human
("Amount is more than the ₹420.00 outstanding. Enter ₹420.00 or less.").
Rewording them would destroy the instruction they carry.

**PDFs are not rendered in-app.** They are the same server-rendered documents the
web downloads — Devanagari fonts included — handed to Android's share sheet,
which already offers Print, Save to Drive, WhatsApp and every PDF viewer
installed. That is also why the app requests no storage permission.

**Permissions.** The app itself declares only `INTERNET`. The libraries it uses
add their own, all of which Android grants at install time without prompting:

| Permission | From | Why |
|---|---|---|
| `INTERNET` | the app | Talking to the server |
| `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` | netinfo | The offline banner |
| `VIBRATE` | expo-haptics | Save/error feedback |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | expo-secure-store | Keystore-backed token storage |
| `READ_/WRITE_EXTERNAL_STORAGE` (`maxSdkVersion="32"`) | expo-file-system | Writing a downloaded PDF on Android 12 and older; not requested on 13+ |
| `SYSTEM_ALERT_WINDOW` | React Native core manifest | The dev-menu overlay. Unused in release, but React Native declares it in its own manifest, so it merges into every build. |

No camera, contacts, location or SMS. The app never triggers a runtime permission
dialog: exports go through the system share sheet, which needs none.

`SYSTEM_ALERT_WINDOW` ("display over other apps") is inherited from React Native
rather than requested by this app, and it is *declared*, not granted — on Android
6+ it does nothing unless the user explicitly enables it in system settings,
which the app never asks them to do. If you would still rather it were absent
from the client's build, add a manifest plugin that removes it:

```xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove" />
```

This was left in place because stripping it also disables the dev menu overlay in
debug builds, and it is standard in shipped React Native apps.

---

## Dependencies

| Package | Why |
|---|---|
| `expo`, `expo-router` | Managed build + file-based routing |
| `react-native-paper` | Material Design 3 components |
| `@expo/vector-icons` | Material Community Icons (required by Paper) |
| `@tanstack/react-query` | Caching, refetch-on-reconnect, mutation state |
| `expo-secure-store` | Tokens in the Android Keystore |
| `@react-native-community/netinfo` | Online/offline detection |
| `@react-native-async-storage/async-storage` | Per-customer L/ml entry preference |
| `expo-file-system`, `expo-sharing` | Download and share PDFs, CSVs, backups |
| `expo-haptics` | Confirmation you can feel without looking |
| `react-native-reanimated`, `react-native-gesture-handler` | Navigation transitions and gestures |
| `zod`, `date-fns` | Shared with the web project |

---

## Scripts

| Command | Does |
|---|---|
| `npm start` | Expo dev server |
| `npm run android` | Dev server + launch on a device |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prebuild` | Regenerate `android/` |
| `npm run apk:debug` | Debug APK |
| `npm run apk:release` | Release APK |
| `node scripts/generate-icons.mjs` | Regenerate the icon set |

---

## Known limitations

1. **Requires a connection to write.** Cached data stays readable offline and the
   app says so plainly, but recording milk, collecting cash and generating bills
   all need the server. A write queue was considered and rejected: two phones
   editing the same day offline would need conflict resolution over the
   *quantities the bills are calculated from*, and getting that wrong is worse
   than being told to wait.

2. **No push notifications.** The backend has no push infrastructure, and adding
   one would mean changes well beyond the presentation layer.

3. **The API URL is fixed at build time.** Deliberate: a settings screen that let
   the client point the app at an arbitrary server would be a phishing vector for
   their dairy's credentials.

4. **Bulk WhatsApp sends are slow.** Green API is called once per customer,
   sequentially, so a large month takes a while. The request timeout is raised to
   5 minutes and per-customer results are reported, matching the web behaviour.

5. **Rotation is supported but the entry grids are designed portrait-first.**
   Landscape works and is more comfortable for the monthly calendar; nothing is
   hidden in either orientation.

6. **The keystore is not in the repository.** By design — see Release signing.
   Whoever holds it must back it up.

---

## Related documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — why it is built this way:
  options considered, auth design, date handling, UI decisions
- [`docs/FEATURE-MAP.md`](./docs/FEATURE-MAP.md) — every web feature and where it
  lives in the app
- [`docs/API.md`](./docs/API.md) — the mobile API surface and which service each
  endpoint delegates to, plus what changed in the parent project
- [`docs/TESTING.md`](./docs/TESTING.md) — what was verified, what was found, and
  what was **not** tested
