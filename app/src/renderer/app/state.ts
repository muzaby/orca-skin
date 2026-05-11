import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface ToolCall {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'completed' | 'error';
  output?: string | Record<string, unknown>;
  isError?: boolean;
  durationMs?: number;
}

export interface ChatState {
  sessionId: string | null;
  backend: string | null;
  messages: Message[];
  toolCalls: Map<string, ToolCall>;
  pendingDelta: string;
  inflight: boolean;
  error: string | null;
}

export type ChatAction =
  | { type: 'SET_SESSION'; sessionId: string | null; backend: string }
  | { type: 'SEND_USER_MESSAGE'; text: string }
  | { type: 'RECV_DELTA'; text: string }
  | { type: 'RECV_MESSAGE'; message: Message }
  | { type: 'RECV_TOOL_USE'; toolUseId: string; name: string; input: Record<string, unknown> }
  | { type: 'RECV_TOOL_RESULT'; toolUseId: string; output: string | Record<string, unknown>; isError: boolean; durationMs?: number }
  | { type: 'NEW_CHAT' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_INFLIGHT'; inflight: boolean };

const initialState: ChatState = {
  sessionId: null,
  backend: null,
  messages: [],
  toolCalls: new Map(),
  pendingDelta: '',
  inflight: false,
  error: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, sessionId: action.sessionId, backend: action.backend };
    case 'SEND_USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, {
          id: Date.now().toString(),
          role: 'user',
          content: action.text,
          createdAt: Date.now(),
        }],
        inflight: true,
      };
    case 'RECV_DELTA':
      return { ...state, pendingDelta: state.pendingDelta + action.text };
    case 'RECV_MESSAGE':
      const msgs = [...state.messages];
      msgs.push(action.message);
      return { ...state, messages: msgs, pendingDelta: '', inflight: false };
    case 'RECV_TOOL_USE':
      const toolCalls = new Map(state.toolCalls);
      toolCalls.set(action.toolUseId, {
        toolUseId: action.toolUseId,
        name: action.name,
        input: action.input,
        status: 'pending',
      });
      return { ...state, toolCalls };
    case 'RECV_TOOL_RESULT':
      const updatedCalls = new Map(state.toolCalls);
      const call = updatedCalls.get(action.toolUseId);
      if (call) {
        updatedCalls.set(action.toolUseId, {
          ...call,
          status: action.isError ? 'error' : 'completed',
          output: action.output,
          isError: action.isError,
          durationMs: action.durationMs,
        });
      }
      return { ...state, toolCalls: updatedCalls };
    case 'NEW_CHAT':
      return { ...state, sessionId: null, messages: [], toolCalls: new Map(), pendingDelta: '', error: null };
    case 'SET_ERROR':
      return { ...state, error: action.error, inflight: false };
    case 'SET_INFLIGHT':
      return { ...state, inflight: action.inflight };
    default:
      return state;
  }
}

export const ChatContext = createContext<{
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
} | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  return React.createElement(
    ChatContext.Provider,
    { value: { state, dispatch } },
    children
  );
};

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
