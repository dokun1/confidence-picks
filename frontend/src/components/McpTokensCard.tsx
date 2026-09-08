import { useEffect, useState } from 'react';
import Button from '../designsystem/components/Button';
import Card from '../designsystem/components/Card';
import TextField from '../designsystem/components/TextField';
import InlineToast from '../designsystem/components/InlineToast';
import {
  listMcpTokens,
  createMcpToken,
  revokeMcpToken,
  type McpTokenRecord,
} from '../lib/mcpTokenService';

// Scopes a token may hold. Mirrors MCP_SCOPES on the server; the server
// re-validates, so this list is a convenience rather than the enforcement point.
const SCOPES: { id: string; label: string; hint: string }[] = [
  { id: 'groups:read', label: 'Read groups', hint: 'See your pools, members and standings' },
  { id: 'picks:read', label: 'Read picks', hint: 'See picks you have already made' },
  { id: 'picks:write', label: 'Make picks', hint: 'Submit and change your picks' },
];

const DEFAULT_SCOPES = SCOPES.map((s) => s.id);

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString();
}

export default function McpTokensCard() {
  const [tokens, setTokens] = useState<McpTokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(DEFAULT_SCOPES);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listMcpTokens()
      .then((t) => {
        if (!cancelled) setTokens(t);
      })
      .catch((e) => {
        // A brand-new deploy has no table until the first write, so a read
        // failure here is not worth shouting about -- show an empty list.
        if (!cancelled) setTokens([]);
        console.warn('[mcp] could not load tokens', e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleScope(id: string) {
    setScopes((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the token a name so you can recognise it later.');
      return;
    }
    if (scopes.length === 0) {
      setError('Pick at least one permission.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { token, plaintext } = await createMcpToken(trimmed, scopes);
      setFreshToken(plaintext);
      setTokens((prev) => [token, ...prev]);
      setName('');
      setScopes(DEFAULT_SCOPES);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create token');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      await revokeMcpToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke token');
    }
  }

  async function copyToken() {
    if (!freshToken) return;
    try {
      await navigator.clipboard.writeText(freshToken);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-md">
        <div>
          <h2 className="text-lg font-semibold text-content">AI client access</h2>
          <p className="text-sm text-content-muted">
            Connect Claude Code or Codex to your account so you can check standings and make
            picks without opening the site. Tokens can only read your pools and manage your
            own picks &mdash; they can never delete a group, leave one, or change anyone
            else&rsquo;s picks.
          </p>
        </div>

        {/* The plaintext is shown exactly once and is not recoverable. */}
        {freshToken && (
          <div
            className="rounded-md border border-border bg-surface-raised p-sm flex flex-col gap-xs"
            data-testid="fresh-token"
          >
            <span className="text-sm font-medium text-content">
              Copy this now &mdash; you won&rsquo;t be able to see it again.
            </span>
            <code className="break-all text-xs text-content bg-surface p-xs rounded">
              {freshToken}
            </code>
            <div className="flex gap-xs">
              <Button variant="secondary" size="sm" onClick={copyToken}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="tertiary" size="sm" onClick={() => setFreshToken(null)}>
                Done
              </Button>
            </div>
            <details className="text-xs text-content-muted">
              <summary className="cursor-pointer">Setup instructions</summary>
              <pre className="whitespace-pre-wrap mt-xs">{`# Claude Code
claude mcp add confidence-picks \\
  --env CONFIDENCE_PICKS_TOKEN=<your token> \\
  -- npx -y confidence-picks-mcp

# Codex CLI
codex mcp add confidence-picks \\
  --env CONFIDENCE_PICKS_TOKEN=<your token> \\
  -- npx -y confidence-picks-mcp`}</pre>
            </details>
          </div>
        )}

        <div className="flex flex-col gap-xs">
          <TextField
            label="Token name"
            value={name}
            onChange={(value) => setName(value.slice(0, 64))}
            placeholder="My laptop"
          />
          <fieldset className="flex flex-col gap-2xs">
            <legend className="text-sm text-content-muted">Permissions</legend>
            {SCOPES.map((s) => (
              <label key={s.id} className="flex items-start gap-xs text-sm text-content">
                <input
                  type="checkbox"
                  checked={scopes.includes(s.id)}
                  onChange={() => toggleScope(s.id)}
                  aria-label={s.label}
                />
                <span>
                  <span className="font-medium">{s.label}</span>{' '}
                  <span className="text-content-muted">&mdash; {s.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex items-center gap-xs">
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={creating} loading={creating}>
              {creating ? 'Creating...' : 'Create token'}
            </Button>
            <InlineToast
              open={!!error}
              message={error || ''}
              variant="error"
              onClose={() => setError(null)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-xs">
          <h3 className="text-sm font-medium text-content">Active tokens</h3>
          {loading ? (
            // Deliberately not a Spinner: that carries role="status", and a
            // second live region on the profile page competes with the account
            // form's InlineToast for screen-reader announcements.
            <p className="text-sm text-content-muted">Loading tokens…</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-content-muted">No tokens yet.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {tokens.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-xs border-b border-border pb-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-content">{t.name}</span>
                    <span className="text-xs text-content-muted">
                      {t.scopes.join(', ')} &middot; last used {formatDate(t.lastUsedAt)} &middot;
                      expires {formatDate(t.expiresAt)}
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevoke(t.id)}
                    aria-label={`Revoke ${t.name}`}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
