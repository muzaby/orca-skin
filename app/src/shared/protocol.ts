import { z } from 'zod';

export type Backend = 'claude-code' | 'opencode';

export interface ChatEvent {
  type: 'init' | 'assistant_delta' | 'assistant_message'
      | 'tool_use' | 'tool_result' | 'result' | 'error';
  sessionId: string;
  data: unknown;
}

export interface SessionAdapter {
  isInstalled(): Promise<boolean>;
  install(): Promise<void>;
  sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
  ): AsyncIterable<ChatEvent>;
  listSessions?(): Promise<SessionInfo[]>;
  loadSession?(id: string): Promise<ChatEvent[]>;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  title?: string;
  cwd: string;
  backend: Backend;
}

// IPC Schemas
export const ChatSendSchema = z.object({
  sessionId: z.string().nullable(),
  text: z.string().min(1),
  cwd: z.string(),
});

export const BackendListSchema = z.object({
  installed: z.array(z.enum(['claude-code', 'opencode'])),
  active: z.enum(['claude-code', 'opencode']).nullable(),
});

export const BackendSelectSchema = z.object({
  backend: z.enum(['claude-code', 'opencode']),
});

export type ChatSend = z.infer<typeof ChatSendSchema>;
export type BackendList = z.infer<typeof BackendListSchema>;
export type BackendSelect = z.infer<typeof BackendSelectSchema>;
