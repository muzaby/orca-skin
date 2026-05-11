import React, { useState } from 'react';
import { useChat } from './state';
import { i18n } from '../../shared/i18n/ko';

export function Composer() {
  const { state, dispatch } = useChat();
  const [text, setText] = useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!text.trim() || state.inflight) return;

    const trimmed = text.trim();
    setText('');

    dispatch({ type: 'SEND_USER_MESSAGE', text: trimmed });

    if (window.orca) {
      try {
        const cwd = '/home/user';
        await window.orca.chat.send({
          sessionId: state.sessionId,
          text: trimmed,
          cwd,
        });

        window.orca.chat.onEvent((event: any) => {
          if (event.type === 'init') {
            dispatch({
              type: 'SET_SESSION',
              sessionId: event.sessionId,
              backend: event.data.model,
            });
          } else if (event.type === 'assistant_delta') {
            dispatch({ type: 'RECV_DELTA', text: event.data.text });
          } else if (event.type === 'assistant_message') {
            dispatch({
              type: 'RECV_MESSAGE',
              message: {
                id: Date.now().toString(),
                role: 'assistant',
                content: event.data.text,
                createdAt: Date.now(),
              },
            });
          } else if (event.type === 'tool_use') {
            dispatch({
              type: 'RECV_TOOL_USE',
              toolUseId: event.data.toolUseId,
              name: event.data.name,
              input: event.data.input,
            });
          } else if (event.type === 'tool_result') {
            dispatch({
              type: 'RECV_TOOL_RESULT',
              toolUseId: event.data.toolUseId,
              output: event.data.output,
              isError: event.data.isError || false,
              durationMs: event.data.durationMs,
            });
          } else if (event.type === 'error') {
            dispatch({ type: 'SET_ERROR', error: event.data.message });
          }
        });
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-ink-300 px-6 py-3">
      <div className="bg-white border border-ink-300 rounded-[14px] p-3 shadow-sm">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={i18n.composer.placeholder}
          className="w-full border-0 outline-none font-sans text-base bg-transparent resize-none p-1"
          style={{ minHeight: '36px' }}
        />
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={handleSend}
            disabled={state.inflight || !text.trim()}
            className="w-7 h-7 rounded bg-rust-400 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rust-500"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
