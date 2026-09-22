import { auth } from "@/auth";
import Inspector from "@/components/Inspector";
import { fieldSpecs, type JsonSchemaObject } from "@/lib/argsFromForm";
import { TOOLS } from "confidence-picks-mcp/tools";

// The inspector. The tool list comes from the published package's own TOOLS
// export, so the forms here cannot drift from what the server actually
// serves. Each run is a real MCP tools/call, made server-side with a token the
// admin pastes; see lib/mcpSession.ts.
export default async function HomePage() {
  const session = await auth();
  const tools = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    readOnly: t.annotations?.readOnlyHint === true,
    destructive: t.annotations?.destructiveHint === true,
    fields: fieldSpecs(t.inputSchema as JsonSchemaObject),
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">MCP inspector</h1>
        <p className="mt-1 text-sm text-slate-600">
          Runs <code>confidence-picks-mcp</code> in-process and drives it with a real MCP client. Signed in as{" "}
          <span className="font-medium text-slate-900">{session?.adminEmail}</span>; tools run as whoever owns the
          token you paste.
        </p>
      </header>
      <Inspector tools={tools} />
    </main>
  );
}
