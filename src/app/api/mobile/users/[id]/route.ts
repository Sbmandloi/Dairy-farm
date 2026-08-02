import { deleteUser } from "@/lib/services/user.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/mobile/users/[id]
 *
 * Both guards from the web flow are kept: you cannot delete yourself (checked
 * here against the bearer session, as `deleteUserAction` checks the NextAuth
 * session), and `deleteUser` refuses to remove the last remaining account —
 * which would lock everyone out of the dairy.
 */
export const DELETE = withAuth<Ctx>(async (_req, session, { params }) => {
  const { id } = await params;

  if (id === session.userId) {
    return fail("You cannot delete your own account");
  }

  try {
    await deleteUser(id);
    return ok({ deleted: true });
  } catch (error) {
    return failFrom(error, "Failed to delete user");
  }
});
