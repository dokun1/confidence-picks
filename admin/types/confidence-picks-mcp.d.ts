// confidence-picks-mcp ships plain ESM JavaScript. These are the shapes the
// inspector relies on; keep them minimal and in step with mcp/src/tools.js.
declare module "confidence-picks-mcp/tools" {
  export interface ToolAnnotations {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  }
  export interface ToolDefinition {
    name: string;
    title?: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations?: ToolAnnotations;
  }
  export const TOOLS: ToolDefinition[];
  export function dispatch(name: string, args: Record<string, unknown>, client: unknown): Promise<unknown>;
}

declare module "confidence-picks-mcp/server" {
  import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
  export function createServer(client: unknown): Server;
}

declare module "confidence-picks-mcp/client" {
  export class ConfidencePicksClient {
    constructor(opts: { token: string; baseUrl?: string; fetchImpl?: typeof fetch });
    baseUrl: string;
    get(path: string): Promise<unknown>;
    post(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<unknown>;
    put(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<unknown>;
  }
}

declare module "confidence-picks-mcp/docs" {
  export const INSTRUCTIONS: string;
  export const RESOURCES: Array<{ uri: string; name: string; title?: string; description?: string; mimeType: string }>;
  export const PROMPTS: Array<{ name: string; title?: string; description?: string; arguments: Array<{ name: string; description?: string; required?: boolean }> }>;
}
