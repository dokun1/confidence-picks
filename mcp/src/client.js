// Thin authenticated HTTP client. The only place that knows about the token or
// the network, which is what keeps core.js testable without either.

export class ConfidencePicksClient {
  constructor({ baseUrl, token, fetchImpl = globalThis.fetch }) {
    if (!token) throw new Error('CONFIDENCE_PICKS_TOKEN is required');
    this.baseUrl = (baseUrl || 'https://api.confidence-picks.com').replace(/\/$/, '');
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(method, path, body) {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    if (!res.ok) {
      let detail = '';
      try { detail = JSON.stringify(await res.json()); } catch { /* non-JSON error body */ }
      // Translate the statuses this API actually uses into something a model can
      // act on rather than a bare status code.
      if (res.status === 401) throw new Error(`Token rejected (401). It may be revoked or expired; mint a new one on your profile page. ${detail}`);
      if (res.status === 403) throw new Error(`Not permitted (403). The token is missing a required scope, or this endpoint is off-limits to MCP tokens. ${detail}`);
      if (res.status === 409) throw new Error(`Conflict (409) — usually a game that has already kicked off and is locked. ${detail}`);
      if (res.status === 429) throw new Error(`Rate limited (429). Slow down and retry shortly. ${detail}`);
      throw new Error(`${method} ${path} failed (${res.status}). ${detail}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
}
