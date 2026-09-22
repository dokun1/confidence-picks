import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "confidence-picks-mcp/server";
import { ConfidencePicksClient } from "confidence-picks-mcp/client";

// One real MCP round-trip per request: the published package's server, bound to
// a client built from the pasted token, driven by the SDK's own Client over an
// in-memory transport. What the page shows is the real protocol traffic -- the
// same code path a user's Claude Code speaks to over stdio. The token exists
// only for the duration of the call.

export interface ToolCallResult {
  isError: boolean;
  text: string;
  structured: unknown;
  elapsedMs: number;
}

const CP_TOKEN = /^cp_live_[A-Za-z0-9_-]{20,}$/;

export function isWellFormedToken(token: string): boolean {
  return CP_TOKEN.test(token);
}

// Describing the server needs no real token: initialize, tools/list,
// resources/list and prompts/list never call the API.
const DESCRIBE_TOKEN = "cp_live_" + "0".repeat(43);

async function withSession<T>(token: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  const server = createServer(new ConfidencePicksClient({ token, baseUrl: process.env.SERVER_API_URL }));
  const client = new Client({ name: "confidence-picks-admin-inspector", version: "0.2.0" }, { capabilities: {} });
  await server.connect(serverSide);
  await client.connect(clientSide);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

export interface ServerDescription {
  serverVersion: string;
  instructions: string;
  tools: Array<{
    name: string;
    title?: string;
    description?: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  }>;
  resources: Array<{ uri: string; name: string; title?: string; description?: string; mimeType?: string }>;
  prompts: Array<{ name: string; title?: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }>;
}

// Everything the server says about itself, as the protocol delivers it.
export async function describeServer(): Promise<ServerDescription> {
  return withSession(DESCRIBE_TOKEN, async (c) => {
    const [{ tools }, { resources }, { prompts }] = await Promise.all([c.listTools(), c.listResources(), c.listPrompts()]);
    return {
      serverVersion: c.getServerVersion()?.version ?? "unknown",
      instructions: c.getInstructions() ?? "",
      tools: tools as ServerDescription["tools"],
      resources: resources as ServerDescription["resources"],
      prompts: prompts as ServerDescription["prompts"],
    };
  });
}

export async function callTool(token: string, name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  return withSession(token, async (c) => {
    const started = Date.now();
    const res = await c.callTool({ name, arguments: args });
    const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
    return {
      isError: res.isError === true,
      text: content.map((p) => (p.type === "text" ? (p.text ?? "") : `[${p.type}]`)).join("\n"),
      structured: res.structuredContent ?? null,
      elapsedMs: Date.now() - started,
    };
  });
}

export async function readResourceText(uri: string): Promise<{ mimeType?: string; text: string }> {
  return withSession(DESCRIBE_TOKEN, async (c) => {
    const { contents } = await c.readResource({ uri });
    const first = contents[0] as { mimeType?: string; text?: string } | undefined;
    return { mimeType: first?.mimeType, text: first?.text ?? "" };
  });
}

export async function renderPrompt(name: string, args: Record<string, string>) {
  return withSession(DESCRIBE_TOKEN, async (c) => {
    const { description, messages } = await c.getPrompt({ name, arguments: args });
    return {
      description,
      messages: (messages as Array<{ role: string; content: { type: string; text?: string } }>).map((m) => ({
        role: m.role,
        text: m.content.type === "text" ? (m.content.text ?? "") : `[${m.content.type}]`,
      })),
    };
  });
}
