import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config — no bcryptjs, no prisma.
// Used by middleware (Edge Function) for JWT session checks only.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token && session.user) session.user.id = token.id as string;
      return session;
    },
  },
};
