import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import McpTokensCard from './McpTokensCard';

vi.mock('../lib/mcpTokenService', () => ({
  listMcpTokens: vi.fn(),
  createMcpToken: vi.fn(),
  revokeMcpToken: vi.fn(),
}));

import { listMcpTokens, createMcpToken, revokeMcpToken } from '../lib/mcpTokenService';

const token = (over = {}) => ({
  id: 1,
  name: 'My laptop',
  scopes: ['picks:read', 'picks:write'],
  createdAt: '2026-09-01T00:00:00Z',
  lastUsedAt: null,
  expiresAt: '2026-12-01T00:00:00Z',
  ...over,
});

describe('McpTokensCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listMcpTokens).mockResolvedValue([]);
  });

  it('lists existing tokens with their scopes', async () => {
    vi.mocked(listMcpTokens).mockResolvedValue([token()]);
    render(<McpTokensCard />);
    expect(await screen.findByText('My laptop')).toBeInTheDocument();
    expect(screen.getByText(/picks:read, picks:write/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no tokens', async () => {
    render(<McpTokensCard />);
    expect(await screen.findByText('No tokens yet.')).toBeInTheDocument();
  });

  // A brand-new deploy has no mcp_tokens table until the first write, so the
  // list read can fail. That must degrade to an empty state, not a broken page.
  it('degrades to an empty list when the fetch fails', async () => {
    vi.mocked(listMcpTokens).mockRejectedValue(new Error('relation does not exist'));
    render(<McpTokensCard />);
    expect(await screen.findByText('No tokens yet.')).toBeInTheDocument();
  });

  it('requires a name before creating', async () => {
    render(<McpTokensCard />);
    await screen.findByText('No tokens yet.');
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));
    expect(await screen.findByText(/give the token a name/i)).toBeInTheDocument();
    expect(createMcpToken).not.toHaveBeenCalled();
  });

  it('requires at least one permission', async () => {
    render(<McpTokensCard />);
    await screen.findByText('No tokens yet.');
    fireEvent.change(screen.getByPlaceholderText('My laptop'), { target: { value: 'CLI' } });
    for (const label of ['Read groups', 'Read picks', 'Make picks']) {
      fireEvent.click(screen.getByLabelText(label));
    }
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));
    expect(await screen.findByText(/at least one permission/i)).toBeInTheDocument();
    expect(createMcpToken).not.toHaveBeenCalled();
  });

  it('creates a token with the selected scopes and reveals the plaintext once', async () => {
    vi.mocked(createMcpToken).mockResolvedValue({
      token: token({ id: 2, name: 'CLI' }),
      plaintext: 'cp_live_topsecret',
    });
    render(<McpTokensCard />);
    await screen.findByText('No tokens yet.');
    fireEvent.change(screen.getByPlaceholderText('My laptop'), { target: { value: '  CLI  ' } });
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));

    await waitFor(() => expect(createMcpToken).toHaveBeenCalledWith('CLI', [
      'groups:read', 'picks:read', 'picks:write',
    ]));
    expect(await screen.findByText('cp_live_topsecret')).toBeInTheDocument();
    expect(screen.getByText(/won’t be able to see it again/i)).toBeInTheDocument();
    // And it joins the list.
    expect(screen.getByText('CLI')).toBeInTheDocument();
  });

  it('dismisses the revealed token so the secret leaves the screen', async () => {
    vi.mocked(createMcpToken).mockResolvedValue({
      token: token({ id: 3, name: 'X' }),
      plaintext: 'cp_live_gone',
    });
    render(<McpTokensCard />);
    await screen.findByText('No tokens yet.');
    fireEvent.change(screen.getByPlaceholderText('My laptop'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));
    expect(await screen.findByText('cp_live_gone')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    await waitFor(() => expect(screen.queryByText('cp_live_gone')).not.toBeInTheDocument());
  });

  it('surfaces a creation failure instead of pretending it worked', async () => {
    vi.mocked(createMcpToken).mockRejectedValue(new Error('Invalid scopes'));
    render(<McpTokensCard />);
    await screen.findByText('No tokens yet.');
    fireEvent.change(screen.getByPlaceholderText('My laptop'), { target: { value: 'CLI' } });
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));
    expect(await screen.findByText('Invalid scopes')).toBeInTheDocument();
  });

  it('revokes a token and drops it from the list', async () => {
    vi.mocked(listMcpTokens).mockResolvedValue([token()]);
    vi.mocked(revokeMcpToken).mockResolvedValue(undefined);
    render(<McpTokensCard />);
    await screen.findByText('My laptop');
    fireEvent.click(screen.getByRole('button', { name: 'Revoke My laptop' }));
    await waitFor(() => expect(revokeMcpToken).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText('My laptop')).not.toBeInTheDocument());
  });

  it('keeps the token listed when revocation fails', async () => {
    vi.mocked(listMcpTokens).mockResolvedValue([token()]);
    vi.mocked(revokeMcpToken).mockRejectedValue(new Error('Token not found'));
    render(<McpTokensCard />);
    await screen.findByText('My laptop');
    fireEvent.click(screen.getByRole('button', { name: 'Revoke My laptop' }));
    expect(await screen.findByText('Token not found')).toBeInTheDocument();
    expect(screen.getByText('My laptop')).toBeInTheDocument();
  });

  // The connect command is not a secret -- only the token is. Before this, the
  // instructions lived inside the one-time panel and vanished on Done, leaving
  // anyone who returned later with no way to find them.
  it('shows the connect instructions without having to create a token', async () => {
    render(<McpTokensCard />);
    await screen.findByText('No tokens yet.');
    expect(screen.getByText('How to connect')).toBeInTheDocument();
    expect(screen.getByText(/npx -y confidence-picks-mcp/)).toBeInTheDocument();
    expect(screen.getByText(/<your token>/)).toBeInTheDocument();
  });

  it('covers both Claude Code and Codex', async () => {
    render(<McpTokensCard />);
    await screen.findByText('No tokens yet.');
    const block = screen.getByText(/npx -y confidence-picks-mcp/).textContent ?? '';
    expect(block).toMatch(/claude mcp add/);
    expect(block).toMatch(/codex mcp add/);
  });

  it('substitutes the real token into the commands right after minting', async () => {
    vi.mocked(createMcpToken).mockResolvedValue({
      token: token({ id: 7, name: 'CLI' }),
      plaintext: 'cp_live_realone',
    });
    render(<McpTokensCard />);
    await screen.findByText('No tokens yet.');
    fireEvent.change(screen.getByPlaceholderText('My laptop'), { target: { value: 'CLI' } });
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));
    const block = await screen.findByText(/CONFIDENCE_PICKS_TOKEN=cp_live_realone/);
    expect(block).toBeInTheDocument();
  });

  it('keeps the instructions after the one-time token panel is dismissed', async () => {
    vi.mocked(createMcpToken).mockResolvedValue({
      token: token({ id: 8, name: 'X' }),
      plaintext: 'cp_live_vanishes',
    });
    render(<McpTokensCard />);
    await screen.findByText('No tokens yet.');
    fireEvent.change(screen.getByPlaceholderText('My laptop'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^done$/i }));
    // The secret goes; the instructions stay.
    await waitFor(() => expect(screen.queryByTestId('fresh-token')).not.toBeInTheDocument());
    expect(screen.getByText('How to connect')).toBeInTheDocument();
    expect(screen.getByText(/<your token>/)).toBeInTheDocument();
  });

  it('tells the user the token can never delete or leave a group', async () => {
    render(<McpTokensCard />);
    expect(screen.getByText(/never delete a group, leave one/i)).toBeInTheDocument();
  });
});
