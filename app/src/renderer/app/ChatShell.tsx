import React, { useEffect } from 'react';
import { ChatProvider, useChat } from './state';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { Sidebar } from './Sidebar';

function ChatShellInner() {
  const { state, dispatch } = useChat();

  useEffect(() => {
    if (window.orca) {
      window.orca.backend.list().then((backends: any) => {
        if (backends.active) {
          dispatch({ type: 'SET_SESSION', sessionId: null, backend: backends.active });
        }
      });
    }
  }, [dispatch]);

  return (
    <div className="flex h-screen w-screen bg-cream-0 font-sans">
      <Sidebar />

      <main className="flex flex-1 flex-col min-w-0">
        <div className="border-b border-ink-300 px-6 py-3">
          <h1 className="font-serif text-xl font-semibold text-ink-900 m-0">
            {state.sessionId ? `Session ${state.sessionId.slice(0, 8)}` : 'New Chat'}
          </h1>
          <p className="text-xs text-ink-400 mt-0.5">
            {state.backend ? `${state.backend} · ${state.messages.length} messages` : 'No backend'}
          </p>
        </div>

        <MessageList />

        <Composer />
      </main>
    </div>
  );
}

export function App() {
  return (
    <ChatProvider>
      <ChatShellInner />
    </ChatProvider>
  );
}
