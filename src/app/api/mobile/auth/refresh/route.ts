import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { issueTokenPair, verifyToken } from "@/lib/mobile/token";
import { fail, ok } from "@/lib/mobile/response";

/**
 * POST /api/mobile/auth/refresh { refreshToken }
 *
 * Exchanges a valid refresh token for a fresh pair, so the app stays signed in
 * across weeks without ever storing the password. The user is re-read from the
 * database on every refresh: deleting an account on the Settings page stops
 * that device at its next refresh, which is the revocation a stateless token
 * can offer without adding a table to the schema.
 */
export async function POST(req: NextRequest) {
  let body: { refreshToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const token = typeof body.refreshToken === "string" ? body.refreshToken : "";
  if (!token) return fail("Session expired. Please sign in again.", 401);

  const payload = verifyToken(token, "refresh");
  if (!payload) return fail("Session expired. Please sign in again.", 401);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true },
  });
  if (!user) return fail("Session expired. Please sign in again.", 401);

  return ok({
    ...issueTokenPair(user.id, user.email),
    user,
  });
}
