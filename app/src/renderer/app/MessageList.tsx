import React from 'react';
import { useChat } from './state';
import { MarkdownRenderer } from './Markdown';

export function MessageList() {
  const { state } = useChat();
  const messagesRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [state.messages, state.pendingDelta]);

  return (
    <div className="flex-1 overflow-auto p-5 flex flex-col gap-5">
      {state.messages.length === 0 && (
        <div className="text-center text-ink-400 pt-10">
          <p>No messages yet. Start a new conversation.</p>
        </div>
      )}

      {state.messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {state.pendingDelta && (
        <MessageBubble
          message={{
            id: 'pending',
            role: 'assistant',
            content: state.pendingDelta,
            createdAt: Date.now(),
          }}
          isPending
        />
      )}

      {state.inflight && !state.pendingDelta && (
        <div className="text-xs text-ink-400">Waiting for response...</div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  isPending = false,
}: {
  message: any;
  isPending?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isPending ? 'opacity-70' : ''}`}>
      <div
        className={`w-7 h-7 rounded flex items-center justify-center font-semibold text-xs flex-shrink-0 ${
          isUser
            ? 'bg-blue-100 text-blue-600'
            : 'bg-rust-50 text-rust-400'
        }`}
      >
        {isUser ? 'U' : 'C'}
      </div>

      <div className="flex-1 pt-0.5">
        <div className="font-semibold text-sm text-ink-900 mb-1">
          {isUser ? 'You' : 'Claude'}
          {isPending && (
            <span className="text-xs text-ink-400 font-normal ml-1.5">
              responding...
            </span>
          )}
        </div>

        <div className="text-md text-ink-900">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}
