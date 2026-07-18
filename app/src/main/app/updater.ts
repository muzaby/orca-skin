import { createRequire } from 'node:module'
import { app } from 'electron'
import { canRestartForUpdate, type RestartGateState } from '../../shared/update-restart'
import type {
  UpdateCheckResult,
  UpdateInstallResult,
  UpdateProgress,
  UpdateState
} from '../../shared/ipc'
import { getOrcaConfig } from '../infra/config/orca-config'
import { broadcastUpdateProgress, broadcastUpdateState } from '../infra/ipc/send'
import { errorMessage } from '../infra/errors'
import { getLogger } from '../infra/log'

const INSTALL_BLOCK_REASON = '작업이 진행 중입니다 — 끝난 뒤 다시 시도하세요.'

export interface AutoUpdaterPort {
  autoDownload: boolean
  autoInstallOnAppQuit?: boolean
  on(event: string, listener: (...args: unknown[]) => void): this
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
  setFeedURL?(options: unknown): void
}
export interface UpdateControllerDeps {
  updater: AutoUpdaterPort
  restartGateState: () => RestartGateState
  prepareForUpdateInstall: () => void
}
export function computeUpdateInstallGate(state: RestartGateState): {
  canInstall: boolean
  reason?: string
} {
  return canRestartForUpdate(state)
    ? { canInstall: true }
    : { canInstall: false, reason: INSTALL_BLOCK_REASON }
}
function clampPercent(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(100, n))
}
export function normalizeReleaseNotes(value: unknown): string | null {
  if (typeof value === 'string') return value.slice(0, 8000)
  if (Array.isArray(value)) {
    const text = value
      .map((item) =>
        typeof item === 'string'
          ? item
          : item && typeof item === 'object' && 'note' in item
            ? String(item.note)
            : ''
      )
      .filter(Boolean)
      .join('\n\n')
    return text ? text.slice(0, 8000) : null
  }
  return null
}
function normalizeProgress(value: unknown): UpdateProgress {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    percent: clampPercent(v.percent),
    ...(typeof v.transferred === 'number' && v.transferred >= 0
      ? { transferred: v.transferred }
      : {}),
    ...(typeof v.total === 'number' && v.total >= 0 ? { total: v.total } : {}),
    ...(typeof v.bytesPerSecond === 'number' && v.bytesPerSecond >= 0
      ? { bytesPerSecond: v.bytesPerSecond }
      : {})
  }
}
function readVersion(info: unknown): string | undefined {
  if (!info || typeof info !== 'object') return undefined
  const value = (info as Record<string, unknown>).version
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
function readReleaseNotes(info: unknown): string | null {
  if (!info || typeof info !== 'object') return null
  return normalizeReleaseNotes((info as Record<string, unknown>).releaseNotes)
}

export class UpdateController {
  private state: UpdateState
  private installPending = false
  private readonly disabled: boolean
  // 생성 시점 캡처 — UpdateController 는 initLog 이후(컴포지션 루트)에서만 생성된다.
  private readonly log = getLogger().child('updater')
  constructor(private readonly deps: UpdateControllerDeps) {
    deps.updater.autoDownload = false
    deps.updater.autoInstallOnAppQuit = false
    const gate = computeUpdateInstallGate(deps.restartGateState())
    this.state = {
      status: 'idle',
      currentVersion: app.getVersion(),
      canInstall: gate.canInstall,
      ...(gate.reason ? { installBlockReason: gate.reason } : {})
    }
    this.disabled = this.configureFeed()
    this.registerEvents()
  }
  getState(): UpdateState {
    return {
      ...this.state,
      ...(this.state.progress ? { progress: { ...this.state.progress } } : {})
    }
  }
  isInstallPending(): boolean {
    return this.installPending
  }
  refreshGate(): void {
    // patch() 가 게이트를 재계산·반영·broadcast 하므로 빈 패치면 충분(중복 계산 제거).
    this.patch({})
  }
  async check(startup: boolean): Promise<UpdateCheckResult> {
    if (this.disabled || !app.isPackaged) {
      if (!startup) this.patch({ status: 'idle', error: undefined })
      return { ok: false, reason: 'feed-not-configured', state: this.getState() }
    }
    if (['checking', 'downloading', 'installing'].includes(this.state.status))
      return { ok: true, state: this.getState() }
    this.patch({ status: 'checking', error: undefined, checkedAt: Date.now() })
    // 업데이트 확인 경계(0124 카탈로그) — 현재/대상 버전만 기록.
    this.log.info('update.check.started', { currentVersion: this.state.currentVersion })
    try {
      await this.deps.updater.checkForUpdates()
      this.log.info('update.check.completed', {
        currentVersion: this.state.currentVersion,
        ...(this.state.availableVersion ? { availableVersion: this.state.availableVersion } : {}),
        available: this.state.status !== 'idle'
      })
      return {
        ok: this.state.status !== 'idle',
        ...(this.state.status === 'idle' ? { reason: 'not-available' as const } : {}),
        state: this.getState()
      }
    } catch (err) {
      const message = errorMessage(err)
      this.log.warn('update.check.failed', { message })
      this.patch(
        startup
          ? { status: 'idle', lastError: message }
          : { status: 'error', error: message, lastError: message }
      )
      return { ok: false, reason: 'check-failed', state: this.getState() }
    }
  }
  async download(): Promise<UpdateCheckResult> {
    if (this.state.status === 'downloading') return { ok: true, state: this.getState() }
    if (this.state.status !== 'available')
      return { ok: false, reason: 'download-failed', state: this.getState() }
    this.patch({ status: 'downloading', progress: { percent: 0 }, error: undefined })
    this.log.info('update.download.started', {
      ...(this.state.availableVersion ? { availableVersion: this.state.availableVersion } : {})
    })
    try {
      await this.deps.updater.downloadUpdate()
      this.log.info('update.download.completed', {
        ...(this.state.availableVersion ? { availableVersion: this.state.availableVersion } : {})
      })
      return { ok: true, state: this.getState() }
    } catch (err) {
      const message = errorMessage(err)
      this.log.error('update.download.failed', err)
      this.patch({ status: 'error', error: message, lastError: message })
      return { ok: false, reason: 'download-failed', state: this.getState() }
    }
  }
  async quitAndInstall(): Promise<UpdateInstallResult> {
    if (this.state.status !== 'ready')
      return { ok: false, reason: 'not-ready', message: '업데이트 다운로드가 완료되지 않았습니다.' }
    const before = computeUpdateInstallGate(this.deps.restartGateState())
    if (!before.canInstall) {
      this.patch({ canInstall: false, installBlockReason: before.reason })
      return { ok: false, reason: 'not-idle', message: before.reason }
    }
    this.installPending = true
    this.log.info('update.install.started', {
      ...(this.state.availableVersion ? { availableVersion: this.state.availableVersion } : {})
    })
    try {
      this.deps.prepareForUpdateInstall()
      const after = computeUpdateInstallGate(this.deps.restartGateState())
      if (!after.canInstall) {
        this.installPending = false
        this.patch({ canInstall: false, installBlockReason: after.reason })
        return { ok: false, reason: 'not-idle', message: after.reason }
      }
      this.patch({ status: 'installing', canInstall: true, installBlockReason: undefined })
      this.deps.updater.quitAndInstall(false, true)
      // quitAndInstall 이후는 프로세스 종료 경로 — update.install.completed 는 재시작 후
      // app.start.completed(새 버전 공통 필드)가 대신 증명한다.
      return { ok: true }
    } catch (err) {
      this.installPending = false
      const message = errorMessage(err)
      this.log.error('update.install.failed', err)
      this.patch({ status: 'error', error: message, lastError: message })
      return { ok: false, reason: 'internal-error', message }
    }
  }
  private configureFeed(): boolean {
    const update = getOrcaConfig().update
    if (update?.enabled === false) return true
    if (!update) return false
    if (update.provider === 'github')
      this.deps.updater.setFeedURL?.({
        provider: 'github',
        owner: update.owner,
        repo: update.repo,
        channel: update.channel
      })
    else if (update.provider === 'generic')
      this.deps.updater.setFeedURL?.({
        provider: 'generic',
        url: update.url,
        channel: update.channel
      })
    return false
  }
  private registerEvents(): void {
    this.deps.updater.on('checking-for-update', () =>
      this.patch({ status: 'checking', checkedAt: Date.now(), error: undefined })
    )
    this.deps.updater.on('update-available', (info) =>
      this.patch({
        status: 'available',
        availableVersion: readVersion(info),
        releaseNotes: readReleaseNotes(info),
        checkedAt: Date.now(),
        error: undefined
      })
    )
    this.deps.updater.on('update-not-available', () =>
      this.patch({ status: 'idle', checkedAt: Date.now(), error: undefined })
    )
    this.deps.updater.on('download-progress', (progress) => {
      const normalized = normalizeProgress(progress)
      this.patch({ status: 'downloading', progress: normalized })
      broadcastUpdateProgress(normalized)
    })
    this.deps.updater.on('update-downloaded', (info) =>
      this.patch({
        status: 'ready',
        availableVersion: readVersion(info) ?? this.state.availableVersion,
        releaseNotes: readReleaseNotes(info) ?? this.state.releaseNotes,
        progress: { percent: 100 }
      })
    )
    this.deps.updater.on('error', (err) => {
      const message = errorMessage(err)
      this.patch({ status: 'error', error: message, lastError: message })
    })
  }
  private patch(patch: Partial<UpdateState>): void {
    const gate = computeUpdateInstallGate(this.deps.restartGateState())
    this.state = {
      ...this.state,
      ...patch,
      canInstall: patch.canInstall ?? gate.canInstall,
      installBlockReason:
        patch.installBlockReason ?? (patch.canInstall === true ? undefined : gate.reason)
    }
    broadcastUpdateState(this.getState())
  }
}
export function loadElectronAutoUpdater(): AutoUpdaterPort | null {
  try {
    const require = createRequire(import.meta.url)
    const mod = require('electron-updater') as { autoUpdater?: AutoUpdaterPort }
    return mod.autoUpdater ?? null
  } catch (err) {
    getLogger()
      .child('updater')
      .warn('update.loader.failed', {
        message: String(err),
        reason: 'electron-updater unavailable — updates disabled'
      })
    return null
  }
}
export function createNoopUpdater(): AutoUpdaterPort {
  return {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on() {
      return this
    },
    async checkForUpdates() {
      return undefined
    },
    async downloadUpdate() {
      return undefined
    },
    quitAndInstall() {
      return undefined
    },
    setFeedURL() {
      return undefined
    }
  }
}
