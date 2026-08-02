import { z } from "zod";
import { createUser, getUsers } from "@/lib/services/user.service";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";

/** GET — who can sign in, flagging the caller so the app can hide "delete me". */
export const GET = withAuth(async (_req, session) => {
  const users = await getUsers();
  return ok(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
      isCurrentUser: u.id === session.userId,
    }))
  );
});

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/** POST — add a user. `createUser` hashes with bcrypt and rejects a duplicate email. */
export const POST = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  try {
    return ok(await createUser(parsed.data), 201);
  } catch (error) {
    return failFrom(error, "Failed to create user");
  }
});
