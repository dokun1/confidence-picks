import { useRef, useState } from 'react';
import Avatar from '../../designsystem/components/Avatar';
import Button from '../../designsystem/components/Button';
import EmptyState from '../../designsystem/components/EmptyState';
import TextField from '../../designsystem/components/TextField';
import AuthService from '../../lib/authService';
import { postMessage as apiPostMessage } from '../../lib/groupsService.js';
import type { GroupMessage } from '../../lib/groupsService';

export interface ChatTabProps {
  /** Group identifier, used to post and refetch messages. */
  identifier: string;
  /** Messages fetched on page mount; the body will own them from here. */
  initialMessages: GroupMessage[];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

/**
 * ChatTab renders the group message list. Messages are seeded from props and
 * owned in local state; the composer/Send form is added in the next sub-task.
 */
export default function ChatTab(props: ChatTabProps) {
  const [messages, setMessages] = useState<GroupMessage[]>(props.initialMessages);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic counter for synthetic temp ids — avoids the nondeterminism of
  // Date.now()/Math.random and collisions when messages.length shifts mid-post.
  const tempCounter = useRef(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setError(null);
    const tempId = `temp-${tempCounter.current++}`;
    // Best-effort author from the cached current user; content is the fallback.
    const user = AuthService.getUser();
    const optimistic: GroupMessage = {
      id: tempId,
      authorId: user ? String(user.id) : '',
      authorName: user?.name ?? trimmed,
      authorPictureUrl: user?.pictureUrl ?? null,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [optimistic, ...prev]);
    setText('');
    setPosting(true);
    try {
      const posted = await apiPostMessage(props.identifier, trimmed);
      // Re-sync: swap the temp entry for the server's canonical message.
      setMessages(prev => prev.map(msg => (msg.id === tempId ? posted : msg)));
    } catch (err) {
      // Roll back the optimistic entry and surface the failure near the form.
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setPosting(false);
    }
  }

  // Rendered bare (no card, no "Chat" heading): the active tab already names
  // the section, and the message log flows freely with the page instead of
  // scrolling inside a fixed-height box.
  return (
    <div>
      <div className='space-y-lg'>
        {messages.length === 0 ? (
          <EmptyState title='No messages yet' description='Start the conversation — say hi to your group.' />
        ) : (
          messages.map(msg => (
            <div key={msg.id} className='flex gap-md'>
              <Avatar name={msg.authorName} pictureUrl={msg.authorPictureUrl} />
              <div className='min-w-0 flex-1'>
                <div className='flex items-baseline gap-md'>
                  <span className='font-medium'>{msg.authorName}</span>
                  <span className='text-xs text-content-muted'>{formatDate(msg.createdAt)}</span>
                </div>
                <p className='whitespace-pre-wrap'>{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className='mt-lg flex items-start gap-sm'>
        <div className='flex-1'>
          <TextField
            value={text}
            onChange={setText}
            placeholder='Type your message...'
            disabled={posting}
          />
        </div>
        <Button
          type='submit'
          disabled={text.trim().length === 0 || posting}
          loading={posting}
        >
          Send
        </Button>
      </form>
      {error && <p className='mt-sm text-sm text-error-600 dark:text-error-400'>{error}</p>}
    </div>
  );
}
