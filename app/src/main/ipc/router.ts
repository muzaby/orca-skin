import { ipcMain, app, type WebContents, type IpcMainInvokeEvent } from 'electron'
import {
  CHANNELS,
  SendChatMessageSchema,
  CancelChatSchema,
  StartInstallSchema,
  type BackendListResult,
  type ChatEvent,
  type InstallStatus
} from '../../shared/protocol'
import { AdapterRegistry } from '../adapters/registry'
import { Installer } from '../installer'

interface InflightTurn {
  controller: AbortController
}

export class IpcRouter {
  private readonly registry = new AdapterRegistry()
  private readonly installer = new Installer(this.registry)
  private readonly inflight = new Map<WebContents, InflightTurn>()

  async start(): Promise<void> {
    await this.registry.refreshInstallState()
    this.register()
  }

  private register(): void {
    ipcMain.handle(CHANNELS.chatSend, this.handleChatSend)
    ipcMain.handle(CHANNELS.chatCancel, this.handleChatCancel)
    ipcMain.handle(CHANNELS.backendList, this.handleBackendList)
    ipcMain.handle(CHANNELS.installStart, this.handleInstallStart)
  }

  private sendChatEvent(wc: WebContents, ev: ChatEvent): void {
    if (!wc.isDestroyed()) wc.send(CHANNELS.chatEvent, ev)
  }

  private sendInstallStatus(wc: WebContents, st: InstallStatus): void {
    if (!wc.isDestroyed()) wc.send(CHANNELS.installStatus, st)
  }

  private handleChatSend = async (event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = SendChatMessageSchema.safeParse(raw)
    if (!parsed.success) {
      this.sendChatEvent(event.sender, {
        type: 'error',
        data: {
          code: 'internal',
          message: 'invalid chat:send payload',
          recoverable: false
        }
      })
      return
    }

    const adapter = this.registry.getActive()
    if (!adapter) {
      this.sendChatEvent(event.sender, {
        type: 'error',
        data: {
          code: 'cli.not-installed',
          message: '활성 백엔드가 없습니다.',
          recoverable: true
        }
      })
      return
    }

    const info = await adapter.isInstalled()
    if (!info.installed) {
      this.sendChatEvent(event.sender, {
        type: 'error',
        data: {
          code: 'cli.not-installed',
          message: 'Claude Code CLI 가 설치되어 있지 않습니다.',
          recoverable: true
        }
      })
      return
    }

    const controller = new AbortController()
    this.inflight.set(event.sender, { controller })

    const cwd = app.getPath('home')
    try {
      for await (const ev of adapter.sendMessage(
        parsed.data.sessionId,
        parsed.data.text,
        cwd,
        controller.signal
      )) {
        this.sendChatEvent(event.sender, ev)
      }
    } catch (err) {
      this.sendChatEvent(event.sender, {
        type: 'error',
        data: {
          code: 'internal',
          message: err instanceof Error ? err.message : String(err),
          recoverable: false
        }
      })
    } finally {
      this.inflight.delete(event.sender)
    }
  }

  private handleChatCancel = async (event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    CancelChatSchema.parse(raw)
    const turn = this.inflight.get(event.sender)
    if (turn) turn.controller.abort()
  }

  private handleBackendList = async (): Promise<BackendListResult> => {
    const backends = this.registry.list()
    const active = this.registry.getActiveId() ?? undefined
    return { backends, ...(active ? { active } : {}) }
  }

  private handleInstallStart = async (event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = StartInstallSchema.parse(raw)
    for await (const st of this.installer.start(parsed.backend)) {
      this.sendInstallStatus(event.sender, st)
    }
  }
}
