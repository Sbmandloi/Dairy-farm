import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "./token";
import { fail, unauthorized } from "./response";

export interface MobileSession {
  userId: string;
  email: string;
}

/**
 * Resolve the caller from the `Authorization: Bearer <token>` header.
 *
 * A valid signature is not enough on its own: the user is looked up so that a
 * token belonging to a deleted account stops working immediately, which is the
 * only revocation a stateless token has.
 */
export async function getMobileSession(req: NextRequest): Promise<MobileSession | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const payload = verifyToken(header.slice(7).trim(), "access");
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true },
  });
  if (!user) return null;

  return { userId: user.id, email: user.email };
}

type Handler<C> = (
  req: NextRequest,
  session: MobileSession,
  context: C
) => Promise<NextResponse> | NextResponse;

/**
 * Wrap a route handler so it only runs for an authenticated caller, and so an
 * unexpected throw becomes a 500 with a safe message instead of leaking a stack
 * trace to the device. Business errors are still surfaced verbatim by the
 * handlers themselves — this is the last-resort net.
 */
export function withAuth<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, context: C): Promise<NextResponse> => {
    const session = await getMobileSession(req);
    if (!session) return unauthorized();

    try {
      return await handler(req, session, context);
    } catch (error) {
      console.error(`[mobile-api] ${req.method} ${req.nextUrl.pathname}`, error);
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}
