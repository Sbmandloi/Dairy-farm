import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/mobile/guard";
import { notFound, ok } from "@/lib/mobile/response";

/**
 * GET /api/mobile/auth/me
 *
 * Used on cold start to confirm a stored token is still good before showing the
 * dashboard, so the app never renders a signed-in shell around a dead session.
 */
export const GET = withAuth(async (_req, session) => {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return notFound("User not found");
  return ok(user);
});
