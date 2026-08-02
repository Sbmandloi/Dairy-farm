/**
 * Serve the built APKs over the local network so a phone can download them.
 *
 * Getting a 57 MB file onto an Android phone is the dullest part of testing:
 * AirDrop does not reach Android, USB needs a cable and adb, and Drive means an
 * upload and a download. A phone on the same wifi can just open a link.
 *
 * Local network only — this binds to the LAN address and serves nothing but the
 * files in dist/. Stop it with Ctrl-C when the download is done.
 *
 *   npm run serve:apk
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT ?? 8000);

if (!existsSync(DIST) || readdirSync(DIST).filter((f) => f.endsWith(".apk")).length === 0) {
  console.error(
    `No APKs in ${DIST}\n\nBuild one first:\n  npm run apk:release\n  mkdir -p dist && cp android/app/build/outputs/apk/release/app-release.apk dist/`
  );
  process.exit(1);
}

/** The address a phone on the same wifi can reach — not 127.0.0.1. */
function lanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  return "localhost";
}

const apks = readdirSync(DIST).filter((f) => f.endsWith(".apk"));
const host = lanAddress();

const server = createServer((req, res) => {
  const name = decodeURIComponent((req.url ?? "/").slice(1));

  if (!name) {
    const links = apks
      .map((f) => {
        const mb = (statSync(join(DIST, f)).size / 1048576).toFixed(0);
        return `<li><a href="/${encodeURIComponent(f)}">${f}</a> — ${mb} MB</li>`;
      })
      .join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">` +
        `<style>body{font:16px/1.6 system-ui;padding:2rem;max-width:32rem;margin:auto}` +
        `a{color:#2563EB}li{margin:.75rem 0}</style>` +
        `<h1>Dairy Billing</h1><p>Tap an APK to download, then open it to install.</p><ul>${links}</ul>`
    );
    return;
  }

  // Only ever serve a file that is actually in dist/, by exact name — never a
  // path the caller composed.
  const safe = basename(name);
  const file = join(DIST, safe);
  if (!apks.includes(safe) || !existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Length": statSync(file).size,
    "Content-Disposition": `attachment; filename="${safe}"`,
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  On your phone (same wifi), open:\n\n      http://${host}:${PORT}\n`);
  console.log(`  Serving ${apks.length} APK${apks.length === 1 ? "" : "s"} from dist/`);
  console.log(`  Ctrl-C to stop.\n`);
});
