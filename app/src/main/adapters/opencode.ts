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
      throw new Error('Opencode adapter not implemented in Phase 1');
      // eslint-disable-next-line no-unreachable
      yield {} as ChatEvent;
    })();
  }
}
