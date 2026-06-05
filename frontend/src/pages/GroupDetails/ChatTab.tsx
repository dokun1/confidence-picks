import { useState } from 'react';
import Avatar from '../../designsystem/components/Avatar';
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

  return (
    <div className='rounded-md border border-border bg-surface p-lg'>
      <h2 className='text-lg font-semibold mb-lg'>Chat</h2>
      <div className='max-h-96 overflow-y-auto space-y-lg'>
        {messages.length === 0 ? (
          <p className='text-secondary'>No messages yet.</p>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className='flex gap-md'>
              <Avatar name={msg.authorName} pictureUrl={msg.authorPictureUrl} />
              <div className='min-w-0 flex-1'>
                <div className='flex items-baseline gap-md'>
                  <span className='font-medium'>{msg.authorName}</span>
                  <span className='text-xs text-secondary'>{formatDate(msg.createdAt)}</span>
                </div>
                <p className='whitespace-pre-wrap'>{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
