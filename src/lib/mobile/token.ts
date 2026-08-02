import crypto from "crypto";

/**
 * HS256 tokens for native clients.
 *
 * The Android app cannot use the NextAuth session, because that is an httpOnly
 * cookie established through a browser redirect flow. It gets a bearer token
 * instead — signed with the SAME `AUTH_SECRET`, carrying the same user id the
 * NextAuth JWT carries, and issued only after the same bcrypt check the
 * credentials provider performs. So there is one credential store and one
 * definition of "who is signed in"; only the transport differs.
 *
 * Deliberately stateless (no tokens table): the database schema and its
 * behaviour are unchanged. Revocation is therefore by expiry, which is why the
 * access token is short-lived and the refresh token is checked against the
 * user still existing in the database on every use.
 *
 * Implemented on node:crypto rather than a JWT library so no dependency is
 * added to a production app that is already deployed and working.
 */

const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

export type TokenKind = "access" | "refresh";

export interface MobileTokenPayload {
  sub: string;
  email: string;
  kind: TokenKind;
  iat: number;
  exp: number;
}

function secret(): Buffer {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    // Failing loudly beats signing with a fallback key that would let anyone
    // who knows the default mint a valid session.
    throw new Error("AUTH_SECRET is not set — mobile tokens cannot be signed.");
  }
  return Buffer.from(value, "utf8");
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(data).digest());
}

function issue(userId: string, email: string, kind: TokenKind, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub: userId, email, kind, iat: now, exp: now + ttlSeconds })
  );
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Seconds until `accessToken` expires — lets the client refresh proactively. */
  expiresIn: number;
}

export function issueTokenPair(userId: string, email: string): TokenPair {
  return {
    accessToken: issue(userId, email, "access", ACCESS_TTL_SECONDS),
    refreshToken: issue(userId, email, "refresh", REFRESH_TTL_SECONDS),
    expiresIn: ACCESS_TTL_SECONDS,
  };
}

/**
 * Verify a token and return its payload, or null if it is malformed, tampered
 * with, expired, or of the wrong kind. Never throws on bad input — a garbage
 * Authorization header is an ordinary 401, not a 500.
 */
export function verifyToken(token: string, expected: TokenKind): MobileTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  // Constant-time compare so a wrong signature cannot be found byte by byte.
  const expectedSig = Buffer.from(sign(`${header}.${payload}`), "utf8");
  const actualSig = Buffer.from(signature, "utf8");
  if (expectedSig.length !== actualSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

  let parsed: MobileTokenPayload;
  try {
    parsed = JSON.parse(fromB64url(payload).toString("utf8"));
  } catch {
    return null;
  }

  if (parsed.kind !== expected) return null;
  if (typeof parsed.exp !== "number" || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
  if (typeof parsed.sub !== "string" || !parsed.sub) return null;

  return parsed;
}
