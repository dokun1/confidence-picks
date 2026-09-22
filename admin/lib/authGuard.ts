// The middleware's authorization decision, kept free of any next/server or
// next-auth import so it is unit-testable under `node --test`.

export interface GuardableRequest {
  auth: unknown;
  nextUrl: { origin: string; href: string };
}

export type GuardDecision = { type: "next" } | { type: "redirect"; location: string };

export function guardDecision(req: GuardableRequest): GuardDecision {
  if (req.auth) return { type: "next" };
  const signInUrl = new URL("/signin", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
  return { type: "redirect", location: signInUrl.toString() };
}
