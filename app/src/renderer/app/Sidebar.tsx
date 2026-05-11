import React from 'react';
import { useChat } from './state';
import { i18n } from '../../shared/i18n/ko';

export function Sidebar() {
  const { state, dispatch } = useChat();

  const handleNewChat = () => {
    dispatch({ type: 'NEW_CHAT' });
  };

  return (
    <aside className="w-62 bg-cream-100 border-r border-ink-300 flex flex-col p-3">
      <button
        onClick={handleNewChat}
        className="w-full px-2.5 py-2 border border-ink-300 bg-white rounded-lg text-ink-900 font-medium text-sm hover:bg-cream-50"
      >
        {i18n.sidebar.newChat}
      </button>

      <div className="mt-5 pl-2.5 text-xs text-ink-400">
        <p>{i18n.sidebar.activeBackend}</p>
        {state.backend ? (
          <p className="font-semibold text-ink-900">{state.backend}</p>
        ) : (
          <p className="text-ink-600">{i18n.sidebar.noBackend}</p>
        )}
      </div>
    </aside>
  );
}
