import { ipcMain, app, type WebContents, type IpcMainInvokeEvent } from 'electron'
import {
  CHANNELS,
  SendChatMessageSchema,
  CancelChatSchema,
  StartInstallSchema,
  type BackendListResult,
  type ChatEvent,
  type InstallStatus,
  type Settings,
  type SkillInfo
} from '../../shared/protocol'
import { AdapterRegistry } from '../adapters/registry'
import { Installer } from '../installer'
import { SettingsStore } from '../settings/store'
import { scanSkills } from '../skills/scan'

interface InflightTurn {
  controller: AbortController
}

export class IpcRouter {
  private readonly registry = new AdapterRegistry()
  private readonly installer = new Installer(this.registry)
  private readonly inflight = new Map<WebContents, InflightTurn>()
  readonly settings = new SettingsStore()
  // 부팅 시 1회 스캔하여 메모리에 캐시. fs.watch hot-reload 는 본 PR 범위 밖 (재시작).
  private skillsCache: SkillInfo[] = []

  async start(): Promise<void> {
    await this.registry.refreshInstallState()
    // ClaudeCodeAdapter 가 사용하는 cwd 와 동일한 값(app.getPath('home')) 으로 스캔.
    this.skillsCache = await scanSkills(app.getPath('home')).catch(() => [])
    this.register()
  }

  private register(): void {
    ipcMain.handle(CHANNELS.chatSend, this.handleChatSend)
    ipcMain.handle(CHANNELS.chatCancel, this.handleChatCancel)
    ipcMain.handle(CHANNELS.backendList, this.handleBackendList)
    ipcMain.handle(CHANNELS.installStart, this.handleInstallStart)
    ipcMain.handle(CHANNELS.settingsGet, this.handleSettingsGet)
    ipcMain.handle(CHANNELS.settingsSet, this.handleSettingsSet)
    ipcMain.handle(CHANNELS.skillsList, this.handleSkillsList)
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

    // TODO(settings): app settings 도입 시 settings 기반 install 재확인.
    // 부팅 시 AdapterRegistry.refreshInstallState() 가 1회 캐시하며, renderer
    // 는 backend.list() 결과로 InstallerDialog 를 띄워 미설치 경로를 가드한다.

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

  private handleSettingsGet = async (): Promise<Settings> => {
    return this.settings.getAll()
  }

  private handleSettingsSet = async (
    _event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<Settings> => {
    return this.settings.patch(raw)
  }

  private handleSkillsList = async (): Promise<SkillInfo[]> => {
    return this.skillsCache
  }
}
