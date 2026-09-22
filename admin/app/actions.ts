"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { argsFromForm, type JsonSchemaObject } from "@/lib/argsFromForm";
import { callTool, isWellFormedToken, readResourceText, renderPrompt } from "@/lib/mcpSession";
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
  structured: unknown;
  elapsedMs: number;
  errors: string[];
}

export async function runTool(_prev: RunResult | null, fd: FormData): Promise<RunResult> {
  await requireAdminEmail();

  const tool = String(fd.get("__tool") ?? "");
  const token = String(fd.get("__token") ?? "").trim();
  const def = TOOLS.find((t) => t.name === tool);
  const base = { tool, args: {}, ok: false, isError: false, text: "", structured: null, elapsedMs: 0 };

  if (!def) return { ...base, errors: [`Unknown tool: ${tool}`] };
  if (!isWellFormedToken(token)) return { ...base, errors: ["Paste a confidence-picks MCP token (starts with cp_live_)."] };

  const { args, errors } = argsFromForm(def.inputSchema as JsonSchemaObject, fd);
  if (errors.length) return { ...base, args, errors };

  try {
    const r = await callTool(token, tool, args);
    return { tool, args, ok: !r.isError, isError: r.isError, text: r.text, structured: r.structured, elapsedMs: r.elapsedMs, errors: [] };
  } catch (e) {
    return { ...base, args, errors: [e instanceof Error ? e.message : String(e)] };
  }
}

export interface ResourceResult { uri: string; mimeType?: string; text: string; error?: string }

export async function readResource(_prev: ResourceResult | null, fd: FormData): Promise<ResourceResult> {
  await requireAdminEmail();
  const uri = String(fd.get("__uri") ?? "");
  try {
    const r = await readResourceText(uri);
    return { uri, mimeType: r.mimeType, text: r.text };
  } catch (e) {
    return { uri, text: "", error: e instanceof Error ? e.message : String(e) };
  }
}

export interface PromptResult { name: string; args: Record<string, string>; description?: string; messages: Array<{ role: string; text: string }>; error?: string }

export async function getPrompt(_prev: PromptResult | null, fd: FormData): Promise<PromptResult> {
  await requireAdminEmail();
  const name = String(fd.get("__prompt") ?? "");
  const args: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("__") && typeof v === "string" && v.trim() !== "") args[k] = v.trim();
  }
  try {
    const r = await renderPrompt(name, args);
    return { name, args, description: r.description, messages: r.messages };
  } catch (e) {
    return { name, args, messages: [], error: e instanceof Error ? e.message : String(e) };
  }
}
