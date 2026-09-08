import AuthService from './authService.js';

export interface McpTokenRecord {
  id: number;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

function apiBase(): string {
  return `${AuthService.getApiBaseUrl()}/api/mcp`;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await AuthService.makeAuthenticatedRequest(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  return res as Response;
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    let message = fallback;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body: keep the fallback */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function listMcpTokens(): Promise<McpTokenRecord[]> {
  const res = await authFetch(`${apiBase()}/tokens`);
  const body = await unwrap<{ tokens: McpTokenRecord[] }>(res, 'Failed to load tokens');
  return body.tokens;
}

// `plaintext` is returned exactly once and is not recoverable afterwards.
export async function createMcpToken(
  name: string,
  scopes: string[]
): Promise<{ token: McpTokenRecord; plaintext: string }> {
  const res = await authFetch(`${apiBase()}/tokens`, {
    method: 'POST',
    body: JSON.stringify({ name, scopes }),
  });
  return unwrap<{ token: McpTokenRecord; plaintext: string }>(res, 'Failed to create token');
}

export async function revokeMcpToken(id: number): Promise<void> {
  const res = await authFetch(`${apiBase()}/tokens/${id}`, { method: 'DELETE' });
  await unwrap<{ revoked: boolean }>(res, 'Failed to revoke token');
}
