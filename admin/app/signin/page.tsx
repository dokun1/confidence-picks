// The portal's only unauthenticated route. A Server Component that imports
// nothing secret-bearing and reads no env: it renders one button and a note.
// Authorization is NOT decided here — auth.ts's signIn callback rejects any
// Google account whose email is not in the backend's ADMIN_EMAILS.

import { signIn } from "@/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}) {
  // Auth.js validates redirectTo against the app origin, so an attacker-supplied
  // absolute URL cannot make this an open redirect.
  const { callbackUrl, error } = await searchParams;
  const redirectTo = typeof callbackUrl === "string" && callbackUrl.length > 0 ? callbackUrl : "/";
  const denied = typeof error === "string" && error.length > 0;

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold">confidence-picks admin</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to continue.</p>
        </header>

        {denied && (
          <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            That Google account is not on the admin allowlist, so no session was created.
          </p>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
          >
            Sign in with Google
          </button>
        </form>

        <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
          Access is limited to allowlisted admins. A sign-in with any other account is
          rejected after authentication.
        </p>
      </div>
    </main>
  );
}
