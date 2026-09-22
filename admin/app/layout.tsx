import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import AdminNav from "@/components/AdminNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "confidence-picks admin",
  description: "Administration for confidence-picks (admin.confidence-picks.com).",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The nav renders above every page; middleware.ts gates every non-public
  // route, so it only ever reaches an allowlisted admin. Resolving the session
  // must never break rendering (e.g. incomplete local env) — any failure means
  // "no email shown", nothing else.
  let adminEmail: string | undefined;
  try {
    adminEmail = (await auth())?.adminEmail;
  } catch {
    adminEmail = undefined;
  }
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <AdminNav adminEmail={adminEmail} />
        {children}
      </body>
    </html>
  );
}
