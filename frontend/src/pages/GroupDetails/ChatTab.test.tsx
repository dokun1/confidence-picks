import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatTab from './ChatTab';
import type { GroupMessage } from '../../lib/groupsService';

// Mock the groups service so posting is controllable per test without touching
// the network or auth tokens.
vi.mock('../../lib/groupsService.js', () => ({ postMessage: vi.fn() }));

// Stub the cached current user so optimistic author metadata is deterministic
// (and distinct from the message content) instead of depending on localStorage.
vi.mock('../../lib/authService', () => ({
  default: {
    getUser: vi.fn(() => ({
      id: 42,
      name: 'Current User',
      pictureUrl: null,
    })),
  },
}));

import { postMessage } from '../../lib/groupsService.js';
const mockPostMessage = vi.mocked(postMessage);

const identifier = 'sunday-squad';

const initialMessages: GroupMessage[] = [
  {
    id: 'msg1',
    authorId: 'm1',
    authorName: 'Alice',
    authorPictureUrl: null,
    content: 'Welcome to the group!',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'msg2',
    authorId: 'm2',
    authorName: 'Bob',
    authorPictureUrl: null,
    content: 'Glad to be here.',
    createdAt: '2026-01-03T00:00:00.000Z',
  },
];

function renderChat(messages: GroupMessage[] = initialMessages) {
  return render(<ChatTab identifier={identifier} initialMessages={messages} />);
}

function getInput() {
  return screen.getByPlaceholderText('Type your message...');
}

describe('ChatTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each seeded message author and content from initialMessages', () => {
    renderChat();
    for (const msg of initialMessages) {
      expect(screen.getByText(msg.authorName)).toBeInTheDocument();
      expect(screen.getByText(msg.content)).toBeInTheDocument();
    }
  });

  it('disables the Send button when the input is empty', () => {
    renderChat();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('enables the Send button once the input has non-whitespace text', () => {
    renderChat();
    fireEvent.change(getInput(), { target: { value: 'Hello team' } });
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('calls postMessage and optimistically shows the new content immediately', async () => {
    // Hold the post open so we can assert the optimistic entry before it settles.
    let resolvePost!: (m: GroupMessage) => void;
    mockPostMessage.mockReturnValue(
      new Promise<GroupMessage>((resolve) => {
        resolvePost = resolve;
      })
    );

    renderChat();
    fireEvent.change(getInput(), { target: { value: 'Optimistic hello' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send' }).closest('form')!);

    expect(mockPostMessage).toHaveBeenCalledWith(identifier, 'Optimistic hello');
    // Optimistic entry is on screen before the promise resolves.
    expect(screen.getByText('Optimistic hello')).toBeInTheDocument();

    await act(async () => {
      resolvePost({
        id: 'server-1',
        authorId: '42',
        authorName: 'Current User',
        authorPictureUrl: null,
        content: 'Optimistic hello',
        createdAt: '2026-01-04T00:00:00.000Z',
      });
    });
  });

  it('replaces the temp entry with the resolved message from postMessage', async () => {
    mockPostMessage.mockResolvedValue({
      id: 'server-99',
      authorId: '42',
      authorName: 'Current User',
      authorPictureUrl: null,
      content: 'Server canonical message',
      createdAt: '2026-01-05T00:00:00.000Z',
    });

    renderChat();
    fireEvent.change(getInput(), { target: { value: 'temp content' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Send' }).closest('form')!);
    });

    // The server's canonical content renders...
    expect(await screen.findByText('Server canonical message')).toBeInTheDocument();
    // ...and the optimistic placeholder content is gone (temp entry swapped out).
    expect(screen.queryByText('temp content')).not.toBeInTheDocument();
  });

  it('rolls back the optimistic entry and shows an inline error when postMessage rejects', async () => {
    mockPostMessage.mockRejectedValue(new Error('Network down'));

    renderChat();
    fireEvent.change(getInput(), { target: { value: 'doomed message' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Send' }).closest('form')!);
    });

    // Inline error surfaces near the form.
    expect(await screen.findByText('Network down')).toBeInTheDocument();
    // Optimistic entry was removed on failure.
    await waitFor(() => {
      expect(screen.queryByText('doomed message')).not.toBeInTheDocument();
    });
  });
});
