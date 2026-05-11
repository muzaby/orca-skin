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

      // Phase 1: Mock response
      const sessionId = `session-${Date.now()}`;
      this.mainWindow.webContents.send('orca:chat:event', {
        type: 'init',
        sessionId,
        data: { model: 'claude-code', cwd: parsed.data.cwd },
      });

      // Simulate streaming response
      const responseText = '[Mock assistant response]';
      for (let i = 0; i < responseText.length; i++) {
        this.mainWindow.webContents.send('orca:chat:event', {
          type: 'assistant_delta',
          sessionId,
          data: { text: responseText[i] },
        });
      }

      this.mainWindow.webContents.send('orca:chat:event', {
        type: 'assistant_message',
        sessionId,
        data: { text: responseText },
      });

      this.mainWindow.webContents.send('orca:chat:event', {
        type: 'result',
        sessionId,
        data: { usage: { inputTokens: 100, outputTokens: 50 } },
      });

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
