import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "confidence-picks-mcp/server";
import { ConfidencePicksClient } from "confidence-picks-mcp/client";

// One real MCP round-trip per request: the published package's server, bound to
// a client built from the pasted token, driven by the SDK's own Client over an
// in-memory transport. What the page shows is the real tools/list and
// tools/call traffic -- the same code path a user's Claude Code speaks to over
// stdio. The token exists only for the duration of the call.

export interface ToolCallResult {
  isError: boolean;
  text: string;
  elapsedMs: number;
}

const CP_TOKEN = /^cp_live_[A-Za-z0-9_-]{20,}$/;

export function isWellFormedToken(token: string): boolean {
  return CP_TOKEN.test(token);
}

async function withSession<T>(token: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  const server = createServer(
    new ConfidencePicksClient({ token, baseUrl: process.env.SERVER_API_URL }),
  );
  const client = new Client({ name: "confidence-picks-admin-inspector", version: "0.1.0" }, { capabilities: {} });
  await server.connect(serverSide);
  await client.connect(clientSide);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

export async function listTools(token: string) {
  return withSession(token, async (c) => {
    const { tools } = await c.listTools();
    return { serverVersion: c.getServerVersion()?.version ?? "unknown", tools };
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
      elapsedMs: Date.now() - started,
    };
  });
}
