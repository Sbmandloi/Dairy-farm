/**
 * Generates the app's icon set from code — no design tool, no binary assets to
 * keep in sync, and re-runnable if the brand colours ever change.
 *
 * Everything is drawn with plain maths and encoded to PNG with node:zlib, so
 * this has no dependencies at all. Run with: node scripts/generate-icons.mjs
 *
 * The mark is a milk drop over the blue→cyan gradient the web app already uses
 * for its sidebar logo, with the same amber accent dot — so the phone icon and
 * the browser tab read as one product.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

// ── brand ───────────────────────────────────────────────────────────────────
const BLUE = [37, 99, 235]; // blue-600, the web logo's start colour
const CYAN = [6, 182, 212]; // cyan-500, its end colour
const AMBER = [251, 191, 36]; // amber-400 accent dot
const WHITE = [255, 255, 255];

// ── PNG encoding ────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGBA pixel buffer → PNG file bytes. */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 = compression, filter, interlace — all 0

  // One filter byte (0 = None) per scanline, then the row's pixels.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── drawing ─────────────────────────────────────────────────────────────────

/**
 * Is the normalised point inside the milk drop?
 *
 * The drop is a circle for its lower bulb, and above the bulb's centre the
 * width tapers to a point along a sine curve — which meets the circle at full
 * width, so the silhouette has no visible seam.
 */
function insideDrop(x, y) {
  const BULB_Y = 0.16;
  const BULB_R = 0.44;
  const APEX_Y = -0.66;

  if (y >= BULB_Y) return x * x + (y - BULB_Y) ** 2 <= BULB_R * BULB_R;

  const t = (y - APEX_Y) / (BULB_Y - APEX_Y); // 0 at apex, 1 at bulb centre
  if (t < 0) return false;
  const halfWidth = BULB_R * Math.sin((Math.PI * t) / 2) ** 1.25;
  return Math.abs(x) <= halfWidth;
}

/** Rounded square, as a fraction of the half-extent. */
function insideRoundedSquare(x, y, radius) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const inner = 1 - radius;
  if (ax <= inner || ay <= inner) return ax <= 1 && ay <= 1;
  return (ax - inner) ** 2 + (ay - inner) ** 2 <= radius * radius;
}

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Render an image by sampling `shade(x, y)` over the unit square, 3×3
 * supersampled so curved edges come out smooth rather than stair-stepped.
 */
function render(size, shade) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // Map pixel to [-1, 1] in both axes.
          const x = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
          const y = ((py + (sy + 0.5) / SS) / size) * 2 - 1;
          const [cr, cg, cb, ca] = shade(x, y);
          // Weight colour by coverage so transparent samples don't darken edges.
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }

      const samples = SS * SS;
      const alpha = a / samples;
      const i = (py * size + px) * 4;
      rgba[i] = alpha > 0 ? Math.round(r / a) : 0;
      rgba[i + 1] = alpha > 0 ? Math.round(g / a) : 0;
      rgba[i + 2] = alpha > 0 ? Math.round(b / a) : 0;
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

/** Diagonal blue→cyan gradient, matching the web sidebar logo. */
function gradient(x, y) {
  return lerp(BLUE, CYAN, Math.min(1, Math.max(0, (x + y + 2) / 4)));
}

/** The white drop plus its amber accent dot, at `scale` of the frame. */
function mark(x, y, scale, color) {
  const dx = x / scale;
  const dy = y / scale;

  // Accent dot, up and to the right of the drop — the same detail the web logo
  // carries. Drawn first so the drop's edge stays crisp against it.
  const ACCENT = [0.5, -0.52, 0.17];
  if ((dx - ACCENT[0]) ** 2 + (dy - ACCENT[1]) ** 2 <= ACCENT[2] ** 2) {
    return [...AMBER, 1];
  }
  if (insideDrop(dx, dy)) return [...color, 1];
  return [0, 0, 0, 0];
}

const files = [
  // Square launcher icon: gradient tile with the white mark.
  {
    name: "icon.png",
    size: 1024,
    shade: (x, y) => {
      if (!insideRoundedSquare(x, y, 0.22)) return [0, 0, 0, 0];
      const m = mark(x, y, 0.62, WHITE);
      return m[3] > 0 ? m : [...gradient(x, y), 1];
    },
  },
  // Adaptive icon foreground — the mark only, inside Android's 66% safe zone,
  // so the system mask can crop to any shape without clipping it.
  {
    name: "android-icon-foreground.png",
    size: 1024,
    shade: (x, y) => mark(x, y, 0.42, WHITE),
  },
  {
    name: "android-icon-background.png",
    size: 1024,
    shade: (x, y) => [...gradient(x, y), 1],
  },
  // Monochrome (themed icons): solid white silhouette, no accent colour.
  {
    name: "android-icon-monochrome.png",
    size: 1024,
    shade: (x, y) => (insideDrop(x / 0.42, y / 0.42) ? [...WHITE, 1] : [0, 0, 0, 0]),
  },
  // Splash mark, shown over the brand background colour.
  {
    name: "splash-icon.png",
    size: 512,
    shade: (x, y) => mark(x, y, 0.55, WHITE),
  },
  {
    name: "favicon.png",
    size: 96,
    shade: (x, y) => {
      if (!insideRoundedSquare(x, y, 0.25)) return [0, 0, 0, 0];
      const m = mark(x, y, 0.6, WHITE);
      return m[3] > 0 ? m : [...gradient(x, y), 1];
    },
  },
];

mkdirSync(OUT, { recursive: true });
for (const { name, size, shade } of files) {
  const png = encodePng(size, size, render(size, shade));
  writeFileSync(join(OUT, name), png);
  console.log(`${name.padEnd(32)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
