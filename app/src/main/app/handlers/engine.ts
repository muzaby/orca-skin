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
import { getLogger } from '../../infra/log'

async function refreshProviderSettings(ctx: RouterContext): Promise<void> {
  try {
    const result = await deploy('claude')
    if (!result.validation.ok) {
      for (const err of result.validation.errors) {
        getLogger()
          .child('extensions')
          .warn('extensions.deploy.warning', { message: String(err) })
      }
    }
  } finally {
    ctx.providerSettings.invalidateAll()
  }
}

export function registerEngineHandlers(ctx: RouterContext): void {
  handle(
    CHANNELS.engineAdd,
    CreateEngineSchema,
    'reject',
    async (req): Promise<EngineWriteResult> => {
      const result = addProviderSettings(req.engine, req.provider, req.settingsJson)
      await refreshProviderSettings(ctx)
      return result
    }
  )

  handle(
    CHANNELS.engineUpdate,
    UpdateEngineSchema,
    'reject',
    async (req): Promise<EngineWriteResult> => {
      const result = updateProviderSettings(req.key, req.settingsJson)
      await refreshProviderSettings(ctx)
      return result
    }
  )

  handle(CHANNELS.engineDelete, DeleteEngineSchema, 'reject', async (req): Promise<void> => {
    deleteProviderSettings(req.key)
    await refreshProviderSettings(ctx)
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
