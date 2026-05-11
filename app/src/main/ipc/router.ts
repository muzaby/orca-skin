import { ipcMain, BrowserWindow } from 'electron';
import * as Protocol from '../../shared/protocol';
import type { AdapterRegistry } from '../adapters/registry';

export class IpcRouter {
  constructor(private mainWindow: BrowserWindow, private registry: AdapterRegistry) {}

  init(): void {
    // Chat send
    ipcMain.handle('orca:chat:send', async (event, payload) => {
      const parsed = Protocol.ChatSendSchema.safeParse(payload);
      if (!parsed.success) {
        return { error: 'validation failed', details: parsed.error.errors };
      }

      const activeBackend = this.registry.getActive();
      if (!activeBackend) {
        this.mainWindow.webContents.send('orca:chat:event', {
          type: 'error',
          sessionId: 'unknown',
          data: { code: 'cli.not-installed', message: 'No backend available', recoverable: true },
        });
        return { ok: true };
      }

      const adapter = this.registry.getAdapter(activeBackend);
      if (!adapter) {
        this.mainWindow.webContents.send('orca:chat:event', {
          type: 'error',
          sessionId: 'unknown',
          data: { code: 'internal', message: 'Adapter not found', recoverable: false },
        });
        return { ok: true };
      }

      try {
        for await (const event of adapter.sendMessage(
          parsed.data.sessionId,
          parsed.data.text,
          parsed.data.cwd,
        )) {
          this.mainWindow.webContents.send('orca:chat:event', event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
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
  }
}
