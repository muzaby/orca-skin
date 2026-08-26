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
  addHarnessSettings,
  deleteHarnessSettings,
  readHarnessSettings,
  updateHarnessSettings
} from '../../features/harnesses/settings-write'
import type { RouterContext } from '../context'
import { handle, handlePlain } from '../../infra/ipc/handle'
import { getLogger } from '../../infra/log'
import { canonicalProviderKey, providerKeyOf } from '../../infra/config/provider-key'

async function refreshHarnessSettings(ctx: RouterContext, key: string): Promise<void> {
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
    // **두 cache 를 함께 비운다** (0188) — settings 만 비우면 동적 runtime config 가 옛
    // sourceRevision 기준 값을 warm hit 로 계속 돌려준다.
    ctx.harnessSettings.invalidateAll()
    ctx.harnessRuntime?.invalidate(key, 'harness-settings-crud')
    await ctx.runtimeModelCatalog?.invalidate(key)
  }
}

export function registerEngineHandlers(ctx: RouterContext): void {
  const assertMutable = (key: string): string => {
    const canonical = canonicalProviderKey(key, ['claude'])
    if (ctx.runtimeModelCatalog?.isReadOnly(canonical)) {
      throw new Error(`runtime-managed engine is read-only: ${canonical}`)
    }
    return canonical
  }
  handle(
    CHANNELS.engineAdd,
    CreateEngineSchema,
    'reject',
    async (req): Promise<EngineWriteResult> => {
      const canonical = assertMutable(providerKeyOf(req.engine, req.provider))
      const result = addHarnessSettings(req.engine, req.provider, req.settingsJson)
      await refreshHarnessSettings(ctx, canonical)
      return result
    }
  )

  handle(
    CHANNELS.engineUpdate,
    UpdateEngineSchema,
    'reject',
    async (req): Promise<EngineWriteResult> => {
      const canonical = assertMutable(req.key)
      const result = updateHarnessSettings(req.key, req.settingsJson)
      await refreshHarnessSettings(ctx, canonical)
      return result
    }
  )

  handle(CHANNELS.engineDelete, DeleteEngineSchema, 'reject', async (req): Promise<void> => {
    const canonical = assertMutable(req.key)
    deleteHarnessSettings(req.key)
    await refreshHarnessSettings(ctx, canonical)
  })

  handle(CHANNELS.engineRead, ReadEngineSchema, 'reject', (req): EngineReadResult => {
    assertMutable(req.key)
    return readHarnessSettings(req.key)
  })

  // 사용자 전역 ~/.claude/settings.json 원문 — 모달 자동완성용 (무입력 read, 부재=exists:false).
  handlePlain(CHANNELS.engineImportUserSettings, (): EngineUserSettingsResult =>
    readUserClaudeSettings()
  )
}
