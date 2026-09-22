import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js base config, shared by middleware.ts (Edge runtime) and the
// full Node config in auth.ts. The middleware only verifies the encrypted
// session cookie and reads `adminEmail`; the Google provider and the allowlist
// sign-in gate live in auth.ts. Same split as findplayplace/admin, where it was
// forced by an async provider; kept here so the middleware never needs provider
// secrets and the two configs cannot drift apart.

declare module "next-auth" {
  interface Session {
    adminEmail?: string;
  }
}

export const authConfig: NextAuthConfig = {
  // httpOnly encrypted JWT cookie — no DB adapter; the portal never touches a DB.
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) token.adminEmail = user.email;
      return token;
    },
    async session({ session, token }) {
      if (typeof token.adminEmail === "string") session.adminEmail = token.adminEmail;
      return session;
    },
  },
};
