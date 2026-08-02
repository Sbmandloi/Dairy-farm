import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Lightweight middleware — uses only the edge-safe auth config.
// bcryptjs and prisma are NOT imported here, so this runs safely in Edge Functions.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow NextAuth endpoints and public webhooks
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/webhooks")) {
    return;
  }

  // The mobile API authenticates with a bearer token, not the NextAuth cookie,
  // so this cookie-based check would reject every request from the Android app.
  // These routes are NOT public: each one is wrapped in withAuth(), which
  // verifies the token and loads the user before any handler runs.
  if (pathname.startsWith("/api/mobile")) {
    return;
  }

  // Allow the login page
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return;
  }

  // Unauthenticated — return 401 for API calls, redirect to login for pages
  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
