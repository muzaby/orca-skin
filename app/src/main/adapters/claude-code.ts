import { execSync } from 'child_process';
import type { SessionAdapter, ChatEvent } from '../../shared/protocol';
import { logger } from '../utils/logger';

export class ClaudeCodeAdapter implements SessionAdapter {
  async isInstalled(): Promise<boolean> {
    try {
      const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
      execSync(cmd, { stdio: 'pipe' });
      logger.info('claude-code: installation check result=success');
      return true;
    } catch {
      logger.info('claude-code: installation check result=not-found');
      return false;
    }
  }

  async install(): Promise<void> {
    throw new Error('Claude Code auto-install not implemented in Phase 1');
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
      // TODO Phase 2: Implement sendMessage with NDJSON parsing.
      // - spawn: child_process.spawn('claude', [...args]) with --stream flag
      // - parse: listen to stdout NDJSON stream, emit ChatEvent for each line
      // - handle: tool_use, tool_result, delta, message events
      // Phase 1 stub expects NotImplementedError from adapter.
      throw new Error('Claude Code adapter not implemented in Phase 1');
      // eslint-disable-next-line no-unreachable
      yield {} as ChatEvent;
    })();
  }
}
