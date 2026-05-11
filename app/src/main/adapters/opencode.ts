import { execSync } from 'child_process';
import type { SessionAdapter, ChatEvent } from '../../shared/protocol';

export class OpencodeAdapter implements SessionAdapter {
  async isInstalled(): Promise<boolean> {
    try {
      const cmd = process.platform === 'win32' ? 'where opencode' : 'which opencode';
      execSync(cmd, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  async install(): Promise<void> {
    throw new Error('Opencode auto-install not implemented in Phase 1');
  }

  sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
  ): AsyncIterable<ChatEvent> {
    void sessionId;
    void text;
    void cwd;
    return (async function* (): AsyncIterable<ChatEvent> {
      // TODO Phase 2: Implement sendMessage with SSE parsing.
      // - fetch: POST to opencode-server /chat with sessionId, text
      // - stream: listen to response.body as Server-Sent Events (SSE)
      // - parse: JSON data in SSE messages as ChatEvent
      // - handle: tool_use, tool_result, delta, message events
      throw new Error('Opencode adapter not implemented in Phase 1');
      // eslint-disable-next-line no-unreachable
      yield {} as ChatEvent;
    })();
  }

  async listSessions(): Promise<any[]> {
    // TODO Phase 2/3: Implement session listing.
    // - fetch: GET from opencode-server /sessions
    // - parse: JSON array of session objects
    // - return: SessionInfo[] with id, createdAt, title, cwd, backend
    throw new Error('Opencode session listing not implemented');
  }

  async loadSession(id: string): Promise<ChatEvent[]> {
    void id;
    // TODO Phase 2/3: Implement session loading.
    // - fetch: GET from opencode-server /sessions/{id}/transcript
    // - parse: JSON array of ChatEvent objects from server
    // - return: ChatEvent[] array for the session
    throw new Error('Opencode session loading not implemented');
  }
}
