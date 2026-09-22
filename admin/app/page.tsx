import { auth } from "@/auth";
import Inspector from "@/components/Inspector";
import { fieldSpecs, type JsonSchemaObject } from "@/lib/argsFromForm";
import { describeServer } from "@/lib/mcpSession";

// The inspector. Everything on this page comes from the server describing
// itself over the protocol -- initialize (instructions, version), tools/list,
// resources/list, prompts/list -- so it cannot drift from what a real client
// sees. Each run is a real tools/call made with a token the admin pastes.
export default async function HomePage() {
  const session = await auth();
  const d = await describeServer();

  const tools = d.tools.map((t) => ({
    name: t.name,
    title: t.title ?? t.name,
    description: t.description ?? "",
    readOnly: t.annotations?.readOnlyHint === true,
    destructive: t.annotations?.destructiveHint === true,
    fields: fieldSpecs(t.inputSchema as JsonSchemaObject),
    inputSchema: t.inputSchema,
    outputSchema: t.outputSchema ?? null,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">
          MCP inspector <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-normal text-slate-600">confidence-picks-mcp {d.serverVersion}</span>
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Runs the published package in-process and drives it with a real MCP client. Signed in as{" "}
          <span className="font-medium text-slate-900">{session?.adminEmail}</span>; tools run as whoever owns the token you paste.
        </p>
      </header>
      <Inspector instructions={d.instructions} tools={tools} resources={d.resources} prompts={d.prompts} />
    </main>
  );
}
