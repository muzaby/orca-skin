import { ipcMain, BrowserWindow } from 'electron';
import * as Protocol from '../../shared/protocol';
import type { AdapterRegistry } from '../adapters/registry';
import { logger } from '../utils/logger';

export class IpcRouter {
  constructor(private mainWindow: BrowserWindow, private registry: AdapterRegistry) {}

  init(): void {
    // Chat send
    ipcMain.handle('orca:chat:send', async (event, payload) => {
      const parsed = Protocol.ChatSendSchema.safeParse(payload);
      if (!parsed.success) {
        return { error: 'validation failed', details: parsed.error.errors };
      }

      const startTime = Date.now();
      const sessionId = parsed.data.sessionId || 'unknown';
      logger.info(`orca:chat:send [${sessionId}] text.length=${parsed.data.text.length}`);

      const activeBackend = this.registry.getActive();
      if (!activeBackend) {
        logger.warn(`orca:chat:send [${sessionId}] no backend available`);
        this.mainWindow.webContents.send('orca:chat:event', {
          type: 'error',
          sessionId: 'unknown',
          data: { code: 'cli.not-installed', message: 'No backend available', recoverable: true },
        });
        return { ok: true };
      }

      const adapter = this.registry.getAdapter(activeBackend);
      if (!adapter) {
        logger.error(`orca:chat:send [${sessionId}] adapter not found`);
        this.mainWindow.webContents.send('orca:chat:event', {
          type: 'error',
          sessionId: 'unknown',
          data: { code: 'internal', message: 'Adapter not found', recoverable: false },
        });
        return { ok: true };
      }

      try {
        for await (const evt of adapter.sendMessage(
          parsed.data.sessionId,
          parsed.data.text,
          parsed.data.cwd,
        )) {
          logger.debug(`orca:chat:send [${sessionId}] eventType=${evt.type}`);
          this.mainWindow.webContents.send('orca:chat:event', evt);
        }
        const latencyMs = Date.now() - startTime;
        logger.info(`orca:chat:send [${sessionId}] completed latencyMs=${latencyMs}`);
      } catch (err) {
        const latencyMs = Date.now() - startTime;
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`orca:chat:send [${sessionId}] error=${message} latencyMs=${latencyMs}`);
        this.mainWindow.webContents.send('orca:chat:event', {
          type: 'error',
          sessionId: parsed.data.sessionId || 'unknown',
          data: { code: 'internal', message, recoverable: false },
        });
      }

      return { ok: true };
    });

    // Backend list
    ipcMain.handle('orca:backend:list', async () => {
      const installed = await this.registry.detectInstalledBackends();
      return {
        installed,
        active: this.registry.getActive(),
      };
    });

    // Backend select
    ipcMain.handle('orca:backend:select', async (event, payload) => {
      const parsed = Protocol.BackendSelectSchema.safeParse(payload);
      if (!parsed.success) {
        return { error: 'validation failed' };
      }
      this.registry.setActive(parsed.data.backend);
      return { ok: true };
    });

    // Chat cancel
    ipcMain.handle('orca:chat:cancel', async () => {
      // Phase 1: No-op
      return { ok: true };
    });

    // Log send (from renderer)
    ipcMain.handle('orca:log:send', async (event, payload) => {
      const { level, msg } = payload;
      if (level && msg && typeof logger[level as keyof typeof logger] === 'function') {
        logger[level as keyof typeof logger](msg);
      }
      return { ok: true };
    });
  }
}
