/**
 * Check an APK before it goes anywhere near a client.
 *
 * This exists because of a real near-miss: `EXPO_PUBLIC_API_URL` is inlined into
 * the JavaScript bundle, but Gradle does not track `.env`. Editing it and
 * re-running `assembleRelease` leaves the *previous* URL compiled in and reports
 * BUILD SUCCESSFUL — an APK that looks correct, is signed correctly, and points
 * at the wrong server.
 *
 * `npm run apk:*` now clears the bundle first, so the trap is closed. This
 * verifies the result anyway, because "we fixed the build script" is not
 * evidence about the file you are about to send someone.
 *
 * Usage:
 *   node scripts/verify-apk.mjs [path/to.apk] [--expect-url https://…]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_APK = "android/app/build/outputs/apk/release/app-release.apk";

const args = process.argv.slice(2);
const apkArg = args.find((a) => !a.startsWith("--"));
const expectIndex = args.indexOf("--expect-url");
const apkPath = join(ROOT, apkArg ?? DEFAULT_APK);

/** The URL the APK is expected to talk to: explicit flag, else whatever .env says. */
function expectedUrl() {
  if (expectIndex !== -1 && args[expectIndex + 1]) return args[expectIndex + 1];
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return null;
  const match = /^EXPO_PUBLIC_API_URL\s*=\s*(.+)$/m.exec(
    readFileSync(envPath, "utf8"),
  );
  return match?.[1]?.trim().replace(/\/+$/, "") ?? null;
}

function fail(message) {
  console.error(`\n  FAIL  ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`  ok    ${message}`);
}

if (!existsSync(apkPath)) {
  console.error(`No APK at ${apkPath}\nBuild one first: npm run apk:release`);
  process.exit(1);
}

console.log(`\nVerifying ${apkPath.replace(ROOT + "/", "")}\n`);

// ── 1. which server is compiled in ──────────────────────────────────────────
let bundled = false;
let debugSigned = false;

const workdir = mkdtempSync(join(tmpdir(), "apk-verify-"));
try {
  // A debug APK normally ships no JS at all — it pulls the bundle from the Metro
  // dev server at launch. There is no compiled-in URL to check in that case.
  let bundle = null;
  try {
    execFileSync(
      "unzip",
      ["-o", "-q", apkPath, "assets/index.android.bundle", "-d", workdir],
      {
        stdio: "pipe",
      },
    );
    bundle = readFileSync(
      join(workdir, "assets/index.android.bundle"),
      "latin1",
    );
    bundled = true;
  } catch {
    bundle = null;
  }

  if (bundle === null) {
    console.log(
      "  ok    no bundled JS — a debug build that loads from the Metro dev server",
    );
  } else {
    // Hermes packs string constants back to back with no separator, so a greedy
    // match runs straight off the end of a URL into whatever follows it
    // ("…netlify.appbar-content-ripple…"). Candidates are therefore compared by
    // prefix, never by equality.
    const IGNORE =
      /(reactjs|react\.dev|facebook|github|npmjs|w3\.org|schema|expo\.dev|eascdn|swmansion|reactnavigation|dev\.to|google\.com|localhost:8081|hostname|wa\.me|expo-router)/;

    const candidates = [
      ...new Set(
        (bundle.match(/https?:\/\/[a-zA-Z0-9._:-]+/g) ?? []).filter(
          (u) => !IGNORE.test(u),
        ),
      ),
    ];

    const expected = expectedUrl();

    if (!expected) {
      console.log(
        `  ?     no expected URL known (pass --expect-url); saw: ${candidates.join(", ")}`,
      );
    } else if (bundle.includes(expected)) {
      pass(`points at ${expected}`);
    } else {
      fail(
        `expected ${expected}, not found in the bundle.\n` +
          `        Saw: ${candidates.length ? candidates.join(", ") : "no API URL at all"}\n` +
          `        The JS bundle is stale. Run: npm run clean:bundle && npm run apk:release`,
      );
    }

    // Anything that is clearly a *different* origin than the intended one is worth
    // flagging: a leftover LAN address is the signature of a stale bundle.
    const strays = candidates.filter(
      (u) => !expected || !u.startsWith(expected),
    );
    const lanLeftover = strays.filter((u) =>
      /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        u,
      ),
    );
    if (lanLeftover.length) {
      fail(
        `a development address is still compiled in: ${lanLeftover.join(", ")}`,
      );
    }

    const insecure = strays.filter(
      (u) =>
        u.startsWith("http://") &&
        !/^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.)/.test(u),
    );
    if (insecure.length) {
      fail(
        `a public URL is configured over plain HTTP (${insecure.join(", ")}) — credentials would be sent unencrypted`,
      );
    }
  }
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

// ── 2. signing ──────────────────────────────────────────────────────────────
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
const apksigner = sdk ? join(sdk, "build-tools/35.0.0/apksigner") : null;

if (!apksigner || !existsSync(apksigner)) {
  console.log("  ?     ANDROID_HOME not set — skipped signature check");
} else {
  const certs = execFileSync(apksigner, ["verify", "--print-certs", apkPath], {
    encoding: "utf8",
  });
  const dn = /certificate DN: (.+)/.exec(certs)?.[1] ?? "unknown";

  // Classified by the signing certificate, not the file path: an APK is
  // routinely copied out of android/app/build/ before being sent to anyone, and
  // a path-based guess would then call a real release build "debug".
  debugSigned = /CN=Android Debug/.test(dn);

  if (debugSigned) {
    if (bundled) {
      // Bundled JS means this was assembled as a release but signed with
      // Android's shared debug key — it cannot be updated by a properly signed
      // build later, so it must not reach a client.
      fail(
        `signed with the DEBUG key (${dn}). Configure a keystore — see README.`,
      );
    } else {
      console.log(`  ok    debug build, signed by ${dn}`);
    }
  } else {
    pass(`signed by ${dn}`);
  }
}

if (process.exitCode) {
  console.log("\nDo not distribute this APK.\n");
} else if (bundled && !debugSigned) {
  console.log("\nSafe to distribute.\n");
} else {
  // Without a bundle the app needs a Metro server on the same network to show
  // anything; with the debug key, anyone can produce an APK Android treats as
  // this same app. Either way it is for testing, not for the client.
  console.log(
    "\nChecks passed, but this is a DEBUG build — for testing only.\n",
  );
}
