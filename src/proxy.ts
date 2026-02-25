import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login"];
const apiPublicPaths = ["/api/auth", "/api/webhooks"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public API paths
  if (apiPublicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow public pages
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check session for protected routes
  const session = await auth();

  if (!session && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!session && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
