import React from 'react';
import { useChat } from './state';
import { MarkdownRenderer } from './Markdown';
import { ToolCallCard } from './ToolCallCard';
import { i18n } from '../../shared/i18n/ko';

export function MessageList() {
  const { state } = useChat();
  const messagesRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [state.messages, state.pendingDelta]);

  return (
    <div className="flex-1 overflow-auto py-5 px-6 flex flex-col gap-[22px]" ref={messagesRef}>
      {state.messages.length === 0 && (
        <div className="text-center text-ink-400 pt-10">
          <p>{i18n.messageList.noMessages}</p>
        </div>
      )}

      {state.messages.map((msg) => (
        <React.Fragment key={msg.id}>
          <MessageBubble message={msg} />
          {msg.role === 'assistant' && state.toolCalls.size > 0 && (
            <div className="pl-10">
              {Array.from(state.toolCalls.values()).map((toolCall) => (
                <ToolCallCard key={toolCall.toolUseId} toolCall={toolCall} />
              ))}
            </div>
          )}
        </React.Fragment>
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
        <div className="text-xs text-ink-400">{i18n.messageList.waiting}</div>
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
          {isUser ? i18n.messageList.you : i18n.messageList.claude}
          {isPending && (
            <span className="text-xs text-ink-400 font-normal ml-1.5">
              {i18n.messageList.responding}
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
