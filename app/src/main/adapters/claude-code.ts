import { execSync, spawn } from 'child_process';
import type { SessionAdapter, ChatEvent } from '../../shared/protocol';
import { logger } from '../utils/logger';
import type { Readable } from 'stream';

function normalizeChatEvent(event: any, sessionIdEmitted: boolean): ChatEvent | null {
  // Handle init/system event (first response)
  if ((event.type === 'init' || event.system === 'init') && !sessionIdEmitted) {
    const sessionId = event.session_id || event.sessionId || 'unknown';
    const model = event.model || 'claude-code';
    const cwd = event.cwd || '/';
    return {
      type: 'init',
      sessionId,
      data: { sessionId, model, cwd },
    };
  }

  // Normalize standard events
  const sessionId = event.session_id || event.sessionId || 'unknown';

  if (event.type === 'delta' || event.type === 'assistant_delta') {
    return {
      type: 'assistant_delta',
      sessionId,
      data: { text: event.text || event.delta || '' },
    };
  }

  if (event.type === 'message' || event.type === 'assistant_message') {
    return {
      type: 'assistant_message',
      sessionId,
      data: { text: event.text || event.message || '' },
    };
  }

  if (event.type === 'tool_use') {
    return {
      type: 'tool_use',
      sessionId,
      data: {
        toolUseId: event.id || event.tool_use_id || 'unknown',
        name: event.name || 'unknown',
        input: event.input || {},
      },
    };
  }

  if (event.type === 'tool_result') {
    return {
      type: 'tool_result',
      sessionId,
      data: {
        toolUseId: event.id || event.tool_use_id || 'unknown',
        output: event.output || '',
        isError: event.is_error || event.error || false,
        durationMs: event.duration_ms || 0,
      },
    };
  }

  if (event.type === 'error') {
    return {
      type: 'error',
      sessionId,
      data: {
        code: event.code || 'internal',
        message: event.message || 'Unknown error',
        recoverable: event.recoverable ?? false,
      },
    };
  }

  // Ignore unknown event types
  return null;
}

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
    return (async function* (): AsyncIterable<ChatEvent> {
      const args = ['-p', text, '--output-format', 'stream-json'];
      if (sessionId) {
        args.push('--resume', sessionId);
      }

      logger.info(`claude-code: spawning with args=${JSON.stringify(args)}`);

      const child = spawn('claude', args, {
        cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let buffer = '';
      let sessionIdEmitted = false;

      // Handle stdout stream (NDJSON)
      if (child.stdout) {
        child.stdout.setEncoding('utf-8');

        for await (const chunk of child.stdout) {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const event = JSON.parse(line);
              logger.debug(`claude-code: parsed event type=${event.type || event.system}`);

              const normalized = normalizeChatEvent(event, sessionIdEmitted);
              if (normalized) {
                if (normalized.type === 'init') {
                  sessionIdEmitted = true;
                }
                yield normalized;
              }
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'unknown';
              logger.error(`claude-code: parse error: ${errMsg} (line=${line.slice(0, 50)}...)`);
              yield {
                type: 'error',
                sessionId: sessionId || 'unknown',
                data: {
                  code: 'protocol.parse',
                  message: `Failed to parse NDJSON: ${errMsg}`,
                  recoverable: false,
                },
              };
            }
          }
        }

        // Handle remaining buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer);
            const normalized = normalizeChatEvent(event, sessionIdEmitted);
            if (normalized) {
              yield normalized;
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'unknown';
            logger.error(`claude-code: final parse error: ${errMsg}`);
          }
        }
      }

      // Wait for process to exit
      const exitCode = await new Promise<number>((resolve) => {
        child.on('exit', (code) => {
          resolve(code ?? 1);
        });
      });

      if (exitCode !== 0) {
        logger.warn(`claude-code: process exited with code=${exitCode}`);
        yield {
          type: 'error',
          sessionId: sessionId || 'unknown',
          data: {
            code: 'cli.crashed',
            message: `Claude Code process exited with code ${exitCode}`,
            recoverable: true,
          },
        };
      }
    })();
  }

  private async onStderr(
    stderr: Readable,
    sessionId: string | null,
  ): Promise<ChatEvent | null> {
    // Check for auth errors on stderr
    let content = '';
    for await (const chunk of stderr) {
      content += chunk;
      if (content.includes('401') || content.includes('OAuth') || content.includes('expired')) {
        logger.error('claude-code: OAuth/auth error detected');
        return {
          type: 'error',
          sessionId: sessionId || 'unknown',
          data: {
            code: 'auth.expired',
            message: 'Authentication expired. Please run `claude /login` in terminal.',
            recoverable: true,
          },
        };
      }
    }
    return null;
  }

  async listSessions(): Promise<any[]> {
    // TODO Phase 2/3: Implement session listing.
    // - spawn: child_process.spawn('claude', ['--list', 'sessions'])
    // - parse: JSON output listing available sessions
    // - return: SessionInfo[] with id, createdAt, title, cwd, backend
    throw new Error('Claude Code session listing not implemented');
  }

  async loadSession(id: string): Promise<ChatEvent[]> {
    void id;
    // TODO Phase 2/3: Implement session loading.
    // - load: transcript from ~/.claude-code/sessions/{id}/transcript.ndjson
    // - parse: NDJSON lines as ChatEvent objects
    // - return: ChatEvent[] array for the session
    throw new Error('Claude Code session loading not implemented');
  }
}
