import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "./auth.config";
import { isEmailAllowed } from "./lib/allowlist";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`auth: missing required env var ${name}`);
  return value;
}

// Full Auth.js config for the Node runtime: the edge-safe base plus Google and
// the allowlist gate. A lazy factory so `next build` never needs the env.
//
// AuthN is Google's job; AuthZ is the signIn callback's. A successful Google
// login for an email that is not in the backend's ADMIN_EMAILS gets no session
// at all — Auth.js bounces it to the error page without issuing a cookie.
function buildAuthConfig(): NextAuthConfig {
  return {
    ...authConfig,
    providers: [
      Google({
        clientId: requireEnv("AUTH_GOOGLE_ID"),
        clientSecret: requireEnv("AUTH_GOOGLE_SECRET"),
      }),
    ],
    pages: { signIn: "/signin" },
    callbacks: {
      ...authConfig.callbacks,
      async signIn({ user }) {
        return isEmailAllowed(user?.email);
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(buildAuthConfig);
