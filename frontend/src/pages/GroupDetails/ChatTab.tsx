import type { GroupMessage } from '../../lib/groupsService';

export interface ChatTabProps {
  /** Group identifier, used to post and refetch messages. */
  identifier: string;
  /** Messages fetched on page mount; the body will own them from here. */
  initialMessages: GroupMessage[];
}

/**
 * ChatTab renders the group message list plus a new-message TextField and Send
 * button. Body is deferred to the chat implementation task — this stub declares
 * the final prop contract so the page compiles.
 */
export default function ChatTab(props: ChatTabProps) {
  return (
    <div className='rounded-md border border-border bg-surface p-lg'>
      <h2 className='text-lg font-semibold'>Chat</h2>
      <p className='text-secondary'>Chat coming soon</p>
    </div>
  );
}
