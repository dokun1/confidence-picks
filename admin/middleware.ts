import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { guardDecision } from "@/lib/authGuard";

// Built from the EDGE-SAFE config (auth.config.ts): the middleware only needs to
// verify the session cookie.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const decision = guardDecision(req);
  if (decision.type === "redirect") return NextResponse.redirect(decision.location);
  return NextResponse.next();
});

// Everything except the public surface: Auth.js's own routes (excluding them is
// also what prevents a redirect loop), the sign-in page, Next's build assets,
// and static files (a dot in the last path segment). Must be a static literal.
export const config = {
  matcher: ["/((?!api/auth|signin|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
