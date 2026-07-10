import {
  CHANNELS,
  CreateEngineSchema,
  DeleteEngineSchema,
  ReadEngineSchema,
  UpdateEngineSchema,
  type EngineReadResult,
  type EngineUserSettingsResult,
  type EngineWriteResult
} from '../../../shared/protocol'
import { readUserClaudeSettings } from '../../adapters/claude-settings'
import { deploy } from '../../features/extensions/deployer'
import {
  addProviderSettings,
  deleteProviderSettings,
  readProviderSettings,
  updateProviderSettings
} from '../../features/providers/engine-write'
import type { RouterContext } from '../context'
import { handle, handlePlain } from '../../infra/ipc/handle'

function refreshProviderSettings(ctx: RouterContext): void {
  try {
    const result = deploy('claude')
    if (!result.validation.ok) {
      for (const err of result.validation.errors) console.warn('[engine] deploy 검증 경고:', err)
    }
  } finally {
    ctx.providerSettings.invalidateAll()
  }
}

export function registerEngineHandlers(ctx: RouterContext): void {
  handle(CHANNELS.engineAdd, CreateEngineSchema, 'reject', (req): EngineWriteResult => {
    const result = addProviderSettings(req.engine, req.provider, req.settingsJson)
    refreshProviderSettings(ctx)
    return result
  })

  handle(CHANNELS.engineUpdate, UpdateEngineSchema, 'reject', (req): EngineWriteResult => {
    const result = updateProviderSettings(req.key, req.settingsJson)
    refreshProviderSettings(ctx)
    return result
  })

  handle(CHANNELS.engineDelete, DeleteEngineSchema, 'reject', (req): void => {
    deleteProviderSettings(req.key)
    refreshProviderSettings(ctx)
  })

  handle(CHANNELS.engineRead, ReadEngineSchema, 'reject', (req): EngineReadResult => {
    return readProviderSettings(req.key)
  })

  // 사용자 전역 ~/.claude/settings.json 원문 — 모달 자동완성용 (무입력 read, 부재=exists:false).
  handlePlain(
    CHANNELS.engineImportUserSettings,
    (): EngineUserSettingsResult => readUserClaudeSettings()
  )
}
