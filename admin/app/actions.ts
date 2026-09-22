"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { argsFromForm, type JsonSchemaObject } from "@/lib/argsFromForm";
import { callTool, isWellFormedToken } from "@/lib/mcpSession";
import { TOOLS } from "confidence-picks-mcp/tools";

// Every server action re-verifies the session. A 'use server' export compiles
// to an independently invocable POST endpoint, so middleware alone is not
// enough -- this is the same defence findplayplace/admin uses.
async function requireAdminEmail(): Promise<string> {
  const session = await auth();
  if (!session?.adminEmail) redirect("/signin");
  return session.adminEmail;
}

export interface RunResult {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  isError: boolean;
  text: string;
  elapsedMs: number;
  errors: string[];
}

export async function runTool(_prev: RunResult | null, fd: FormData): Promise<RunResult> {
  await requireAdminEmail();

  const tool = String(fd.get("__tool") ?? "");
  const token = String(fd.get("__token") ?? "").trim();
  const def = TOOLS.find((t) => t.name === tool);
  const base = { tool, args: {}, ok: false, isError: false, text: "", elapsedMs: 0 };

  if (!def) return { ...base, errors: [`Unknown tool: ${tool}`] };
  if (!isWellFormedToken(token)) return { ...base, errors: ["Paste a confidence-picks MCP token (starts with cp_live_)."] };

  const { args, errors } = argsFromForm(def.inputSchema as JsonSchemaObject, fd);
  if (errors.length) return { ...base, args, errors };

  try {
    const r = await callTool(token, tool, args);
    return { tool, args, ok: !r.isError, isError: r.isError, text: r.text, elapsedMs: r.elapsedMs, errors: [] };
  } catch (e) {
    return { ...base, args, errors: [e instanceof Error ? e.message : String(e)] };
  }
}
