import { auth } from "@/auth";

// Phase 1 placeholder. The MCP inspector lands here once confidence-picks-mcp
// 0.4.0 exports createServer(). Until then this page exists to prove the whole
// chain — Google OAuth, the allowlist, the domain — end to end.
export default async function HomePage() {
  const session = await auth();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold">Inspector</h1>
      <p className="mt-2 text-sm text-slate-600">
        Signed in as <span className="font-medium text-slate-900">{session?.adminEmail}</span>.
        The MCP inspector will appear here.
      </p>
    </main>
  );
}
