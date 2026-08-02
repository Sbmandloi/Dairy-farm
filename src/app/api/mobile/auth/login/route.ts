import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { issueTokenPair } from "@/lib/mobile/token";
import { fail, ok } from "@/lib/mobile/response";

/**
 * POST /api/mobile/auth/login
 *
 * The same credential check the NextAuth provider performs (same schema, same
 * bcrypt comparison against the same `password_hash`), returning a bearer token
 * instead of setting a cookie. No separate user store, no separate password
 * rules — a user created on the Settings page can sign in on the phone
 * immediately, and vice versa.
 */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = loginSchema.safeParse(body);
  // Deliberately the same message as a wrong password: telling the caller the
  // email was malformed vs. unknown would let them enumerate accounts.
  if (!parsed.success) return fail("Invalid email or password.", 401);

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return fail("Invalid email or password.", 401);

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return fail("Invalid email or password.", 401);

  return ok({
    ...issueTokenPair(user.id, user.email),
    user: { id: user.id, name: user.name, email: user.email },
  });
}
