import { ipcMain, BrowserWindow } from 'electron';
import * as Protocol from '../../shared/protocol';

export class IpcRouter {
  constructor(private mainWindow: BrowserWindow) {}

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
      return { installed: [], active: null };
    });

    // Backend select
    ipcMain.handle('orca:backend:select', async (event, payload) => {
      const parsed = Protocol.BackendSelectSchema.safeParse(payload);
      if (!parsed.success) {
        return { error: 'validation failed' };
      }
      return { ok: true };
    });

    // Chat cancel
    ipcMain.handle('orca:chat:cancel', async () => {
      // Phase 1: No-op
      return { ok: true };
    });
  }
}
